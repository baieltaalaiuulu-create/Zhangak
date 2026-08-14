import {
  DEFAULT_DAILY_STUDY_GOAL_MINUTES,
  DEFAULT_PROFILE_COLOR,
  isDailyStudyGoalMinutes,
  isProfileColor,
  type DailyStudyGoalMinutes,
  type ProfileColor,
} from './profile-preferences.ts'

export interface ZhangakSessionUser {
  id: string
  email: string
  fullName: string
  role: string
  studentType: string | null
  phone: string | null
  targetScore: number | null
  avatarUrl: string | null
  profileColor: ProfileColor
  dailyStudyGoalMinutes: DailyStudyGoalMinutes
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

const AUTH_REQUEST_TIMEOUT_MS = 8_000

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

function sessionUser(value: unknown): ZhangakSessionUser | null {
  if (!value || typeof value !== 'object') return null
  const user = value as Record<string, unknown>
  const profileColor = user.profileColor === undefined ? DEFAULT_PROFILE_COLOR : user.profileColor
  const dailyStudyGoalMinutes = user.dailyStudyGoalMinutes === undefined
    ? DEFAULT_DAILY_STUDY_GOAL_MINUTES
    : user.dailyStudyGoalMinutes
  if (!(typeof user.id === 'string'
    && typeof user.email === 'string'
    && typeof user.fullName === 'string'
    && typeof user.role === 'string' && ACCOUNT_ROLES.has(user.role)
    && (user.studentType === null || typeof user.studentType === 'string')
    && (user.phone === null || typeof user.phone === 'string')
    && (user.targetScore === null || typeof user.targetScore === 'number')
    && (user.avatarUrl === null || typeof user.avatarUrl === 'string'))) {
    return null
  }
  if (!isProfileColor(profileColor) || !isDailyStudyGoalMinutes(dailyStudyGoalMinutes)) {
    return null
  }
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    studentType: user.studentType,
    phone: user.phone,
    targetScore: user.targetScore,
    avatarUrl: user.avatarUrl,
    profileColor,
    dailyStudyGoalMinutes,
  }
}

async function payload(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) return null
  try { return await response.json() } catch { return null }
}

async function request(path: string, init: RequestInit = {}): Promise<{ response: Response; body: unknown }> {
  let response: Response
  try {
    response = await fetch(`/v1/auth/${path}`, {
      ...init,
      signal: init.signal ?? AbortSignal.timeout(AUTH_REQUEST_TIMEOUT_MS),
      credentials: 'include',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        ...init.headers,
      },
    })
  } catch (cause) {
    const timedOut = cause instanceof Error && (cause.name === 'AbortError' || cause.name === 'TimeoutError')
    throw new ZhangakAuthError(
      timedOut ? 'Сервис входа не ответил вовремя' : 'Не удалось связаться с сервисом входа',
      503,
      timedOut ? 'request_timeout' : 'network_error',
    )
  }
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
  const user = sessionUser(candidate)
  if (!user) throw new ZhangakAuthError('Сервис вернул некорректный профиль', 502, 'invalid_response')
  return user
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
