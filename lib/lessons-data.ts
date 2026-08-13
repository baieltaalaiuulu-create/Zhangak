import { supabase } from '@/lib/supabase'
import {
  LESSON_SUBJECT_LABELS,
  type Lesson,
  type LessonStatus,
  type LessonSubject,
} from '@/lib/lesson-contract'

// Keep legacy consumers source-compatible. New first-party components import
// the data-client-free lesson contract instead of this Supabase reader.
export { LESSON_SUBJECT_LABELS } from '@/lib/lesson-contract'
export type { Lesson, LessonStatus, LessonSubject } from '@/lib/lesson-contract'

export const LESSON_SUBJECT_META: Record<LessonSubject, {
  label: string
  icon: string
  color: string
  bg: string
  strip: string
}> = {
  math: { label: LESSON_SUBJECT_LABELS.math, icon: '📐', color: 'text-blue-600', bg: 'bg-blue-50', strip: 'bg-blue-600' },
  kyr:  { label: LESSON_SUBJECT_LABELS.kyr, icon: '📘', color: 'text-orange-600', bg: 'bg-orange-50', strip: 'bg-orange-400' },
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

// BUG FIX: this used to walk `lessons` as one flat, cross-subject sequence
// (fetchLessons() sorts only by order_number, so math and kyr rows are
// interleaved) and mark a single site-wide "current" lesson, locking
// everything after it — including the *first* lesson of whichever subject
// didn't happen to own that slot. Finishing math lesson 1 would flip the
// pointer to kyr lesson 1 and leave math lesson 2 stuck 'locked' forever,
// which is exactly the "stays locked after completing first lesson" bug.
// Each subject now unlocks independently: first lesson of every subject is
// always open, and each subsequent lesson unlocks only once the previous
// lesson in that same subject is completed.
export function computeLessonStatuses(lessons: Lesson[], completedIds: Set<string>): Record<string, LessonStatus> {
  const statuses: Record<string, LessonStatus> = {}
  const bySubject = new Map<LessonSubject, Lesson[]>()
  for (const lesson of lessons) {
    const group = bySubject.get(lesson.subject)
    if (group) group.push(lesson)
    else bySubject.set(lesson.subject, [lesson])
  }
  for (const group of bySubject.values()) {
    let foundCurrent = false
    for (const lesson of group) {
      if (completedIds.has(lesson.id)) {
        statuses[lesson.id] = 'done'
      } else if (!foundCurrent) {
        statuses[lesson.id] = 'current'
        foundCurrent = true
      } else {
        statuses[lesson.id] = 'locked'
      }
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
