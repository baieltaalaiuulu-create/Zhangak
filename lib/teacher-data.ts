'use client'

import { authenticatedFetch } from '@/lib/authenticated-fetch'
import type {
  AttendanceEntry,
  GradeEntry,
  TeacherGroupSummary,
  TeacherGroupWorkspace,
} from '@/lib/teacher-contract'

export class TeacherRequestError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message)
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await authenticatedFetch(url, {
    ...init,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...init?.headers },
  })
  const body = await response.json().catch(() => null) as ({ error?: unknown } & T) | null
  if (!response.ok) {
    throw new TeacherRequestError(response.status, body && typeof body.error === 'string' ? body.error : 'Не удалось выполнить запрос')
  }
  if (!body) throw new TeacherRequestError(503, 'Сервис вернул пустой ответ')
  return body
}

export async function fetchTeacherGroups(): Promise<TeacherGroupSummary[]> {
  const body = await request<{ groups?: unknown }>('/api/teacher')
  if (!Array.isArray(body.groups)) throw new TeacherRequestError(503, 'Сервис вернул некорректный список групп')
  return body.groups as TeacherGroupSummary[]
}

export async function fetchTeacherWorkspace(groupId: number): Promise<TeacherGroupWorkspace> {
  return request<TeacherGroupWorkspace>(`/api/teacher?groupId=${encodeURIComponent(groupId)}`)
}

export async function saveTeacherAttendance(groupId: number, lessonId: number, entries: AttendanceEntry[]): Promise<void> {
  await request<{ success: true }>('/api/teacher', {
    method: 'PATCH',
    body: JSON.stringify({ operation: 'attendance', groupId, lessonId, entries }),
  })
}

export async function saveTeacherGrades(groupId: number, lessonId: number, entries: GradeEntry[]): Promise<void> {
  await request<{ success: true }>('/api/teacher', {
    method: 'PATCH',
    body: JSON.stringify({ operation: 'grades', groupId, lessonId, entries }),
  })
}

export async function createTeacherHomework(input: {
  groupId: number
  lessonId: number
  title: string
  description: string | null
  dueAt: string | null
}): Promise<void> {
  await request<{ id: number }>('/api/teacher', { method: 'POST', body: JSON.stringify(input) })
}
