'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { calcStreak, DEFAULT_TARGET_SCORE } from '@/lib/student-data'
import StudentSidebar from './StudentSidebar'
import StudentTopbar from './StudentTopbar'
import NotificationPopup from './NotificationPopup'
import AIDrawer from './ai/AIDrawer'

interface Props {
  children: ReactNode
}

// The mock exam screen (/student/online/mock/[id], but not its /results child
// or the /mock listing page) runs full-screen with its own dark header — no
// sidebar/topbar chrome. The AI Mentor page is the same story — it has its
// own 3-column chat layout (dark session sidebar, topbar, analytics panel)
// and would just be duplicated chrome under this one.
const EXAM_ROUTE = /^\/student\/online\/mock\/[^/]+$/
const AI_PAGE_ROUTE = /^\/student\/online\/ai/

export default function StudentLayout({ children }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const isFullScreenPage = EXAM_ROUTE.test(pathname ?? '') || AI_PAGE_ROUTE.test(pathname ?? '')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [fullName, setFullName] = useState('Студент')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [targetScore, setTargetScore] = useState(DEFAULT_TARGET_SCORE)
  const [streak, setStreak] = useState(0)
  const [level, setLevel] = useState(1)
  const [studentId, setStudentId] = useState<string | null>(null)
  const [unreadCount, setUnreadCount] = useState(0)

  // Chrome data only — auth/role/student_type enforcement stays on each
  // page (as before), so this never redirects on its own, except for the
  // admin/student cross-visit conflict below (an admin landing here should
  // bounce to their own panel, not see a half-loaded student shell).
  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, full_name, target_score, avatar_url')
        .eq('id', user.id)
        .single()

      if (profile?.role === 'super_admin' || profile?.role === 'admin') { router.push('/admin'); return }

      setStudentId(user.id)

      if (profile) {
        setFullName(profile.full_name ?? 'Студент')
        setTargetScore(profile.target_score ?? DEFAULT_TARGET_SCORE)
        setAvatarUrl(profile.avatar_url ?? null)
      }

      const { data: results } = await supabase
        .from('practice_results')
        .select('completed_at')
        .eq('student_id', user.id)
        .not('completed_at', 'is', null)

      const rows = results ?? []
      setStreak(calcStreak(rows.map(r => r.completed_at as string)))
      setLevel(Math.max(1, Math.floor(rows.length / 10) + 1))
    }
    load()
  }, [router])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (isFullScreenPage) return <>{children}</>

  return (
    <div className="min-h-screen bg-[#FAF8FF]">
      <StudentSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} fullName={fullName} avatarUrl={avatarUrl} />

      <div className="lg:ml-64">
        <StudentTopbar
          fullName={fullName}
          avatarUrl={avatarUrl}
          streak={streak}
          targetScore={targetScore}
          level={level}
          unreadCount={unreadCount}
          onMenuClick={() => setSidebarOpen(true)}
          onLogout={handleLogout}
        />
        <main>{children}</main>
      </div>

      <NotificationPopup studentId={studentId} onUnreadChange={setUnreadCount} />
      <AIDrawer />
    </div>
  )
}
