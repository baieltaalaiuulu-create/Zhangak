'use client'

import { useEffect, useState } from 'react'
import { Trophy, Gift } from 'lucide-react'
import {
  fetchWeeklyLeaderboard, fetchPrizesForWeek, subscribeWeeklyLeaderboard, unsubscribeChannel,
  type WeeklyLeaderboardEntry, type WeeklyPrize,
} from '@/lib/weekly-leaderboard-data'
import { currentWeekStart, weekResetLabel } from '@/lib/daily-challenge-data'

interface Props {
  studentId: string | null
}

function initials(name: string): string {
  const letters = name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '')
  return letters.join('') || '?'
}

const PODIUM_ORDER: { rank: number; order: string; height: string; ring: string }[] = [
  { rank: 2, order: 'order-1', height: 'h-16', ring: 'ring-gray-300' },
  { rank: 1, order: 'order-2', height: 'h-24', ring: 'ring-[#F5B800]' },
  { rank: 3, order: 'order-3', height: 'h-12', ring: 'ring-[#C97A3D]' },
]

export default function WeeklyLeaderboardPanel({ studentId }: Props) {
  const [top, setTop] = useState<WeeklyLeaderboardEntry[]>([])
  const [me, setMe] = useState<WeeklyLeaderboardEntry | null>(null)
  const [xpToNextRank, setXpToNextRank] = useState<number | null>(null)
  const [prizes, setPrizes] = useState<WeeklyPrize[]>([])
  const [loading, setLoading] = useState(true)

  const weekStart = currentWeekStart()

  const load = async () => {
    const [board, weekPrizes] = await Promise.all([
      fetchWeeklyLeaderboard(weekStart, studentId),
      fetchPrizesForWeek(weekStart),
    ])
    setTop(board.top)
    setMe(board.me)
    setXpToNextRank(board.xpToNextRank)
    setPrizes(weekPrizes)
    setLoading(false)
  }

  useEffect(() => {
    const init = async () => { await load() }
    init()
    // Realtime updates arrive from an external system (Supabase's
    // websocket channel) — re-fetching in that callback is exactly the
    // "subscribe to updates, setState in a callback" pattern effects are
    // meant for, not the synchronous-call pattern flagged above.
    const channel = subscribeWeeklyLeaderboard(() => load())
    return () => { unsubscribeChannel(channel) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart, studentId])

  const podiumEntries = PODIUM_ORDER.map(p => ({ ...p, entry: top.find(e => e.rank === p.rank) })).filter(p => p.entry)
  const firstPrize = prizes.find(p => p.place === 1)

  return (
    <div className="space-y-4 lg:sticky lg:top-6">
      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-1.5 text-sm font-bold text-gray-900">
            <Trophy size={16} className="text-[#F5B800]" /> Рейтинг недели
          </h2>
          <span className="rounded-full bg-gray-50 px-2.5 py-1 text-xs font-semibold text-gray-500">
            Сброс через {weekResetLabel(weekStart)}
          </span>
        </div>

        {loading ? (
          <div className="mt-8 text-center text-sm text-gray-400">Загрузка...</div>
        ) : top.length === 0 ? (
          <div className="mt-8 text-center text-sm text-gray-400">Рейтинг пока пуст — стань первым!</div>
        ) : (
          <>
            {/* Podium */}
            <div className="mt-5 flex items-end justify-center gap-3">
              {podiumEntries.map(({ rank, order, height, ring, entry }) => entry && (
                <div key={rank} className={`flex w-16 flex-col items-center ${order}`}>
                  <div className={`flex h-10 w-10 items-center justify-center rounded-full bg-[#1B4FD8] text-xs font-extrabold text-white ring-2 ${ring}`}>
                    {initials(entry.fullName)}
                  </div>
                  <div className="mt-1.5 w-full truncate text-center text-[10px] font-semibold text-[#191B23]">
                    {entry.studentId === studentId ? 'Вы' : entry.fullName.split(' ')[0]}
                  </div>
                  <div className="text-[10px] font-extrabold text-[#1B4FD8]">{entry.totalXp} XP</div>
                  <div className={`mt-1.5 flex w-full items-center justify-center rounded-t-lg text-xs font-extrabold text-white ${height}`} style={{ background: rank === 1 ? '#F5B800' : rank === 2 ? '#9CA3AF' : '#C97A3D' }}>
                    {rank}
                  </div>
                </div>
              ))}
            </div>

            {/* Table */}
            <div className="mt-5 space-y-1">
              {top.map(entry => (
                <div
                  key={entry.studentId}
                  className={`flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm ${entry.studentId === studentId ? 'bg-[#EEF2FF]' : ''}`}
                >
                  <span className="w-5 shrink-0 text-center text-xs font-bold text-gray-400">{entry.rank}</span>
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[10px] font-bold text-gray-600">
                    {initials(entry.fullName)}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-semibold text-[#191B23]">
                    {entry.studentId === studentId ? 'Вы' : entry.fullName}
                  </span>
                  <span className="shrink-0 text-xs font-extrabold text-[#1B4FD8]">{entry.totalXp} XP</span>
                </div>
              ))}

              {me && !top.some(e => e.studentId === studentId) && (
                <div className="mt-2 flex items-center gap-2.5 rounded-xl bg-[#EEF2FF] px-2.5 py-2 text-sm">
                  <span className="w-5 shrink-0 text-center text-xs font-bold text-[#1B4FD8]">{me.rank}</span>
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1B4FD8] text-[10px] font-bold text-white">
                    {initials(me.fullName)}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-semibold text-[#191B23]">Вы</span>
                  <span className="shrink-0 text-xs font-extrabold text-[#1B4FD8]">{me.totalXp} XP</span>
                </div>
              )}
            </div>

            {xpToNextRank !== null && xpToNextRank > 0 && (
              <p className="mt-3 text-center text-xs font-semibold text-gray-400">
                До ТОП-10 осталось {xpToNextRank} XP
              </p>
            )}
          </>
        )}
      </div>

      {firstPrize && (
        <div className="overflow-hidden rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50 to-white p-5">
          <div className="flex items-center gap-3">
            {firstPrize.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={firstPrize.image_url} alt={firstPrize.title} className="h-14 w-14 shrink-0 rounded-xl object-cover" />
            ) : (
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
                <Gift size={22} />
              </span>
            )}
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wide text-amber-600">Приз за 1 место</p>
              <p className="truncate text-sm font-bold text-[#191B23]">{firstPrize.title}</p>
              {firstPrize.description && <p className="mt-0.5 line-clamp-2 text-xs text-gray-500">{firstPrize.description}</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
