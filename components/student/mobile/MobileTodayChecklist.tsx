'use client'

import Link from 'next/link'
import { BookOpen, BrainCircuit, CalendarCheck2, CheckCircle2, ChevronRight, type LucideIcon } from 'lucide-react'

interface Row {
  label: string
  done: boolean
  href: string
  icon: LucideIcon
  available: boolean
}

interface Props {
  lessonDone: boolean
  lessonHref: string
  practiceDone: boolean
  practiceHref: string
  challengeDone: boolean
  challengeHref: string
  /** A task may be shown but intentionally unavailable while its own
   * first-party server flow is being migrated. This avoids a deceptive link
   * into an old client-authoritative feature. */
  challengeAvailable?: boolean
}

// Fixed 3-row checklist per the mobile spec (Урок / Тренажёр / Задание
// дня) — a deliberately simplified read of the same real todayPlan data
// TodayPlanCard already shows in full on desktop, not a separate dataset.
export default function MobileTodayChecklist({
  lessonDone, lessonHref, practiceDone, practiceHref, challengeDone, challengeHref,
  challengeAvailable = true,
}: Props) {
  const rows: Row[] = [
    { label: 'Урок', done: lessonDone, href: lessonHref, icon: BookOpen, available: true },
    { label: 'Тренажёр', done: practiceDone, href: practiceHref, icon: BrainCircuit, available: true },
    { label: 'Задание дня', done: challengeDone, href: challengeHref, icon: CalendarCheck2, available: challengeAvailable },
  ]
  const doneCount = rows.filter(r => r.done).length

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-[#191B23]">План на сегодня</h2>
        <span className="text-xs font-semibold text-gray-400">{doneCount} из {rows.length}</span>
      </div>
      <div className="mt-3 space-y-1">
        {rows.map(row => {
          const Icon = row.icon
          if (!row.available) {
            return (
              <div
                key={row.label}
                aria-label={`${row.label}: скоро будет доступно`}
                className="flex min-h-14 items-center gap-3 rounded-xl px-2 text-gray-400"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-400">
                  <Icon size={20} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1 text-sm font-semibold">{row.label}</span>
                <span className="text-xs font-semibold">Скоро</span>
              </div>
            )
          }
          return (
            <Link
              key={row.label}
              href={row.href}
              aria-label={`${row.label}: ${row.done ? 'выполнено' : 'перейти к заданию'}`}
              className="flex min-h-14 items-center gap-3 rounded-xl px-2 transition-colors active:bg-gray-50"
            >
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${row.done ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-[#1B3F92]'}`}>
                {row.done ? <CheckCircle2 size={21} aria-hidden="true" /> : <Icon size={20} aria-hidden="true" />}
              </span>
              <span className={`min-w-0 flex-1 text-sm font-semibold ${row.done ? 'text-gray-500' : 'text-[#191B23]'}`}>
                {row.label}
              </span>
              <span className={`text-xs font-semibold ${row.done ? 'text-green-600' : 'text-gray-400'}`}>
                {row.done ? 'Готово' : 'Начать'}
              </span>
              <ChevronRight size={17} className="shrink-0 text-gray-300" aria-hidden="true" />
            </Link>
          )
        })}
      </div>
    </div>
  )
}
