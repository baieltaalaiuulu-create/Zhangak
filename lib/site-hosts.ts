export const MARKETING_HOST = 'zhangak.com'
export const PLATFORM_HOST = 'platform.zhangak.com'
export const OFFLINE_HOST = 'offline.zhangak.com'
export const ADMIN_HOST = 'admin.zhangak.com'

export const MARKETING_ORIGIN = `https://${MARKETING_HOST}`
export const PLATFORM_ORIGIN = `https://${PLATFORM_HOST}`
export const OFFLINE_ORIGIN = `https://${OFFLINE_HOST}`
export const ADMIN_ORIGIN = `https://${ADMIN_HOST}`

export type SiteSurface = 'marketing' | 'platform' | 'offline' | 'admin'
export type WorkspaceSurface = Exclude<SiteSurface, 'marketing'>

export function normalizeHostname(value: string | null | undefined): string {
  const raw = (value ?? '').trim().toLowerCase().replace(/\.$/, '')
  if (!raw) return ''
  if (raw.startsWith('[')) {
    const closingBracket = raw.indexOf(']')
    return closingBracket === -1 ? raw : raw.slice(1, closingBracket)
  }
  return raw.split(':', 1)[0] ?? ''
}

export function siteSurfaceForHost(value: string | null | undefined): SiteSurface | null {
  const hostname = normalizeHostname(value)
  if (hostname === MARKETING_HOST || hostname === `www.${MARKETING_HOST}`) return 'marketing'
  if (hostname === PLATFORM_HOST) return 'platform'
  if (hostname === OFFLINE_HOST) return 'offline'
  if (hostname === ADMIN_HOST) return 'admin'
  return null
}

export function isDedicatedPlatformHost(value: string | null | undefined): boolean {
  return normalizeHostname(value) === PLATFORM_HOST
}

export function workspaceSurfaceForRole(
  role: string | null | undefined,
  studentType?: string | null,
): WorkspaceSurface | null {
  if (['admin', 'super_admin', 'admin_jr', 'manager', 'director', 'finance', 'math_admin'].includes(role ?? '')) {
    return 'admin'
  }
  if (role === 'teacher') return 'offline'
  if (role === 'student') return studentType === 'offline' ? 'offline' : 'platform'
  if (['math_student', 'math_parent'].includes(role ?? '')) return 'platform'
  return null
}
