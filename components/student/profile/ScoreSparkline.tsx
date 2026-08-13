import type { ProfileScorePoint } from '@/lib/platform-profile'

interface Props {
  history: ProfileScorePoint[]
}

const WIDTH = 280
const HEIGHT = 64
const PADDING = 8

export default function ScoreSparkline({ history }: Props) {
  if (history.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-bold text-[#191B23]">История баллов ОРТ</h2>
        <p className="mt-4 text-center text-xs text-gray-400">Пройдите пробный ОРТ, чтобы увидеть динамику</p>
      </div>
    )
  }

  const scores = history.map(h => h.score)
  const min = Math.min(...scores)
  const max = Math.max(...scores)
  const range = max - min || 1

  const points = history.map((h, i) => {
    const x = history.length > 1 ? PADDING + (i / (history.length - 1)) * (WIDTH - PADDING * 2) : WIDTH / 2
    const y = HEIGHT - PADDING - ((h.score - min) / range) * (HEIGHT - PADDING * 2)
    return { x, y, score: h.score }
  })

  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
  const latest = history[history.length - 1]
  const first = history[0]
  const trendUp = latest.score >= first.score

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-[#191B23]">История баллов ОРТ</h2>
        <span className={`text-xs font-bold ${trendUp ? 'text-green-600' : 'text-red-500'}`}>
          {trendUp ? '↑' : '↓'} последние {history.length}
        </span>
      </div>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="mt-3 w-full" preserveAspectRatio="none" role="img" aria-label="График последних баллов">
        <path d={path} fill="none" stroke="#1B4FD8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={i === points.length - 1 ? 3.5 : 2.5} fill={i === points.length - 1 ? '#1B4FD8' : '#C3D3FA'} />
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-[11px] text-gray-400">
        <span>{first.score}</span>
        <span className="font-bold text-[#1B4FD8]">{latest.score}</span>
      </div>
    </div>
  )
}
