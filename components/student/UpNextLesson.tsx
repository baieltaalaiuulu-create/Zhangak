import Link from 'next/link'

interface Props {
  lesson: { id: string; title: string; subject: string; order_number: number } | null
  progress: number // % of series completed
}

const SUBJECT_META: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  math: { label: 'Математика', color: 'text-blue-600',   bg: 'bg-blue-50',   icon: '📐' },
  kyr:  { label: 'Кыргыз тили', color: 'text-orange-600', bg: 'bg-orange-50', icon: '📘' },
}

export default function UpNextLesson({ lesson, progress }: Props) {
  if (!lesson) {
    return (
      <div className="rounded-2xl bg-white p-5 shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-3 h-full min-h-[220px]">
        <span className="text-4xl">🎉</span>
        <p className="text-sm font-semibold text-gray-700 text-center">Все уроки пройдены!</p>
        <p className="text-xs text-gray-400 text-center">Продолжайте практиковаться</p>
      </div>
    )
  }

  const meta = SUBJECT_META[lesson.subject] ?? SUBJECT_META.math
  const circumference = 2 * Math.PI * 20

  return (
    <div className="rounded-2xl bg-white shadow-sm border border-gray-100 overflow-hidden flex flex-col">
      {/* Color stripe */}
      <div className="h-1 bg-blue-600" />

      <div className="p-5 flex flex-col flex-1 gap-4">
        {/* Badge */}
        <div className="flex items-center justify-between">
          <span className={`text-xs font-semibold px-3 py-1 rounded-full ${meta.bg} ${meta.color}`}>
            ▶ Следующий урок
          </span>
          {/* Progress ring */}
          <div className="relative w-11 h-11 shrink-0">
            <svg className="w-11 h-11 -rotate-90" viewBox="0 0 48 48">
              <circle cx="24" cy="24" r="20" fill="none" stroke="#e5e7eb" strokeWidth="4" />
              <circle
                cx="24" cy="24" r="20" fill="none"
                stroke="#1B4FD8" strokeWidth="4"
                strokeDasharray={`${circumference}`}
                strokeDashoffset={`${circumference * (1 - progress / 100)}`}
                strokeLinecap="round"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-blue-700">
              {progress}%
            </span>
          </div>
        </div>

        {/* Subject */}
        <div className={`flex items-center gap-2 text-sm font-semibold ${meta.color}`}>
          <span>{meta.icon}</span>
          <span>{meta.label}</span>
        </div>

        {/* Title */}
        <div className="min-w-0">
          <h3 className="text-xl font-bold text-gray-900 leading-tight break-words">{lesson.title}</h3>
          <p className="text-xs text-gray-400 mt-1">После урока откроется практический тест</p>
        </div>

        {/* Meta pills */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">🕐 25 мин</span>
          <span className="text-xs font-medium bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">
            Урок {lesson.order_number}
          </span>
        </div>

        {/* CTA */}
        <Link
          href={`/student/online/lessons/${lesson.id}`}
          className="mt-auto block w-full rounded-xl bg-blue-600 py-3 text-center text-sm font-bold text-white hover:bg-blue-700 transition-colors shadow-md shadow-blue-200"
        >
          Начать урок →
        </Link>
      </div>
    </div>
  )
}
