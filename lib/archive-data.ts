import { supabase } from '@/lib/supabase'
import { DEFAULT_TARGET_SCORE } from '@/lib/student-data'
import { fetchAuthUsers } from '@/lib/admin-data'
import { fetchWeakSections, type WeakSection } from '@/lib/ai-coach-data'
import { fetchMockHistory, type MockHistoryItem } from '@/lib/mock-data'

// ── Archive list (/admin/archive) ────────────────────────────────────────
//
// There's no real "archived"/"graduated" flag in the schema (see the
// task's own "no migrations, use existing tables" constraint) — instead
// "archived" is derived from actual activity: a student who hasn't
// completed anything in ARCHIVE_INACTIVITY_DAYS reads as archived, one
// who has is active. That's a real, computable signal instead of an
// invented column, and the toggle on the list page filters by it.

const ARCHIVE_INACTIVITY_DAYS = 60
const STUDY_HOURS_PER_SESSION = 0.75 // same estimate used in lib/student-data.ts's monthStats

export interface ArchiveStudent {
  id: string
  full_name: string
  email: string | null
  phone: string | null
  avatar_url: string | null
  targetScore: number
  createdAt: string
  lastActivityAt: string | null
  durationDays: number
  finalScore: number | null
  progressPct: number
  lessonsCount: number
  testsCount: number
  questionsSolved: number
  archived: boolean
  admitted: boolean
  registrationYear: number
}

interface ResultAggRow {
  student_id: string
  test_type: string | null
  total_score: number | null
  score: number | null
  math_raw_score: number | null
  math_comparison_score: number | null
  analogy_score: number | null
  reading_score: number | null
  grammar_score: number | null
  completed_at: string
  lesson_id: string | null
}

function questionsSolvedFor(r: ResultAggRow): number {
  if (r.test_type === 'mock') {
    return (r.math_raw_score ?? 0) + (r.math_comparison_score ?? 0) + (r.analogy_score ?? 0) + (r.reading_score ?? 0) + (r.grammar_score ?? 0)
  }
  return r.score ?? 0
}

export async function fetchArchiveStudents(): Promise<ArchiveStudent[]> {
  const [{ data: profiles }, { data: resultsRaw }, authMap] = await Promise.all([
    supabase.from('profiles').select('id, full_name, phone, avatar_url, target_score, created_at').eq('role', 'student').order('full_name'),
    supabase
      .from('practice_results')
      .select('student_id, test_type, total_score, score, math_raw_score, math_comparison_score, analogy_score, reading_score, grammar_score, completed_at, lesson_id')
      .not('completed_at', 'is', null),
    fetchAuthUsers(),
  ])

  const results = (resultsRaw ?? []) as ResultAggRow[]
  const byStudent = new Map<string, ResultAggRow[]>()
  for (const r of results) {
    const list = byStudent.get(r.student_id) ?? []
    list.push(r)
    byStudent.set(r.student_id, list)
  }

  const now = Date.now()

  return (profiles ?? []).map(p => {
    const rows = (byStudent.get(p.id) ?? []).slice().sort((a, b) => a.completed_at.localeCompare(b.completed_at))
    const mockRows = rows.filter(r => r.test_type === 'mock')
    const lastActivityAt = rows.length > 0 ? rows[rows.length - 1].completed_at : null
    const finalScore = mockRows.length > 0 ? (mockRows[mockRows.length - 1].total_score ?? 0) : null
    const targetScore = p.target_score ?? DEFAULT_TARGET_SCORE
    const lessonsCount = new Set(rows.filter(r => r.lesson_id).map(r => r.lesson_id)).size
    const auth = authMap.get(p.id)
    const daysSinceActivity = lastActivityAt ? (now - new Date(lastActivityAt).getTime()) / 86_400_000 : Infinity

    return {
      id: p.id,
      full_name: p.full_name ?? '—',
      email: auth?.email ?? null,
      phone: p.phone,
      avatar_url: p.avatar_url,
      targetScore,
      createdAt: p.created_at,
      lastActivityAt,
      durationDays: Math.max(0, Math.round(((lastActivityAt ? new Date(lastActivityAt).getTime() : now) - new Date(p.created_at).getTime()) / 86_400_000)),
      finalScore,
      progressPct: finalScore !== null ? Math.min(100, Math.round((finalScore / targetScore) * 100)) : 0,
      lessonsCount,
      testsCount: rows.length,
      questionsSolved: rows.reduce((sum, r) => sum + questionsSolvedFor(r), 0),
      archived: daysSinceActivity >= ARCHIVE_INACTIVITY_DAYS,
      admitted: finalScore !== null && finalScore >= targetScore,
      registrationYear: new Date(p.created_at).getFullYear(),
    }
  })
}

export interface ArchiveStats {
  totalArchived: number
  avgFinalScore: number
  bestScore: number
  completionRate: number
  totalLessonsWatched: number
  totalQuestionsSolved: number
}

export function computeArchiveStats(students: ArchiveStudent[]): ArchiveStats {
  const archived = students.filter(s => s.archived)
  const withScore = archived.filter(s => s.finalScore !== null)
  const avgFinalScore = withScore.length > 0 ? Math.round(withScore.reduce((a, s) => a + (s.finalScore ?? 0), 0) / withScore.length) : 0
  const bestScore = withScore.length > 0 ? Math.max(...withScore.map(s => s.finalScore ?? 0)) : 0
  const admittedCount = archived.filter(s => s.admitted).length
  const completionRate = archived.length > 0 ? Math.round((admittedCount / archived.length) * 100) : 0

  return {
    totalArchived: archived.length,
    avgFinalScore,
    bestScore,
    completionRate,
    totalLessonsWatched: archived.reduce((a, s) => a + s.lessonsCount, 0),
    totalQuestionsSolved: archived.reduce((a, s) => a + s.questionsSolved, 0),
  }
}

function escapeCsvCell(cell: string): string {
  return /[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell
}

export function exportArchiveToCsv(students: ArchiveStudent[]): void {
  const headers = ['ФИО', 'Телефон', 'Email', 'Дата регистрации', 'Последняя активность', 'Длительность (дней)', 'Итоговый балл', 'Цель', 'Уроков', 'Тестов', 'Статус']
  const rows = students.map(s => [
    s.full_name,
    s.phone ?? '',
    s.email ?? '',
    new Date(s.createdAt).toLocaleDateString('ru'),
    s.lastActivityAt ? new Date(s.lastActivityAt).toLocaleDateString('ru') : '—',
    String(s.durationDays),
    s.finalScore !== null ? String(s.finalScore) : '—',
    String(s.targetScore),
    String(s.lessonsCount),
    String(s.testsCount),
    s.admitted ? 'Поступил' : 'Не поступил',
  ])
  const csv = [headers, ...rows].map(r => r.map(escapeCsvCell).join(',')).join('\n')
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `archive-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

// ── Student dossier (/admin/archive/[id]) ────────────────────────────────

export interface PaymentHistoryItem {
  id: number
  amount: number
  status: string
  month: string
  note: string | null
  created_at: string
}

export interface ScorePoint {
  score: number
  completedAt: string
}

export interface ProgressStats {
  first: number
  best: number
  latest: number
  avg: number
  target: number
  gain: number
}

export interface HeatmapDay {
  date: string
  count: number
}

export interface PracticeStats {
  totalSolved: number
  correctCount: number
  wrongCount: number
  correctPct: number
  hardTopics: WeakSection[]
}

export interface SubjectBreakdown {
  key: string
  label: string
  startScore: number
  endScore: number
  lessonsCount: number
  practiceCount: number
}

export type AchievementKey =
  | 'first_lesson' | 'hundred_questions' | 'week_streak' | 'first_mock'
  | 'target_reached' | 'course_completed' | 'active_learner'

export interface Achievement {
  key: AchievementKey
  achieved: boolean
}

export interface TimelineEvent {
  key: string
  label: string
  date: string | null
  achieved: boolean
}

export interface StudentDossier {
  profile: ArchiveStudent
  payments: PaymentHistoryItem[]
  paidTotal: number
  scoreHistory: ScorePoint[]
  progressStats: ProgressStats
  studyHours: number
  streak: number
  bestStreak: number
  heatmap: HeatmapDay[]
  practiceStats: PracticeStats
  mockHistory: MockHistoryItem[]
  subjects: SubjectBreakdown[]
  achievements: Achievement[]
  timeline: TimelineEvent[]
}

// Longest run of consecutive active days across the student's whole
// history — distinct from lib/student-data.ts's calcStreak, which is the
// *current* streak counted back from today and would read 0 for anyone
// no longer active (exactly the population this page is about).
function longestStreak(dates: string[]): number {
  if (dates.length === 0) return 0
  const uniqueSorted = [...new Set(dates.map(d => d.slice(0, 10)))].sort()
  let longest = 1
  let current = 1
  for (let i = 1; i < uniqueSorted.length; i++) {
    const prev = new Date(uniqueSorted[i - 1])
    const cur = new Date(uniqueSorted[i])
    const diffDays = Math.round((cur.getTime() - prev.getTime()) / 86_400_000)
    current = diffDays === 1 ? current + 1 : 1
    longest = Math.max(longest, current)
  }
  return longest
}

const HEATMAP_DAYS = 84 // ~12 weeks, GitHub-style contribution grid

function buildHeatmap(dates: string[]): HeatmapDay[] {
  const counts = new Map<string, number>()
  for (const d of dates) {
    const day = d.slice(0, 10)
    counts.set(day, (counts.get(day) ?? 0) + 1)
  }
  const days: HeatmapDay[] = []
  for (let i = HEATMAP_DAYS - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    days.push({ date: key, count: counts.get(key) ?? 0 })
  }
  return days
}

interface SubjectDef { key: string; label: string; column: keyof ResultAggRow; lessonSubject: 'math' | 'kyr' | null }

const SUBJECT_DEFS: SubjectDef[] = [
  { key: 'math', label: 'Математика', column: 'math_raw_score', lessonSubject: 'math' },
  { key: 'grammar', label: 'Кыргыз тили', column: 'grammar_score', lessonSubject: 'kyr' },
  { key: 'analogy', label: 'Аналогия', column: 'analogy_score', lessonSubject: null },
  { key: 'reading', label: 'Чтение', column: 'reading_score', lessonSubject: null },
]

export async function fetchStudentDossier(studentId: string): Promise<StudentDossier | null> {
  const [{ data: profileRow }, { data: resultsRaw }, { data: paymentsRaw }, { data: lessonsRaw }, authMap, weakSections, mockHistory] = await Promise.all([
    supabase.from('profiles').select('id, full_name, phone, avatar_url, target_score, created_at').eq('id', studentId).single(),
    supabase
      .from('practice_results')
      .select('student_id, test_type, total_score, score, math_raw_score, math_comparison_score, analogy_score, reading_score, grammar_score, completed_at, lesson_id')
      .eq('student_id', studentId)
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: true }),
    supabase.from('payments').select('*').eq('student_id', studentId).order('created_at', { ascending: false }),
    supabase.from('practice_lessons').select('id, subject'),
    fetchAuthUsers(),
    fetchWeakSections(studentId),
    fetchMockHistory(studentId),
  ])

  if (!profileRow) return null

  const results = (resultsRaw ?? []) as ResultAggRow[]
  const lessons = (lessonsRaw ?? []) as { id: string; subject: 'math' | 'kyr' }[]
  const lessonSubjectById = new Map(lessons.map(l => [l.id, l.subject]))

  const targetScore = profileRow.target_score ?? DEFAULT_TARGET_SCORE
  const auth = authMap.get(profileRow.id)
  const lastActivityAt = results.length > 0 ? results[results.length - 1].completed_at : null
  const now = Date.now()
  const daysSinceActivity = lastActivityAt ? (now - new Date(lastActivityAt).getTime()) / 86_400_000 : Infinity
  const mockRows = results.filter(r => r.test_type === 'mock')
  const finalScore = mockRows.length > 0 ? (mockRows[mockRows.length - 1].total_score ?? 0) : null
  const lessonsCount = new Set(results.filter(r => r.lesson_id).map(r => r.lesson_id)).size

  const profile: ArchiveStudent = {
    id: profileRow.id,
    full_name: profileRow.full_name ?? '—',
    email: auth?.email ?? null,
    phone: profileRow.phone,
    avatar_url: profileRow.avatar_url,
    targetScore,
    createdAt: profileRow.created_at,
    lastActivityAt,
    durationDays: Math.max(0, Math.round(((lastActivityAt ? new Date(lastActivityAt).getTime() : now) - new Date(profileRow.created_at).getTime()) / 86_400_000)),
    finalScore,
    progressPct: finalScore !== null ? Math.min(100, Math.round((finalScore / targetScore) * 100)) : 0,
    lessonsCount,
    testsCount: results.length,
    questionsSolved: results.reduce((sum, r) => sum + questionsSolvedFor(r), 0),
    archived: daysSinceActivity >= ARCHIVE_INACTIVITY_DAYS,
    admitted: finalScore !== null && finalScore >= targetScore,
    registrationYear: new Date(profileRow.created_at).getFullYear(),
  }

  // Финансы
  const payments = (paymentsRaw ?? []) as PaymentHistoryItem[]
  const paidTotal = payments.filter(p => p.status === 'paid').reduce((a, p) => a + p.amount, 0)

  // Прогресс — full mock score history + summary stats
  const scoreHistory: ScorePoint[] = mockRows.map(r => ({ score: r.total_score ?? 0, completedAt: r.completed_at }))
  const scores = scoreHistory.map(s => s.score)
  const progressStats: ProgressStats = scores.length > 0
    ? {
        first: scores[0],
        best: Math.max(...scores),
        latest: scores[scores.length - 1],
        avg: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
        target: targetScore,
        gain: scores[scores.length - 1] - scores[0],
      }
    : { first: 0, best: 0, latest: 0, avg: 0, target: targetScore, gain: 0 }

  // Обучение
  const activityDates = results.map(r => r.completed_at)
  const studyHours = Math.round(results.length * STUDY_HOURS_PER_SESSION)
  const bestStreak = longestStreak(activityDates)
  const heatmap = buildHeatmap(activityDates)
  // Current streak, same definition as the student-facing dashboard —
  // included for symmetry even though it'll read 0 for anyone archived.
  const uniqueDaysDesc = [...new Set(activityDates.map(d => d.slice(0, 10)))].sort().reverse()
  let streak = 0
  let cursor = new Date().toISOString().slice(0, 10)
  for (const d of uniqueDaysDesc) {
    if (d === cursor) {
      streak++
      const prev = new Date(cursor)
      prev.setDate(prev.getDate() - 1)
      cursor = prev.toISOString().slice(0, 10)
    } else break
  }

  // Практика — real wrong/correct tally from lib/ai-coach-data.ts, decoded
  // from the student's actual stored answers against the real questions.
  const correctCount = weakSections.reduce((a, s) => a + s.correctCount, 0)
  const wrongCount = weakSections.reduce((a, s) => a + s.wrongCount, 0)
  const practiceStats: PracticeStats = {
    totalSolved: correctCount + wrongCount,
    correctCount,
    wrongCount,
    correctPct: correctCount + wrongCount > 0 ? Math.round((correctCount / (correctCount + wrongCount)) * 100) : 0,
    hardTopics: weakSections.slice(0, 5),
  }

  // Предметы
  const subjects: SubjectBreakdown[] = SUBJECT_DEFS.map(def => {
    const touched = results.filter(r => (r[def.column] as number | null) !== null && (r[def.column] as number) > 0)
    const startScore = touched.length > 0 ? (touched[0][def.column] as number) : 0
    const endScore = touched.length > 0 ? (touched[touched.length - 1][def.column] as number) : 0
    const lessonsForSubject = def.lessonSubject
      ? new Set(results.filter(r => r.lesson_id && lessonSubjectById.get(r.lesson_id) === def.lessonSubject).map(r => r.lesson_id)).size
      : 0
    return { key: def.key, label: def.label, startScore, endScore, lessonsCount: lessonsForSubject, practiceCount: touched.length }
  })

  // Достижения — computed from the data above, not a stored flag.
  const achievements: Achievement[] = [
    { key: 'first_lesson', achieved: lessonsCount >= 1 },
    { key: 'hundred_questions', achieved: practiceStats.totalSolved >= 100 },
    { key: 'week_streak', achieved: bestStreak >= 7 },
    { key: 'first_mock', achieved: mockRows.length >= 1 },
    { key: 'target_reached', achieved: profile.admitted },
    { key: 'course_completed', achieved: profile.archived && profile.admitted },
    { key: 'active_learner', achieved: results.length >= 20 },
  ]

  // Таймлайн
  let cumulative = 0
  let hundredQuestionsDate: string | null = null
  for (const r of results) {
    cumulative += questionsSolvedFor(r)
    if (cumulative >= 100 && !hundredQuestionsDate) hundredQuestionsDate = r.completed_at
  }
  const firstLesson = results.find(r => r.lesson_id)
  const firstMock = mockRows[0]
  const first180 = mockRows.find(r => (r.total_score ?? 0) >= 180)

  const timeline: TimelineEvent[] = [
    { key: 'registration', label: 'Регистрация', date: profile.createdAt, achieved: true },
    { key: 'first_lesson', label: 'Первый урок', date: firstLesson?.completed_at ?? null, achieved: !!firstLesson },
    { key: 'hundred_questions', label: 'Первые 100 вопросов', date: hundredQuestionsDate, achieved: !!hundredQuestionsDate },
    { key: 'first_mock', label: 'Первый пробный ОРТ', date: firstMock?.completed_at ?? null, achieved: !!firstMock },
    { key: 'score_180', label: 'Балл 180+', date: first180?.completed_at ?? null, achieved: !!first180 },
    { key: 'course_completed', label: 'Завершение курса', date: profile.archived ? profile.lastActivityAt : null, achieved: profile.archived },
  ]

  return {
    profile, payments, paidTotal, scoreHistory, progressStats, studyHours, streak, bestStreak, heatmap,
    practiceStats, mockHistory, subjects, achievements, timeline,
  }
}
