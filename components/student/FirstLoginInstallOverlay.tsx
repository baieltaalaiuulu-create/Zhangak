'use client'

import { useEffect, useState } from 'react'
import { Smartphone } from 'lucide-react'
import { useInstallPrompt } from '@/components/PWAInstallProvider'
import { INSTALL_DISMISSED_KEY, FIRST_LOGIN_SHOWN_KEY } from '@/lib/pwa-install'
import IOSInstallSteps from '@/components/IOSInstallSteps'

interface Props {
  /** Only render once the caller has confirmed an authenticated student — see StudentLayout. */
  ready: boolean
}

// Full-screen, one-time "install now" takeover shown the first time a
// student reaches the cabinet on a browser that hasn't seen it before
// (no zhangak-first-login-shown key yet — not strictly tied to account
// age, so existing students get it once too the first time they land here
// after this shipped). Marks both localStorage keys as soon as it decides
// to show, so PWAInstallBanner's own triggers don't also fire alongside it
// — see the comment in PWAInstallBanner.tsx for how that's coordinated.
export default function FirstLoginInstallOverlay({ ready }: Props) {
  const { isInstalled, isIOS, isMobile, promptInstall } = useInstallPrompt()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!ready || isInstalled || !isMobile) return
    if (localStorage.getItem(FIRST_LOGIN_SHOWN_KEY)) return

    // Deferred rather than called synchronously in the effect body — same
    // pattern as PWAInstallBanner's trigger effect.
    const timer = window.setTimeout(() => {
      localStorage.setItem(FIRST_LOGIN_SHOWN_KEY, '1')
      localStorage.setItem(INSTALL_DISMISSED_KEY, '1')
      setVisible(true)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [ready, isInstalled, isMobile])

  const dismiss = () => setVisible(false)

  const handleInstall = async () => {
    await promptInstall()
    dismiss()
  }

  if (!visible) return null

  return (
    <div className="fixed inset-0 z-[90] flex flex-col items-center justify-center bg-white px-8 text-center">
      <div className="h-20 w-20 overflow-hidden rounded-3xl shadow-lg">
        {/* eslint-disable-next-line @next/next/no-img-element -- static PWA icon, no next/image domain config needed */}
        <img src="/icons/icon-192.png" alt="Жангак" className="h-full w-full object-cover" />
      </div>

      <h1 className="mt-6 inline-flex items-center gap-2 text-2xl font-extrabold text-[#191B23]"><Smartphone size={24} aria-hidden="true" />Установи Жангак!</h1>
      <p className="mt-2 text-base text-gray-500">Заходи быстрее без браузера</p>

      {isIOS ? (
        <>
          <IOSInstallSteps className="mt-8 w-full max-w-xs text-left" />
          <button
            type="button"
            onClick={dismiss}
            className="mt-8 text-sm font-semibold text-gray-400"
          >
            Пропустить
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={handleInstall}
            className="mt-10 flex h-14 w-full max-w-xs items-center justify-center gap-2 rounded-2xl bg-[#1B3F92] text-base font-bold text-white transition-colors active:bg-blue-700"
          >
            Установить
          </button>
          <button
            type="button"
            onClick={dismiss}
            className="mt-4 text-sm font-semibold text-gray-400"
          >
            Пропустить
          </button>
        </>
      )}
    </div>
  )
}
