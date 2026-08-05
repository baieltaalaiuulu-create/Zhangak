import { Trophy } from 'lucide-react'
import type { Leaderboard } from '@/lib/mock-data'

interface Props {
  leaderboard: Leaderboard
  studentId: string
}

const MEDAL_COLORS: Record<number, string> = { 1: '#F59E0B', 2: '#9CA3AF', 3: '#B45309' }

export default function MockLeaderboardCard({ leaderboard, studentId }: Props) {
  const { top, me } = leaderboard
  const meInTop = top.some(r => r.studentId === studentId)

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="flex items-center gap-2 border-b border-gray-200 px-5 py-4">
        <Trophy size={16} className="text-[#1B4FD8]" />
        <span className="text-sm font-bold text-[#191B23]">Рейтинг</span>
      </div>

      {top.length === 0 ? (
        <div className="p-8 text-center text-sm text-gray-400">Пока нет других результатов</div>
      ) : (
        <div className="divide-y divide-gray-100">
          {top.map(row => (
            <div
              key={row.studentId}
              className={`flex items-center gap-3 px-5 py-3 ${row.studentId === studentId ? 'bg-[#EEF2FF]' : ''}`}
            >
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                style={{ background: MEDAL_COLORS[row.rank] ? `${MEDAL_COLORS[row.rank]}22` : '#F3F4F6', color: MEDAL_COLORS[row.rank] ?? '#6B7280' }}
              >
                {row.rank}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[#191B23]">
                {row.fullName}{row.studentId === studentId ? ' (Вы)' : ''}
              </span>
              <span className="text-sm font-bold text-[#1B4FD8]">{row.totalScore}</span>
            </div>
          ))}
        </div>
      )}

      {me && !meInTop && (
        <div className="flex items-center gap-3 border-t border-gray-200 bg-[#EEF2FF] px-5 py-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold text-[#1B4FD8]">
            {me.rank}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[#191B23]">Вы</span>
          <span className="text-sm font-bold text-[#1B4FD8]">{me.totalScore}</span>
        </div>
      )}
    </div>
  )
}
