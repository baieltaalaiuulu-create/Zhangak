'use client'

import { useEffect, useState } from 'react'

const DISMISS_KEY = 'zhangak-pwa-install-dismissed'
const SHOW_DELAY_MS = 30000

// Not in lib.dom yet — Chromium-only event fired when the browser decides
// the site is installable.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

function isMobile(): boolean {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
}

function isAlreadyInstalled(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean }
  return window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true
}

// Small "install this as an app" nudge, mounted once in the root layout so
// it can reach any visitor (landing page, student cabinet, admin panel).
// Shows once, 30s after load, only on mobile browsers that haven't already
// installed the PWA and haven't dismissed the banner before.
export default function PWAInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
  }, [])

  useEffect(() => {
    if (localStorage.getItem(DISMISS_KEY)) return
    if (!isMobile() || isAlreadyInstalled()) return

    const timer = window.setTimeout(() => setVisible(true), SHOW_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [])

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1')
    setVisible(false)
  }

  const handleInstall = async () => {
    if (!deferredPrompt) { dismiss(); return }
    await deferredPrompt.prompt()
    await deferredPrompt.userChoice
    setDeferredPrompt(null)
    dismiss()
  }

  if (!visible) return null

  return (
    <div
      className="fixed inset-x-3 z-[70] flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-lg sm:hidden"
      style={{ bottom: 'calc(76px + env(safe-area-inset-bottom))' }}
    >
      {/* bottom offset clears the student BottomNav (60px + safe area) on
          pages that have one; on pages without it this just floats a bit
          higher above the edge, which is still fine. */}
      <span className="shrink-0 text-2xl">📱</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-[#191B23]">Установи Жангак как приложение!</p>
        <p className="mt-0.5 text-xs text-gray-400">Быстрый доступ прямо с экрана телефона</p>
      </div>
      <button
        type="button"
        onClick={handleInstall}
        className="shrink-0 rounded-xl bg-[#1B4FD8] px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-blue-700"
      >
        Установить
      </button>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Закрыть"
        className="shrink-0 rounded-full p-1 text-gray-400 hover:bg-gray-50"
      >
        ✕
      </button>
    </div>
  )
}
