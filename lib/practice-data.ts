import { supabase } from '@/lib/supabase'

// Verified against the live schema (Supabase project olqikkvjeutdgewmhnub):
// - practice_results has NO `passed` column — "passed" is computed client-side
//   from score vs. PASS_RATIO and never persisted as its own field.
// - questions has NO `explanation` column — the error-review screen omits it
//   rather than fabricating content.
// - correct_answer format is unverified (no seeded rows exist to check), so
//   isCorrect() compares case-insensitively and tolerates a few reasonable
//   storage conventions ("a", "A", "a)", etc).

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
}

export const SECTION_LABELS: Record<string, string> = {
  math: 'Математика',
  comparison: 'Сравнение',
  analogy: 'Аналогия',
  reading: 'Чтение',
  grammar: 'Грамматика',
  general: 'Общее',
}

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
