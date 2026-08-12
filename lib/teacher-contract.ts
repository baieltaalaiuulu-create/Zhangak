export type TeacherAttendanceStatus = 'present' | 'late' | 'absent'

export interface TeacherGroupSummary {
  id: number
  name: string
  courseId: number
  courseName: string | null
  level: string | null
}

export interface TeacherStudent {
  id: string
  fullName: string
  phone: string | null
}

export interface TeacherLesson {
  id: number
  lessonNumber: number
  title: string
  lessonDate: string | null
  durationMinutes: number | null
  isTest: boolean
  topics: string[]
}

export interface TeacherScores {
  math: number | null
  analogy: number | null
  reading: number | null
  grammar: number | null
}

export interface TeacherHomework {
  id: number
  lessonId: number
  title: string
  description: string | null
  dueAt: string | null
  submittedCount: number
}

export interface TeacherGroupWorkspace {
  group: TeacherGroupSummary
  students: TeacherStudent[]
  lessons: TeacherLesson[]
  attendance: Record<number, Record<string, TeacherAttendanceStatus>>
  grades: Record<number, Record<string, TeacherScores>>
  homework: TeacherHomework[]
}

export interface AttendanceEntry {
  studentId: string
  status: TeacherAttendanceStatus
}

export interface GradeEntry {
  studentId: string
  scores: TeacherScores
}

export const SCORE_LIMITS = {
  math: 40,
  analogy: 20,
  reading: 30,
  grammar: 40,
} as const

function exactKeys(value: Record<string, unknown>, allowed: string[]): boolean {
  const keys = Object.keys(value).sort()
  return keys.length === allowed.length && keys.every((key, index) => key === [...allowed].sort()[index])
}

function studentId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 100
}

export function parseAttendanceEntries(value: unknown): AttendanceEntry[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 200) return null
  const entries: AttendanceEntry[] = []
  const seen = new Set<string>()
  for (const raw of value) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
    const row = raw as Record<string, unknown>
    if (!exactKeys(row, ['status', 'studentId']) || !studentId(row.studentId) || seen.has(row.studentId)) return null
    if (row.status !== 'present' && row.status !== 'late' && row.status !== 'absent') return null
    seen.add(row.studentId)
    entries.push({ studentId: row.studentId, status: row.status })
  }
  return entries
}

export function parseGradeEntries(value: unknown): GradeEntry[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 200) return null
  const entries: GradeEntry[] = []
  const seen = new Set<string>()
  const scoreKeys = Object.keys(SCORE_LIMITS) as (keyof TeacherScores)[]
  for (const raw of value) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
    const row = raw as Record<string, unknown>
    if (!exactKeys(row, ['scores', 'studentId']) || !studentId(row.studentId) || seen.has(row.studentId)) return null
    if (!row.scores || typeof row.scores !== 'object' || Array.isArray(row.scores)) return null
    const rawScores = row.scores as Record<string, unknown>
    if (!exactKeys(rawScores, scoreKeys)) return null
    const scores = {} as TeacherScores
    for (const key of scoreKeys) {
      const score = rawScores[key]
      if (score !== null && (typeof score !== 'number' || !Number.isInteger(score) || score < 0 || score > SCORE_LIMITS[key])) return null
      scores[key] = score as number | null
    }
    if (scoreKeys.every(key => scores[key] === null)) return null
    seen.add(row.studentId)
    entries.push({ studentId: row.studentId, scores })
  }
  return entries
}

export function gradeTotal(scores: TeacherScores): number {
  return Object.values(scores).reduce<number>((total, score) => total + (score ?? 0), 0)
}
