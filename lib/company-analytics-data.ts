import { supabase } from '@/lib/supabase'
import { DEFAULT_TARGET_SCORE } from '@/lib/student-data'
import { authenticatedFetch } from '@/lib/authenticated-fetch'

// "Academic year" — Kyrgyz school year runs September→August, so a
// registration in e.g. March 2026 belongs to the 2025-2026 year, not
// calendar 2026. Used for the period tabs and the growth chart.
export function academicYearOf(dateStr: string): string {
  const d = new Date(dateStr)
  const y = d.getFullYear()
  const m = d.getMonth() // 0-indexed; 8 = September
  return m >= 8 ? `${y}-${y + 1}` : `${y - 1}-${y}`
}

export interface CompanyStats {
  totalStudents: number
  totalLessons: number
  totalQuestions: number
  testsCompleted: number
  avgScore: number
  admittedRate: number
}

export interface YearGrowth { year: string; count: number }
export interface ScoreBucket { bucket: string; count: number }
export interface PopularLesson { lessonId: string; title: string; views: number; errorRate: number }
export interface ScoreProgressionPoint { period: string; avgScore: number }

export interface CompanyAnalytics {
  years: string[]
  stats: CompanyStats
  growth: YearGrowth[]
  scoreDistribution: ScoreBucket[]
  popularLessons: PopularLesson[]
  scoreProgression: ScoreProgressionPoint[]
}

const SCORE_BUCKETS: { label: string; min: number; max: number }[] = [
  { label: '< 120', min: 0, max: 119 },
  { label: '120–149', min: 120, max: 149 },
  { label: '150–179', min: 150, max: 179 },
  { label: '180–209', min: 180, max: 209 },
  { label: '210+', min: 210, max: Infinity },
]

interface ProfileRow { id: string; created_at: string; target_score: number | null }
interface ResultRow {
  student_id: string
  test_type: string | null
  total_score: number | null
  completed_at: string
  lesson_id: string | null
  answers: Record<string, string> | null
}

export async function fetchCompanyAnalytics(yearFilter: string | null): Promise<CompanyAnalytics> {
  const [{ data: profilesRaw }, { data: lessonsRaw }, { count: totalQuestions }, { data: resultsRaw }] = await Promise.all([
    supabase.from('profiles').select('id, created_at, target_score').eq('role', 'student'),
    supabase.from('practice_lessons').select('id, title'),
    supabase.from('questions').select('*', { count: 'exact', head: true }),
    supabase
      .from('practice_results')
      .select('student_id, test_type, total_score, completed_at, lesson_id, answers')
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: true }),
  ])

  const students = (profilesRaw ?? []) as ProfileRow[]
  const lessons = (lessonsRaw ?? []) as { id: string; title: string }[]
  const results = (resultsRaw ?? []) as ResultRow[]

  const years = Array.from(new Set(students.map(s => academicYearOf(s.created_at)))).sort().reverse()

  const scopedStudentIds = yearFilter ? new Set(students.filter(s => academicYearOf(s.created_at) === yearFilter).map(s => s.id)) : null
  const scopedStudents = scopedStudentIds ? students.filter(s => scopedStudentIds.has(s.id)) : students
  const scopedResults = scopedStudentIds ? results.filter(r => scopedStudentIds.has(r.student_id)) : results

  // ── Stats ──────────────────────────────────────────────────────────────
  const mockResults = scopedResults.filter(r => r.test_type === 'mock')
  const avgScore = mockResults.length > 0 ? Math.round(mockResults.reduce((a, r) => a + (r.total_score ?? 0), 0) / mockResults.length) : 0

  // results is sorted ascending by completed_at, so the last write per
  // student in this loop is naturally their most recent (best-known) score.
  const latestScoreByStudent = new Map<string, number>()
  for (const r of mockResults) latestScoreByStudent.set(r.student_id, r.total_score ?? 0)
  const targetByStudent = new Map(scopedStudents.map(s => [s.id, s.target_score ?? DEFAULT_TARGET_SCORE]))
  const admittedCount = Array.from(latestScoreByStudent.entries()).filter(([id, score]) => score >= (targetByStudent.get(id) ?? DEFAULT_TARGET_SCORE)).length
  const admittedRate = latestScoreByStudent.size > 0 ? Math.round((admittedCount / latestScoreByStudent.size) * 100) : 0

  const stats: CompanyStats = {
    totalStudents: scopedStudents.length,
    totalLessons: lessons.length,
    totalQuestions: totalQuestions ?? 0,
    testsCompleted: scopedResults.length,
    avgScore,
    admittedRate,
  }

  // ── Growth by year — always the full population; this chart *is* the
  // year breakdown, so it isn't itself scoped by the year filter. ────────
  const growthMap = new Map<string, number>()
  for (const s of students) {
    const y = academicYearOf(s.created_at)
    growthMap.set(y, (growthMap.get(y) ?? 0) + 1)
  }
  const growth: YearGrowth[] = Array.from(growthMap.entries())
    .map(([year, count]) => ({ year, count }))
    .sort((a, b) => a.year.localeCompare(b.year))

  // ── Score distribution — each scoped student's latest mock score ──────
  const scoreDistribution: ScoreBucket[] = SCORE_BUCKETS.map(b => ({
    bucket: b.label,
    count: Array.from(latestScoreByStudent.values()).filter(s => s >= b.min && s <= b.max).length,
  }))

  // ── Popular lessons: view count + real error rate (answers decoded
  // against the actual questions, same approach as lib/ai-coach-data.ts) ─
  const lessonResults = scopedResults.filter(r => r.lesson_id && r.answers)
  const questionIds = new Set<number>()
  for (const r of lessonResults) {
    for (const idStr of Object.keys(r.answers ?? {})) {
      const id = Number(idStr)
      if (!Number.isNaN(id)) questionIds.add(id)
    }
  }
  const { data: questionsRaw } = questionIds.size > 0
    ? await supabase.from('questions').select('id, correct_answer').in('id', Array.from(questionIds))
    : { data: [] as { id: number; correct_answer: string }[] }
  const correctAnswerById = new Map((questionsRaw ?? []).map(q => [q.id, q.correct_answer]))

  const lessonTally = new Map<string, { views: number; correct: number; wrong: number }>()
  for (const r of lessonResults) {
    const entry = lessonTally.get(r.lesson_id!) ?? { views: 0, correct: 0, wrong: 0 }
    entry.views += 1
    for (const [idStr, given] of Object.entries(r.answers ?? {})) {
      const correctAnswer = correctAnswerById.get(Number(idStr))
      if (!correctAnswer) continue
      const isRight = correctAnswer.trim().toLowerCase()[0] === String(given).trim().toLowerCase()[0]
      if (isRight) entry.correct += 1; else entry.wrong += 1
    }
    lessonTally.set(r.lesson_id!, entry)
  }
  const lessonTitleById = new Map(lessons.map(l => [l.id, l.title]))
  const popularLessons: PopularLesson[] = Array.from(lessonTally.entries())
    .map(([lessonId, t]) => ({
      lessonId,
      title: lessonTitleById.get(lessonId) ?? 'Урок',
      views: t.views,
      errorRate: t.correct + t.wrong > 0 ? Math.round((t.wrong / (t.correct + t.wrong)) * 100) : 0,
    }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 10)

  // ── Average score progression, by month ────────────────────────────────
  const byMonth = new Map<string, { sum: number; count: number }>()
  for (const r of mockResults) {
    const month = r.completed_at.slice(0, 7)
    const entry = byMonth.get(month) ?? { sum: 0, count: 0 }
    entry.sum += r.total_score ?? 0
    entry.count += 1
    byMonth.set(month, entry)
  }
  const scoreProgression: ScoreProgressionPoint[] = Array.from(byMonth.entries())
    .map(([period, v]) => ({ period, avgScore: Math.round(v.sum / v.count) }))
    .sort((a, b) => a.period.localeCompare(b.period))

  return { years, stats, growth, scoreDistribution, popularLessons, scoreProgression }
}

// ── AI Insights ───────────────────────────────────────────────────────────

export async function fetchAnalyticsInsights(stats: Record<string, unknown>): Promise<string[]> {
  const res = await authenticatedFetch('/api/admin/analytics-insights', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stats }),
  })
  const data = await res.json()
  if (!res.ok || data.error) throw new Error(data.error ?? 'Не удалось получить инсайты')
  return data.insights as string[]
}
