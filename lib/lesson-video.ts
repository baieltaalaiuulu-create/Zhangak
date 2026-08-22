import { zhangakApiRequest } from './zhangak-api-client.ts'

/**
 * Client contract for an authorized lesson video.
 *
 * The browser never receives a watch URL in a lesson or material listing. It
 * receives a `sessionPath`, and exchanges it for a player configuration only
 * when the student actually asks to watch. The server re-checks enrollment
 * and the lesson lock on that exchange.
 *
 * Honest scope: once the exchange succeeds the browser holds the YouTube
 * video id, because no embed can play without it. This module reduces how
 * widely the id is broadcast; it is not a copy-protection mechanism. See
 * docs/operations/lesson-video.md.
 */

/** Privacy-enhanced YouTube host. Never the plain youtube.com embed host. */
export const YOUTUBE_EMBED_HOST = 'https://www.youtube-nocookie.com'

/** Official IFrame Player API. `host` above still routes the embed itself. */
export const YOUTUBE_IFRAME_API_URL = 'https://www.youtube.com/iframe_api'

const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/
const LESSON_SESSION_PATTERN = /^\/v1\/platform\/lessons\/\d+\/video$/
const MATERIAL_SESSION_PATTERN = /^\/v1\/platform\/materials\/\d+\/video$/

export interface LessonVideoHandle {
  /** Server-issued path that trades for a player config. Not a video URL. */
  sessionPath: string
}

export interface LessonVideoConfig {
  videoId: string
  title: string
  embedHost: string
}

function record(value: unknown, context: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Некорректный ответ сервиса: ${context}`)
  }
  return value as Record<string, unknown>
}

/**
 * Parses the `video` field of a lesson or material payload.
 *
 * A payload that still carries a raw URL is rejected rather than rendered:
 * that shape means the caller is talking to an older API than this build
 * expects, and silently falling back to an embedded URL would reintroduce
 * exactly the leak this contract removes.
 */
export function parseLessonVideoHandle(value: unknown, kind: 'lesson' | 'material'): LessonVideoHandle | null {
  if (value === null || typeof value === 'undefined') return null
  const source = record(value, 'видео урока')
  if (source.available !== true) return null
  const sessionPath = source.sessionPath
  const pattern = kind === 'lesson' ? LESSON_SESSION_PATTERN : MATERIAL_SESSION_PATTERN
  if (typeof sessionPath !== 'string' || !pattern.test(sessionPath)) {
    throw new Error('Некорректный ответ сервиса: путь видео')
  }
  return { sessionPath }
}

export function parseLessonVideoConfig(value: unknown): LessonVideoConfig {
  const source = record(value, 'конфигурация видео')
  const video = record(source.video, 'конфигурация видео')
  const videoId = video.videoId
  const title = video.title
  if (typeof videoId !== 'string' || !VIDEO_ID_PATTERN.test(videoId)) {
    throw new Error('Некорректный ответ сервиса: идентификатор видео')
  }
  if (typeof title !== 'string' || title.trim() === '') {
    throw new Error('Некорректный ответ сервиса: название видео')
  }
  // A downgraded host would silently reinstate youtube.com cookies.
  if (video.embedHost !== YOUTUBE_EMBED_HOST) {
    throw new Error('Некорректный ответ сервиса: источник видео')
  }
  return { videoId, title, embedHost: YOUTUBE_EMBED_HOST }
}

/** Exchanges a session path for a player config. Requires a live session. */
export async function requestLessonVideo(handle: LessonVideoHandle): Promise<LessonVideoConfig> {
  return parseLessonVideoConfig(await zhangakApiRequest<unknown>(handle.sessionPath, { method: 'POST' }))
}

export type LessonVideoEvent = 'started' | 'progress' | 'ended'

/**
 * Reports playback to the server for analytics only.
 *
 * There is deliberately no return value a caller could treat as a reward.
 * XP, stars and lesson completion are decided by the lesson completion and
 * scored practice routes; a forged `ended` here changes nothing a student
 * can see on their progress.
 */
export async function reportLessonVideoEvent(input: {
  lessonId: number
  materialId: number | null
  event: LessonVideoEvent
  positionSeconds: number
}): Promise<void> {
  await zhangakApiRequest<unknown>('/v1/platform/video-events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      lessonId: input.lessonId,
      materialId: input.materialId,
      event: input.event,
      positionSeconds: Math.max(0, Math.min(86_400, Math.floor(input.positionSeconds))),
    }),
  })
}

/**
 * Player parameters for the IFrame API.
 *
 * `origin` is taken from the live document rather than a build constant, so
 * the value is always the exact origin YouTube sees. Deprecated parameters
 * (`modestbranding`, `showinfo`, `autohide`) are intentionally absent: they
 * no longer do anything and asking for them implies a branding guarantee the
 * embed does not give.
 */
export function youtubePlayerVars(origin: string): Record<string, number | string> {
  return {
    enablejsapi: 1,
    playsinline: 1,
    rel: 0,
    origin,
  }
}
