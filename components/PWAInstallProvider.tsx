'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { type BeforeInstallPromptEvent, INSTALLED_KEY, isIOS, isMobileUA, isStandalone, supportsInstallPrompt } from '@/lib/pwa-install'

interface PWAInstallContextValue {
  /** True once the browser has fired beforeinstallprompt and it hasn't been consumed yet. */
  canPrompt: boolean
  /** True once installed — from display-mode, the appinstalled event, or a persisted flag from a past install (see INSTALLED_KEY), whichever fires first. */
  isInstalled: boolean
  isIOS: boolean
  isMobile: boolean
  /** Neither the native prompt nor iOS's manual steps apply (e.g. desktop Firefox/Safari). */
  isUnsupported: boolean
  /** Resolves 'accepted' | 'dismissed' from the native prompt, or null if there's nothing to prompt. */
  promptInstall: () => Promise<'accepted' | 'dismissed' | null>
}

const PWAInstallContext = createContext<PWAInstallContextValue | null>(null)

// Mounted once in the root layout — a single shared place to capture the
// (one-shot, browser-fired-once-per-load) beforeinstallprompt event, so
// every surface that wants to trigger install (bottom banner, settings
// page, first-login overlay) reads from the same live reference instead
// of each racing to attach its own listener and possibly missing it.
export default function PWAInstallProvider({ children }: { children: ReactNode }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  // All of these read navigator/window, which SSR never has — seeding them
  // with a lazy initializer (or calling the helpers straight in render)
  // would make the client's *first* hydration render disagree with the
  // server-rendered HTML on real iOS/Android/standalone visitors (a real
  // hydration-mismatch, not just the set-state-in-effect lint rule). So
  // every one of these starts at the SSR-safe default and is corrected via
  // a deferred effect below, same as the rest of this codebase's
  // effect-setState workaround.
  const [installed, setInstalled] = useState(false)
  const [ios, setIos] = useState(false)
  const [mobile, setMobile] = useState(false)
  const [unsupported, setUnsupported] = useState(false)

  useEffect(() => {
    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    const onInstalled = () => {
      setInstalled(true)
      localStorage.setItem(INSTALLED_KEY, 'true')
      setDeferredPrompt(null)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.addEventListener('appinstalled', onInstalled)

    // Deferred rather than called synchronously in the effect body — same
    // pattern used by PWAInstallBanner/FirstLoginInstallOverlay. Runs once
    // after mount to fill in the real client-side values.
    const timer = window.setTimeout(() => {
      const standalone = isStandalone()
      const iosNow = isIOS()
      // Persisted flag OR'd in alongside the live display-mode check — a
      // visitor who already installed but is looking at a normal browser
      // tab right now (isStandalone() false there) should still see
      // "already installed" rather than the install pitch again.
      setInstalled(standalone || localStorage.getItem(INSTALLED_KEY) === 'true')
      setIos(iosNow)
      setMobile(isMobileUA())
      setUnsupported(!standalone && !iosNow && !supportsInstallPrompt())
    }, 0)

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      window.removeEventListener('appinstalled', onInstalled)
      window.clearTimeout(timer)
    }
  }, [])

  const promptInstall = useCallback(async (): Promise<'accepted' | 'dismissed' | null> => {
    if (!deferredPrompt) return null
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    setDeferredPrompt(null)
    if (outcome === 'accepted') {
      setInstalled(true)
      localStorage.setItem(INSTALLED_KEY, 'true')
    }
    return outcome
  }, [deferredPrompt])

  const value = useMemo<PWAInstallContextValue>(
    () => ({
      canPrompt: !!deferredPrompt,
      isInstalled: installed,
      isIOS: ios,
      isMobile: mobile,
      // A capability check (which browser engine this is), not "the event
      // hasn't fired yet" — beforeinstallprompt can take a moment to fire
      // even on browsers that do support it.
      isUnsupported: unsupported,
      promptInstall,
    }),
    [deferredPrompt, installed, ios, mobile, unsupported, promptInstall]
  )

  return <PWAInstallContext.Provider value={value}>{children}</PWAInstallContext.Provider>
}

export function useInstallPrompt(): PWAInstallContextValue {
  const ctx = useContext(PWAInstallContext)
  if (!ctx) throw new Error('useInstallPrompt must be used within PWAInstallProvider')
  return ctx
}
