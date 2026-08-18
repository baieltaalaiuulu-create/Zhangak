const MIN_SECRET_LENGTH = 32

function required(name) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required`)
  return value
}

function integer(name, fallback, min, max) {
  const raw = process.env[name]
  const value = raw == null || raw === '' ? fallback : Number(raw)
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}`)
  }
  return value
}

function origins() {
  const values = required('ALLOWED_ORIGINS').split(',').map(value => value.trim()).filter(Boolean)
  if (values.length === 0) throw new Error('ALLOWED_ORIGINS must contain at least one origin')
  for (const value of values) {
    const url = new URL(value)
    if (url.pathname !== '/' || url.search || url.hash || !['https:', 'http:'].includes(url.protocol)) {
      throw new Error(`Invalid ALLOWED_ORIGINS entry: ${value}`)
    }
    if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') {
      throw new Error('Production origins must use HTTPS')
    }
  }
  return new Set(values.map(value => value.replace(/\/$/, '')))
}

function optionalAbsolutePath(name) {
  const value = process.env[name]?.trim()
  if (!value) return null
  if (!value.startsWith('/') || value.includes('\0')) throw new Error(`${name} must be an absolute filesystem path`)
  return value
}

function optional(name) {
  return process.env[name]?.trim() || null
}

export function loadConfig() {
  const jwtSecret = required('JWT_SECRET')
  if (jwtSecret.length < MIN_SECRET_LENGTH) throw new Error(`JWT_SECRET must be at least ${MIN_SECRET_LENGTH} characters`)
  if (jwtSecret === 'dev-secret-change-me' || jwtSecret.toLowerCase().includes('replace-me')) {
    throw new Error('JWT_SECRET must not be a placeholder')
  }

  const vapidSubject = optional('VAPID_SUBJECT')
  const vapidPublicKey = optional('VAPID_PUBLIC_KEY')
  const vapidPrivateKey = optional('VAPID_PRIVATE_KEY')
  const vapidValues = [vapidSubject, vapidPublicKey, vapidPrivateKey]
  if (vapidValues.some(Boolean) && !vapidValues.every(Boolean)) {
    throw new Error('VAPID_SUBJECT, VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY must be configured together')
  }
  if (vapidSubject && !/^mailto:[^\s@]+@[^\s@]+$|^https:\/\//i.test(vapidSubject)) {
    throw new Error('VAPID_SUBJECT must be a mailto: or https: contact')
  }

  return Object.freeze({
    nodeEnv: process.env.NODE_ENV ?? 'development',
    host: process.env.HOST?.trim() || '127.0.0.1',
    port: integer('PORT', 3210, 1, 65_535),
    databaseUrl: required('DATABASE_URL'),
    databaseSsl: process.env.DATABASE_SSL === '1',
    jwtSecret,
    accessTtlSeconds: integer('ACCESS_TOKEN_TTL_SECONDS', 900, 60, 3_600),
    refreshTtlDays: integer('REFRESH_TOKEN_TTL_DAYS', 30, 1, 90),
    allowedOrigins: origins(),
    trustProxy: process.env.TRUST_PROXY === '1',
    storageRoot: optionalAbsolutePath('ZHANGAK_STORAGE_ROOT'),
    aiEnabled: process.env.AI_ENABLED === '1',
    aiProvider: (process.env.AI_PROVIDER ?? '').trim().toLowerCase(),
    deepseekApiKey: process.env.DEEPSEEK_API_KEY?.trim() || null,
    deepseekBaseUrl: (process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com').replace(/\/$/, ''),
    deepseekFastModel: process.env.DEEPSEEK_FAST_MODEL?.trim() || 'deepseek-v4-flash',
    vapidSubject,
    vapidPublicKey,
    vapidPrivateKey,
    releaseSha: process.env.ZHANGAK_API_RELEASE_SHA?.trim() || 'dev',
  })
}
