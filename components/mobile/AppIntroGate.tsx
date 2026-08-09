'use client'

import { useEffect, useState } from 'react'
import SplashScreen from './SplashScreen'
import Onboarding from './Onboarding'

const ONBOARDING_KEY = 'zhangak-onboarding-done'
const MOBILE_QUERY = '(max-width: 767px)'

type Stage = 'idle' | 'splash' | 'onboarding' | 'done'

// Mounted once in the root layout — a fixed full-screen overlay that
// covers every route (authenticated or not) regardless of what's
// underneath, since it renders independently of routing. Shows once per
// browser: Splash (2s) then Onboarding, gated only on mobile viewport +
// the single zhangak-onboarding-done flag.
//
// Deliberately NOT gated on display-mode: standalone anymore (an earlier
// version required launching the actual installed PWA) — that check
// didn't reliably report "standalone" on every real Android/WebAPK setup,
// which is exactly why the splash silently stopped showing at all. A
// plain first-time mobile-browser visit is a broader trigger, but one
// that actually fires.
export default function AppIntroGate() {
  const [stage, setStage] = useState<Stage>('idle')

  useEffect(() => {
    // Deferred rather than called synchronously in the effect body — same
    // pattern used across this codebase's other first-visit gates
    // (FirstLoginInstallOverlay, PWAInstallBanner).
    const timer = window.setTimeout(() => {
      const isMobile = window.matchMedia(MOBILE_QUERY).matches
      if (!isMobile || localStorage.getItem(ONBOARDING_KEY)) { setStage('done'); return }
      setStage('splash')
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  const finishSplash = () => setStage('onboarding')

  const finishOnboarding = () => {
    localStorage.setItem(ONBOARDING_KEY, 'true')
    setStage('done')
  }

  if (stage === 'splash') return <SplashScreen onDone={finishSplash} />
  if (stage === 'onboarding') return <Onboarding onDone={finishOnboarding} />
  return null
}
