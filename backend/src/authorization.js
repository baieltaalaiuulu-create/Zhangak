import { HttpError } from './http.js'

export const ACCOUNT_ROLES = Object.freeze([
  'student', 'teacher', 'manager', 'director', 'finance', 'admin_jr',
  'admin', 'super_admin', 'math_student', 'math_parent', 'math_admin',
])

/**
 * `super_admin` is deliberately a bootstrap-only peer role. It is created
 * from the protected server-side script, not from a browser session. This
 * prevents a compromised regular admin (or an accidental UI change) from
 * turning an ordinary account into an infrastructure-level operator.
 */
export const SUPER_ADMIN_ROLE = 'super_admin'
export const ACCOUNT_CREATOR_ROLES = Object.freeze(['super_admin', 'admin', 'admin_jr', 'math_admin'])
export const ACCOUNT_MANAGER_ROLES = Object.freeze(['super_admin', 'admin', 'math_admin'])

const roleSet = new Set(ACCOUNT_ROLES)

export function isAccountRole(value) {
  return typeof value === 'string' && roleSet.has(value)
}

export function isSuperAdmin(value) {
  return value === SUPER_ADMIN_ROLE
}

export function requireRole(user, allowedRoles) {
  if (!user || !allowedRoles.includes(user.role)) throw new HttpError(403, 'Доступ запрещён', 'forbidden')
  return user
}

export function requireSuperAdmin(user) {
  return requireRole(user, [SUPER_ADMIN_ROLE])
}

export function canCreateAccount(actor, target) {
  if (!isAccountRole(actor) || !isAccountRole(target)) return false
  // Creating a peer super-admin is intentionally outside the web UI. The
  // bootstrap script is the break-glass path and leaves an audit record.
  if (actor === SUPER_ADMIN_ROLE) return target !== SUPER_ADMIN_ROLE
  if (actor === 'admin' || actor === 'admin_jr') return target === 'student'
  if (actor === 'math_admin') return target === 'math_student' || target === 'math_parent'
  return false
}

export function canManageAccount(actor, target) {
  if (!isAccountRole(actor) || !isAccountRole(target)) return false
  if (actor === SUPER_ADMIN_ROLE) return target !== SUPER_ADMIN_ROLE
  if (actor === 'admin') return target === 'student'
  if (actor === 'math_admin') return target === 'math_student' || target === 'math_parent'
  return false
}

/** Only a super-admin may change another account's role, never to/from a peer. */
export function canChangeAccountRole(actor, currentRole, nextRole) {
  return isSuperAdmin(actor)
    && isAccountRole(currentRole)
    && isAccountRole(nextRole)
    && currentRole !== SUPER_ADMIN_ROLE
    && nextRole !== SUPER_ADMIN_ROLE
}

export function visibleAccountRoles(actor) {
  if (actor === SUPER_ADMIN_ROLE) return null
  if (actor === 'admin') return ['student']
  if (actor === 'math_admin') return ['math_student', 'math_parent']
  return []
}
