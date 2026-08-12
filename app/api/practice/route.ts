import { NextRequest, NextResponse } from 'next/server'

import { requireBearerAuth } from '@/lib/api-auth'
import { PRACTICE_CONTRACT_VERSION } from '@/lib/learning/practice-contract'
import {
  parseBeginPracticeRequest,
  parsePracticeAttemptResponse,
  parsePracticeSubmissionResponse,
  parseSubmitPracticeRequest,
} from '@/lib/learning/practice-validation'

export const dynamic = 'force-dynamic'

const MAX_BODY_BYTES = 32_000
const REQUESTS_PER_MINUTE = 30
const rateWindows = new Map<string, { startedAt: number; count: number }>()

type BoundedBody = { ok: true; text: string } | { ok: false }

function json(body: unknown, init: ResponseInit = {}): NextResponse {
  const headers = new Headers(init.headers)
  headers.set('Cache-Control', 'no-store')
  headers.set('X-Content-Type-Options', 'nosniff')
  return NextResponse.json(body, { ...init, headers })
}

function isEnabled(): boolean {
  return process.env.PRACTICE_TRUSTED_SUBMISSION_ENABLED === '1'
}

function consumeRateLimit(userId: string): boolean {
  const now = Date.now()
  const existing = rateWindows.get(userId)
  if (!existing || now - existing.startedAt >= 60_000) {
    rateWindows.set(userId, { startedAt: now, count: 1 })
  } else if (existing.count >= REQUESTS_PER_MINUTE) {
    return false
  } else {
    existing.count += 1
  }

  if (rateWindows.size > 1_000) {
    for (const [key, window] of rateWindows) {
      if (now - window.startedAt >= 10 * 60_000) rateWindows.delete(key)
    }
  }
  return true
}

function rpcError(operation: 'begin' | 'submit', code?: string): NextResponse {
  if (code === '42501') return json({ error: 'Доступ запрещён' }, { status: 403 })
  if (code === 'P0001' || code === '23505' || code === '40001') {
    return json(
      { error: operation === 'begin' ? 'Попытка недоступна' : 'Попытка уже завершена' },
      { status: 409 },
    )
  }
  return json({ error: 'Сервис практики временно недоступен' }, { status: 503 })
}

function queryInput(request: NextRequest): Record<string, unknown> | null {
  const entries = [...request.nextUrl.searchParams.entries()]
  if (new Set(entries.map(([key]) => key)).size !== entries.length) return null
  const input: Record<string, unknown> = Object.fromEntries(entries)
  if (Object.hasOwn(input, 'testId')) {
    input.testId = /^\d+$/.test(String(input.testId)) ? Number(input.testId) : Number.NaN
  }
  return input
}

async function readBoundedBody(request: Request): Promise<BoundedBody> {
  const contentLength = request.headers.get('content-length')
  if (contentLength && /^\d+$/.test(contentLength) && Number(contentLength) > MAX_BODY_BYTES) {
    return { ok: false }
  }
  if (!request.body) return { ok: true, text: '' }

  const reader = request.body.getReader()
  const decoder = new TextDecoder()
  let bytesRead = 0
  let text = ''
  try {
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) break
      bytesRead += chunk.value.byteLength
      if (bytesRead > MAX_BODY_BYTES) {
        await reader.cancel()
        return { ok: false }
      }
      text += decoder.decode(chunk.value, { stream: true })
    }
    text += decoder.decode()
    return { ok: true, text }
  } finally {
    reader.releaseLock()
  }
}

/**
 * Starts or safely replays a practice attempt. The database function must be
 * one atomic SECURITY DEFINER transaction and derive identity from auth.uid().
 */
export async function GET(request: NextRequest) {
  const auth = await requireBearerAuth(request)
  if (!auth.authorized) return auth.response
  if (!consumeRateLimit(auth.user.id)) return json({ error: 'Слишком много запросов' }, { status: 429 })

  const rawInput = queryInput(request)
  if (!rawInput) return json({ error: 'Некорректные параметры' }, { status: 400 })
  const parsed = parseBeginPracticeRequest(rawInput)
  if (!parsed.ok) return json({ error: 'Некорректные параметры', field: parsed.field }, { status: 400 })
  if (!isEnabled()) return json({ error: 'Сервис практики временно недоступен' }, { status: 503 })

  const input = parsed.value
  const { data, error } = await auth.client.rpc('begin_practice_attempt_v2', {
    p_contract_version: PRACTICE_CONTRACT_VERSION,
    p_mode: input.mode,
    p_test_id: input.mode === 'test' ? input.testId : null,
    p_section: input.mode === 'topic' ? input.section : null,
    p_topic: input.mode === 'topic' ? input.topic : null,
    p_idempotency_key: input.idempotencyKey,
  })
  if (error) return rpcError('begin', error.code)

  const response = parsePracticeAttemptResponse(data)
  if (!response.ok) return json({ error: 'Сервис практики вернул некорректный ответ' }, { status: 503 })
  return json(response.value)
}

/** Finalizes an attempt through exactly one atomic database call. */
export async function POST(request: NextRequest) {
  const auth = await requireBearerAuth(request)
  if (!auth.authorized) return auth.response
  if (!consumeRateLimit(auth.user.id)) return json({ error: 'Слишком много запросов' }, { status: 429 })

  let boundedBody: BoundedBody
  try {
    boundedBody = await readBoundedBody(request)
  } catch {
    return json({ error: 'Некорректный запрос' }, { status: 400 })
  }
  if (!boundedBody.ok) return json({ error: 'Запрос слишком большой' }, { status: 413 })
  const rawBody = boundedBody.text
  if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
    return json({ error: 'Запрос слишком большой' }, { status: 413 })
  }

  let body: unknown
  try {
    body = JSON.parse(rawBody)
  } catch {
    return json({ error: 'Некорректный JSON' }, { status: 400 })
  }
  const parsed = parseSubmitPracticeRequest(body)
  if (!parsed.ok) return json({ error: 'Некорректные данные', field: parsed.field }, { status: 400 })
  if (!isEnabled()) return json({ error: 'Сервис практики временно недоступен' }, { status: 503 })

  const input = parsed.value
  const { data, error } = await auth.client.rpc('submit_practice_attempt_v2', {
    p_contract_version: PRACTICE_CONTRACT_VERSION,
    p_attempt_id: input.attemptId,
    p_idempotency_key: input.idempotencyKey,
    p_elapsed_seconds: input.elapsedSeconds,
    p_answers: input.answers,
  })
  if (error) return rpcError('submit', error.code)

  const response = parsePracticeSubmissionResponse(data)
  if (!response.ok) return json({ error: 'Сервис практики вернул некорректный ответ' }, { status: 503 })
  return json(response.value)
}
