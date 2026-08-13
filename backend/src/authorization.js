import { HttpError } from './http.js'

export const ACCOUNT_ROLES = Object.freeze([
  'student', 'teacher', 'manager', 'director', 'finance', 'admin_jr',
  'admin', 'super_admin', 'math_student', 'math_parent', 'math_admin',
])

export const ACCOUNT_CREATOR_ROLES = Object.freeze(['super_admin', 'admin', 'admin_jr', 'math_admin'])
export const ACCOUNT_MANAGER_ROLES = Object.freeze(['super_admin', 'admin', 'math_admin'])

const roleSet = new Set(ACCOUNT_ROLES)

export function isAccountRole(value) {
  return typeof value === 'string' && roleSet.has(value)
}

export function requireRole(user, allowedRoles) {
  if (!user || !allowedRoles.includes(user.role)) throw new HttpError(403, 'Доступ запрещён', 'forbidden')
  return user
}

export function canCreateAccount(actor, target) {
  if (!isAccountRole(actor) || !isAccountRole(target)) return false
  if (actor === 'super_admin') return true
  if (actor === 'admin' || actor === 'admin_jr') return target === 'student'
  if (actor === 'math_admin') return target === 'math_student' || target === 'math_parent'
  return false
}

export function canManageAccount(actor, target) {
  if (!isAccountRole(actor) || !isAccountRole(target)) return false
  if (actor === 'super_admin') return target !== 'super_admin'
  if (actor === 'admin') return target === 'student'
  if (actor === 'math_admin') return target === 'math_student' || target === 'math_parent'
  return false
}

export function visibleAccountRoles(actor) {
  if (actor === 'super_admin') return null
  if (actor === 'admin') return ['student']
  if (actor === 'math_admin') return ['math_student', 'math_parent']
  return []
}
