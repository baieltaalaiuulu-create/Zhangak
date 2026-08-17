'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, BookOpenCheck, Dumbbell, Map, RefreshCw, Sparkles } from 'lucide-react'
import { useStudentSession } from '@/components/student/StudentSessionContext'
import { DEFAULT_TARGET_SCORE, type StudentDashboardData } from '@/lib/student-dashboard-contract'
import { zhangakApiRequest } from '@/lib/zhangak-api-client'

import DashboardHeroCard from '@/components/student/DashboardHeroCard'
import SubjectsGrid from '@/components/student/SubjectsGrid'

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
  const continueHref = summary.courseCount > 0 ? '/student/online/roadmap' : '/student/online/practice'
  const subjects = [
    { key: 'math' as const, label: 'Дорожная карта', topicLabel: summary.courseCount > 0 ? 'Продолжай программу курса по шагам' : 'Курс появится после назначения группы', color: '#1B3F92', completed: summary.lessons.completed, total: summary.lessons.total, hoursRemaining: 0, href: '/student/online/roadmap' },
    { key: 'kyr' as const, label: 'Тренажёр', topicLabel: 'Выбери предмет, раздел и сложность — правильные вопросы не повторяются', color: '#14B8A6', completed: summary.practice.passed, total: summary.practice.attempts, hoursRemaining: 0, href: '/student/online/trainer' },
  ]

  return (
    <div className="min-h-screen bg-[#F4F6FA]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5 min-w-0">

        {/* ============ MOBILE (< 768px) ============ */}
        <div className="-mx-4 -mt-6 block bg-[#F1F4FB] pb-4 md:hidden">
          <header className="rounded-b-[28px] bg-[#1B3F92] px-4 pb-8 pt-5 text-white shadow-[0_5px_0_#102C69]">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-blue-100">Твой план подготовки</p>
            <div className="mt-1 flex items-center justify-between gap-3">
              <h1 className="truncate text-[24px] font-black">Привет, {firstName}</h1>
              <Link href="/student/online/profile" aria-label="Открыть профиль" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-white/45 bg-white/15 text-sm font-black">
                {firstName.slice(0, 1).toUpperCase()}
              </Link>
            </div>
            <div className="mt-4 flex items-center justify-between gap-3 text-[12px] font-bold text-blue-100">
              <span>Цель: {targetScore} баллов</span>
              <span>{summary.lessons.completed}/{summary.lessons.total} уроков</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/20">
              <div className="h-full rounded-full bg-[#70C942] transition-all duration-700" style={{ width: `${summary.lessons.completionPercent}%` }} />
            </div>
          </header>

          <div className="-mt-4 space-y-4 px-4">
            <section className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-[0_6px_18px_rgba(15,23,42,0.07)]">
              <div className="flex items-start gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#E8EDFA] text-[#1B3F92]"><Map size={26} aria-hidden="true" /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#8A96AC]">Главное на сегодня</p>
                  <h2 className="mt-0.5 text-[17px] font-black leading-tight text-[#0F172A]">Продолжай путь по карте</h2>
                  <p className="mt-1 text-[12px] leading-5 text-[#475569]">Уроки открываются по порядку, а прогресс и звёзды сохраняются автоматически.</p>
                </div>
              </div>
              <Link href="/student/online/roadmap" className="mt-4 flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-[#1B3F92] px-4 text-[16px] font-extrabold text-white shadow-[0_4px_0_#102C69] active:translate-y-1 active:shadow-none">
                Открыть Roadmap <ArrowRight size={20} aria-hidden="true" />
              </Link>
            </section>

            <section className="grid grid-cols-2 gap-3" aria-label="Текущий прогресс">
              <Link href="/student/online/roadmap" className="rounded-2xl border border-[#DCE8FF] bg-[#F7FAFF] p-3.5">
                <BookOpenCheck size={22} className="text-[#1B3F92]" aria-hidden="true" />
                <p className="mt-3 text-[22px] font-black text-[#0F172A]">{summary.lessons.completionPercent}%</p>
                <p className="text-[11px] font-bold text-[#64748B]">программы курса</p>
              </Link>
              <Link href="/student/online/trainer" className="rounded-2xl border border-[#D8F3EC] bg-[#F4FFFC] p-3.5">
                <Dumbbell size={22} className="text-[#0D9488]" aria-hidden="true" />
                <p className="mt-3 text-[22px] font-black text-[#0F172A]">{summary.practice.attempts}</p>
                <p className="text-[11px] font-bold text-[#64748B]">попыток в практике</p>
              </Link>
            </section>

            <Link href="/student/online/trainer" className="flex items-center gap-3 rounded-2xl border border-[#F2E4BB] bg-[#FFF9EA] px-4 py-3.5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FFE7A5] text-[#A66500]"><Sparkles size={22} aria-hidden="true" /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-extrabold text-[#0F172A]">Тренажёр без повторов</span>
                <span className="mt-0.5 block text-[11px] leading-4 text-[#64748B]">Выбери предмет и тему — решённые правильно вопросы больше не покажутся.</span>
              </span>
              <ArrowRight size={20} className="shrink-0 text-[#A66500]" aria-hidden="true" />
            </Link>
          </div>
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
