'use client'

import Link from 'next/link'
import { CheckCircle2, Circle } from 'lucide-react'

interface Row {
  label: string
  done: boolean
  href: string
}

interface Props {
  lessonDone: boolean
  lessonHref: string
  practiceDone: boolean
  practiceHref: string
  challengeDone: boolean
  challengeHref: string
}

// Fixed 3-row checklist per the mobile spec (Урок / Тренажёр / Задание
// дня) — a deliberately simplified read of the same real todayPlan data
// TodayPlanCard already shows in full on desktop, not a separate dataset.
export default function MobileTodayChecklist({
  lessonDone, lessonHref, practiceDone, practiceHref, challengeDone, challengeHref,
}: Props) {
  const rows: Row[] = [
    { label: 'Урок', done: lessonDone, href: lessonHref },
    { label: 'Тренажёр', done: practiceDone, href: practiceHref },
    { label: 'Задание дня', done: challengeDone, href: challengeHref },
  ]
  const doneCount = rows.filter(r => r.done).length

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Сегодня</p>
      <div className="mt-3">
        {rows.map(row => (
          <Link key={row.label} href={row.href} className="flex min-h-11 items-center gap-3 py-1.5">
            {row.done
              ? <CheckCircle2 size={22} className="shrink-0 text-green-600" />
              : <Circle size={22} className="shrink-0 text-gray-300" />}
            <span className={`text-base ${row.done ? 'text-gray-400 line-through' : 'font-semibold text-[#191B23]'}`}>
              {row.label}
            </span>
          </Link>
        ))}
      </div>
      <p className="mt-2 text-xs text-gray-400">{doneCount} из {rows.length} выполнено</p>
    </div>
  )
}
