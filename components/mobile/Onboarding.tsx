'use client'

import { useRef, useState, type TouchEvent } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  onDone: () => void
}

// Simple inline illustrations — kept intentionally lightweight (no external
// assets) rather than full Figma-exported artwork, matching this app's
// existing "no static illustration assets" convention (SVG/emoji only).
function StudentIllustration() {
  return (
    <svg viewBox="0 0 200 140" className="h-36 w-full" fill="none" aria-hidden="true">
      <rect x="55" y="30" width="90" height="70" rx="10" fill="white" fillOpacity="0.15" />
      <rect x="65" y="42" width="70" height="46" rx="6" fill="white" fillOpacity="0.35" />
      <rect x="75" y="52" width="50" height="6" rx="3" fill="white" fillOpacity="0.6" />
      <rect x="75" y="64" width="36" height="6" rx="3" fill="white" fillOpacity="0.6" />
      <circle cx="100" cy="16" r="14" fill="white" fillOpacity="0.9" />
      <rect x="30" y="108" width="140" height="8" rx="4" fill="white" fillOpacity="0.2" />
    </svg>
  )
}

function TrophyIllustration() {
  return (
    <svg viewBox="0 0 200 140" className="h-36 w-full" fill="none" aria-hidden="true">
      <rect x="80" y="90" width="40" height="14" rx="3" fill="white" fillOpacity="0.3" />
      <rect x="70" y="104" width="60" height="8" rx="4" fill="white" fillOpacity="0.2" />
      <path d="M75 30h50v30c0 14-11 26-25 26s-25-12-25-26V30z" fill="white" fillOpacity="0.9" />
      <path d="M75 36h-14c-3 0-5 2-5 5v6c0 10 8 16 18 17" stroke="white" strokeOpacity="0.5" strokeWidth="4" fill="none" />
      <path d="M125 36h14c3 0 5 2 5 5v6c0 10-8 16-18 17" stroke="white" strokeOpacity="0.5" strokeWidth="4" fill="none" />
      <circle cx="100" cy="45" r="10" fill="#1B4FD8" fillOpacity="0.4" />
    </svg>
  )
}

function AiIllustration() {
  return (
    <svg viewBox="0 0 200 140" className="h-36 w-full" fill="none" aria-hidden="true">
      <rect x="65" y="35" width="70" height="55" rx="16" fill="white" fillOpacity="0.9" />
      <circle cx="85" cy="60" r="6" fill="#1B4FD8" />
      <circle cx="115" cy="60" r="6" fill="#1B4FD8" />
      <rect x="90" y="74" width="20" height="5" rx="2.5" fill="#1B4FD8" fillOpacity="0.6" />
      <rect x="95" y="18" width="10" height="18" rx="5" fill="white" fillOpacity="0.7" />
      <circle cx="100" cy="14" r="6" fill="white" fillOpacity="0.9" />
      <rect x="40" y="55" width="16" height="24" rx="8" fill="white" fillOpacity="0.3" />
      <rect x="144" y="55" width="16" height="24" rx="8" fill="white" fillOpacity="0.3" />
    </svg>
  )
}

interface Slide {
  Illustration: () => React.JSX.Element
  title: string
  subtitle: string
  cta: string
}

const SLIDES: Slide[] = [
  {
    Illustration: StudentIllustration,
    title: 'Готовься к ОРТ где угодно',
    subtitle: 'Уроки, тренажёр и AI-наставник в твоём кармане',
    cta: 'Далее →',
  },
  {
    Illustration: TrophyIllustration,
    title: 'Соревнуйся с другими',
    subtitle: 'Еженедельный рейтинг и реальные призы',
    cta: 'Далее →',
  },
  {
    Illustration: AiIllustration,
    title: 'AI знает твои слабые места',
    subtitle: 'Персональный план каждый день',
    cta: 'Начать →',
  },
]

const SWIPE_THRESHOLD_PX = 50

// 3-slide onboarding — shown once, right after SplashScreen (gated by
// AppIntroGate), only on mobile. Supports both button and swipe navigation.
export default function Onboarding({ onDone }: Props) {
  const router = useRouter()
  const [index, setIndex] = useState(0)
  const touchStartX = useRef(0)

  const isLast = index === SLIDES.length - 1

  const advance = () => {
    if (isLast) {
      onDone()
      router.push('/login')
      return
    }
    setIndex(i => i + 1)
  }

  const skip = () => {
    onDone()
    router.push('/login')
  }

  const handleTouchStart = (e: TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }

  const handleTouchEnd = (e: TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current
    if (dx < -SWIPE_THRESHOLD_PX) advance()
    else if (dx > SWIPE_THRESHOLD_PX && index > 0) setIndex(i => i - 1)
  }

  const slide = SLIDES[index]
  const { Illustration } = slide

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-[#1B4FD8] px-8 py-10 md:hidden"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="flex justify-end">
        <button type="button" onClick={skip} className="text-sm font-semibold text-white/70">
          Пропустить
        </button>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <Illustration />
        <h1 className="mt-8 text-2xl font-bold text-white">{slide.title}</h1>
        <p className="mt-3 text-sm text-white/80">{slide.subtitle}</p>
      </div>

      <div className="mb-6 flex justify-center gap-2">
        {SLIDES.map((s, i) => (
          <span key={s.title} className={`h-2 w-2 rounded-full ${i === index ? 'bg-white' : 'bg-white/40'}`} />
        ))}
      </div>

      <button
        type="button"
        onClick={advance}
        className="flex h-14 w-full items-center justify-center rounded-2xl bg-white text-base font-bold text-[#1B4FD8]"
      >
        {slide.cta}
      </button>
    </div>
  )
}
