'use client'

import { zhangakApiRequest } from './zhangak-api-client.ts'
import { ACCOUNT_ROLES, type AccountRole } from './admin-account-client.ts'

export interface AdminAuditItem {
  id: number
  action: string
  targetType: string
  actorName: string | null
  actorRole: AccountRole | null
  createdAt: string
}

export interface AdminAuditResponse {
  items: AdminAuditItem[]
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

function text(value: unknown, context: string, maxLength: number): string {
  if (typeof value !== 'string' || !value.trim() || value.length > maxLength) invalidResponse(context)
  return value.trim()
}

function positiveInteger(value: unknown, context: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1) invalidResponse(context)
  return value as number
}

function nonNegativeInteger(value: unknown, context: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) invalidResponse(context)
  return value as number
}

function timestamp(value: unknown, context: string): string {
  const result = text(value, context, 40)
  const date = new Date(result)
  if (Number.isNaN(date.getTime()) || date.toISOString() !== result) invalidResponse(context)
  return result
}

function auditItem(value: unknown): AdminAuditItem {
  const source = record(value, 'событие аудита')
  const actorName = source.actorName === null ? null : text(source.actorName, 'имя автора', 200)
  const actorRole = source.actorRole === null ? null : text(source.actorRole, 'роль автора', 40) as AccountRole
  if ((actorName === null) !== (actorRole === null) || (actorRole !== null && !ACCOUNT_ROLES.includes(actorRole))) {
    invalidResponse('автор аудита')
  }
  return {
    id: positiveInteger(source.id, 'id аудита'),
    action: text(source.action, 'действие аудита', 80),
    targetType: text(source.targetType, 'тип цели аудита', 80),
    actorName,
    actorRole,
    createdAt: timestamp(source.createdAt, 'дата аудита'),
  }
}

/** Validates the minimized super-admin audit DTO and rejects malformed rows. */
export function parseAdminAudit(value: unknown): AdminAuditResponse {
  const source = record(value, 'журнал аудита')
  if (!Array.isArray(source.items)) invalidResponse('список аудита')
  const items = source.items.map(auditItem)
  if (new Set(items.map(item => item.id)).size !== items.length) invalidResponse('повторяющиеся события аудита')
  const total = nonNegativeInteger(source.total, 'всего событий аудита')
  const limit = positiveInteger(source.limit, 'лимит аудита')
  const offset = nonNegativeInteger(source.offset, 'смещение аудита')
  if (items.length > limit || total < items.length || offset > total) invalidResponse('пагинация аудита')
  return { items, total, limit, offset }
}

/** Super-admin-only, cookie-authenticated audit feed. */
export async function getAdminAudit(limit = 50): Promise<AdminAuditResponse> {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new Error('Некорректный лимит журнала')
  return parseAdminAudit(await zhangakApiRequest<unknown>(`/v1/admin/audit?limit=${limit}`))
}
