'use client'

import { useState } from 'react'
import type { Achievement } from '@/lib/dashboard-data'

interface Props {
  achievements: Achievement[]
  // Mobile-only: cap the visible list and offer a "Смотреть все →" toggle
  // instead of always rendering every achievement. Omitted (default:
  // unlimited) keeps the desktop card exactly as it always rendered.
  maxItems?: number
}

export default function RecentAchievementsCard({ achievements, maxItems }: Props) {
  const [expanded, setExpanded] = useState(false)

  const capped = maxItems != null && !expanded
  const visible = capped ? achievements.slice(0, maxItems) : achievements
  const hiddenCount = capped ? achievements.length - visible.length : 0

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-bold text-gray-900">Последние достижения</h3>

      {achievements.length === 0 ? (
        <p className="mt-4 text-center text-xs text-gray-400">Пройди первый урок или тренажёр, чтобы получить достижение!</p>
      ) : (
        <div className="mt-4 space-y-3">
          {visible.map((a, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-50 text-lg">
                {a.icon}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold text-gray-900">{a.title}</p>
                <p className="text-xs text-gray-400">{a.subtitle}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-3 flex min-h-11 w-full items-center justify-center text-xs font-bold text-[#1B4FD8]"
        >
          Смотреть все →
        </button>
      )}
    </div>
  )
}
