import { supabase } from '@/lib/supabase'

// Verified against the live schema (Supabase project olqikkvjeutdgewmhnub):
// - practice_results has NO `passed` column — "passed" is computed client-side
//   from score vs. PASS_RATIO and never persisted as its own field.
// - questions has NO `explanation` column — the error-review screen omits it
//   rather than fabricating content.
// - correct_answer format is unverified (no seeded rows exist to check), so
//   isCorrect() compares case-insensitively and tolerates a few reasonable
//   storage conventions ("a", "A", "a)", etc).
// - questions.difficulty (text, default 'medium') and questions.topic (text,
//   nullable) were added in this phase specifically to back the standalone
//   question-bank redesign — topic wasn't in the original spec's DB section,
//   but is structurally required: the bank keeps exactly one practice_test
//   per subject bucket, so "topics" can only be distinguished per-question.

export const PASS_RATIO = 0.7

export type AnswerLetter = 'a' | 'b' | 'c' | 'd'

export interface PracticeTest {
  id: number
  title: string
  subject: 'math' | 'kyr' | 'all'
  time_limit_minutes: number | null
  lesson_id: string | null
}

export interface PracticeQuestion {
  id: number
  question_text: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  correct_answer: string
  image_url: string | null
  order_num: number
  section: string
  // Only populated by the standalone-bank fetch path below — the lesson-tied
  // fetchQuestions() doesn't select these, so they're absent (not null) there.
  topic?: string | null
  difficulty?: string
}

export const SECTION_LABELS: Record<string, string> = {
  math: 'Математика',
  comparison: 'Сравнение',
  analogy: 'Аналогия',
  reading: 'Чтение',
  grammar: 'Грамматика',
  general: 'Общее',
}

// ── Standalone question bank (topics) ───────────────────────────────────
//
// Concept: practice is no longer tied to lessons. Each subject tab maps to
// one or more `questions.section` values; a "topic" is a free-text label an
// admin attaches per-question (questions.topic), grouped client-side into
// browsable cards. Bank questions live on practice_tests rows with
// lesson_id=null (one such row per subject bucket, ensured by the admin API).

export type SubjectTab = 'all' | 'math' | 'kyr' | 'analogy' | 'reading'

export const SUBJECT_TAB_LABELS: Record<SubjectTab, string> = {
  all: 'Все',
  math: 'Математика',
  kyr: 'Кыргыз тили',
  analogy: 'Аналогия',
  reading: 'Окуу',
}

// 'general' is deliberately excluded — it's invisible to ORT scoring and not
// a real practice topic (see project-wide gotcha in lib/student-data.ts).
export const SUBJECT_TAB_SECTIONS: Record<Exclude<SubjectTab, 'all'>, string[]> = {
  math: ['math', 'comparison'],
  kyr: ['grammar'],
  analogy: ['analogy'],
  reading: ['reading'],
}

export const UNTAGGED_TOPIC_LABEL = 'Общие вопросы'

// Section-only practice (see fetchQuestionsBySection below) has no
// practice_tests row to read a subject off of, so the start screen's
// subject badge is derived straight from the section instead.
export function subjectForSection(section: string): PracticeTest['subject'] {
  if (section === 'math' || section === 'comparison') return 'math'
  if (section === 'grammar') return 'kyr'
  return 'all'
}

export interface PracticeTopic {
  section: string
  topic: string
  questionCount: number
  difficulty: 'easy' | 'medium' | 'hard' | 'mixed'
}

interface BankTopicRow {
  section: string
  topic: string | null
  difficulty: string | null
}

function modeDifficulty(list: string[]): PracticeTopic['difficulty'] {
  const unique = new Set(list)
  if (unique.size === 1) return (list[0] as PracticeTopic['difficulty']) ?? 'medium'
  const counts: Record<string, number> = {}
  for (const d of list) counts[d] = (counts[d] ?? 0) + 1
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1])
  if (sorted.length > 1 && sorted[0][1] === sorted[1][1]) return 'mixed'
  return (sorted[0][0] as PracticeTopic['difficulty']) ?? 'medium'
}

// Fetches every topic across all subjects once; the browser filters by tab
// client-side (same pattern as the lessons page's subject filter).
//
// Reads straight from `questions` with no practice_tests join — the earlier
// version required the owning test row to have lesson_id=null AND
// is_active=true, which silently hid real questions whenever that row
// wasn't in exactly that state (e.g. a bank test created before is_active
// defaulted correctly, or a question actually filed under a lesson-tied
// test). A student topic list shouldn't depend on admin-side test-row
// bookkeeping, only on what questions actually exist.
export async function fetchPracticeTopics(): Promise<PracticeTopic[]> {
  const { data } = await supabase
    .from('questions')
    .select('section, topic, difficulty')
    .neq('section', 'general')

  const rows = (data ?? []) as unknown as BankTopicRow[]
  const groups = new Map<string, { section: string; topic: string; difficulties: string[] }>()
  for (const r of rows) {
    const topicLabel = r.topic?.trim() || UNTAGGED_TOPIC_LABEL
    const key = `${r.section}::${topicLabel}`
    const g = groups.get(key) ?? { section: r.section, topic: topicLabel, difficulties: [] }
    g.difficulties.push(r.difficulty ?? 'medium')
    groups.set(key, g)
  }

  return Array.from(groups.values())
    .map(g => ({
      section: g.section,
      topic: g.topic,
      questionCount: g.difficulties.length,
      difficulty: modeDifficulty(g.difficulties),
    }))
    .sort((a, b) => a.topic.localeCompare(b.topic, 'ru'))
}

const BANK_QUESTION_LIMIT = 20

// Practice-by-section: no practice_tests lookup at all — just the pool of
// questions tagged with that section, regardless of which test row (or
// none functionally reachable) they're attached to. Random subset capped
// at 20 so a big section doesn't turn into a marathon; PostgREST has no
// ORDER BY RANDOM() through the query builder, so the shuffle happens
// client-side over the fetched pool.
export async function fetchQuestionsBySection(section: string, limit = BANK_QUESTION_LIMIT): Promise<PracticeQuestion[]> {
  const { data } = await supabase
    .from('questions')
    .select('id, question_text, option_a, option_b, option_c, option_d, correct_answer, image_url, order_num, section, topic, difficulty')
    .eq('section', section)

  const rows = (data ?? []) as PracticeQuestion[]
  const shuffled = [...rows]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled.slice(0, limit)
}

// ── Subject-level + topic-level stats (Свободная практика overview) ─────

export interface SubjectOverview {
  subject: Exclude<SubjectTab, 'all'>
  accuracyPct: number | null
  questionCount: number
}

interface AnswerRow {
  answers: Record<string, string> | null
}

interface StatQuestionRow {
  id: number
  section: string
  topic: string | null
  correct_answer: string
}

// Shared by fetchSubjectOverview and fetchTopicStats — both need the same
// "every question the student has ever answered, decoded against the
// current question bank" pass, just bucketed differently afterwards.
async function fetchDecodedAnswerHistory(studentId: string): Promise<{ q: StatQuestionRow; given: string }[]> {
  const { data: resultsRaw } = await supabase
    .from('practice_results')
    .select('answers')
    .eq('student_id', studentId)
    .not('answers', 'is', null)

  const results = (resultsRaw ?? []) as AnswerRow[]
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
    .select('id, section, topic, correct_answer')
    .in('id', Array.from(questionIds))

  const byId = new Map<number, StatQuestionRow>()
  for (const q of (questionsRaw ?? []) as StatQuestionRow[]) byId.set(q.id, q)

  const decoded: { q: StatQuestionRow; given: string }[] = []
  for (const r of results) {
    if (!r.answers) continue
    for (const [idStr, given] of Object.entries(r.answers)) {
      const q = byId.get(Number(idStr))
      if (!q || q.section === 'general') continue
      decoded.push({ q, given: String(given) })
    }
  }
  return decoded
}

function answerIsCorrect(q: StatQuestionRow, given: string): boolean {
  return q.correct_answer?.trim().toLowerCase()[0] === given.trim().toLowerCase()[0]
}

// Reverse of SUBJECT_TAB_SECTIONS — which subject tab a raw `section` value
// belongs under.
function subjectTabForSection(section: string): Exclude<SubjectTab, 'all'> | null {
  for (const [tab, sections] of Object.entries(SUBJECT_TAB_SECTIONS)) {
    if (sections.includes(section)) return tab as Exclude<SubjectTab, 'all'>
  }
  return null
}

// The 4 subject cards at the top of "Свободная практика": total questions
// available per subject, and this student's overall accuracy across their
// history in that subject (null when they haven't attempted it yet).
export async function fetchSubjectOverview(studentId: string): Promise<SubjectOverview[]> {
  const [{ data: qCounts }, decoded] = await Promise.all([
    supabase.from('questions').select('section').neq('section', 'general'),
    fetchDecodedAnswerHistory(studentId),
  ])

  const countBySubject = new Map<Exclude<SubjectTab, 'all'>, number>()
  for (const r of qCounts ?? []) {
    const tab = subjectTabForSection(r.section as string)
    if (tab) countBySubject.set(tab, (countBySubject.get(tab) ?? 0) + 1)
  }

  const tally = new Map<Exclude<SubjectTab, 'all'>, { correct: number; total: number }>()
  for (const { q, given } of decoded) {
    const tab = subjectTabForSection(q.section)
    if (!tab) continue
    const t = tally.get(tab) ?? { correct: 0, total: 0 }
    t.total++
    if (answerIsCorrect(q, given)) t.correct++
    tally.set(tab, t)
  }

  return (['math', 'kyr', 'analogy', 'reading'] as const).map(subject => {
    const t = tally.get(subject)
    return {
      subject,
      accuracyPct: t && t.total > 0 ? Math.round((t.correct / t.total) * 100) : null,
      questionCount: countBySubject.get(subject) ?? 0,
    }
  })
}

export interface TopicStat {
  accuracyPct: number
  mistakes: number
}

// Per-topic accuracy/mistake counts, keyed the same way fetchPracticeTopics
// groups its cards (`${section}::${topic||UNTAGGED_TOPIC_LABEL}`). A caveat
// worth flagging: practice sessions started from a topic card pull the
// whole section's question pool (see fetchQuestionsBySection), not just
// that topic — so this is accuracy on questions tagged with that topic
// specifically, aggregated across whatever sessions happened to include
// them, not a per-session "best run" figure.
export async function fetchTopicStats(studentId: string): Promise<Map<string, TopicStat>> {
  const decoded = await fetchDecodedAnswerHistory(studentId)
  const tally = new Map<string, { correct: number; total: number }>()
  for (const { q, given } of decoded) {
    const topicLabel = q.topic?.trim() || UNTAGGED_TOPIC_LABEL
    const key = `${q.section}::${topicLabel}`
    const t = tally.get(key) ?? { correct: 0, total: 0 }
    t.total++
    if (answerIsCorrect(q, given)) t.correct++
    tally.set(key, t)
  }

  const result = new Map<string, TopicStat>()
  for (const [key, t] of tally.entries()) {
    result.set(key, { accuracyPct: t.total > 0 ? Math.round((t.correct / t.total) * 100) : 0, mistakes: t.total - t.correct })
  }
  return result
}

// ── Lesson-linked practice tests (unchanged — "Тесты к урокам") ─────────

export async function fetchPracticeTest(lessonId: string): Promise<PracticeTest | null> {
  const { data } = await supabase
    .from('practice_tests')
    .select('id, title, subject, time_limit_minutes, lesson_id')
    .eq('lesson_id', lessonId)
    .eq('type', 'practice')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()

  return (data as PracticeTest) ?? null
}

export async function fetchQuestions(testId: number): Promise<PracticeQuestion[]> {
  const { data } = await supabase
    .from('questions')
    .select('id, question_text, option_a, option_b, option_c, option_d, correct_answer, image_url, order_num, section')
    .eq('practice_test_id', testId)
    .order('order_num', { ascending: true })

  return (data ?? []) as PracticeQuestion[]
}

export async function fetchPreviousScore(studentId: string, testId: number): Promise<number | null> {
  const { data } = await supabase
    .from('practice_results')
    .select('score')
    .eq('student_id', studentId)
    .eq('test_id', testId)
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return data?.score ?? null
}

export interface SaveResultInput {
  studentId: string
  // null for section-only practice (fetchQuestionsBySection) — those
  // attempts aren't tied to any practice_tests row, and the column is
  // nullable precisely for this case rather than needing a fake FK target.
  testId: number | null
  lessonId: string | null
  score: number
  answers: Record<number, AnswerLetter>
}

export async function savePracticeResult(input: SaveResultInput): Promise<void> {
  await supabase.from('practice_results').insert({
    student_id: input.studentId,
    test_id: input.testId,
    lesson_id: input.lessonId,
    score: input.score,
    total_score: input.score,
    test_type: 'practice',
    completed_at: new Date().toISOString(),
    answers: input.answers,
  })
}

export function optionText(q: PracticeQuestion, letter: AnswerLetter): string {
  return { a: q.option_a, b: q.option_b, c: q.option_c, d: q.option_d }[letter]
}

export function correctLetter(q: PracticeQuestion): AnswerLetter {
  const normalized = q.correct_answer.trim().toLowerCase()
  const letter = normalized[0]
  return (letter === 'a' || letter === 'b' || letter === 'c' || letter === 'd') ? letter : 'a'
}

export function isCorrect(q: PracticeQuestion, letter: AnswerLetter): boolean {
  return correctLetter(q) === letter
}
