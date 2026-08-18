'use client'

import { zhangakApiJson, zhangakApiRequest } from './zhangak-api-client.ts'

export type DailySubject = 'math' | 'kyr'

export interface AdminDailyChallenge {
  id: number
  courseId: number
  challengeDate: string
  title: string
  subject: DailySubject
  xpReward: number
  isPublished: boolean
  questionCount: number
  createdAt: string
}

export interface CreateAdminDailyChallengeInput {
  courseId: number
  challengeDate: string
  title: string
  subject: DailySubject
  xpReward: number
  questionIds: number[]
  isPublished: boolean
}

function source(value: unknown, context: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Некорректный ответ сервиса: ${context}`)
  return value as Record<string, unknown>
}

function positive(value: unknown, context: string, max = Number.MAX_SAFE_INTEGER): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1 || (value as number) > max) throw new Error(`Некорректный ответ сервиса: ${context}`)
  return value as number
}

function text(value: unknown, context: string, max: number): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error(`Некорректный ответ сервиса: ${context}`)
  return value
}

export function parseAdminDailyChallenge(value: unknown): AdminDailyChallenge {
  const row = source(value, 'задание дня')
  const subject = row.subject
  if (subject !== 'math' && subject !== 'kyr') throw new Error('Некорректный ответ сервиса: предмет задания дня')
  if (typeof row.isPublished !== 'boolean' || !/^\d{4}-\d{2}-\d{2}$/.test(String(row.challengeDate))) throw new Error('Некорректный ответ сервиса: публикация задания дня')
  if (row.questionCount !== 15) throw new Error('Некорректный ответ сервиса: вопросы задания дня')
  return {
    id: positive(row.id, 'id задания дня'),
    courseId: positive(row.courseId, 'курс задания дня'),
    challengeDate: row.challengeDate as string,
    title: text(row.title, 'название задания дня', 300),
    subject,
    xpReward: positive(row.xpReward, 'XP задания дня', 10_000),
    isPublished: row.isPublished,
    questionCount: 15,
    createdAt: text(row.createdAt, 'дата создания задания дня', 64),
  }
}

export async function listAdminDailyChallenges(courseId?: number): Promise<AdminDailyChallenge[]> {
  const suffix = courseId ? `?courseId=${positive(courseId, 'id курса')}` : ''
  const response = source(await zhangakApiRequest<unknown>(`/v1/admin/daily-challenges${suffix}`), 'список заданий дня')
  if (!Array.isArray(response.items)) throw new Error('Некорректный ответ сервиса: список заданий дня')
  return response.items.map(parseAdminDailyChallenge)
}

export async function createAdminDailyChallenge(input: CreateAdminDailyChallengeInput): Promise<AdminDailyChallenge> {
  if (!Number.isSafeInteger(input.courseId) || input.courseId < 1 || !/^\d{4}-\d{2}-\d{2}$/.test(input.challengeDate)
    || !input.title.trim() || !['math', 'kyr'].includes(input.subject) || !Number.isSafeInteger(input.xpReward)
    || input.xpReward < 1 || input.questionIds.length !== 15 || new Set(input.questionIds).size !== 15) {
    throw new Error('Проверь параметры задания дня')
  }
  const response = source(await zhangakApiJson<unknown>('/v1/admin/daily-challenges', 'POST', input), 'созданное задание дня')
  return parseAdminDailyChallenge(response.challenge)
}

export async function publishAdminDailyChallenge(challengeId: number): Promise<AdminDailyChallenge> {
  const response = source(await zhangakApiJson<unknown>(`/v1/admin/daily-challenges/${positive(challengeId, 'id задания дня')}/publish`, 'PATCH', {}), 'опубликованное задание дня')
  return parseAdminDailyChallenge(response.challenge)
}
