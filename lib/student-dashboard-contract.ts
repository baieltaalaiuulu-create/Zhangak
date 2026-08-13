/**
 * UI-only dashboard shapes shared by first-party student screens.
 *
 * This module must stay free of data clients. The legacy Supabase reader
 * remains in student-data.ts while the own-backend screens can import their
 * presentation contract without pulling that reader into their bundle.
 */
export const DEFAULT_TARGET_SCORE = 180
export const MIN_TARGET_SCORE = 100
export const MAX_TARGET_SCORE = 245

export type SubjectKey = 'math' | 'kyr' | 'analogy' | 'reading' | 'grammar'

export interface ScoreHistory {
  score: number
  completed_at: string
}

export interface SubjectStat {
  subject: SubjectKey
  current: number
  max: number
  delta: number
}

export interface SubjectTrack {
  subject: 'math' | 'kyr'
  currentLesson: { id: string; title: string; order_number: number } | null
  completedCount: number
  totalCount: number
  progressPct: number
  lessonDoneToday: boolean
  practiceDoneToday: boolean
}

export interface StudentDashboardData {
  profile: { full_name: string; target_score: number } | null
  latestScore: number | null
  previousScore: number | null
  scoreHistory: ScoreHistory[]
  subjects: SubjectStat[]
  streak: number
  subjectTracks: SubjectTrack[]
  monthStats: {
    lessons: number
    questions: number
    tests: number
    mocks: number
    hours: number
  }
}
