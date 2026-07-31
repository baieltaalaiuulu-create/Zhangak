import { supabase } from '@/lib/supabase'

export const DEFAULT_TARGET_SCORE = 180
export const MIN_TARGET_SCORE = 100
export const MAX_TARGET_SCORE = 245

export type SubjectKey = 'math' | 'kyr' | 'analogy' | 'reading' | 'grammar'

export interface ScoreHistory {
  score: number
  completed_at: string
}

export interface SubjectStat {
  subject: SubjectKey
  current: number
  max: number
  delta: number // разница с предыдущим результатом
}

export interface DailyTask {
  id: string | number
  type: 'lesson' | 'practice' | 'mock' | 'homework'
  label: string
  sub: string
  done: boolean
  href: string
}

export interface StudentDashboardData {
  profile: { full_name: string; target_score: number } | null
  latestScore: number | null
  previousScore: number | null
  scoreHistory: ScoreHistory[]
  subjects: SubjectStat[]
  streak: number
  nextLesson: { id: string; title: string; subject: string; order_number: number } | null
  nextLessonProgress: number // % серии пройдено
  todayTasks: DailyTask[]
  monthStats: {
    lessons: number
    questions: number
    tests: number
    mocks: number
    hours: number
  }
}

// ── helpers ──────────────────────────────────────────────

function getScoreFromResult(r: Record<string, number>): number {
  return Math.round(
    (r.math_raw_score ?? 0) * 1.12 +
    (r.analogy_score ?? 0) * 2 +
    (r.reading_score ?? 0) * 2 +
    (r.grammar_score ?? 0) * 1.93
  )
}

function calcStreak(dates: string[]): number {
  if (!dates.length) return 0
  const unique = [...new Set(dates.map(d => d.slice(0, 10)))].sort().reverse()
  let streak = 0
  const today = new Date().toISOString().slice(0, 10)
  let cursor = today
  for (const d of unique) {
    if (d === cursor) {
      streak++
      const prev = new Date(cursor)
      prev.setDate(prev.getDate() - 1)
      cursor = prev.toISOString().slice(0, 10)
    } else {
      break
    }
  }
  return streak
}

// ── main fetch ────────────────────────────────────────────

export async function getStudentDashboard(): Promise<StudentDashboardData> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const studentId = user.id

  // 1. Profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, target_score')
    .eq('id', studentId)
    .single()

  // 2. All mock results (full ORT) ordered by date
  const { data: mockResults } = await supabase
    .from('practice_results')
    .select('total_score, math_raw_score, analogy_score, reading_score, grammar_score, completed_at, test_type')
    .eq('student_id', studentId)
    .eq('test_type', 'mock')
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(20)

  const mocks = mockResults ?? []
  const latestMock = mocks[0]
  const prevMock = mocks[1]

  const latestScore = latestMock
    ? (latestMock.total_score ?? getScoreFromResult(latestMock))
    : null

  const previousScore = prevMock
    ? (prevMock.total_score ?? getScoreFromResult(prevMock))
    : null

  const scoreHistory: ScoreHistory[] = mocks.slice(0, 8).reverse().map(r => ({
    score: r.total_score ?? getScoreFromResult(r),
    completed_at: r.completed_at,
  }))

  // 3. All results for streak + today check
  const { data: allResults } = await supabase
    .from('practice_results')
    .select('completed_at, test_type, lesson_id')
    .eq('student_id', studentId)
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false })

  const results = allResults ?? []
  const streak = calcStreak(results.map(r => r.completed_at))

  // 4. Subject stats — last 2 results per subject from practice results
  const { data: practiceResults } = await supabase
    .from('practice_results')
    .select('analogy_score, reading_score, grammar_score, math_raw_score, math_comparison_score, completed_at')
    .eq('student_id', studentId)
    .eq('test_type', 'practice')
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(40)

  const pr = practiceResults ?? []

  function lastTwo(getScore: (r: typeof pr[0]) => number): [number, number] {
    const vals = pr.map(getScore).filter(v => v > 0)
    return [vals[0] ?? 0, vals[1] ?? 0]
  }

  const [mathCur, mathPrev]     = lastTwo(r => r.math_raw_score ?? 0)
  const [analogyCur, analogyPrev] = lastTwo(r => r.analogy_score ?? 0)
  const [readingCur, readingPrev] = lastTwo(r => r.reading_score ?? 0)
  const [grammarCur, grammarPrev] = lastTwo(r => r.grammar_score ?? 0)

  const subjects: SubjectStat[] = [
    { subject: 'math',    current: mathCur,    max: 40, delta: mathCur - mathPrev },
    { subject: 'kyr',     current: grammarCur, max: 40, delta: grammarCur - grammarPrev },
    { subject: 'analogy', current: analogyCur, max: 20, delta: analogyCur - analogyPrev },
    { subject: 'reading', current: readingCur, max: 30, delta: readingCur - readingPrev },
  ]

  // 5. Next lesson
  // Find all completed lesson_ids today and ever
  const completedLessonIds = new Set(results.map(r => r.lesson_id).filter(Boolean))

  const { data: allLessons } = await supabase
    .from('practice_lessons')
    .select('id, title, subject, order_number')
    .order('order_number', { ascending: true })

  const lessons = allLessons ?? []
  const nextLesson = lessons.find(l => !completedLessonIds.has(l.id)) ?? null

  // Progress through lesson series
  const totalLessons = lessons.length
  const completedCount = lessons.filter(l => completedLessonIds.has(l.id)).length
  const nextLessonProgress = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0

  // 6. Today's tasks
  const todayStr = new Date().toISOString().slice(0, 10)
  const todayResults = results.filter(r => r.completed_at?.slice(0, 10) === todayStr)
  const todayLessonIds = new Set(todayResults.map(r => r.lesson_id).filter(Boolean))
  const todayMocks = todayResults.filter(r => r.test_type === 'mock')
  const todayPractice = todayResults.filter(r => r.test_type === 'practice')

  const todayTasks: DailyTask[] = [
    {
      id: 'lesson',
      type: 'lesson',
      label: nextLesson ? `Урок — ${nextLesson.title}` : 'Видеоурок',
      sub: '25 мин',
      done: nextLesson ? todayLessonIds.has(nextLesson.id) : false,
      href: nextLesson ? `/student/online/lessons/${nextLesson.id}` : '/student/online/lessons',
    },
    {
      id: 'practice',
      type: 'practice',
      label: 'Практика — 20 вопросов',
      sub: '30 мин',
      done: todayPractice.length > 0,
      href: '/student/online/practice',
    },
    {
      id: 'mock',
      type: 'mock',
      label: 'Мини ОРТ — 40 вопросов',
      sub: '40 мин',
      done: todayMocks.length > 0,
      href: '/student/online/mock',
    },
  ]

  // 7. Month stats
  const monthAgo = new Date()
  monthAgo.setDate(monthAgo.getDate() - 30)
  const monthStr = monthAgo.toISOString()

  const { data: monthResults } = await supabase
    .from('practice_results')
    .select('test_type, completed_at')
    .eq('student_id', studentId)
    .gte('completed_at', monthStr)

  const mr = monthResults ?? []
  const monthLessons = mr.filter(r => r.test_type === 'practice').length
  const monthMocks   = mr.filter(r => r.test_type === 'mock').length
  // Estimate: avg 30 questions per session, 45 min per session
  const monthStats = {
    lessons: monthLessons,
    questions: monthLessons * 20 + monthMocks * 40,
    tests: mr.length,
    mocks: monthMocks,
    hours: Math.round(mr.length * 0.75),
  }

  return {
    profile: profile ?? null,
    latestScore,
    previousScore,
    scoreHistory,
    subjects,
    streak,
    nextLesson,
    nextLessonProgress,
    todayTasks,
    monthStats,
  }
}
