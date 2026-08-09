import Link from 'next/link'
import { CheckCircle2, Circle } from 'lucide-react'
import type { TodayPlan } from '@/lib/dashboard-data'

interface Props {
  plan: TodayPlan
}

export default function TodayPlanCard({ plan }: Props) {
  return (
    <div className="w-full rounded-2xl border border-gray-100 bg-white px-4 py-5 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-sm font-bold text-gray-900">📋 План на сегодня</h3>
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
          {plan.minutesRemaining > 0 && (
            <span className="rounded-full bg-gray-50 px-2.5 py-1 text-gray-500">+{plan.minutesRemaining} мин осталось</span>
          )}
          <span className="rounded-full bg-green-50 px-2.5 py-1 text-green-600">
            {plan.doneCount} из {plan.totalCount} выполнено ({plan.pct}%)
          </span>
        </div>
      </div>

      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-100">
        <div className="h-full rounded-full bg-green-500 transition-all duration-700" style={{ width: `${plan.pct}%` }} />
      </div>

      <div className="mt-4 space-y-2">
        {plan.items.map((item, i) => (
          <Link
            key={i}
            href={item.href}
            className={`mx-0 flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors ${
              item.done ? 'border-green-100 bg-green-50/60' : 'border-gray-100 bg-gray-50/60 hover:bg-gray-100'
            }`}
          >
            {item.done ? (
              <CheckCircle2 size={20} className="shrink-0 text-green-600" />
            ) : (
              <Circle size={20} className="shrink-0 text-gray-300" />
            )}

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1 text-xs font-bold text-gray-800">
                <span>{item.kindLabel}</span>
                <span className="text-gray-400">→</span>
              </div>
              <div className="mt-0.5 flex items-center justify-between gap-2">
                <span className={`min-w-0 truncate text-sm font-semibold ${item.done ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
                  {item.title}
                </span>
                <span
                  className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold text-white"
                  style={{ background: item.subjectColor }}
                >
                  {item.subjectLabel}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-gray-400">{item.meta}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
