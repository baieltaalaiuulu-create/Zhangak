import type { MiniStats } from '@/lib/ai-chat-panel-data'

interface Props {
  stats: MiniStats
}

function formatMinutes(min: number): string {
  if (min === 0) return '0м'
  const h = Math.floor(min / 60)
  const m = min % 60
  return h > 0 ? `${h}ч ${m}м` : `${m}м`
}

export default function MiniStatsRow({ stats }: Props) {
  return (
    <div className="grid grid-cols-3 gap-2 rounded-2xl border border-gray-100 bg-white p-3 text-center shadow-sm">
      <div>
        <div className="text-sm font-extrabold text-gray-900">{stats.tasksDoneToday}/{stats.tasksGoalToday}</div>
        <div className="text-[10px] text-gray-400">Задач</div>
      </div>
      <div>
        <div className="text-sm font-extrabold text-orange-500">🔥 {stats.streak}</div>
        <div className="text-[10px] text-gray-400">Серия</div>
      </div>
      <div>
        <div className="text-sm font-extrabold text-gray-900">{formatMinutes(stats.minutesToday)}</div>
        <div className="text-[10px] text-gray-400">Время</div>
      </div>
    </div>
  )
}
