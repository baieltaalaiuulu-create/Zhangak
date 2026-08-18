'use client'

import Link from 'next/link'
import { CalendarCheck2, Check } from 'lucide-react'

interface Props {
  questionCount: number
  minutes: number
  participantCount: number
  completed: boolean
  href: string
}

// Sourced from the real daily_challenges feature (lib/daily-challenge-data.ts)
// — distinct from the "Задание дня" row in MobileTodayChecklist above, which
// is a simplified read of the day's analogy-practice item, not this table.
export default function MobileDailyChallengeCard({ questionCount, minutes, participantCount, completed, href }: Props) {
  return (
    <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4">
      <h3 className="flex items-center gap-2 text-sm font-bold text-[#191B23]"><CalendarCheck2 size={18} className="text-orange-500" aria-hidden="true" /> Задание дня</h3>
      <p className="mt-1 text-xs text-gray-600">{questionCount} вопросов • ~{minutes} мин</p>
      <p className="mt-0.5 text-xs text-gray-500">{participantCount} учеников уже прошли</p>
      <Link
        href={href}
        className={`mt-3 flex h-11 w-full items-center justify-center rounded-xl text-sm font-bold text-white transition-colors ${
          completed ? 'bg-gray-300' : 'bg-orange-500 active:bg-orange-600'
        }`}
      >
        {completed ? <><Check size={16} aria-hidden="true" />Пройдено</> : 'Начать задание'}
      </Link>
    </div>
  )
}
