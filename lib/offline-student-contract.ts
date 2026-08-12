export type OfflineStudentType = 'offline' | 'both'
export type AttendanceState = 'present' | 'late' | 'absent' | 'pending'

export interface OfflineStudentProfile {
  id: string
  fullName: string
  studentType: OfflineStudentType
  targetScore: number | null
}

export interface OfflineStudentGroup {
  id: number
  name: string
  courseName: string | null
  teacherName: string | null
}

export interface OfflineLesson {
  id: number
  lessonNumber: number
  title: string
  startsAt: string | null
  durationMinutes: number | null
  isTest: boolean
  attendance: AttendanceState
  topics: string[]
}

export interface OfflineHomework {
  id: number
  lessonId: number
  lessonTitle: string
  title: string
  description: string | null
  dueAt: string | null
  completed: boolean
}

export interface OfflineGrade {
  lessonId: number
  lessonTitle: string
  math: number | null
  analogy: number | null
  reading: number | null
  grammar: number | null
  total: number | null
}

export interface OfflineProgress {
  latestOrtScore: number | null
  targetScore: number | null
}

export interface OfflineStudentDashboard {
  profile: OfflineStudentProfile
  group: OfflineStudentGroup | null
  lessons: OfflineLesson[]
  homework: OfflineHomework[]
  grades: OfflineGrade[]
  progress: OfflineProgress
  availability: {
    exactSchedule: boolean
    materials: boolean
  }
}

export interface AttendanceSummary {
  recorded: number
  present: number
  late: number
  absent: number
  rate: number | null
}

export function attendanceSummary(lessons: OfflineLesson[]): AttendanceSummary {
  const recorded = lessons.filter(lesson => lesson.attendance !== 'pending')
  const present = recorded.filter(lesson => lesson.attendance === 'present').length
  const late = recorded.filter(lesson => lesson.attendance === 'late').length
  const absent = recorded.filter(lesson => lesson.attendance === 'absent').length
  const attended = present + late

  return {
    recorded: recorded.length,
    present,
    late,
    absent,
    rate: recorded.length > 0 ? Math.round((attended / recorded.length) * 100) : null,
  }
}

export function nextScheduledLesson(lessons: OfflineLesson[], now = new Date()): OfflineLesson | null {
  const nowMs = now.getTime()
  return lessons
    .filter(lesson => lesson.startsAt && Number.isFinite(new Date(lesson.startsAt).getTime()))
    .filter(lesson => new Date(lesson.startsAt as string).getTime() >= nowMs)
    .sort((a, b) => new Date(a.startsAt as string).getTime() - new Date(b.startsAt as string).getTime())[0] ?? null
}

export function activeHomework(homework: OfflineHomework[]): OfflineHomework[] {
  return homework
    .filter(item => !item.completed)
    .sort((a, b) => {
      const aMs = a.dueAt ? new Date(a.dueAt).getTime() : Number.POSITIVE_INFINITY
      const bMs = b.dueAt ? new Date(b.dueAt).getTime() : Number.POSITIVE_INFINITY
      return (Number.isFinite(aMs) ? aMs : Number.POSITIVE_INFINITY)
        - (Number.isFinite(bMs) ? bMs : Number.POSITIVE_INFINITY)
    })
}

export function scoreGap(progress: OfflineProgress): number | null {
  if (progress.latestOrtScore == null || progress.targetScore == null) return null
  return Math.max(0, progress.targetScore - progress.latestOrtScore)
}
