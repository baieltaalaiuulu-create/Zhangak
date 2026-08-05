'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { calcStreak, DEFAULT_TARGET_SCORE } from '@/lib/student-data'
import StudentSidebar from './StudentSidebar'
import StudentTopbar from './StudentTopbar'

interface Props {
  children: ReactNode
}

// The mock exam screen (/student/online/mock/[id], but not its /results child
// or the /mock listing page) runs full-screen with its own dark header — no
// sidebar/topbar chrome.
const EXAM_ROUTE = /^\/student\/online\/mock\/[^/]+$/

export default function StudentLayout({ children }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const isExamScreen = EXAM_ROUTE.test(pathname ?? '')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [fullName, setFullName] = useState('Студент')
  const [targetScore, setTargetScore] = useState(DEFAULT_TARGET_SCORE)
  const [streak, setStreak] = useState(0)
  const [level, setLevel] = useState(1)

  // Chrome data only — auth/role/student_type enforcement stays on each
  // page (as before), so this never redirects on its own.
  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, target_score')
        .eq('id', user.id)
        .single()

      if (profile) {
        setFullName(profile.full_name ?? 'Студент')
        setTargetScore(profile.target_score ?? DEFAULT_TARGET_SCORE)
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
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (isExamScreen) return <>{children}</>

  return (
    <div className="min-h-screen bg-[#FAF8FF]">
      <StudentSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="lg:ml-64">
        <StudentTopbar
          fullName={fullName}
          streak={streak}
          targetScore={targetScore}
          level={level}
          onMenuClick={() => setSidebarOpen(true)}
          onLogout={handleLogout}
        />
        <main>{children}</main>
      </div>
    </div>
  )
}
