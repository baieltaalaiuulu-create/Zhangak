import Link from 'next/link'
import { DailyTask } from '@/lib/student-data'

interface Props {
  tasks: DailyTask[]
}

const TASK_CONFIG = {
  lesson:   { icon: '🎥', color: 'bg-blue-50 text-blue-600',   dot: 'bg-blue-500'   },
  practice: { icon: '📝', color: 'bg-purple-50 text-purple-600', dot: 'bg-purple-500' },
  mock:     { icon: '🎯', color: 'bg-orange-50 text-orange-600', dot: 'bg-orange-500' },
  homework: { icon: '📖', color: 'bg-teal-50 text-teal-600',   dot: 'bg-teal-500'   },
}

export default function DailyPlan({ tasks }: Props) {
  const doneCount = tasks.filter(t => t.done).length
  const pct = tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm border border-gray-100 h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-bold text-gray-900">📅 Сегодняшний план</h2>
          <p className="text-xs text-gray-400 mt-0.5">{doneCount} из {tasks.length} выполнено</p>
        </div>
        {/* Ring */}
        <div className="relative w-12 h-12 shrink-0">
          <svg className="w-12 h-12 -rotate-90" viewBox="0 0 48 48">
            <circle cx="24" cy="24" r="20" fill="none" stroke="#e5e7eb" strokeWidth="4" />
            <circle
              cx="24" cy="24" r="20" fill="none"
              stroke="#1B4FD8" strokeWidth="4"
              strokeDasharray={`${2 * Math.PI * 20}`}
              strokeDashoffset={`${2 * Math.PI * 20 * (1 - pct / 100)}`}
              strokeLinecap="round"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-blue-700">
            {pct}%
          </span>
        </div>
      </div>

      {/* Task list */}
      <ul className="space-y-1">
        {tasks.map((task, i) => {
          const cfg = TASK_CONFIG[task.type]
          return (
            <li key={task.id}>
              {i > 0 && <div className="h-px bg-gray-50 mb-1" />}
              <Link
                href={task.href}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${
                  task.done ? 'opacity-60' : 'hover:bg-gray-50'
                }`}
              >
                {/* Checkbox */}
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-base ${cfg.color}`}>
                  {task.done ? '✓' : cfg.icon}
                </div>

                {/* Text */}
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-semibold leading-tight truncate ${
                    task.done ? 'line-through text-gray-400' : 'text-gray-800'
                  }`}>
                    {task.label}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{task.sub}</p>
                </div>

                {/* Status */}
                {task.done ? (
                  <span className="text-xs font-semibold text-green-600 shrink-0">Готово</span>
                ) : (
                  <div className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
                )}
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
