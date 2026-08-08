import type { WeeklyStats } from '@/lib/dashboard-data'

interface Props {
  stats: WeeklyStats
}

function MiniBars({ tone }: { tone: string }) {
  const heights = [40, 70, 55, 90]
  return (
    <div className="flex items-end gap-0.5">
      {heights.map((h, i) => (
        <span key={i} className="w-1 rounded-sm" style={{ height: `${h * 0.14}px`, background: tone }} />
      ))}
    </div>
  )
}

export default function WeeklyProgressCard({ stats }: Props) {
  const items = [
    {
      label: 'Баллы ОРТ',
      value: stats.scoreDelta == null ? '—' : `${stats.scoreDelta >= 0 ? '+' : ''}${stats.scoreDelta}`,
      icon: '📈',
      tone: stats.scoreDelta != null && stats.scoreDelta < 0 ? '#EF4444' : '#22C55E',
    },
    { label: 'Время занятий', value: `${stats.hoursThisWeek}ч`, icon: '📊', tone: '#1B4FD8' },
    { label: 'Решено вопросов', value: String(stats.questionsThisWeek), icon: '📊', tone: '#8B5CF6' },
    { label: 'План', value: `${stats.planPct}%`, icon: '📊', tone: '#F5890A' },
  ]

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-bold text-gray-900">Прогресс за неделю</h3>
      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {items.map(item => (
          <div key={item.label} className="flex flex-col gap-1.5 rounded-xl bg-gray-50/70 p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">{item.icon}</span>
              <MiniBars tone={item.tone} />
            </div>
            <span className="text-lg font-extrabold text-gray-900">{item.value}</span>
            <span className="text-[11px] font-medium text-gray-400">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
