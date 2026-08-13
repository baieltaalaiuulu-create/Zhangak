'use client'

import Link from 'next/link'
import { ArrowRight, Calculator, CheckCircle2, Languages, Target } from 'lucide-react'
import { LESSON_SUBJECT_LABELS, type Lesson } from '@/lib/lesson-contract'

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
  const scoreTowardGoal = Math.max(0, Math.min(currentScore, targetScore))
  const pct = targetScore > 0 ? Math.min(100, Math.round((scoreTowardGoal / targetScore) * 100)) : 0
  const SubjectIcon = heroLesson?.subject === 'math' ? Calculator : Languages

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold text-[#1B4FD8]">Салам, {firstName}!</p>
        <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-[#191B23]">Что сделаем сегодня?</h1>
        <div className="mt-3 rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-600">
            <Target size={18} className="text-[#1B4FD8]" aria-hidden="true" />
            <span>Твой путь к цели</span>
            <span className="ml-auto font-bold text-[#191B23]">{currentScore > 0 ? currentScore : '—'} / {targetScore}</span>
          </div>
          <div
            className="mt-3 h-2 overflow-hidden rounded-full bg-blue-50"
            role="progressbar"
            aria-label="Прогресс к цели ОРТ"
            aria-valuemin={0}
            aria-valuemax={targetScore}
            aria-valuenow={scoreTowardGoal}
          >
            <div className="h-full rounded-full bg-[#1B4FD8] transition-all duration-700" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>

      {loading ? (
        <HeroSkeleton />
      ) : heroLesson ? (
        <div className="rounded-2xl bg-[#1B4FD8] p-5 text-white shadow-lg">
          <p className="text-xs font-semibold uppercase tracking-widest text-white/75">Следующий шаг</p>
          <span className="mt-2 inline-flex w-fit items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-xs font-semibold">
            <SubjectIcon size={14} aria-hidden="true" />
            {LESSON_SUBJECT_LABELS[heroLesson.subject]}
          </span>
          <h2 className="mt-2 text-xl font-bold leading-snug">{heroLesson.title}</h2>
          <p className="mt-1 text-sm text-white/75">Около {LESSON_MINUTES} минут</p>
          <Link
            href={`/student/online/lessons/${heroLesson.id}`}
            className="mt-5 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 text-base font-bold text-[#1B4FD8] transition-colors active:bg-blue-50"
          >
            Продолжить урок
            <ArrowRight size={19} aria-hidden="true" />
          </Link>
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-100 bg-white p-5 text-center shadow-sm">
          <CheckCircle2 size={32} className="mx-auto text-green-600" aria-hidden="true" />
          <p className="mt-2 text-sm font-semibold text-gray-700">Все доступные уроки пройдены</p>
          <Link
            href="/student/online/practice"
            className="mt-4 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#1B4FD8] px-4 text-base font-bold text-white transition-colors active:bg-blue-700"
          >
            Открыть тренажёр
            <ArrowRight size={19} aria-hidden="true" />
          </Link>
        </div>
      )}
    </div>
  )
}
