'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useInstallPrompt } from './PWAInstallProvider'
import { INSTALL_DISMISSED_KEY, FIRST_LOGIN_SHOWN_KEY } from '@/lib/pwa-install'
import IOSInstallSteps from './IOSInstallSteps'

const SHOW_DELAY_MS = 20000
const PAGE_COUNT_TRIGGER = 2
const STUDENT_ROUTE = '/student/online'

// Mobile-only bottom sheet — mounted once in the root layout so it can
// reach any visitor. Shows once per the first trigger to fire (2+ distinct
// pages visited, 20s on site, or reaching the student cabinet), and never
// again once dismissed, installed, or already on an unsupported/desktop
// browser (see PWAInstallProvider for how each signal is computed).
export default function PWAInstallBanner() {
  const pathname = usePathname()
  const { isInstalled, isIOS, isMobile, promptInstall, pageViewCount } = useInstallPrompt()
  const [visible, setVisible] = useState(false)
  const [slidUp, setSlidUp] = useState(false)
  const shownRef = useRef(false)

  useEffect(() => {
    if (localStorage.getItem(INSTALL_DISMISSED_KEY)) return
    if (isInstalled || !isMobile || shownRef.current) return

    // The /student/online trigger only applies to returning visitors who've
    // already seen the full-screen first-login overlay (FirstLoginInstallOverlay)
    // — for a brand-new visitor reaching the cabinet for the first time, that
    // overlay owns the moment instead of this banner popping up alongside it.
    const seenFirstLoginOverlay = !!localStorage.getItem(FIRST_LOGIN_SHOWN_KEY)
    const shouldShowNow = pageViewCount >= PAGE_COUNT_TRIGGER || (pathname === STUDENT_ROUTE && seenFirstLoginOverlay)

    const timer = window.setTimeout(() => {
      if (shownRef.current) return
      shownRef.current = true
      setVisible(true)
    }, shouldShowNow ? 0 : SHOW_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [isInstalled, isMobile, pageViewCount, pathname])

  // Mount at translate-y-full first, then flip a frame later so the
  // transition actually animates the slide-up instead of popping in place.
  useEffect(() => {
    if (!visible) return
    const raf = requestAnimationFrame(() => setSlidUp(true))
    return () => cancelAnimationFrame(raf)
  }, [visible])

  const dismiss = () => {
    localStorage.setItem(INSTALL_DISMISSED_KEY, '1')
    setSlidUp(false)
    window.setTimeout(() => setVisible(false), 250)
  }

  const handleInstall = async () => {
    await promptInstall()
    dismiss()
  }

  if (!visible) return null

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 sm:hidden"
      onClick={dismiss}
    >
      <div
        className={`w-full max-w-md rounded-t-2xl bg-white p-6 shadow-2xl transition-transform duration-300 ease-out ${slidUp ? 'translate-y-0' : 'translate-y-full'}`}
        style={{ paddingBottom: 'calc(24px + env(safe-area-inset-bottom))' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex flex-col items-center text-center">
          <div className="h-16 w-16 overflow-hidden rounded-2xl shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element -- static PWA icon, no next/image domain config needed */}
            <img src="/icons/icon-192.png" alt="Жангак" className="h-full w-full object-cover" />
          </div>
          <h2 className="mt-3 text-lg font-bold text-[#191B23]">Жангак ОРТ</h2>
          <p className="mt-0.5 text-sm text-gray-500">Подготовка к ОРТ</p>

          {isIOS ? (
            <>
              <IOSInstallSteps className="mt-5 w-full text-left" />
              <button type="button" onClick={dismiss} className="mt-5 text-sm font-semibold text-gray-400">
                Понятно
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={handleInstall}
                className="mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#1B4FD8] text-base font-bold text-white transition-colors active:bg-blue-700"
              >
                📲 Установить приложение
              </button>
              <button type="button" onClick={dismiss} className="mt-3 text-sm font-semibold text-gray-400">
                Не сейчас
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
