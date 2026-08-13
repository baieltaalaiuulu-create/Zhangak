'use client'
export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  BookOpenCheck,
  BrainCircuit,
  ChevronLeft,
  Trophy,
  type LucideIcon,
} from 'lucide-react'

const ONBOARDING_KEY = 'zhangak-onboarding-done'

interface Slide {
  eyebrow: string
  title: string
  description: string
  Icon: LucideIcon
}

const slides: Slide[] = [
  {
    eyebrow: 'Сабактар жана практика',
    title: 'ОРТга күн сайын аз-аздан даярдан',
    description: 'Видео көр, кыска тесттен өт жана кийинки кадамды дароо көр.',
    Icon: BookOpenCheck,
  },
  {
    eyebrow: 'Жумалык рейтинг',
    title: 'Өз өсүшүңдү көрүп, темпти сакта',
    description: 'Күн сайын упай топто. Рейтинг кимден озуу керектигин түшүнүүгө жардам берет.',
    Icon: Trophy,
  },
  {
    eyebrow: 'AI-насаатчы',
    title: 'Түшүнбөгөн темаңа жардам ал',
    description: 'Суроо бер, каталарыңды талда жана өзүңө ылайык даярдык планын ал.',
    Icon: BrainCircuit,
  },
]

export default function OnboardingPage() {
  const [current, setCurrent] = useState(0)
  const router = useRouter()

  const finish = () => {
    localStorage.setItem(ONBOARDING_KEY, 'true')
    router.replace('/login')
  }

  const next = () => {
    if (current < slides.length - 1) setCurrent(index => index + 1)
    else finish()
  }

  const previous = () => setCurrent(index => Math.max(0, index - 1))
  const slide = slides[current]
  const isLast = current === slides.length - 1

  return (
    <main className="fixed inset-0 overflow-y-auto bg-[#1B3F92] text-white">
      <div className="mx-auto flex min-h-full w-full max-w-md flex-col px-5 pb-[max(24px,env(safe-area-inset-bottom))] pt-[max(20px,env(safe-area-inset-top))]">
        <header className="flex min-h-12 items-center justify-between">
          {current > 0 ? (
            <button
              type="button"
              onClick={previous}
              className="flex min-h-11 min-w-11 items-center justify-center rounded-xl text-white/80 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              aria-label="Мурунку кадам"
            >
              <ChevronLeft size={24} strokeWidth={2.25} aria-hidden="true" />
            </button>
          ) : (
            <div className="h-11 w-11" aria-hidden="true" />
          )}

          <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold tracking-wide text-white/80">
            {current + 1} / {slides.length}
          </span>

          <button
            type="button"
            onClick={finish}
            className="min-h-11 rounded-xl px-2 text-sm font-semibold text-white/75 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            Өткөрүү
          </button>
        </header>

        <section
          className="flex flex-1 flex-col items-center justify-center py-8 text-center"
          aria-live="polite"
          aria-atomic="true"
        >
          <div className="relative flex h-44 w-44 items-center justify-center rounded-[44px] bg-white/10 ring-1 ring-white/15">
            <div className="absolute inset-5 rounded-[34px] bg-white/10" aria-hidden="true" />
            <slide.Icon className="relative h-20 w-20 text-white" strokeWidth={1.7} aria-hidden="true" />
          </div>

          <p className="mt-10 text-xs font-extrabold uppercase tracking-[0.16em] text-blue-100">
            {slide.eyebrow}
          </p>
          <h1 className="mt-3 max-w-sm text-3xl font-extrabold leading-[1.12] tracking-tight">
            {slide.title}
          </h1>
          <p className="mt-4 max-w-xs text-[15px] font-medium leading-6 text-blue-100">
            {slide.description}
          </p>
        </section>

        <div className="pb-3">
          <div className="mb-5 grid grid-cols-3 gap-2" aria-label={`Кадам ${current + 1} / ${slides.length}`}>
            {slides.map((item, index) => (
              <span
                key={item.title}
                aria-current={index === current ? 'step' : undefined}
                className={`h-1.5 rounded-full transition-colors ${index <= current ? 'bg-white' : 'bg-white/25'}`}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={next}
            className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-white px-5 text-base font-extrabold text-[#1B3F92] shadow-lg shadow-blue-950/15 transition-transform active:scale-[0.99] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/40"
          >
            {isLast ? 'Баштоо' : 'Кийинки'}
            <ArrowRight size={20} strokeWidth={2.5} aria-hidden="true" />
          </button>
        </div>
      </div>
    </main>
  )
}
