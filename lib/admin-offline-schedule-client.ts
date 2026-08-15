'use client'

import { zhangakApiJson, zhangakApiRequest } from './zhangak-api-client.ts'

export interface AdminOfflineScheduleLesson {
  id: number
  lessonNumber: number
  title: string
}

export interface AdminOfflineScheduleSession {
  id: number
  lessonId: number
  lessonTitle: string
  startsAt: string
  endsAt: string | null
  room: string | null
  status: 'scheduled' | 'completed' | 'cancelled'
}

export interface AdminOfflineAnnouncement {
  id: number
  title: string
  body: string
  published: boolean
  publishedAt: string | null
  createdAt: string
}

export interface AdminOfflineScheduleWorkspace {
  group: { id: number; name: string; courseName: string }
  lessons: AdminOfflineScheduleLesson[]
  sessions: AdminOfflineScheduleSession[]
  announcements: AdminOfflineAnnouncement[]
}

function invalidResponse(): never { throw new Error('Сервис вернул некорректные данные расписания') }
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalidResponse()
  return value as Record<string, unknown>
}
function id(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1) invalidResponse()
  return value as number
}
function text(value: unknown, nullable = false): string | null {
  if (nullable && value === null) return null
  if (typeof value !== 'string' || !value.trim()) invalidResponse()
  return value
}
function timestamp(value: unknown, nullable = false): string | null {
  if (nullable && value === null) return null
  if (typeof value !== 'string' || !Number.isFinite(new Date(value).getTime())) invalidResponse()
  return value
}
function unique<T>(items: T[], key: (item: T) => number): T[] {
  if (new Set(items.map(key)).size !== items.length) invalidResponse()
  return items
}
function groupPath(value: number): string {
  if (!Number.isSafeInteger(value) || value < 1) throw new Error('Некорректный id группы')
  return String(value)
}

export function parseAdminOfflineScheduleWorkspace(value: unknown): AdminOfflineScheduleWorkspace {
  const source = record(value)
  if (!Array.isArray(source.lessons) || !Array.isArray(source.sessions) || !Array.isArray(source.announcements)) invalidResponse()
  const groupRaw = record(source.group)
  const group = { id: id(groupRaw.id), name: text(groupRaw.name) as string, courseName: text(groupRaw.courseName) as string }
  const lessons = unique(source.lessons.map(raw => {
    const row = record(raw)
    return { id: id(row.id), lessonNumber: id(row.lessonNumber), title: text(row.title) as string }
  }), item => item.id)
  const sessions = unique(source.sessions.map(raw => {
    const row = record(raw)
    if (row.status !== 'scheduled' && row.status !== 'completed' && row.status !== 'cancelled') invalidResponse()
    const status = row.status as AdminOfflineScheduleSession['status']
    return {
      id: id(row.id), lessonId: id(row.lessonId), lessonTitle: text(row.lessonTitle) as string,
      startsAt: timestamp(row.startsAt) as string, endsAt: timestamp(row.endsAt, true), room: text(row.room, true), status,
    }
  }), item => item.id)
  const announcements = unique(source.announcements.map(raw => {
    const row = record(raw)
    if (typeof row.published !== 'boolean') invalidResponse()
    return {
      id: id(row.id), title: text(row.title) as string, body: text(row.body) as string, published: row.published,
      publishedAt: timestamp(row.publishedAt, true), createdAt: timestamp(row.createdAt) as string,
    }
  }), item => item.id)
  return { group, lessons, sessions, announcements }
}

export function getAdminOfflineSchedule(groupId: number): Promise<AdminOfflineScheduleWorkspace> {
  return zhangakApiRequest<unknown>(`/v1/admin/offline/groups/${groupPath(groupId)}/schedule`).then(parseAdminOfflineScheduleWorkspace)
}

export async function createAdminOfflineSession(groupId: number, value: { lessonId: number; startsAt: string; endsAt?: string | null; room?: string | null }): Promise<AdminOfflineScheduleSession> {
  const result = record(await zhangakApiJson<unknown>(`/v1/admin/offline/groups/${groupPath(groupId)}/sessions`, 'POST', value))
  const workspace = parseAdminOfflineScheduleWorkspace({ group: { id: groupId, name: 'Группа', courseName: 'Курс' }, lessons: [], sessions: [result.session], announcements: [] })
  return workspace.sessions[0]
}

export async function createAdminOfflineAnnouncement(groupId: number, value: { title: string; body: string; publish?: boolean }): Promise<AdminOfflineAnnouncement> {
  const result = record(await zhangakApiJson<unknown>(`/v1/admin/offline/groups/${groupPath(groupId)}/announcements`, 'POST', value))
  const raw = record(result.announcement)
  return {
    id: id(raw.id), title: text(raw.title) as string, body: text(raw.body) as string,
    published: raw.published === true, publishedAt: timestamp(raw.publishedAt, true), createdAt: timestamp(raw.createdAt) as string,
  }
}
