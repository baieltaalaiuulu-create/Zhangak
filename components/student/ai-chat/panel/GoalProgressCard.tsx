import type { GoalProgress } from '@/lib/ai-chat-panel-data'

interface Props {
  goal: GoalProgress
}

export default function GoalProgressCard({ goal }: Props) {
  return (
    <div className="rounded-2xl p-5 text-white shadow-sm" style={{ background: 'linear-gradient(135deg, #6C3DE0 0%, #4338CA 100%)' }}>
      <p className="text-[11px] font-bold uppercase tracking-wide text-white/70">До цели</p>
      <p className="mt-1 text-3xl font-extrabold">{goal.current} <span className="text-lg font-semibold text-white/60">/ {goal.target}</span></p>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/20">
        <div className="h-full rounded-full bg-white transition-all duration-700" style={{ width: `${goal.pct}%` }} />
      </div>

      <p className="mt-2 text-xs font-medium text-white/80">
        {goal.remaining > 0 ? `Осталось ${goal.remaining} баллов` : 'Цель достигнута! 🎉'}
      </p>
    </div>
  )
}
