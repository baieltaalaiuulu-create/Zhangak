import Link from 'next/link'
import { BookMarked, BookOpen, Calculator, Check, Lock } from 'lucide-react'
import {
  type LessonView,
  type PlatformLessonStatus,
  type PlatformLessonSubject,
} from '@/lib/platform-lessons'

interface Props {
  lessons: LessonView[]
  statuses: Record<string, PlatformLessonStatus>
  activeId: string
}

const SUBJECT_ICON = {
  math: Calculator,
  kyr: BookMarked,
  other: BookOpen,
} satisfies Record<PlatformLessonSubject, typeof BookOpen>

export default function LessonSidebarList({ lessons, statuses, activeId }: Props) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <h3 className="mb-2 px-1 text-sm font-bold text-gray-900">Все уроки</h3>
      <div className="flex max-h-96 flex-col gap-1 overflow-y-auto">
        {lessons.map(lesson => {
          const status = statuses[lesson.id]
          const SubjectIcon = SUBJECT_ICON[lesson.subject]
          const isActive = lesson.id === activeId
          const rowClasses = `flex min-h-11 items-center gap-2.5 rounded-xl px-2.5 py-2 transition-colors ${
            isActive ? 'bg-blue-50' : status === 'locked' ? 'opacity-50' : 'hover:bg-gray-50'
          }`

          const content = (
            <>
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                status === 'done' ? 'bg-green-100 text-green-600' :
                status === 'current' ? 'bg-blue-100 text-blue-600' :
                'bg-gray-100 text-gray-400'
              }`}>
                {status === 'done'
                  ? <Check size={13} aria-label="Пройден" />
                  : status === 'locked'
                    ? <Lock size={12} aria-label="Заблокирован" />
                    : lesson.order_number}
              </span>
              <span className={`min-w-0 flex-1 truncate text-xs font-medium ${isActive ? 'font-bold text-blue-700' : 'text-gray-700'}`}>
                {lesson.title}
              </span>
              <SubjectIcon size={14} className="shrink-0 text-gray-400" aria-hidden="true" />
            </>
          )

          if (status === 'locked') {
            return <div key={lesson.id} className={rowClasses}>{content}</div>
          }

          return (
            <Link key={lesson.id} href={`/student/online/lessons/${lesson.id}`} className={rowClasses}>
              {content}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
