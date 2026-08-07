'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getStudentDashboard, DEFAULT_TARGET_SCORE, type StudentDashboardData } from '@/lib/student-data'

import HeroCard      from '@/components/student/HeroCard'
import SubjectCards  from '@/components/student/SubjectCards'
import AICard        from '@/components/student/AICard'
import StreakCard    from '@/components/student/StreakCard'
import StatsRow      from '@/components/student/StatsRow'
import DashboardHero from '@/components/student/DashboardHero'
import AnnouncementBanner from '@/components/student/AnnouncementBanner'
import NextLesson from '@/components/student/NextLesson'
import TodayPlanSimple from '@/components/student/TodayPlanSimple'

export default function StudentOnlinePage() {
  const [profileName, setProfileName] = useState<string | null>(null)
  const [data, setData] = useState<StudentDashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, student_type, full_name, target_score')
        .eq('id', user.id)
        .single()

      if (!profile || profile.role !== 'student') { router.push('/login'); return }
      if (profile.student_type === 'offline') { router.push('/student'); return }

      setProfileName(profile.full_name)
      const dashboard = await getStudentDashboard()
      setData(dashboard)
      setLoading(false)
    }
    checkAuth()
  }, [router])

  if (loading || !data) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F4F6FA', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ color: '#9CA3AF', fontSize: 14 }}>Загрузка...</div>
    </div>
  )

  const firstName = (data.profile?.full_name ?? profileName ?? 'Студент').split(' ')[0]
  const targetScore = data.profile?.target_score ?? DEFAULT_TARGET_SCORE

  const handleGoalUpdate = (newGoal: number) => {
    setData(prev => prev ? {
      ...prev,
      profile: prev.profile ? { ...prev.profile, target_score: newGoal } : prev.profile,
    } : prev)
  }

  const latestScore = data.latestScore ?? 0
  const remaining = Math.max(0, targetScore - latestScore)
  // Two explicit subject tracks below make "next lesson" unambiguous now,
  // so the hero CTA no longer needs to guess which subject to jump into.
  const continueHref = '/student/online/lessons'

  return (
    <div className="min-h-screen bg-[#F4F6FA]">
      {/* Main grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5 min-w-0">

        <AnnouncementBanner />

        <DashboardHero
          firstName={firstName}
          remaining={remaining}
          streak={data.streak}
          ctaHref={continueHref}
        />

        {/* Next lesson per subject — always exactly one clear "what's next"
            per subject, instead of one ambiguous cross-subject card. */}
        <NextLesson
          mathLesson={data.subjectTracks.find(t => t.subject === 'math')?.currentLesson ?? null}
          kyrLesson={data.subjectTracks.find(t => t.subject === 'kyr')?.currentLesson ?? null}
          mathProgress={{
            completed: data.subjectTracks.find(t => t.subject === 'math')?.completedCount ?? 0,
            total: data.subjectTracks.find(t => t.subject === 'math')?.totalCount ?? 0,
          }}
          kyrProgress={{
            completed: data.subjectTracks.find(t => t.subject === 'kyr')?.completedCount ?? 0,
            total: data.subjectTracks.find(t => t.subject === 'kyr')?.totalCount ?? 0,
          }}
        />

        {/* Simplified today's plan — 1 lesson + 1 practice per subject */}
        <TodayPlanSimple tracks={data.subjectTracks} />

        {/* Score trend */}
        <HeroCard
          latestScore={data.latestScore}
          previousScore={data.previousScore}
          targetScore={targetScore}
          scoreHistory={data.scoreHistory}
          onGoalUpdate={handleGoalUpdate}
        />

        <SubjectCards
          subjects={data.subjects}
          comparison={{ me: latestScore, avg: 126, top: 182 }}
        />

        {/* Row 3: AI + Streak */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 min-w-0">
            <AICard
              latestScore={data.latestScore}
              subjects={data.subjects}
              targetScore={targetScore}
            />
          </div>
          <div className="min-w-0">
            <StreakCard streak={data.streak} />
          </div>
        </div>

        {/* Row 4: Stats */}
        <StatsRow stats={data.monthStats} />

      </div>
    </div>
  )
}
