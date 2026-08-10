'use client'
export const dynamic = 'force-dynamic'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { redirectForRole } from '@/lib/auth-redirect'

const ONBOARDING_KEY = 'zhangak-onboarding-done'
const DOT_DELAYS_MS = [0, 150, 300]

// Root route — this app's PWA start_url (app/manifest.ts) and every
// browser's cold entry point. Renders only a brief splash while deciding
// where to actually send the visitor, so a PWA cold launch or a mobile
// visit never shows the marketing page (that content lives at
// /landing — see app/landing/page.tsx) before the real destination loads:
//  - active session -> straight to that role's dashboard, via the shared
//    redirectForRole rather than a hardcoded '/student/online'. A
//    non-student role landing on '/student/online' would immediately
//    bounce back out to /login, which itself replaces back to this very
//    check (FIX 6 in an earlier pass made /login use replace), looping
//    forever. Same reasoning that used to live on app/launch/page.tsx,
//    which this route replaces and fully supersedes — deleted alongside
//    this change since nothing points at it anymore.
//  - no session, mobile viewport or installed PWA -> onboarding (first
//    run) or /login (onboarding already seen)
//  - no session, desktop browser -> /landing
export default function RootPage() {
  const router = useRouter()

  useEffect(() => {
    const check = async () => {
      try {
        const isPWA = window.matchMedia('(display-mode: standalone)').matches
        const isMobile = window.innerWidth < 768
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

        if (isPWA || isMobile) {
          const done = localStorage.getItem(ONBOARDING_KEY)
          router.replace(done ? '/login' : '/onboarding')
        } else {
          router.replace('/landing')
        }
      } catch {
        router.replace('/landing')
      }
    }
    check()
  }, [router])

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#0D0D1A]">
      {/* eslint-disable-next-line @next/next/no-img-element -- static PWA icon, cold-start splash must not depend on next/image's optimizer */}
      <img src="/icons/icon-512.png" className="h-20 w-20 rounded-2xl shadow-lg" alt="Zhangak" />
      <h1 className="mt-4 text-2xl font-bold text-white">Жангак</h1>
      <p className="mt-1 text-xs tracking-[0.3em] text-gray-400">ОРТ ДАЙЫНДЫГЫ</p>
      <div className="mt-6 flex gap-2">
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
