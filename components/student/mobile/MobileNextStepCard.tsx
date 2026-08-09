'use client'

import Link from 'next/link'

interface Props {
  lessonId: string
  questionCount: number
}

// Matches the 0.75 min/question estimate already used for practice minutes
// elsewhere (lib/dashboard-data.ts's practiceMinutes calc) — not a guess.
const MINUTES_PER_QUESTION = 0.75

export default function MobileNextStepCard({ lessonId, questionCount }: Props) {
  if (questionCount === 0) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-5 text-center shadow-sm">
        <p className="text-sm text-gray-400">Практика к этому уроку скоро появится</p>
      </div>
    )
  }

  const minutes = Math.max(1, Math.round(questionCount * MINUTES_PER_QUESTION))

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wide text-gray-400">Практика</p>
      <p className="mt-1 text-sm text-gray-500">{questionCount} вопросов • ~{minutes} минут</p>
      <Link
        href={`/student/online/practice?lesson=${lessonId}`}
        className="mt-4 flex h-14 w-full items-center justify-center rounded-2xl bg-[#1B4FD8] text-base font-bold text-white"
      >
        Начать практику
      </Link>
    </div>
  )
}
