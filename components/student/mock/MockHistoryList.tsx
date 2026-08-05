import Link from 'next/link'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import type { MockHistoryItem } from '@/lib/mock-data'

interface Props {
  history: MockHistoryItem[]
}

export default function MockHistoryList({ history }: Props) {
  if (history.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-400">
        Вы ещё не проходили пробный ОРТ
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="border-b border-gray-200 px-5 py-4 text-sm font-bold text-[#191B23]">
        Мои прошлые результаты
      </div>
      <div className="divide-y divide-gray-100">
        {history.map((h, i) => {
          const prev = history[i + 1]
          const delta = prev ? h.total_score - prev.total_score : null
          return (
            <Link
              key={h.id}
              href={`/student/online/mock/${h.test_id}/results?r=${h.id}`}
              className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-gray-50 transition-colors"
            >
              <div>
                <div className="text-sm font-semibold text-[#191B23]">{h.total_score} / 245</div>
                <div className="text-xs text-gray-400">
                  {new Date(h.completed_at).toLocaleDateString('ru', { day: 'numeric', month: 'long', year: 'numeric' })}
                </div>
              </div>
              {delta !== null && (
                <span className={`flex items-center gap-1 text-xs font-bold ${delta > 0 ? 'text-green-600' : delta < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                  {delta > 0 ? <TrendingUp size={14} /> : delta < 0 ? <TrendingDown size={14} /> : <Minus size={14} />}
                  {delta > 0 ? `+${delta}` : delta}
                </span>
              )}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
