'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getStudentDashboard, DEFAULT_TARGET_SCORE, type StudentDashboardData } from '@/lib/student-data'
import { fetchDashboardExtras, type DashboardExtras } from '@/lib/dashboard-data'

import AnnouncementBanner from '@/components/student/AnnouncementBanner'
import DashboardHeroCard from '@/components/student/DashboardHeroCard'
import TodayPlanCard from '@/components/student/TodayPlanCard'
import WeeklyProgressCard from '@/components/student/WeeklyProgressCard'
import ActivityHeatmap from '@/components/student/ActivityHeatmap'
import SubjectsGrid from '@/components/student/SubjectsGrid'
import AIMentorRecommendationCard from '@/components/student/AIMentorRecommendationCard'
import RecentAchievementsCard from '@/components/student/RecentAchievementsCard'

export default function StudentOnlinePage() {
  const [profileName, setProfileName] = useState<string | null>(null)
  const [data, setData] = useState<StudentDashboardData | null>(null)
  const [extras, setExtras] = useState<DashboardExtras | null>(null)
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
      const dashboardExtras = await fetchDashboardExtras(user.id, dashboard.latestScore, dashboard.previousScore)
      setData(dashboard)
      setExtras(dashboardExtras)
      setLoading(false)
    }
    checkAuth()
  }, [router])

  if (loading || !data || !extras) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F4F6FA', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ color: '#9CA3AF', fontSize: 14 }}>Загрузка...</div>
    </div>
  )

  const firstName = (data.profile?.full_name ?? profileName ?? 'Студент').split(' ')[0]
  const targetScore = data.profile?.target_score ?? DEFAULT_TARGET_SCORE
  const continueHref = '/student/online/lessons'

  const handleGoalUpdate = (newGoal: number) => {
    setData(prev => prev ? {
      ...prev,
      profile: prev.profile ? { ...prev.profile, target_score: newGoal } : prev.profile,
    } : prev)
  }

  return (
    <div className="min-h-screen bg-[#F4F6FA]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5 min-w-0">

        <AnnouncementBanner />

        <DashboardHeroCard
          firstName={firstName}
          latestScore={data.latestScore}
          targetScore={targetScore}
          minutesRemaining={extras.todayPlan.minutesRemaining}
          ctaHref={continueHref}
          onGoalUpdate={handleGoalUpdate}
        />

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {/* Left column */}
          <div className="space-y-5 min-w-0">
            <TodayPlanCard plan={extras.todayPlan} />
            <WeeklyProgressCard stats={extras.weeklyStats} />
            <ActivityHeatmap days={extras.heatmapDays} months={extras.heatmapMonths} />
          </div>

          {/* Right column */}
          <div className="space-y-5 min-w-0">
            <SubjectsGrid subjects={extras.subjectsGrid} />
            <AIMentorRecommendationCard recommendation={extras.aiRecommendation} />
            <RecentAchievementsCard achievements={extras.achievements} />
          </div>
        </div>

      </div>
    </div>
  )
}
