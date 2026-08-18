import { HttpError } from './http.js'

/**
 * Canonical YouTube video reference handling for lesson content.
 *
 * This module is the only place allowed to turn an operator-supplied string
 * into a video identifier. Everything downstream (DB constraint, student
 * video session, player config) works with the normalized 11-character id,
 * never with the raw string an administrator pasted.
 *
 * Honest scope: this is an input-validation boundary, not a content
 * protection mechanism. A browser that is allowed to play the video always
 * learns the id. See docs/operations/lesson-video.md.
 */

// YouTube video ids are exactly 11 characters from the URL-safe base64
// alphabet. Accepting a looser pattern is what lets `/playlist`, `/@channel`
// and truncated ids slip through as if they were videos.
const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/

const WATCH_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com'])
const SHORT_HOSTS = new Set(['youtu.be'])
const EMBED_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
])

// Surfaces that are not a single lesson video. They are rejected explicitly
// instead of being parsed leniently, because each one has a different
// contract (ordering, liveness, channel identity) that v1 does not model.
const REJECTED_PATH_PREFIXES = ['/shorts/', '/live/', '/playlist', '/channel/', '/user/', '/c/', '/results']

const MAX_INPUT_LENGTH = 2048

function reject(code) {
  throw new HttpError(400, 'Разрешена только прямая ссылка на видео YouTube', code)
}

function parseHttpsUrl(value) {
  if (typeof value !== 'string') reject('invalid_video_url')
  const raw = value.trim()
  if (!raw || raw.length > MAX_INPUT_LENGTH) reject('invalid_video_url')
  let url
  try {
    url = new URL(raw)
  } catch {
    reject('invalid_video_url')
  }
  // Protocol tricks (`javascript:`, `data:`, protocol-relative), embedded
  // credentials, a non-default port and a fragment are all rejected before
  // the host is even considered.
  if (url.protocol !== 'https:') reject('invalid_video_scheme')
  if (url.username || url.password) reject('invalid_video_credentials')
  if (url.port) reject('invalid_video_port')
  if (url.hash) reject('invalid_video_fragment')
  return url
}

function assertNotAPlaylist(url) {
  // `watch?v=ID&list=...` plays a playlist, not the reviewed lesson video.
  if (url.searchParams.has('list') || url.searchParams.has('playlist')) reject('invalid_video_playlist')
}

function assertSupportedPath(url) {
  const pathname = url.pathname.toLowerCase()
  if (REJECTED_PATH_PREFIXES.some(prefix => pathname === prefix || pathname.startsWith(prefix))) {
    reject('unsupported_video_surface')
  }
  if (pathname.startsWith('/@')) reject('unsupported_video_surface')
}

function requireVideoId(value) {
  if (typeof value !== 'string' || !VIDEO_ID_PATTERN.test(value)) reject('invalid_video_id')
  return value
}

function segments(url) {
  return url.pathname.split('/').filter(Boolean)
}

/**
 * Normalizes every accepted YouTube form to a single verified video id.
 *
 * Accepted: `watch?v=`, `youtu.be/`, and `/embed/` on youtube.com or
 * youtube-nocookie.com. A lookalike host (`youtube.com.example.net`,
 * `xn--`-punycode homograph, `evil.com/youtube.com/watch`) fails the exact
 * host-set comparison, and raw iframe HTML fails URL parsing.
 */
export function normalizeYoutubeVideoId(value) {
  const url = parseHttpsUrl(value)
  const host = url.hostname.toLowerCase()
  assertSupportedPath(url)
  assertNotAPlaylist(url)

  if (SHORT_HOSTS.has(host)) {
    const parts = segments(url)
    if (parts.length !== 1) reject('unsupported_video_surface')
    return requireVideoId(parts[0])
  }

  const parts = segments(url)
  if (parts[0] === 'embed') {
    if (!EMBED_HOSTS.has(host) || parts.length !== 2) reject('unsupported_video_surface')
    return requireVideoId(parts[1])
  }

  if (WATCH_HOSTS.has(host) && parts.length === 1 && parts[0] === 'watch') {
    return requireVideoId(url.searchParams.get('v') ?? '')
  }

  reject('unsupported_video_surface')
}

/**
 * The single stored representation. Persisting one canonical form keeps the
 * database constraint simple and makes the "is this row a playable video"
 * question answerable without re-running the full parser.
 */
export function canonicalYoutubeWatchUrl(videoId) {
  return `https://www.youtube.com/watch?v=${requireVideoId(videoId)}`
}

/**
 * Non-throwing probe used by read paths that must decide whether an existing
 * stored value is a playable YouTube video without failing the whole request
 * for legacy rows.
 */
export function youtubeVideoIdOrNull(value) {
  try {
    return normalizeYoutubeVideoId(value)
  } catch {
    return null
  }
}

export const YOUTUBE_VIDEO_ID_PATTERN = VIDEO_ID_PATTERN
