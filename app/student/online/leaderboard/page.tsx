'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  fetchLeaderboardEntries,
  fetchScoreDelta,
  fetchStreaksForStudents,
  fetchDeltasForStudents,
  type LeaderboardFilter,
  type LeaderboardEntry,
} from '@/lib/leaderboard-data'

import MyRankCard from '@/components/student/leaderboard/MyRankCard'
import PodiumTop3 from '@/components/student/leaderboard/PodiumTop3'
import LeaderboardTable from '@/components/student/leaderboard/LeaderboardTable'

const FILTERS: { key: LeaderboardFilter; label: string }[] = [
  { key: 'all', label: 'Все участники' },
  { key: 'group', label: 'Моя группа' },
  { key: 'month', label: 'Этот месяц' },
  { key: 'alltime', label: 'Все время' },
]

export default function LeaderboardPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [studentId, setStudentId] = useState<string | null>(null)
  const [filter, setFilter] = useState<LeaderboardFilter>('all')
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [streaks, setStreaks] = useState<Map<string, number>>(new Map())
  const [deltas, setDeltas] = useState<Map<string, number | null>>(new Map())
  const [myDelta, setMyDelta] = useState<number | null>(null)
  const [entriesLoading, setEntriesLoading] = useState(true)

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, student_type')
        .eq('id', user.id)
        .single()

      if (!profile || profile.role !== 'student') { router.push('/login'); return }
      if (profile.student_type === 'offline') { router.push('/student'); return }

      setStudentId(user.id)
      const delta = await fetchScoreDelta(user.id)
      setMyDelta(delta.delta)
      setLoading(false)
    }
    checkAuth()
  }, [router])

  useEffect(() => {
    if (!studentId) return
    const load = async () => {
      setEntriesLoading(true)
      const list = await fetchLeaderboardEntries(filter, studentId)
      setEntries(list)

      const ids = list.map(e => e.studentId)
      const [streakMap, deltaMap] = await Promise.all([
        fetchStreaksForStudents(ids),
        fetchDeltasForStudents(ids),
      ])
      setStreaks(streakMap)
      setDeltas(deltaMap)
      setEntriesLoading(false)
    }
    load()
  }, [filter, studentId])

  if (loading || !studentId) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FAF8FF', fontFamily: 'Inter, sans-serif' }}>
        <div style={{ color: '#9CA3AF', fontSize: 14 }}>Загрузка...</div>
      </div>
    )
  }

  const myEntry = entries.find(e => e.studentId === studentId)

  return (
    <div className="min-h-screen bg-[#FAF8FF]">
      <div className="mx-auto max-w-5xl space-y-5 px-4 py-6 sm:px-6">
        <h1 className="text-xl font-bold text-[#191B23]">Рейтинг</h1>

        <div className="flex gap-2 overflow-x-auto pb-1 md:flex-wrap md:overflow-visible md:pb-0">
          {FILTERS.map(f => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`shrink-0 rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                filter === f.key
                  ? 'bg-[#1B4FD8] text-white'
                  : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <MyRankCard rank={myEntry?.rank ?? null} score={myEntry?.bestScore ?? null} delta={myDelta} />

        {entriesLoading ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center text-sm text-gray-400">Загрузка...</div>
        ) : (
          <>
            <PodiumTop3 entries={entries} currentStudentId={studentId} />
            <LeaderboardTable entries={entries} currentStudentId={studentId} streaks={streaks} deltas={deltas} />
          </>
        )}
      </div>
    </div>
  )
}
