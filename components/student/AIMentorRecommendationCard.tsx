import type { AIRecommendation } from '@/lib/dashboard-data'

interface Props {
  recommendation: AIRecommendation
  // Mobile-only simplified variant: one line of text, smaller CTA, no
  // gradient/projected-gain chrome. Omitted (default false) keeps the
  // desktop card exactly as it always rendered.
  compact?: boolean
}

export default function AIMentorRecommendationCard({ recommendation, compact = false }: Props) {
  if (compact) {
    return (
      <a
        href="/student/online/ai"
        className="flex min-h-11 items-center gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white" style={{ background: 'linear-gradient(135deg, #6C3DE0 0%, #4338CA 100%)' }}>
          🧠
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-700">{recommendation.text}</span>
        <span className="shrink-0 text-sm font-bold text-[#1B4FD8]">→</span>
      </a>
    )
  }

  return (
    <div className="rounded-2xl p-5 text-white shadow-sm" style={{ background: 'linear-gradient(135deg, #1F1B3A 0%, #0D0D1A 100%)' }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold">🧠 AI Mentor Рекомендация</h3>
        {recommendation.projectedGain > 0 && (
          <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-bold text-emerald-300">
            Прогноз: +{recommendation.projectedGain} баллов
          </span>
        )}
      </div>

      <p className="mt-3 text-sm leading-relaxed text-white/80">{recommendation.text}</p>

      {recommendation.projectedGain > 0 && (
        <p className="mt-3 text-xs text-white/50">Ожидаемый прирост за неделю</p>
      )}

      <a
        href="/student/online/ai"
        className="mt-4 inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold text-white shadow-md transition-opacity hover:opacity-90"
        style={{ background: 'linear-gradient(135deg, #6C3DE0 0%, #4338CA 100%)' }}
      >
        Начать с AI →
      </a>
    </div>
  )
}
