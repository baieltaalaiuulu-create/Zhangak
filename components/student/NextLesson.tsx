import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

interface LessonMini {
  id: string
  title: string
  order_number: number
}

interface SubjectProgress {
  completed: number
  total: number
}

interface Props {
  mathLesson: LessonMini | null
  kyrLesson: LessonMini | null
  mathProgress: SubjectProgress
  kyrProgress: SubjectProgress
}

interface SubjectCardProps {
  lesson: LessonMini | null
  progress: SubjectProgress
  badge: string
  accent: string
}

function SubjectCard({ lesson, progress, badge, accent }: SubjectCardProps) {
  if (!lesson) {
    return (
      <div
        className="flex h-[60px] items-center rounded-xl border border-gray-100 bg-white px-4"
        style={{ borderLeft: `3px solid ${accent}` }}
      >
        <span className="text-xs font-semibold text-gray-700">✅ Все уроки пройдены!</span>
      </div>
    )
  }

  return (
    <Link
      href={`/student/online/lessons/${lesson.id}`}
      className="flex h-[60px] items-center gap-3 rounded-xl border border-gray-100 bg-white px-4 transition-colors hover:bg-gray-50"
      style={{ borderLeft: `3px solid ${accent}` }}
    >
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold leading-tight" style={{ color: accent }}>{badge}</p>
        <h4 className="truncate text-xs font-semibold leading-tight text-gray-900">{lesson.title}</h4>
        <p className="text-[10px] leading-tight text-gray-400">{progress.completed}/{progress.total} уроков</p>
      </div>
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white"
        style={{ background: accent }}
      >
        <ChevronRight size={15} />
      </span>
    </Link>
  )
}

export default function NextLesson({ mathLesson, kyrLesson, mathProgress, kyrProgress }: Props) {
  return (
    <div className="flex flex-col gap-2">
      <SubjectCard lesson={mathLesson} progress={mathProgress} badge="📐 Математика" accent="#1B4FD8" />
      <SubjectCard lesson={kyrLesson} progress={kyrProgress} badge="📘 Кыргыз тили" accent="#F5890A" />
    </div>
  )
}
