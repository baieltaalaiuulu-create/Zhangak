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
      <div className="flex items-end justify-center gap-2 md:gap-3">
        {top3.map(entry => {
          const style = PODIUM_STYLE[entry.rank] ?? PODIUM_STYLE[3]
          const isMe = entry.studentId === currentStudentId
          return (
            <div key={entry.studentId} className={`flex w-16 flex-col items-center md:w-24 ${style.order}`}>
              <div className={`relative flex h-10 w-10 items-center justify-center rounded-full bg-[#1B4FD8] text-sm font-extrabold text-white ring-2 md:h-14 md:w-14 md:text-lg md:ring-4 ${style.ring}`}>
                {initials(entry.fullName)}
                {entry.rank === 1 && (
                  <Crown size={14} className="absolute -top-3.5 text-[#F5B800] md:-top-5 md:size-[18px]" fill="#F5B800" />
                )}
              </div>
              <div className={`mt-1.5 truncate text-[10px] font-semibold md:mt-2 md:text-xs ${isMe ? 'text-[#1B4FD8]' : 'text-[#191B23]'}`}>
                {isMe ? 'Вы' : entry.fullName.split(' ')[0]}
              </div>
              <div className="text-xs font-extrabold text-[#191B23] md:text-sm">{entry.bestScore}</div>
              <div className={`mt-1.5 flex h-10 w-full items-center justify-center rounded-t-lg text-xs font-extrabold text-white md:mt-2 md:text-sm ${style.height.replace('h-28', 'md:h-28').replace('h-20', 'md:h-20').replace('h-16', 'md:h-16')}`} style={{ background: style.medal }}>
                {entry.rank}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
