/**
 * Browser-side shapes for the first-party practice API.
 *
 * An open question intentionally has no answer key, explanation, selected
 * answer, result, or score. Those fields only exist in a
 * `SubmittedPracticeReview` returned after the API has finalized an attempt.
 */

export const PRACTICE_ANSWER_LETTERS = ['a', 'b', 'c', 'd'] as const

export type PracticeAnswerLetter = typeof PRACTICE_ANSWER_LETTERS[number]

export interface PracticeAnswerOptions {
  a: string
  b: string
  c: string
  d: string
}

export interface PlatformPracticeTest {
  id: number
  courseId: number | null
  lessonId: number | null
  title: string
  subject: string
  testType: 'practice' | 'mock' | 'bank' | 'diagnostic'
  description: string | null
  timeLimitSeconds: number | null
  maxAttempts: number | null
  passScoreRatio: number | null
  availableFrom: string | null
  availableUntil: string | null
  questionCount: number
}

export interface OpenPracticeQuestion {
  questionId: number
  position: number
  questionText: string
  options: PracticeAnswerOptions
  section: string
  topic: string | null
  difficulty: string
  imageUrl: string | null
}

export interface PlatformPracticeAttempt {
  id: string
  status: 'started' | 'submitted' | 'expired' | 'abandoned'
  practiceTestId: number
  courseId: number | null
  lessonId: number | null
  attemptNumber: number
  testTitle: string
  testType: 'practice' | 'mock' | 'bank' | 'diagnostic'
  timeLimitSeconds: number | null
  passScoreRatio: number | null
  questionCount: number
  correctCount: number | null
  scorePercent: number | null
  passed: boolean | null
  elapsedSeconds: number | null
  startedAt: string | null
  expiresAt: string | null
  submittedAt: string | null
}

/** This projection is returned only after `status === 'submitted'`. */
export interface SubmittedPracticeReview extends OpenPracticeQuestion {
  selectedAnswer: PracticeAnswerLetter | null
  correctAnswer: PracticeAnswerLetter
  isCorrect: boolean
  explanation: string | null
}

export interface BeginPracticeAttemptResponse {
  attempt: PlatformPracticeAttempt
  questions: OpenPracticeQuestion[]
  replayed: boolean
  resumed: boolean
}

export interface SubmitPracticeAttemptResponse {
  attempt: PlatformPracticeAttempt
  review: SubmittedPracticeReview[]
  replayed: boolean
}

const PRACTICE_TEST_TYPES = new Set<PlatformPracticeTest['testType']>(['practice', 'mock', 'bank', 'diagnostic'])
const PRACTICE_ATTEMPT_STATUSES = new Set<PlatformPracticeAttempt['status']>(['started', 'submitted', 'expired', 'abandoned'])

export const SECTION_LABELS: Record<string, string> = {
  math: 'Математика',
  comparison: 'Сравнение',
  analogy: 'Аналогия',
  reading: 'Чтение',
  grammar: 'Грамматика',
  general: 'Общее',
}

function record(value: unknown, context: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Некорректный ответ сервиса: ${context}`)
  return value as Record<string, unknown>
}

function string(value: unknown, context: string): string {
  if (typeof value !== 'string') throw new Error(`Некорректный ответ сервиса: ${context}`)
  return value
}

function nullableString(value: unknown, context: string): string | null {
  if (value === null) return null
  return string(value, context)
}

function positiveInteger(value: unknown, context: string): number {
  if (!Number.isSafeInteger(value) || (value as number) <= 0) throw new Error(`Некорректный ответ сервиса: ${context}`)
  return value as number
}

function nullablePositiveInteger(value: unknown, context: string): number | null {
  if (value === null) return null
  return positiveInteger(value, context)
}

function nullableNumber(value: unknown, context: string): number | null {
  if (value === null) return null
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`Некорректный ответ сервиса: ${context}`)
  return value
}

function nullableBoolean(value: unknown, context: string): boolean | null {
  if (value === null) return null
  if (typeof value !== 'boolean') throw new Error(`Некорректный ответ сервиса: ${context}`)
  return value
}

function boolean(value: unknown, context: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`Некорректный ответ сервиса: ${context}`)
  return value
}

function answerLetter(value: unknown, context: string): PracticeAnswerLetter {
  if (typeof value !== 'string' || !PRACTICE_ANSWER_LETTERS.includes(value as PracticeAnswerLetter)) {
    throw new Error(`Некорректный ответ сервиса: ${context}`)
  }
  return value as PracticeAnswerLetter
}

function nullableAnswerLetter(value: unknown, context: string): PracticeAnswerLetter | null {
  if (value === null) return null
  return answerLetter(value, context)
}

function answerOptions(value: unknown): PracticeAnswerOptions {
  const options = record(value, 'варианты ответа')
  return {
    a: string(options.a, 'вариант A'),
    b: string(options.b, 'вариант B'),
    c: string(options.c, 'вариант C'),
    d: string(options.d, 'вариант D'),
  }
}

function nullableTimestamp(value: unknown, context: string): string | null {
  const timestamp = nullableString(value, context)
  if (timestamp !== null && Number.isNaN(new Date(timestamp).getTime())) throw new Error(`Некорректный ответ сервиса: ${context}`)
  return timestamp
}

function parseTestType(value: unknown, context: string): PlatformPracticeTest['testType'] {
  if (typeof value !== 'string' || !PRACTICE_TEST_TYPES.has(value as PlatformPracticeTest['testType'])) {
    throw new Error(`Некорректный ответ сервиса: ${context}`)
  }
  return value as PlatformPracticeTest['testType']
}

export function parsePlatformPracticeTest(value: unknown): PlatformPracticeTest {
  const source = record(value, 'тест')
  return {
    id: positiveInteger(source.id, 'id теста'),
    courseId: nullablePositiveInteger(source.courseId, 'courseId'),
    lessonId: nullablePositiveInteger(source.lessonId, 'lessonId'),
    title: string(source.title, 'название теста'),
    subject: string(source.subject, 'предмет'),
    testType: parseTestType(source.testType, 'тип теста'),
    description: nullableString(source.description, 'описание теста'),
    timeLimitSeconds: nullablePositiveInteger(source.timeLimitSeconds, 'лимит времени'),
    maxAttempts: nullablePositiveInteger(source.maxAttempts, 'лимит попыток'),
    passScoreRatio: nullableNumber(source.passScoreRatio, 'проходной балл'),
    availableFrom: nullableTimestamp(source.availableFrom, 'дата начала'),
    availableUntil: nullableTimestamp(source.availableUntil, 'дата окончания'),
    questionCount: positiveInteger(source.questionCount, 'число вопросов'),
  }
}

export function parsePlatformPracticeTests(value: unknown): PlatformPracticeTest[] {
  const source = record(value, 'список тестов')
  if (!Array.isArray(source.items)) throw new Error('Некорректный ответ сервиса: список тестов')
  return source.items.map(parsePlatformPracticeTest)
}

export function parseOpenPracticeQuestion(value: unknown): OpenPracticeQuestion {
  const source = record(value, 'вопрос попытки')
  return {
    questionId: positiveInteger(source.questionId, 'id вопроса'),
    position: positiveInteger(source.position, 'позиция вопроса'),
    questionText: string(source.questionText, 'текст вопроса'),
    options: answerOptions(source.options),
    section: string(source.section, 'раздел вопроса'),
    topic: nullableString(source.topic, 'тема вопроса'),
    difficulty: string(source.difficulty, 'сложность вопроса'),
    imageUrl: nullableString(source.imageUrl, 'изображение вопроса'),
  }
}

function parseAttempt(value: unknown): PlatformPracticeAttempt {
  const source = record(value, 'попытка')
  const status = string(source.status, 'статус попытки')
  if (!PRACTICE_ATTEMPT_STATUSES.has(status as PlatformPracticeAttempt['status'])) {
    throw new Error('Некорректный ответ сервиса: статус попытки')
  }
  return {
    id: string(source.id, 'id попытки'),
    status: status as PlatformPracticeAttempt['status'],
    practiceTestId: positiveInteger(source.practiceTestId, 'id теста попытки'),
    courseId: nullablePositiveInteger(source.courseId, 'courseId попытки'),
    lessonId: nullablePositiveInteger(source.lessonId, 'lessonId попытки'),
    attemptNumber: positiveInteger(source.attemptNumber, 'номер попытки'),
    testTitle: string(source.testTitle, 'название попытки'),
    testType: parseTestType(source.testType, 'тип попытки'),
    timeLimitSeconds: nullablePositiveInteger(source.timeLimitSeconds, 'лимит времени попытки'),
    passScoreRatio: nullableNumber(source.passScoreRatio, 'проходной балл попытки'),
    questionCount: positiveInteger(source.questionCount, 'число вопросов попытки'),
    correctCount: nullableNumber(source.correctCount, 'результат попытки'),
    scorePercent: nullableNumber(source.scorePercent, 'процент попытки'),
    passed: nullableBoolean(source.passed, 'статус прохождения'),
    elapsedSeconds: nullableNumber(source.elapsedSeconds, 'время попытки'),
    startedAt: nullableTimestamp(source.startedAt, 'время начала'),
    expiresAt: nullableTimestamp(source.expiresAt, 'время окончания'),
    submittedAt: nullableTimestamp(source.submittedAt, 'время отправки'),
  }
}

function parseSubmittedReview(value: unknown): SubmittedPracticeReview {
  const source = record(value, 'разбор попытки')
  const question = parseOpenPracticeQuestion(source)
  return {
    ...question,
    selectedAnswer: nullableAnswerLetter(source.selectedAnswer, 'ответ ученика'),
    correctAnswer: answerLetter(source.correctAnswer, 'правильный ответ'),
    isCorrect: typeof source.isCorrect === 'boolean'
      ? source.isCorrect
      : (() => { throw new Error('Некорректный ответ сервиса: результат вопроса') })(),
    explanation: nullableString(source.explanation, 'объяснение'),
  }
}

export function parseBeginPracticeAttempt(value: unknown): BeginPracticeAttemptResponse {
  const source = record(value, 'начало попытки')
  const attempt = parseAttempt(source.attempt)
  if (attempt.status !== 'started') throw new Error('Сервис вернул незавершённую попытку с неверным статусом')
  if (!Array.isArray(source.questions) || source.questions.length < 1 || source.questions.length !== attempt.questionCount) {
    throw new Error('Некорректный ответ сервиса: вопросы попытки')
  }
  const questions = source.questions.map(parseOpenPracticeQuestion)
  if (new Set(questions.map(question => question.questionId)).size !== questions.length) {
    throw new Error('Некорректный ответ сервиса: повторяющиеся вопросы попытки')
  }
  return {
    attempt,
    questions,
    replayed: boolean(source.replayed, 'повтор начала'),
    resumed: boolean(source.resumed, 'возобновление'),
  }
}

export function parseSubmitPracticeAttempt(value: unknown): SubmitPracticeAttemptResponse {
  const source = record(value, 'результат попытки')
  const attempt = parseAttempt(source.attempt)
  if (attempt.status !== 'submitted' || attempt.correctCount === null || attempt.scorePercent === null || attempt.passed === null || attempt.elapsedSeconds === null) {
    throw new Error('Сервис вернул неполный результат попытки')
  }
  if (!Array.isArray(source.review) || source.review.length !== attempt.questionCount) {
    throw new Error('Некорректный ответ сервиса: разбор попытки')
  }
  const review = source.review.map(parseSubmittedReview)
  const correctCount = review.filter(item => item.isCorrect).length
  if (correctCount !== attempt.correctCount || new Set(review.map(question => question.questionId)).size !== review.length) {
    throw new Error('Некорректный ответ сервиса: несогласованный разбор попытки')
  }
  return {
    attempt,
    review,
    replayed: boolean(source.replayed, 'повтор отправки'),
  }
}

export function practiceOptionText(question: Pick<OpenPracticeQuestion, 'options'>, letter: PracticeAnswerLetter): string {
  return question.options[letter]
}

export function secondsUntil(timestamp: string | null): number | null {
  if (!timestamp) return null
  return Math.max(0, Math.ceil((new Date(timestamp).getTime() - Date.now()) / 1000))
}

export function createPracticeIdempotencyKey(): string {
  if (typeof crypto?.randomUUID === 'function') return crypto.randomUUID()

  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
