'use client'

import { zhangakApiJson, zhangakApiRequest } from './zhangak-api-client.ts'

export type OnlineAccessPlan = 'one_month' | 'three_months' | 'one_year'
export type OnlineAccessState = 'active' | 'frozen' | 'expired' | 'pending' | 'none'

export interface MonitoredStudent {
  id: string
  fullName: string
  email: string
  blocked: boolean
  studentType: 'online' | 'offline'
  phone: string | null
  createdAt: string
  lastSeenAt: string | null
  metrics: { xp: number; level: number; visits30d: number; lessonsCompleted: number; practiceSubmitted: number; trainerMastered: number; dailyChallenges: number; questsClaimed: number }
  access: null | { enrollmentId: number; state: OnlineAccessState; status: string; plan: OnlineAccessPlan | null; courseName: string; startedAt: string | null; expiresAt: string | null; frozenAt: string | null; freezeReason: string | null }
}

function invalid(context: string): never { throw new Error(`Некорректный ответ сервиса: ${context}`) }
function object(value: unknown, context: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid(context)
  return value as Record<string, unknown>
}
function string(value: unknown, context: string): string { if (typeof value !== 'string' || !value.trim()) invalid(context); return value.trim() }
function nullableString(value: unknown, context: string): string | null { return value == null ? null : string(value, context) }
function integer(value: unknown, context: string): number { if (!Number.isSafeInteger(value) || (value as number) < 0) invalid(context); return value as number }
function timestamp(value: unknown, context: string): string { const result = string(value, context); if (Number.isNaN(Date.parse(result))) invalid(context); return result }
function nullableTimestamp(value: unknown, context: string): string | null { return value == null ? null : timestamp(value, context) }

function parseStudent(value: unknown): MonitoredStudent {
  const source = object(value, 'ученик')
  const metrics = object(source.metrics, 'метрики')
  const studentType = string(source.studentType, 'тип ученика')
  if (!['online', 'offline'].includes(studentType)) invalid('тип ученика')
  let access: MonitoredStudent['access'] = null
  if (source.access != null) {
    const item = object(source.access, 'доступ')
    const state = string(item.state, 'состояние доступа') as OnlineAccessState
    if (!['active', 'frozen', 'expired', 'pending', 'none'].includes(state)) invalid('состояние доступа')
    const plan = item.plan == null ? null : string(item.plan, 'план') as OnlineAccessPlan
    if (plan && !['one_month', 'three_months', 'one_year'].includes(plan)) invalid('план')
    access = {
      enrollmentId: integer(item.enrollmentId, 'id зачисления'), state, status: string(item.status, 'статус'), plan,
      courseName: string(item.courseName, 'курс'), startedAt: nullableTimestamp(item.startedAt, 'начало'), expiresAt: nullableTimestamp(item.expiresAt, 'окончание'),
      frozenAt: nullableTimestamp(item.frozenAt, 'заморозка'), freezeReason: nullableString(item.freezeReason, 'причина'),
    }
  }
  return {
    id: string(source.id, 'id'), fullName: string(source.fullName, 'имя'), email: string(source.email, 'email'), blocked: source.blocked === true,
    studentType: studentType as MonitoredStudent['studentType'], phone: nullableString(source.phone, 'телефон'), createdAt: timestamp(source.createdAt, 'дата создания'),
    lastSeenAt: nullableTimestamp(source.lastSeenAt, 'последний вход'),
    metrics: {
      xp: integer(metrics.xp, 'XP'), level: integer(metrics.level, 'уровень'), visits30d: integer(metrics.visits30d, 'визиты'),
      lessonsCompleted: integer(metrics.lessonsCompleted, 'уроки'), practiceSubmitted: integer(metrics.practiceSubmitted, 'тесты'),
      trainerMastered: integer(metrics.trainerMastered, 'тренажёр'), dailyChallenges: integer(metrics.dailyChallenges, 'задания дня'), questsClaimed: integer(metrics.questsClaimed, 'квесты'),
    }, access,
  }
}

export function parseStudentMonitoring(value: unknown): { items: MonitoredStudent[]; total: number } {
  const source = object(value, 'мониторинг')
  if (!Array.isArray(source.items)) invalid('список учеников')
  return { items: source.items.map(parseStudent), total: integer(source.total, 'всего') }
}

export async function getStudentMonitoring(filters: { q?: string; accessState?: OnlineAccessState | '' } = {}): Promise<{ items: MonitoredStudent[]; total: number }> {
  const params = new URLSearchParams({ limit: '100' })
  if (filters.q?.trim()) params.set('q', filters.q.trim())
  if (filters.accessState) params.set('accessState', filters.accessState)
  return parseStudentMonitoring(await zhangakApiRequest<unknown>(`/v1/admin/student-monitoring?${params}`))
}

export async function changeStudentAccess(enrollmentId: number, input: { action: 'extend'; accessPlan: OnlineAccessPlan } | { action: 'freeze'; reason?: string } | { action: 'resume' }): Promise<void> {
  await zhangakApiJson(`/v1/admin/enrollments/${enrollmentId}/access`, 'PATCH', input)
}
