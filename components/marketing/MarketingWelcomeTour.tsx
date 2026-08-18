'use client'

import { useEffect, useState } from 'react'
import { ArrowRight, BookOpenCheck, ChevronLeft, CircleHelp, GraduationCap, X } from 'lucide-react'

import { MARKETING_TOUR_DISMISSED_KEY, markDismissed, wasDismissed } from '@/lib/first-visit'

const steps = [
  {
    title: 'Добро пожаловать в Zhangak',
    description: 'Здесь собрана подготовка к ОРТ для 10–11 классов: занятия, практика и понятный путь к цели.',
    Icon: GraduationCap,
  },
  {
    title: 'Сначала выберите программу',
    description: 'Посмотрите форматы занятий, результаты и задайте команде вопросы в WhatsApp — без обязательной регистрации.',
    Icon: BookOpenCheck,
  },
  {
    title: 'Учебный кабинет — отдельно',
    description: 'После записи ученик и преподаватель входят на защищённую учебную платформу со своими материалами.',
    Icon: CircleHelp,
  },
] as const

/** A short first-visit overview for the public site. It is skippable and is
 * never mounted on login or protected workspace routes. */
export default function MarketingWelcomeTour() {
  const [visible, setVisible] = useState(false)
  const [current, setCurrent] = useState(0)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setVisible(!wasDismissed(window.localStorage, MARKETING_TOUR_DISMISSED_KEY))
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  const dismiss = () => {
    markDismissed(window.localStorage, MARKETING_TOUR_DISMISSED_KEY)
    setVisible(false)
  }

  if (!visible) return null

  const step = steps[current]
  const isLast = current === steps.length - 1

  return (
    <div className="fixed inset-0 z-[110] flex items-end justify-center bg-slate-950/45 p-3 sm:items-center sm:p-5">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="marketing-tour-title"
        aria-describedby="marketing-tour-description"
        className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl sm:p-7"
      >
        <div className="flex items-start justify-between gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#EEF2FF] text-[#1B3F92]">
            <step.Icon size={24} aria-hidden="true" />
          </span>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Пропустить знакомство"
            className="flex min-h-10 min-w-10 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-50 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3F92]"
          >
            <X size={19} aria-hidden="true" />
          </button>
        </div>

        <p className="mt-6 text-xs font-extrabold uppercase tracking-[0.15em] text-[#1B3F92]">Знакомство · {current + 1} из {steps.length}</p>
        <h1 id="marketing-tour-title" className="mt-2 text-2xl font-black tracking-tight text-slate-950">{step.title}</h1>
        <p id="marketing-tour-description" className="mt-3 text-sm leading-6 text-slate-600">{step.description}</p>

        <div className="mt-6 flex gap-1.5" aria-label={`Шаг ${current + 1} из ${steps.length}`}>
          {steps.map((item, index) => <span key={item.title} className={`h-1.5 flex-1 rounded-full ${index <= current ? 'bg-[#1B3F92]' : 'bg-slate-200'}`} />)}
        </div>

        <div className="mt-6 flex items-center justify-between gap-3">
          {current > 0 ? (
            <button type="button" onClick={() => setCurrent(index => index - 1)} className="inline-flex min-h-11 items-center gap-1 rounded-xl px-3 text-sm font-bold text-slate-600 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3F92]">
              <ChevronLeft size={17} aria-hidden="true" />Назад
            </button>
          ) : <button type="button" onClick={dismiss} className="min-h-11 rounded-xl px-3 text-sm font-bold text-slate-500 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3F92]">Пропустить</button>}
          <button
            type="button"
            onClick={() => isLast ? dismiss() : setCurrent(index => index + 1)}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#1B3F92] px-4 text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3F92] focus-visible:ring-offset-2"
          >
            {isLast ? 'Понятно' : 'Дальше'} <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>
      </section>
    </div>
  )
}
