'use client'

import {
  getCurrentZhangakUser,
  ZhangakAuthError,
} from './zhangak-auth-client.ts'
import {
  ZhangakApiError,
  zhangakApiRequest,
} from './zhangak-api-client.ts'
import type {
  AttendanceState,
  OfflineLesson,
  OfflineStudentDashboard,
  OfflineStudentGroup,
  OfflineStudentProfile,
} from './offline-student-contract.ts'

export class OfflineStudentRequestError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'OfflineStudentRequestError'
    this.status = status
  }
}

function invalidResponse(): never {
  throw new OfflineStudentRequestError(502, 'Сервис вернул некорректные данные кабинета')
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalidResponse()
  return value as Record<string, unknown>
}

function requiredText(value: unknown): string {
  if (typeof value !== 'string' || value.trim() === '') invalidResponse()
  return value
}

function nullableText(value: unknown): string | null {
  if (value === null) return null
  return requiredText(value)
}

function positiveInteger(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) <= 0) invalidResponse()
  return value as number
}

function nullablePositiveInteger(value: unknown): number | null {
  if (value === null) return null
  return positiveInteger(value)
}

function nullableTargetScore(value: unknown): number | null {
  if (value === null) return null
  if (!Number.isSafeInteger(value) || (value as number) < 0 || (value as number) > 245) invalidResponse()
  return value as number
}

function studentType(value: unknown): OfflineStudentProfile['studentType'] {
  if (value !== 'offline') invalidResponse()
  return value
}

function dateOnly(value: unknown): string | null {
  if (value === null) return null
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) invalidResponse()
  return value
}

function pendingAttendance(value: unknown): AttendanceState {
  // The owned schema deliberately has no attendance table yet.  Accepting
  // only `pending` prevents the retired API from silently reappearing with
  // legacy marks under an otherwise first-party route.
  if (value !== 'pending') invalidResponse()
  return value
}

function topics(value: unknown): string[] {
  if (!Array.isArray(value) || value.some(item => typeof item !== 'string' || item.trim() === '')) invalidResponse()
  if (new Set(value).size !== value.length) invalidResponse()
  return value
}

function profile(value: unknown): OfflineStudentProfile {
  const source = record(value)
  return {
    id: requiredText(source.id),
    fullName: requiredText(source.fullName),
    studentType: studentType(source.studentType),
    targetScore: nullableTargetScore(source.targetScore),
  }
}

function group(value: unknown): OfflineStudentGroup | null {
  if (value === null) return null
  const source = record(value)
  return {
    id: positiveInteger(source.id),
    name: requiredText(source.name),
    courseName: nullableText(source.courseName),
    teacherName: nullableText(source.teacherName),
  }
}

function lesson(value: unknown): OfflineLesson {
  const source = record(value)
  if (typeof source.isTest !== 'boolean') invalidResponse()
  return {
    id: positiveInteger(source.id),
    lessonNumber: positiveInteger(source.lessonNumber),
    title: requiredText(source.title),
    startsAt: dateOnly(source.startsAt),
    durationMinutes: nullablePositiveInteger(source.durationMinutes),
    isTest: source.isTest,
    attendance: pendingAttendance(source.attendance),
    topics: topics(source.topics),
  }
}

/**
 * Strictly parse the limited first-party offline projection.  Homework,
 * grades, attendance and exact timing are purposefully not accepted until
 * they have a dedicated owned-schema migration and audited server contract.
 */
export function parseOfflineStudentDashboard(value: unknown): OfflineStudentDashboard {
  const source = record(value)
  if (!Array.isArray(source.lessons) || !Array.isArray(source.homework) || !Array.isArray(source.grades)) invalidResponse()
  if (source.homework.length !== 0 || source.grades.length !== 0) invalidResponse()
  const parsedProfile = profile(source.profile)
  const progress = record(source.progress)
  const availability = record(source.availability)
  if (progress.latestOrtScore !== null || nullableTargetScore(progress.targetScore) !== parsedProfile.targetScore) invalidResponse()
  if (availability.exactSchedule !== false || availability.materials !== false) invalidResponse()

  const lessons = source.lessons.map(lesson)
  if (new Set(lessons.map(item => item.id)).size !== lessons.length) invalidResponse()

  return {
    profile: parsedProfile,
    group: group(source.group),
    lessons,
    homework: [],
    grades: [],
    progress: { latestOrtScore: null, targetScore: parsedProfile.targetScore },
    availability: { exactSchedule: false, materials: false },
  }
}

async function requestDashboard(): Promise<OfflineStudentDashboard> {
  return parseOfflineStudentDashboard(await zhangakApiRequest<unknown>('/v1/platform/offline-dashboard'))
}

function requestError(error: unknown): OfflineStudentRequestError {
  if (error instanceof OfflineStudentRequestError) return error
  if (error instanceof ZhangakApiError || error instanceof ZhangakAuthError) {
    return new OfflineStudentRequestError(error.status, error.message)
  }
  return new OfflineStudentRequestError(503, 'Не удалось загрузить офлайн-кабинет')
}

export async function fetchOfflineStudentDashboard(): Promise<OfflineStudentDashboard> {
  try {
    return await requestDashboard()
  } catch (error) {
    // /student has no shared StudentLayout, so it refreshes an expired own
    // session once before deciding that the visitor must log in again.
    if (error instanceof ZhangakApiError && error.status === 401) {
      try {
        if (await getCurrentZhangakUser()) return await requestDashboard()
      } catch (refreshError) {
        throw requestError(refreshError)
      }
    }
    throw requestError(error)
  }
}
