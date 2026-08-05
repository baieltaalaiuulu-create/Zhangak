import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface Props {
  totalScore: number
  previousScore: number | null
  completedAt: string
}

export default function MockResultsHero({ totalScore, previousScore, completedAt }: Props) {
  const delta = previousScore !== null ? totalScore - previousScore : null

  return (
    <div
      className="rounded-2xl p-6 sm:p-8 text-white shadow-sm"
      style={{ background: 'linear-gradient(135deg, #1B4FD8 0%, #3B82F6 100%)' }}
    >
      <span className="inline-block rounded-full bg-white/15 px-3 py-1 text-xs font-bold uppercase tracking-wide">
        Результат пробного ОРТ
      </span>
      <div className="mt-4 flex flex-wrap items-end gap-4">
        <span className="text-5xl font-extrabold tabular-nums">{totalScore}</span>
        <span className="pb-1.5 text-lg text-blue-100">/ 245</span>
        {delta !== null && (
          <span className={`mb-1.5 flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${delta > 0 ? 'bg-green-500/20 text-green-300' : delta < 0 ? 'bg-red-500/20 text-red-300' : 'bg-white/10 text-white'}`}>
            {delta > 0 ? <TrendingUp size={13} /> : delta < 0 ? <TrendingDown size={13} /> : <Minus size={13} />}
            {delta > 0 ? `+${delta}` : delta} к прошлому ОРТ
          </span>
        )}
      </div>
      <p className="mt-2 text-sm text-blue-100">
        {new Date(completedAt).toLocaleDateString('ru', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
      </p>
    </div>
  )
}
