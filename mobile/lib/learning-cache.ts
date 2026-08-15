import AsyncStorage from '@react-native-async-storage/async-storage'

const CACHE_SCHEMA_VERSION = 1
const CACHE_PREFIX = `zhangak.native.learning-cache.v${CACHE_SCHEMA_VERSION}`
const MAX_CACHE_BYTES = 512 * 1024
const MAX_CACHE_AGE_MS = 7 * 24 * 60 * 60 * 1000
const USER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const RESOURCE = /^(?:lessons|lesson:[1-9]\d*)$/
const FORBIDDEN_FIELD = /^(?:accessToken|refreshToken|password|authorization|correctAnswer|correct_answer)$/

interface CacheEnvelope {
  schemaVersion: typeof CACHE_SCHEMA_VERSION
  savedAt: number
  payload: unknown
}

export interface CachedLearningValue {
  payload: unknown
  savedAt: number
}

function cacheKey(userId: string, resource: string) {
  if (!USER_ID.test(userId)) return null
  if (!RESOURCE.test(resource)) return null
  return `${CACHE_PREFIX}:${userId.toLowerCase()}:${resource}`
}

function isSafePayload(value: unknown, depth = 0): boolean {
  if (depth > 24) return false
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return true
  if (Array.isArray(value)) return value.every(item => isSafePayload(item, depth + 1))
  if (!value || typeof value !== 'object') return false
  return Object.entries(value as Record<string, unknown>).every(([key, item]) => !FORBIDDEN_FIELD.test(key) && isSafePayload(item, depth + 1))
}

function parseEnvelope(value: unknown): CacheEnvelope | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const envelope = value as Record<string, unknown>
  if (envelope.schemaVersion !== CACHE_SCHEMA_VERSION || !Number.isFinite(envelope.savedAt) || typeof envelope.savedAt !== 'number') return null
  if (!isSafePayload(envelope.payload)) return null
  return { schemaVersion: CACHE_SCHEMA_VERSION, savedAt: envelope.savedAt, payload: envelope.payload }
}

/**
 * AsyncStorage is unencrypted. This cache is deliberately limited to sanitized
 * lesson metadata, is scoped to one authenticated user, and never accepts
 * tokens, answer keys, passwords, or private material URLs.
 */
export async function saveLearningCache(userId: string, resource: string, payload: unknown): Promise<void> {
  const key = cacheKey(userId, resource)
  if (!key || !isSafePayload(payload)) return

  const serialized = JSON.stringify({ schemaVersion: CACHE_SCHEMA_VERSION, savedAt: Date.now(), payload })
  if (new TextEncoder().encode(serialized).byteLength > MAX_CACHE_BYTES) return

  try {
    await AsyncStorage.setItem(key, serialized)
  } catch {
    // Caching must never make a successfully loaded lesson unavailable.
  }
}

export async function readLearningCache(userId: string, resource: string): Promise<CachedLearningValue | null> {
  const key = cacheKey(userId, resource)
  if (!key) return null

  try {
    const raw = await AsyncStorage.getItem(key)
    if (!raw) return null
    const envelope = parseEnvelope(JSON.parse(raw) as unknown)
    if (!envelope || Date.now() - envelope.savedAt > MAX_CACHE_AGE_MS) {
      await AsyncStorage.removeItem(key)
      return null
    }
    return { payload: envelope.payload, savedAt: envelope.savedAt }
  } catch {
    return null
  }
}

/** Remove every lesson cache entry of the account during local sign-out. */
export async function clearLearningCacheForUser(userId: string): Promise<void> {
  if (!USER_ID.test(userId)) return
  const prefix = `${CACHE_PREFIX}:${userId.toLowerCase()}:`
  try {
    const keys = await AsyncStorage.getAllKeys()
    const owned = keys.filter(key => key.startsWith(prefix))
    if (owned.length > 0) await AsyncStorage.multiRemove(owned)
  } catch {
    // Clearing local data cannot block logout. A later sign-in overwrites only
    // the current user's scoped keys and the server still checks authorization.
  }
}
