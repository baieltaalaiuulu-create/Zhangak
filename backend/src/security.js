import { createHash, createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(scryptCallback)
const PASSWORD_N = 16_384
const PASSWORD_R = 8
const PASSWORD_P = 1
const PASSWORD_BYTES = 64

function b64(value) {
  return Buffer.from(value).toString('base64url')
}

function signature(secret, value) {
  return createHmac('sha256', secret).update(value).digest('base64url')
}

export async function hashPassword(password) {
  if (typeof password !== 'string' || password.length < 10 || password.length > 200) {
    throw new Error('Password must contain between 10 and 200 characters')
  }
  const salt = randomBytes(16).toString('base64url')
  const derived = await scrypt(password, salt, PASSWORD_BYTES, {
    N: PASSWORD_N,
    r: PASSWORD_R,
    p: PASSWORD_P,
    maxmem: 64 * 1024 * 1024,
  })
  return `scrypt$${PASSWORD_N}$${PASSWORD_R}$${PASSWORD_P}$${salt}$${Buffer.from(derived).toString('base64url')}`
}

export async function verifyPassword(password, stored) {
  try {
    const [algorithm, n, r, p, salt, encoded] = String(stored).split('$')
    if (algorithm !== 'scrypt' || !salt || !encoded) return false
    const expected = Buffer.from(encoded, 'base64url')
    if (expected.length !== PASSWORD_BYTES) return false
    const candidate = Buffer.from(await scrypt(String(password), salt, expected.length, {
      N: Number(n), r: Number(r), p: Number(p), maxmem: 64 * 1024 * 1024,
    }))
    return timingSafeEqual(candidate, expected)
  } catch {
    return false
  }
}

export function signAccessToken(config, claims) {
  const now = Math.floor(Date.now() / 1_000)
  const header = b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = b64(JSON.stringify({
    iss: 'zhangak-api',
    aud: 'zhangak-app',
    iat: now,
    exp: now + config.accessTtlSeconds,
    jti: randomBytes(12).toString('base64url'),
    ...claims,
  }))
  return `${header}.${payload}.${signature(config.jwtSecret, `${header}.${payload}`)}`
}

export function verifyAccessToken(config, token) {
  const parts = String(token ?? '').split('.')
  if (parts.length !== 3) return null
  const [headerPart, payloadPart, supplied] = parts
  const expected = signature(config.jwtSecret, `${headerPart}.${payloadPart}`)
  const suppliedBuffer = Buffer.from(supplied)
  const expectedBuffer = Buffer.from(expected)
  if (suppliedBuffer.length !== expectedBuffer.length || !timingSafeEqual(suppliedBuffer, expectedBuffer)) return null
  try {
    const header = JSON.parse(Buffer.from(headerPart, 'base64url').toString('utf8'))
    const payload = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8'))
    const now = Math.floor(Date.now() / 1_000)
    if (header.alg !== 'HS256' || header.typ !== 'JWT') return null
    if (payload.iss !== 'zhangak-api' || payload.aud !== 'zhangak-app') return null
    if (!Number.isSafeInteger(payload.iat) || !Number.isSafeInteger(payload.exp) || payload.iat > now + 60 || payload.exp <= now) return null
    if (typeof payload.sub !== 'string' || typeof payload.sid !== 'string' || !Number.isSafeInteger(payload.sv)) return null
    return payload
  } catch {
    return null
  }
}

export function randomRefreshToken() {
  return randomBytes(32).toString('base64url')
}

export function tokenHash(token) {
  return createHash('sha256').update(String(token)).digest('hex')
}

export function privacyHash(secret, value) {
  return createHmac('sha256', secret).update(String(value ?? '')).digest('hex')
}
