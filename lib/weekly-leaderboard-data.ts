import { supabase } from '@/lib/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'

export interface WeeklyLeaderboardEntry {
  studentId: string
  fullName: string
  avatarUrl: string | null
  totalXp: number
  correctAnswers: number
  rank: number
}

interface WeeklyLeaderboardRow {
  student_id: string
  total_xp: number
  correct_answers: number
  rank: number | null
  profiles: { full_name: string | null; avatar_url: string | null } | null
}

const TOP_N = 10

export interface WeeklyLeaderboardData {
  top: WeeklyLeaderboardEntry[]
  me: WeeklyLeaderboardEntry | null
  xpToNextRank: number | null // how far "me" is from cracking the top 10
}

export async function fetchWeeklyLeaderboard(weekStart: string, myStudentId: string | null): Promise<WeeklyLeaderboardData> {
  const { data } = await supabase
    .from('weekly_leaderboard')
    .select('student_id, total_xp, correct_answers, rank, profiles(full_name, avatar_url)')
    .eq('week_start', weekStart)
    .order('total_xp', { ascending: false })

  const rows = (data ?? []) as unknown as WeeklyLeaderboardRow[]
  const entries: WeeklyLeaderboardEntry[] = rows.map((r, i) => ({
    studentId: r.student_id,
    fullName: r.profiles?.full_name ?? 'Студент',
    avatarUrl: r.profiles?.avatar_url ?? null,
    totalXp: r.total_xp ?? 0,
    correctAnswers: r.correct_answers ?? 0,
    rank: r.rank ?? i + 1,
  }))

  const top = entries.slice(0, TOP_N)
  const me = myStudentId ? entries.find(e => e.studentId === myStudentId) ?? null : null

  let xpToNextRank: number | null = null
  if (me && !top.some(e => e.studentId === myStudentId)) {
    const lastInTop = top[top.length - 1]
    if (lastInTop) xpToNextRank = Math.max(0, lastInTop.totalXp - me.totalXp + 1)
  }

  return { top, me, xpToNextRank }
}

// Subscribes to any change on weekly_leaderboard and invokes `onChange` —
// callers re-fetch fetchWeeklyLeaderboard() themselves on each event rather
// than trying to patch individual rows client-side, since a single
// completion can shuffle every rank in the table.
export function subscribeWeeklyLeaderboard(onChange: () => void): RealtimeChannel {
  const channel = supabase
    .channel('weekly-leaderboard')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'weekly_leaderboard' }, onChange)
    .subscribe()
  return channel
}

export function unsubscribeChannel(channel: RealtimeChannel): void {
  supabase.removeChannel(channel)
}

// ── Prizes ────────────────────────────────────────────────────────────

export interface WeeklyPrize {
  id: string
  week_start: string
  place: 1 | 2 | 3
  title: string
  description: string | null
  image_url: string | null
  winner_id: string | null
  status: 'active' | 'sent' | 'claimed'
  created_at: string
}

export async function fetchPrizesForWeek(weekStart: string): Promise<WeeklyPrize[]> {
  const { data } = await supabase
    .from('weekly_prizes')
    .select('*')
    .eq('week_start', weekStart)
    .order('place', { ascending: true })
  return (data ?? []) as WeeklyPrize[]
}

export interface PrizeHistoryRow {
  weekStart: string
  place: 1 | 2 | 3
  title: string
  winnerName: string | null
  winnerXp: number | null
  status: WeeklyPrize['status']
}

export async function fetchPrizeHistory(): Promise<PrizeHistoryRow[]> {
  const { data } = await supabase
    .from('weekly_prizes')
    .select('week_start, place, title, status, winner_id, profiles(full_name)')
    .order('week_start', { ascending: false })

  const rows = (data ?? []) as unknown as (Omit<WeeklyPrize, 'id' | 'description' | 'image_url' | 'created_at'> & { profiles: { full_name: string | null } | null })[]

  // XP lookup is a second pass keyed by (student, week) since it isn't on
  // weekly_prizes itself.
  const withWinners = rows.filter(r => r.winner_id)
  const xpByKey = new Map<string, number>()
  if (withWinners.length > 0) {
    const weekStarts = Array.from(new Set(withWinners.map(r => r.week_start)))
    const { data: lbRows } = await supabase
      .from('weekly_leaderboard')
      .select('student_id, week_start, total_xp')
      .in('week_start', weekStarts)
    for (const r of lbRows ?? []) xpByKey.set(`${r.student_id}::${r.week_start}`, r.total_xp ?? 0)
  }

  return rows.map(r => ({
    weekStart: r.week_start,
    place: r.place,
    title: r.title,
    winnerName: r.profiles?.full_name ?? null,
    winnerXp: r.winner_id ? xpByKey.get(`${r.winner_id}::${r.week_start}`) ?? null : null,
    status: r.status,
  }))
}
