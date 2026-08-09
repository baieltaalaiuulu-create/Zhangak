'use client'

import { useEffect } from 'react'

const SPLASH_MS = 2000
const DOT_DELAYS_S = [0, 0.15, 0.3]

interface Props {
  onDone: () => void
}

// Full-screen cold-start splash — shown once (gated by AppIntroGate), for
// exactly 2s, then hands off to onDone (which decides between Onboarding
// and dismissing outright).
export default function SplashScreen({ onDone }: Props) {
  useEffect(() => {
    const timer = window.setTimeout(onDone, SPLASH_MS)
    return () => window.clearTimeout(timer)
  }, [onDone])

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#0D0D1A] md:hidden">
      <div className="h-20 w-20 overflow-hidden rounded-3xl shadow-[0_8px_28px_rgba(27,79,216,0.35)]">
        {/* eslint-disable-next-line @next/next/no-img-element -- static asset, splash must not depend on next/image's optimizer */}
        <img src="/images/logo.png" alt="Жангак" className="h-full w-full object-cover" />
      </div>
      <h1 className="mt-4 text-3xl font-bold text-white">Жангак</h1>
      <p className="mt-1 text-xs font-semibold tracking-widest text-gray-400">ОРТ ДАЙЫНДЫГЫ</p>
      <div className="mt-8 flex gap-1.5">
        {DOT_DELAYS_S.map(delay => (
          <span
            key={delay}
            className="h-2 w-2 rounded-full bg-white animate-zhangak-splash-dot"
            style={{ animationDelay: `${delay}s` }}
          />
        ))}
      </div>
    </div>
  )
}
