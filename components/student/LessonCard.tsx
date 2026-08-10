import Link from 'next/link'
import { CheckCircle, Lock, Calculator, BookMarked, Play, RotateCcw, type LucideIcon } from 'lucide-react'
import { LESSON_SUBJECT_META, type Lesson, type LessonStatus, type LessonSubject } from '@/lib/lessons-data'

interface Props {
  lesson: Lesson
  status: LessonStatus
  questionCount: number
  courseProgress: number
}

const SUBJECT_ICON: Record<LessonSubject, LucideIcon> = {
  math: Calculator,
  kyr: BookMarked,
}

export default function LessonCard({ lesson, status, questionCount, courseProgress }: Props) {
  const meta = LESSON_SUBJECT_META[lesson.subject]
  const SubjectIcon = SUBJECT_ICON[lesson.subject]
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
            {status === 'done' ? <CheckCircle size={18} /> : status === 'locked' ? <Lock size={18} /> : lesson.order_number}
          </span>
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${meta.bg} ${meta.color}`}>
            <SubjectIcon size={18} />
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
            <span className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#1B4FD8] py-2.5 text-center text-sm font-bold text-white">
              <Play size={18} />
              {courseProgress === 0 ? 'Начать урок' : 'Продолжить →'}
            </span>
          )}
          {status === 'done' && (
            <span className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-gray-50 py-2.5 text-center text-sm font-bold text-gray-600">
              <RotateCcw size={18} />
              Повторить
            </span>
          )}
          {status === 'locked' && (
            <span className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-gray-50 py-2.5 text-center text-sm font-semibold text-gray-400">
              <Lock size={18} />
              Заблокировано
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
    <Link href={`/student/online/lessons/${lesson.id}`} prefetch={true} className="block h-full">
      {body}
    </Link>
  )
}
