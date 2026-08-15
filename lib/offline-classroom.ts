'use client'

import { ZhangakApiError, zhangakApiJson, zhangakApiRequest } from './zhangak-api-client.ts'

export type OfflineAttendance = 'present' | 'late' | 'absent'
export type OfflineCommentVisibility = 'student' | 'internal'

export interface OfflineTeacherWorkspace {
  group: { id: number; name: string; courseName: string }
  students: { id: string; fullName: string }[]
  lessons: { id: number; lessonNumber: number; title: string }[]
  sessions: { id: number; lessonId: number; lessonTitle: string; startsAt: string; endsAt: string | null; room: string | null; status: 'scheduled' | 'completed' | 'cancelled' }[]
  homework: { id: number; title: string; dueAt: string | null; published: boolean }[]
}

function invalidResponse(): never {
  throw new ZhangakApiError('Сервис вернул некорректные данные журнала', 502, 'invalid_offline_classroom_response')
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalidResponse()
  return value as Record<string, unknown>
}

function id(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) return invalidResponse()
  return value
}

function text(value: unknown, nullable = false): string | null {
  if (nullable && value === null) return null
  if (typeof value !== 'string' || value.trim() === '') return invalidResponse()
  return value
}

function dateTime(value: unknown, nullable = false): string | null {
  if (nullable && value === null) return null
  if (typeof value !== 'string' || !Number.isFinite(new Date(value).getTime())) return invalidResponse()
  return value
}

function unique<T>(items: T[], key: (item: T) => string | number): T[] {
  if (new Set(items.map(key)).size !== items.length) return invalidResponse()
  return items
}

export function parseOfflineTeacherWorkspace(value: unknown): OfflineTeacherWorkspace {
  const payload = record(value)
  if (!Array.isArray(payload.students) || !Array.isArray(payload.lessons) || !Array.isArray(payload.sessions) || !Array.isArray(payload.homework)) return invalidResponse()
  const groupRaw = record(payload.group)
  const group = { id: id(groupRaw.id), name: text(groupRaw.name) as string, courseName: text(groupRaw.courseName) as string }
  const students = unique(payload.students.map(value => {
    const row = record(value)
    if (typeof row.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(row.id)) return invalidResponse()
    return { id: row.id, fullName: text(row.fullName) as string }
  }), item => item.id)
  const lessons = unique(payload.lessons.map(value => {
    const row = record(value)
    return { id: id(row.id), lessonNumber: id(row.lessonNumber), title: text(row.title) as string }
  }), item => item.id)
  const sessions = unique(payload.sessions.map(value => {
    const row = record(value)
    if (row.status !== 'scheduled' && row.status !== 'completed' && row.status !== 'cancelled') return invalidResponse()
    const status: OfflineTeacherWorkspace['sessions'][number]['status'] = row.status
    return {
      id: id(row.id), lessonId: id(row.lessonId), lessonTitle: text(row.lessonTitle) as string,
      startsAt: dateTime(row.startsAt) as string, endsAt: dateTime(row.endsAt, true), room: text(row.room, true), status,
    }
  }), item => item.id)
  const homework = unique(payload.homework.map(value => {
    const row = record(value)
    if (typeof row.published !== 'boolean') return invalidResponse()
    return { id: id(row.id), title: text(row.title) as string, dueAt: dateTime(row.dueAt, true), published: row.published }
  }), item => item.id)
  return { group, students, lessons, sessions, homework }
}

export function getOfflineTeacherWorkspace(groupId: number): Promise<OfflineTeacherWorkspace> {
  return zhangakApiRequest<unknown>(`/v1/platform/offline/teacher/groups/${groupId}`).then(parseOfflineTeacherWorkspace)
}

export function createOfflineSession(groupId: number, value: { lessonId: number; startsAt: string; endsAt?: string | null; room?: string | null }) {
  return zhangakApiJson(`/v1/platform/offline/groups/${groupId}/sessions`, 'POST', value)
}

export function recordOfflineAttendance(groupId: number, sessionId: number, entries: { studentId: string; status: OfflineAttendance; note?: string | null }[]) {
  return zhangakApiJson(`/v1/platform/offline/groups/${groupId}/sessions/${sessionId}/attendance`, 'POST', { entries })
}

export function createOfflineHomework(groupId: number, value: { lessonId?: number | null; title: string; body?: string | null; dueAt?: string | null }) {
  return zhangakApiJson(`/v1/platform/offline/groups/${groupId}/homework`, 'POST', value)
}

export function recordOfflineGrade(groupId: number, value: { studentId: string; gradeType: 'lesson' | 'homework' | 'manual'; sessionId?: number | null; homeworkId?: number | null; title: string; score: number; publish: boolean }) {
  return zhangakApiJson(`/v1/platform/offline/groups/${groupId}/grades`, 'POST', value)
}

export function createOfflineComment(groupId: number, value: { studentId: string; visibility: OfflineCommentVisibility; body: string; sessionId?: number | null; homeworkId?: number | null; gradeId?: number | null }) {
  return zhangakApiJson(`/v1/platform/offline/groups/${groupId}/comments`, 'POST', value)
}

export function submitOfflineHomework(homeworkId: number, body: string) {
  return zhangakApiJson(`/v1/platform/offline/homework/${homeworkId}/submission`, 'POST', { body })
}
