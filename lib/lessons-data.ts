import { supabase } from '@/lib/supabase'

export type LessonSubject = 'math' | 'kyr'
export type LessonStatus = 'done' | 'current' | 'locked'

export interface Lesson {
  id: string
  title: string
  description: string | null
  subject: LessonSubject
  video_url: string | null
  order_number: number
}

export const LESSON_SUBJECT_META: Record<LessonSubject, {
  label: string
  icon: string
  color: string
  bg: string
  strip: string
}> = {
  math: { label: 'Математика', icon: '📐', color: 'text-blue-600', bg: 'bg-blue-50', strip: 'bg-blue-600' },
  kyr:  { label: 'Кыргыз тили', icon: '📘', color: 'text-orange-600', bg: 'bg-orange-50', strip: 'bg-orange-400' },
}

export async function fetchLessons(): Promise<Lesson[]> {
  const { data } = await supabase
    .from('practice_lessons')
    .select('id, title, description, subject, video_url, order_number')
    .order('order_number', { ascending: true })

  return ((data ?? []) as (Omit<Lesson, 'order_number'> & { order_number: number | null })[])
    .map(l => ({ ...l, order_number: l.order_number ?? 0 }))
}

export async function fetchLessonById(id: string): Promise<Lesson | null> {
  const { data } = await supabase
    .from('practice_lessons')
    .select('id, title, description, subject, video_url, order_number')
    .eq('id', id)
    .single()

  if (!data) return null
  return { ...data, order_number: data.order_number ?? 0 }
}

export async function fetchCompletedLessonIds(studentId: string): Promise<Set<string>> {
  const { data } = await supabase
    .from('practice_results')
    .select('lesson_id')
    .eq('student_id', studentId)
    .not('completed_at', 'is', null)
    .not('lesson_id', 'is', null)

  return new Set((data ?? []).map(r => r.lesson_id as string))
}

export async function fetchQuestionCounts(lessonIds: string[]): Promise<Record<string, number>> {
  if (lessonIds.length === 0) return {}

  const { data: tests } = await supabase
    .from('practice_tests')
    .select('id, lesson_id')
    .in('lesson_id', lessonIds)

  const testToLesson = new Map<number, string>()
  ;(tests ?? []).forEach(t => { if (t.lesson_id) testToLesson.set(t.id, t.lesson_id) })

  const testIds = Array.from(testToLesson.keys())
  if (testIds.length === 0) return {}

  const { data: questions } = await supabase
    .from('questions')
    .select('practice_test_id')
    .in('practice_test_id', testIds)

  const counts: Record<string, number> = {}
  ;(questions ?? []).forEach(q => {
    const lessonId = testToLesson.get(q.practice_test_id)
    if (lessonId) counts[lessonId] = (counts[lessonId] ?? 0) + 1
  })
  return counts
}

// One lesson site-wide is 'current' — the first one (by order_number) the
// student hasn't completed yet. Matches the "next lesson" logic already
// used by the dashboard (lib/student-data.ts), so both pages agree.
export function computeLessonStatuses(lessons: Lesson[], completedIds: Set<string>): Record<string, LessonStatus> {
  const statuses: Record<string, LessonStatus> = {}
  let foundCurrent = false
  for (const lesson of lessons) {
    if (completedIds.has(lesson.id)) {
      statuses[lesson.id] = 'done'
    } else if (!foundCurrent) {
      statuses[lesson.id] = 'current'
      foundCurrent = true
    } else {
      statuses[lesson.id] = 'locked'
    }
  }
  return statuses
}

// BUG FIX: this previously set completed_at: new Date().toISOString(), which
// made every consumer of practice_results (fetchCompletedLessonIds, the
// dashboard's todayPlan/streak/heatmap queries, this very page's own
// isCompleted check) treat merely OPENING a lesson as having finished it —
// skipping straight to the "Урок завершён!" screen instead of ever showing
// the practice test. completed_at is null here on purpose: every one of
// those consumers already filters with .not('completed_at', 'is', null),
// so a "started" row is invisible to them until a real submission
// (savePracticeResult in lib/practice-data.ts) sets completed_at for real.
export async function markLessonStarted(studentId: string, lessonId: string): Promise<void> {
  await supabase.from('practice_results').insert({
    student_id: studentId,
    lesson_id: lessonId,
    test_type: 'practice',
    completed_at: null,
  })
}
