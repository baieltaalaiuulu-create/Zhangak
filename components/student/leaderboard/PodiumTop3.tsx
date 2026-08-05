import { Crown } from 'lucide-react'
import type { LeaderboardEntry } from '@/lib/leaderboard-data'

interface Props {
  entries: LeaderboardEntry[]
  currentStudentId: string
}

function initials(name: string): string {
  const letters = name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '')
  return letters.join('') || '?'
}

const PODIUM_STYLE: Record<number, { order: string; height: string; ring: string; medal: string }> = {
  1: { order: 'order-2', height: 'h-28', ring: 'ring-[#F5B800]', medal: '#F5B800' },
  2: { order: 'order-1', height: 'h-20', ring: 'ring-gray-300', medal: '#9CA3AF' },
  3: { order: 'order-3', height: 'h-16', ring: 'ring-[#C97A3D]', medal: '#C97A3D' },
}

export default function PodiumTop3({ entries, currentStudentId }: Props) {
  const top3 = entries.slice(0, 3)
  if (top3.length === 0) return null

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6">
      <h2 className="mb-4 text-sm font-bold text-[#191B23]">Топ-3</h2>
      <div className="flex items-end justify-center gap-3">
        {top3.map(entry => {
          const style = PODIUM_STYLE[entry.rank] ?? PODIUM_STYLE[3]
          const isMe = entry.studentId === currentStudentId
          return (
            <div key={entry.studentId} className={`flex w-24 flex-col items-center ${style.order}`}>
              <div className={`relative flex h-14 w-14 items-center justify-center rounded-full bg-[#1B4FD8] text-lg font-extrabold text-white ring-4 ${style.ring}`}>
                {initials(entry.fullName)}
                {entry.rank === 1 && (
                  <Crown size={18} className="absolute -top-5 text-[#F5B800]" fill="#F5B800" />
                )}
              </div>
              <div className={`mt-2 truncate text-xs font-semibold ${isMe ? 'text-[#1B4FD8]' : 'text-[#191B23]'}`}>
                {isMe ? 'Вы' : entry.fullName.split(' ')[0]}
              </div>
              <div className="text-sm font-extrabold text-[#191B23]">{entry.bestScore}</div>
              <div className={`mt-2 flex w-full items-center justify-center rounded-t-lg text-sm font-extrabold text-white ${style.height}`} style={{ background: style.medal }}>
                {entry.rank}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
