'use client'

import { ZhangakApiError, zhangakApiRequest } from './zhangak-api-client.ts'

export type TeacherDeliveryMode = 'offline'

export interface PlatformTeacherGroup {
  id: number
  name: string
  course: {
    id: number
    name: string
    level: string | null
    subject: string | null
  }
  deliveryMode: TeacherDeliveryMode
  startsOn: string | null
  endsOn: string | null
  activeStudentCount: number
  publishedLessonCount: number
}

export interface PlatformTeacherDashboard {
  teacher: { fullName: string }
  groups: PlatformTeacherGroup[]
}

function invalidResponse(): never {
  throw new ZhangakApiError('Сервис вернул некорректные данные кабинета', 502, 'invalid_response')
}

function nullableText(value: unknown): string | null | undefined {
  return value === null || typeof value === 'string' ? value : undefined
}

function positiveId(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : null
}

function count(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null
}

function dateOnly(value: unknown): string | null | undefined {
  return value === null || (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) ? value : undefined
}

function deliveryMode(value: unknown): TeacherDeliveryMode | null {
  return value === 'offline' ? value : null
}

export function parsePlatformTeacherDashboard(value: unknown): PlatformTeacherDashboard {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalidResponse()
  const payload = value as { teacher?: unknown; groups?: unknown }
  if (!payload.teacher || typeof payload.teacher !== 'object' || Array.isArray(payload.teacher) || !Array.isArray(payload.groups)) {
    return invalidResponse()
  }
  const teacher = payload.teacher as Record<string, unknown>
  if (typeof teacher.fullName !== 'string' || teacher.fullName.trim() === '') return invalidResponse()

  const groups = payload.groups.map(raw => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return invalidResponse()
    const group = raw as Record<string, unknown>
    if (!group.course || typeof group.course !== 'object' || Array.isArray(group.course)) return invalidResponse()
    const course = group.course as Record<string, unknown>
    const groupId = positiveId(group.id)
    const courseId = positiveId(course.id)
    const activeStudentCount = count(group.activeStudentCount)
    const publishedLessonCount = count(group.publishedLessonCount)
    const level = nullableText(course.level)
    const subject = nullableText(course.subject)
    const startsOn = dateOnly(group.startsOn)
    const endsOn = dateOnly(group.endsOn)
    const mode = deliveryMode(group.deliveryMode)
    if (!groupId || !courseId
      || typeof group.name !== 'string' || group.name.trim() === ''
      || typeof course.name !== 'string' || course.name.trim() === ''
      || level === undefined || subject === undefined || startsOn === undefined || endsOn === undefined || mode === null
      || activeStudentCount === null || publishedLessonCount === null) {
      return invalidResponse()
    }
    return {
      id: groupId,
      name: group.name,
      course: { id: courseId, name: course.name, level, subject },
      deliveryMode: mode,
      startsOn,
      endsOn,
      activeStudentCount,
      publishedLessonCount,
    }
  })

  return { teacher: { fullName: teacher.fullName }, groups }
}

/**
 * First-party, read-only teacher entry point. The browser sends only the
 * HttpOnly Zhangak session cookie to the same-origin BFF; no Supabase session
 * or client-side account token is involved.
 */
export async function getPlatformTeacherDashboard(): Promise<PlatformTeacherDashboard> {
  return parsePlatformTeacherDashboard(await zhangakApiRequest<unknown>('/v1/platform/teacher-dashboard'))
}
