'use client'

import { useEffect, useState } from 'react'
import { useInstallPrompt } from './PWAInstallProvider'
import { INSTALL_DISMISSED_KEY } from '@/lib/pwa-install'

const SHOW_DELAY_MS = 15000

interface Props {
  /** Only start the 15s timer once the caller has confirmed an authenticated student — see StudentLayout. */
  ready: boolean
}

// Fixed floating card (not a modal/backdrop) — mounted inside StudentLayout
// so it only ever renders for a logged-in student on /student/online/*
// routes, sitting just above BottomNav. Shows once, 15s after the student
// lands here on a mobile browser, and never again once dismissed or
// already installed (see PWAInstallProvider for how isInstalled/isMobile
// are computed).
export default function PWAInstallBanner({ ready }: Props) {
  const { isInstalled, isIOS, isMobile, promptInstall } = useInstallPrompt()
  const [visible, setVisible] = useState(false)
  const [risen, setRisen] = useState(false)

  useEffect(() => {
    if (!ready || isInstalled || !isMobile) return
    if (localStorage.getItem(INSTALL_DISMISSED_KEY)) return

    const timer = window.setTimeout(() => setVisible(true), SHOW_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [ready, isInstalled, isMobile])

  // Mount slightly lower + transparent first, then rise into place a frame
  // later so the transition actually animates instead of popping in place.
  useEffect(() => {
    if (!visible) return
    const raf = requestAnimationFrame(() => setRisen(true))
    return () => cancelAnimationFrame(raf)
  }, [visible])

  const dismiss = () => {
    localStorage.setItem(INSTALL_DISMISSED_KEY, '1')
    setRisen(false)
    window.setTimeout(() => setVisible(false), 250)
  }

  const handleInstall = async () => {
    await promptInstall()
    dismiss()
  }

  if (!visible) return null

  return (
    <div
      className="fixed inset-x-0 z-40 flex justify-center px-4 transition-all duration-300 ease-out md:hidden"
      style={{
        // BottomNav is 64px tall plus its own safe-area padding — sit one
        // 16px gap above that, so ~80px above the viewport edge on a
        // non-notched phone and correctly further up on a notched one.
        bottom: 'calc(64px + env(safe-area-inset-bottom) + 16px)',
        transform: risen ? 'translateY(0)' : 'translateY(12px)',
        opacity: risen ? 1 : 0,
      }}
    >
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element -- static PWA icon, no next/image domain config needed */}
            <img src="/icons/icon-192.png" alt="ZHANGAK" className="h-full w-full object-cover" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-[#191B23]">ZHANGAK&apos;ты орнот</h2>
            <p className="mt-0.5 text-xs leading-snug text-gray-500">Сабактарга тез кирип, браузерсиз колдон.</p>
          </div>
        </div>

        {isIOS ? (
          <>
            <p className="mt-4 text-xs font-semibold text-gray-500">
              Safari → Поделиться → На экран домой
            </p>
            <button type="button" onClick={dismiss} className="mt-3 text-sm font-semibold text-gray-400">
              Кийин
            </button>
          </>
        ) : (
          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={handleInstall}
              className="flex h-11 flex-1 items-center justify-center rounded-xl bg-[#1B3F92] text-sm font-bold text-white transition-colors active:bg-blue-700"
            >
              Орнотуу
            </button>
            <button type="button" onClick={dismiss} className="shrink-0 text-sm font-semibold text-gray-400">
              Кийин
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
