import { zhangakApiJson, zhangakApiRequest } from './zhangak-api-client.ts'

export interface AdminMockExam {
  id: number
  title: string
  startsAt: string
  city: string
  venue: string
  capacity: number | null
  registrationClosesAt: string | null
  isPublished: boolean
  registeredCount: number
}

export interface MockExamInput {
  title: string
  startsAt: string
  city: string
  venue: string
  capacity: number | null
  registrationClosesAt: string | null
  isPublished: boolean
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Некорректный ответ сервера')
  return value as Record<string, unknown>
}

function parse(value: unknown): AdminMockExam {
  const item = record(value)
  if (!Number.isSafeInteger(item.id) || (item.id as number) < 1 || typeof item.title !== 'string' || typeof item.startsAt !== 'string'
    || typeof item.city !== 'string' || typeof item.venue !== 'string' || (item.capacity !== null && !Number.isSafeInteger(item.capacity))
    || (item.registrationClosesAt !== null && typeof item.registrationClosesAt !== 'string') || typeof item.isPublished !== 'boolean'
    || !Number.isSafeInteger(item.registeredCount)) throw new Error('Некорректный пробный ОРТ')
  return { id: item.id as number, title: item.title, startsAt: item.startsAt, city: item.city, venue: item.venue,
    capacity: item.capacity as number | null, registrationClosesAt: item.registrationClosesAt as string | null,
    isPublished: item.isPublished, registeredCount: item.registeredCount as number }
}

export async function listAdminMockExams(): Promise<AdminMockExam[]> {
  const response = record(await zhangakApiRequest<unknown>('/v1/admin/mock-exams'))
  if (!Array.isArray(response.items)) throw new Error('Некорректный список пробных ОРТ')
  return response.items.map(parse)
}

export async function createAdminMockExam(input: MockExamInput): Promise<AdminMockExam> {
  const response = record(await zhangakApiJson<unknown>('/v1/admin/mock-exams', 'POST', input))
  return parse(response.session)
}

export async function updateAdminMockExam(id: number, input: Partial<MockExamInput>): Promise<AdminMockExam> {
  if (!Number.isSafeInteger(id) || id < 1) throw new Error('Некорректный пробный ОРТ')
  const response = record(await zhangakApiJson<unknown>(`/v1/admin/mock-exams/${id}`, 'PATCH', input))
  return parse(response.session)
}
