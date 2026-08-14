'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { useStudentSession } from '@/components/student/StudentSessionContext'
import { DEFAULT_TARGET_SCORE, type StudentDashboardData } from '@/lib/student-dashboard-contract'
import { zhangakApiRequest } from '@/lib/zhangak-api-client'

import DashboardHeroCard from '@/components/student/DashboardHeroCard'
import SubjectsGrid from '@/components/student/SubjectsGrid'
import MobileHero from '@/components/student/mobile/MobileHero'
import MobileTodayChecklist from '@/components/student/mobile/MobileTodayChecklist'

interface FirstPartyDashboardResponse {
  profile: {
    fullName: string
    targetScore: number | null
  }
  summary: {
    courseCount: number
    lessons: { total: number; completed: number; completionPercent: number }
    practice: { attempts: number; passed: number; averageScorePercent: number; bestScorePercent: number }
    latestResult: {
      title: string
      testType: string
      scorePercent: number | null
      correctCount: number
      questionCount: number
      submittedAt: string | null
    } | null
  }
}

function dashboardFrom(response: FirstPartyDashboardResponse): StudentDashboardData {
  const { profile, summary } = response
  const lessonTrack = {
    currentLesson: null,
    completedCount: summary.lessons.completed,
    totalCount: summary.lessons.total,
    progressPct: summary.lessons.completionPercent,
    lessonDoneToday: false,
    practiceDoneToday: false,
  }
  return {
    profile: { full_name: profile.fullName, target_score: profile.targetScore ?? DEFAULT_TARGET_SCORE },
    // A practice percentage is deliberately not converted to a 245-point
    // ORT result. A real headline score will be added with the own-backend
    // mock-exam slice instead of presenting a misleading number.
    latestScore: null,
    previousScore: null,
    scoreHistory: [],
    subjects: [
      { subject: 'math', current: 0, max: 40, delta: 0 },
      { subject: 'kyr', current: 0, max: 40, delta: 0 },
      { subject: 'analogy', current: 0, max: 20, delta: 0 },
      { subject: 'reading', current: 0, max: 30, delta: 0 },
    ],
    streak: 0,
    subjectTracks: [
      { subject: 'math', ...lessonTrack },
      { subject: 'kyr', ...lessonTrack },
    ],
    monthStats: {
      lessons: summary.lessons.completed,
      questions: 0,
      tests: summary.practice.attempts,
      mocks: 0,
      hours: 0,
    },
  }
}

export default function StudentOnlinePage() {
  const user = useStudentSession()
  const [profileName, setProfileName] = useState<string | null>(null)
  const [data, setData] = useState<StudentDashboardData | null>(null)
  const [summary, setSummary] = useState<FirstPartyDashboardResponse['summary'] | null>(null)
  const [targetScoreOverride, setTargetScoreOverride] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    const loadDashboard = async () => {
      setProfileName(user.fullName)
      try {
        const response = await zhangakApiRequest<FirstPartyDashboardResponse>('/v1/platform/dashboard')
        setData(dashboardFrom(response))
        setSummary(response.summary)
      } catch {
        setLoadError(true)
      } finally {
        setLoading(false)
      }
    }
    void loadDashboard()
  }, [user.id, user.fullName])

  if (loadError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#F4F6FA] px-6 text-center">
        <p className="text-sm font-semibold text-gray-600">Не удалось загрузить. Попробуй ещё раз.</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="flex min-h-11 items-center gap-1.5 rounded-xl bg-[#1B3F92] px-5 py-2.5 text-sm font-bold text-white"
        >
          <RefreshCw size={16} aria-hidden="true" />
          Попробовать ещё раз
        </button>
      </div>
    )
  }

  if (loading || !data || !summary) {
    return (
      <div className="min-h-screen bg-[#F4F6FA]">
        <div className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6">
          {/* Mobile skeleton mirrors the intentionally short daily route. */}
          <div className="block space-y-3 md:hidden">
            <div role="status" className="rounded-2xl border border-blue-100 bg-white px-4 py-3 shadow-sm">
              <p className="text-sm font-extrabold text-[#0D1E4A]">Готовим твой план на сегодня</p>
              <p className="mt-1 text-xs font-medium text-gray-500">Загружаем уроки и прогресс — это займёт несколько секунд.</p>
            </div>
            <div className="animate-pulse space-y-2">
              <div className="h-6 w-48 rounded bg-gray-200" />
              <div className="h-4 w-32 rounded bg-gray-200" />
            </div>
            <div className="h-40 animate-pulse rounded-2xl bg-gray-200" />
            <div className="h-32 animate-pulse rounded-2xl bg-gray-200" />
          </div>
          {/* Desktop skeleton */}
          <div className="hidden md:block">
            <div className="h-48 animate-pulse rounded-2xl bg-white" />
          </div>
        </div>
      </div>
    )
  }

  const firstName = (data.profile?.full_name ?? profileName ?? 'Студент').split(' ')[0]
  const targetScore = targetScoreOverride ?? data.profile?.target_score ?? DEFAULT_TARGET_SCORE
  const continueHref = summary.courseCount > 0 ? '/student/online/lessons' : '/student/online/practice'
  const subjects = [
    { key: 'math' as const, label: 'Уроки', topicLabel: summary.courseCount > 0 ? 'Продолжай программу курса' : 'Курс появится после назначения группы', color: '#1B3F92', completed: summary.lessons.completed, total: summary.lessons.total, hoursRemaining: 0, href: '/student/online/lessons' },
    { key: 'kyr' as const, label: 'Тренажёр', topicLabel: summary.practice.attempts > 0 ? `Попыток: ${summary.practice.attempts}, успешно: ${summary.practice.passed}` : 'Начни первую безопасную попытку', color: '#14B8A6', completed: summary.practice.passed, total: summary.practice.attempts, hoursRemaining: 0, href: '/student/online/practice' },
  ]

  return (
    <div className="min-h-screen bg-[#F4F6FA]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5 min-w-0">

        {/* ============ MOBILE (< 768px) ============ */}
        <div className="block space-y-5 md:hidden">
          <MobileHero
            firstName={firstName}
            currentScore={0}
            targetScore={targetScore}
            heroLesson={null}
            loading={false}
          />

          <MobileTodayChecklist
            lessonDone={summary.lessons.total > 0 && summary.lessons.completed >= summary.lessons.total}
            lessonHref="/student/online/lessons"
            practiceDone={summary.practice.attempts > 0}
            practiceHref="/student/online/practice"
            challengeDone={false}
            challengeHref="/student/online/practice/daily"
            challengeAvailable={false}
          />
        </div>

        {/* ============ DESKTOP (>= 768px) ============ */}
        <div className="hidden md:block space-y-5">
          <DashboardHeroCard
            firstName={firstName}
            latestScore={data.latestScore}
            targetScore={targetScore}
            dailyGoalMinutes={user.dailyStudyGoalMinutes}
            ctaHref={continueHref}
            onGoalUpdate={setTargetScoreOverride}
          />

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <SubjectsGrid subjects={subjects} />
            <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <h2 className="text-base font-extrabold text-[#191B23]">Твой прогресс</h2>
              <dl className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-blue-50 p-3"><dt className="text-xs font-semibold text-blue-700">Уроки</dt><dd className="mt-1 text-2xl font-black text-[#1B3F92]">{summary.lessons.completed}/{summary.lessons.total}</dd></div>
                <div className="rounded-xl bg-violet-50 p-3"><dt className="text-xs font-semibold text-violet-700">Практика</dt><dd className="mt-1 text-2xl font-black text-violet-700">{summary.practice.attempts}</dd></div>
              </dl>
              <p className="mt-4 text-sm leading-6 text-gray-500">ОРТ-балл появится после первого полного пробного экзамена. Короткие тренировки не будут искусственно превращаться в балл ОРТ.</p>
            </section>
          </div>
        </div>

      </div>
    </div>
  )
}
