'use client'
export const dynamic = 'force-dynamic'

import { useState, type JSX } from 'react'
import { useRouter } from 'next/navigation'

const ONBOARDING_KEY = 'zhangak-onboarding-done'

interface Slide {
  title: string
  sub: string
  bg: string
  svg: JSX.Element
}

// Simple inline illustrations — no external asset files, matching this
// app's existing "no static illustration assets" convention.
const slides: Slide[] = [
  {
    title: 'Готовься к ОРТ где угодно',
    sub: 'Уроки, тренажёр и AI-наставник в твоём кармане',
    bg: '#1B4FD8',
    svg: (
      <svg viewBox="0 0 200 200" className="h-48 w-48" aria-hidden="true">
        <circle cx="100" cy="60" r="35" fill="white" opacity="0.9" />
        <rect x="65" y="100" width="70" height="80" rx="10" fill="white" opacity="0.9" />
        <rect x="120" y="110" width="40" height="60" rx="8" fill="#0D0D1A" opacity="0.8" />
        <rect x="125" y="118" width="30" height="40" rx="4" fill="#4B9EFF" />
      </svg>
    ),
  },
  {
    title: 'Соревнуйся с другими',
    sub: 'Еженедельный рейтинг и реальные призы',
    bg: '#1B4FD8',
    svg: (
      <svg viewBox="0 0 200 200" className="h-48 w-48" aria-hidden="true">
        <polygon points="100,20 120,80 185,80 130,115 150,175 100,140 50,175 70,115 15,80 80,80" fill="#FFD700" opacity="0.9" />
        <rect x="80" y="155" width="40" height="20" rx="4" fill="white" opacity="0.8" />
        <rect x="60" y="172" width="80" height="12" rx="4" fill="white" opacity="0.6" />
      </svg>
    ),
  },
  {
    title: 'AI знает твои слабые места',
    sub: 'Персональный план подготовки каждый день',
    bg: '#1B4FD8',
    svg: (
      <svg viewBox="0 0 200 200" className="h-48 w-48" aria-hidden="true">
        <rect x="60" y="50" width="80" height="80" rx="20" fill="white" opacity="0.9" />
        <circle cx="82" cy="85" r="10" fill="#1B4FD8" />
        <circle cx="118" cy="85" r="10" fill="#1B4FD8" />
        <rect x="80" y="105" width="40" height="8" rx="4" fill="#1B4FD8" opacity="0.5" />
        <line x1="80" y1="50" x2="70" y2="30" stroke="white" strokeWidth="4" strokeLinecap="round" />
        <line x1="120" y1="50" x2="130" y2="30" stroke="white" strokeWidth="4" strokeLinecap="round" />
        <rect x="55" y="130" width="90" height="50" rx="10" fill="white" opacity="0.7" />
      </svg>
    ),
  },
]

// Dedicated onboarding route (was a root-layout overlay before) — reached
// only from app/page.tsx's root smart router, on a first run with no
// session. Marks itself done and replaces to /login on finish, either via
// the last slide's "Начать" or the skip button.
export default function OnboardingPage() {
  const [current, setCurrent] = useState(0)
  const router = useRouter()

  const finish = () => {
    localStorage.setItem(ONBOARDING_KEY, 'true')
    router.replace('/login')
  }

  const next = () => {
    if (current < slides.length - 1) setCurrent(current + 1)
    else finish()
  }

  const slide = slides[current]

  return (
    <div className="fixed inset-0 flex flex-col" style={{ backgroundColor: slide.bg }}>
      {/* Skip button */}
      <div className="flex justify-end p-4 pt-12">
        <button type="button" onClick={finish} className="text-sm font-medium text-white/70">
          Пропустить
        </button>
      </div>

      {/* Illustration */}
      <div className="flex flex-1 items-center justify-center">
        {slide.svg}
      </div>

      {/* Text */}
      <div className="px-8 pb-4">
        <h2 className="text-center text-2xl font-bold leading-tight text-white">
          {slide.title}
        </h2>
        <p className="mt-3 text-center text-sm text-white/80">
          {slide.sub}
        </p>
      </div>

      {/* Progress dots */}
      <div className="flex justify-center gap-2 py-4">
        {slides.map((s, i) => (
          <div
            key={s.title}
            className={`h-2 rounded-full transition-all duration-300 ${i === current ? 'w-6 bg-white' : 'w-2 bg-white/40'}`}
          />
        ))}
      </div>

      {/* Button */}
      <div className="px-4 pb-12">
        <button
          type="button"
          onClick={next}
          className="h-14 w-full rounded-2xl bg-white text-base font-bold text-[#1B4FD8]"
        >
          {current < slides.length - 1 ? 'Далее →' : 'Начать →'}
        </button>
      </div>
    </div>
  )
}
