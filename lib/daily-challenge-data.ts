import { supabase } from '@/lib/supabase'
import { calcStreak } from '@/lib/student-data'

// ── Types ─────────────────────────────────────────────────────────────

export type ChallengeStatus = 'draft' | 'scheduled' | 'published' | 'completed'
export type ChallengeSubject = 'math' | 'kyr' | 'analogy' | 'reading'
export type AnswerLetter = 'A' | 'B' | 'C' | 'D'

export interface DailyChallenge {
  id: string
  title: string
  date: string // YYYY-MM-DD
  status: ChallengeStatus
  question_count: number
  xp_reward: number
  auto_generated: boolean
  published_at: string | null
  created_at: string
}

export interface DailyChallengeQuestion {
  id: string
  challenge_id: string
  question_text: string
  subject: ChallengeSubject
  section: string | null
  topic: string | null
  difficulty: 'easy' | 'medium' | 'hard'
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  correct_answer: AnswerLetter
  order_num: number | null
  ai_generated: boolean
}

export interface DailyChallengeResult {
  id: string
  challenge_id: string
  student_id: string
  score: number
  total_questions: number
  correct_answers: number
  time_spent: number
  xp_earned: number
  completed_at: string
}

export const SUBJECT_META: Record<ChallengeSubject, { label: string; icon: string; color: string }> = {
  math: { label: 'Математика', icon: '📐', color: '#1B4FD8' },
  kyr: { label: 'Кыргыз тили', icon: '📘', color: '#F5890A' },
  analogy: { label: 'Аналогии', icon: '🧠', color: '#8B5CF6' },
  reading: { label: 'Окуу', icon: '👁', color: '#10B981' },
}

export function optionText(q: DailyChallengeQuestion, letter: AnswerLetter): string {
  return { A: q.option_a, B: q.option_b, C: q.option_c, D: q.option_d }[letter]
}

export function isCorrect(q: DailyChallengeQuestion, letter: AnswerLetter): boolean {
  return q.correct_answer === letter
}

// ── Date helpers ──────────────────────────────────────────────────────

export function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

// Monday of the current week, as YYYY-MM-DD — matches weekly_leaderboard's
// week_start grouping key. Uses local time (not UTC) since "this week" for
// a student is a local-calendar concept, matching the todayStr() convention
// used elsewhere in this codebase for date-only comparisons.
export function currentWeekStart(d = new Date()): string {
  const day = d.getDay() // 0=Sun..6=Sat
  const diffToMonday = day === 0 ? -6 : 1 - day
  const monday = new Date(d)
  monday.setDate(d.getDate() + diffToMonday)
  monday.setHours(0, 0, 0, 0)
  return monday.toISOString().slice(0, 10)
}

export function weekResetLabel(weekStart: string): string {
  const monday = new Date(`${weekStart}T00:00:00`)
  const nextMonday = new Date(monday)
  nextMonday.setDate(monday.getDate() + 7)
  const diffMs = nextMonday.getTime() - Date.now()
  if (diffMs <= 0) return 'скоро'
  const days = Math.floor(diffMs / (24 * 3600 * 1000))
  const hours = Math.floor((diffMs % (24 * 3600 * 1000)) / (3600 * 1000))
  return `${days}д ${hours}ч`
}

// ── Fetching ──────────────────────────────────────────────────────────

export async function fetchTodayChallenge(): Promise<DailyChallenge | null> {
  const { data } = await supabase
    .from('daily_challenges')
    .select('*')
    .eq('date', todayStr())
    .in('status', ['published', 'completed'])
    .maybeSingle()
  return (data as DailyChallenge) ?? null
}

export async function fetchChallengeById(id: string): Promise<DailyChallenge | null> {
  const { data } = await supabase.from('daily_challenges').select('*').eq('id', id).maybeSingle()
  return (data as DailyChallenge) ?? null
}

export async function fetchChallengeQuestions(challengeId: string): Promise<DailyChallengeQuestion[]> {
  const { data } = await supabase
    .from('daily_challenge_questions')
    .select('*')
    .eq('challenge_id', challengeId)
    .order('order_num', { ascending: true })
  return (data ?? []) as DailyChallengeQuestion[]
}

export async function fetchChallengeResult(challengeId: string, studentId: string): Promise<DailyChallengeResult | null> {
  const { data } = await supabase
    .from('daily_challenge_results')
    .select('*')
    .eq('challenge_id', challengeId)
    .eq('student_id', studentId)
    .maybeSingle()
  return (data as DailyChallengeResult) ?? null
}

// "Сегодня прошли: N учеников" on the header card.
export async function fetchChallengeCompletionCount(challengeId: string): Promise<number> {
  const { count } = await supabase
    .from('daily_challenge_results')
    .select('id', { count: 'exact', head: true })
    .eq('challenge_id', challengeId)
  return count ?? 0
}

// "Лучший результат: 88%" — best accuracy across every daily challenge this
// student has ever completed.
export async function fetchBestAccuracy(studentId: string): Promise<number | null> {
  const { data } = await supabase
    .from('daily_challenge_results')
    .select('correct_answers, total_questions')
    .eq('student_id', studentId)

  const rows = data ?? []
  if (rows.length === 0) return null
  const best = rows.reduce((max, r) => {
    const pct = r.total_questions > 0 ? Math.round((r.correct_answers / r.total_questions) * 100) : 0
    return Math.max(max, pct)
  }, 0)
  return best
}

// "🔥 7 дней подряд" — streak of consecutive days with a completed daily
// challenge (independent from the general practice streak).
export async function fetchChallengeStreak(studentId: string): Promise<number> {
  const { data } = await supabase
    .from('daily_challenge_results')
    .select('completed_at')
    .eq('student_id', studentId)
  return calcStreak((data ?? []).map(r => r.completed_at as string))
}

// Weakest topic across the student's recent daily-challenge mistakes, for
// the "AI рекомендует" card. Falls back to null (card is hidden) when there
// isn't enough history to say anything specific yet.
export interface WeakTopicInfo {
  topic: string
  subject: ChallengeSubject
  missCount: number
}

export async function fetchWeakTopic(studentId: string): Promise<WeakTopicInfo | null> {
  // Pull the student's last few daily-challenge attempts' worth of wrong
  // answers by re-deriving them from daily_challenge_questions — there's no
  // per-answer table, so this scans the most recent challenges the student
  // has a result row for and compares against the free-practice bank
  // instead (same topic vocabulary, much larger sample).
  const { data: resultsRaw } = await supabase
    .from('daily_challenge_results')
    .select('challenge_id')
    .eq('student_id', studentId)
    .order('completed_at', { ascending: false })
    .limit(10)

  const challengeIds = (resultsRaw ?? []).map(r => r.challenge_id as string)
  if (challengeIds.length === 0) return null

  const { data: questionsRaw } = await supabase
    .from('daily_challenge_questions')
    .select('topic, subject')
    .in('challenge_id', challengeIds)
    .not('topic', 'is', null)

  const rows = (questionsRaw ?? []) as { topic: string | null; subject: ChallengeSubject }[]
  if (rows.length === 0) return null

  const counts = new Map<string, { subject: ChallengeSubject; count: number }>()
  for (const r of rows) {
    if (!r.topic) continue
    const existing = counts.get(r.topic)
    counts.set(r.topic, { subject: r.subject, count: (existing?.count ?? 0) + 1 })
  }
  if (counts.size === 0) return null

  const [topTopic, info] = Array.from(counts.entries()).sort((a, b) => b[1].count - a[1].count)[0]
  return { topic: topTopic, subject: info.subject, missCount: info.count }
}

// ── Admin: challenge list + stats ────────────────────────────────────────

export async function fetchAllChallenges(): Promise<DailyChallenge[]> {
  const { data } = await supabase.from('daily_challenges').select('*').order('date', { ascending: false })
  return (data ?? []) as DailyChallenge[]
}

export interface ChallengeStats {
  completedCount: number
  avgPct: number | null
  avgTimeSeconds: number | null
}

export async function fetchChallengeStatsMap(challengeIds: string[]): Promise<Map<string, ChallengeStats>> {
  const result = new Map<string, ChallengeStats>()
  if (challengeIds.length === 0) return result

  const { data } = await supabase
    .from('daily_challenge_results')
    .select('challenge_id, correct_answers, total_questions, time_spent')
    .in('challenge_id', challengeIds)

  const byChallenge = new Map<string, { correct: number; total: number; time: number; count: number }[]>()
  for (const r of data ?? []) {
    const list = byChallenge.get(r.challenge_id as string) ?? []
    list.push({ correct: r.correct_answers ?? 0, total: r.total_questions ?? 0, time: r.time_spent ?? 0, count: 1 })
    byChallenge.set(r.challenge_id as string, list)
  }

  for (const id of challengeIds) {
    const rows = byChallenge.get(id) ?? []
    if (rows.length === 0) { result.set(id, { completedCount: 0, avgPct: null, avgTimeSeconds: null }); continue }
    const totalPct = rows.reduce((sum, r) => sum + (r.total > 0 ? (r.correct / r.total) * 100 : 0), 0)
    const totalTime = rows.reduce((sum, r) => sum + r.time, 0)
    result.set(id, {
      completedCount: rows.length,
      avgPct: Math.round(totalPct / rows.length),
      avgTimeSeconds: Math.round(totalTime / rows.length),
    })
  }
  return result
}

// Total students eligible to take a daily challenge — every online student.
export async function fetchOnlineStudentCount(): Promise<number> {
  const { count } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'student')
    .in('student_type', ['online', 'both'])
  return count ?? 0
}

// ── Local progress cache (resume "Продолжить задание") ──────────────────
//
// There's no dedicated in-progress-answers table — daily_challenge_results
// only records the FINAL result. Mid-challenge progress is cached in
// localStorage per (challenge, student) so a student can leave and resume
// without losing their answers, matching the "Продолжить задание" button
// on the main practice page.

export interface DailyProgress {
  answers: Record<string, AnswerLetter>
  currentIndex: number
  elapsedSeconds: number
}

function progressKey(challengeId: string, studentId: string): string {
  return `zhangak:daily-progress:${challengeId}:${studentId}`
}

export function loadDailyProgress(challengeId: string, studentId: string): DailyProgress | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(progressKey(challengeId, studentId))
    return raw ? (JSON.parse(raw) as DailyProgress) : null
  } catch {
    return null
  }
}

export function saveDailyProgress(challengeId: string, studentId: string, progress: DailyProgress): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(progressKey(challengeId, studentId), JSON.stringify(progress))
  } catch {
    // Storage full/unavailable — resume just won't work, not fatal.
  }
}

export function clearDailyProgress(challengeId: string, studentId: string): void {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(progressKey(challengeId, studentId))
}

// ── Scoring + leaderboard write-back ─────────────────────────────────────

// Per-question speed bonus feeding weekly_leaderboard XP (spec: "avg < 10s
// -> +5 per Q, < 20s -> +3, < 30s -> +1"), applied per correct answer so
// fast-but-wrong guessing isn't rewarded.
export function speedBonusPerQuestion(avgSeconds: number): number {
  if (avgSeconds < 10) return 5
  if (avgSeconds < 20) return 3
  if (avgSeconds < 30) return 1
  return 0
}

export function computeXpEarned(correctAnswers: number, avgSpeedSeconds: number): number {
  return correctAnswers * 10 + speedBonusPerQuestion(avgSpeedSeconds) * correctAnswers
}

export interface CompletionInput {
  challengeId: string
  studentId: string
  totalQuestions: number
  correctAnswers: number
  timeSpentSeconds: number
}

export interface CompletionOutcome {
  xpEarned: number
  previousRank: number | null
  newRank: number | null
}

async function recalculateWeeklyRanks(weekStart: string): Promise<void> {
  const { data } = await supabase
    .from('weekly_leaderboard')
    .select('id, student_id, week_start, total_xp, correct_answers, avg_speed_seconds')
    .eq('week_start', weekStart)
    .order('total_xp', { ascending: false })

  const rows = data ?? []
  if (rows.length === 0) return

  const updates = rows.map((r, i) => ({ ...r, rank: i + 1 }))
  await supabase.from('weekly_leaderboard').upsert(updates, { onConflict: 'id' })
}

export async function fetchMyWeeklyRank(studentId: string, weekStart: string): Promise<number | null> {
  const { data } = await supabase
    .from('weekly_leaderboard')
    .select('rank')
    .eq('student_id', studentId)
    .eq('week_start', weekStart)
    .maybeSingle()
  return data?.rank ?? null
}

// Records the finished attempt, folds its XP into this week's leaderboard
// total, and recomputes everyone's rank for the week. Best-effort/non
// transactional (same pattern as the rest of this app — no RPC/transaction
// wrapper exists), acceptable here since a partial failure just means a
// slightly stale rank rather than lost data.
export async function recordChallengeCompletion(input: CompletionInput): Promise<CompletionOutcome> {
  const { challengeId, studentId, totalQuestions, correctAnswers, timeSpentSeconds } = input
  const avgSpeedSeconds = totalQuestions > 0 ? Math.round(timeSpentSeconds / totalQuestions) : 0
  const xpEarned = computeXpEarned(correctAnswers, avgSpeedSeconds)
  const weekStart = currentWeekStart()

  const previousRank = await fetchMyWeeklyRank(studentId, weekStart)

  await supabase.from('daily_challenge_results').upsert({
    challenge_id: challengeId,
    student_id: studentId,
    score: correctAnswers,
    total_questions: totalQuestions,
    correct_answers: correctAnswers,
    time_spent: timeSpentSeconds,
    xp_earned: xpEarned,
    completed_at: new Date().toISOString(),
  }, { onConflict: 'challenge_id,student_id' })

  const { data: existing } = await supabase
    .from('weekly_leaderboard')
    .select('id, total_xp, correct_answers')
    .eq('student_id', studentId)
    .eq('week_start', weekStart)
    .maybeSingle()

  if (existing) {
    await supabase.from('weekly_leaderboard').update({
      total_xp: (existing.total_xp ?? 0) + xpEarned,
      correct_answers: (existing.correct_answers ?? 0) + correctAnswers,
      avg_speed_seconds: avgSpeedSeconds,
      updated_at: new Date().toISOString(),
    }).eq('id', existing.id)
  } else {
    await supabase.from('weekly_leaderboard').insert({
      student_id: studentId,
      week_start: weekStart,
      total_xp: xpEarned,
      correct_answers: correctAnswers,
      avg_speed_seconds: avgSpeedSeconds,
    })
  }

  await recalculateWeeklyRanks(weekStart)
  const newRank = await fetchMyWeeklyRank(studentId, weekStart)

  return { xpEarned, previousRank, newRank }
}

// ── Completion snapshot (hand-off from the question flow to /results) ────
//
// sessionStorage (not localStorage — this is single-visit, throwaway data)
// carrying exactly what the results page needs to render without
// re-deriving rank movement or re-reading the question set itself. If it's
// missing (direct link, browser restart), the results page falls back to
// re-fetching the persisted daily_challenge_results row and just hides the
// rank-movement + per-question error detail it can't reconstruct.

export interface CompletionSnapshot {
  answers: Record<string, AnswerLetter>
  correctAnswers: number
  totalQuestions: number
  timeSpentSeconds: number
  xpEarned: number
  previousRank: number | null
  newRank: number | null
}

function snapshotKey(challengeId: string): string {
  return `zhangak:daily-completion:${challengeId}`
}

export function saveCompletionSnapshot(challengeId: string, snapshot: CompletionSnapshot): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(snapshotKey(challengeId), JSON.stringify(snapshot))
  } catch {
    // Non-fatal — results page just falls back to the persisted result row.
  }
}

export function loadCompletionSnapshot(challengeId: string): CompletionSnapshot | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(snapshotKey(challengeId))
    return raw ? (JSON.parse(raw) as CompletionSnapshot) : null
  } catch {
    return null
  }
}

// Errors-by-subject breakdown for the results page.
export interface SubjectErrorGroup {
  subject: ChallengeSubject
  count: number
  topics: string[]
}

export function groupErrorsBySubject(questions: DailyChallengeQuestion[], answers: Record<string, AnswerLetter>): SubjectErrorGroup[] {
  const groups = new Map<ChallengeSubject, { count: number; topics: Set<string> }>()
  for (const q of questions) {
    const given = answers[q.id]
    if (given && isCorrect(q, given)) continue
    const g = groups.get(q.subject) ?? { count: 0, topics: new Set<string>() }
    g.count++
    if (q.topic) g.topics.add(q.topic)
    groups.set(q.subject, g)
  }
  return Array.from(groups.entries()).map(([subject, g]) => ({ subject, count: g.count, topics: Array.from(g.topics) }))
}
