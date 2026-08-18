'use client'

import { zhangakApiJson, zhangakApiRequest } from './zhangak-api-client.ts'

export interface AdminCourse {
  id: number
  name: string
  code: string | null
  level: string | null
  subject: string | null
  description: string | null
  coverImageUrl: string | null
  deliveryMode: 'online' | 'offline'
  isActive: boolean
  lessonCount: number
  createdAt: string
  updatedAt: string
}

export interface AdminLesson {
  id: number
  courseId: number
  lessonNumber: number
  title: string
  description: string | null
  subject: string | null
  section: string | null
  topic: string | null
  lessonDate: string | null
  durationMinutes: number | null
  contentUrl: string | null
  isTest: boolean
  isPublished: boolean
  createdAt: string
  updatedAt: string
}

export interface AdminCourseInput {
  name: string
  code?: string | null
  level?: string | null
  subject?: string | null
  description?: string | null
  coverImageUrl?: string | null
  deliveryMode?: 'online' | 'offline'
  isActive?: boolean
}

export interface AdminLessonInput {
  lessonNumber: number
  title: string
  description?: string | null
  subject?: string | null
  section?: string | null
  topic?: string | null
  lessonDate?: string | null
  durationMinutes?: number | null
  contentUrl?: string | null
  isTest?: boolean
  isPublished?: boolean
}

export interface AdminCourseList {
  items: AdminCourse[]
  total: number
  limit: number
  offset: number
}

export interface AdminLessonList {
  courseId: number
  items: AdminLesson[]
  total: number
  limit: number
  offset: number
}

export interface AdminLessonMaterial {
  id: number
  lessonId: number
  materialType: 'rich_text' | 'video' | 'document' | 'image'
  title: string
  position: number
  bodyMarkdown: string | null
  externalUrl: string | null
  mimeType: string | null
  byteSize: number | null
  isPublished: boolean
  scanStatus: 'pending' | 'clean' | 'rejected'
  originalFilename: string | null
  createdAt: string
}

export interface AdminRoadmapUnit {
  id: number
  courseId: number
  unitNumber: number
  title: string
  description: string | null
  accentColor: 'green' | 'blue' | 'violet' | 'red'
  isPublished: boolean
  lessonCount: number
  createdAt: string
  updatedAt: string
}

export interface AdminRoadmapPlacement {
  unitId: number
  lessonId: number
  position: number
  lessonNumber: number
  title: string
  isPublished: boolean
}

export interface AdminCourseRoadmap {
  courseId: number
  units: AdminRoadmapUnit[]
  placements: AdminRoadmapPlacement[]
  unassignedLessons: AdminLesson[]
}

export interface AdminRoadmapUnitInput {
  unitNumber: number
  title: string
  description?: string | null
  accentColor?: AdminRoadmapUnit['accentColor']
  isPublished?: boolean
}

function invalidResponse(context: string): never {
  throw new Error(`Некорректный ответ сервиса: ${context}`)
}

function record(value: unknown, context: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalidResponse(context)
  return value as Record<string, unknown>
}

function text(value: unknown, context: string): string {
  if (typeof value !== 'string' || value.trim() === '') invalidResponse(context)
  return value
}

function nullableText(value: unknown, context: string): string | null {
  if (value === null) return null
  return text(value, context)
}

function positiveInteger(value: unknown, context: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1) invalidResponse(context)
  return value as number
}

function count(value: unknown, context: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) invalidResponse(context)
  return value as number
}

function boolean(value: unknown, context: string): boolean {
  if (typeof value !== 'boolean') invalidResponse(context)
  return value
}

function timestamp(value: unknown, context: string): string {
  const timestamp = text(value, context)
  if (Number.isNaN(new Date(timestamp).getTime())) invalidResponse(context)
  return timestamp
}

function nullableDate(value: unknown, context: string): string | null {
  const date = nullableText(value, context)
  if (date !== null && !/^\d{4}-\d{2}-\d{2}$/.test(date)) invalidResponse(context)
  return date
}

function nullableHttpsUrl(value: unknown, context: string): string | null {
  const raw = nullableText(value, context)
  if (raw === null) return null
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error('unsafe URL')
  } catch {
    invalidResponse(context)
  }
  return raw
}

export function parseAdminCourse(value: unknown): AdminCourse {
  const source = record(value, 'курс')
  if (source.deliveryMode !== 'online' && source.deliveryMode !== 'offline') invalidResponse('формат обучения курса')
  return {
    id: positiveInteger(source.id, 'id курса'),
    name: text(source.name, 'название курса'),
    code: nullableText(source.code, 'код курса'),
    level: nullableText(source.level, 'уровень курса'),
    subject: nullableText(source.subject, 'предмет курса'),
    description: nullableText(source.description, 'описание курса'),
    coverImageUrl: nullableHttpsUrl(source.coverImageUrl, 'обложка курса'),
    deliveryMode: source.deliveryMode,
    isActive: boolean(source.isActive, 'статус курса'),
    lessonCount: count(source.lessonCount, 'количество уроков'),
    createdAt: timestamp(source.createdAt, 'дата создания курса'),
    updatedAt: timestamp(source.updatedAt, 'дата обновления курса'),
  }
}

export function parseAdminLesson(value: unknown): AdminLesson {
  const source = record(value, 'урок')
  const durationMinutes = source.durationMinutes === null
    ? null
    : positiveInteger(source.durationMinutes, 'длительность урока')
  if (durationMinutes !== null && durationMinutes > 600) invalidResponse('длительность урока')

  return {
    id: positiveInteger(source.id, 'id урока'),
    courseId: positiveInteger(source.courseId, 'id курса урока'),
    lessonNumber: positiveInteger(source.lessonNumber, 'номер урока'),
    title: text(source.title, 'название урока'),
    description: nullableText(source.description, 'описание урока'),
    subject: nullableText(source.subject, 'предмет урока'),
    section: nullableText(source.section, 'раздел урока'),
    topic: nullableText(source.topic, 'тема урока'),
    lessonDate: nullableDate(source.lessonDate, 'дата урока'),
    durationMinutes,
    contentUrl: nullableHttpsUrl(source.contentUrl, 'ссылка на материал'),
    isTest: boolean(source.isTest, 'тип урока'),
    isPublished: boolean(source.isPublished, 'статус урока'),
    createdAt: timestamp(source.createdAt, 'дата создания урока'),
    updatedAt: timestamp(source.updatedAt, 'дата обновления урока'),
  }
}

function roadmapAccent(value: unknown): AdminRoadmapUnit['accentColor'] {
  if (value === 'green' || value === 'blue' || value === 'violet' || value === 'red') return value
  invalidResponse('цвет раздела дорожной карты')
}

export function parseAdminRoadmapUnit(value: unknown): AdminRoadmapUnit {
  const source = record(value, 'раздел дорожной карты')
  return {
    id: positiveInteger(source.id, 'id раздела'), courseId: positiveInteger(source.courseId, 'id курса раздела'),
    unitNumber: positiveInteger(source.unitNumber, 'номер раздела'), title: text(source.title, 'название раздела'),
    description: nullableText(source.description, 'описание раздела'), accentColor: roadmapAccent(source.accentColor),
    isPublished: boolean(source.isPublished, 'публикация раздела'), lessonCount: count(source.lessonCount, 'количество уроков раздела'),
    createdAt: timestamp(source.createdAt, 'дата создания раздела'), updatedAt: timestamp(source.updatedAt, 'дата обновления раздела'),
  }
}

function parseAdminRoadmapPlacement(value: unknown): AdminRoadmapPlacement {
  const source = record(value, 'урок раздела')
  return {
    unitId: positiveInteger(source.unitId, 'id раздела урока'), lessonId: positiveInteger(source.lessonId, 'id урока раздела'),
    position: positiveInteger(source.position, 'позиция урока'), lessonNumber: positiveInteger(source.lessonNumber, 'номер урока раздела'),
    title: text(source.title, 'название урока раздела'), isPublished: boolean(source.isPublished, 'публикация урока раздела'),
  }
}

export function parseAdminCourseRoadmap(value: unknown): AdminCourseRoadmap {
  const source = record(value, 'карта курса')
  if (!Array.isArray(source.units) || !Array.isArray(source.placements) || !Array.isArray(source.unassignedLessons)) invalidResponse('карта курса')
  const courseId = positiveInteger(source.courseId, 'id курса карты')
  const units = source.units.map(parseAdminRoadmapUnit)
  const placements = source.placements.map(parseAdminRoadmapPlacement)
  const unassignedLessons = source.unassignedLessons.map(parseAdminLesson)
  if (units.some(unit => unit.courseId !== courseId) || unassignedLessons.some(lesson => lesson.courseId !== courseId)) invalidResponse('привязка карты к курсу')
  if (new Set(units.map(unit => unit.id)).size !== units.length || new Set(placements.map(item => item.lessonId)).size !== placements.length) invalidResponse('повтор в карте курса')
  return { courseId, units, placements, unassignedLessons }
}

export function parseAdminLessonMaterial(value: unknown): AdminLessonMaterial {
  const source = record(value, 'материал урока')
  const materialType = source.materialType
  const scanStatus = source.scanStatus
  if (!['rich_text', 'video', 'document', 'image'].includes(String(materialType)) || !['pending', 'clean', 'rejected'].includes(String(scanStatus))) invalidResponse('материал урока')
  const byteSize = source.byteSize === null ? null : positiveInteger(source.byteSize, 'размер материала')
  return {
    id: positiveInteger(source.id, 'id материала'), lessonId: positiveInteger(source.lessonId, 'id урока материала'),
    materialType: materialType as AdminLessonMaterial['materialType'], title: text(source.title, 'название материала'),
    position: positiveInteger(source.position, 'позиция материала'), bodyMarkdown: nullableText(source.bodyMarkdown, 'текст материала'),
    externalUrl: nullableHttpsUrl(source.externalUrl, 'ссылка материала'), mimeType: nullableText(source.mimeType, 'тип материала'),
    byteSize, isPublished: boolean(source.isPublished, 'публикация материала'),
    scanStatus: scanStatus as AdminLessonMaterial['scanStatus'], originalFilename: nullableText(source.originalFilename, 'имя файла'),
    createdAt: timestamp(source.createdAt, 'дата материала'),
  }
}

function parsePage(value: unknown, context: string): { items: unknown[]; total: number; limit: number; offset: number } {
  const source = record(value, context)
  if (!Array.isArray(source.items)) invalidResponse(context)
  return {
    items: source.items,
    total: count(source.total, `всего: ${context}`),
    limit: positiveInteger(source.limit, `лимит: ${context}`),
    offset: count(source.offset, `смещение: ${context}`),
  }
}

export function parseAdminCourseList(value: unknown): AdminCourseList {
  const page = parsePage(value, 'список курсов')
  const items = page.items.map(parseAdminCourse)
  if (new Set(items.map(course => course.id)).size !== items.length) invalidResponse('повторяющиеся курсы')
  return { ...page, items }
}

export function parseAdminLessonList(value: unknown): AdminLessonList {
  const source = record(value, 'список уроков')
  const page = parsePage(source, 'список уроков')
  const courseId = positiveInteger(source.courseId, 'id курса списка уроков')
  const items = page.items.map(parseAdminLesson)
  if (items.some(lesson => lesson.courseId !== courseId)) invalidResponse('курс урока не совпадает со списком')
  if (new Set(items.map(lesson => lesson.id)).size !== items.length) invalidResponse('повторяющиеся уроки')
  return { ...page, courseId, items }
}

function coursePath(courseId: number): string {
  if (!Number.isSafeInteger(courseId) || courseId < 1) throw new Error('Некорректный id курса')
  return String(courseId)
}

function lessonPath(lessonId: number): string {
  if (!Number.isSafeInteger(lessonId) || lessonId < 1) throw new Error('Некорректный id урока')
  return String(lessonId)
}

export async function listAdminCourses(options: { query?: string; limit?: number; offset?: number } = {}): Promise<AdminCourseList> {
  const params = new URLSearchParams()
  if (options.query?.trim()) params.set('q', options.query.trim())
  if (options.limit != null) params.set('limit', String(options.limit))
  if (options.offset != null) params.set('offset', String(options.offset))
  const suffix = params.size > 0 ? `?${params.toString()}` : ''
  return parseAdminCourseList(await zhangakApiRequest<unknown>(`/v1/admin/courses${suffix}`))
}

export async function getAdminCourseRoadmap(courseId: number): Promise<AdminCourseRoadmap> {
  return parseAdminCourseRoadmap(await zhangakApiRequest<unknown>(`/v1/admin/courses/${coursePath(courseId)}/roadmap`))
}

export async function createAdminRoadmapUnit(courseId: number, input: AdminRoadmapUnitInput): Promise<AdminRoadmapUnit> {
  const response = record(await zhangakApiJson<unknown>(`/v1/admin/courses/${coursePath(courseId)}/roadmap/units`, 'POST', input), 'создание раздела')
  return parseAdminRoadmapUnit(response.unit)
}

export async function patchAdminRoadmapUnit(unitId: number, input: Partial<AdminRoadmapUnitInput>): Promise<AdminRoadmapUnit> {
  const response = record(await zhangakApiJson<unknown>(`/v1/admin/roadmap/units/${positiveInteger(unitId, 'id раздела')}`, 'PATCH', input), 'обновление раздела')
  return parseAdminRoadmapUnit(response.unit)
}

export async function placeAdminRoadmapLesson(unitId: number, lessonId: number, position: number): Promise<void> {
  await zhangakApiJson<unknown>(`/v1/admin/roadmap/units/${positiveInteger(unitId, 'id раздела')}/lessons`, 'POST', {
    lessonId: positiveInteger(lessonId, 'id урока'), position: positiveInteger(position, 'позиция урока'),
  })
}

export async function removeAdminRoadmapLesson(unitId: number, lessonId: number): Promise<void> {
  await zhangakApiJson<unknown>(`/v1/admin/roadmap/units/${positiveInteger(unitId, 'id раздела')}/lessons/${positiveInteger(lessonId, 'id урока')}`, 'DELETE')
}

export async function createAdminCourse(input: AdminCourseInput): Promise<AdminCourse> {
  const result = await zhangakApiJson<unknown>('/v1/admin/courses', 'POST', input)
  return parseAdminCourse(record(result, 'созданный курс').course)
}

export async function updateAdminCourse(courseId: number, input: Partial<AdminCourseInput>): Promise<AdminCourse> {
  const result = await zhangakApiJson<unknown>(`/v1/admin/courses/${coursePath(courseId)}`, 'PATCH', input)
  return parseAdminCourse(record(result, 'обновлённый курс').course)
}

export async function listAdminLessons(courseId: number, options: { limit?: number; offset?: number } = {}): Promise<AdminLessonList> {
  const params = new URLSearchParams()
  if (options.limit != null) params.set('limit', String(options.limit))
  if (options.offset != null) params.set('offset', String(options.offset))
  const suffix = params.size > 0 ? `?${params.toString()}` : ''
  return parseAdminLessonList(await zhangakApiRequest<unknown>(`/v1/admin/courses/${coursePath(courseId)}/lessons${suffix}`))
}

export async function createAdminLesson(courseId: number, input: AdminLessonInput): Promise<AdminLesson> {
  const result = await zhangakApiJson<unknown>(`/v1/admin/courses/${coursePath(courseId)}/lessons`, 'POST', input)
  return parseAdminLesson(record(result, 'созданный урок').lesson)
}

export async function updateAdminLesson(lessonId: number, input: Partial<AdminLessonInput>): Promise<AdminLesson> {
  const result = await zhangakApiJson<unknown>(`/v1/admin/lessons/${lessonPath(lessonId)}`, 'PATCH', input)
  return parseAdminLesson(record(result, 'обновлённый урок').lesson)
}

export async function listAdminLessonMaterials(lessonId: number): Promise<AdminLessonMaterial[]> {
  const result = record(await zhangakApiRequest<unknown>(`/v1/admin/lessons/${lessonPath(lessonId)}/materials`), 'материалы урока')
  if (!Array.isArray(result.items)) invalidResponse('материалы урока')
  return result.items.map(parseAdminLessonMaterial)
}

export async function createAdminTextMaterial(lessonId: number, input: {
  materialType: 'rich_text' | 'video'; title: string; position: number; bodyMarkdown?: string; externalUrl?: string; isPublished?: boolean
}): Promise<AdminLessonMaterial> {
  const result = record(await zhangakApiJson<unknown>(`/v1/admin/lessons/${lessonPath(lessonId)}/materials`, 'POST', input), 'созданный материал')
  return parseAdminLessonMaterial(result.material)
}

export async function uploadAdminLessonMaterial(lessonId: number, fields: { materialType: 'document' | 'image'; title: string; position: number }, file: File): Promise<AdminLessonMaterial> {
  if (file.size < 1) throw new Error('Выберите непустой файл')
  const form = new FormData()
  form.set('materialType', fields.materialType)
  form.set('title', fields.title)
  form.set('position', String(fields.position))
  form.set('isPublished', 'false')
  form.set('file', file, file.name)
  const result = record(await zhangakApiRequest<unknown>(`/v1/admin/lessons/${lessonPath(lessonId)}/materials/upload`, { method: 'POST', body: form }), 'загруженный материал')
  return parseAdminLessonMaterial(result.material)
}

export async function reviewAdminLessonMaterial(materialId: number, status: 'clean' | 'rejected', publish = false): Promise<AdminLessonMaterial> {
  const result = record(await zhangakApiJson<unknown>(`/v1/admin/materials/${lessonPath(materialId)}/review`, 'POST', { status, publish }), 'проверенный материал')
  return parseAdminLessonMaterial(result.material)
}
