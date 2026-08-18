import { Zap, Clock, Target, Flame } from 'lucide-react'

interface Props {
  xp: number
  elapsedSeconds: number
  accuracy: number
  streak: number
}

function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  if (h > 0) return `${h}ч ${m}м`
  return `${m}м`
}

export default function MockStatsRow({ xp, elapsedSeconds, accuracy, streak }: Props) {
  const stats = [
    { icon: Zap, label: 'Опыт', value: `+${xp} XP`, color: '#F59E0B', bg: '#FFFBEB' },
    { icon: Clock, label: 'Время', value: formatDuration(elapsedSeconds), color: '#1B3F92', bg: '#EEF2FF' },
    { icon: Target, label: 'Точность', value: `${accuracy}%`, color: '#10B981', bg: '#F0FDF4' },
    { icon: Flame, label: 'Серия', value: `${streak} дней`, color: '#EF4444', bg: '#FEF2F2' },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {stats.map(s => {
        const Icon = s.icon
        return (
          <div key={s.label} className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: s.bg }}>
              <Icon size={18} color={s.color} />
            </div>
            <div className="mt-2 text-base font-extrabold text-[#191B23]">{s.value}</div>
            <div className="text-xs text-gray-400">{s.label}</div>
          </div>
        )
      })}
    </div>
  )
}
