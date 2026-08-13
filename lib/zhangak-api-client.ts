'use client'

const REQUEST_TIMEOUT_MS = 15_000

export class ZhangakApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(message: string, status: number, code = 'request_failed') {
    super(message)
    this.name = 'ZhangakApiError'
    this.status = status
    this.code = code
  }
}

function isFirstPartyPath(value: string): boolean {
  return /^\/v1\/(?:platform|admin)(?:\/[a-z0-9-]+)*\/?(?:\?[^#]*)?$/i.test(value)
}

async function readBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) return null
  try { return await response.json() } catch { return null }
}

function failure(response: Response, body: unknown): ZhangakApiError {
  const value = body && typeof body === 'object' ? body as Record<string, unknown> : null
  return new ZhangakApiError(
    typeof value?.error === 'string' ? value.error : 'Сервис временно недоступен',
    response.status,
    typeof value?.code === 'string' ? value.code : 'request_failed',
  )
}

/**
 * Browser client for the first-party API. Sessions stay in HttpOnly cookies;
 * no bearer token is read from browser storage and no Supabase session is
 * involved. Only namespace-scoped BFF paths are accepted.
 */
export async function zhangakApiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (typeof window === 'undefined') throw new Error('zhangakApiRequest is browser-only')
  if (!isFirstPartyPath(path)) throw new Error('Only first-party platform/admin API paths are allowed')

  let response: Response
  try {
    response = await fetch(path, {
      ...init,
      cache: 'no-store',
      credentials: 'include',
      headers: { Accept: 'application/json', ...init.headers },
      signal: init.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch (cause) {
    const timedOut = cause instanceof Error && (cause.name === 'AbortError' || cause.name === 'TimeoutError')
    throw new ZhangakApiError(
      timedOut ? 'Сервис не ответил вовремя' : 'Не удалось связаться с сервисом',
      503,
      timedOut ? 'request_timeout' : 'network_error',
    )
  }

  const body = await readBody(response)
  if (!response.ok) throw failure(response, body)
  if (body == null) throw new ZhangakApiError('Сервис вернул пустой ответ', 502, 'invalid_response')
  return body as T
}

export async function zhangakApiJson<T>(path: string, method: 'POST' | 'PATCH' | 'DELETE', body?: unknown): Promise<T> {
  return zhangakApiRequest<T>(path, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}
