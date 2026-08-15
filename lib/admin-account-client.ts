'use client'

import { zhangakApiJson, zhangakApiRequest } from './zhangak-api-client.ts'

export const ACCOUNT_ROLES = [
  'student',
  'teacher',
  'manager',
  'director',
  'finance',
  'admin_jr',
  'admin',
  'super_admin',
  'math_student',
  'math_parent',
  'math_admin',
] as const

export type AccountRole = (typeof ACCOUNT_ROLES)[number]

export interface AdminAccount {
  id: string
  email: string
  blocked: boolean
  fullName: string
  role: AccountRole
  studentType: string | null
  phone: string | null
  targetScore: number | null
  avatarUrl: string | null
  createdAt: string
}

interface AdminAccountsResponse {
  items: AdminAccount[]
  total: number
  limit: number
  offset: number
}

export interface ListAdminAccountsOptions {
  query?: string
  limit?: number
  offset?: number
}

export interface CreateAdminAccountPayload {
  email: string
  password: string
  fullName: string
  role: AccountRole
  studentType?: 'online' | 'offline'
  phone?: string
  targetScore?: number
}

export interface ChangeAdminAccountRolePayload {
  role: AccountRole
  studentType?: 'online' | 'offline'
}

export const ACCOUNT_ROLE_LABELS: Record<AccountRole, string> = {
  student: 'Ученик',
  teacher: 'Преподаватель',
  manager: 'Менеджер',
  director: 'Директор',
  finance: 'Финансы',
  admin_jr: 'Младший администратор',
  admin: 'Администратор',
  super_admin: 'Супер-администратор',
  math_student: 'Ученик математики',
  math_parent: 'Родитель',
  math_admin: 'Администратор математики',
}

function accountIdPath(id: string): string {
  return encodeURIComponent(id)
}

/**
 * Lists exactly the accounts visible to the currently authenticated operator.
 * Authorization remains enforced by the first-party API; this client only
 * transports HttpOnly-cookie requests through the /v1/admin BFF namespace.
 */
export async function listAdminAccounts(options: ListAdminAccountsOptions = {}): Promise<AdminAccountsResponse> {
  const params = new URLSearchParams()
  if (options.query?.trim()) params.set('q', options.query.trim())
  if (options.limit != null) params.set('limit', String(options.limit))
  if (options.offset != null) params.set('offset', String(options.offset))
  const suffix = params.size > 0 ? `?${params.toString()}` : ''
  return zhangakApiRequest<AdminAccountsResponse>(`/v1/admin/users${suffix}`)
}

export async function createAdminAccount(payload: CreateAdminAccountPayload): Promise<{ id: string }> {
  return zhangakApiJson<{ id: string }>('/v1/admin/users', 'POST', payload)
}

export async function setAdminAccountBlocked(id: string, blocked: boolean): Promise<void> {
  await zhangakApiJson<{ success: true }>(`/v1/admin/users/${accountIdPath(id)}/block`, 'PATCH', { blocked })
}

export async function resetAdminAccountPassword(id: string, password: string): Promise<void> {
  await zhangakApiJson<{ success: true }>(`/v1/admin/users/${accountIdPath(id)}/password`, 'PATCH', { password })
}

export async function deleteAdminAccount(id: string): Promise<void> {
  await zhangakApiJson<{ success: true }>(`/v1/admin/users/${accountIdPath(id)}`, 'DELETE')
}

/**
 * The API always clears student-only fields for a staff role. The browser
 * mirrors that explicit contract so a stale form value cannot leak through a
 * future UI change.
 */
export async function changeAdminAccountRole(id: string, payload: ChangeAdminAccountRolePayload): Promise<void> {
  await zhangakApiJson<{ success: true }>(`/v1/admin/users/${accountIdPath(id)}/role`, 'PATCH', {
    role: payload.role,
    studentType: payload.role === 'student' ? payload.studentType : null,
  })
}

/** Mirrors backend/src/authorization.js for UI affordances only. */
export function creatableAccountRoles(actorRole: string | null): AccountRole[] {
  // Super-admin peers are provisioned only by the server-side break-glass
  // command. A browser session may create every operational role, but never
  // another super-admin account.
  if (actorRole === 'super_admin') return ACCOUNT_ROLES.filter(role => role !== 'super_admin')
  if (actorRole === 'admin' || actorRole === 'admin_jr') return ['student']
  if (actorRole === 'math_admin') return ['math_student', 'math_parent']
  return []
}

/** Existing account role changes are a super-admin-only operation. */
export function assignableAccountRoles(actorRole: string | null): AccountRole[] {
  return actorRole === 'super_admin'
    ? ACCOUNT_ROLES.filter(role => role !== 'super_admin')
    : []
}
