'use client'

export type PublicCourse = {
  id: number
  name: string
  code: string
  level: string | null
  subject: string | null
  deliveryMode: 'online' | 'offline'
}

export type PublicApplicationStatus = 'new' | 'contacted' | 'awaiting_payment' | 'awaiting_confirmation' | 'enrolled' | 'declined' | 'cancelled'

export type StaffApplication = {
  id: number
  applicant: { name: string; phone: string; city: string }
  course: Pick<PublicCourse, 'id' | 'name' | 'code' | 'deliveryMode'>
  status: PublicApplicationStatus
  assignedTo: { id: string; fullName: string | null } | null
  enrollmentId: number | null
  paymentConfirmedAt: string | null
  createdAt: string
  updatedAt: string
}

export type ApplicationEvent = {
  id: number
  eventType: 'submitted' | 'status_changed' | 'note_added' | 'payment_confirmed'
  fromStatus: PublicApplicationStatus | null
  toStatus: PublicApplicationStatus | null
  note: string | null
  actorName: string | null
  createdAt: string
}

export class PublicApplicationError extends Error {
  readonly status: number
  readonly code: string

  constructor(message: string, status: number, code = 'request_failed') {
    super(message)
    this.name = 'PublicApplicationError'
    this.status = status
    this.code = code
  }
}

function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function applicationStatus(value: unknown): PublicApplicationStatus | null {
  return ['new', 'contacted', 'awaiting_payment', 'awaiting_confirmation', 'enrolled', 'declined', 'cancelled'].includes(String(value))
    ? value as PublicApplicationStatus
    : null
}

function publicCourse(value: unknown): PublicCourse | null {
  const row = object(value)
  if (!row || !Number.isSafeInteger(row.id) || typeof row.name !== 'string' || typeof row.code !== 'string'
    || (row.level !== null && typeof row.level !== 'string') || (row.subject !== null && typeof row.subject !== 'string')
    || (row.deliveryMode !== 'online' && row.deliveryMode !== 'offline')) return null
  return { id: row.id as number, name: row.name, code: row.code, level: row.level as string | null, subject: row.subject as string | null, deliveryMode: row.deliveryMode }
}

function staffApplication(value: unknown): StaffApplication | null {
  const row = object(value)
  const applicant = object(row?.applicant)
  const course = object(row?.course)
  const status = applicationStatus(row?.status)
  if (!row || !applicant || !course || !status || !Number.isSafeInteger(row.id)
    || typeof applicant.name !== 'string' || typeof applicant.phone !== 'string' || typeof applicant.city !== 'string'
    || !Number.isSafeInteger(course.id) || typeof course.name !== 'string' || typeof course.code !== 'string'
    || (course.deliveryMode !== 'online' && course.deliveryMode !== 'offline')
    || (row.enrollmentId !== null && !Number.isSafeInteger(row.enrollmentId))
    || (row.paymentConfirmedAt !== null && typeof row.paymentConfirmedAt !== 'string')
    || typeof row.createdAt !== 'string' || typeof row.updatedAt !== 'string') return null
  const assigned = row.assignedTo === null ? null : object(row.assignedTo)
  if (assigned && (typeof assigned.id !== 'string' || (assigned.fullName !== null && typeof assigned.fullName !== 'string'))) return null
  return {
    id: row.id as number,
    applicant: { name: applicant.name, phone: applicant.phone, city: applicant.city },
    course: { id: course.id as number, name: course.name, code: course.code, deliveryMode: course.deliveryMode },
    status,
    assignedTo: assigned ? { id: assigned.id as string, fullName: assigned.fullName as string | null } : null,
    enrollmentId: row.enrollmentId as number | null,
    paymentConfirmedAt: row.paymentConfirmedAt as string | null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

async function read(response: Response): Promise<unknown> {
  if (!(response.headers.get('content-type') ?? '').includes('application/json')) return null
  try { return await response.json() } catch { return null }
}

function failure(response: Response, body: unknown): PublicApplicationError {
  const row = object(body)
  return new PublicApplicationError(typeof row?.error === 'string' ? row.error : 'Сервис временно недоступен', response.status, typeof row?.code === 'string' ? row.code : 'request_failed')
}

async function request<T>(path: string, init: RequestInit = {}, credentials: RequestCredentials = 'omit'): Promise<T> {
  let response: Response
  try {
    response = await fetch(path, {
      ...init,
      credentials,
      cache: 'no-store',
      headers: { Accept: 'application/json', ...init.headers },
      signal: init.signal ?? AbortSignal.timeout(15_000),
    })
  } catch {
    throw new PublicApplicationError('Не удалось связаться с сервисом', 503, 'network_error')
  }
  const body = await read(response)
  if (!response.ok) throw failure(response, body)
  return body as T
}

export async function listPublicCourses(): Promise<PublicCourse[]> {
  const body = await request<{ items?: unknown }>('/v1/public/courses')
  const items = Array.isArray(body.items) ? body.items.map(publicCourse) : []
  if (items.length !== (Array.isArray(body.items) ? body.items.length : -1) || items.some(item => item === null)) throw new PublicApplicationError('Сервис вернул некорректный список курсов', 502, 'invalid_response')
  return items as PublicCourse[]
}

export async function submitPublicApplication(input: { name: string; phone: string; city: string; courseId: number }): Promise<{ application: { id: number; status: PublicApplicationStatus; course: PublicCourse; createdAt: string }; whatsappUrl: string }> {
  const body = await request<{ application?: unknown; whatsappUrl?: unknown }>('/v1/public/applications', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  })
  const application = object(body.application)
  const course = publicCourse(application?.course)
  const status = applicationStatus(application?.status)
  if (!application || !course || !status || !Number.isSafeInteger(application.id) || typeof application.createdAt !== 'string' || typeof body.whatsappUrl !== 'string' || !body.whatsappUrl.startsWith('https://wa.me/')) {
    throw new PublicApplicationError('Сервис вернул некорректный ответ', 502, 'invalid_response')
  }
  return { application: { id: application.id as number, status, course, createdAt: application.createdAt }, whatsappUrl: body.whatsappUrl }
}

export async function listStaffApplications(): Promise<StaffApplication[]> {
  const body = await request<{ items?: unknown }>('/v1/admin/applications', {}, 'include')
  if (!Array.isArray(body.items)) throw new PublicApplicationError('Сервис вернул некорректный список заявок', 502, 'invalid_response')
  const items = body.items.map(staffApplication)
  if (items.some(item => item === null)) throw new PublicApplicationError('Сервис вернул некорректный список заявок', 502, 'invalid_response')
  return items as StaffApplication[]
}

export async function updateStaffApplication(id: number, input: { status?: Exclude<PublicApplicationStatus, 'new' | 'enrolled'>; note?: string }): Promise<StaffApplication> {
  const body = await request<{ application?: unknown }>(`/v1/admin/applications/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) }, 'include')
  const result = staffApplication(body.application)
  if (!result) throw new PublicApplicationError('Сервис вернул некорректную заявку', 502, 'invalid_response')
  return result
}

export async function listApplicationEvents(id: number): Promise<ApplicationEvent[]> {
  const body = await request<{ items?: unknown }>(`/v1/admin/applications/${id}/events`, {}, 'include')
  if (!Array.isArray(body.items)) throw new PublicApplicationError('Сервис вернул некорректную историю', 502, 'invalid_response')
  const results = body.items.map(value => {
    const row = object(value)
    const eventType = row?.eventType
    const fromStatus = row?.fromStatus === null ? null : applicationStatus(row?.fromStatus)
    const toStatus = row?.toStatus === null ? null : applicationStatus(row?.toStatus)
    if (!row || !Number.isSafeInteger(row.id) || !['submitted', 'status_changed', 'note_added', 'payment_confirmed'].includes(String(eventType))
      || (fromStatus === null && row.fromStatus !== null) || (toStatus === null && row.toStatus !== null)
      || (row.note !== null && typeof row.note !== 'string') || (row.actorName !== null && typeof row.actorName !== 'string') || typeof row.createdAt !== 'string') return null
    return { id: row.id as number, eventType: eventType as ApplicationEvent['eventType'], fromStatus, toStatus, note: row.note as string | null, actorName: row.actorName as string | null, createdAt: row.createdAt }
  })
  if (results.some(item => item === null)) throw new PublicApplicationError('Сервис вернул некорректную историю', 502, 'invalid_response')
  return results as ApplicationEvent[]
}

export async function confirmApplicationPayment(id: number, studentId: string, accessPlan: 'one_month' | 'three_months' | 'one_year' = 'one_month'): Promise<StaffApplication> {
  const body = await request<{ application?: unknown }>(`/v1/admin/applications/${id}/confirm-payment`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ studentId, accessPlan }) }, 'include')
  const result = staffApplication(body.application)
  if (!result) throw new PublicApplicationError('Сервис вернул некорректную заявку', 502, 'invalid_response')
  return result
}
