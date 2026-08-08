import { supabase } from '@/lib/supabase'
import { calcStreak, DEFAULT_TARGET_SCORE } from '@/lib/student-data'
import { fetchLatestMockScore } from '@/lib/profile-data'
import { fetchLessons, fetchCompletedLessonIds } from '@/lib/lessons-data'
import { fetchWeakSections, recommendedPracticeCount } from '@/lib/ai-coach-data'
import { fetchRelevantMockSession, getMockSessionStatus } from '@/lib/mock-data'
import { SECTION_LABELS } from '@/lib/practice-data'

// Everything the redesigned AI Mentor page's right-hand analytics panel
// needs, computed once from real Supabase data — nothing here is example
// copy, including the "AI помнит о тебе" traits (see buildMemoryTraits).

export interface GoalProgress {
  current: number
  target: number
  remaining: number
  pct: number
}

export interface MiniStats {
  tasksDoneToday: number
  tasksGoalToday: number
  streak: number
  minutesToday: number
}

export interface Recommendation {
  icon: string
  title: string
  subtitle: string
  href: string
}

export interface TopicProgress {
  section: string
  label: string
  pct: number
}

export interface ErrorReviewItem {
  section: string
  label: string
  count: number
  lastDate: string
}

export interface NextMockInfo {
  status: 'upcoming' | 'live' | 'ended' | 'open' | 'none'
  scheduledAt: string | null
  daysRemaining: number | null
}

export interface MemoryTrait {
  icon: string
  text: string
}

export interface PanelData {
  goal: GoalProgress
  miniStats: MiniStats
  recommendations: Recommendation[]
  weakTopics: TopicProgress[]
  strongTopics: TopicProgress[]
  errorReview: ErrorReviewItem[]
  nextMock: NextMockInfo
  memoryTraits: MemoryTrait[]
  weakestLabel: string | null
  secondWeakestLabel: string | null
}

const DAILY_TASK_GOAL = 8
const SESSION_MINUTES_ESTIMATE = 25
const TOP_COUNT = 3
const ERROR_REVIEW_ATTEMPTS = 30
const ERROR_REVIEW_LIMIT = 3

interface ResultRow {
  completed_at: string
  test_type: string | null
  answers: Record<string, string> | null
}

function timeOfDayLabel(hour: number): string {
  if (hour < 12) return 'утро'
  if (hour < 18) return 'день'
  return 'вечер'
}

export async function fetchPanelData(studentId: string): Promise<PanelData> {
  const [
    profileRes, latestScore, weakSections, lessons, completedLessonIds,
    nextMockSession, resultsRes,
  ] = await Promise.all([
    supabase.from('profiles').select('target_score').eq('id', studentId).single(),
    fetchLatestMockScore(studentId),
    fetchWeakSections(studentId),
    fetchLessons(),
    fetchCompletedLessonIds(studentId),
    fetchRelevantMockSession(),
    supabase
      .from('practice_results')
      .select('completed_at, test_type, answers')
      .eq('student_id', studentId)
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false })
      .limit(ERROR_REVIEW_ATTEMPTS),
  ])

  const target = profileRes.data?.target_score ?? DEFAULT_TARGET_SCORE
  const current = latestScore ?? 0
  const results = (resultsRes.data ?? []) as ResultRow[]

  // ── Goal progress ───────────────────────────────────────────────────
  const goal: GoalProgress = {
    current,
    target,
    remaining: Math.max(0, target - current),
    pct: target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0,
  }

  // ── Weak / strong topics (by correctness %) ──────────────────────────
  const withRatio = weakSections
    .filter(s => s.wrongCount + s.correctCount > 0)
    .map(s => ({ ...s, pct: Math.round((s.correctCount / (s.wrongCount + s.correctCount)) * 100) }))

  const weakTopics: TopicProgress[] = [...withRatio]
    .sort((a, b) => a.pct - b.pct)
    .slice(0, TOP_COUNT)
    .map(s => ({ section: s.section, label: s.label, pct: s.pct }))

  const strongTopics: TopicProgress[] = [...withRatio]
    .sort((a, b) => b.pct - a.pct)
    .filter(s => !weakTopics.some(w => w.section === s.section))
    .slice(0, TOP_COUNT)
    .map(s => ({ section: s.section, label: s.label, pct: s.pct }))

  const weakestLabel = weakTopics[0]?.label ?? null
  const secondWeakestLabel = weakTopics[1]?.label ?? null

  // ── Streak + "tasks today" + estimated study minutes today ──────────
  const streak = calcStreak(results.map(r => r.completed_at))
  const todayStr = new Date().toISOString().slice(0, 10)
  const todayResults = results.filter(r => r.completed_at.slice(0, 10) === todayStr)
  const tasksDoneToday = todayResults.length
  const minutesToday = todayResults.length * SESSION_MINUTES_ESTIMATE

  const miniStats: MiniStats = {
    tasksDoneToday: Math.min(tasksDoneToday, DAILY_TASK_GOAL),
    tasksGoalToday: DAILY_TASK_GOAL,
    streak,
    minutesToday,
  }

  // ── Recommendations ──────────────────────────────────────────────────
  const nextLesson = lessons
    .filter(l => !completedLessonIds.has(l.id))
    .sort((a, b) => a.order_number - b.order_number)[0]

  const recommendations: Recommendation[] = []
  if (weakTopics[0]) {
    recommendations.push({
      icon: '🔴',
      title: `Повторить ${weakTopics[0].label.toLowerCase()}`,
      subtitle: 'Слабая тема',
      href: `/student/online/practice?section=${weakTopics[0].section}`,
    })
  }
  if (weakTopics[1] || weakTopics[0]) {
    const target2 = weakTopics[1] ?? weakTopics[0]
    const count = recommendedPracticeCount({ section: target2.section, label: target2.label, wrongCount: 5, correctCount: 5 })
    recommendations.push({
      icon: '📐',
      title: `${count} задач по теме «${target2.label}»`,
      subtitle: 'Ежедневное',
      href: `/student/online/practice?section=${target2.section}`,
    })
  }
  if (nextLesson) {
    recommendations.push({
      icon: '▶',
      title: `Урок: ${nextLesson.title}`,
      subtitle: 'Следующий урок',
      href: `/student/online/lessons/${nextLesson.id}`,
    })
  }
  recommendations.push({
    icon: '⚡',
    title: 'Мини Quiz (5 минут)',
    subtitle: 'Быстрое',
    href: '/student/online/practice',
  })

  // ── Error review (grouped by section, most recent 3) ─────────────────
  // Needs each answer's question section — batch-fetch once for all
  // referenced question ids across the sampled attempts.
  const bySection = new Map<string, { count: number; lastDate: string }>()
  const questionIds = new Set<number>()
  for (const r of results) {
    if (!r.answers) continue
    for (const idStr of Object.keys(r.answers)) {
      const id = Number(idStr)
      if (!Number.isNaN(id)) questionIds.add(id)
    }
  }
  if (questionIds.size > 0) {
    const { data: questionsRaw } = await supabase
      .from('questions')
      .select('id, section, correct_answer')
      .in('id', Array.from(questionIds))
    const questionById = new Map<number, { section: string; correct_answer: string }>()
    for (const q of (questionsRaw ?? []) as { id: number; section: string; correct_answer: string }[]) {
      questionById.set(q.id, q)
    }

    for (const r of results) {
      if (!r.answers) continue
      for (const [idStr, given] of Object.entries(r.answers)) {
        const q = questionById.get(Number(idStr))
        if (!q || q.section === 'general') continue
        const isRight = q.correct_answer?.trim().toLowerCase()[0] === String(given).trim().toLowerCase()[0]
        if (isRight) continue
        const entry = bySection.get(q.section) ?? { count: 0, lastDate: r.completed_at }
        entry.count++
        if (r.completed_at > entry.lastDate) entry.lastDate = r.completed_at
        bySection.set(q.section, entry)
      }
    }
  }

  const errorReview: ErrorReviewItem[] = Array.from(bySection.entries())
    .map(([section, v]) => ({ section, label: SECTION_LABELS[section] ?? section, count: v.count, lastDate: v.lastDate }))
    .sort((a, b) => b.lastDate.localeCompare(a.lastDate))
    .slice(0, ERROR_REVIEW_LIMIT)

  // ── Next mock ─────────────────────────────────────────────────────────
  let nextMock: NextMockInfo = { status: 'none', scheduledAt: null, daysRemaining: null }
  if (nextMockSession) {
    const status = getMockSessionStatus(nextMockSession)
    const scheduledAt = nextMockSession.scheduled_at
    const daysRemaining = scheduledAt
      ? Math.max(0, Math.ceil((new Date(scheduledAt).getTime() - Date.now()) / 86_400_000))
      : null
    nextMock = { status, scheduledAt, daysRemaining }
  }

  // ── "AI помнит о тебе" — every trait derived from real data ──────────
  const hourCounts = new Map<string, number>()
  for (const r of results) {
    const hour = new Date(r.completed_at).getHours()
    const label = timeOfDayLabel(hour)
    hourCounts.set(label, (hourCounts.get(label) ?? 0) + 1)
  }
  const bestTime = [...hourCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

  const memoryTraits: MemoryTrait[] = []
  memoryTraits.push({ icon: '🎯', text: `Цель — ${target} баллов` })
  if (weakestLabel) memoryTraits.push({ icon: '📉', text: `Слабое место — ${weakestLabel}` })
  if (strongTopics[0]) memoryTraits.push({ icon: '💪', text: `Сильная сторона — ${strongTopics[0].label}` })
  if (bestTime) memoryTraits.push({ icon: '🕐', text: `Лучшее время для занятий — ${bestTime}` })
  if (streak > 0) memoryTraits.push({ icon: '🔥', text: `Серия — ${streak} ${streak === 1 ? 'день' : streak < 5 ? 'дня' : 'дней'} подряд` })

  return {
    goal, miniStats, recommendations, weakTopics, strongTopics, errorReview, nextMock, memoryTraits,
    weakestLabel, secondWeakestLabel,
  }
}
