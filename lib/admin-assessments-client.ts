'use client'

import { zhangakApiJson, zhangakApiRequest } from './zhangak-api-client.ts'

export type AdminPracticeTestType = 'practice' | 'mock' | 'bank' | 'diagnostic'
export type AdminPracticeQuestionAnswer = 'a' | 'b' | 'c' | 'd'
export type AdminPracticeQuestionDifficulty = 'easy' | 'medium' | 'hard'

export interface AdminPracticeTest {
  id: number
  courseId: number | null
  lessonId: number | null
  title: string
  subject: string
  testType: AdminPracticeTestType
  description: string | null
  timeLimitSeconds: number | null
  maxAttempts: number | null
  passScoreRatio: number
  isPublished: boolean
  availableFrom: string | null
  availableUntil: string | null
  questionCount: number
  activeQuestionCount: number
  createdAt: string
  updatedAt: string
}

export interface AdminPracticeQuestion {
  id: number
  practiceTestId: number
  questionText: string
  options: Record<AdminPracticeQuestionAnswer, string>
  /**
   * This is an admin-only projection from `/v1/admin/*`.  It must never be
   * passed into student-facing components or platform endpoints.
   */
  correctAnswer: AdminPracticeQuestionAnswer
  explanation: string | null
  section: string
  topic: string | null
  difficulty: AdminPracticeQuestionDifficulty
  imageUrl: string | null
  position: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface AdminPracticeTestInput {
  title: string
  subject: string
  testType?: AdminPracticeTestType
  description?: string | null
  timeLimitSeconds?: number | null
  maxAttempts?: number | null
  passScoreRatio?: number
  isPublished?: boolean
  availableFrom?: string | null
  availableUntil?: string | null
}

export interface AdminPracticeQuestionInput {
  questionText: string
  options: Record<AdminPracticeQuestionAnswer, string>
  correctAnswer: AdminPracticeQuestionAnswer
  explanation?: string | null
  section?: string | null
  topic?: string | null
  difficulty?: AdminPracticeQuestionDifficulty
  imageUrl?: string | null
  position: number
  isActive?: boolean
}

export interface AdminPracticeTestList {
  items: AdminPracticeTest[]
  total: number
  limit: number
  offset: number
}

export interface AdminPracticeQuestionList {
  practiceTestId: number
  items: AdminPracticeQuestion[]
  total: number
  limit: number
  offset: number
  /** The lowest free 1-200 slot across the whole test, ignoring filters and paging. `null` means the test is full. */
  nextAvailablePosition: number | null
}

const TEST_TYPES = new Set<AdminPracticeTestType>(['practice', 'mock', 'bank', 'diagnostic'])
const ANSWERS = new Set<AdminPracticeQuestionAnswer>(['a', 'b', 'c', 'd'])
const DIFFICULTIES = new Set<AdminPracticeQuestionDifficulty>(['easy', 'medium', 'hard'])

function invalidResponse(context: string): never {
  throw new Error(`Некорректный ответ сервиса: ${context}`)
}

function record(value: unknown, context: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalidResponse(context)
  return value as Record<string, unknown>
}

function text(value: unknown, context: string, maxLength: number): string {
  if (typeof value !== 'string' || value.trim() === '' || value.length > maxLength) invalidResponse(context)
  return value
}

function nullableText(value: unknown, context: string, maxLength: number): string | null {
  return value === null ? null : text(value, context, maxLength)
}

function positiveInteger(value: unknown, context: string, max = Number.MAX_SAFE_INTEGER): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1 || (value as number) > max) invalidResponse(context)
  return value as number
}

function nonNegativeInteger(value: unknown, context: string, max = Number.MAX_SAFE_INTEGER): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0 || (value as number) > max) invalidResponse(context)
  return value as number
}

function nullablePositiveInteger(value: unknown, context: string, max: number): number | null {
  return value === null ? null : positiveInteger(value, context, max)
}

function boolean(value: unknown, context: string): boolean {
  if (typeof value !== 'boolean') invalidResponse(context)
  return value
}

function nullableTimestamp(value: unknown, context: string): string | null {
  if (value === null) return null
  const raw = text(value, context, 64)
  if (Number.isNaN(new Date(raw).getTime())) invalidResponse(context)
  return raw
}

function nullableHttpsUrl(value: unknown, context: string): string | null {
  const raw = nullableText(value, context, 2_048)
  if (raw === null) return null
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error('unsafe URL')
  } catch {
    invalidResponse(context)
  }
  return raw
}

function ratio(value: unknown, context: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) invalidResponse(context)
  return value
}

function pathId(value: number, context: string): string {
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(`Некорректный ${context}`)
  return String(value)
}

function listPage(value: unknown, context: string): { items: unknown[]; total: number; limit: number; offset: number } {
  const source = record(value, context)
  if (!Array.isArray(source.items)) invalidResponse(context)
  return {
    items: source.items,
    total: nonNegativeInteger(source.total, `всего: ${context}`, 100_000),
    limit: positiveInteger(source.limit, `лимит: ${context}`, 100),
    offset: nonNegativeInteger(source.offset, `смещение: ${context}`, 100_000),
  }
}

function testType(value: unknown, context: string): AdminPracticeTestType {
  if (typeof value !== 'string' || !TEST_TYPES.has(value as AdminPracticeTestType)) invalidResponse(context)
  return value as AdminPracticeTestType
}

function answer(value: unknown, context: string): AdminPracticeQuestionAnswer {
  if (typeof value !== 'string' || !ANSWERS.has(value as AdminPracticeQuestionAnswer)) invalidResponse(context)
  return value as AdminPracticeQuestionAnswer
}

function difficulty(value: unknown, context: string): AdminPracticeQuestionDifficulty {
  if (typeof value !== 'string' || !DIFFICULTIES.has(value as AdminPracticeQuestionDifficulty)) invalidResponse(context)
  return value as AdminPracticeQuestionDifficulty
}

function options(value: unknown): Record<AdminPracticeQuestionAnswer, string> {
  const source = record(value, 'варианты вопроса')
  const keys = Object.keys(source).sort()
  if (keys.length !== 4 || keys.some((key, index) => key !== ['a', 'b', 'c', 'd'][index])) {
    invalidResponse('варианты вопроса')
  }
  return {
    a: text(source.a, 'вариант A', 10_000),
    b: text(source.b, 'вариант B', 10_000),
    c: text(source.c, 'вариант C', 10_000),
    d: text(source.d, 'вариант D', 10_000),
  }
}

export function parseAdminPracticeTest(value: unknown): AdminPracticeTest {
  const source = record(value, 'тест')
  const courseId = source.courseId === null ? null : positiveInteger(source.courseId, 'id курса теста')
  const lessonId = source.lessonId === null ? null : positiveInteger(source.lessonId, 'id урока теста')
  if (lessonId !== null && courseId === null) invalidResponse('связь теста с уроком')
  return {
    id: positiveInteger(source.id, 'id теста'),
    courseId,
    lessonId,
    title: text(source.title, 'название теста', 500),
    subject: text(source.subject, 'предмет теста', 80),
    testType: testType(source.testType, 'тип теста'),
    description: nullableText(source.description, 'описание теста', 20_000),
    timeLimitSeconds: nullablePositiveInteger(source.timeLimitSeconds, 'лимит времени теста', 86_400),
    maxAttempts: nullablePositiveInteger(source.maxAttempts, 'лимит попыток теста', 1_000),
    passScoreRatio: ratio(source.passScoreRatio, 'проходной балл теста'),
    isPublished: boolean(source.isPublished, 'статус теста'),
    availableFrom: nullableTimestamp(source.availableFrom, 'начало доступности теста'),
    availableUntil: nullableTimestamp(source.availableUntil, 'окончание доступности теста'),
    questionCount: nonNegativeInteger(source.questionCount, 'количество вопросов теста', 200),
    activeQuestionCount: nonNegativeInteger(source.activeQuestionCount, 'количество активных вопросов теста', 200),
    createdAt: nullableTimestamp(source.createdAt, 'дата создания теста') ?? invalidResponse('дата создания теста'),
    updatedAt: nullableTimestamp(source.updatedAt, 'дата обновления теста') ?? invalidResponse('дата обновления теста'),
  }
}

export function parseAdminPracticeQuestion(value: unknown): AdminPracticeQuestion {
  const source = record(value, 'вопрос')
  const section = text(source.section, 'раздел вопроса', 64)
  if (!/^[a-z][a-z0-9_-]{0,63}$/.test(section)) invalidResponse('раздел вопроса')
  return {
    id: positiveInteger(source.id, 'id вопроса'),
    practiceTestId: positiveInteger(source.practiceTestId, 'id теста вопроса'),
    questionText: text(source.questionText, 'текст вопроса', 10_000),
    options: options(source.options),
    correctAnswer: answer(source.correctAnswer, 'правильный ответ'),
    explanation: nullableText(source.explanation, 'объяснение вопроса', 20_000),
    section,
    topic: nullableText(source.topic, 'тема вопроса', 200),
    difficulty: difficulty(source.difficulty, 'сложность вопроса'),
    imageUrl: nullableHttpsUrl(source.imageUrl, 'ссылка на изображение вопроса'),
    position: positiveInteger(source.position, 'порядок вопроса', 200),
    isActive: boolean(source.isActive, 'статус вопроса'),
    createdAt: nullableTimestamp(source.createdAt, 'дата создания вопроса') ?? invalidResponse('дата создания вопроса'),
    updatedAt: nullableTimestamp(source.updatedAt, 'дата обновления вопроса') ?? invalidResponse('дата обновления вопроса'),
  }
}

export function parseAdminPracticeTestList(value: unknown): AdminPracticeTestList {
  const page = listPage(value, 'список тестов')
  const items = page.items.map(parseAdminPracticeTest)
  if (new Set(items.map(item => item.id)).size !== items.length) invalidResponse('повторяющиеся тесты')
  if (items.some(item => item.activeQuestionCount > item.questionCount)) invalidResponse('количество активных вопросов')
  return { ...page, items }
}

export function parseAdminPracticeQuestionList(value: unknown): AdminPracticeQuestionList {
  const source = record(value, 'список вопросов')
  const page = listPage(source, 'список вопросов')
  const practiceTestId = positiveInteger(source.practiceTestId, 'id теста списка вопросов')
  const items = page.items.map(parseAdminPracticeQuestion)
  if (items.some(item => item.practiceTestId !== practiceTestId)) invalidResponse('тест вопроса не совпадает со списком')
  if (new Set(items.map(item => item.id)).size !== items.length) invalidResponse('повторяющиеся вопросы')
  const nextAvailablePosition = source.nextAvailablePosition === null
    ? null
    : positiveInteger(source.nextAvailablePosition, 'свободная позиция вопроса', 200)
  return { ...page, practiceTestId, items, nextAvailablePosition }
}

function pageSuffix(options: { limit?: number; offset?: number }): string {
  const params = new URLSearchParams()
  if (options.limit != null) params.set('limit', String(options.limit))
  if (options.offset != null) params.set('offset', String(options.offset))
  return params.size > 0 ? `?${params.toString()}` : ''
}

export async function listAdminCoursePracticeTests(courseId: number, options: { limit?: number; offset?: number } = {}): Promise<AdminPracticeTestList> {
  return parseAdminPracticeTestList(await zhangakApiRequest<unknown>(
    `/v1/admin/courses/${pathId(courseId, 'id курса')}/practice-tests${pageSuffix(options)}`,
  ))
}

export async function createAdminCoursePracticeTest(courseId: number, input: AdminPracticeTestInput): Promise<AdminPracticeTest> {
  const response = await zhangakApiJson<unknown>(
    `/v1/admin/courses/${pathId(courseId, 'id курса')}/practice-tests`,
    'POST',
    input,
  )
  return parseAdminPracticeTest(record(response, 'созданный тест').practiceTest)
}

export async function listAdminLessonPracticeTests(lessonId: number, options: { limit?: number; offset?: number } = {}): Promise<AdminPracticeTestList> {
  return parseAdminPracticeTestList(await zhangakApiRequest<unknown>(
    `/v1/admin/lessons/${pathId(lessonId, 'id урока')}/practice-tests${pageSuffix(options)}`,
  ))
}

export async function createAdminLessonPracticeTest(lessonId: number, input: AdminPracticeTestInput): Promise<AdminPracticeTest> {
  const response = await zhangakApiJson<unknown>(
    `/v1/admin/lessons/${pathId(lessonId, 'id урока')}/practice-tests`,
    'POST',
    input,
  )
  return parseAdminPracticeTest(record(response, 'созданный тест').practiceTest)
}

export async function getAdminPracticeTest(testId: number): Promise<AdminPracticeTest> {
  const response = await zhangakApiRequest<unknown>(`/v1/admin/practice-tests/${pathId(testId, 'id теста')}`)
  return parseAdminPracticeTest(record(response, 'тест').practiceTest)
}

export async function updateAdminPracticeTest(testId: number, input: Partial<AdminPracticeTestInput>): Promise<AdminPracticeTest> {
  const response = await zhangakApiJson<unknown>(
    `/v1/admin/practice-tests/${pathId(testId, 'id теста')}`,
    'PATCH',
    input,
  )
  return parseAdminPracticeTest(record(response, 'обновлённый тест').practiceTest)
}

export type AdminQuestionStatusFilter = 'active' | 'archived' | 'all'

export interface AdminQuestionCatalogQuery {
  limit?: number
  offset?: number
  /** Free text matched against question text and topic, server-side. */
  search?: string
  status?: AdminQuestionStatusFilter
  section?: string
  difficulty?: AdminPracticeQuestionDifficulty
}

function catalogSuffix(options: AdminQuestionCatalogQuery): string {
  const params = new URLSearchParams()
  if (options.limit != null) params.set('limit', String(options.limit))
  if (options.offset != null) params.set('offset', String(options.offset))
  // Blank values are omitted rather than sent: an empty `q` must mean "no
  // search", not a filter that quietly matches everything by accident.
  if (options.search?.trim()) params.set('q', options.search.trim())
  if (options.status && options.status !== 'all') params.set('status', options.status)
  if (options.section?.trim()) params.set('section', options.section.trim())
  if (options.difficulty) params.set('difficulty', options.difficulty)
  return params.size > 0 ? `?${params.toString()}` : ''
}

export async function listAdminPracticeQuestions(testId: number, options: AdminQuestionCatalogQuery = {}): Promise<AdminPracticeQuestionList> {
  return parseAdminPracticeQuestionList(await zhangakApiRequest<unknown>(
    `/v1/admin/practice-tests/${pathId(testId, 'id теста')}/questions${catalogSuffix(options)}`,
  ))
}

/**
 * Loads a complete filtered bank without violating the API's 100-row page
 * limit.  Screens that genuinely need the whole bank (currently the daily
 * challenge picker) must use this helper instead of asking the server for an
 * invalid `limit=200` page.
 */
export async function listAllAdminPracticeQuestions(
  testId: number,
  options: Omit<AdminQuestionCatalogQuery, 'limit' | 'offset'> = {},
): Promise<AdminPracticeQuestion[]> {
  const pageSize = 100
  const items: AdminPracticeQuestion[] = []
  let offset = 0

  for (;;) {
    const page = await listAdminPracticeQuestions(testId, { ...options, limit: pageSize, offset })
    items.push(...page.items)
    if (page.items.length === 0 || items.length >= page.total) return items
    offset += page.items.length
  }
}

export async function createAdminPracticeQuestion(testId: number, input: AdminPracticeQuestionInput): Promise<AdminPracticeQuestion> {
  const response = await zhangakApiJson<unknown>(
    `/v1/admin/practice-tests/${pathId(testId, 'id теста')}/questions`,
    'POST',
    input,
  )
  return parseAdminPracticeQuestion(record(response, 'созданный вопрос').question)
}

/**
 * "Delete" in the product means archive.
 *
 * A question can be referenced by immutable attempt history, the trainer and
 * daily challenges, so it is deactivated rather than removed. There is
 * deliberately no HTTP DELETE to call.
 */
export async function archiveAdminPracticeQuestion(questionId: number): Promise<AdminPracticeQuestion> {
  return updateAdminPracticeQuestion(questionId, { isActive: false })
}

export async function restoreAdminPracticeQuestion(questionId: number): Promise<AdminPracticeQuestion> {
  return updateAdminPracticeQuestion(questionId, { isActive: true })
}

export async function updateAdminPracticeQuestion(questionId: number, input: Partial<AdminPracticeQuestionInput>): Promise<AdminPracticeQuestion> {
  const response = await zhangakApiJson<unknown>(
    `/v1/admin/practice-questions/${pathId(questionId, 'id вопроса')}`,
    'PATCH',
    input,
  )
  return parseAdminPracticeQuestion(record(response, 'обновлённый вопрос').question)
}
