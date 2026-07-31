'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getStudentDashboard, type StudentDashboardData } from '@/lib/student-data'

import HeroCard     from '@/components/student/HeroCard'
import DailyPlan    from '@/components/student/DailyPlan'
import SubjectCards from '@/components/student/SubjectCards'
import NextLesson   from '@/components/student/NextLesson'
import AICard       from '@/components/student/AICard'
import StreakCard   from '@/components/student/StreakCard'
import StatsRow     from '@/components/student/StatsRow'

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
  const targetScore = data.profile?.target_score ?? 180

  // Greeting based on time
  const hour = new Date().getHours()
  const greeting =
    hour < 12 ? 'Доброе утро' :
    hour < 17 ? 'Добрый день' :
    'Добрый вечер'

  const latestScore = data.latestScore ?? 0
  const delta = data.latestScore != null && data.previousScore != null
    ? data.latestScore - data.previousScore : null

  return (
    <div className="min-h-screen bg-[#F4F6FA]">
      {/* Top greeting bar */}
      <div className="bg-white border-b border-gray-100 px-4 sm:px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-gray-900 truncate">
              {greeting}, {firstName} 👋
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {delta !== null && delta > 0
                ? `Отличная работа! +${delta} баллов с прошлого раза`
                : `До цели осталось ${Math.max(0, targetScore - latestScore)} баллов`
              }
            </p>
          </div>

          {/* ORT countdown pill */}
          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            {data.streak > 0 && (
              <span className="text-sm font-semibold text-orange-600 bg-orange-50 px-3 py-1.5 rounded-full whitespace-nowrap">
                🔥 {data.streak} дней
              </span>
            )}
            <span className="text-sm font-semibold text-blue-700 bg-blue-50 px-3 py-1.5 rounded-full whitespace-nowrap">
              ⏳ 128 дней до ОРТ
            </span>
          </div>
        </div>
      </div>

      {/* Main grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5 min-w-0">

        {/* Row 1: Hero + Next Lesson */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 min-w-0">
            <HeroCard
              latestScore={data.latestScore}
              previousScore={data.previousScore}
              targetScore={targetScore}
              scoreHistory={data.scoreHistory}
            />
          </div>
          <div className="min-w-0">
            <NextLesson
              lesson={data.nextLesson}
              progress={data.nextLessonProgress}
            />
          </div>
        </div>

        {/* Row 2: Daily Plan + Subjects */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="min-w-0">
            <DailyPlan tasks={data.todayTasks} />
          </div>
          <div className="lg:col-span-2 min-w-0">
            <SubjectCards
              subjects={data.subjects}
              comparison={{ me: latestScore, avg: 126, top: 182 }}
            />
          </div>
        </div>

        {/* Row 3: AI + Streak */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 min-w-0">
            <AICard
              latestScore={data.latestScore}
              subjects={data.subjects}
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
