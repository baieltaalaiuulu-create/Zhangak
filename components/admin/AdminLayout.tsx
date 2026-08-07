'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import AdminSidebar from './AdminSidebar'

interface Props {
  children: ReactNode
}

// Every staff role that belongs in /admin — students are bounced to their
// own dashboard, anything else falls through to the login page rather than
// silently getting admin access.
const ADMIN_ROLES = new Set(['admin', 'super_admin', 'admin_jr', 'director', 'finance', 'manager', 'math_admin'])

export default function AdminLayout({ children }: Props) {
  const router = useRouter()
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    let cancelled = false

    const checkAuth = async () => {
      // getSession() resolves from the session already persisted in
      // localStorage, so it settles immediately on a hard refresh.
      // getUser() instead re-validates against the Auth server over the
      // network — its variable latency was racing this check on refresh,
      // occasionally reading as "no session yet" before the real session
      // had a chance to load and firing the wrong redirect.
      const { data: { session } } = await supabase.auth.getSession()
      if (cancelled) return
      const user = session?.user
      if (!user) { router.push('/'); return }

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (cancelled) return

      // Couldn't confirm a role (query error or no row) — don't guess either
      // way, send back to login instead of granting or wrongly denying access.
      if (error || !profile) { router.push('/'); return }

      if (profile.role === 'student') { router.push('/student/online'); return }

      if (!ADMIN_ROLES.has(profile.role)) { router.push('/'); return }

      setChecked(true)
    }
    checkAuth()

    return () => { cancelled = true }
  }, [router])

  if (!checked) return (
    <div className="flex min-h-screen items-center justify-center bg-[#FAF8FF]">
      <div className="text-sm text-gray-400">Загрузка...</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#FAF8FF]">
      <AdminSidebar />
      <div className="lg:ml-64 print:ml-0">{children}</div>
    </div>
  )
}
