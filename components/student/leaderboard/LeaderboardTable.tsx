'use client'

import { useState } from 'react'
import { Flame, ChevronLeft, ChevronRight } from 'lucide-react'
import type { LeaderboardEntry } from '@/lib/leaderboard-data'

interface Props {
  entries: LeaderboardEntry[]
  currentStudentId: string
  streaks: Map<string, number>
  deltas: Map<string, number | null>
}

const PAGE_SIZE = 20

function initials(name: string): string {
  const letters = name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '')
  return letters.join('') || '?'
}

function DeltaCell({ delta }: { delta: number | null | undefined }) {
  if (delta === null || delta === undefined) return <span className="text-gray-300">—</span>
  if (delta > 0) return <span className="font-semibold text-green-600">+{delta}</span>
  if (delta < 0) return <span className="font-semibold text-red-500">{delta}</span>
  return <span className="text-gray-400">0</span>
}

function Row({ entry, isMe, streak, delta }: { entry: LeaderboardEntry; isMe: boolean; streak: number; delta: number | null | undefined }) {
  return (
    <tr className={isMe ? 'bg-[#EEF2FF]' : 'hover:bg-gray-50'} style={isMe ? { boxShadow: 'inset 3px 0 0 #1B4FD8' } : undefined}>
      <td className="px-4 py-3 text-sm font-bold text-[#191B23]">{entry.rank}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1B4FD8] text-xs font-bold text-white">
            {initials(entry.fullName)}
          </span>
          <span className="truncate text-sm font-semibold text-[#191B23]">
            {entry.fullName}{isMe && <span className="ml-1.5 text-xs font-bold text-[#1B4FD8]">(Вы)</span>}
          </span>
        </div>
      </td>
      <td className="px-4 py-3 text-sm font-bold text-[#191B23]">{entry.bestScore}</td>
      <td className="hidden px-4 py-3 text-sm md:table-cell"><DeltaCell delta={delta} /></td>
      <td className="hidden px-4 py-3 md:table-cell">
        <div className="flex items-center gap-1 text-sm font-semibold text-gray-500">
          <Flame size={14} className="text-orange-400" /> {streak}
        </div>
      </td>
    </tr>
  )
}

export default function LeaderboardTable({ entries, currentStudentId, streaks, deltas }: Props) {
  const [page, setPage] = useState(1)
  const pageCount = Math.max(1, Math.ceil(entries.length / PAGE_SIZE))
  const pageEntries = entries.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const myEntry = entries.find(e => e.studentId === currentStudentId)
  const myEntryOnPage = pageEntries.some(e => e.studentId === currentStudentId)

  if (entries.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center text-sm text-gray-400">
        Пока никто не проходил пробный ОРТ
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse md:min-w-[480px]">
          <thead>
            <tr className="border-b border-gray-100 text-left text-xs font-semibold text-gray-400">
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">Студент</th>
              <th className="px-4 py-3">Балл</th>
              <th className="hidden px-4 py-3 md:table-cell">Изменение</th>
              <th className="hidden px-4 py-3 md:table-cell">Дней подряд</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {pageEntries.map(entry => (
              <Row
                key={entry.studentId}
                entry={entry}
                isMe={entry.studentId === currentStudentId}
                streak={streaks.get(entry.studentId) ?? 0}
                delta={deltas.get(entry.studentId)}
              />
            ))}
            {!myEntryOnPage && myEntry && (
              <>
                <tr>
                  <td colSpan={5} className="px-4 py-1.5 text-center text-xs text-gray-300">···</td>
                </tr>
                <Row
                  entry={myEntry}
                  isMe
                  streak={streaks.get(myEntry.studentId) ?? 0}
                  delta={deltas.get(myEntry.studentId)}
                />
              </>
            )}
          </tbody>
        </table>
      </div>

      {pageCount > 1 && (
        <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
          <button
            type="button"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-gray-500 hover:bg-gray-50 disabled:opacity-30"
          >
            <ChevronLeft size={16} /> Назад
          </button>
          <span className="text-xs text-gray-400">Страница {page} из {pageCount}</span>
          <button
            type="button"
            onClick={() => setPage(p => Math.min(pageCount, p + 1))}
            disabled={page === pageCount}
            className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-gray-500 hover:bg-gray-50 disabled:opacity-30"
          >
            Вперёд <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  )
}
