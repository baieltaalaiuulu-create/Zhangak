import { zhangakApiJson, zhangakApiRequest } from './zhangak-api-client.ts'

export type AnswerLetter = 'a' | 'b' | 'c' | 'd'

export interface DailyQuestion {
  id: number
  questionText: string
  options: Record<AnswerLetter, string>
  section: string
  topic: string | null
  difficulty: 'easy' | 'medium' | 'hard'
  imageUrl: string | null
}

export interface DailyAttempt {
  id: string
  status: 'started' | 'submitted'
  correctCount: number | null
  scorePercent: number | null
  starCount: number | null
  xpAwarded: number | null
  questions?: DailyQuestion[]
  review?: AnswerReview[]
}

export interface AnswerReview extends DailyQuestion {
  selectedAnswer: AnswerLetter | null
  correctAnswer: AnswerLetter
  isCorrect: boolean
  explanation: string | null
}

function record(value: unknown, context: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Некорректный ответ: ${context}`)
  return value as Record<string, unknown>
}

function positive(value: unknown, context: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1) throw new Error(`Некорректный ответ: ${context}`)
  return value as number
}

function nullableNumber(value: unknown, context: string): number | null {
  if (value === null) return null
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`Некорректный ответ: ${context}`)
  return value
}

function answerOptions(value: unknown): Record<AnswerLetter, string> {
  const source = record(value, 'варианты')
  const keys = Object.keys(source).sort()
  if (keys.join(',') !== 'a,b,c,d' || keys.some(key => typeof source[key] !== 'string' || !String(source[key]).trim())) throw new Error('Некорректный ответ: варианты')
  return source as Record<AnswerLetter, string>
}

function parseQuestion(value: unknown): DailyQuestion {
  const source = record(value, 'вопрос')
  const difficulty = source.difficulty
  if (!['easy', 'medium', 'hard'].includes(String(difficulty)) || typeof source.questionText !== 'string' || !source.questionText.trim() || typeof source.section !== 'string') throw new Error('Некорректный ответ: вопрос')
  if (source.topic !== null && typeof source.topic !== 'string') throw new Error('Некорректный ответ: тема')
  if (source.imageUrl !== null && typeof source.imageUrl !== 'string') throw new Error('Некорректный ответ: изображение')
  return { id: positive(source.id, 'id вопроса'), questionText: source.questionText, options: answerOptions(source.options), section: source.section, topic: source.topic as string | null, difficulty: difficulty as DailyQuestion['difficulty'], imageUrl: source.imageUrl as string | null }
}

function parseReview(value: unknown): AnswerReview {
  const source = record(value, 'разбор ответа')
  const question = parseQuestion({ ...source, id: source.id ?? source.questionId })
  const selectedAnswer = source.selectedAnswer
  const correctAnswer = source.correctAnswer
  if (selectedAnswer !== null && !['a', 'b', 'c', 'd'].includes(String(selectedAnswer))) throw new Error('Некорректный ответ: выбранный вариант')
  if (!['a', 'b', 'c', 'd'].includes(String(correctAnswer)) || typeof source.isCorrect !== 'boolean') throw new Error('Некорректный ответ: разбор')
  if (source.explanation !== null && typeof source.explanation !== 'string') throw new Error('Некорректный ответ: объяснение')
  return { ...question, selectedAnswer: selectedAnswer as AnswerLetter | null, correctAnswer: correctAnswer as AnswerLetter, isCorrect: source.isCorrect, explanation: source.explanation as string | null }
}

function parseAttempt(value: unknown): DailyAttempt {
  const source = record(value, 'попытка')
  if (typeof source.id !== 'string' || !['started', 'submitted'].includes(String(source.status))) throw new Error('Некорректный ответ: попытка')
  const starCount = nullableNumber(source.starCount, 'звёзды')
  if (starCount !== null && (!Number.isInteger(starCount) || starCount < 0 || starCount > 3)) throw new Error('Некорректный ответ: звёзды')
  const output: DailyAttempt = { id: source.id, status: source.status as DailyAttempt['status'], correctCount: nullableNumber(source.correctCount, 'правильные'), scorePercent: nullableNumber(source.scorePercent, 'процент'), starCount, xpAwarded: nullableNumber(source.xpAwarded, 'XP') }
  if (source.questions !== undefined) {
    if (!Array.isArray(source.questions) || source.questions.length !== 15) throw new Error('Некорректный ответ: вопросы')
    output.questions = source.questions.map(parseQuestion)
  }
  if (source.review !== undefined) {
    if (!Array.isArray(source.review) || source.review.length !== 15) throw new Error('Некорректный ответ: разбор задания')
    output.review = source.review.map(parseReview)
  }
  return output
}

function key(): string {
  return crypto.randomUUID()
}

export async function getDailyChallenge(): Promise<{ available: boolean; attempt: DailyAttempt | null }> {
  const source = record(await zhangakApiRequest<unknown>('/v1/platform/daily-challenge'), 'задание дня')
  if (typeof source.available !== 'boolean') throw new Error('Некорректный ответ: доступность задания')
  return { available: source.available, attempt: source.attempt === null || source.attempt === undefined ? null : parseAttempt(source.attempt) }
}

export async function startDailyChallenge(idempotencyKey = key()): Promise<DailyAttempt> {
  const source = record(await zhangakApiJson<unknown>('/v1/platform/daily-challenge/start', 'POST', { idempotencyKey }), 'старт задания дня')
  return parseAttempt(source.attempt)
}

export async function submitDailyChallenge(idempotencyKey: string, answers: { questionId: number; answer: AnswerLetter }[]): Promise<DailyAttempt> {
  const source = record(await zhangakApiJson<unknown>('/v1/platform/daily-challenge/submit', 'POST', { idempotencyKey, answers }), 'результат задания дня')
  return parseAttempt(source.attempt)
}

export interface TrainerQuestion extends DailyQuestion { issueId: string }

export async function getTrainerQuestion(filter: { subject: 'math' | 'kyr'; section: string; difficulty: 'easy' | 'medium' | 'hard' }): Promise<TrainerQuestion | null> {
  const params = new URLSearchParams(filter)
  const source = record(await zhangakApiRequest<unknown>(`/v1/platform/trainer/question?${params}`), 'вопрос тренажёра')
  if (source.question === null) return null
  const question = parseQuestion(source.question)
  const issueId = record(source.question, 'вопрос тренажёра').issueId
  if (typeof issueId !== 'string') throw new Error('Некорректный ответ: вопрос тренажёра')
  return { ...question, issueId }
}

export async function answerTrainerQuestion(issueId: string, answer: AnswerLetter, idempotencyKey = key()): Promise<boolean> {
  const source = record(await zhangakApiJson<unknown>('/v1/platform/trainer/answers', 'POST', { issueId, answer, idempotencyKey }), 'ответ тренажёра')
  if (typeof source.isCorrect !== 'boolean') throw new Error('Некорректный ответ: результат тренажёра')
  return source.isCorrect
}

export async function resetTrainer(): Promise<number> {
  const source = record(await zhangakApiJson<unknown>('/v1/platform/trainer/reset', 'POST', {}), 'сброс тренажёра')
  if (source.reset !== true || !Number.isSafeInteger(source.removedMasteryCount) || (source.removedMasteryCount as number) < 0) throw new Error('Некорректный ответ: сброс тренажёра')
  return source.removedMasteryCount as number
}

export interface TrainerHistoryItem {
  questionId: number
  questionText: string
  options: Record<AnswerLetter, string>
  selectedAnswer: AnswerLetter
  correctAnswer: AnswerLetter
  isCorrect: boolean
  explanation: string | null
  answeredAt: string
}

export async function getTrainerHistory(): Promise<TrainerHistoryItem[]> {
  const source = record(await zhangakApiRequest<unknown>('/v1/platform/trainer/history'), 'история тренажёра')
  if (!Array.isArray(source.items)) throw new Error('Некорректный ответ: история тренажёра')
  return source.items.map(value => {
    const item = record(value, 'история тренажёра')
    const questionId = positive(item.questionId, 'id вопроса истории')
    if (typeof item.questionText !== 'string' || !item.questionText.trim()) throw new Error('Некорректный ответ: вопрос истории')
    const selectedAnswer = item.selectedAnswer
    const correctAnswer = item.correctAnswer
    if (!['a', 'b', 'c', 'd'].includes(String(selectedAnswer)) || !['a', 'b', 'c', 'd'].includes(String(correctAnswer)) || typeof item.isCorrect !== 'boolean') throw new Error('Некорректный ответ: история тренажёра')
    if (item.explanation !== null && typeof item.explanation !== 'string') throw new Error('Некорректный ответ: объяснение истории')
    const answeredAt = item.answeredAt
    if (typeof answeredAt !== 'string') throw new Error('Некорректный ответ: дата истории')
    return { questionId, questionText: item.questionText, options: answerOptions(item.options), selectedAnswer: selectedAnswer as AnswerLetter, correctAnswer: correctAnswer as AnswerLetter, isCorrect: item.isCorrect, explanation: item.explanation as string | null, answeredAt }
  })
}
