import { supabase } from '@/lib/supabase'
import { SECTION_LABELS } from '@/lib/practice-data'

// ── Weak sections ────────────────────────────────────────────────────────
//
// "Most wrong answers" is computed for real, not approximated from score
// ratios: every completed attempt's answers (jsonb: questionId -> letter)
// is decoded, the referenced questions are fetched once in bulk, and each
// answer is checked against that question's actual correct_answer/section.

export interface WeakSection {
  section: string
  label: string
  wrongCount: number
  correctCount: number
}

interface ResultAnswersRow {
  answers: Record<string, string> | null
}

interface QuestionLookupRow {
  id: number
  section: string
  correct_answer: string
}

export async function fetchWeakSections(studentId: string): Promise<WeakSection[]> {
  const { data: resultsRaw } = await supabase
    .from('practice_results')
    .select('answers')
    .eq('student_id', studentId)
    .not('completed_at', 'is', null)
    .not('answers', 'is', null)

  const results = (resultsRaw ?? []) as ResultAnswersRow[]

  const questionIds = new Set<number>()
  for (const r of results) {
    if (!r.answers) continue
    for (const idStr of Object.keys(r.answers)) {
      const id = Number(idStr)
      if (!Number.isNaN(id)) questionIds.add(id)
    }
  }
  if (questionIds.size === 0) return []

  const { data: questionsRaw } = await supabase
    .from('questions')
    .select('id, section, correct_answer')
    .in('id', Array.from(questionIds))

  const questionById = new Map<number, QuestionLookupRow>()
  for (const q of (questionsRaw ?? []) as QuestionLookupRow[]) questionById.set(q.id, q)

  const tally = new Map<string, { wrong: number; correct: number }>()
  for (const r of results) {
    if (!r.answers) continue
    for (const [idStr, given] of Object.entries(r.answers)) {
      const q = questionById.get(Number(idStr))
      // 'general' is invisible to ORT scoring and not a real practice
      // topic — skip it here too so it never surfaces as "weak".
      if (!q || q.section === 'general') continue

      const entry = tally.get(q.section) ?? { wrong: 0, correct: 0 }
      const isRight = q.correct_answer?.trim().toLowerCase()[0] === String(given).trim().toLowerCase()[0]
      if (isRight) entry.correct++
      else entry.wrong++
      tally.set(q.section, entry)
    }
  }

  return Array.from(tally.entries())
    .map(([section, v]) => ({
      section,
      label: SECTION_LABELS[section] ?? section,
      wrongCount: v.wrong,
      correctCount: v.correct,
    }))
    .sort((a, b) => b.wrongCount - a.wrongCount)
}

// How many questions a "quick practice" round recommends for a weak
// section — scaled to how far behind the student is, bounded to a
// reasonable single session (not the whole miss history at once).
export function recommendedPracticeCount(section: WeakSection): number {
  return Math.min(20, Math.max(5, section.wrongCount))
}

// ── Score projection ─────────────────────────────────────────────────────

// Same per-section weights as the ORT total_score formula (see the
// zhangak-stack reference / lib/student-data.ts) — comparison shares math's
// weight since it isn't itself a scored section.
const SCORE_COEFFICIENTS: Record<string, number> = {
  math: 1.12,
  comparison: 1.12,
  analogy: 2,
  reading: 2,
  grammar: 1.93,
}

const MAX_ORT_SCORE = 245

// Matches recommendedPracticeCount's cap — the projection assumes one
// focused practice round on the weakest section gets fixed, not every
// miss ever made.
const PROJECTION_FIX_CAP = 20

export interface ScoreProjection {
  current: number
  projected: number
  gain: number
}

export function projectScore(current: number, weakest: WeakSection | null): ScoreProjection {
  if (!weakest) return { current, projected: current, gain: 0 }
  const coefficient = SCORE_COEFFICIENTS[weakest.section] ?? 1
  const fixable = Math.min(weakest.wrongCount, PROJECTION_FIX_CAP)
  const projected = Math.min(MAX_ORT_SCORE, Math.round(current + fixable * coefficient))
  return { current, projected, gain: projected - current }
}

// ── Recent activity ──────────────────────────────────────────────────────

export interface RecentActivityItem {
  id: number
  type: 'mock' | 'practice'
  title: string
  score: number
  completedAt: string
}

interface RecentActivityRow {
  id: number
  test_type: string | null
  total_score: number | null
  score: number | null
  completed_at: string
  practice_tests: { title: string | null } | null
}

export async function fetchRecentActivity(studentId: string, limit = 8): Promise<RecentActivityItem[]> {
  const { data } = await supabase
    .from('practice_results')
    .select('id, test_type, total_score, score, completed_at, practice_tests(title)')
    .eq('student_id', studentId)
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(limit)

  const rows = (data ?? []) as unknown as RecentActivityRow[]
  return rows.map(r => {
    const isMock = r.test_type === 'mock'
    return {
      id: r.id,
      type: isMock ? 'mock' : 'practice',
      title: r.practice_tests?.title ?? (isMock ? 'Пробный ОРТ' : 'Практика'),
      score: isMock ? (r.total_score ?? 0) : (r.score ?? 0),
      completedAt: r.completed_at,
    }
  })
}
