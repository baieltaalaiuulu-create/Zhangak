'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

import TopNavbar from './components/TopNavbar'
import GreetingBar from './components/GreetingBar'
import HeroCard from './components/HeroCard'
import DailyPlanCard, { type DailyTask } from './components/DailyPlanCard'
import SubjectAnalytics from './components/SubjectAnalytics'
import NextLessonCard from './components/NextLessonCard'
import AIAdvisorCard from './components/AIAdvisorCard'
import StreakCard from './components/StreakCard'
import StatsRow from './components/StatsRow'

import type { Profile, PracticeLesson, PracticeResult, PracticeTest, SubjectKey, SubjectStat } from './lib/types'
import { computeOrtScore, localDateKey, computeStreak, lastNDays, daysUntil, clamp } from './lib/utils'

const ORT_EXAM_DATE = '2026-12-06'
const BENCHMARK = { avg: 126, top: 182 }

const SUBJECT_DEFS: { key: SubjectKey; label: string; color: string; field: keyof PracticeResult; weight: number }[] = [
  { key: 'math', label: 'Математика', color: '#1B4FD8', field: 'math_raw_score', weight: 1.12 },
  { key: 'kyr', label: 'Кыргызча', color: '#F59E0B', field: 'grammar_score', weight: 1.93 },
  { key: 'analogy', label: 'Аналогия', color: '#10B981', field: 'analogy_score', weight: 2 },
  { key: 'reading', label: 'Чтение', color: '#8B5CF6', field: 'reading_score', weight: 2 },
]

export default function StudentOnlinePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [lessons, setLessons] = useState<PracticeLesson[]>([])
  const [results, setResults] = useState<PracticeResult[]>([])
  const [tests, setTests] = useState<PracticeTest[]>([])
  const [questionCounts, setQuestionCounts] = useState<Record<number, number>>({})

  useEffect(() => { checkAuth() }, [])

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (!prof || prof.role !== 'student') { router.push('/'); return }
    if (prof.student_type === 'offline') { router.push('/student'); return }
    setProfile(prof as Profile)
    await fetchData(user.id)
  }

  const fetchData = async (uid: string) => {
    const [{ data: l }, { data: r }, { data: t }] = await Promise.all([
      supabase.from('practice_lessons').select('*').order('subject', { ascending: true }).order('order_number', { ascending: true }),
      supabase.from('practice_results').select('*').eq('student_id', uid).order('completed_at', { ascending: false }),
      supabase.from('practice_tests').select('id,subject,type,time_limit_minutes,lesson_id'),
    ])
    setLessons((l as PracticeLesson[]) || [])
    setResults((r as PracticeResult[]) || [])
    setTests((t as PracticeTest[]) || [])

    const testIds = Array.from(new Set(((r as PracticeResult[]) || []).map(res => res.test_id).filter((id): id is number => id != null)))
    if (testIds.length > 0) {
      const { data: qs } = await supabase.from('questions').select('practice_test_id').in('practice_test_id', testIds)
      const counts: Record<number, number> = {}
      ;((qs as { practice_test_id: number }[]) || []).forEach(q => {
        counts[q.practice_test_id] = (counts[q.practice_test_id] || 0) + 1
      })
      setQuestionCounts(counts)
    }
    setLoading(false)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading || !profile) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F4F6FA', fontFamily: 'Inter, sans-serif' }}>
        <div style={{ color: '#64748B', fontSize: '14px' }}>Жүктөлүүдө...</div>
      </div>
    )
  }

  // ---- derived data ----
  const testSubjectMap: Record<number, string> = {}
  const testMinutesMap: Record<number, number> = {}
  tests.forEach(t => {
    testSubjectMap[t.id] = t.subject
    testMinutesMap[t.id] = t.time_limit_minutes ?? 0
  })

  const fullOrtResults = results.filter(r => r.test_id != null && testSubjectMap[r.test_id] === 'all')
  const latestOrt = fullOrtResults[0] ?? null
  const currentScore = latestOrt ? computeOrtScore(latestOrt) : 0
  const targetScore = profile.target_score ?? 180
  const remaining = Math.max(targetScore - currentScore, 0)
  const sparkline = [...fullOrtResults].slice(0, 8).reverse().map(r => ({
    date: r.completed_at,
    score: computeOrtScore(r),
  }))

  const subjectStats: SubjectStat[] = SUBJECT_DEFS.map(def => {
    const withScore = results
      .filter(r => Number(r[def.field] ?? 0) > 0)
      .map(r => Math.round(Number(r[def.field]) * def.weight))
    const current = withScore[0] ?? 0
    const previous = withScore[1]
    const delta = previous !== undefined ? current - previous : null
    return { key: def.key, label: def.label, color: def.color, current, delta }
  })

  const weakest = [...subjectStats].sort((a, b) => a.current - b.current)[0]

  const completedLessonIds = new Set(results.map(r => r.lesson_id).filter((id): id is string => !!id))
  const nextLesson = lessons.find(l => !completedLessonIds.has(l.id)) ?? null
  const nextLessonSubjectLessons = nextLesson ? lessons.filter(l => l.subject === nextLesson.subject) : []
  const nextLessonSubjectDone = nextLessonSubjectLessons.filter(l => completedLessonIds.has(l.id)).length

  const activeDates = new Set(results.map(r => localDateKey(r.completed_at)))
  const streak = computeStreak(activeDates)
  const streakDays = lastNDays(activeDates, 14)

  const todayKey = localDateKey(new Date())
  const todaysResults = results.filter(r => localDateKey(r.completed_at) === todayKey)

  const dailyTasks: DailyTask[] = []
  if (nextLesson) {
    dailyTasks.push({
      id: 'lesson',
      label: `Урок: ${nextLesson.title}`,
      icon: 'play',
      done: todaysResults.some(r => r.lesson_id === nextLesson.id),
    })
  }
  dailyTasks.push({
    id: 'practice',
    label: 'Пройти практический тест',
    icon: 'pencil',
    done: todaysResults.some(r => r.test_type === 'practice'),
  })
  const lastMock = results.find(r => r.test_type === 'mock')
  const daysSinceMock = lastMock ? Math.floor((Date.now() - new Date(lastMock.completed_at).getTime()) / 86400000) : Infinity
  if (daysSinceMock >= 6) {
    dailyTasks.push({
      id: 'mock',
      label: 'Пройти пробный ОРТ',
      icon: 'clipboard',
      done: todaysResults.some(r => r.test_type === 'mock'),
    })
  }

  // monthly stats
  const now = new Date()
  const monthResults = results.filter(r => {
    const d = new Date(r.completed_at)
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  })
  const monthLessons = new Set(monthResults.map(r => r.lesson_id).filter(Boolean)).size
  const monthQuestions = monthResults.reduce((sum, r) => sum + (r.test_id != null ? (questionCounts[r.test_id] ?? 0) : 0), 0)
  const monthPractice = monthResults.filter(r => r.test_type === 'practice').length
  const monthMock = monthResults.filter(r => r.test_type === 'mock').length
  const monthHours = Math.round((monthResults.reduce((sum, r) => sum + (r.test_id != null ? (testMinutesMap[r.test_id] ?? 0) : 0), 0) / 60) * 10) / 10

  const daysToOrt = daysUntil(ORT_EXAM_DATE)
  const firstName = profile.full_name?.split(' ')[0] ?? 'друг'

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const weakSubjectLesson = (weakest.key === 'math' || weakest.key === 'kyr')
    ? lessons.find(l => l.subject === weakest.key && !completedLessonIds.has(l.id))
    : null

  const handleAiAction = () => {
    if (weakSubjectLesson?.video_url) {
      window.open(weakSubjectLesson.video_url, '_blank')
    } else {
      scrollTo('hero')
    }
  }

  const handleNextLessonStart = () => {
    if (nextLesson?.video_url) window.open(nextLesson.video_url, '_blank')
  }

  const projectedGain = weakest.current > 0
    ? clamp(Math.round((BENCHMARK.avg - weakest.current) / 2), 5, 15)
    : 8

  return (
    <div style={{ minHeight: '100vh', background: '#F4F6FA', fontFamily: 'Inter, -apple-system, sans-serif' }}>
      <style>{`
        .ozb-layout { display: grid; grid-template-columns: 2fr 1fr; gap: 20px; }
        .ozb-col { display: flex; flex-direction: column; gap: 20px; }
        @media (max-width: 900px) {
          .ozb-layout { grid-template-columns: 1fr; }
          .ozb-nav-links { display: none !important; }
          .ozb-hero-grid { flex-direction: column !important; }
          .ozb-hero-spark { width: 100% !important; margin-top: 16px; }
          .ozb-subjects-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <TopNavbar fullName={profile.full_name} daysToOrt={daysToOrt} onLogout={handleLogout} />
      <GreetingBar firstName={firstName} remaining={remaining} />

      <div style={{ maxWidth: '1180px', margin: '0 auto', padding: '20px 28px 60px' }}>
        <div className="ozb-layout">
          <div className="ozb-col">
            <HeroCard
              currentScore={currentScore}
              targetScore={targetScore}
              remaining={remaining}
              sparkline={sparkline}
              onContinue={() => nextLesson ? handleNextLessonStart() : scrollTo('subjects')}
            />
            <DailyPlanCard tasks={dailyTasks} />
            <SubjectAnalytics subjects={subjectStats} benchmark={BENCHMARK} />
            <div>
              <div style={{ fontWeight: 800, fontSize: '15px', color: '#0D1E4A', marginBottom: '12px' }}>
                В этом месяце
              </div>
              <StatsRow
                lessons={monthLessons}
                questions={monthQuestions}
                practiceTests={monthPractice}
                mockTests={monthMock}
                hours={monthHours}
              />
            </div>
          </div>

          <div className="ozb-col">
            <NextLessonCard
              lesson={nextLesson}
              subjectDone={nextLessonSubjectDone}
              subjectTotal={nextLessonSubjectLessons.length}
              onStart={handleNextLessonStart}
            />
            <AIAdvisorCard
              weakSubjectLabel={weakest.label}
              weakScore={weakest.current}
              avgScore={BENCHMARK.avg}
              projectedGain={projectedGain}
              ctaLabel={weakSubjectLesson ? `Начать: ${weakSubjectLesson.title}` : 'Пройти пробный ОРТ'}
              onAction={handleAiAction}
            />
            <StreakCard streak={streak} days={streakDays} />
          </div>
        </div>
      </div>
    </div>
  )
}
