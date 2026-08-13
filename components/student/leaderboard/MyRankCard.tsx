import { Trophy, TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface Props {
  rank: number | null
  score: number | null
  delta: number | null
}

export default function MyRankCard({ rank, score, delta }: Props) {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-[#1B3F92] to-[#2F6BFF] p-6 text-white">
      <div className="flex items-center gap-2 text-sm font-semibold text-white/80">
        <Trophy size={16} /> Ваш результат
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-x-8 gap-y-3">
        <div>
          <div className="text-3xl font-extrabold">{rank ? `#${rank}` : '—'}</div>
          <div className="text-xs text-white/70">Место в рейтинге</div>
        </div>
        <div>
          <div className="text-3xl font-extrabold">{score ?? '—'}</div>
          <div className="text-xs text-white/70">Баллов ОРТ</div>
        </div>
        <div>
          <div className={`flex items-center gap-1 text-lg font-extrabold ${delta === null ? '' : delta > 0 ? 'text-green-300' : delta < 0 ? 'text-red-300' : 'text-white/80'}`}>
            {delta === null ? (
              <Minus size={16} />
            ) : delta > 0 ? (
              <><TrendingUp size={16} /> +{delta}</>
            ) : delta < 0 ? (
              <><TrendingDown size={16} /> {delta}</>
            ) : (
              <><Minus size={16} /> 0</>
            )}
          </div>
          <div className="text-xs text-white/70">Изменение</div>
        </div>
      </div>
      {rank === null && (
        <p className="mt-3 text-xs text-white/70">Пройдите пробный ОРТ, чтобы попасть в рейтинг</p>
      )}
    </div>
  )
}
