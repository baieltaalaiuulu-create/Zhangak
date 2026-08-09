'use client'

import type { WeeklyStats } from '@/lib/dashboard-data'

interface Props {
  stats: WeeklyStats
}

// Compact 2x2 replacement for the full WeeklyProgressCard on mobile — same
// real weeklyStats numbers, same value formatting, just laid out as 4 small
// tiles instead of the desktop card's mini-bar-chart version.
export default function MobileStatsGrid({ stats }: Props) {
  const items = [
    {
      label: 'Баллы ОРТ',
      value: stats.scoreDelta == null ? '—' : `${stats.scoreDelta >= 0 ? '+' : ''}${stats.scoreDelta}`,
    },
    { label: 'Время', value: `${stats.hoursThisWeek}ч` },
    { label: 'Вопросы', value: String(stats.questionsThisWeek) },
    { label: 'План', value: `${stats.planPct}%` },
  ]

  return (
    <div className="grid grid-cols-2 gap-3">
      {items.map(item => (
        <div key={item.label} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="text-lg font-extrabold text-[#191B23]">{item.value}</div>
          <div className="mt-0.5 text-xs font-medium text-gray-400">{item.label}</div>
        </div>
      ))}
    </div>
  )
}
