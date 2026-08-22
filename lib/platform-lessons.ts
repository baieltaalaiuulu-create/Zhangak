import { parseLessonVideoHandle, type LessonVideoHandle } from './lesson-video.ts'
import { zhangakApiRequest } from './zhangak-api-client.ts'

export type PlatformLessonSubject = 'math' | 'kyr' | 'other'
export type PlatformLessonStatus = 'done' | 'current' | 'locked'
export type PlatformLessonCompletionMode = 'self' | 'practice'

/**
 * Minimal view shape shared by the lesson cards. The numeric first-party API
 * id is normalized to a string once, so existing Next.js route links stay
 * consistent while all backend-specific fields remain available below.
 */
export interface LessonView {
  id: string
  title: string
  description: string | null
  subject: PlatformLessonSubject
  video_url: string | null
  order_number: number
  durationMinutes?: number | null
}

export interface PlatformLesson extends LessonView {
  apiId: number
  courseId: number
  sourceSubject: string | null
  section: string | null
  topic: string | null
  lessonDate: string | null
  contentUrl: string | null
  /** Present when the lesson owns a playable video. Never a watch URL. */
  video: LessonVideoHandle | null
  isTest: boolean
  /** Derived by the own backend; a practice-bound lesson cannot self-complete. */
  completionMode: PlatformLessonCompletionMode
  /** Derived by the own backend from persisted predecessor progress. */
  isLocked: boolean
  completionPercent: number
  completedAt: string | null
  lastViewedAt: string | null
}

export const PLATFORM_LESSON_SUBJECT_META: Record<PlatformLessonSubject, {
  label: string
  color: string
  bg: string
  strip: string
}> = {
  math: { label: 'Математика', color: 'text-blue-600', bg: 'bg-blue-50', strip: 'bg-blue-600' },
  kyr: { label: 'Кыргыз тили', color: 'text-orange-600', bg: 'bg-orange-50', strip: 'bg-orange-400' },
  other: { label: 'Другие предметы', color: 'text-violet-600', bg: 'bg-violet-50', strip: 'bg-violet-500' },
}

function record(value: unknown, context: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Некорректный ответ сервиса: ${context}`)
  }
  return value as Record<string, unknown>
}

function string(value: unknown, context: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Некорректный ответ сервиса: ${context}`)
  }
  return value
}

function nullableString(value: unknown, context: string): string | null {
  if (value === null) return null
  return string(value, context)
}

function nullableText(value: unknown, context: string): string | null {
  if (value === null) return null
  if (typeof value !== 'string') throw new Error(`Некорректный ответ сервиса: ${context}`)
  return value
}

function positiveInteger(value: unknown, context: string): number {
  if (!Number.isSafeInteger(value) || (value as number) <= 0) {
    throw new Error(`Некорректный ответ сервиса: ${context}`)
  }
  return value as number
}

function nullablePositiveInteger(value: unknown, context: string): number | null {
  if (value === null) return null
  return positiveInteger(value, context)
}

function percentage(value: unknown, context: string): number {
  if (!Number.isInteger(value) || (value as number) < 0 || (value as number) > 100) {
    throw new Error(`Некорректный ответ сервиса: ${context}`)
  }
  return value as number
}

function boolean(value: unknown, context: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`Некорректный ответ сервиса: ${context}`)
  return value
}

function completionMode(value: unknown): PlatformLessonCompletionMode {
  if (value === 'self' || value === 'practice') return value
  throw new Error('Некорректный ответ сервиса: способ завершения урока')
}

function nullableTimestamp(value: unknown, context: string): string | null {
  const timestamp = nullableString(value, context)
  if (timestamp !== null && Number.isNaN(new Date(timestamp).getTime())) {
    throw new Error(`Некорректный ответ сервиса: ${context}`)
  }
  return timestamp
}

function nullableDate(value: unknown, context: string): string | null {
  const date = nullableString(value, context)
  if (date !== null && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`Некорректный ответ сервиса: ${context}`)
  }
  return date
}

function nullableWebUrl(value: unknown, context: string): string | null {
  const url = nullableText(value, context)
  if (url === null || url.trim() === '') return null
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') throw new Error('unsupported protocol')
  } catch {
    throw new Error(`Некорректный ответ сервиса: ${context}`)
  }
  return url
}

function lessonSubject(value: unknown): { subject: PlatformLessonSubject; sourceSubject: string | null } {
  if (value === null) return { subject: 'other', sourceSubject: null }
  const sourceSubject = string(value, 'предмет урока').trim()
  const normalized = sourceSubject.toLocaleLowerCase('ru')
  if (['math', 'mathematics', 'математика'].includes(normalized)) {
    return { subject: 'math', sourceSubject }
  }
  if (['kyr', 'kyrgyz', 'кыргыз тили', 'кыргызский язык'].includes(normalized)) {
    return { subject: 'kyr', sourceSubject }
  }
  return { subject: 'other', sourceSubject }
}

export function parsePlatformLesson(value: unknown): PlatformLesson {
  const source = record(value, 'урок')
  const apiId = positiveInteger(source.id, 'id урока')
  const mappedSubject = lessonSubject(source.subject)
  const contentUrl = nullableWebUrl(source.contentUrl, 'ссылка на материал')

  return {
    id: String(apiId),
    apiId,
    courseId: positiveInteger(source.courseId, 'id курса'),
    order_number: positiveInteger(source.lessonNumber, 'номер урока'),
    title: string(source.title, 'название урока'),
    description: nullableText(source.description, 'описание урока'),
    subject: mappedSubject.subject,
    sourceSubject: mappedSubject.sourceSubject,
    section: nullableString(source.section, 'раздел урока'),
    topic: nullableString(source.topic, 'тема урока'),
    lessonDate: nullableDate(source.lessonDate, 'дата урока'),
    durationMinutes: nullablePositiveInteger(source.durationMinutes, 'длительность урока'),
    contentUrl,
    video_url: contentUrl,
    video: parseLessonVideoHandle(source.video, 'lesson'),
    isTest: boolean(source.isTest, 'тип урока'),
    completionMode: completionMode(source.completionMode),
    isLocked: boolean(source.isLocked, 'доступность урока'),
    completionPercent: percentage(source.completionPercent, 'прогресс урока'),
    completedAt: nullableTimestamp(source.completedAt, 'дата завершения урока'),
    lastViewedAt: nullableTimestamp(source.lastViewedAt, 'дата просмотра урока'),
  }
}

export function parsePlatformLessons(value: unknown): PlatformLesson[] {
  const source = record(value, 'список уроков')
  if (!Array.isArray(source.items)) throw new Error('Некорректный ответ сервиса: список уроков')
  const lessons = source.items.map(parsePlatformLesson)
  if (new Set(lessons.map(lesson => lesson.apiId)).size !== lessons.length) {
    throw new Error('Некорректный ответ сервиса: повторяющиеся уроки')
  }
  return lessons
}

export function parsePlatformLessonDetail(value: unknown): PlatformLesson {
  const source = record(value, 'страница урока')
  return parsePlatformLesson(source.lesson)
}

export async function fetchPlatformLessons(): Promise<PlatformLesson[]> {
  return parsePlatformLessons(await zhangakApiRequest<unknown>('/v1/platform/lessons'))
}

export async function fetchPlatformLesson(id: string): Promise<PlatformLesson> {
  if (!/^\d+$/.test(id) || !Number.isSafeInteger(Number(id)) || Number(id) <= 0) {
    throw new Error('Некорректный id урока')
  }
  return parsePlatformLessonDetail(await zhangakApiRequest<unknown>(`/v1/platform/lessons/${id}`))
}

/**
 * Explicit self-paced acknowledgement for a normal lesson. The browser sends
 * no score, percent, timestamp, or identity; the first-party API rejects
 * locked, test, and practice-bound lessons before writing lesson_progress.
 */
export async function completePlatformLesson(id: string): Promise<PlatformLesson> {
  if (!/^\d+$/.test(id) || !Number.isSafeInteger(Number(id)) || Number(id) <= 0) {
    throw new Error('Некорректный id урока')
  }
  return parsePlatformLessonDetail(await zhangakApiRequest<unknown>(`/v1/platform/lessons/${id}/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  }))
}

export function completedPlatformLessonIds(lessons: PlatformLesson[]): Set<string> {
  return new Set(
    lessons
      .filter(lesson => lesson.completedAt !== null || lesson.completionPercent >= 100)
      .map(lesson => lesson.id),
  )
}

export function computePlatformLessonStatuses(
  lessons: PlatformLesson[],
  completedIds = completedPlatformLessonIds(lessons),
): Record<string, PlatformLessonStatus> {
  // Locking is intentionally *not* reconstructed in the browser. The API
  // checks every predecessor against lesson_progress before it exposes or
  // mutates a lesson, so stale frontend data cannot become an authorization
  // bypass. A completed historical lesson remains readable even if an older
  // predecessor was later republished.
  return Object.fromEntries(lessons.map(lesson => [
    lesson.id,
    completedIds.has(lesson.id) ? 'done' : lesson.isLocked ? 'locked' : 'current',
  ]))
}

export function platformLocalDayKey(value: Date | string): string | null {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function platformLessonCompletionStreak(lessons: PlatformLesson[], now = new Date()): number {
  const days = new Set(
    lessons
      .map(lesson => lesson.completedAt ? platformLocalDayKey(lesson.completedAt) : null)
      .filter((value): value is string => value !== null),
  )
  let streak = 0
  const day = new Date(now)
  day.setHours(0, 0, 0, 0)

  while (days.has(platformLocalDayKey(day) ?? '')) {
    streak += 1
    day.setDate(day.getDate() - 1)
  }
  return streak
}
