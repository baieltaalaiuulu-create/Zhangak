'use client'

import { ArrowLeft, ArrowRight, CheckCircle2, RotateCcw } from 'lucide-react'

interface WrongQuestion {
  question: string
}

interface Props {
  correct: number
  total: number
  xp: number
  wrongQuestions: WrongQuestion[]
  nextLessonHref: string | null
  onBackToLessons: () => void
  /** True when this was a repeat run of an already-completed lesson. */
  isRepeat?: boolean
  /** Only used when isRepeat is true. */
  onRepeat?: () => void
}

// Full-screen "lesson complete" step — shown after finishing the inline
// practice quiz (STEP 2), or immediately when the lesson has no linked
// questions to practice at all (total === 0, the simplified branch).
export default function MobileLessonComplete({ correct, total, xp, wrongQuestions, nextLessonHref, onBackToLessons, isRepeat = false, onRepeat }: Props) {
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0

  return (
    // z-[60] — same reasoning as MobileLessonPractice: covers BottomNav
    // (z-50), which StudentLayout still mounts on this route.
    <div className="fixed inset-0 z-[60] flex flex-col overflow-y-auto bg-[#F4F6FA] px-4 pb-8 md:hidden">
      <span className="mx-auto mt-8 flex h-16 w-16 items-center justify-center rounded-full bg-green-50 text-green-600">
        <CheckCircle2 size={36} aria-hidden="true" />
      </span>
      <h1 className="mt-3 text-center text-2xl font-bold text-[#191B23]">Урок завершён!</h1>

      {total === 0 ? (
        <p className="mt-1 text-center text-sm font-semibold text-orange-500">+50 XP</p>
      ) : (
        <>
          <p className="text-center text-sm text-gray-500">Прекрасная работа!</p>

          <div className="mt-6 grid grid-cols-3 gap-3">
            <div className="rounded-2xl border border-gray-100 bg-white p-3 text-center">
              <p className="text-lg font-extrabold text-[#191B23]">{correct}/{total}</p>
              <p className="mt-0.5 text-xs text-gray-400">Вопросов</p>
            </div>
            <div className="rounded-2xl border border-gray-100 bg-white p-3 text-center">
              <p className="text-lg font-extrabold text-[#191B23]">{pct}%</p>
              <p className="mt-0.5 text-xs text-gray-400">Верно</p>
            </div>
            <div className="rounded-2xl border border-gray-100 bg-white p-3 text-center">
              <p className="text-lg font-extrabold text-orange-500">+{xp} XP</p>
              <p className="mt-0.5 text-xs text-gray-400">Заработано</p>
            </div>
          </div>

          {wrongQuestions.length > 0 && (
            <div className="mt-4 rounded-2xl border border-gray-100 bg-white p-4">
              <p className="text-sm font-semibold text-gray-900">Ошибки:</p>
              <ul className="mt-2 space-y-1.5">
                {wrongQuestions.map((w, i) => (
                  <li key={i} className="truncate text-xs text-gray-500">• {w.question}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      <div className="mt-6 flex flex-col gap-3">
        {nextLessonHref && (
          <a
            href={nextLessonHref}
            className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#1B4FD8] px-4 text-base font-bold text-white transition-colors active:bg-blue-700"
          >
            Следующий урок
            <ArrowRight size={19} aria-hidden="true" />
          </a>
        )}
        {isRepeat ? (
          <button
            type="button"
            onClick={onRepeat}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-gray-200 px-4 text-sm font-bold text-gray-600"
          >
            <RotateCcw size={17} aria-hidden="true" />
            Повторить ещё раз
          </button>
        ) : (
          <button
            type="button"
            onClick={onBackToLessons}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-gray-200 px-4 text-sm font-bold text-gray-600"
          >
            <ArrowLeft size={17} aria-hidden="true" />
            Назад к урокам
          </button>
        )}
      </div>
    </div>
  )
}
