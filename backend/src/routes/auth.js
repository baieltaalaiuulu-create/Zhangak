import { parseCookies, POST, GET, readJson, HttpError } from '../http.js'
import { query, transaction } from '../db.js'
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  authCookies,
  clearAuthCookies,
  createSession,
  loginBucket,
  requestMeta,
  requireAuth,
  rotateSession,
} from '../auth.js'
import { hashPassword, verifyPassword } from '../security.js'
import { tokenHash, verifyAccessToken } from '../security.js'

const DUMMY_HASH = hashPassword('zhangak-dummy-password-not-an-account')
const LOGIN_WINDOW_MINUTES = 15
const LOGIN_MAX_FAILURES = 10

function exactBody(body, keys) {
  const actual = Object.keys(body).sort()
  const expected = [...keys].sort()
  return actual.length === expected.length && actual.every((key, index) => key === expected[index])
}

function normalizeEmail(value) {
  if (typeof value !== 'string') return null
  const email = value.trim().toLowerCase()
  if (email.length < 3 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null
  return email
}

function publicUser(row) {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: row.role,
    studentType: row.student_type,
    phone: row.phone,
    targetScore: row.target_score,
    avatarUrl: row.avatar_url,
  }
}

POST('/v1/auth/login', async ({ req, config, ip }) => {
  const body = await readJson(req, 8_000)
  if (!exactBody(body, ['email', 'password'])) throw new HttpError(400, 'Некорректные данные', 'invalid_credentials')
  const email = normalizeEmail(body.email)
  if (!email || typeof body.password !== 'string' || body.password.length > 200) {
    throw new HttpError(401, 'Неверный email или пароль', 'invalid_credentials')
  }

  const bucket = loginBucket(config, email, ip)
  const recent = await query(
    `SELECT count(*)::int failures
       FROM auth_login_attempts
      WHERE bucket_hash = $1 AND succeeded = false
        AND attempted_at > now() - ($2 * interval '1 minute')`,
    [bucket, LOGIN_WINDOW_MINUTES],
  )
  if (recent.rows[0].failures >= LOGIN_MAX_FAILURES) {
    throw new HttpError(429, 'Слишком много попыток. Попробуйте позже.', 'login_rate_limited')
  }

  const result = await query(
    `SELECT u.id, u.email, u.password_hash, u.blocked, u.session_version,
            p.full_name, p.role, p.student_type, p.phone, p.target_score, p.avatar_url
       FROM users u JOIN profiles p ON p.user_id = u.id
      WHERE u.email = $1`,
    [email],
  )
  const user = result.rows[0]
  const validPassword = await verifyPassword(body.password, user?.password_hash ?? await DUMMY_HASH)
  const success = !!user && !user.blocked && validPassword
  await query('INSERT INTO auth_login_attempts (bucket_hash, succeeded) VALUES ($1, $2)', [bucket, success])
  if (!success) throw new HttpError(401, 'Неверный email или пароль', 'invalid_credentials')

  const session = await transaction(client => createSession(config, client, user, requestMeta(config, req, ip)))
  return {
    status: 200,
    headers: { 'Set-Cookie': authCookies(config, session.access, session.refresh) },
    body: {
      user: publicUser(user),
      accessToken: session.access,
      ...(req.headers.origin ? {} : { refreshToken: session.refresh }),
    },
  }
})

POST('/v1/auth/refresh', async ({ req, config, ip }) => {
  let refresh = parseCookies(req)[REFRESH_COOKIE]
  if (!refresh) {
    const body = await readJson(req, 8_000)
    if (!exactBody(body, ['refreshToken']) || typeof body.refreshToken !== 'string') {
      throw new HttpError(401, 'Сессия истекла', 'refresh_invalid')
    }
    refresh = body.refreshToken
  }
  const session = await rotateSession(config, refresh, requestMeta(config, req, ip))
  return {
    status: 200,
    headers: { 'Set-Cookie': authCookies(config, session.access, session.refresh) },
    body: { accessToken: session.access, ...(req.headers.origin ? {} : { refreshToken: session.refresh }) },
  }
})

POST('/v1/auth/logout', async ({ req, config }) => {
  const cookies = parseCookies(req)
  const access = req.headers.authorization?.match(/^Bearer\s+(\S+)$/i)?.[1] ?? cookies[ACCESS_COOKIE]
  const refresh = cookies[REFRESH_COOKIE]
  const claims = verifyAccessToken(config, access)
  await query(
    `UPDATE auth_sessions SET revoked_at = COALESCE(revoked_at, now())
      WHERE ($1::uuid IS NOT NULL AND id = $1::uuid)
         OR ($2::text IS NOT NULL AND refresh_hash = $2::text)`,
    [claims?.sid ?? null, refresh ? tokenHash(refresh) : null],
  )
  return { status: 200, headers: { 'Set-Cookie': clearAuthCookies() }, body: { success: true } }
})

GET('/v1/auth/me', async ({ req, config }) => {
  const user = await requireAuth(config, req)
  return { status: 200, body: { user: publicUser(user) } }
})
