// Requires SUPABASE_SERVICE_ROLE_KEY — same service-role write pattern as
// app/api/admin/questions/route.ts.
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/api-auth'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

const QUESTION_FIELDS = new Set([
  'question_text', 'subject', 'section', 'topic', 'difficulty',
  'option_a', 'option_b', 'option_c', 'option_d', 'correct_answer', 'ai_generated',
])

function sanitizeQuestionPayload(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const source = value as Record<string, unknown>
  // challenge_id and order_num are intentionally server-derived even though
  // the editor's local question shape contains them.
  const unknownKeys = Object.keys(source).filter(key => !QUESTION_FIELDS.has(key) && key !== 'challenge_id' && key !== 'order_num')
  if (unknownKeys.length > 0) return null

  const result: Record<string, unknown> = {}
  for (const field of ['question_text', 'option_a', 'option_b', 'option_c', 'option_d'] as const) {
    const item = source[field]
    if (item === undefined) continue
    if (typeof item !== 'string' || item.length > 10_000) return null
    result[field] = item
  }
  if (source.subject !== undefined) {
    if (!['math', 'kyr', 'analogy', 'reading'].includes(String(source.subject))) return null
    result.subject = source.subject
  }
  for (const field of ['section', 'topic'] as const) {
    const item = source[field]
    if (item === undefined) continue
    if (item !== null && (typeof item !== 'string' || item.length > 200)) return null
    result[field] = item
  }
  if (source.difficulty !== undefined) {
    if (!['easy', 'medium', 'hard'].includes(String(source.difficulty))) return null
    result.difficulty = source.difficulty
  }
  if (source.correct_answer !== undefined) {
    if (!['A', 'B', 'C', 'D'].includes(String(source.correct_answer))) return null
    result.correct_answer = source.correct_answer
  }
  if (source.ai_generated !== undefined) {
    if (typeof source.ai_generated !== 'boolean') return null
    result.ai_generated = source.ai_generated
  }
  return Object.keys(result).length > 0 ? result : null
}

export async function POST(req: NextRequest) {
  const authError = await requireAdminApi(req)
  if (authError) return authError

  try {
    const supabaseAdmin = getAdminClient()
    const { challengeId, payload, orderNum } = await req.json()
    const safePayload = sanitizeQuestionPayload(payload)
    if (typeof challengeId !== 'string' || !challengeId || !safePayload || !Number.isInteger(orderNum) || orderNum < 0) {
      return NextResponse.json({ error: 'Некорректные данные вопроса' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('daily_challenge_questions')
      .insert({ challenge_id: challengeId, ...safePayload, order_num: orderNum })
      .select('id')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ id: data?.id })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Неизвестная ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const authError = await requireAdminApi(req)
  if (authError) return authError

  try {
    const supabaseAdmin = getAdminClient()
    const { id, payload } = await req.json()
    const safePayload = sanitizeQuestionPayload(payload)
    if (typeof id !== 'string' || !id || !safePayload) {
      return NextResponse.json({ error: 'Некорректные данные вопроса' }, { status: 400 })
    }

    const { error } = await supabaseAdmin.from('daily_challenge_questions').update(safePayload).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ success: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Неизвестная ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const authError = await requireAdminApi(req)
  if (authError) return authError

  try {
    const supabaseAdmin = getAdminClient()
    const { id } = await req.json()
    if (typeof id !== 'string' || !id) return NextResponse.json({ error: 'Некорректный id' }, { status: 400 })

    const { error } = await supabaseAdmin.from('daily_challenge_questions').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ success: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Неизвестная ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
