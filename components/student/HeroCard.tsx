'use client'

import { ScoreHistory } from '@/lib/student-data'

interface Props {
  latestScore: number | null
  previousScore: number | null
  targetScore: number
  scoreHistory: ScoreHistory[]
}

const TARGET = 180

export default function HeroCard({ latestScore, previousScore, targetScore, scoreHistory }: Props) {
  const score   = latestScore ?? 0
  const target  = targetScore || TARGET
  const left    = Math.max(0, target - score)
  const pct     = Math.min(100, Math.round((score / target) * 100))
  const delta   = previousScore != null ? score - previousScore : null

  // Sparkline
  const sparkH  = 48
  const sparkW  = 160
  const minS    = Math.min(...scoreHistory.map(h => h.score), score - 20)
  const maxS    = Math.max(...scoreHistory.map(h => h.score), score + 5)
  const range   = maxS - minS || 1

  const points = scoreHistory.map((h, i) => {
    const x = (i / Math.max(scoreHistory.length - 1, 1)) * sparkW
    const y = sparkH - ((h.score - minS) / range) * sparkH
    return `${x},${y}`
  }).join(' ')

  return (
    <div className="relative overflow-hidden rounded-2xl p-5 sm:p-6 text-white"
      style={{ background: 'linear-gradient(135deg, #1e50e8 0%, #0f2fa8 60%, #061d70 100%)' }}>

      {/* Subtle grid texture */}
      <div className="pointer-events-none absolute inset-0 opacity-5"
        style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

      <div className="relative flex flex-wrap items-start justify-between gap-6">

        {/* Left: goal + current */}
        <div className="flex flex-wrap items-end gap-x-6 gap-y-4 sm:gap-x-8 min-w-0">
          {/* Target */}
          <div className="shrink-0">
            <p className="text-xs font-medium text-blue-200 mb-1">🎯 Цель</p>
            <p className="text-4xl sm:text-5xl font-bold leading-none">{target}</p>
          </div>

          <div className="hidden sm:block w-px h-16 bg-white/20 self-end mb-1 shrink-0" />

          {/* Current */}
          <div className="shrink-0">
            <p className="text-xs font-medium text-blue-200 mb-1">Текущий балл</p>
            <div className="flex items-end gap-2 flex-wrap">
              <p className="text-4xl sm:text-5xl font-bold leading-none">{score || '—'}</p>
              {delta !== null && delta !== 0 && (
                <span className={`mb-1 text-sm font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${
                  delta > 0 ? 'bg-green-400/20 text-green-300' : 'bg-red-400/20 text-red-300'
                }`}>
                  {delta > 0 ? `▲+${delta}` : `▼${delta}`}
                </span>
              )}
            </div>
          </div>

          <div className="hidden sm:block w-px h-16 bg-white/20 self-end mb-1 shrink-0" />

          {/* Left */}
          <div className="shrink-0">
            <p className="text-xs font-medium text-blue-200 mb-1">До цели</p>
            <p className="text-4xl sm:text-5xl font-bold leading-none text-orange-300">{left}</p>
            <p className="text-xs text-blue-300 mt-0.5">баллов</p>
          </div>
        </div>

        {/* Right: sparkline */}
        {scoreHistory.length > 1 && (
          <div className="flex flex-col items-end gap-1 shrink-0 ml-auto">
            <p className="text-xs text-blue-300">График роста</p>
            <svg width={sparkW} height={sparkH} className="overflow-visible">
              {/* Area fill */}
              <defs>
                <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#fff" stopOpacity="0.15" />
                  <stop offset="100%" stopColor="#fff" stopOpacity="0" />
                </linearGradient>
              </defs>
              <polyline
                points={`0,${sparkH} ${points} ${sparkW},${sparkH}`}
                fill="url(#spark-fill)"
                stroke="none"
              />
              <polyline
                points={points}
                fill="none"
                stroke="rgba(255,255,255,0.7)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Last dot */}
              {scoreHistory.length > 0 && (() => {
                const last = scoreHistory[scoreHistory.length - 1]
                const lx = sparkW
                const ly = sparkH - ((last.score - minS) / range) * sparkH
                return (
                  <circle cx={lx} cy={ly} r={4} fill="#fff" />
                )
              })()}
            </svg>
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className="mt-5">
        <div className="flex justify-between text-xs text-blue-200 mb-1.5">
          <span>{pct}% к цели</span>
          <span>осталось {left} баллов</span>
        </div>
        <div className="h-2 rounded-full bg-white/20 overflow-hidden">
          <div
            className="h-full rounded-full bg-orange-400 transition-all duration-700"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* CTA */}
      <div className="mt-4 flex justify-end">
        <a
          href="/student/online/lessons"
          className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2 text-sm font-bold text-blue-700 hover:bg-blue-50 transition-colors"
        >
          🚀 Продолжить подготовку
        </a>
      </div>
    </div>
  )
}
