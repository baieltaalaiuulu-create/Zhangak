'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { AlertCircle, LoaderCircle, RefreshCw } from 'lucide-react'
import { useRouter, usePathname } from 'next/navigation'
import { DEFAULT_TARGET_SCORE } from '@/lib/student-dashboard-contract'
import { redirectForRole } from '@/lib/auth-redirect'
import { PLATFORM_ORIGIN } from '@/lib/site-hosts'
import { getCurrentZhangakUser, logoutZhangak, type ZhangakSessionUser } from '@/lib/zhangak-auth-client'
import { zhangakApiRequest } from '@/lib/zhangak-api-client'
import StudentSidebar from './StudentSidebar'
import StudentTopbar from './StudentTopbar'
import BottomNav from './BottomNav'
import PWAInstallBanner from '@/components/PWAInstallBanner'
import { StudentSessionProvider } from './StudentSessionContext'
import type { PlatformProfile } from '@/lib/platform-profile'

interface Props {
  children: ReactNode
}

// The mock exam screen (/student/online/mock/[id], but not its /results child
// or the /mock listing page) runs full-screen with its own dark header — no
// sidebar/topbar chrome. AI Mentor keeps its own 3-column chat layout (dark
// session sidebar, topbar, analytics panel), while retaining BottomNav on
// mobile because AI is one of the five primary destinations. The daily-challenge
// question flow is full screen with its own progress
// header — but its /results child stays inside the normal shell (same
// split as the mock exam vs. mock results).
const EXAM_ROUTE = /^\/student\/online\/mock\/[^/]+$/
const AI_PAGE_ROUTE = /^\/student\/online\/ai/
const DAILY_CHALLENGE_ROUTE = /^\/student\/online\/practice\/daily$/

export default function StudentLayout({ children }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const isAiPage = AI_PAGE_ROUTE.test(pathname ?? '')
  const isImmersivePage = EXAM_ROUTE.test(pathname ?? '') || DAILY_CHALLENGE_ROUTE.test(pathname ?? '')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [fullName, setFullName] = useState('Студент')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [targetScore, setTargetScore] = useState(DEFAULT_TARGET_SCORE)
  const [streak, setStreak] = useState(0)
  const [xp, setXp] = useState(0)
  const [level, setLevel] = useState(1)
  const [sessionUser, setSessionUser] = useState<ZhangakSessionUser | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [authError, setAuthError] = useState(false)
  const [authAttempt, setAuthAttempt] = useState(0)

  const retryAuth = useCallback(() => {
    setAuthChecked(false)
    setAuthError(false)
    setAuthAttempt(value => value + 1)
  }, [])

  // This is the single online-student route guard. Child pages receive this
  // resolved first-party session through StudentSessionContext, rather than
  // checking the retired Supabase Auth session and bouncing back to /login.
  useEffect(() => {
    let active = true

    const load = async () => {
      try {
        const user = await getCurrentZhangakUser()
        if (!active) return

        if (!user) {
          window.location.replace(process.env.NODE_ENV === 'production'
            ? `${PLATFORM_ORIGIN}/login`
            : '/login?surface=platform')
          return
        }

        if (user.role !== 'student') {
          redirectForRole(user.role, user.studentType ?? undefined, router)
          return
        }

        if (user.studentType === 'offline') {
          router.replace('/student')
          return
        }

        setSessionUser(user)
        setFullName(user.fullName || 'Студент')
        setTargetScore(user.targetScore ?? DEFAULT_TARGET_SCORE)
        setAvatarUrl(user.avatarUrl ?? null)
        setAuthChecked(true)

        // Progress metrics arrive with the first-party dashboard endpoint.
        // Until that learning slice is populated, a valid account must still
        // reach its workspace without a legacy Supabase request or redirect.
        setStreak(0)
        void zhangakApiRequest<{ items: Array<{ xp: number; isMe: boolean }> }>('/v1/platform/leaderboard')
          .then(result => {
            const ownXp = result.items.find(item => item.isMe)?.xp ?? 0
            if (!active) return
            setXp(ownXp)
            setLevel(Math.max(1, Math.floor(ownXp / 500) + 1))
          })
          .catch(() => {})
      } catch {
        if (active) setAuthError(true)
      }
    }
    void load()
    return () => { active = false }
  }, [authAttempt, router])

  const handleLogout = async () => {
    await logoutZhangak().catch(() => {})
    window.location.assign(process.env.NODE_ENV === 'production'
      ? `${PLATFORM_ORIGIN}/login`
      : '/login?surface=platform')
  }

  const applyProfileUpdate = useCallback((profile: PlatformProfile) => {
    setSessionUser(current => {
      if (!current || current.id !== profile.id) return current
      return {
        ...current,
        fullName: profile.fullName,
        targetScore: profile.targetScore,
        avatarUrl: profile.avatarUrl,
        profileColor: profile.profileColor,
        dailyStudyGoalMinutes: profile.dailyStudyGoalMinutes,
      }
    })
    setFullName(profile.fullName || 'Студент')
    setTargetScore(profile.targetScore ?? DEFAULT_TARGET_SCORE)
    setAvatarUrl(profile.avatarUrl)
  }, [])

  if (authError) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-[#FAF8FF] px-5">
        <div className="w-full max-w-md rounded-3xl border border-red-100 bg-white p-7 text-center shadow-sm">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600">
            <AlertCircle size={23} aria-hidden="true" />
          </span>
          <h1 className="mt-4 text-xl font-black text-[#0D1E4A]">Не удалось проверить вход</h1>
          <p className="mt-2 text-sm font-medium leading-6 text-slate-500">Кабинет остаётся закрытым. Проверь соединение и повтори попытку.</p>
          <button type="button" onClick={retryAuth} className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#1B3F92] px-4 text-sm font-extrabold text-white">
            <RefreshCw size={17} aria-hidden="true" />
            Повторить
          </button>
        </div>
      </main>
    )
  }

  if (!authChecked || !sessionUser) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-[#FAF8FF] px-5">
        <div role="status" className="flex items-center gap-3 rounded-2xl border border-blue-100 bg-white px-5 py-4 text-sm font-semibold text-slate-600 shadow-sm">
          <LoaderCircle size={19} className="animate-spin text-[#1B3F92]" aria-hidden="true" />
          Проверяем вход…
        </div>
      </main>
    )
  }

  if (isImmersivePage) return <StudentSessionProvider user={sessionUser} onProfileUpdated={applyProfileUpdate}>{children}</StudentSessionProvider>

  // AI keeps its focused chat shell, but the five-item mobile navigation
  // remains available just like it does on the other primary destinations.
  if (isAiPage) {
    return (
      <StudentSessionProvider user={sessionUser} onProfileUpdated={applyProfileUpdate}>
        {children}
        <BottomNav />
      </StudentSessionProvider>
    )
  }

  return (
    <StudentSessionProvider user={sessionUser} onProfileUpdated={applyProfileUpdate}>
      <div className="student-visual min-h-screen bg-[#F1F4FB] md:bg-[#FAF8FF]">
        <StudentSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} fullName={fullName} avatarUrl={avatarUrl} profileColor={sessionUser.profileColor} />

        <div className="mx-auto min-h-screen w-full max-w-[430px] overflow-x-hidden bg-[#F1F4FB] md:ml-64 md:max-w-none md:overflow-visible md:bg-[#FAF8FF]">
          <StudentTopbar
            fullName={fullName}
            avatarUrl={avatarUrl}
            profileColor={sessionUser.profileColor}
            streak={streak}
            xp={xp}
            targetScore={targetScore}
            level={level}
            unreadCount={0}
            onLogout={handleLogout}
          />
          <main className="pb-20 md:pb-0">{children}</main>
        </div>

        <BottomNav />
        {/* Announcements and AI are intentionally absent until their own
            first-party APIs replace the retired Supabase data paths. */}
        <PWAInstallBanner ready={Boolean(sessionUser)} />
      </div>
    </StudentSessionProvider>
  )
}
