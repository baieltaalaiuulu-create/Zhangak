'use client'

import Link from 'next/link'
import { CheckCircle2, PlayCircle, Lock, ChevronRight } from 'lucide-react'
import type { Lesson, LessonStatus } from '@/lib/lessons-data'

interface Props {
  lesson: Lesson
  status: LessonStatus
  onLockedTap: () => void
}

// Matches the ~25 мин estimate used everywhere else a lesson's duration is
// shown (LessonCard, lib/dashboard-data.ts) — not a fabricated number.
const LESSON_MINUTES = 25

export default function MobileLessonRow({ lesson, status, onLockedTap }: Props) {
  if (status === 'locked') {
    // Deliberately minimal per spec — no card, no big lock icon, no
    // "Заблокировано" button. Tapping surfaces a toast instead of navigating.
    return (
      <button
        type="button"
        onClick={onLockedTap}
        className="flex min-h-[72px] w-full items-center gap-3 px-3 py-3 text-left"
      >
        <Lock size={20} className="shrink-0 text-gray-300" />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-400">
          {lesson.order_number}. {lesson.title}
        </span>
      </button>
    )
  }

  if (status === 'done') {
    return (
      <Link href={`/student/online/lessons/${lesson.id}`} prefetch={true} className="flex min-h-[72px] w-full items-center gap-3 px-3 py-3">
        <CheckCircle2 size={22} className="shrink-0 text-green-600" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-base font-semibold text-gray-700">{lesson.order_number}. {lesson.title}</span>
            <span className="shrink-0 rounded-full bg-green-50 px-1.5 py-0.5 text-[10px] font-bold text-green-600">Пройден</span>
          </div>
          <p className="mt-0.5 text-xs text-gray-400">~{LESSON_MINUTES} мин</p>
        </div>
      </Link>
    )
  }

  // current
  return (
    <Link
      href={`/student/online/lessons/${lesson.id}`}
      prefetch={true}
      className="flex min-h-[88px] w-full items-center gap-3 border-l-4 border-l-[#1B4FD8] bg-[#EEF2FF]/50 px-3 py-3"
    >
      <PlayCircle size={22} className="shrink-0 text-[#1B4FD8]" />
      <div className="min-w-0 flex-1">
        <span className="line-clamp-2 text-base font-bold leading-snug text-[#191B23]">{lesson.order_number}. {lesson.title}</span>
        <p className="mt-0.5 text-xs text-gray-400">~{LESSON_MINUTES} мин</p>
      </div>
      <span className="flex min-h-11 shrink-0 items-center gap-0.5 rounded-lg bg-[#1B4FD8] px-3 py-2 text-xs font-bold text-white">
        Продолжить <ChevronRight size={14} />
      </span>
    </Link>
  )
}
