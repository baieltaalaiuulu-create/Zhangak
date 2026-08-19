'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Cookie, ShieldCheck, X } from 'lucide-react'

import {
  COOKIE_INFORMATION_DISMISSED_KEY,
  markDismissed,
  wasDismissed,
} from '@/lib/first-visit'
import { siteSurfaceForHost } from '@/lib/site-hosts'

/**
 * An informational notice, not a misleading "accept all" gate. Zhangak
 * currently uses necessary HttpOnly session/security cookies only; it does
 * not enable advertising or analytics cookies from this component.
 */
export default function CookieInformationNotice() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Login and workspace screens must never be covered by a non-essential
    // notice. The public site is where a first-time visitor sees it; private
    // surfaces keep their required session cookies functional without a gate.
    const surface = siteSurfaceForHost(window.location.hostname)
    if (surface === 'platform' || surface === 'admin') return
    const timer = window.setTimeout(() => {
      setVisible(!wasDismissed(window.localStorage, COOKIE_INFORMATION_DISMISSED_KEY))
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  const dismiss = () => {
    markDismissed(window.localStorage, COOKIE_INFORMATION_DISMISSED_KEY)
    setVisible(false)
  }

  if (!visible) return null

  return (
    <aside
      aria-label="Информация о cookie"
      className="fixed inset-x-3 bottom-3 z-[100] mx-auto max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl sm:inset-x-5 sm:bottom-5 sm:p-5"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#1B3F92]">
          <Cookie size={19} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-extrabold text-slate-900">Как Zhangak использует cookie</h2>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            Мы используем необходимые защищённые cookie для входа и защиты аккаунта. Рекламных и аналитических cookie сейчас нет. Отметка «понятно» хранится только в локальном хранилище этого браузера.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={dismiss}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#1B3F92] px-3 text-xs font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3F92] focus-visible:ring-offset-2"
            >
              <ShieldCheck size={15} aria-hidden="true" />
              Понятно
            </button>
            <Link href="/privacy" className="inline-flex min-h-11 max-w-full items-center px-2 text-left text-xs font-bold text-[#1B3F92] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3F92]">
              Политика конфиденциальности
            </Link>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Закрыть информацию о cookie"
          className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-50 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3F92]"
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>
    </aside>
  )
}
