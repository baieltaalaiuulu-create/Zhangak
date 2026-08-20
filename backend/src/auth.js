import { query, transaction } from './db.js'
import { HttpError, parseCookies, serializeCookie } from './http.js'
import { privacyHash, randomRefreshToken, signAccessToken, tokenHash, verifyAccessToken } from './security.js'

export const ACCESS_COOKIE = 'zhangak_access'
export const REFRESH_COOKIE = 'zhangak_refresh'

function bearer(req) {
  const match = req.headers.authorization?.match(/^Bearer\s+(\S+)$/i)
  return match?.[1] ?? null
}

function accessToken(req) {
  return bearer(req) ?? parseCookies(req)[ACCESS_COOKIE] ?? null
}

export function authCookies(config, access, refresh) {
  return [
    serializeCookie(ACCESS_COOKIE, access, { maxAge: config.accessTtlSeconds, sameSite: 'Lax' }),
    serializeCookie(REFRESH_COOKIE, refresh, { maxAge: config.refreshTtlDays * 86_400, sameSite: 'Strict', path: '/v1/auth' }),
  ]
}

export function clearAuthCookies() {
  return [
    serializeCookie(ACCESS_COOKIE, '', { maxAge: 0, sameSite: 'Lax' }),
    serializeCookie(REFRESH_COOKIE, '', { maxAge: 0, sameSite: 'Strict', path: '/v1/auth' }),
  ]
}

export function clientSessionTokens(req, session) {
  if (req.headers.origin) return {}
  return { accessToken: session.access, refreshToken: session.refresh }
}

export async function createSession(config, client, user, requestMeta, rotatedFrom = null) {
  const refresh = randomRefreshToken()
  const result = await client.query(
    `INSERT INTO auth_sessions (user_id, refresh_hash, expires_at, rotated_from, user_agent, ip_hash)
     VALUES ($1, $2, now() + ($3 * interval '1 day'), $4, $5, $6)
     RETURNING id`,
    [user.id, tokenHash(refresh), config.refreshTtlDays, rotatedFrom, requestMeta.userAgent, requestMeta.ipHash],
  )
  const sessionId = result.rows[0].id
  const access = signAccessToken(config, { sub: user.id, sid: sessionId, sv: user.session_version })
  return { access, refresh, sessionId }
}

export async function requireAuth(config, req) {
  const claims = verifyAccessToken(config, accessToken(req))
  if (!claims) throw new HttpError(401, 'Требуется авторизация', 'unauthorized')
  const result = await query(
    `SELECT u.id, u.email, u.blocked, u.session_version,
            p.full_name, p.role, p.student_type, p.phone, p.target_score, p.avatar_url,
            p.profile_color, p.daily_study_goal_minutes, p.community_visibility
       FROM users u
       JOIN profiles p ON p.user_id = u.id
       JOIN auth_sessions s ON s.id = $2 AND s.user_id = u.id
      WHERE u.id = $1 AND s.revoked_at IS NULL AND s.expires_at > now()`,
    [claims.sub, claims.sid],
  )
  const user = result.rows[0]
  if (!user || user.blocked || user.session_version !== claims.sv) throw new HttpError(401, 'Сессия недействительна', 'session_revoked')
  return { ...user, sessionId: claims.sid }
}

export async function rotateSession(config, refreshToken, requestMeta) {
  if (!refreshToken) throw new HttpError(401, 'Сессия истекла', 'refresh_invalid')
  return transaction(async client => {
    const result = await client.query(
      `SELECT s.id session_id, s.user_id, s.expires_at, s.revoked_at,
              u.id, u.blocked, u.session_version
         FROM auth_sessions s
         JOIN users u ON u.id = s.user_id
        WHERE s.refresh_hash = $1
        FOR UPDATE`,
      [tokenHash(refreshToken)],
    )
    const row = result.rows[0]
    if (!row || row.revoked_at || row.blocked || new Date(row.expires_at).getTime() <= Date.now()) {
      if (row?.user_id) {
        await client.query('UPDATE auth_sessions SET revoked_at = COALESCE(revoked_at, now()) WHERE user_id = $1', [row.user_id])
      }
      throw new HttpError(401, 'Сессия истекла', 'refresh_invalid')
    }
    await client.query('UPDATE auth_sessions SET revoked_at = now(), last_seen_at = now() WHERE id = $1', [row.session_id])
    return createSession(config, client, row, requestMeta, row.session_id)
  })
}

export function requestMeta(config, req, ip) {
  return {
    userAgent: String(req.headers['user-agent'] ?? '').slice(0, 500) || null,
    ipHash: privacyHash(config.jwtSecret, ip),
  }
}

export function loginBucket(config, email, ip) {
  return privacyHash(config.jwtSecret, `${String(email).toLowerCase()}|${ip}`)
}
