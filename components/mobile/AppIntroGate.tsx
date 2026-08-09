'use client'

import { useEffect, useState } from 'react'
import { isStandalone } from '@/lib/pwa-install'
import SplashScreen from './SplashScreen'
import Onboarding from './Onboarding'

const SPLASH_KEY = 'zhangak-splash-shown'
const ONBOARDING_KEY = 'zhangak-onboarding-done'
const MOBILE_QUERY = '(max-width: 767px)'

type Stage = 'idle' | 'splash' | 'onboarding' | 'done'

// Mounted once in the root layout — decides, on first client paint, whether
// this is a first-ever *installed-PWA* launch (mobile + display-mode:
// standalone + no localStorage keys yet) and if so runs Splash → Onboarding
// before letting the real app render underneath. Deliberately gated on
// standalone mode, not just mobile viewport — a random first-time visitor
// browsing the marketing site in mobile Safari/Chrome shouldn't get an
// app-style cold-start splash; that's reserved for actually opening the
// installed app. Desktop, a non-standalone mobile tab, and every later
// visit all resolve straight to 'done' (renders nothing).
export default function AppIntroGate() {
  const [stage, setStage] = useState<Stage>('idle')

  useEffect(() => {
    // Deferred rather than called synchronously in the effect body — same
    // pattern used across this codebase's other first-visit gates
    // (FirstLoginInstallOverlay, PWAInstallBanner).
    const timer = window.setTimeout(() => {
      if (!window.matchMedia(MOBILE_QUERY).matches || !isStandalone()) { setStage('done'); return }
      if (!localStorage.getItem(SPLASH_KEY)) { setStage('splash'); return }
      if (!localStorage.getItem(ONBOARDING_KEY)) { setStage('onboarding'); return }
      setStage('done')
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  const finishSplash = () => {
    localStorage.setItem(SPLASH_KEY, '1')
    setStage(localStorage.getItem(ONBOARDING_KEY) ? 'done' : 'onboarding')
  }

  const finishOnboarding = () => {
    localStorage.setItem(ONBOARDING_KEY, '1')
    setStage('done')
  }

  if (stage === 'splash') return <SplashScreen onDone={finishSplash} />
  if (stage === 'onboarding') return <Onboarding onDone={finishOnboarding} />
  return null
}
