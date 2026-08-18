/**
 * Presentation-only lesson shape. Keeping it separate from lessons-data.ts
 * prevents first-party student screens from importing the retired Supabase
 * lesson reader just to render a title or subject label.
 */
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

export const LESSON_SUBJECT_LABELS: Record<LessonSubject, string> = {
  math: 'Математика',
  kyr: 'Кыргыз тили',
}
