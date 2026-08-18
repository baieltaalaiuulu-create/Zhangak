import { currentNativeAuth, nativeApiJson, ZhangakApiError } from '@/lib/native-auth'
import { readLearningCache, saveLearningCache } from '@/lib/learning-cache'

export type LessonSubject = 'math' | 'kyr' | 'other'
export type LessonStatus = 'done' | 'current' | 'locked'
export type LessonIcon = 'calculator-outline' | 'book-outline' | 'library-outline'

export interface PlatformLesson {
  /** String form is retained for Expo Router paths. */
  id: string
  apiId: number
  courseId: number
  lessonNumber: number
  title: string
  description: string | null
  subject: LessonSubject
  sourceSubject: string | null
  section: string | null
  topic: string | null
  lessonDate: string | null
  durationMinutes: number | null
  contentUrl: string | null
  video: LessonVideoHandle | null
  isTest: boolean
  completionPercent: number
  completedAt: string | null
  lastViewedAt: string | null
}

export interface PlatformDashboard {
  profile: {
    fullName: string
    targetScore: number | null
  }
  summary: {
    courseCount: number
    lessons: {
      total: number
      completed: number
      completionPercent: number
    }
    practice: {
      attempts: number
      passed: number
      averageScorePercent: number
      bestScorePercent: number
    }
    latestResult: {
      id: string
      title: string
      testType: string
      scorePercent: number | null
      correctCount: number
      questionCount: number
      submittedAt: string | null
    } | null
  }
}

/**
 * A server-issued path that trades for a player configuration. It is not a
 * video URL and is never cached: the exchange re-checks enrollment and the
 * lesson lock at the moment the student presses play.
 */
export interface LessonVideoHandle {
  sessionPath: string
}

export interface LessonVideoConfig {
  videoId: string
  title: string
  embedHost: string
}

export type LessonMaterialType = 'rich_text' | 'video' | 'document' | 'image'

export interface PlatformLessonMaterial {
  id: number
  lessonId: number
  materialType: LessonMaterialType
  title: string
  position: number
  /** Available offline only for server-sanitized rich text. */
  bodyMarkdown: string | null
  /** Network-only video handle; never cached, never a watch URL. */
  video: LessonVideoHandle | null
  mimeType: string | null
  byteSize: number | null
  /** Authenticated private-file endpoint; never cached. */
  viewerPath: string | null
}

export interface CachedPlatformValue<T> {
  value: T
  source: 'network' | 'cache'
  savedAt: number | null
}

export const LESSON_SUBJECT_META: Record<LessonSubject, { label: string; icon: LessonIcon; color: string }> = {
  math: { label: 'Математика', icon: 'calculator-outline', color: '#1B3F92' },
  kyr: { label: 'Кыргыз тили', icon: 'book-outline', color: '#F59E0B' },
  other: { label: 'Другие предметы', icon: 'library-outline', color: '#7C3AED' },
}

class NativeDtoError extends Error {
  constructor(context: string) {
    super(`Некорректный ответ сервера: ${context}`)
    this.name = 'NativeDtoError'
  }
}

function record(value: unknown, context: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new NativeDtoError(context)
  return value as Record<string, unknown>
}

function nonEmptyString(value: unknown, context: string) {
  if (typeof value !== 'string' || value.trim() === '') throw new NativeDtoError(context)
  return value
}

function nullableText(value: unknown, context: string) {
  if (value === null) return null
  if (typeof value !== 'string') throw new NativeDtoError(context)
  return value
}

function nullableNonEmptyString(value: unknown, context: string) {
  if (value === null) return null
  return nonEmptyString(value, context)
}

function positiveInteger(value: unknown, context: string) {
  if (!Number.isSafeInteger(value) || (value as number) <= 0) throw new NativeDtoError(context)
  return value as number
}

function nonNegativeInteger(value: unknown, context: string) {
  if (!Number.isSafeInteger(value) || (value as number) < 0) throw new NativeDtoError(context)
  return value as number
}

function nullableNonNegativeInteger(value: unknown, context: string) {
  if (value === null) return null
  return nonNegativeInteger(value, context)
}

function percentage(value: unknown, context: string) {
  const result = nonNegativeInteger(value, context)
  if (result > 100) throw new NativeDtoError(context)
  return result
}

function nullablePercentage(value: unknown, context: string) {
  if (value === null) return null
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100) {
    throw new NativeDtoError(context)
  }
  return value
}

function boolean(value: unknown, context: string) {
  if (typeof value !== 'boolean') throw new NativeDtoError(context)
  return value
}

function nullableTimestamp(value: unknown, context: string) {
  const timestamp = nullableNonEmptyString(value, context)
  if (timestamp !== null && Number.isNaN(new Date(timestamp).getTime())) throw new NativeDtoError(context)
  return timestamp
}

function nullableDate(value: unknown, context: string) {
  const date = nullableNonEmptyString(value, context)
  if (date !== null && !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new NativeDtoError(context)
  return date
}

function nullableWebUrl(value: unknown, context: string) {
  const raw = nullableText(value, context)
  if (raw === null || raw.trim() === '') return null
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error('unsafe URL')
  } catch {
    throw new NativeDtoError(context)
  }
  return raw
}

function materialType(value: unknown): LessonMaterialType {
  if (value === 'rich_text' || value === 'video' || value === 'document' || value === 'image') return value
  throw new NativeDtoError('тип материала')
}

function nullableBodyMarkdown(value: unknown): string | null {
  const body = nullableText(value, 'текст материала')
  if (body !== null && body.length > 500_000) throw new NativeDtoError('текст материала')
  return body
}

function nullableMimeType(value: unknown): string | null {
  const mime = nullableText(value, 'MIME-тип материала')
  if (mime !== null && (mime.length < 3 || mime.length > 160)) throw new NativeDtoError('MIME-тип материала')
  return mime
}

const LESSON_VIDEO_SESSION = /^\/v1\/platform\/lessons\/\d+\/video$/
const MATERIAL_VIDEO_SESSION = /^\/v1\/platform\/materials\/\d+\/video$/
const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/
const YOUTUBE_EMBED_HOST = 'https://www.youtube-nocookie.com'

function nullableVideoHandle(value: unknown, kind: 'lesson' | 'material'): LessonVideoHandle | null {
  if (value === null || typeof value === 'undefined') return null
  if (typeof value !== 'object' || Array.isArray(value)) throw new NativeDtoError('видео урока')
  const source = value as Record<string, unknown>
  if (source.available !== true) return null
  const sessionPath = source.sessionPath
  const pattern = kind === 'lesson' ? LESSON_VIDEO_SESSION : MATERIAL_VIDEO_SESSION
  if (typeof sessionPath !== 'string' || !pattern.test(sessionPath)) throw new NativeDtoError('путь видео')
  return { sessionPath }
}

export function parseLessonVideoConfig(value: unknown): LessonVideoConfig {
  const source = record(value, 'конфигурация видео')
  const video = record(source.video, 'конфигурация видео')
  const videoId = video.videoId
  const title = video.title
  if (typeof videoId !== 'string' || !VIDEO_ID_PATTERN.test(videoId)) throw new NativeDtoError('идентификатор видео')
  if (typeof title !== 'string' || title.trim() === '') throw new NativeDtoError('название видео')
  if (video.embedHost !== YOUTUBE_EMBED_HOST) throw new NativeDtoError('источник видео')
  return { videoId, title, embedHost: YOUTUBE_EMBED_HOST }
}

export async function requestLessonVideo(handle: LessonVideoHandle): Promise<LessonVideoConfig> {
  // The server states the path from the API root; the native client already
  // carries the `/v1` prefix in its configured base URL.
  const path = handle.sessionPath.replace(/^\/v1/, '')
  return parseLessonVideoConfig(await nativeApiJson<unknown>(path, { method: 'POST' }))
}

function nullableViewerPath(value: unknown, materialId: number): string | null {
  const path = nullableText(value, 'путь просмотра материала')
  if (path === null) return null
  if (path !== `/v1/platform/materials/${materialId}/content`) throw new NativeDtoError('путь просмотра материала')
  return path
}

function lessonSubject(value: unknown): { subject: LessonSubject; sourceSubject: string | null } {
  if (value === null) return { subject: 'other', sourceSubject: null }
  const sourceSubject = nonEmptyString(value, 'предмет урока').trim()
  const normalized = sourceSubject.toLocaleLowerCase('ru')
  if (['math', 'mathematics', 'математика'].includes(normalized)) return { subject: 'math', sourceSubject }
  if (['kyr', 'kyrgyz', 'кыргыз тили', 'кыргызский язык'].includes(normalized)) return { subject: 'kyr', sourceSubject }
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
    lessonNumber: positiveInteger(source.lessonNumber, 'номер урока'),
    title: nonEmptyString(source.title, 'название урока'),
    description: nullableText(source.description, 'описание урока'),
    subject: mappedSubject.subject,
    sourceSubject: mappedSubject.sourceSubject,
    section: nullableNonEmptyString(source.section, 'раздел урока'),
    topic: nullableNonEmptyString(source.topic, 'тема урока'),
    lessonDate: nullableDate(source.lessonDate, 'дата урока'),
    durationMinutes: nullableNonNegativeInteger(source.durationMinutes, 'длительность урока'),
    contentUrl,
    video: nullableVideoHandle(source.video, 'lesson'),
    isTest: boolean(source.isTest, 'тип урока'),
    completionPercent: percentage(source.completionPercent, 'прогресс урока'),
    completedAt: nullableTimestamp(source.completedAt, 'дата завершения урока'),
    lastViewedAt: nullableTimestamp(source.lastViewedAt, 'дата просмотра урока'),
  }
}

export function parsePlatformLessons(value: unknown): PlatformLesson[] {
  const source = record(value, 'список уроков')
  if (!Array.isArray(source.items)) throw new NativeDtoError('список уроков')
  const lessons = source.items.map(parsePlatformLesson)
  if (new Set(lessons.map(lesson => lesson.apiId)).size !== lessons.length) {
    throw new NativeDtoError('повторяющиеся уроки')
  }
  return lessons
}

export function parsePlatformLessonDetail(value: unknown): PlatformLesson {
  return parsePlatformLesson(record(value, 'страница урока').lesson)
}

export function parsePlatformLessonMaterial(value: unknown): PlatformLessonMaterial {
  const source = record(value, 'материал урока')
  const id = positiveInteger(source.id, 'id материала')
  const kind = materialType(source.materialType)
  const bodyMarkdown = nullableBodyMarkdown(source.bodyMarkdown)
  const video = nullableVideoHandle(source.video, 'material')
  const viewerPath = nullableViewerPath(source.viewerPath, id)

  if (kind === 'rich_text' && (bodyMarkdown === null || video !== null || viewerPath !== null)) throw new NativeDtoError('текстовый материал')
  if (kind === 'video' && (video === null || bodyMarkdown !== null || viewerPath !== null)) throw new NativeDtoError('видеоматериал')
  if (['document', 'image'].includes(kind) && (bodyMarkdown !== null || video !== null || viewerPath === null)) throw new NativeDtoError('файловый материал')

  return {
    id,
    lessonId: positiveInteger(source.lessonId, 'id урока материала'),
    materialType: kind,
    title: nonEmptyString(source.title, 'название материала'),
    position: positiveInteger(source.position, 'позиция материала'),
    bodyMarkdown,
    video,
    mimeType: nullableMimeType(source.mimeType),
    byteSize: nullableNonNegativeInteger(source.byteSize, 'размер материала'),
    viewerPath,
  }
}

export function parsePlatformLessonMaterials(value: unknown): PlatformLessonMaterial[] {
  const source = record(value, 'материалы урока')
  if (!Array.isArray(source.items)) throw new NativeDtoError('материалы урока')
  const items = source.items.map(parsePlatformLessonMaterial)
  if (new Set(items.map(item => item.id)).size !== items.length) throw new NativeDtoError('повторяющиеся материалы урока')
  return items.sort((left, right) => left.position - right.position || left.id - right.id)
}

function parseLatestResult(value: unknown): PlatformDashboard['summary']['latestResult'] {
  if (value === null) return null
  const source = record(value, 'последний результат')
  return {
    id: nonEmptyString(source.id, 'id результата'),
    title: nonEmptyString(source.title, 'название результата'),
    testType: nonEmptyString(source.testType, 'тип результата'),
    scorePercent: nullablePercentage(source.scorePercent, 'процент результата'),
    correctCount: nonNegativeInteger(source.correctCount, 'верные ответы'),
    questionCount: nonNegativeInteger(source.questionCount, 'вопросы результата'),
    submittedAt: nullableTimestamp(source.submittedAt, 'дата результата'),
  }
}

export function parsePlatformDashboard(value: unknown): PlatformDashboard {
  const source = record(value, 'дашборд')
  const profile = record(source.profile, 'профиль дашборда')
  const summary = record(source.summary, 'сводка дашборда')
  const lessons = record(summary.lessons, 'сводка уроков')
  const practice = record(summary.practice, 'сводка практики')

  const targetScore = nullableNonNegativeInteger(profile.targetScore, 'цель по ОРТ')
  if (targetScore !== null && targetScore > 245) throw new NativeDtoError('цель по ОРТ')

  return {
    profile: {
      fullName: nonEmptyString(profile.fullName, 'имя профиля'),
      targetScore,
    },
    summary: {
      courseCount: nonNegativeInteger(summary.courseCount, 'число курсов'),
      lessons: {
        total: nonNegativeInteger(lessons.total, 'всего уроков'),
        completed: nonNegativeInteger(lessons.completed, 'пройдено уроков'),
        completionPercent: percentage(lessons.completionPercent, 'процент уроков'),
      },
      practice: {
        attempts: nonNegativeInteger(practice.attempts, 'попытки практики'),
        passed: nonNegativeInteger(practice.passed, 'успешные попытки'),
        averageScorePercent: nullablePercentage(practice.averageScorePercent, 'средний результат') ?? 0,
        bestScorePercent: nullablePercentage(practice.bestScorePercent, 'лучший результат') ?? 0,
      },
      latestResult: parseLatestResult(summary.latestResult),
    },
  }
}

export async function fetchLessons(): Promise<PlatformLesson[]> {
  return parsePlatformLessons(await nativeApiJson<unknown>('/platform/lessons'))
}

export async function fetchLessonById(id: string): Promise<PlatformLesson> {
  if (!/^\d+$/.test(id) || !Number.isSafeInteger(Number(id)) || Number(id) <= 0) {
    throw new NativeDtoError('id урока')
  }
  return parsePlatformLessonDetail(await nativeApiJson<unknown>(`/platform/lessons/${id}`))
}

export async function fetchPlatformDashboard(): Promise<PlatformDashboard> {
  return parsePlatformDashboard(await nativeApiJson<unknown>('/platform/dashboard'))
}

export async function fetchLessonMaterials(lessonId: string): Promise<PlatformLessonMaterial[]> {
  if (!/^\d+$/.test(lessonId) || !Number.isSafeInteger(Number(lessonId)) || Number(lessonId) <= 0) {
    throw new NativeDtoError('id урока')
  }
  return parsePlatformLessonMaterials(await nativeApiJson<unknown>(`/platform/lessons/${lessonId}/materials`))
}

function activeCacheUserId() {
  return currentNativeAuth().session?.user.id ?? null
}

function cacheSafeLesson(lesson: PlatformLesson): PlatformLesson {
  // Private files and video URLs are never put in AsyncStorage. An offline
  // lesson can show its already-opened metadata, but protected media still
  // requires a live, authorized request.
  return { ...lesson, contentUrl: null, video: null }
}

function cacheSafeLessons(lessons: PlatformLesson[]) {
  return lessons.map(cacheSafeLesson)
}

function cacheSafeMaterials(materials: PlatformLessonMaterial[]) {
  // AsyncStorage is unencrypted. Rich text is the only material payload that
  // can support offline reading; private paths and external video URLs always
  // require a fresh authenticated request.
  return materials.map(material => ({
    ...material,
    video: null,
    viewerPath: null,
    bodyMarkdown: material.materialType === 'rich_text' ? material.bodyMarkdown : null,
  }))
}

function transportUnavailable(error: unknown) {
  return error instanceof ZhangakApiError && error.status === 0
}

export async function fetchLessonsWithCache(): Promise<CachedPlatformValue<PlatformLesson[]>> {
  const userId = activeCacheUserId()
  try {
    const lessons = await fetchLessons()
    if (userId) void saveLearningCache(userId, 'lessons', cacheSafeLessons(lessons))
    return { value: lessons, source: 'network', savedAt: null }
  } catch (error) {
    if (!userId || !transportUnavailable(error)) throw error
    const cached = await readLearningCache(userId, 'lessons')
    if (!cached) throw error
    return {
      value: parsePlatformLessons({ items: cached.payload }),
      source: 'cache',
      savedAt: cached.savedAt,
    }
  }
}

export async function fetchLessonByIdWithCache(id: string): Promise<CachedPlatformValue<PlatformLesson>> {
  if (!/^\d+$/.test(id) || !Number.isSafeInteger(Number(id)) || Number(id) <= 0) {
    throw new NativeDtoError('id урока')
  }
  const userId = activeCacheUserId()
  const resource = `lesson:${id}`
  try {
    const lesson = await fetchLessonById(id)
    if (userId) void saveLearningCache(userId, resource, cacheSafeLesson(lesson))
    return { value: lesson, source: 'network', savedAt: null }
  } catch (error) {
    if (!userId || !transportUnavailable(error)) throw error
    const cached = await readLearningCache(userId, resource)
    if (!cached) throw error
    return {
      value: parsePlatformLesson(cached.payload),
      source: 'cache',
      savedAt: cached.savedAt,
    }
  }
}

export async function fetchLessonMaterialsWithCache(lessonId: string): Promise<CachedPlatformValue<PlatformLessonMaterial[]>> {
  if (!/^\d+$/.test(lessonId) || !Number.isSafeInteger(Number(lessonId)) || Number(lessonId) <= 0) {
    throw new NativeDtoError('id урока')
  }
  const userId = activeCacheUserId()
  const resource = `materials:${lessonId}`
  try {
    const materials = await fetchLessonMaterials(lessonId)
    if (userId) void saveLearningCache(userId, resource, cacheSafeMaterials(materials))
    return { value: materials, source: 'network', savedAt: null }
  } catch (error) {
    if (!userId || !transportUnavailable(error)) throw error
    const cached = await readLearningCache(userId, resource)
    if (!cached) throw error
    return { value: parsePlatformLessonMaterials({ items: cached.payload }), source: 'cache', savedAt: cached.savedAt }
  }
}

export function completedLessonIds(lessons: PlatformLesson[]): Set<string> {
  return new Set(
    lessons
      .filter(lesson => lesson.completedAt !== null || lesson.completionPercent >= 100)
      .map(lesson => lesson.id),
  )
}

export function computeLessonStatuses(
  lessons: PlatformLesson[],
  completedIds = completedLessonIds(lessons),
): Record<string, LessonStatus> {
  const statuses: Record<string, LessonStatus> = {}
  const byTrack = new Map<string, PlatformLesson[]>()

  for (const lesson of lessons) {
    const subjectKey = lesson.subject === 'other' ? lesson.sourceSubject ?? 'other' : lesson.subject
    const trackKey = `${lesson.courseId}:${subjectKey}`
    const group = byTrack.get(trackKey) ?? []
    group.push(lesson)
    byTrack.set(trackKey, group)
  }

  for (const group of byTrack.values()) {
    group.sort((a, b) => a.lessonNumber - b.lessonNumber || a.apiId - b.apiId)
    let foundCurrent = false
    for (const lesson of group) {
      if (completedIds.has(lesson.id)) {
        statuses[lesson.id] = 'done'
      } else if (!foundCurrent) {
        statuses[lesson.id] = 'current'
        foundCurrent = true
      } else {
        statuses[lesson.id] = 'locked'
      }
    }
  }

  return statuses
}
