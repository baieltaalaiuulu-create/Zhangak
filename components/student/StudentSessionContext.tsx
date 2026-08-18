'use client'

import { createContext, useContext, type ReactNode } from 'react'

import type { ZhangakSessionUser } from '@/lib/zhangak-auth-client'
import type { PlatformProfile } from '@/lib/platform-profile'

interface StudentSessionContextValue {
  user: ZhangakSessionUser
  applyProfileUpdate: (profile: PlatformProfile) => void
}

const StudentSessionContext = createContext<StudentSessionContextValue | null>(null)

export function StudentSessionProvider({
  user,
  onProfileUpdated,
  children,
}: {
  user: ZhangakSessionUser
  onProfileUpdated: (profile: PlatformProfile) => void
  children: ReactNode
}) {
  return <StudentSessionContext.Provider value={{ user, applyProfileUpdate: onProfileUpdated }}>{children}</StudentSessionContext.Provider>
}

/**
 * The online-student route is protected by StudentLayout before any child
 * page mounts. Reading the first-party session from this context prevents a
 * child page from falling back to the retired Supabase Auth session.
 */
export function useStudentSession(): ZhangakSessionUser {
  const context = useContext(StudentSessionContext)
  if (!context) throw new Error('Student session is unavailable outside StudentLayout')
  return context.user
}

/**
 * Lets the profile and settings pages immediately refresh the protected shell
 * after a successful first-party profile PATCH. No browser event or stale
 * local cache is involved.
 */
export function useStudentProfileUpdate(): StudentSessionContextValue['applyProfileUpdate'] {
  const context = useContext(StudentSessionContext)
  if (!context) throw new Error('Student session is unavailable outside StudentLayout')
  return context.applyProfileUpdate
}
