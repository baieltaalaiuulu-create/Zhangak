import { supabase } from '@/lib/supabase'
import { calcStreak } from '@/lib/student-data'
import { fetchLessons, fetchCompletedLessonIds } from '@/lib/lessons-data'
import { fetchWeakSections, projectScore, recommendedPracticeCount, type WeakSection } from '@/lib/ai-coach-data'
import { currentWeekStart } from '@/lib/daily-challenge-data'

// Everything the redesigned dashboard (app/student/online/page.tsx) needs
// beyond getStudentDashboard()'s base fields (profile/score/streak/subject
// tracks) — kept in its own file rather than growing lib/student-data.ts,
// since that one is imported by many other pages for its plain types.

// ── Today's plan (4-item checklist) ──────────────────────────────────────

export type PlanItemKind = 'lesson' | 'practice' | 'mini_mock'

export interface TodayPlanItem {
  kind: PlanItemKind
  kindLabel: string       // "Урок" | "Тренажёр" | "Мини ОРТ"
  subjectLabel: string    // badge text, e.g. "Математика"
  subjectColor: string    // hex accent
  title: string           // e.g. "Системы уравнений" or "Тест: ..."
  meta: string            // e.g. "20 вопросов • 15 мин"
  done: boolean
  href: string
}

export interface TodayPlan {
  items: TodayPlanItem[]
  doneCount: number
  totalCount: number
  pct: number
  minutesRemaining: number
}

// ── Weekly progress stats ────────────────────────────────────────────────

export interface WeeklyStats {
  scoreDelta: number | null
  hoursThisWeek: number
  questionsThisWeek: number
  planPct: number
}

// ── Activity heatmap ─────────────────────────────────────────────────────

export interface HeatmapDay {
  date: string
  count: number
}

export interface HeatmapMonth {
  label: string
  isCurrent: boolean
}

// ── Subjects grid (2x2) ──────────────────────────────────────────────────

export type GridSubjectKey = 'math' | 'kyr' | 'analogy' | 'reading'

export interface SubjectGridItem {
  key: GridSubjectKey
  label: string
  topicLabel: string   // truncated blurb, e.g. current lesson title or section label
  color: string
  completed: number
  total: number
  hoursRemaining: number
  href: string
}

// ── AI Mentor recommendation ─────────────────────────────────────────────

export interface AIRecommendation {
  text: string
  projectedGain: number
}

// ── Achievements ──────────────────────────────────────────────────────────

export interface Achievement {
  icon: string
  title: string
  subtitle: string
}

export interface DashboardExtras {
  todayPlan: TodayPlan
  weeklyStats: WeeklyStats
  heatmapDays: HeatmapDay[]
  heatmapMonths: HeatmapMonth[]
  subjectsGrid: SubjectGridItem[]
  aiRecommendation: AIRecommendation
  achievements: Achievement[]
}

export const SUBJECT_GRID_META: Record<GridSubjectKey, { label: string; color: string }> = {
  math: { label: 'Математика', color: '#1B4FD8' },
  kyr: { label: 'Кыргыз тили', color: '#14B8A6' },
  analogy: { label: 'Аналогия', color: '#F5890A' },
  reading: { label: 'Окуу', color: '#8B5CF6' },
}

const ITEM_MINUTES: Record<PlanItemKind, number> = {
  lesson: 15,
  practice: 15,
  mini_mock: 10,
}

const MIN_PER_LESSON = 25
const MIN_PER_QUESTION = 2
const HEATMAP_DAYS = 91 // ~13 weeks

interface ResultRow {
  completed_at: string
  test_type: string | null
  lesson_id: string | null
  test_id: number | null
  math_raw_score: number | null
  math_comparison_score: number | null
  analogy_score: number | null
  reading_score: number | null
  grammar_score: number | null
  answers: Record<string, string> | null
}

function monthLabel(date: Date): string {
  return date.toLocaleDateString('ru', { month: 'long' }).replace(/^./, c => c.toUpperCase())
}

export async function fetchDashboardExtras(
  studentId: string,
  latestScore: number | null,
  previousScore: number | null,
): Promise<DashboardExtras> {
  const [resultsRes, lessons, completedLessonIds, weakSections, questionsRes] = await Promise.all([
    supabase
      .from('practice_results')
      .select('completed_at, test_type, lesson_id, test_id, math_raw_score, math_comparison_score, analogy_score, reading_score, grammar_score, answers')
      .eq('student_id', studentId)
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false }),
    fetchLessons(),
    fetchCompletedLessonIds(studentId),
    fetchWeakSections(studentId),
    supabase.from('questions').select('id, section').neq('section', 'general'),
  ])

  const results = (resultsRes.data ?? []) as ResultRow[]
  const now = new Date()
  const todayStr = now.toISOString().slice(0, 10)
  // Monday of the current week (local time) — matches weekly_leaderboard's
  // own week_start cadence elsewhere in the app, not a rolling 7-day window.
  const weekStartStr = currentWeekStart(now)

  const todayResults = results.filter(r => r.completed_at.slice(0, 10) === todayStr)
  const weekResults = results.filter(r => r.completed_at.slice(0, 10) >= weekStartStr)

  const answeredQuestionIds = new Set<number>()
  for (const r of results) {
    if (!r.answers) continue
    for (const idStr of Object.keys(r.answers)) {
      const id = Number(idStr)
      if (!Number.isNaN(id)) answeredQuestionIds.add(id)
    }
  }

  // ── Subject tracks (math/kyr) shared by both the plan and the grid ──────
  const mathLessons = lessons.filter(l => l.subject === 'math').sort((a, b) => a.order_number - b.order_number)
  const kyrLessons = lessons.filter(l => l.subject === 'kyr').sort((a, b) => a.order_number - b.order_number)
  const mathCompleted = mathLessons.filter(l => completedLessonIds.has(l.id)).length
  const kyrCompleted = kyrLessons.filter(l => completedLessonIds.has(l.id)).length
  const mathCurrent = mathLessons.find(l => !completedLessonIds.has(l.id)) ?? null
  const kyrCurrent = kyrLessons.find(l => !completedLessonIds.has(l.id)) ?? null

  const mathLessonDoneToday = mathLessons.some(l => todayResults.some(r => r.lesson_id === l.id))
  const kyrLessonDoneToday = kyrLessons.some(l => todayResults.some(r => r.lesson_id === l.id))
  const mathPracticeDoneToday = todayResults.some(r => (r.math_raw_score ?? 0) > 0 || (r.math_comparison_score ?? 0) > 0)
  const analogyTouchedToday = todayResults.some(r => (r.analogy_score ?? 0) > 0)

  // ── Today's plan ──────────────────────────────────────────────────────
  const weakMath = weakSections.find(s => s.section === 'math' || s.section === 'comparison') ?? null
  const practiceQuestionCount = weakMath ? recommendedPracticeCount(weakMath) : 15
  const practiceMinutes = Math.max(10, Math.round(practiceQuestionCount * 0.75))

  const items: TodayPlanItem[] = [
    {
      kind: 'lesson',
      kindLabel: 'Урок',
      subjectLabel: SUBJECT_GRID_META.math.label,
      subjectColor: SUBJECT_GRID_META.math.color,
      title: mathCurrent ? mathCurrent.title : 'Все уроки пройдены',
      meta: mathCurrent ? 'Видеоурок • 15 мин' : 'Выполнено',
      done: mathLessonDoneToday || !mathCurrent,
      href: mathCurrent ? `/student/online/lessons/${mathCurrent.id}` : '/student/online/lessons',
    },
    {
      kind: 'practice',
      kindLabel: 'Тренажёр',
      subjectLabel: SUBJECT_GRID_META.math.label,
      subjectColor: SUBJECT_GRID_META.math.color,
      title: weakMath ? `Тест: ${weakMath.label}` : 'Тест: Математика',
      meta: `${practiceQuestionCount} вопросов • ${practiceMinutes} мин`,
      done: mathPracticeDoneToday,
      href: '/student/online/practice?section=math',
    },
    {
      kind: 'lesson',
      kindLabel: 'Урок',
      subjectLabel: SUBJECT_GRID_META.kyr.label,
      subjectColor: SUBJECT_GRID_META.kyr.color,
      title: kyrCurrent ? kyrCurrent.title : 'Все уроки пройдены',
      meta: kyrCurrent ? 'Задача • 30 мин' : 'Выполнено',
      done: kyrLessonDoneToday || !kyrCurrent,
      href: kyrCurrent ? `/student/online/lessons/${kyrCurrent.id}` : '/student/online/lessons',
    },
    {
      kind: 'mini_mock',
      kindLabel: 'Мини ОРТ',
      subjectLabel: SUBJECT_GRID_META.analogy.label,
      subjectColor: SUBJECT_GRID_META.analogy.color,
      title: 'Раздел Аналогии',
      meta: 'Контроль • 10 мин',
      done: analogyTouchedToday,
      href: '/student/online/practice?section=analogy',
    },
  ]

  const doneCount = items.filter(i => i.done).length
  const minutesRemaining = items.filter(i => !i.done).reduce((sum, i) => sum + ITEM_MINUTES[i.kind], 0)

  const todayPlan: TodayPlan = {
    items,
    doneCount,
    totalCount: items.length,
    pct: Math.round((doneCount / items.length) * 100),
    minutesRemaining,
  }

  // ── Weekly stats ──────────────────────────────────────────────────────
  const questionsThisWeek = weekResults.reduce((sum, r) => sum + Object.keys(r.answers ?? {}).length, 0)

  // Real time spent, not a per-session guess: sum practice_tests.time_limit_minutes
  // for this week's attempts. Bank/section-only practice (test_id null) and
  // tests with no configured time limit contribute 0 — there's no "actual
  // elapsed time" column on practice_results to fall back on, and a fake
  // per-session estimate is exactly what this fix is removing.
  const weekTestIds = Array.from(new Set(weekResults.map(r => r.test_id).filter((id): id is number => id != null)))
  const { data: weekTestsRaw } = weekTestIds.length > 0
    ? await supabase.from('practice_tests').select('id, time_limit_minutes').in('id', weekTestIds)
    : { data: [] as { id: number; time_limit_minutes: number | null }[] }
  const minutesByTestId = new Map<number, number>()
  for (const t of weekTestsRaw ?? []) {
    if (t.time_limit_minutes != null) minutesByTestId.set(t.id, t.time_limit_minutes)
  }
  const totalMinutesThisWeek = weekResults.reduce((sum, r) => sum + (r.test_id != null ? minutesByTestId.get(r.test_id) ?? 0 : 0), 0)
  const hoursThisWeek = Math.round((totalMinutesThisWeek / 60) * 10) / 10

  const weeklyStats: WeeklyStats = {
    scoreDelta: latestScore != null && previousScore != null ? latestScore - previousScore : null,
    hoursThisWeek,
    questionsThisWeek,
    // Same "today's plan" completion the plan card above already computes
    // from real done/total counts — the "План" stat tile should report the
    // exact same number its label promises, not a different derived metric.
    planPct: todayPlan.pct,
  }

  // ── Heatmap ───────────────────────────────────────────────────────────
  const countByDate = new Map<string, number>()
  for (const r of results) {
    const d = r.completed_at.slice(0, 10)
    countByDate.set(d, (countByDate.get(d) ?? 0) + 1)
  }

  const heatmapDays: HeatmapDay[] = []
  for (let i = HEATMAP_DAYS - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    heatmapDays.push({ date: key, count: countByDate.get(key) ?? 0 })
  }

  const monthKeys: string[] = []
  for (const day of heatmapDays) {
    const key = day.date.slice(0, 7)
    if (!monthKeys.includes(key)) monthKeys.push(key)
  }
  const currentMonthKey = now.toISOString().slice(0, 7)
  const heatmapMonths: HeatmapMonth[] = monthKeys.map(key => ({
    label: monthLabel(new Date(`${key}-01T00:00:00`)),
    isCurrent: key === currentMonthKey,
  }))

  // ── Subjects grid ─────────────────────────────────────────────────────
  const questionRows = (questionsRes.data ?? []) as { id: number; section: string }[]
  function sectionCounts(sections: string[]): { total: number; completed: number } {
    const inSection = questionRows.filter(q => sections.includes(q.section))
    const completed = inSection.filter(q => answeredQuestionIds.has(q.id)).length
    return { total: inSection.length, completed }
  }
  const analogyCounts = sectionCounts(['analogy'])
  const readingCounts = sectionCounts(['reading'])

  const subjectsGrid: SubjectGridItem[] = [
    {
      key: 'math',
      label: SUBJECT_GRID_META.math.label,
      topicLabel: mathCurrent?.title ?? 'Все уроки пройдены',
      color: SUBJECT_GRID_META.math.color,
      completed: mathCompleted,
      total: mathLessons.length,
      hoursRemaining: Math.round(((mathLessons.length - mathCompleted) * MIN_PER_LESSON / 60) * 10) / 10,
      href: mathCurrent ? `/student/online/lessons/${mathCurrent.id}` : '/student/online/lessons',
    },
    {
      key: 'kyr',
      label: SUBJECT_GRID_META.kyr.label,
      topicLabel: kyrCurrent?.title ?? 'Все уроки пройдены',
      color: SUBJECT_GRID_META.kyr.color,
      completed: kyrCompleted,
      total: kyrLessons.length,
      hoursRemaining: Math.round(((kyrLessons.length - kyrCompleted) * MIN_PER_LESSON / 60) * 10) / 10,
      href: kyrCurrent ? `/student/online/lessons/${kyrCurrent.id}` : '/student/online/lessons',
    },
    {
      key: 'analogy',
      label: SUBJECT_GRID_META.analogy.label,
      topicLabel: 'Отношения между понятиями',
      color: SUBJECT_GRID_META.analogy.color,
      completed: analogyCounts.completed,
      total: analogyCounts.total,
      hoursRemaining: Math.round(((analogyCounts.total - analogyCounts.completed) * MIN_PER_QUESTION / 60) * 10) / 10,
      href: '/student/online/practice?section=analogy',
    },
    {
      key: 'reading',
      label: SUBJECT_GRID_META.reading.label,
      topicLabel: 'Понимание текста',
      color: SUBJECT_GRID_META.reading.color,
      completed: readingCounts.completed,
      total: readingCounts.total,
      hoursRemaining: Math.round(((readingCounts.total - readingCounts.completed) * MIN_PER_QUESTION / 60) * 10) / 10,
      href: '/student/online/practice?section=reading',
    },
  ]

  // ── AI Mentor recommendation ────────────────────────────────────────────
  const primary: WeakSection | null = weakSections[0] ?? null
  const secondary: WeakSection | null = weakSections[1] ?? null
  const aiRecommendation: AIRecommendation = primary
    ? {
        text: secondary
          ? `«Начни с ${primary.label} — это приоритетная тема для тебя сейчас. Также реши сегодня ${recommendedPracticeCount(secondary)} вопросов по ${secondary.label}, чтобы закрепить материал».`
          : `«Начни с ${primary.label} — это приоритетная тема для тебя сейчас. Реши сегодня ${recommendedPracticeCount(primary)} вопросов, чтобы закрепить материал».`,
        projectedGain: projectScore(latestScore ?? 0, primary).gain,
      }
    : {
        text: '«Пройди пару уроков и позанимайся в тренажёре — тогда я найду твои слабые темы и подскажу, с чего начать».',
        projectedGain: 0,
      }

  // ── Achievements ─────────────────────────────────────────────────────
  const totalLessonsCompleted = mathCompleted + kyrCompleted
  const totalQuestionsAnswered = answeredQuestionIds.size
  const streak = calcStreak(results.map(r => r.completed_at))

  const achievements: Achievement[] = []
  if (streak > 0) {
    const word = streak === 1 ? 'день' : streak < 5 ? 'дня' : 'дней'
    achievements.push({ icon: '🔥', title: `Серия ${streak} ${word}!`, subtitle: 'Держишь ежедневный темп' })
  }
  if (totalLessonsCompleted > 0) {
    achievements.push({ icon: '🏆', title: `Завершено ${totalLessonsCompleted} уроков`, subtitle: 'Успешно пройдена базовая программа' })
  }
  if (totalQuestionsAnswered > 0) {
    achievements.push({ icon: '💡', title: `Решено ${totalQuestionsAnswered} вопросов`, subtitle: 'Отличная база практических заданий' })
  }

  return {
    todayPlan,
    weeklyStats,
    heatmapDays,
    heatmapMonths,
    subjectsGrid,
    aiRecommendation,
    achievements,
  }
}
