import { zhangakApiJson, zhangakApiRequest } from './zhangak-api-client.ts'

export interface UpcomingMockExam {
  id: number
  title: string
  startsAt: string
  city: string
  venue: string
  capacity: number | null
  registrationClosesAt: string | null
  registeredCount: number
  isRegistered: boolean
}

function record(value: unknown, context: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Некорректный ответ: ${context}`)
  return value as Record<string, unknown>
}

function session(value: unknown): UpcomingMockExam {
  const row = record(value, 'пробный ОРТ')
  if (!Number.isSafeInteger(row.id) || (row.id as number) < 1
    || typeof row.title !== 'string' || !row.title.trim()
    || typeof row.startsAt !== 'string' || Number.isNaN(new Date(row.startsAt).getTime())
    || typeof row.city !== 'string' || !row.city.trim()
    || typeof row.venue !== 'string' || !row.venue.trim()
    || (row.capacity !== null && (!Number.isSafeInteger(row.capacity) || (row.capacity as number) < 1))
    || (row.registrationClosesAt !== null && (typeof row.registrationClosesAt !== 'string' || Number.isNaN(new Date(row.registrationClosesAt).getTime())))
    || !Number.isSafeInteger(row.registeredCount) || (row.registeredCount as number) < 0
    || typeof row.isRegistered !== 'boolean') {
    throw new Error('Некорректный ответ: пробный ОРТ')
  }
  return {
    id: row.id as number,
    title: row.title as string,
    startsAt: row.startsAt as string,
    city: row.city as string,
    venue: row.venue as string,
    capacity: row.capacity as number | null,
    registrationClosesAt: row.registrationClosesAt as string | null,
    registeredCount: row.registeredCount as number,
    isRegistered: row.isRegistered as boolean,
  }
}

export async function getUpcomingMockExam(): Promise<UpcomingMockExam | null> {
  const response = record(await zhangakApiRequest<unknown>('/v1/platform/mock-exams/upcoming'), 'ближайший пробный ОРТ')
  if (!Object.hasOwn(response, 'session')) throw new Error('Некорректный ответ: ближайший пробный ОРТ')
  return response.session === null ? null : session(response.session)
}

export async function registerForMockExam(sessionId: number): Promise<UpcomingMockExam> {
  if (!Number.isSafeInteger(sessionId) || sessionId < 1) throw new Error('Некорректный пробный ОРТ')
  const response = record(await zhangakApiJson<unknown>(`/v1/platform/mock-exams/${sessionId}/register`, 'POST', {}), 'регистрация на пробный ОРТ')
  return session(response.session)
}
