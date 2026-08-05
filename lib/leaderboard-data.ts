import { supabase } from '@/lib/supabase'
import { calcStreak } from '@/lib/student-data'

export type LeaderboardFilter = 'all' | 'group' | 'month' | 'alltime'

export interface LeaderboardEntry {
  studentId: string
  fullName: string
  bestScore: number
  rank: number
}

interface ResultRow {
  student_id: string
  total_score: number | null
  completed_at: string
  profiles: { full_name: string | null } | null
}

export async function fetchStudentGroupId(studentId: string): Promise<number | null> {
  const { data } = await supabase
    .from('group_students')
    .select('group_id')
    .eq('student_id', studentId)
    .limit(1)
    .maybeSingle()

  return data?.group_id ?? null
}

async function fetchGroupStudentIds(groupId: number): Promise<Set<string>> {
  const { data } = await supabase.from('group_students').select('student_id').eq('group_id', groupId)
  return new Set((data ?? []).map(r => r.student_id))
}

// 'all' and 'alltime' are the same dataset (every student, best score ever) —
// the design calls for both as separate tabs alongside 'group' (population
// scope) and 'month' (time scope), so they're kept as distinct filter values
// even though they resolve identically here.
export async function fetchLeaderboardEntries(filter: LeaderboardFilter, studentId: string): Promise<LeaderboardEntry[]> {
  let query = supabase
    .from('practice_results')
    .select('student_id, total_score, completed_at, profiles(full_name)')
    .eq('test_type', 'mock')
    .not('completed_at', 'is', null)

  if (filter === 'month') {
    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)
    query = query.gte('completed_at', monthStart.toISOString())
  }

  const { data } = await query
  const rows = (data ?? []) as unknown as ResultRow[]

  let allowedStudentIds: Set<string> | null = null
  if (filter === 'group') {
    const groupId = await fetchStudentGroupId(studentId)
    allowedStudentIds = groupId ? await fetchGroupStudentIds(groupId) : new Set()
  }

  const bestByStudent = new Map<string, { fullName: string; score: number }>()
  for (const r of rows) {
    if (allowedStudentIds && !allowedStudentIds.has(r.student_id)) continue
    const score = r.total_score ?? 0
    const existing = bestByStudent.get(r.student_id)
    if (!existing || score > existing.score) {
      bestByStudent.set(r.student_id, { fullName: r.profiles?.full_name ?? 'Студент', score })
    }
  }

  return Array.from(bestByStudent.entries())
    .map(([id, v]) => ({ studentId: id, fullName: v.fullName, bestScore: v.score }))
    .sort((a, b) => b.bestScore - a.bestScore)
    .map((e, i) => ({ ...e, rank: i + 1 }))
}

export interface ScoreDelta {
  current: number | null
  delta: number | null
}

export async function fetchScoreDelta(studentId: string): Promise<ScoreDelta> {
  const { data } = await supabase
    .from('practice_results')
    .select('total_score')
    .eq('student_id', studentId)
    .eq('test_type', 'mock')
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(2)

  const rows = data ?? []
  const current = rows[0]?.total_score ?? null
  const previous = rows[1]?.total_score ?? null
  return { current, delta: current !== null && previous !== null ? current - previous : null }
}

// Batch helpers for a bounded set of visible table rows — not meant to be
// called with the whole population.
export async function fetchStreaksForStudents(studentIds: string[]): Promise<Map<string, number>> {
  const result = new Map<string, number>()
  if (studentIds.length === 0) return result

  const { data } = await supabase
    .from('practice_results')
    .select('student_id, completed_at')
    .in('student_id', studentIds)
    .not('completed_at', 'is', null)

  const byStudent = new Map<string, string[]>()
  for (const r of data ?? []) {
    const list = byStudent.get(r.student_id) ?? []
    list.push(r.completed_at as string)
    byStudent.set(r.student_id, list)
  }

  for (const id of studentIds) {
    result.set(id, calcStreak(byStudent.get(id) ?? []))
  }
  return result
}

export async function fetchDeltasForStudents(studentIds: string[]): Promise<Map<string, number | null>> {
  const result = new Map<string, number | null>()
  if (studentIds.length === 0) return result

  const { data } = await supabase
    .from('practice_results')
    .select('student_id, total_score, completed_at')
    .in('student_id', studentIds)
    .eq('test_type', 'mock')
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false })

  const byStudent = new Map<string, number[]>()
  for (const r of data ?? []) {
    const list = byStudent.get(r.student_id) ?? []
    list.push(r.total_score ?? 0)
    byStudent.set(r.student_id, list)
  }

  for (const id of studentIds) {
    const scores = byStudent.get(id) ?? []
    result.set(id, scores.length >= 2 ? scores[0] - scores[1] : null)
  }
  return result
}
