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

// Fixed 3-row checklist per the mobile spec (Урок / Практика / Задание
// дня) — a deliberately simplified read of the same real todayPlan data
// TodayPlanCard already shows in full on desktop, not a separate dataset.
export default function MobileTodayChecklist({
  lessonDone, lessonHref, practiceDone, practiceHref, challengeDone, challengeHref,
}: Props) {
  const rows: Row[] = [
    { label: 'Урок', done: lessonDone, href: lessonHref },
    { label: 'Практика', done: practiceDone, href: practiceHref },
    { label: 'Задание дня', done: challengeDone, href: challengeHref },
  ]
  const doneCount = rows.filter(r => r.done).length

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-[#191B23]">Сегодня</h3>
        <span className="text-xs font-semibold text-gray-400">{doneCount} из {rows.length} выполнено</span>
      </div>
      <div className="mt-2">
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
    </div>
  )
}
