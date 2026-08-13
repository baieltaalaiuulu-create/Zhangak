export interface ZhangakSessionUser {
  id: string
  email: string
  fullName: string
  role: string
  studentType: string | null
  phone: string | null
  targetScore: number | null
  avatarUrl: string | null
}

interface UserResponse {
  user: ZhangakSessionUser
}

interface ErrorResponse {
  error?: unknown
  code?: unknown
}

const ACCOUNT_ROLES = new Set([
  'student', 'teacher', 'manager', 'director', 'finance', 'admin_jr',
  'admin', 'super_admin', 'math_student', 'math_parent', 'math_admin',
])

export class ZhangakAuthError extends Error {
  readonly status: number
  readonly code: string

  constructor(
    message: string,
    status: number,
    code: string,
  ) {
    super(message)
    this.name = 'ZhangakAuthError'
    this.status = status
    this.code = code
  }
}

function isSessionUser(value: unknown): value is ZhangakSessionUser {
  if (!value || typeof value !== 'object') return false
  const user = value as Record<string, unknown>
  return typeof user.id === 'string'
    && typeof user.email === 'string'
    && typeof user.fullName === 'string'
    && typeof user.role === 'string' && ACCOUNT_ROLES.has(user.role)
    && (user.studentType === null || typeof user.studentType === 'string')
    && (user.phone === null || typeof user.phone === 'string')
    && (user.targetScore === null || typeof user.targetScore === 'number')
    && (user.avatarUrl === null || typeof user.avatarUrl === 'string')
}

async function payload(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) return null
  try { return await response.json() } catch { return null }
}

async function request(path: string, init: RequestInit = {}): Promise<{ response: Response; body: unknown }> {
  const response = await fetch(`/v1/auth/${path}`, {
    ...init,
    credentials: 'include',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      ...init.headers,
    },
  })
  const body = await payload(response)
  return { response, body }
}

function authError(response: Response, body: unknown): ZhangakAuthError {
  const error = body && typeof body === 'object' ? body as ErrorResponse : null
  return new ZhangakAuthError(
    typeof error?.error === 'string' ? error.error : 'Сервис временно недоступен',
    response.status,
    typeof error?.code === 'string' ? error.code : 'request_failed',
  )
}

function userFrom(body: unknown): ZhangakSessionUser {
  const candidate = body && typeof body === 'object' ? (body as Partial<UserResponse>).user : null
  if (!isSessionUser(candidate)) throw new ZhangakAuthError('Сервис вернул некорректный профиль', 502, 'invalid_response')
  return candidate
}

export async function loginZhangak(email: string, password: string): Promise<ZhangakSessionUser> {
  const { response, body } = await request('login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!response.ok) throw authError(response, body)
  return userFrom(body)
}

async function refreshZhangakSession(): Promise<boolean> {
  const { response } = await request('refresh', { method: 'POST' })
  return response.ok
}

async function readCurrentUser(): Promise<{ response: Response; body: unknown }> {
  return request('me')
}

export async function getCurrentZhangakUser(): Promise<ZhangakSessionUser | null> {
  let current = await readCurrentUser()
  if (current.response.status === 401) {
    if (!await refreshZhangakSession()) return null
    current = await readCurrentUser()
  }
  if (current.response.status === 401) return null
  if (!current.response.ok) throw authError(current.response, current.body)
  return userFrom(current.body)
}

export async function logoutZhangak(): Promise<void> {
  const { response, body } = await request('logout', { method: 'POST' })
  if (!response.ok) throw authError(response, body)
}
