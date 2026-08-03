import Link from 'next/link'
import { LESSON_SUBJECT_META, type Lesson, type LessonStatus } from '@/lib/lessons-data'

interface Props {
  lesson: Lesson
  status: LessonStatus
  questionCount: number
  courseProgress: number
}

export default function LessonCard({ lesson, status, questionCount, courseProgress }: Props) {
  const meta = LESSON_SUBJECT_META[lesson.subject]
  const stripColor = status === 'locked' ? 'bg-gray-200' : meta.strip

  const body = (
    <div className={`flex h-full flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition-shadow ${
      status === 'locked' ? 'border-gray-100 opacity-60' : 'border-gray-100 hover:shadow-md'
    }`}>
      <div className={`h-1.5 ${stripColor}`} />
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-center justify-between">
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
            status === 'done' ? 'bg-green-50 text-green-600' :
            status === 'current' ? 'bg-blue-50 text-blue-600' :
            'bg-gray-100 text-gray-400'
          }`}>
            {status === 'done' ? '✓' : status === 'locked' ? '🔒' : lesson.order_number}
          </span>
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-base ${meta.bg}`}>
            {meta.icon}
          </span>
        </div>

        <div className="min-w-0">
          <h3 className="line-clamp-2 text-sm font-bold leading-snug text-gray-900">{lesson.title}</h3>
          <p className="mt-1 line-clamp-2 text-xs text-gray-400">
            {lesson.description || meta.label}
          </p>
        </div>

        <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
          <span className="whitespace-nowrap rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">
            🕐 25 мин
          </span>
          {questionCount > 0 && (
            <span className="whitespace-nowrap rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">
              📝 {questionCount} вопросов
            </span>
          )}
        </div>

        {status === 'current' && (
          <div>
            <div className="mb-1 flex justify-between text-[11px] text-gray-400">
              <span>Прогресс курса</span>
              <span>{courseProgress}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-[#1B4FD8] transition-all duration-700"
                style={{ width: `${courseProgress}%` }}
              />
            </div>
          </div>
        )}

        <div className="mt-1">
          {status === 'current' && (
            <span className="block w-full rounded-xl bg-[#1B4FD8] py-2.5 text-center text-sm font-bold text-white">
              Продолжить урок →
            </span>
          )}
          {status === 'done' && (
            <span className="block w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 text-center text-sm font-bold text-gray-600">
              Пересмотреть
            </span>
          )}
          {status === 'locked' && (
            <span className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-gray-50 py-2.5 text-center text-sm font-semibold text-gray-400">
              🔒 Заблокировано
            </span>
          )}
        </div>
      </div>
    </div>
  )

  if (status === 'locked') {
    return <div aria-disabled="true">{body}</div>
  }

  return (
    <Link href={`/student/online/lessons/${lesson.id}`} className="block h-full">
      {body}
    </Link>
  )
}
