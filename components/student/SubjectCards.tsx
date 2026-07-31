import { SubjectStat } from '@/lib/student-data'

interface Props {
  subjects: SubjectStat[]
  comparison?: { me: number; avg: number; top: number } | null
}

const SUBJECT_META: Record<string, {
  label: string
  icon: string
  color: string
  bg: string
  bar: string
}> = {
  math: {
    label: 'Математика',
    icon: '📐',
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    bar: 'bg-blue-500',
  },
  kyr: {
    label: 'Кыргыз тили',
    icon: '📘',
    color: 'text-orange-600',
    bg: 'bg-orange-50',
    bar: 'bg-orange-400',
  },
  analogy: {
    label: 'Аналогия',
    icon: '🧠',
    color: 'text-green-600',
    bg: 'bg-green-50',
    bar: 'bg-green-500',
  },
  reading: {
    label: 'Окуу жана түшүнүү',
    icon: '📖',
    color: 'text-purple-600',
    bg: 'bg-purple-50',
    bar: 'bg-purple-500',
  },
  grammar: {
    label: 'Грамматика',
    icon: '✏️',
    color: 'text-teal-600',
    bg: 'bg-teal-50',
    bar: 'bg-teal-500',
  },
}

function getStatus(pct: number): { label: string; color: string } {
  if (pct >= 80) return { label: 'Хорошо', color: 'text-green-600 bg-green-50' }
  if (pct >= 55) return { label: 'Средне', color: 'text-orange-600 bg-orange-50' }
  return { label: 'Повторить', color: 'text-red-600 bg-red-50' }
}

export default function SubjectCards({ subjects, comparison }: Props) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold text-gray-900">📊 Предметы</h2>
        {comparison && (
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span>Ты: <strong className="text-blue-600">{comparison.me}</strong></span>
            <span>Средний: <strong className="text-gray-600">{comparison.avg}</strong></span>
            <span>Топ: <strong className="text-purple-600">{comparison.top}</strong></span>
          </div>
        )}
      </div>

      <div className="space-y-3">
        {subjects.map((s) => {
          const meta = SUBJECT_META[s.subject] ?? SUBJECT_META.math
          const pct = s.max > 0 ? Math.round((s.current / s.max) * 100) : 0
          const status = getStatus(pct)

          return (
            <div key={s.subject} className="flex items-center gap-3">
              {/* Left color bar */}
              <div className={`w-1 h-10 rounded-full ${meta.bar}`} />

              {/* Icon */}
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-base ${meta.bg}`}>
                {meta.icon}
              </div>

              {/* Name + bar */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold text-gray-800">{meta.label}</span>
                  <span className={`text-xs font-bold ${meta.color}`}>
                    {s.current}/{s.max}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${meta.bar}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>

              {/* Delta */}
              {s.delta !== 0 && (
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${
                  s.delta > 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
                }`}>
                  {s.delta > 0 ? `▲+${s.delta}` : `▼${s.delta}`}
                </span>
              )}

              {/* Status */}
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${status.color}`}>
                {status.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
