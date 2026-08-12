'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, Eye, EyeOff, LoaderCircle, LogIn, MessageCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { redirectForRole } from '@/lib/auth-redirect'
import { siteSurfaceForHost, workspaceSurfaceForRole } from '@/lib/site-hosts'

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
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [checkingSession, setCheckingSession] = useState(true)

  const rejectWrongWorkspace = async (role: string | undefined): Promise<boolean> => {
    const currentSurface = siteSurfaceForHost(window.location.hostname)
    const expectedSurface = workspaceSurfaceForRole(role)
    if (!expectedSurface || (currentSurface !== 'admin' && currentSurface !== 'platform') || currentSurface === expectedSurface) {
      return false
    }

    await supabase.auth.signOut({ scope: 'local' })
    setError(expectedSurface === 'admin'
      ? 'Бул кызматкер аккаунту. admin.zhangak.com дарегинен кириңиз.'
      : 'Бул окуучу аккаунту. platform.zhangak.com дарегинен кириңиз.')
    return true
  }

  // Already logged in (e.g. a saved-credential auto-navigation, or a stale
  // bookmark) — skip the form entirely and go straight to the dashboard.
  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setCheckingSession(false); return }
      const { data: profile } = await supabase.from('profiles').select('role, student_type').eq('id', user.id).single()
      if (await rejectWrongWorkspace(profile?.role)) { setCheckingSession(false); return }
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
    if (await rejectWrongWorkspace(profile?.role)) {
      setLoading(false)
      return
    }
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
    <main className="flex min-h-dvh flex-col items-center justify-center bg-[#F4F6FA] px-5 py-8 sm:px-6 sm:py-12">
      <div className="w-full max-w-sm">
        <div className="mb-7 flex flex-col items-center text-center">
          <div className="h-14 w-14 overflow-hidden rounded-2xl shadow-sm ring-1 ring-black/5">
            {/* eslint-disable-next-line @next/next/no-img-element -- static asset, no next/image domain config needed */}
            <img src="/images/logo.png" alt="Жангак" className="h-full w-full object-cover" />
          </div>
          <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-[#0D1E4A]">Кайра кош келдиң</h1>
          <p className="mt-1.5 text-sm font-medium text-gray-500">Даярдыкты улантуу үчүн аккаунтуңа кир</p>
        </div>

        <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm sm:p-7">
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
              <label htmlFor="login-email" className="mb-2 block text-sm font-bold text-[#26324D]">
                Электрондук почта
              </label>
              <input
                id="login-email"
                type="email"
                name="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                inputMode="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="email@gmail.com"
                required
                aria-invalid={!!error}
                className="min-h-13 w-full rounded-2xl border border-gray-200 bg-[#FAFBFF] px-4 py-3 text-base text-[#0D1E4A] outline-none transition-shadow placeholder:text-gray-400 focus:border-[#1B4FD8] focus:ring-4 focus:ring-blue-100"
              />
            </div>

            <div>
              <label htmlFor="login-password" className="mb-2 block text-sm font-bold text-[#26324D]">
                Сырсөз
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Сырсөзүңдү жаз"
                  required
                  aria-invalid={!!error}
                  className="min-h-13 w-full rounded-2xl border border-gray-200 bg-[#FAFBFF] py-3 pl-4 pr-14 text-base text-[#0D1E4A] outline-none transition-shadow placeholder:text-gray-400 focus:border-[#1B4FD8] focus:ring-4 focus:ring-blue-100"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(value => !value)}
                  className="absolute inset-y-0 right-1 flex min-h-11 min-w-11 items-center justify-center rounded-xl text-gray-400 transition-colors hover:text-[#1B4FD8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1B4FD8]"
                  aria-label={showPassword ? 'Сырсөздү жашыруу' : 'Сырсөздү көрсөтүү'}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOff size={21} aria-hidden="true" /> : <Eye size={21} aria-hidden="true" />}
                </button>
              </div>
            </div>

            {error && (
              <div role="alert" className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm font-semibold text-red-600">
                <AlertCircle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-1 flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-[#1B4FD8] px-5 text-base font-extrabold text-white shadow-md shadow-blue-200 transition-all hover:bg-[#1744BC] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? (
                <>
                  <LoaderCircle size={20} className="animate-spin" aria-hidden="true" />
                  Кирип жатат...
                </>
              ) : (
                <>
                  <LogIn size={20} aria-hidden="true" />
                  Кирүү
                </>
              )}
            </button>
          </form>
        </div>

        <a
          href="https://wa.me/996502077326"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 flex min-h-14 items-center gap-3 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-left transition-colors hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#1B4FD8] shadow-sm">
            <MessageCircle size={21} aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-extrabold text-[#0D1E4A]">Аккаунт керекпи?</span>
            <span className="mt-0.5 block text-xs font-medium leading-4 text-gray-500">WhatsApp аркылуу бизге жаз</span>
          </span>
        </a>
      </div>
    </main>
  )
}
