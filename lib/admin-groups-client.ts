'use client'

import { zhangakApiJson, zhangakApiRequest } from './zhangak-api-client.ts'

export type AdminGroupDeliveryMode = 'online' | 'offline' | 'hybrid'
export type AdminGroupStudentType = 'online' | 'offline' | 'both'

export interface AdminGroupCourse {
  id: number
  name: string
  code: string | null
  level: string | null
  subject: string | null
}

export interface AdminGroupTeacher {
  id: string
  fullName: string
}

export interface AdminGroup {
  id: number
  course: AdminGroupCourse
  teacher: AdminGroupTeacher | null
  name: string
  deliveryMode: AdminGroupDeliveryMode
  capacity: number | null
  startsOn: string | null
  endsOn: string | null
  isActive: boolean
  activeStudentCount: number
  createdAt: string
  updatedAt: string
}

export interface AdminGroupMember {
  membershipId: number
  id: string
  fullName: string
  email: string
  studentType: AdminGroupStudentType
  joinedAt: string
}

export interface AdminGroupAssignee {
  id: string
  fullName: string
  email: string
  studentType?: AdminGroupStudentType
}

export interface AdminGroupInput {
  courseId: number
  name: string
  deliveryMode?: AdminGroupDeliveryMode
  capacity?: number | null
  startsOn?: string | null
  endsOn?: string | null
  isActive?: boolean
}

export interface AdminGroupPatch {
  name?: string
  deliveryMode?: AdminGroupDeliveryMode
  capacity?: number | null
  startsOn?: string | null
  endsOn?: string | null
  isActive?: boolean
}

export interface AdminGroupList {
  items: AdminGroup[]
  total: number
  limit: number
  offset: number
}

export interface AdminGroupMemberList {
  group: AdminGroup
  items: AdminGroupMember[]
  total: number
  limit: number
  offset: number
}

export interface AdminGroupAssigneeList {
  items: AdminGroupAssignee[]
  total: number
  limit: number
  offset: number
}

function invalidResponse(context: string): never {
  throw new Error(`Некорректный ответ сервиса: ${context}`)
}

function record(value: unknown, context: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalidResponse(context)
  return value as Record<string, unknown>
}

function text(value: unknown, context: string): string {
  if (typeof value !== 'string' || value.trim() === '') invalidResponse(context)
  return value
}

function nullableText(value: unknown, context: string): string | null {
  return value === null ? null : text(value, context)
}

function positiveId(value: unknown, context: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1) invalidResponse(context)
  return value as number
}

function count(value: unknown, context: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) invalidResponse(context)
  return value as number
}

function boolean(value: unknown, context: string): boolean {
  if (typeof value !== 'boolean') invalidResponse(context)
  return value
}

function uuid(value: unknown, context: string): string {
  const valueText = text(value, context)
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(valueText)) invalidResponse(context)
  return valueText
}

function timestamp(value: unknown, context: string): string {
  const valueText = text(value, context)
  if (Number.isNaN(new Date(valueText).getTime())) invalidResponse(context)
  return valueText
}

function nullableDate(value: unknown, context: string): string | null {
  const valueText = nullableText(value, context)
  if (valueText !== null && !/^\d{4}-\d{2}-\d{2}$/.test(valueText)) invalidResponse(context)
  return valueText
}

function deliveryMode(value: unknown, context: string): AdminGroupDeliveryMode {
  if (value !== 'online' && value !== 'offline' && value !== 'hybrid') invalidResponse(context)
  return value
}

function studentType(value: unknown, context: string): AdminGroupStudentType {
  if (value !== 'online' && value !== 'offline' && value !== 'both') invalidResponse(context)
  return value
}

export function parseAdminGroup(value: unknown): AdminGroup {
  const source = record(value, 'группа')
  const course = record(source.course, 'курс группы')
  const teacherSource = source.teacher === null ? null : record(source.teacher, 'преподаватель группы')
  const capacity = source.capacity === null ? null : positiveId(source.capacity, 'вместимость группы')
  if (capacity !== null && capacity > 5_000) invalidResponse('вместимость группы')
  return {
    id: positiveId(source.id, 'id группы'),
    course: {
      id: positiveId(course.id, 'id курса группы'),
      name: text(course.name, 'название курса группы'),
      code: nullableText(course.code, 'код курса группы'),
      level: nullableText(course.level, 'уровень курса группы'),
      subject: nullableText(course.subject, 'предмет курса группы'),
    },
    teacher: teacherSource === null ? null : {
      id: uuid(teacherSource.id, 'id преподавателя группы'),
      fullName: text(teacherSource.fullName, 'имя преподавателя группы'),
    },
    name: text(source.name, 'название группы'),
    deliveryMode: deliveryMode(source.deliveryMode, 'формат группы'),
    capacity,
    startsOn: nullableDate(source.startsOn, 'дата начала группы'),
    endsOn: nullableDate(source.endsOn, 'дата окончания группы'),
    isActive: boolean(source.isActive, 'статус группы'),
    activeStudentCount: count(source.activeStudentCount, 'число учеников группы'),
    createdAt: timestamp(source.createdAt, 'дата создания группы'),
    updatedAt: timestamp(source.updatedAt, 'дата обновления группы'),
  }
}

export function parseAdminGroupMember(value: unknown): AdminGroupMember {
  const source = record(value, 'участник группы')
  return {
    membershipId: positiveId(source.membershipId, 'id назначения'),
    id: uuid(source.id, 'id ученика'),
    fullName: text(source.fullName, 'имя ученика'),
    email: text(source.email, 'email ученика'),
    studentType: studentType(source.studentType, 'тип обучения ученика'),
    joinedAt: timestamp(source.joinedAt, 'дата добавления ученика'),
  }
}

function parsePage(value: unknown, context: string): { items: unknown[]; total: number; limit: number; offset: number } {
  const source = record(value, context)
  if (!Array.isArray(source.items)) invalidResponse(context)
  return {
    items: source.items,
    total: count(source.total, `всего: ${context}`),
    limit: positiveId(source.limit, `лимит: ${context}`),
    offset: count(source.offset, `смещение: ${context}`),
  }
}

export function parseAdminGroupList(value: unknown): AdminGroupList {
  const page = parsePage(value, 'список групп')
  const items = page.items.map(parseAdminGroup)
  if (new Set(items.map(group => group.id)).size !== items.length) invalidResponse('повторяющиеся группы')
  return { ...page, items }
}

export function parseAdminGroupMemberList(value: unknown): AdminGroupMemberList {
  const source = record(value, 'ученики группы')
  const page = parsePage(source, 'ученики группы')
  const items = page.items.map(parseAdminGroupMember)
  if (new Set(items.map(member => member.id)).size !== items.length) invalidResponse('повторяющиеся ученики группы')
  return { group: parseAdminGroup(source.group), ...page, items }
}

export function parseAdminGroupAssigneeList(value: unknown, kind: 'teacher' | 'student'): AdminGroupAssigneeList {
  const page = parsePage(value, 'список назначений')
  const items = page.items.map(raw => {
    const source = record(raw, 'кандидат назначения')
    const parsed: AdminGroupAssignee = {
      id: uuid(source.id, 'id кандидата назначения'),
      fullName: text(source.fullName, 'имя кандидата назначения'),
      email: text(source.email, 'email кандидата назначения'),
    }
    if (kind === 'student') parsed.studentType = studentType(source.studentType, 'тип обучения кандидата')
    else if (Object.hasOwn(source, 'studentType')) invalidResponse('преподаватель не должен содержать тип обучения ученика')
    return parsed
  })
  if (new Set(items.map(item => item.id)).size !== items.length) invalidResponse('повторяющиеся кандидаты назначения')
  return { ...page, items }
}

function groupPath(id: number): string {
  if (!Number.isSafeInteger(id) || id < 1) throw new Error('Некорректный id группы')
  return String(id)
}

function accountPath(id: string): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    throw new Error('Некорректный id пользователя')
  }
  return id
}

export async function listAdminGroups(options: {
  query?: string
  courseId?: number
  isActive?: boolean
  limit?: number
  offset?: number
} = {}): Promise<AdminGroupList> {
  const params = new URLSearchParams()
  if (options.query?.trim()) params.set('q', options.query.trim())
  if (options.courseId != null) params.set('courseId', groupPath(options.courseId))
  if (options.isActive != null) params.set('isActive', String(options.isActive))
  if (options.limit != null) params.set('limit', String(options.limit))
  if (options.offset != null) params.set('offset', String(options.offset))
  const suffix = params.size > 0 ? `?${params.toString()}` : ''
  return parseAdminGroupList(await zhangakApiRequest<unknown>(`/v1/admin/groups${suffix}`))
}

export async function createAdminGroup(input: AdminGroupInput): Promise<AdminGroup> {
  const result = await zhangakApiJson<unknown>('/v1/admin/groups', 'POST', input)
  return parseAdminGroup(record(result, 'созданная группа').group)
}

export async function updateAdminGroup(groupId: number, input: AdminGroupPatch): Promise<AdminGroup> {
  const result = await zhangakApiJson<unknown>(`/v1/admin/groups/${groupPath(groupId)}`, 'PATCH', input)
  return parseAdminGroup(record(result, 'обновлённая группа').group)
}

export async function listAdminGroupMembers(groupId: number, options: { limit?: number; offset?: number } = {}): Promise<AdminGroupMemberList> {
  const params = new URLSearchParams()
  if (options.limit != null) params.set('limit', String(options.limit))
  if (options.offset != null) params.set('offset', String(options.offset))
  const suffix = params.size > 0 ? `?${params.toString()}` : ''
  return parseAdminGroupMemberList(await zhangakApiRequest<unknown>(`/v1/admin/groups/${groupPath(groupId)}/members${suffix}`))
}

export async function listAdminGroupAssignees(kind: 'teacher' | 'student', options: { query?: string; limit?: number; offset?: number } = {}): Promise<AdminGroupAssigneeList> {
  const params = new URLSearchParams({ kind })
  if (options.query?.trim()) params.set('q', options.query.trim())
  if (options.limit != null) params.set('limit', String(options.limit))
  if (options.offset != null) params.set('offset', String(options.offset))
  return parseAdminGroupAssigneeList(await zhangakApiRequest<unknown>(`/v1/admin/group-assignees?${params.toString()}`), kind)
}

export async function setAdminGroupTeacher(groupId: number, teacherId: string | null): Promise<AdminGroup> {
  const result = await zhangakApiJson<unknown>(`/v1/admin/groups/${groupPath(groupId)}/teacher`, 'PATCH', {
    teacherId: teacherId === null ? null : accountPath(teacherId),
  })
  return parseAdminGroup(record(result, 'назначенный преподаватель').group)
}

export async function addAdminGroupStudent(groupId: number, studentId: string): Promise<AdminGroupMember> {
  const result = await zhangakApiJson<unknown>(`/v1/admin/groups/${groupPath(groupId)}/students`, 'POST', {
    studentId: accountPath(studentId),
  })
  return parseAdminGroupMember(record(result, 'назначенный ученик').member)
}

export async function removeAdminGroupStudent(groupId: number, studentId: string): Promise<void> {
  await zhangakApiJson<{ success: true }>(`/v1/admin/groups/${groupPath(groupId)}/students/${accountPath(studentId)}`, 'DELETE')
}
