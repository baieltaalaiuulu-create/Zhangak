import 'server-only'

import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

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

// Permissions are intentionally split by capability. Unknown roles and any
// endpoint without an explicit group remain denied by default.
export const FULL_ADMIN_ROLES = ['super_admin', 'admin'] as const satisfies readonly AccountRole[]
export const CONTENT_ADMIN_ROLES = [...FULL_ADMIN_ROLES, 'admin_jr'] as const satisfies readonly AccountRole[]
export const ACCOUNT_CREATOR_ROLES = [...FULL_ADMIN_ROLES, 'admin_jr', 'math_admin'] as const satisfies readonly AccountRole[]
export const ACCOUNT_MANAGER_ROLES = [...FULL_ADMIN_ROLES, 'math_admin'] as const satisfies readonly AccountRole[]

const ACCOUNT_ROLE_SET = new Set<string>(ACCOUNT_ROLES)

interface AuthorizedRequest {
  authorized: true
  user: User
  client: SupabaseClient
  role: AccountRole | null
  admin: SupabaseClient | null
}

interface AdminAuthorizedRequest extends AuthorizedRequest {
  role: AccountRole
  admin: SupabaseClient
}

interface RejectedRequest {
  authorized: false
  response: NextResponse
}

export type ApiAuthResult = AuthorizedRequest | RejectedRequest
export type AdminApiAuthResult = AdminAuthorizedRequest | RejectedRequest

function reject(error: string, status: number): RejectedRequest {
  return { authorized: false, response: NextResponse.json({ error }, { status }) }
}

function getAdminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) return null

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

function getUserClient(accessToken: string): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) throw new Error('Supabase public credentials are not configured')

  return createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  })
}

export function isAccountRole(value: unknown): value is AccountRole {
  return typeof value === 'string' && ACCOUNT_ROLE_SET.has(value)
}

/**
 * Verifies a Supabase access token with the Auth server. When roles are
 * supplied, authorization is based on the current profiles row, never on
 * client-provided metadata or claims.
 */
export async function requireBearerAuth(
  request: Request,
  allowedRoles?: readonly AccountRole[],
): Promise<ApiAuthResult> {
  const match = request.headers.get('authorization')?.match(/^Bearer\s+(\S+)$/i)
  if (!match) return reject('Не авторизован', 401)

  try {
    const admin = getAdminClient()
    const userClient = getUserClient(match[1])
    const { data, error } = await userClient.auth.getUser(match[1])
    if (error || !data.user) return reject('Не авторизован', 401)

    let role: AccountRole | null = null
    if (allowedRoles) {
      if (!admin) return reject('Сервис временно недоступен', 503)

      const { data: profile, error: profileError } = await admin
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .maybeSingle()

      if (profileError) return reject('Сервис временно недоступен', 503)
      role = isAccountRole(profile?.role) ? profile.role : null
      if (!role || !allowedRoles.includes(role)) return reject('Доступ запрещён', 403)
    }

    return { authorized: true, user: data.user, client: userClient, role, admin }
  } catch {
    return reject('Сервис временно недоступен', 503)
  }
}

export async function requireRoleAuth(
  request: Request,
  allowedRoles: readonly AccountRole[],
): Promise<AdminApiAuthResult> {
  const auth = await requireBearerAuth(request, allowedRoles)
  if (!auth.authorized) return auth
  if (!auth.admin || !auth.role) return reject('Сервис временно недоступен', 503)
  return { ...auth, admin: auth.admin, role: auth.role }
}

export async function requireAdminApi(request: Request): Promise<NextResponse | null> {
  const auth = await requireRoleAuth(request, FULL_ADMIN_ROLES)
  return auth.authorized ? null : auth.response
}

export async function requireContentAdminApi(request: Request): Promise<NextResponse | null> {
  const auth = await requireRoleAuth(request, CONTENT_ADMIN_ROLES)
  return auth.authorized ? null : auth.response
}

export function canCreateAccount(actor: AccountRole, target: AccountRole): boolean {
  if (actor === 'super_admin') return true
  if (actor === 'admin') return target === 'student'
  if (actor === 'admin_jr') return target === 'student'
  if (actor === 'math_admin') return target === 'math_student' || target === 'math_parent'
  return false
}

export function canManageAccount(actor: AccountRole, target: AccountRole): boolean {
  if (actor === 'super_admin') return target !== 'super_admin'
  if (actor === 'admin') return target === 'student'
  if (actor === 'admin_jr') return false
  if (actor === 'math_admin') return target === 'math_student' || target === 'math_parent'
  return false
}

export async function authorizeAccountManagement(
  admin: SupabaseClient,
  actor: AccountRole,
  targetUserId: string,
): Promise<NextResponse | null> {
  const { data: profile, error } = await admin
    .from('profiles')
    .select('role')
    .eq('id', targetUserId)
    .maybeSingle()

  if (error) return reject('Сервис временно недоступен', 503).response
  const targetRole = isAccountRole(profile?.role) ? profile.role : null
  if (!targetRole || !canManageAccount(actor, targetRole)) {
    return reject('Доступ запрещён', 403).response
  }

  return null
}

export async function listManageableUserIds(
  admin: SupabaseClient,
  actor: AccountRole,
): Promise<{ ids: Set<string> } | { response: NextResponse }> {
  if (actor === 'super_admin') return { ids: new Set<string>() }

  const { data, error } = await admin.from('profiles').select('id, role')
  if (error) return { response: reject('Сервис временно недоступен', 503).response }

  return {
    ids: new Set(
      (data ?? [])
        .filter(profile => isAccountRole(profile.role) && canManageAccount(actor, profile.role))
        .map(profile => String(profile.id)),
    ),
  }
}
