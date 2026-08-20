'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Map, RefreshCw } from 'lucide-react'
import { useStudentSession } from '@/components/student/StudentSessionContext'
import StudentVisualIcon from '@/components/student/StudentVisualIcon'
import { DEFAULT_TARGET_SCORE, type StudentDashboardData } from '@/lib/student-dashboard-contract'
import { zhangakApiRequest } from '@/lib/zhangak-api-client'
import { getGamificationSummary, getOverallLeaderboard, type GamificationSummary, type LeaderboardResponse } from '@/lib/platform-community'

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

const DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

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
  const [leaderboard, setLeaderboard] = useState<LeaderboardResponse | null>(null)
  const [gamification, setGamification] = useState<GamificationSummary | null>(null)
  const [targetScoreOverride, setTargetScoreOverride] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    const loadDashboard = async () => {
      setProfileName(user.fullName)
      try {
        const [response, ranking, game] = await Promise.all([
          zhangakApiRequest<FirstPartyDashboardResponse>('/v1/platform/dashboard'),
          getOverallLeaderboard().catch(() => null),
          getGamificationSummary().catch(() => null),
        ])
        setData(dashboardFrom(response))
        setSummary(response.summary)
        setLeaderboard(ranking)
        setGamification(game)
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
  const myRanking = leaderboard?.me ?? leaderboard?.items.find(item => item.isMe) ?? null
  const xp = gamification?.xp ?? 0
  const level = gamification?.level ?? 1
  const levelProgress = Math.max(0, xp - (gamification?.levelStartXp ?? 0))
  const levelSpan = Math.max(1, (gamification?.levelEndXp ?? 500) - (gamification?.levelStartXp ?? 0))
  const dailyQuests = gamification?.quests.filter(item => item.period === 'daily') ?? []
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
              <span>Уровень {level} · Подготовка</span>
              <span>{levelProgress} / 500 XP</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/20">
              <div className="h-full rounded-full bg-white transition-all duration-700 motion-reduce:transition-none" style={{ width: `${Math.min(100, Math.round((levelProgress / levelSpan) * 100))}%` }} />
            </div>
          </header>

          <div className="-mt-4 space-y-4 px-4">
            <section className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-[0_6px_18px_rgba(15,23,42,0.07)]">
              <div className="flex items-start gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#E8EDFA] text-[#1B3F92]"><Map size={26} aria-hidden="true" /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#8A96AC]">Главное на сегодня</p>
                  <h2 className="mt-0.5 text-[17px] font-black leading-tight text-[#0F172A]">Открой свой следующий шаг</h2>
                  <p className="mt-1 text-[12px] leading-5 text-[#475569]">В Roadmap видны опубликованный порядок уроков, доступные шаги и прогресс по разделам.</p>
                </div>
              </div>
              <Link href="/student/online/roadmap" className="mt-4 flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-[#1B3F92] px-4 text-[16px] font-extrabold text-white shadow-[0_4px_0_#102C69] active:translate-y-1 active:shadow-none">
                Открыть Roadmap <ArrowRight size={20} aria-hidden="true" />
              </Link>
            </section>

            <section className="flex items-center gap-4 rounded-[20px] border border-[#E2E8F0] bg-white p-4">
              <div className="flex h-[94px] w-[94px] shrink-0 items-center justify-center rounded-full bg-[#F5F7FC]">
                <div className="flex h-[74px] w-[74px] flex-col items-center justify-center rounded-full bg-white">
                  <span className="text-2xl font-black leading-none text-[#0F172A]">—</span>
                  <span className="text-[10px] font-bold text-[#8A96AC]">из 245</span>
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#8A96AC]">Прогноз балла ОРТ</p>
                <p className="mt-1.5 text-[13px] leading-5 text-[#475569]">Появится после первого полного пробного ОРТ. Короткие тесты не подменяют реальный балл.</p>
                <span className="mt-1.5 flex items-center gap-1.5 text-xs font-bold text-[#16A34A]"><StudentVisualIcon name="flag" size={16} color="#16A34A" />Цель: {targetScore}</span>
              </div>
            </section>

            <section className="rounded-[20px] border border-[#E2E8F0] bg-white p-4">
              <div className="flex items-center gap-2"><StudentVisualIcon name="local_fire_department" size={20} color="#D97706" /><span className="min-w-0 flex-1 text-sm font-extrabold">{gamification?.streak ? `Серия: ${gamification.streak} дн.` : 'Серия начнётся сегодня'}</span><span className="text-xs font-semibold text-[#8A96AC]">цель — заниматься регулярно</span></div>
              <div className="mt-3 flex gap-1.5">
                {DAYS.map((day, index) => <div key={day} className="flex min-w-0 flex-1 flex-col items-center gap-1.5"><span className={`flex h-[34px] w-[34px] items-center justify-center rounded-full ${index === 0 ? 'bg-[#D97706]' : 'bg-[#F5F7FC]'}`}><StudentVisualIcon name={index === 0 ? 'local_fire_department' : 'lock'} size={index === 0 ? 19 : 15} color={index === 0 ? '#FFFFFF' : '#8A96AC'} /></span><span className={`text-[10px] font-semibold ${index === 0 ? 'text-[#D97706]' : 'text-[#8A96AC]'}`}>{day}</span></div>)}
              </div>
            </section>

            <section className="rounded-[20px] border border-violet-100 bg-white p-4 shadow-[0_6px_18px_rgba(15,23,42,0.05)]">
              <div className="flex items-center gap-2"><StudentVisualIcon name="task_alt" size={20} color="#6C3DE0" /><h2 className="min-w-0 flex-1 text-sm font-extrabold">Квесты сегодня</h2><Link href="/student/online/quests" className="min-h-11 rounded-xl px-2.5 py-2 text-xs font-bold text-[#6C3DE0]">Все</Link></div>
              <div className="mt-3 space-y-2">
                {dailyQuests.length ? dailyQuests.map(quest => {
                  const progress = Math.min(100, Math.round((quest.currentCount / Math.max(1, quest.targetCount)) * 100))
                  return <div key={quest.code} className="rounded-xl bg-[#F8F7FF] px-3 py-2.5"><div className="flex items-center gap-2 text-xs font-bold"><span className="min-w-0 flex-1 truncate">{quest.title}</span><span className="shrink-0 text-[#6C3DE0]">{quest.currentCount}/{quest.targetCount} · +{quest.xpReward} XP</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-violet-100"><div className="h-full rounded-full bg-[#6C3DE0] transition-all duration-300 motion-reduce:transition-none" style={{ width: `${progress}%` }} /></div></div>
                }) : <p className="text-xs leading-5 text-[#64748B]">Квесты появятся после первого синхронизированного входа.</p>}
              </div>
            </section>

            <div>
              <p className="px-0.5 text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#8A96AC]">Тренируй по одному направлению</p>
              <div className="mt-2.5 space-y-2.5">
                {[{ label: 'Математика', icon: 'calculate', color: '#1B3F92', bg: '#E8EDFA', section: 'math' }, { label: 'Кыргыз тили', icon: 'translate', color: '#16A34A', bg: '#E8FAEF', section: 'kyr' }].map(item => <Link key={item.section} href="/student/online/trainer" className="flex items-center gap-3 rounded-2xl border border-[#E2E8F0] bg-white p-3"><span className="flex h-[42px] w-[42px] items-center justify-center rounded-2xl" style={{ background: item.bg }}><StudentVisualIcon name={item.icon} size={22} color={item.color} /></span><span className="min-w-0 flex-1"><span className="block text-sm font-bold text-[#0F172A]">{item.label}</span><span className="block text-[11px] text-[#8A96AC]">Выбери раздел и сложность</span></span><StudentVisualIcon name="play_circle" size={22} color="#1B3F92" /></Link>)}
              </div>
            </div>

            <Link href="/student/online/leaderboard" className="flex items-center gap-3 rounded-[20px] border border-[#D97706] bg-[#FFF6E5] px-4 py-3.5">
              <StudentVisualIcon name="emoji_events" size={30} color="#D97706" />
              <span className="min-w-0 flex-1"><span className="block truncate text-[15px] font-extrabold text-[#0F172A]">{myRanking ? `${myRanking.rank}-е место в рейтинге` : 'Начни набирать XP'}</span><span className="block truncate text-xs text-[#475569]">{xp.toLocaleString('ru-RU')} XP за выполненные задания</span></span>
              <StudentVisualIcon name="chevron_right" size={22} color="#8A96AC" filled={false} />
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
          <section className="rounded-2xl border border-violet-100 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-extrabold uppercase tracking-[.12em] text-violet-700">Геймификация</p><h2 className="mt-1 text-lg font-black text-[#191B23]">Квесты дня</h2></div><Link href="/student/online/quests" className="inline-flex min-h-11 items-center rounded-xl bg-violet-50 px-4 text-sm font-bold text-violet-700">Открыть квесты</Link></div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">{dailyQuests.length ? dailyQuests.map(quest => <div key={quest.code} className="rounded-xl bg-[#F8F7FF] p-4"><p className="font-bold text-[#191B23]">{quest.title}</p><p className="mt-1 text-xs leading-5 text-slate-500">{quest.description}</p><p className="mt-3 text-sm font-black text-violet-700">{quest.currentCount}/{quest.targetCount} · +{quest.xpReward} XP</p></div>) : <p className="text-sm text-slate-500">Квесты загружаются после синхронизации игрового профиля.</p>}</div>
          </section>
        </div>

      </div>
    </div>
  )
}
