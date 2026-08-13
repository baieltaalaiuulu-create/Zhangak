import Link from 'next/link'
import { ArrowRight, BarChart3 } from 'lucide-react'
import type { SubjectGridItem } from '@/lib/student-dashboard-contract'

interface Props {
  subjects: SubjectGridItem[]
}

export default function SubjectsGrid({ subjects }: Props) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900"><BarChart3 size={18} aria-hidden="true" />Предметы ОРТ</h3>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {subjects.map(s => {
          const pct = s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0
          const isDone = s.total > 0 && s.completed >= s.total

          return (
            <div key={s.key} className="rounded-xl border border-gray-100 p-4" style={{ borderLeft: `3px solid ${s.color}` }}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold text-gray-900">{s.label}</span>
                {s.hoursRemaining > 0 && (
                  <span className="shrink-0 text-[11px] font-medium text-gray-400">~{s.hoursRemaining}ч осталось</span>
                )}
              </div>
              <p className="mt-0.5 truncate text-xs text-gray-400">{s.topicLabel}</p>

              <div className="mt-3 flex items-center justify-between text-[11px] font-semibold text-gray-500">
                <span>Прогресс</span>
                <span style={{ color: s.color }}>{s.completed}/{s.total} уроков</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-100">
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: s.color }} />
              </div>

              <Link
                href={s.href}
                className="mt-3 inline-flex items-center gap-1 text-xs font-bold transition-opacity hover:opacity-80"
                style={{ color: s.color }}
              >
                {isDone ? 'Повторить' : 'Продолжить'}
                <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </div>
          )
        })}
      </div>
    </div>
  )
}
