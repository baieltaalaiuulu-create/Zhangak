'use client'

import Link from 'next/link'
import { LESSON_SUBJECT_META, type Lesson } from '@/lib/lessons-data'

interface Props {
  firstName: string
  currentScore: number
  targetScore: number
  heroLesson: Lesson | null
  loading: boolean
}

// Matches the ~25 мин estimate used everywhere else a lesson's duration is
// shown (LessonCard, lib/dashboard-data.ts) — lessons don't carry their own
// duration field, so this is the established app-wide convention, not a
// fabricated number.
const LESSON_MINUTES = 25

function HeroSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-gray-100 bg-white p-5">
      <div className="h-3 w-36 rounded bg-gray-100" />
      <div className="mt-3 h-5 w-20 rounded-full bg-gray-100" />
      <div className="mt-3 h-5 w-3/4 rounded bg-gray-100" />
      <div className="mt-2 h-3 w-16 rounded bg-gray-100" />
      <div className="mt-4 h-14 w-full rounded-2xl bg-gray-100" />
    </div>
  )
}

export default function MobileHero({ firstName, currentScore, targetScore, heroLesson, loading }: Props) {
  const pct = targetScore > 0 ? Math.min(100, Math.round((currentScore / targetScore) * 100)) : 0

  return (
    <div className="space-y-4">
      {/* Top section */}
      <div>
        <h1 className="text-xl font-bold text-[#191B23]">Салам, {firstName} 👋</h1>
        <p className="mt-1 text-sm text-gray-500">ОРТ максаты: {currentScore} → {targetScore}</p>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100">
          <div className="h-full rounded-full bg-[#1B4FD8] transition-all duration-700" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Main hero block — most prominent element on the page */}
      {loading ? (
        <HeroSkeleton />
      ) : heroLesson ? (
        <div className="rounded-2xl bg-[#1B4FD8] p-5 text-white shadow-lg">
          <p className="text-xs font-semibold uppercase tracking-widest opacity-80">Продолжить обучение</p>
          <span className="mt-1 inline-flex w-fit items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-xs font-semibold">
            {LESSON_SUBJECT_META[heroLesson.subject].icon} {LESSON_SUBJECT_META[heroLesson.subject].label}
          </span>
          <h2 className="mt-1 text-lg font-bold leading-snug">{heroLesson.title}</h2>
          <p className="mt-0.5 text-sm opacity-75">~{LESSON_MINUTES} мин</p>
          <Link
            href="/student/online/lessons"
            className="mt-4 flex h-12 w-full items-center justify-center gap-1.5 rounded-xl bg-white text-sm font-bold text-[#1B4FD8] transition-colors active:bg-gray-100"
          >
            ▶ Перейти к урокам
          </Link>
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-100 bg-white p-5 text-center shadow-sm">
          <p className="text-sm font-semibold text-gray-600">🎉 Все уроки пройдены!</p>
          <Link
            href="/student/online/practice"
            className="mt-4 flex h-14 w-full items-center justify-center rounded-2xl bg-[#1B4FD8] text-base font-bold text-white transition-colors active:bg-blue-700"
          >
            Открыть тренажёр →
          </Link>
        </div>
      )}
    </div>
  )
}
