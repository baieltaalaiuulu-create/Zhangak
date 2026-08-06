import { supabase } from '@/lib/supabase'
import {
  type PracticeQuestion, type AnswerLetter,
  fetchQuestions as fetchPracticeQuestions,
  correctLetter,
} from '@/lib/practice-data'

// Scheduling: practice_tests.scheduled_at (timestamptz, nullable) was added
// specifically for this feature. A mock session with scheduled_at=null keeps
// the original "available now, no schedule" behavior (backward-compatible
// with every mock test created before this column existed) — see
// getMockSessionStatus's 'open' status below. duration comes from the
// existing time_limit_minutes column (already used everywhere else as the
// exam's time budget), so no separate duration column was needed.
//
// mock_registrations(id, student_id, session_id, registered_at) is a new
// table — session_id references practice_tests(id) (the mock session IS a
// practice_tests row, same as everywhere else in this schema).

export { type PracticeQuestion, type AnswerLetter, correctLetter } from '@/lib/practice-data'
export const fetchMockQuestions = fetchPracticeQuestions

export interface MockTest {
  id: number
  title: string
  subject: 'math' | 'kyr' | 'all'
  time_limit_minutes: number | null
  max_attempts: number
  created_at: string
  scheduled_at: string | null
}

export type MockSessionStatus = 'upcoming' | 'live' | 'ended' | 'open'

const DEFAULT_MOCK_DURATION_MIN = 180

// 'open' = legacy/no-schedule mock test — always available, matches the
// pre-scheduling behavior exactly so existing active tests keep working.
export function getMockSessionStatus(session: MockTest, now: Date = new Date()): MockSessionStatus {
  if (!session.scheduled_at) return 'open'
  const start = new Date(session.scheduled_at)
  const durationMin = session.time_limit_minutes ?? DEFAULT_MOCK_DURATION_MIN
  const end = new Date(start.getTime() + durationMin * 60_000)
  if (now < start) return 'upcoming'
  if (now <= end) return 'live'
  return 'ended'
}

// Picks the single most relevant active mock session to show on the main
// mock page: a session that's live right now wins, then the soonest
// upcoming one, then any legacy no-schedule ("open") test. Ended sessions
// are never surfaced here — the page falls back to history-only display.
export async function fetchRelevantMockSession(): Promise<MockTest | null> {
  const { data } = await supabase
    .from('practice_tests')
    .select('id, title, subject, time_limit_minutes, max_attempts, created_at, scheduled_at')
    .eq('type', 'mock')
    .eq('is_active', true)

  const sessions = (data ?? []) as MockTest[]
  if (sessions.length === 0) return null

  const now = new Date()
  const withStatus = sessions.map(s => ({ session: s, status: getMockSessionStatus(s, now) }))

  const live = withStatus.find(x => x.status === 'live')
  if (live) return live.session

  const upcoming = withStatus
    .filter(x => x.status === 'upcoming')
    .sort((a, b) => new Date(a.session.scheduled_at!).getTime() - new Date(b.session.scheduled_at!).getTime())[0]
  if (upcoming) return upcoming.session

  const open = withStatus.find(x => x.status === 'open')
  return open?.session ?? null
}

export async function fetchMockTestById(id: number): Promise<MockTest | null> {
  const { data } = await supabase
    .from('practice_tests')
    .select('id, title, subject, time_limit_minutes, max_attempts, created_at, scheduled_at')
    .eq('id', id)
    .eq('type', 'mock')
    .maybeSingle()

  return (data as MockTest) ?? null
}

export interface MockRegistration {
  id: string
  student_id: string
  session_id: number
  registered_at: string
}

export async function fetchMyMockRegistration(studentId: string, sessionId: number): Promise<MockRegistration | null> {
  const { data } = await supabase
    .from('mock_registrations')
    .select('*')
    .eq('student_id', studentId)
    .eq('session_id', sessionId)
    .maybeSingle()

  return data ?? null
}

export async function fetchMockRegisteredCount(sessionId: number): Promise<number> {
  const { count } = await supabase
    .from('mock_registrations')
    .select('*', { count: 'exact', head: true })
    .eq('session_id', sessionId)

  return count ?? 0
}

export async function registerForMock(studentId: string, sessionId: number): Promise<void> {
  const { error } = await supabase
    .from('mock_registrations')
    .insert({ student_id: studentId, session_id: sessionId })
  // 23505 = unique_violation (student_id, session_id) — already registered,
  // treat as success rather than surfacing a confusing error.
  if (error && (error as { code?: string }).code !== '23505') throw new Error(error.message)
}

export async function fetchQuestionCount(testId: number): Promise<number> {
  const { count } = await supabase
    .from('questions')
    .select('*', { count: 'exact', head: true })
    .eq('practice_test_id', testId)

  return count ?? 0
}

// UI groups DB `section` values into the 4 tabs the exam screen navigates by.
// math_comparison_score is tracked (per the real column) but excluded from the
// total_score formula, matching the same convention already used in
// lib/student-data.ts's getScoreFromResult.
export type MockSectionKey = 'math' | 'grammar' | 'analogy' | 'reading'

export const MOCK_SECTION_TABS: { key: MockSectionKey; label: string; dbSections: string[] }[] = [
  { key: 'math', label: 'Математика', dbSections: ['math', 'comparison'] },
  { key: 'grammar', label: 'Кыргыз тили', dbSections: ['grammar'] },
  { key: 'analogy', label: 'Аналогия', dbSections: ['analogy'] },
  { key: 'reading', label: 'Окуу', dbSections: ['reading'] },
]

export function sectionTabFor(question: PracticeQuestion): MockSectionKey {
  const tab = MOCK_SECTION_TABS.find(t => t.dbSections.includes(question.section))
  return tab?.key ?? 'math'
}

export interface MockHistoryItem {
  id: string
  test_id: number
  total_score: number
  completed_at: string
}

export async function fetchMockHistory(studentId: string): Promise<MockHistoryItem[]> {
  const { data } = await supabase
    .from('practice_results')
    .select('id, test_id, total_score, completed_at')
    .eq('student_id', studentId)
    .eq('test_type', 'mock')
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false })

  return (data ?? []) as MockHistoryItem[]
}

export async function fetchAttemptCount(studentId: string, testId: number): Promise<number> {
  const { count } = await supabase
    .from('practice_results')
    .select('*', { count: 'exact', head: true })
    .eq('student_id', studentId)
    .eq('test_id', testId)
    .eq('test_type', 'mock')

  return count ?? 0
}

export interface SectionRawScores {
  math: number
  comparison: number
  analogy: number
  reading: number
  grammar: number
}

export function computeSectionRawScores(questions: PracticeQuestion[], answers: Record<number, AnswerLetter>): SectionRawScores {
  const raw: SectionRawScores = { math: 0, comparison: 0, analogy: 0, reading: 0, grammar: 0 }
  for (const q of questions) {
    const given = answers[q.id]
    if (!given) continue
    if (correctLetter(q) !== given) continue
    if (q.section === 'math') raw.math++
    else if (q.section === 'comparison') raw.comparison++
    else if (q.section === 'analogy') raw.analogy++
    else if (q.section === 'reading') raw.reading++
    else if (q.section === 'grammar') raw.grammar++
  }
  return raw
}

// Matches the ORT scoring formula used across the app (lib/student-data.ts,
// the zhangak-stack reference): comparison is tracked but not scored.
export function computeTotalScore(raw: SectionRawScores): number {
  return Math.round(raw.math * 1.12 + raw.analogy * 2 + raw.reading * 2 + raw.grammar * 1.93)
}

export interface SaveMockResultInput {
  studentId: string
  testId: number
  answers: Record<number, AnswerLetter>
  elapsedSeconds: number
  raw: SectionRawScores
}

export async function saveMockResult(input: SaveMockResultInput): Promise<string | null> {
  const totalScore = computeTotalScore(input.raw)
  const attemptNumber = (await fetchAttemptCount(input.studentId, input.testId)) + 1

  const { data, error } = await supabase
    .from('practice_results')
    .insert({
      student_id: input.studentId,
      test_id: input.testId,
      lesson_id: null,
      test_type: 'mock',
      math_raw_score: input.raw.math,
      math_comparison_score: input.raw.comparison,
      analogy_score: input.raw.analogy,
      reading_score: input.raw.reading,
      grammar_score: input.raw.grammar,
      total_score: totalScore,
      score: totalScore,
      attempt_number: attemptNumber,
      completed_at: new Date().toISOString(),
      answers: { responses: input.answers, elapsedSeconds: input.elapsedSeconds },
    })
    .select('id')
    .single()

  if (error || !data) return null
  return data.id as string
}

export interface MockResultDetail {
  id: string
  test_id: number
  student_id: string
  math_raw_score: number
  math_comparison_score: number
  analogy_score: number
  reading_score: number
  grammar_score: number
  total_score: number
  attempt_number: number
  completed_at: string
  elapsedSeconds: number
}

interface RawResultRow {
  id: string
  test_id: number
  student_id: string
  math_raw_score: number | null
  math_comparison_score: number | null
  analogy_score: number | null
  reading_score: number | null
  grammar_score: number | null
  total_score: number | null
  attempt_number: number | null
  completed_at: string
  answers: { responses?: Record<number, AnswerLetter>; elapsedSeconds?: number } | null
}

function toDetail(r: RawResultRow): MockResultDetail {
  return {
    id: r.id,
    test_id: r.test_id,
    student_id: r.student_id,
    math_raw_score: r.math_raw_score ?? 0,
    math_comparison_score: r.math_comparison_score ?? 0,
    analogy_score: r.analogy_score ?? 0,
    reading_score: r.reading_score ?? 0,
    grammar_score: r.grammar_score ?? 0,
    total_score: r.total_score ?? 0,
    attempt_number: r.attempt_number ?? 1,
    completed_at: r.completed_at,
    elapsedSeconds: r.answers?.elapsedSeconds ?? 0,
  }
}

// testId is required (not just resultId) so a result belonging to a different
// test — mock or otherwise — can never be shown on this test's results page.
export async function fetchMockResultById(resultId: string, testId: number): Promise<MockResultDetail | null> {
  const { data } = await supabase
    .from('practice_results')
    .select('id, test_id, student_id, math_raw_score, math_comparison_score, analogy_score, reading_score, grammar_score, total_score, attempt_number, completed_at, answers')
    .eq('id', resultId)
    .eq('test_id', testId)
    .eq('test_type', 'mock')
    .maybeSingle()

  return data ? toDetail(data as RawResultRow) : null
}

export async function fetchLatestMockResult(studentId: string, testId: number): Promise<MockResultDetail | null> {
  const { data } = await supabase
    .from('practice_results')
    .select('id, test_id, student_id, math_raw_score, math_comparison_score, analogy_score, reading_score, grammar_score, total_score, attempt_number, completed_at, answers')
    .eq('student_id', studentId)
    .eq('test_id', testId)
    .eq('test_type', 'mock')
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return data ? toDetail(data as RawResultRow) : null
}

// Most recent mock attempt strictly before `beforeIso`, across any mock test —
// used for the results page's score-delta comparison.
export async function fetchPreviousMockScore(studentId: string, beforeIso: string): Promise<number | null> {
  const { data } = await supabase
    .from('practice_results')
    .select('total_score')
    .eq('student_id', studentId)
    .eq('test_type', 'mock')
    .lt('completed_at', beforeIso)
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return data?.total_score ?? null
}

export interface LeaderboardRow {
  studentId: string
  fullName: string
  totalScore: number
  rank: number
}

export interface Leaderboard {
  top: LeaderboardRow[]
  me: LeaderboardRow | null
}

interface LeaderboardRawRow {
  student_id: string
  total_score: number | null
  profiles: { full_name: string | null } | null
}

export async function fetchLeaderboard(testId: number, studentId: string, limit = 10): Promise<Leaderboard> {
  const { data } = await supabase
    .from('practice_results')
    .select('student_id, total_score, profiles(full_name)')
    .eq('test_id', testId)
    .eq('test_type', 'mock')
    .not('completed_at', 'is', null)
    .order('total_score', { ascending: false })

  const rows = (data ?? []) as unknown as LeaderboardRawRow[]

  // One entry per student — keep their best attempt.
  const bestByStudent = new Map<string, LeaderboardRawRow>()
  for (const r of rows) {
    const existing = bestByStudent.get(r.student_id)
    if (!existing || (r.total_score ?? 0) > (existing.total_score ?? 0)) {
      bestByStudent.set(r.student_id, r)
    }
  }

  const ranked: LeaderboardRow[] = Array.from(bestByStudent.values())
    .sort((a, b) => (b.total_score ?? 0) - (a.total_score ?? 0))
    .map((r, i) => ({
      studentId: r.student_id,
      fullName: r.profiles?.full_name ?? 'Студент',
      totalScore: r.total_score ?? 0,
      rank: i + 1,
    }))

  const me = ranked.find(r => r.studentId === studentId) ?? null
  return { top: ranked.slice(0, limit), me }
}
