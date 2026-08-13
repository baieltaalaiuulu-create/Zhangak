'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertCircle,
  ArrowLeft,
  BookOpenCheck,
  CheckCircle2,
  Eye,
  EyeOff,
  GraduationCap,
  Headphones,
  LoaderCircle,
  LockKeyhole,
  LogIn,
  MessageCircle,
  ShieldCheck,
  Users,
} from 'lucide-react'

import { redirectForRole } from '@/lib/auth-redirect'
import { MARKETING_ORIGIN, workspaceSurfaceForRole } from '@/lib/site-hosts'
import {
  getCurrentZhangakUser,
  loginZhangak,
  logoutZhangak,
  ZhangakAuthError,
} from '@/lib/zhangak-auth-client'

type WorkspaceSurface = 'platform' | 'admin'

interface LoginExperienceProps {
  surface: WorkspaceSurface
}

const marketingHref = process.env.NODE_ENV === 'production' ? MARKETING_ORIGIN : '/landing'

const platformBenefits = [
  { icon: BookOpenCheck, text: 'Уроки, практика и пробные ОРТ в одном месте' },
  { icon: CheckCircle2, text: 'Понятный план на сегодня и видимый прогресс' },
  { icon: Users, text: 'Отдельные кабинеты для учеников и преподавателей' },
]

const adminBenefits = [
  { icon: ShieldCheck, text: 'Разделы доступны только по назначенной роли' },
  { icon: LockKeyhole, text: 'Защищённая рабочая зона без публичной индексации' },
  { icon: CheckCircle2, text: 'Единая точка управления учебной платформой' },
]

function messageForLoginError(cause: unknown): string {
  if (!(cause instanceof ZhangakAuthError)) {
    return 'Не удалось связаться с сервером. Проверьте интернет и попробуйте ещё раз.'
  }
  if (cause.status === 429) return cause.message
  if (cause.status >= 500 || cause.code === 'network_error' || cause.code === 'request_timeout') {
    return 'Сервис входа временно недоступен. Попробуйте ещё раз через минуту.'
  }
  return 'Неверный email или пароль. Проверьте данные и повторите попытку.'
}

export default function LoginExperience({ surface }: LoginExperienceProps) {
  const router = useRouter()
  const interactionStarted = useRef(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [checkingSession, setCheckingSession] = useState(true)
  const isAdmin = surface === 'admin'
  const benefits = isAdmin ? adminBenefits : platformBenefits

  const rejectWrongWorkspace = useCallback(async (role: string | undefined): Promise<boolean> => {
    const expectedSurface = workspaceSurfaceForRole(role)
    if (!expectedSurface || expectedSurface === surface) return false

    await logoutZhangak().catch(() => {})
    setError(expectedSurface === 'admin'
      ? 'Это служебная учётная запись. Войдите на admin.zhangak.com.'
      : 'Это аккаунт ученика или преподавателя. Войдите на platform.zhangak.com.')
    return true
  }, [surface])

  useEffect(() => {
    let active = true

    const checkSession = async () => {
      try {
        const user = await getCurrentZhangakUser()
        if (!active || !user || interactionStarted.current) return
        if (await rejectWrongWorkspace(user.role)) return
        redirectForRole(user.role, user.studentType ?? undefined, router)
      } catch {
        // The form stays usable when the session check or backend is down.
        // A concrete error is shown only after an explicit login attempt.
      } finally {
        if (active) setCheckingSession(false)
      }
    }

    void checkSession()
    return () => { active = false }
  }, [rejectWrongWorkspace, router])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    interactionStarted.current = true
    setLoading(true)
    setError('')

    try {
      const user = await loginZhangak(email, password)
      if (await rejectWrongWorkspace(user.role)) {
        setLoading(false)
        return
      }
      redirectForRole(user.role, user.studentType ?? undefined, router, surface === 'admin' ? '/admin' : '/student')
    } catch (cause) {
      setError(messageForLoginError(cause))
      setLoading(false)
    }
  }

  return (
    <main className={`min-h-dvh px-4 py-4 sm:px-6 sm:py-8 ${isAdmin ? 'bg-[#07142E]' : 'bg-[#EEF4FF]'}`}>
      <div className="mx-auto grid min-h-[calc(100dvh-2rem)] w-full max-w-6xl overflow-hidden rounded-[28px] bg-white shadow-[0_28px_80px_rgba(13,30,74,0.16)] sm:min-h-[calc(100dvh-4rem)] lg:grid-cols-2">
        <section className={`relative flex flex-col overflow-hidden p-12 text-white max-lg:hidden ${isAdmin ? 'bg-[#0D1E4A]' : 'bg-[#1B4FD8]'}`}>
          <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full border border-white/10" />
          <div className="absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-white/[0.05]" />

          <a href={marketingHref} className="relative z-10 inline-flex w-fit items-center gap-3 rounded-2xl bg-white/10 px-3 py-2 ring-1 ring-white/15 transition-colors hover:bg-white/15">
            {/* eslint-disable-next-line @next/next/no-img-element -- local brand asset */}
            <img src="/images/logo.png" alt="Логотип Жангак" className="h-10 w-10 rounded-xl object-cover" />
            <span>
              <span className="block text-base font-black tracking-wide">ZHANGAK</span>
              <span className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-white/60">образование</span>
            </span>
          </a>

          <div className="relative z-10 my-auto max-w-md py-12">
            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/12 ring-1 ring-white/15">
              {isAdmin ? <ShieldCheck size={28} aria-hidden="true" /> : <GraduationCap size={30} aria-hidden="true" />}
            </div>
            <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-blue-200">
              {isAdmin ? 'Административный контур' : 'Учебная платформа'}
            </p>
            <h2 className="mt-4 text-4xl font-black leading-[1.08] tracking-[-0.04em]">
              {isAdmin ? 'Управляйте платформой уверенно' : 'Сосредоточься на следующем шаге'}
            </h2>
            <p className="mt-5 text-base font-medium leading-7 text-white/70">
              {isAdmin
                ? 'Отдельное рабочее пространство для команды Жангак, контента и операционных процессов.'
                : 'Простой маршрут подготовки для старшеклассников и удобные инструменты преподавателя.'}
            </p>

            <div className="mt-9 space-y-4">
              {benefits.map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-3 text-sm font-semibold text-white/85">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10">
                    <Icon size={18} aria-hidden="true" />
                  </span>
                  <span>{text}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="relative z-10 text-xs font-medium text-white/45">
            {isAdmin ? 'Доступ только для сотрудников с назначенной ролью.' : 'Подготовка к ОРТ — шаг за шагом.'}
          </p>
        </section>

        <section className="flex items-center justify-center px-5 py-7 sm:px-10 lg:px-14">
          <div className="w-full max-w-md">
            <div className="flex items-center justify-between lg:hidden">
              <a href={marketingHref} className="inline-flex items-center gap-2 rounded-xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100">
                {/* eslint-disable-next-line @next/next/no-img-element -- local brand asset */}
                <img src="/images/logo.png" alt="Логотип Жангак" className="h-11 w-11 rounded-xl object-cover shadow-sm" />
                <span className={`text-lg font-black tracking-wide ${isAdmin ? 'text-[#0D1E4A]' : 'text-[#1B4FD8]'}`}>ZHANGAK</span>
              </a>
              <span className={`rounded-full px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.16em] ${isAdmin ? 'bg-slate-100 text-slate-600' : 'bg-blue-50 text-[#1B4FD8]'}`}>
                {isAdmin ? 'Админ' : 'Платформа'}
              </span>
            </div>

            <div className="mt-9 lg:mt-0">
              <p className={`text-xs font-extrabold uppercase tracking-[0.18em] ${isAdmin ? 'text-slate-500' : 'text-[#1B4FD8]'}`}>
                {isAdmin ? 'Для команды Жангак' : 'Для учеников и преподавателей'}
              </p>
              <h1 className="mt-3 text-3xl font-black tracking-[-0.035em] text-[#0D1E4A] sm:text-4xl">
                {isAdmin ? 'Вход в панель управления' : 'Продолжай подготовку'}
              </h1>
              <p className="mt-3 text-sm font-medium leading-6 text-slate-500">
                {isAdmin
                  ? 'Используйте рабочую учётную запись администратора.'
                  : 'Войдите, чтобы открыть свой план, уроки и прогресс.'}
              </p>
            </div>

            {checkingSession && (
              <div role="status" className="mt-6 flex items-center gap-2 rounded-2xl bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-500">
                <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />
                Проверяем сохранённый вход…
              </div>
            )}

            <form onSubmit={handleSubmit} method="post" action="/v1/auth/login" className="mt-7 space-y-5">
              <div>
                <label htmlFor="login-email" className="mb-2 block text-sm font-bold text-[#26324D]">
                  Электронная почта
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
                  onChange={event => setEmail(event.target.value)}
                  placeholder={isAdmin ? 'work@example.com' : 'email@example.com'}
                  required
                  aria-invalid={!!error}
                  className="min-h-14 w-full rounded-2xl border border-slate-200 bg-[#FAFBFF] px-4 text-base text-[#0D1E4A] outline-none transition placeholder:text-slate-400 focus:border-[#1B4FD8] focus:ring-4 focus:ring-blue-100"
                />
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <label htmlFor="login-password" className="text-sm font-bold text-[#26324D]">Пароль</label>
                  <span className="text-xs font-medium text-slate-400">Не менее 8 символов</span>
                </div>
                <div className="relative">
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={event => setPassword(event.target.value)}
                    placeholder="Введите пароль"
                    required
                    aria-invalid={!!error}
                    className="min-h-14 w-full rounded-2xl border border-slate-200 bg-[#FAFBFF] py-3 pl-4 pr-14 text-base text-[#0D1E4A] outline-none transition placeholder:text-slate-400 focus:border-[#1B4FD8] focus:ring-4 focus:ring-blue-100"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(value => !value)}
                    className="absolute inset-y-0 right-1 flex min-h-11 min-w-11 items-center justify-center rounded-xl text-slate-400 transition-colors hover:text-[#1B4FD8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1B4FD8]"
                    aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
                  </button>
                </div>
              </div>

              {error && (
                <div role="alert" className="flex items-start gap-2.5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold leading-5 text-red-700">
                  <AlertCircle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className={`flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl px-5 text-base font-extrabold text-white shadow-lg transition-all active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70 ${isAdmin ? 'bg-[#0D1E4A] shadow-slate-200 hover:bg-[#152A5A]' : 'bg-[#1B4FD8] shadow-blue-200 hover:bg-[#1744BC]'}`}
              >
                {loading ? <LoaderCircle size={20} className="animate-spin" aria-hidden="true" /> : <LogIn size={20} aria-hidden="true" />}
                {loading ? 'Входим…' : 'Войти'}
              </button>
            </form>

            {isAdmin ? (
              <div className="mt-6 flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-slate-500 shadow-sm">
                  <Headphones size={18} aria-hidden="true" />
                </span>
                <p className="text-xs font-medium leading-5 text-slate-500">
                  Нет доступа или забыли пароль? Обратитесь к супер-администратору Жангак.
                </p>
              </div>
            ) : (
              <a
                href="https://wa.me/996502077326"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 flex min-h-14 items-center gap-3 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 transition-colors hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#1B4FD8] shadow-sm">
                  <MessageCircle size={20} aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-extrabold text-[#0D1E4A]">Нужна помощь со входом?</span>
                  <span className="mt-0.5 block text-xs font-medium text-slate-500">Напишите команде Жангак в WhatsApp</span>
                </span>
              </a>
            )}

            <a href={marketingHref} className="mx-auto mt-7 flex w-fit min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-bold text-slate-500 transition-colors hover:text-[#1B4FD8] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100">
              <ArrowLeft size={17} aria-hidden="true" />
              На главный сайт
            </a>
          </div>
        </section>
      </div>
    </main>
  )
}
