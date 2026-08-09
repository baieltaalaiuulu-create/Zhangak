'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { redirectForRole } from '@/lib/auth-redirect'

// A real, dedicated /login route — until now this URL was only ever a
// target: ~16 pages across the app call router.push('/login') when an
// auth check fails, but no route actually existed there, so every one of
// those redirects 404'd. app/page.tsx's landing page still has its own
// inline login modal (unchanged) for visitors browsing from there; this
// page exists for everything that assumes /login is a real destination —
// including Onboarding's "Начать"/skip buttons.
export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [checkingSession, setCheckingSession] = useState(true)

  // Already logged in (e.g. a saved-credential auto-navigation, or a stale
  // bookmark) — skip the form entirely and go straight to the dashboard.
  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setCheckingSession(false); return }
      const { data: profile } = await supabase.from('profiles').select('role, student_type').eq('id', user.id).single()
      redirectForRole(profile?.role, profile?.student_type, router)
      setCheckingSession(false)
    }
    check()
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (signInError) {
      setError('Туура эмес email же сырсөз')
      setLoading(false)
      return
    }
    const { data: profile } = await supabase.from('profiles').select('role, student_type').eq('id', data.user.id).single()
    redirectForRole(profile?.role, profile?.student_type, router, '/student')
    // Deliberately no setLoading(false) here — the page navigates away on
    // success, so leaving the button in its loading/disabled state avoids
    // a flash back to "Войти" during the async redirect.
  }

  if (checkingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F4F6FA]">
        <div className="text-sm text-gray-400">Загрузка...</div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#F4F6FA] px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="h-12 w-12 overflow-hidden rounded-xl shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element -- static asset, no next/image domain config needed */}
            <img src="/images/logo.png" alt="Жангак" className="h-full w-full object-cover" />
          </div>
          <h1 className="mt-4 text-xl font-extrabold text-[#0D1E4A]">Кирүү</h1>
          <p className="mt-1 text-sm text-gray-400">Жангак системасына кирүү</p>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm sm:p-7">
          {/*
            CRITICAL for the browser's "Сохранить пароль?" prompt: a real
            <form>, type="email"/type="password" inputs with name +
            autoComplete attributes, and a type="submit" button. The
            SPA-style preventDefault() below only stops the native
            full-page POST — it doesn't block the async router.push()
            navigation on success, which is what the browser's credential
            manager actually watches for.
          */}
          <form onSubmit={handleSubmit} method="post" action="#" className="flex flex-col gap-4">
            <div>
              <label htmlFor="login-email" className="mb-1.5 block text-xs font-semibold text-gray-500">
                Email
              </label>
              <input
                id="login-email"
                type="email"
                name="email"
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="email@gmail.com"
                required
                className="w-full rounded-xl border border-gray-200 bg-[#FAFBFF] px-3.5 py-3 text-[15px] text-[#0D1E4A] outline-none transition-colors focus:border-[#1B4FD8]"
              />
            </div>

            <div>
              <label htmlFor="login-password" className="mb-1.5 block text-xs font-semibold text-gray-500">
                Сырсөз
              </label>
              <input
                id="login-password"
                type="password"
                name="password"
                autoComplete="current-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full rounded-xl border border-gray-200 bg-[#FAFBFF] px-3.5 py-3 text-[15px] text-[#0D1E4A] outline-none transition-colors focus:border-[#1B4FD8]"
              />
            </div>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-center text-sm text-red-500">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-1 rounded-xl bg-[#1B4FD8] py-3.5 text-[15px] font-bold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? 'Кирүүдө...' : 'Кирүү →'}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-gray-400">
          Аккаунт жокпу?{' '}
          <a href="https://wa.me/996502077326" target="_blank" rel="noopener noreferrer" className="font-bold text-[#1B4FD8]">
            📲 Жазылуу
          </a>
        </p>
      </div>
    </div>
  )
}
