import { supabase } from '@/lib/supabase'

export interface ProfileInfo {
  full_name: string
  phone: string | null
  student_type: string
  target_score: number
  avatar_url: string | null
}

export async function fetchProfileInfo(studentId: string): Promise<ProfileInfo | null> {
  const { data } = await supabase
    .from('profiles')
    .select('full_name, phone, student_type, target_score, avatar_url')
    .eq('id', studentId)
    .single()

  if (!data) return null
  return {
    full_name: data.full_name ?? 'Студент',
    phone: data.phone,
    student_type: data.student_type ?? 'offline',
    target_score: data.target_score ?? 180,
    avatar_url: data.avatar_url ?? null,
  }
}

export async function fetchLatestMockScore(studentId: string): Promise<number | null> {
  const { data } = await supabase
    .from('practice_results')
    .select('total_score')
    .eq('student_id', studentId)
    .eq('test_type', 'mock')
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return data?.total_score ?? null
}

export interface ScorePoint {
  score: number
  completedAt: string
}

// Chronological order (oldest → newest) — a sparkline reads left-to-right as time.
export async function fetchScoreHistory(studentId: string, limit = 5): Promise<ScorePoint[]> {
  const { data } = await supabase
    .from('practice_results')
    .select('total_score, completed_at')
    .eq('student_id', studentId)
    .eq('test_type', 'mock')
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(limit)

  return (data ?? [])
    .reverse()
    .map(r => ({ score: r.total_score ?? 0, completedAt: r.completed_at as string }))
}

export interface LearningProgress {
  lessonsCompleted: number
  lessonsTotal: number
  testsCompleted: number
  mocksCompleted: number
}

export async function fetchLearningProgress(studentId: string): Promise<LearningProgress> {
  const [{ count: lessonsTotal }, { data: completedRows }] = await Promise.all([
    supabase.from('practice_lessons').select('*', { count: 'exact', head: true }),
    supabase
      .from('practice_results')
      .select('test_type, lesson_id')
      .eq('student_id', studentId)
      .not('completed_at', 'is', null),
  ])

  const rows = completedRows ?? []
  const lessonsCompleted = new Set(rows.filter(r => r.lesson_id).map(r => r.lesson_id)).size
  const testsCompleted = rows.filter(r => r.test_type === 'practice').length
  const mocksCompleted = rows.filter(r => r.test_type === 'mock').length

  return { lessonsCompleted, lessonsTotal: lessonsTotal ?? 0, testsCompleted, mocksCompleted }
}

// "Questions solved" = correct answers across every completed attempt.
// practice attempts store their raw correct-count directly in `score`; mock
// attempts store per-section raw correct-counts instead (score/total_score
// there are the *weighted* ORT total, not a correct-count) — see
// lib/mock-data.ts's computeTotalScore. Summed per the type that actually
// applies rather than reusing `score` for both.
export async function fetchQuestionsSolvedCount(studentId: string): Promise<number> {
  const { data } = await supabase
    .from('practice_results')
    .select('test_type, score, math_raw_score, math_comparison_score, analogy_score, reading_score, grammar_score')
    .eq('student_id', studentId)
    .not('completed_at', 'is', null)

  return (data ?? []).reduce((sum, r) => {
    if (r.test_type === 'mock') {
      return sum + (r.math_raw_score ?? 0) + (r.math_comparison_score ?? 0) + (r.analogy_score ?? 0) + (r.reading_score ?? 0) + (r.grammar_score ?? 0)
    }
    return sum + (r.score ?? 0)
  }, 0)
}
