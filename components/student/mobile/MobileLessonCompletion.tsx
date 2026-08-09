'use client'

import Link from 'next/link'

interface Props {
  practiceScore: number | null
  questionCount: number
  nextLessonHref: string | null
}

// Matches LessonsBanner's existing `xp = completed * 100` convention — the
// app-wide XP-per-lesson figure already shown elsewhere, not a new number.
const XP_PER_LESSON = 100

export default function MobileLessonCompletion({ practiceScore, questionCount, nextLessonHref }: Props) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-6 text-center shadow-sm">
      <div className="text-4xl">🎉</div>
      <h2 className="mt-2 text-lg font-bold text-[#191B23]">Урок завершён!</h2>

      {questionCount > 0 && practiceScore != null && (
        <p className="mt-3 text-sm font-semibold text-gray-600">
          Практика: {practiceScore}/{questionCount} ✓
        </p>
      )}
      <p className="mt-1 text-sm font-bold text-amber-600">+{XP_PER_LESSON} XP</p>

      {nextLessonHref ? (
        <Link
          href={nextLessonHref}
          className="mt-5 flex h-14 w-full items-center justify-center rounded-2xl bg-[#1B4FD8] text-base font-bold text-white"
        >
          Следующий урок →
        </Link>
      ) : (
        <p className="mt-5 text-sm text-gray-500">Это был последний урок в разделе 🎓</p>
      )}
      <Link href="/student/online/lessons" className="mt-3 block text-sm font-semibold text-gray-500">
        ← Назад к урокам
      </Link>
    </div>
  )
}
