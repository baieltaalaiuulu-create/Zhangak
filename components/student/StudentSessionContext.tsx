'use client'

import { createContext, useContext, type ReactNode } from 'react'

import type { ZhangakSessionUser } from '@/lib/zhangak-auth-client'

const StudentSessionContext = createContext<ZhangakSessionUser | null>(null)

export function StudentSessionProvider({
  user,
  children,
}: {
  user: ZhangakSessionUser
  children: ReactNode
}) {
  return <StudentSessionContext.Provider value={user}>{children}</StudentSessionContext.Provider>
}

/**
 * The online-student route is protected by StudentLayout before any child
 * page mounts. Reading the first-party session from this context prevents a
 * child page from falling back to the retired Supabase Auth session.
 */
export function useStudentSession(): ZhangakSessionUser {
  const user = useContext(StudentSessionContext)
  if (!user) throw new Error('Student session is unavailable outside StudentLayout')
  return user
}
