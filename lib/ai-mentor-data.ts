import { supabase } from '@/lib/supabase'
import { calcStreak, DEFAULT_TARGET_SCORE } from '@/lib/student-data'
import { fetchLatestMockScore, fetchLearningProgress } from '@/lib/profile-data'
import { fetchWeakSections, fetchRecentActivity, type WeakSection } from '@/lib/ai-coach-data'
import { SECTION_LABELS } from '@/lib/practice-data'

// ── Student context (fed to the /api/ai-mentor system prompt) ───────────

export interface StudentContext {
  name: string
  currentScore: number
  targetScore: number
  streak: number
  weakSections: string[]
  strongSections: string[]
  recentResults: string[]
  completedLessons: number
  recentErrors: string[]
}

const TOP_SECTIONS_COUNT = 3
const RECENT_ERRORS_LIMIT = 5
const RECENT_ATTEMPTS_FOR_ERRORS = 5
const ERROR_TEXT_TRUNCATE = 80

interface RecentAnswerRow {
  answers: Record<string, string> | null
  completed_at: string
}

interface ErrorQuestionRow {
  id: number
  question_text: string | null
  section: string
  correct_answer: string
}

// Real per-question wrong answers from the student's most recent attempts —
// same decode-answers-against-questions approach as fetchWeakSections in
// lib/ai-coach-data.ts, just scoped to recency instead of totals.
async function fetchRecentErrors(studentId: string): Promise<string[]> {
  const { data: resultsRaw } = await supabase
    .from('practice_results')
    .select('answers, completed_at')
    .eq('student_id', studentId)
    .not('completed_at', 'is', null)
    .not('answers', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(RECENT_ATTEMPTS_FOR_ERRORS)

  const results = (resultsRaw ?? []) as RecentAnswerRow[]
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
    .select('id, question_text, section, correct_answer')
    .in('id', Array.from(questionIds))

  const questionById = new Map<number, ErrorQuestionRow>()
  for (const q of (questionsRaw ?? []) as ErrorQuestionRow[]) questionById.set(q.id, q)

  const errors: string[] = []
  for (const r of results) {
    if (!r.answers) continue
    for (const [idStr, given] of Object.entries(r.answers)) {
      const q = questionById.get(Number(idStr))
      if (!q || q.section === 'general') continue
      const isRight = q.correct_answer?.trim().toLowerCase()[0] === String(given).trim().toLowerCase()[0]
      if (isRight) continue
      const label = SECTION_LABELS[q.section] ?? q.section
      const text = (q.question_text ?? '').slice(0, ERROR_TEXT_TRUNCATE)
      errors.push(`${label}: ${text}`)
      if (errors.length >= RECENT_ERRORS_LIMIT) return errors
    }
  }
  return errors
}

// fetchWeakSections returns every section the student has ever touched,
// worst-first. Weak = highest wrong ratio, strong = lowest — a section
// can't be both, so strong excludes whatever already made the weak cut.
function splitStrongWeak(sections: WeakSection[]): { weak: string[]; strong: string[] } {
  const withRatio = sections
    .filter(s => s.wrongCount + s.correctCount > 0)
    .map(s => ({ ...s, wrongRatio: s.wrongCount / (s.wrongCount + s.correctCount) }))

  const weak = [...withRatio].sort((a, b) => b.wrongRatio - a.wrongRatio).slice(0, TOP_SECTIONS_COUNT)
  const strong = [...withRatio]
    .sort((a, b) => a.wrongRatio - b.wrongRatio)
    .filter(s => !weak.some(w => w.section === s.section))
    .slice(0, TOP_SECTIONS_COUNT)

  return { weak: weak.map(s => s.label), strong: strong.map(s => s.label) }
}

export async function fetchStudentContext(studentId: string): Promise<StudentContext> {
  const [profileRes, currentScore, weakSectionsRaw, recentActivity, progress, recentErrors, allResults] = await Promise.all([
    supabase.from('profiles').select('full_name, target_score').eq('id', studentId).single(),
    fetchLatestMockScore(studentId),
    fetchWeakSections(studentId),
    fetchRecentActivity(studentId, 5),
    fetchLearningProgress(studentId),
    fetchRecentErrors(studentId),
    supabase.from('practice_results').select('completed_at').eq('student_id', studentId).not('completed_at', 'is', null),
  ])

  const streak = calcStreak((allResults.data ?? []).map(r => r.completed_at as string))
  const { weak, strong } = splitStrongWeak(weakSectionsRaw)

  return {
    name: profileRes.data?.full_name ?? 'Студент',
    currentScore: currentScore ?? 0,
    targetScore: profileRes.data?.target_score ?? DEFAULT_TARGET_SCORE,
    streak,
    weakSections: weak,
    strongSections: strong,
    recentResults: recentActivity.map(a => `${a.title}: ${a.score} (${new Date(a.completedAt).toLocaleDateString('ru')})`),
    completedLessons: progress.lessonsCompleted,
    recentErrors,
  }
}

// ── Chat with the mentor ─────────────────────────────────────────────────

export type MentorCardType = 'theory' | 'task' | 'analysis' | 'plan' | 'motivation' | 'error'

export interface MentorResponse {
  type: MentorCardType
  title: string
  content: string
  actions: string[]
}

export interface ChatHistoryTurn {
  role: 'user' | 'assistant'
  content: string
}

// A rendered chat message — user turns are plain text, assistant turns
// carry the structured card returned by the API.
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  card?: MentorResponse
}

export interface PageContext {
  page: 'lesson' | 'practice' | 'mock' | 'dashboard' | 'profile'
  contextData: Record<string, unknown>
}

// The API route streams plain text with a small header block first
// (TYPE:/TITLE:/ACTIONS: lines, then a blank line, then the free-flowing
// content) — see app/api/ai-mentor/route.ts for the exact protocol. This
// parses that incrementally: once "\n\n" has arrived the header fields are
// fixed, and every subsequent chunk just grows `content`. `onUpdate` fires
// on every chunk (so the caller can render progressively) and once more
// with `done: true` at the end.
export interface MentorStreamUpdate {
  type: MentorCardType
  title: string
  content: string
  actions: string[]
  done: boolean
}

const VALID_TYPES: MentorCardType[] = ['theory', 'task', 'analysis', 'plan', 'motivation', 'error']

export async function streamMentorMessage(
  message: string,
  studentContext: StudentContext,
  history: ChatHistoryTurn[],
  pageContext: PageContext | undefined,
  expectedType: MentorCardType | undefined,
  onUpdate: (update: MentorStreamUpdate) => void,
): Promise<void> {
  const res = await fetch('/api/ai-mentor', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, studentContext, history, pageContext, expectedType }),
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error ?? 'Не удалось получить ответ от AI')
  }
  if (!res.body) throw new Error('Пустой ответ от AI')

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let headerEndIndex = -1
  let type: MentorCardType = 'theory'
  let title = ''
  let actions: string[] = []

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    if (headerEndIndex === -1) {
      const idx = buffer.indexOf('\n\n')
      if (idx === -1) continue
      headerEndIndex = idx
      const headerBlock = buffer.slice(0, idx)
      const typeMatch = headerBlock.match(/^TYPE:\s*(\w+)/im)
      const titleMatch = headerBlock.match(/^TITLE:\s*(.*)$/im)
      const actionsMatch = headerBlock.match(/^ACTIONS:\s*(.*)$/im)
      const rawType = typeMatch?.[1]?.toLowerCase() ?? ''
      type = (VALID_TYPES as string[]).includes(rawType) ? (rawType as MentorCardType) : 'theory'
      title = titleMatch?.[1]?.trim() ?? ''
      actions = actionsMatch?.[1]?.trim() ? actionsMatch[1].split('|').map(a => a.trim()).filter(Boolean) : []
    }

    const content = buffer.slice(headerEndIndex + 2)
    onUpdate({ type, title, content: content.trim(), actions, done: false })
  }

  const finalContent = headerEndIndex === -1 ? buffer.trim() : buffer.slice(headerEndIndex + 2).trim()
  onUpdate({ type, title: title || 'Ответ AI Mentor', content: finalContent, actions, done: true })
}

// ── "Мой план" — daily plan, generated once per calendar day ────────────
//
// No backend table for this — it's a personal, disposable checklist, not
// data the app (or an admin) needs to query, so it's kept entirely in
// localStorage: the generated plan itself (so re-opening the tab doesn't
// burn another API call) plus which items are checked off, both keyed by
// today's date so a new day naturally starts a fresh plan.

const PLAN_STORAGE_PREFIX = 'zhangak_ai_plan_'
const PLAN_CHECKED_PREFIX = 'zhangak_ai_plan_checked_'

function todayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

export function getStoredPlan(): MentorResponse | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(PLAN_STORAGE_PREFIX + todayKey())
    return raw ? (JSON.parse(raw) as MentorResponse) : null
  } catch {
    return null
  }
}

export function storePlan(plan: MentorResponse): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(PLAN_STORAGE_PREFIX + todayKey(), JSON.stringify(plan))
  // A freshly (re)generated plan starts unchecked.
  window.localStorage.removeItem(PLAN_CHECKED_PREFIX + todayKey())
}

export function getCheckedPlanItems(): Set<number> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = window.localStorage.getItem(PLAN_CHECKED_PREFIX + todayKey())
    return new Set(raw ? (JSON.parse(raw) as number[]) : [])
  } catch {
    return new Set()
  }
}

export function togglePlanItem(index: number): Set<number> {
  const checked = getCheckedPlanItems()
  if (checked.has(index)) checked.delete(index); else checked.add(index)
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(PLAN_CHECKED_PREFIX + todayKey(), JSON.stringify([...checked]))
  }
  return checked
}
