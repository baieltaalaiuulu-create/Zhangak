'use client'

import { WifiOff } from 'lucide-react'

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-[#0D0D1A] px-6 text-center">
      <div className="h-16 w-16 overflow-hidden rounded-2xl shadow-[0_8px_28px_rgba(27,63,146,0.35)]">
        {/* eslint-disable-next-line @next/next/no-img-element -- static asset, offline fallback must not depend on next/image's optimizer */}
        <img src="/images/logo.png" alt="Жангак" className="h-full w-full object-cover" />
      </div>

      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-blue-300">
        <WifiOff size={28} aria-hidden="true" />
      </span>

      <h1 className="text-2xl font-extrabold tracking-tight text-white">Интернет жок</h1>
      <p className="max-w-xs text-sm leading-relaxed text-gray-400">
        Интернетке кошулганда окууну уланта аласың.
      </p>

      <button
        type="button"
        onClick={() => window.location.reload()}
        className="mt-2 min-h-12 rounded-xl bg-[#1B3F92] px-7 py-3 text-sm font-bold text-white shadow-[0_8px_28px_rgba(27,63,146,0.35)] transition-colors hover:bg-blue-700"
      >
        Кайра текшерүү
      </button>
    </div>
  )
}
