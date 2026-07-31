export interface Profile {
  id: string
  full_name: string
  role: string
  phone: string | null
  student_type: string | null
  class_number: number | null
  goal_score: number | null
  target_score: number | null
  school: string | null
}

export interface PracticeLesson {
  id: string
  subject: 'math' | 'kyr'
  title: string
  description: string | null
  video_url: string | null
  order_number: number | null
}

export interface PracticeResult {
  id: number
  test_id: number | null
  student_id: string
  test_type: 'mock' | 'practice' | null
  lesson_id: string | null
  math_comparison_score: number | null
  math_raw_score: number | null
  analogy_score: number | null
  reading_score: number | null
  grammar_score: number | null
  total_score: number | null
  attempt_number: number | null
  completed_at: string
}

export interface PracticeTest {
  id: number
  subject: 'math' | 'kyr' | 'all'
  type: string | null
  time_limit_minutes: number | null
  lesson_id: string | null
}

export type SubjectKey = 'math' | 'kyr' | 'analogy' | 'reading'

export interface SubjectStat {
  key: SubjectKey
  label: string
  color: string
  current: number
  delta: number | null
}
