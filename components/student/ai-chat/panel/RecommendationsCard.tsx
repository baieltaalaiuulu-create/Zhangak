import Link from 'next/link'
import type { Recommendation } from '@/lib/ai-chat-panel-data'

interface Props {
  recommendations: Recommendation[]
}

export default function RecommendationsCard({ recommendations }: Props) {
  if (recommendations.length === 0) return null

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <p className="mb-2.5 text-[11px] font-bold uppercase tracking-wide text-gray-400">Сегодня AI рекомендует</p>
      <div className="space-y-1">
        {recommendations.map((r, i) => (
          <Link
            key={i}
            href={r.href}
            className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 transition-colors hover:bg-gray-50"
          >
            <span className="text-base">{r.icon}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-gray-800">{r.title}</p>
              <p className="text-[10px] text-gray-400">{r.subtitle}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
