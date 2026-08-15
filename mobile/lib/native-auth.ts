import * as SecureStore from 'expo-secure-store'
import { Platform } from 'react-native'

const DEFAULT_API_BASE_URL = 'https://platform.zhangak.com/v1'
const SESSION_STORAGE_KEY = 'zhangak.native.session.v1'
const SESSION_VERSION = 1

export type ZhangakRole = 'student' | 'admin' | 'super_admin' | 'admin_jr' | 'teacher' | 'manager' | 'director' | 'finance' | 'math_student' | 'math_parent' | 'math_admin'
export type ZhangakStudentType = 'online' | 'offline' | null

export interface ZhangakNativeUser {
  id: string
  email: string
  fullName: string | null
  role: ZhangakRole
  studentType: ZhangakStudentType
  phone: string | null
  targetScore: number | null
  avatarUrl: string | null
}

export interface NativeSession {
  version: typeof SESSION_VERSION
  accessToken: string
  refreshToken: string
  user: ZhangakNativeUser
}

export type NativeAuthStatus = 'loading' | 'authenticated' | 'signed_out' | 'error'

export interface NativeAuthSnapshot {
  status: NativeAuthStatus
  session: NativeSession | null
  error: string | null
}

/** The Expo companion is intentionally native-only. */
export function isSupportedNativeStudent(user: ZhangakNativeUser | null | undefined): user is ZhangakNativeUser {
  return user?.role === 'student' && user.studentType === 'online'
}

interface LoginResponse {
  user: ZhangakNativeUser
  accessToken: string
  refreshToken: string
}

interface RefreshResponse {
  accessToken: string
  refreshToken: string
}

interface MeResponse {
  user: ZhangakNativeUser
}

interface ErrorResponse {
  error?: unknown
  code?: unknown
}

export class ZhangakApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'ZhangakApiError'
    this.status = status
    this.code = code
  }
}

let cachedSession: NativeSession | null | undefined
let refreshInFlight: Promise<NativeSession | null> | null = null
let restoreInFlight: Promise<NativeSession | null> | null = null
let sessionRevision = 0
let snapshot: NativeAuthSnapshot = { status: 'loading', session: null, error: null }
const subscribers = new Set<(next: NativeAuthSnapshot) => void>()

function apiBaseUrl() {
  if (Platform.OS === 'web') {
    throw new ZhangakApiError(0, 'native_only', 'Приложение Жангак доступно на iOS и Android')
  }
  const configured = process.env.EXPO_PUBLIC_ZHANGAK_API_URL?.trim() || DEFAULT_API_BASE_URL
  let url: URL
  try {
    url = new URL(configured)
  } catch {
    throw new ZhangakApiError(0, 'invalid_api_url', 'Некорректный адрес API Жангак')
  }

  if (url.protocol !== 'https:') {
    throw new ZhangakApiError(0, 'insecure_api_url', 'Для приложения требуется защищённый HTTPS-адрес API')
  }

  return url.toString().replace(/\/$/, '')
}

function apiUrl(path: string) {
  if (!path.startsWith('/')) throw new ZhangakApiError(0, 'invalid_api_path', 'Некорректный путь API')
  return `${apiBaseUrl()}${path}`
}

function emit(next: NativeAuthSnapshot) {
  snapshot = next
  for (const subscriber of subscribers) subscriber(snapshot)
}

function validUser(value: unknown): value is ZhangakNativeUser {
  if (!value || typeof value !== 'object') return false
  const user = value as Record<string, unknown>
  return typeof user.id === 'string'
    && typeof user.email === 'string'
    && typeof user.role === 'string'
    && (user.studentType === 'online' || user.studentType === 'offline' || user.studentType === null)
}

function validSession(value: unknown): value is NativeSession {
  if (!value || typeof value !== 'object') return false
  const session = value as Record<string, unknown>
  return session.version === SESSION_VERSION
    && typeof session.accessToken === 'string'
    && session.accessToken.length > 0
    && typeof session.refreshToken === 'string'
    && session.refreshToken.length > 0
    && validUser(session.user)
}

function apiErrorFromPayload(status: number, payload: unknown) {
  const body = payload && typeof payload === 'object' ? payload as ErrorResponse : null
  const code = typeof body?.code === 'string' ? body.code : 'request_failed'
  const message = typeof body?.error === 'string' ? body.error : 'Сервис временно недоступен'
  return new ZhangakApiError(status, code, message)
}

async function parseResponse(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text) as unknown
  } catch {
    throw new ZhangakApiError(response.status, 'invalid_response', 'Сервер вернул некорректный ответ')
  }
}

async function rawRequest(path: string, init: RequestInit = {}, accessToken?: string) {
  const headers = new Headers(init.headers)
  headers.set('Accept', 'application/json')
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)
  if (init.body != null && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')

  try {
    return await fetch(apiUrl(path), { ...init, headers, credentials: 'omit' })
  } catch {
    throw new ZhangakApiError(0, 'network_error', 'Не удалось связаться с сервером. Проверьте подключение к интернету.')
  }
}

async function responseJson<T>(response: Response): Promise<T> {
  const payload = await parseResponse(response)
  if (!response.ok) throw apiErrorFromPayload(response.status, payload)
  return payload as T
}

async function readStoredSession(): Promise<NativeSession | null> {
  if (cachedSession !== undefined) return cachedSession

  let raw: string | null
  try {
    raw = await SecureStore.getItemAsync(SESSION_STORAGE_KEY)
  } catch {
    throw new ZhangakApiError(0, 'secure_storage_unavailable', 'Не удалось открыть защищённое хранилище устройства')
  }

  if (!raw) {
    cachedSession = null
    return null
  }

  try {
    const parsed = JSON.parse(raw) as unknown
    if (!validSession(parsed)) throw new Error('invalid session')
    cachedSession = parsed
    return parsed
  } catch {
    cachedSession = null
    try {
      await SecureStore.deleteItemAsync(SESSION_STORAGE_KEY)
    } catch {
      // There is no valid local session to preserve. The next storage call
      // will surface a device-specific error if the keystore is unavailable.
    }
    return null
  }
}

async function persistSession(session: NativeSession) {
  try {
    await SecureStore.setItemAsync(SESSION_STORAGE_KEY, JSON.stringify(session))
  } catch {
    throw new ZhangakApiError(0, 'secure_storage_unavailable', 'Не удалось сохранить защищённую сессию на устройстве')
  }

  cachedSession = session
  sessionRevision += 1
  emit({ status: 'authenticated', session, error: null })
}

async function clearStoredSession() {
  cachedSession = null
  sessionRevision += 1
  try {
    await SecureStore.deleteItemAsync(SESSION_STORAGE_KEY)
  } catch {
    // Local sign-out must still complete in memory when a platform keystore
    // refuses deletion. A later launch will attempt cleanup again.
  }
  emit({ status: 'signed_out', session: null, error: null })
}

function validLoginResponse(value: unknown): value is LoginResponse {
  if (!value || typeof value !== 'object') return false
  const response = value as Record<string, unknown>
  return validUser(response.user)
    && typeof response.accessToken === 'string'
    && response.accessToken.length > 0
    && typeof response.refreshToken === 'string'
    && response.refreshToken.length > 0
}

function validRefreshResponse(value: unknown): value is RefreshResponse {
  if (!value || typeof value !== 'object') return false
  const response = value as Record<string, unknown>
  return typeof response.accessToken === 'string'
    && response.accessToken.length > 0
    && typeof response.refreshToken === 'string'
    && response.refreshToken.length > 0
}

async function refreshSession(): Promise<NativeSession | null> {
  if (refreshInFlight) return refreshInFlight

  refreshInFlight = (async () => {
    const current = await readStoredSession()
    if (!current) return null

    const response = await rawRequest('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: current.refreshToken }),
    })
    const payload = await parseResponse(response)
    if (!response.ok) {
      if (response.status === 401) await clearStoredSession()
      throw apiErrorFromPayload(response.status, payload)
    }
    if (!validRefreshResponse(payload)) {
      await clearStoredSession()
      throw new ZhangakApiError(response.status, 'invalid_response', 'Сервер не вернул новую сессию')
    }

    const next: NativeSession = {
      ...current,
      accessToken: payload.accessToken,
      refreshToken: payload.refreshToken,
    }
    await persistSession(next)
    return next
  })().finally(() => {
    refreshInFlight = null
  })

  return refreshInFlight
}

async function authenticatedResponse(path: string, init: RequestInit = {}) {
  const session = await readStoredSession()
  if (!session) throw new ZhangakApiError(401, 'unauthorized', 'Требуется авторизация')

  const firstResponse = await rawRequest(path, init, session.accessToken)
  if (firstResponse.status !== 401) return firstResponse

  const refreshed = await refreshSession()
  if (!refreshed) throw new ZhangakApiError(401, 'session_expired', 'Сессия истекла. Войдите снова.')

  const retryResponse = await rawRequest(path, init, refreshed.accessToken)
  if (retryResponse.status === 401) await clearStoredSession()
  return retryResponse
}

/**
 * First-party bearer client for native-only endpoints. It retries an
 * authenticated request once after a single shared refresh. Do not place
 * passwords or other credentials in this helper's persisted session shape.
 */
export async function nativeApiJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  return responseJson<T>(await authenticatedResponse(path, init))
}

export function currentNativeAuth() {
  return snapshot
}

export function subscribeNativeAuth(listener: (next: NativeAuthSnapshot) => void) {
  subscribers.add(listener)
  return () => {
    subscribers.delete(listener)
  }
}

export async function restoreNativeSession(): Promise<NativeSession | null> {
  if (restoreInFlight) return restoreInFlight

  restoreInFlight = (async () => {
    const revisionAtStart = sessionRevision
    let stored: NativeSession | null
    try {
      stored = await readStoredSession()
    } catch (error) {
      if (revisionAtStart === sessionRevision) {
        emit({ status: 'error', session: null, error: error instanceof Error ? error.message : 'Не удалось проверить сессию' })
      }
      // The provider deliberately starts this check without awaiting it.
      // The error state above is sufficient for UI recovery; rethrowing here
      // would create an unhandled rejection on a device with a broken keychain.
      return null
    }

    if (!stored) {
      if (revisionAtStart === sessionRevision) emit({ status: 'signed_out', session: null, error: null })
      return null
    }

    try {
      const { user } = await nativeApiJson<MeResponse>('/auth/me')
      const latest = await readStoredSession()
      if (!latest || revisionAtStart !== sessionRevision) return latest
      if (!isSupportedNativeStudent(user)) {
        try {
          await rawRequest('/auth/logout', { method: 'POST' }, latest.accessToken)
        } finally {
          await clearStoredSession()
        }
        return null
      }
      const verified: NativeSession = { ...latest, user }
      await persistSession(verified)
      return verified
    } catch (error) {
      if (error instanceof ZhangakApiError && error.status === 401) {
        await clearStoredSession()
        return null
      }
      if (revisionAtStart === sessionRevision) {
        emit({ status: 'error', session: stored, error: error instanceof Error ? error.message : 'Не удалось проверить сессию' })
      }
      return stored
    }
  })().finally(() => {
    restoreInFlight = null
  })

  return restoreInFlight
}

export async function signInNative(email: string, password: string): Promise<NativeSession> {
  const normalizedEmail = email.trim().toLowerCase()
  if (!normalizedEmail || !password) {
    throw new ZhangakApiError(400, 'missing_credentials', 'Введите email и пароль')
  }

  const response = await rawRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: normalizedEmail, password }),
  })
  const payload = await responseJson<unknown>(response)
  if (!validLoginResponse(payload)) {
    throw new ZhangakApiError(response.status, 'invalid_response', 'Сервер не вернул сессию приложения')
  }

  // The native application currently supports the same online-student
  // audience as its existing tab screens. Never retain an unsupported role's
  // tokens merely because the login endpoint accepted the credentials.
  if (!isSupportedNativeStudent(payload.user)) {
    try {
      await rawRequest('/auth/logout', { method: 'POST' }, payload.accessToken)
    } finally {
      await clearStoredSession()
    }
    throw new ZhangakApiError(403, 'unsupported_role', 'Это приложение доступно только онлайн-ученикам')
  }

  const session: NativeSession = {
    version: SESSION_VERSION,
    accessToken: payload.accessToken,
    refreshToken: payload.refreshToken,
    user: payload.user,
  }
  await persistSession(session)
  return session
}

/**
 * Revoke the current backend session when reachable, then always remove the
 * local bearer and refresh tokens. This deliberately never stores a password.
 */
export async function signOutNative() {
  try {
    await nativeApiJson<{ success: true }>('/auth/logout', { method: 'POST' })
  } catch {
    // Clearing local secrets still protects the device if it is offline or
    // the server is temporarily unavailable. The server expiry/revocation
    // policy remains the fallback for an unreachable logout request.
  } finally {
    await clearStoredSession()
  }
}
