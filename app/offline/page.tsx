'use client'

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-[#0D0D1A] px-6 text-center">
      <div className="h-16 w-16 overflow-hidden rounded-2xl shadow-[0_8px_28px_rgba(27,79,216,0.35)]">
        {/* eslint-disable-next-line @next/next/no-img-element -- static asset, offline fallback must not depend on next/image's optimizer */}
        <img src="/images/logo.png" alt="Жангак" className="h-full w-full object-cover" />
      </div>

      <div className="text-4xl">📡</div>

      <h1 className="text-2xl font-extrabold tracking-tight text-white">Интернет жок</h1>
      <p className="max-w-xs text-sm leading-relaxed text-gray-400">
        Интернетке кошулганда окууну уланта аласың.
      </p>

      <button
        type="button"
        onClick={() => window.location.reload()}
        className="mt-2 rounded-xl bg-[#1B4FD8] px-7 py-3 text-sm font-bold text-white shadow-[0_8px_28px_rgba(27,79,216,0.35)] transition-colors hover:bg-blue-700"
      >
        Кайра текшерүү
      </button>
    </div>
  )
}
