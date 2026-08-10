import { supabase } from '@/lib/supabase'
import type { LessonSubject, LessonStatus, PracticeLesson } from '@/lib/supabase'

// Same table/logic as the web app's lib/lessons-data.ts — practice_lessons
// ordered by order_number, completion derived from practice_results rows
// with a matching lesson_id and completed_at set.

export const LESSON_SUBJECT_META: Record<LessonSubject, { label: string; icon: string; color: string }> = {
  math: { label: 'Математика', icon: '📐', color: '#1B4FD8' },
  kyr: { label: 'Кыргыз тили', icon: '📘', color: '#F59E0B' },
}

export async function fetchLessons(): Promise<PracticeLesson[]> {
  const { data } = await supabase
    .from('practice_lessons')
    .select('id, title, description, subject, video_url, order_number')
    .order('order_number', { ascending: true })

  return ((data ?? []) as (Omit<PracticeLesson, 'order_number'> & { order_number: number | null })[])
    .map(l => ({ ...l, order_number: l.order_number ?? 0 }))
}

export async function fetchLessonById(id: string): Promise<PracticeLesson | null> {
  const { data } = await supabase
    .from('practice_lessons')
    .select('id, title, description, subject, video_url, order_number')
    .eq('id', id)
    .single()

  if (!data) return null
  return { ...data, order_number: data.order_number ?? 0 }
}

// Same join as the web app's fetchQuestionCounts (lib/lessons-data.ts):
// practice_tests.lesson_id -> questions.practice_test_id.
export async function fetchQuestionCount(lessonId: string): Promise<number> {
  const { data: tests } = await supabase.from('practice_tests').select('id').eq('lesson_id', lessonId)
  const testIds = (tests ?? []).map(t => t.id)
  if (testIds.length === 0) return 0

  const { count } = await supabase
    .from('questions')
    .select('id', { count: 'exact', head: true })
    .in('practice_test_id', testIds)

  return count ?? 0
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

// Per-subject unlock, same rule the web app uses (lib/lessons-data.ts
// computeLessonStatuses) so both agree: each subject's first lesson is
// always open, and each next lesson unlocks once the previous lesson in
// that same subject is completed. (Bug fixed alongside the web version —
// treating the whole cross-subject, order_number-sorted list as one
// sequence left one subject's second lesson locked as soon as the other
// subject's first lesson became "current".)
export function computeLessonStatuses(lessons: PracticeLesson[], completedIds: Set<string>): Record<string, LessonStatus> {
  const statuses: Record<string, LessonStatus> = {}
  const bySubject = new Map<LessonSubject, PracticeLesson[]>()
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
