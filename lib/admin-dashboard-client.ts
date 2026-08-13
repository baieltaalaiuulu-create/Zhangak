'use client'

import { zhangakApiRequest } from './zhangak-api-client.ts'

export type AdminDashboardAttemptType = 'practice' | 'mock' | 'bank' | 'diagnostic'
export type AdminDashboardAuditAction =
  | 'create_user'
  | 'block_user'
  | 'unblock_user'
  | 'reset_user_password'
  | 'delete_user'
  | 'create_course'
  | 'update_course'
  | 'create_lesson'
  | 'update_lesson'

export interface AdminDashboardMetrics {
  totalStudents: number
  newStudentsLast7Days: number
  lessonCount: number
  newLessonsLast7Days: number
  submittedAttemptCount: number
  submittedAttemptCountToday: number
}

export interface AdminDashboardAttempt {
  id: string
  studentName: string
  testTitle: string
  testType: AdminDashboardAttemptType
  scorePercent: number
  completedAt: string
}

export interface AdminDashboardAudit {
  id: number
  action: AdminDashboardAuditAction
  targetType: 'user' | 'course' | 'lesson'
  createdAt: string
}

export interface AdminDashboard {
  metrics: AdminDashboardMetrics
  availability: {
    dailyActiveStudents: false
    payments: false
  }
  recentAttempts: AdminDashboardAttempt[]
  recentChanges: AdminDashboardAudit[]
}

const ATTEMPT_TYPES = new Set<AdminDashboardAttemptType>(['practice', 'mock', 'bank', 'diagnostic'])
const AUDIT_TARGETS: Readonly<Record<AdminDashboardAuditAction, AdminDashboardAudit['targetType']>> = {
  create_user: 'user',
  block_user: 'user',
  unblock_user: 'user',
  reset_user_password: 'user',
  delete_user: 'user',
  create_course: 'course',
  update_course: 'course',
  create_lesson: 'lesson',
  update_lesson: 'lesson',
}

function invalidResponse(context: string): never {
  throw new Error(`Некорректный ответ сервиса: ${context}`)
}

function record(value: unknown, context: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalidResponse(context)
  return value as Record<string, unknown>
}

function text(value: unknown, context: string, maxLength = 500): string {
  if (typeof value !== 'string' || !value.trim() || value.length > maxLength) invalidResponse(context)
  return value.trim()
}

function nonNegativeInteger(value: unknown, context: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) invalidResponse(context)
  return value as number
}

function positiveInteger(value: unknown, context: string): number {
  const result = nonNegativeInteger(value, context)
  if (result < 1) invalidResponse(context)
  return result
}

function canonicalTimestamp(value: unknown, context: string): string {
  const result = text(value, context, 40)
  const date = new Date(result)
  if (Number.isNaN(date.getTime()) || date.toISOString() !== result) invalidResponse(context)
  return result
}

function uuid(value: unknown, context: string): string {
  const result = text(value, context, 36)
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(result)) invalidResponse(context)
  return result
}

function dashboardMetrics(value: unknown): AdminDashboardMetrics {
  const source = record(value, 'метрики')
  return {
    totalStudents: nonNegativeInteger(source.totalStudents, 'всего учеников'),
    newStudentsLast7Days: nonNegativeInteger(source.newStudentsLast7Days, 'новые ученики'),
    lessonCount: nonNegativeInteger(source.lessonCount, 'уроки'),
    newLessonsLast7Days: nonNegativeInteger(source.newLessonsLast7Days, 'новые уроки'),
    submittedAttemptCount: nonNegativeInteger(source.submittedAttemptCount, 'сданные попытки'),
    submittedAttemptCountToday: nonNegativeInteger(source.submittedAttemptCountToday, 'сданные попытки сегодня'),
  }
}

function dashboardAttempt(value: unknown): AdminDashboardAttempt {
  const source = record(value, 'попытка')
  const testType = text(source.testType, 'тип попытки', 32)
  if (!ATTEMPT_TYPES.has(testType as AdminDashboardAttemptType)) invalidResponse('тип попытки')
  const scorePercent = nonNegativeInteger(source.scorePercent, 'процент попытки')
  if (scorePercent > 100) invalidResponse('процент попытки')
  return {
    id: uuid(source.id, 'id попытки'),
    studentName: text(source.studentName, 'имя ученика', 200),
    testTitle: text(source.testTitle, 'название попытки', 500),
    testType: testType as AdminDashboardAttemptType,
    scorePercent,
    completedAt: canonicalTimestamp(source.completedAt, 'дата попытки'),
  }
}

function dashboardAudit(value: unknown): AdminDashboardAudit {
  const source = record(value, 'изменение')
  const action = text(source.action, 'действие', 80) as AdminDashboardAuditAction
  const targetType = text(source.targetType, 'тип цели', 80)
  if (!Object.hasOwn(AUDIT_TARGETS, action) || AUDIT_TARGETS[action] !== targetType) invalidResponse('действие')
  return {
    id: positiveInteger(source.id, 'id изменения'),
    action,
    targetType: targetType as AdminDashboardAudit['targetType'],
    createdAt: canonicalTimestamp(source.createdAt, 'дата изменения'),
  }
}

/**
 * The dashboard DTO intentionally has no daily-active-user or payment value:
 * those domains are not recorded by the first-party schema yet.  The two
 * false flags must stay explicit so a UI cannot silently turn unavailable
 * data into a fabricated zero.
 */
export function parseAdminDashboard(value: unknown): AdminDashboard {
  const source = record(value, 'панель администратора')
  const availability = record(source.availability, 'доступность метрик')
  if (availability.dailyActiveStudents !== false || availability.payments !== false
    || Object.keys(availability).length !== 2) {
    invalidResponse('доступность метрик')
  }
  if (!Array.isArray(source.recentAttempts) || !Array.isArray(source.recentChanges)) {
    invalidResponse('списки панели администратора')
  }
  const recentAttempts = source.recentAttempts.map(dashboardAttempt)
  const recentChanges = source.recentChanges.map(dashboardAudit)
  if (new Set(recentAttempts.map(attempt => attempt.id)).size !== recentAttempts.length) invalidResponse('повторяющиеся попытки')
  if (new Set(recentChanges.map(change => change.id)).size !== recentChanges.length) invalidResponse('повторяющиеся изменения')
  return {
    metrics: dashboardMetrics(source.metrics),
    availability: { dailyActiveStudents: false, payments: false },
    recentAttempts,
    recentChanges,
  }
}

/** Cookie-authenticated browser entry point for the mounted admin overview. */
export async function getAdminDashboard(): Promise<AdminDashboard> {
  return parseAdminDashboard(await zhangakApiRequest<unknown>('/v1/admin/dashboard'))
}
