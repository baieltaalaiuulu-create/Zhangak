'use client'
export const dynamic = 'force-dynamic'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { redirectForRole } from '@/lib/auth-redirect'

const ONBOARDING_KEY = 'zhangak-onboarding-done'
const DOT_DELAYS_MS = [0, 150, 300]

// Dedicated PWA entry point (manifest start_url) — instant, no data
// dependency for its own render, so it never 404s or blanks out on a cold
// launch the way '/student/online' (auth-gated) did. Decides where to go
// next: an active session skips straight to that role's dashboard (via the
// shared redirectForRole, not a hardcoded '/student/online' — a non-student
// account launching the installed PWA would otherwise land on a page that
// immediately bounces it back to /login, which by FIX 6 replaces back to
// this very launch check, looping); no session falls back to onboarding
// (first run) or straight to /login (returning visitor).
export default function LaunchPage() {
  const router = useRouter()

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()

      if (session) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, student_type')
          .eq('id', session.user.id)
          .single()
        redirectForRole(profile?.role, profile?.student_type, router, '/student')
        return
      }

      const onboardingDone = localStorage.getItem(ONBOARDING_KEY)
      router.replace(onboardingDone ? '/login' : '/onboarding')
    }
    init()
  }, [router])

  // Splash shown while the check above runs — same look as the onboarding
  // route's own splash-like cold start, so there's no visual seam between
  // "app is launching" and "first onboarding slide" for a first-run visitor.
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#0D0D1A]">
      {/* eslint-disable-next-line @next/next/no-img-element -- static PWA icon, launch screen must not depend on next/image's optimizer */}
      <img src="/icons/icon-512.png" className="h-24 w-24 rounded-2xl" alt="Zhangak" />
      <h1 className="mt-6 text-3xl font-bold text-white">Жангак</h1>
      <p className="mt-2 text-xs tracking-[0.3em] text-gray-400">ОРТ ДАЙЫНДЫГЫ</p>
      <div className="mt-8 flex gap-2">
        {DOT_DELAYS_MS.map(delay => (
          <div
            key={delay}
            className="h-2 w-2 animate-bounce rounded-full bg-[#1B4FD8]"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </div>
    </div>
  )
}
