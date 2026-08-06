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
export async function fetchPracticeTopics(): Promise<PracticeTopic[]> {
  const { data } = await supabase
    .from('questions')
    .select('section, topic, difficulty, practice_tests!inner(lesson_id, is_active)')
    .is('practice_tests.lesson_id', null)
    .eq('practice_tests.is_active', true)
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

export interface BankQuestionSet {
  testId: number
  subject: 'math' | 'kyr' | 'all'
  questions: PracticeQuestion[]
}

interface BankQuestionRow extends PracticeQuestion {
  practice_test_id: number
  practice_tests: { subject: 'math' | 'kyr' | 'all' } | null
}

export async function fetchBankQuestions(section: string, topic: string): Promise<BankQuestionSet | null> {
  let query = supabase
    .from('questions')
    .select('id, question_text, option_a, option_b, option_c, option_d, correct_answer, image_url, order_num, section, topic, difficulty, practice_test_id, practice_tests!inner(subject, lesson_id, is_active)')
    .eq('section', section)
    .is('practice_tests.lesson_id', null)
    .eq('practice_tests.is_active', true)
    .order('order_num', { ascending: true })

  query = topic === UNTAGGED_TOPIC_LABEL ? query.is('topic', null) : query.eq('topic', topic)

  const { data } = await query
  const rows = (data ?? []) as unknown as BankQuestionRow[]
  if (rows.length === 0) return null

  return {
    testId: rows[0].practice_test_id,
    subject: rows[0].practice_tests?.subject ?? 'all',
    questions: rows.map(r => ({
      id: r.id,
      question_text: r.question_text,
      option_a: r.option_a,
      option_b: r.option_b,
      option_c: r.option_c,
      option_d: r.option_d,
      correct_answer: r.correct_answer,
      image_url: r.image_url,
      order_num: r.order_num,
      section: r.section,
      topic: r.topic,
      difficulty: r.difficulty,
    })),
  }
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
  testId: number
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
