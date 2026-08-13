'use client'

import Link from 'next/link'
import { AlertCircle, ArrowRight, BookOpen, LoaderCircle, LogIn, LogOut, RefreshCw, ShieldCheck, Users, Wrench } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import { getCurrentZhangakUser, logoutZhangak, type ZhangakSessionUser } from '@/lib/zhangak-auth-client'
import AdminTopbar from './AdminTopbar'

const FULL_ADMIN_ROLES = new Set(['admin', 'super_admin'])

type AccessState =
  | { kind: 'checking' }
  | { kind: 'ready'; user: ZhangakSessionUser }
  | { kind: 'wrong_role'; user: ZhangakSessionUser }
  | { kind: 'error'; message: string }

interface AdminMigrationNoticeProps {
  title: string
  description: string
  plannedCapabilities: readonly string[]
}

function LoadingState() {
  return (
    <div className="flex min-h-[calc(100dvh-60px)] items-center justify-center bg-[#FAF8FF] px-5">
      <div role="status" className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-semibold text-slate-600 shadow-sm">
        <LoaderCircle size={19} className="animate-spin text-[#1B4FD8]" aria-hidden="true" />
        Проверяем права доступа…
      </div>
    </div>
  )
}

/**
 * A deliberately read-only holding screen for former admin tools. It repeats
 * the first-party role check instead of trusting the layout alone: layouts
 * persist during client-side navigation, while this component is also safe
 * when a legacy deep link is opened directly.
 */
export default function AdminMigrationNotice({ title, description, plannedCapabilities }: AdminMigrationNoticeProps) {
  const [state, setState] = useState<AccessState>({ kind: 'checking' })

  const load = useCallback(async () => {
    setState({ kind: 'checking' })
    try {
      const user = await getCurrentZhangakUser()
      if (!user) {
        window.location.replace('/login')
        return
      }
      setState(FULL_ADMIN_ROLES.has(user.role)
        ? { kind: 'ready', user }
        : { kind: 'wrong_role', user })
    } catch (cause) {
      setState({
        kind: 'error',
        message: cause instanceof Error ? cause.message : 'Не удалось проверить доступ к панели.',
      })
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const signOut = async () => {
    await logoutZhangak().catch(() => {})
    window.location.assign('/login')
  }

  if (state.kind === 'checking') return <LoadingState />

  if (state.kind === 'error' || state.kind === 'wrong_role') {
    const wrongRole = state.kind === 'wrong_role'
    return (
      <div className="min-h-screen bg-[#FAF8FF]">
        <AdminTopbar title={title} />
        <main className="flex min-h-[calc(100dvh-60px)] items-center justify-center px-5 py-8">
          <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 text-center shadow-sm">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600">
              <AlertCircle size={24} aria-hidden="true" />
            </span>
            <h1 className="mt-4 text-xl font-black text-slate-950">{wrongRole ? 'Нет доступа к разделу' : 'Панель временно недоступна'}</h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              {wrongRole
                ? 'Для этого раздела нужна учётная запись администратора или супер-администратора.'
                : state.message}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              {wrongRole ? (
                <button type="button" onClick={() => void signOut()} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#1B4FD8] px-5 text-sm font-bold text-white transition-colors hover:bg-blue-700">
                  <LogOut size={17} aria-hidden="true" />
                  Сменить аккаунт
                </button>
              ) : (
                <button type="button" onClick={() => void load()} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#1B4FD8] px-5 text-sm font-bold text-white transition-colors hover:bg-blue-700">
                  <RefreshCw size={17} aria-hidden="true" />
                  Повторить
                </button>
              )}
              <Link href="/login" className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-slate-200 px-5 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50">
                <LogIn size={17} aria-hidden="true" />
                Ко входу
              </Link>
            </div>
          </section>
        </main>
      </div>
    )
  }

  const firstName = state.user.fullName.trim().split(/\s+/)[0] || 'Коллега'

  return (
    <div className="min-h-screen bg-[#FAF8FF]">
      <AdminTopbar title={title} />
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        <section className="overflow-hidden rounded-3xl border border-amber-200 bg-white shadow-sm">
          <div className="bg-gradient-to-br from-[#0D1E4A] via-[#1B4FD8] to-[#5A36C8] px-6 py-8 text-white sm:px-9 sm:py-10">
            <span className="inline-flex min-h-9 items-center gap-2 rounded-xl bg-white/10 px-3 text-sm font-bold text-blue-100 ring-1 ring-white/20">
              <ShieldCheck size={18} aria-hidden="true" />
              Собственный backend Zhangak
            </span>
            <p className="mt-6 text-sm font-semibold text-blue-100">Здравствуйте, {firstName}</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">{title} переносится</h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-blue-50 sm:text-base">{description}</p>
          </div>

          <div className="p-6 sm:p-9">
            <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950 sm:p-5">
              <Wrench className="mt-0.5 shrink-0 text-amber-700" size={22} aria-hidden="true" />
              <div>
                <h2 className="font-black">Старая база для этого раздела отключена</h2>
                <p className="mt-1 text-sm leading-6 text-amber-900">Мы не показываем устаревшие записи и не принимаем изменения, пока не появятся проверенные таблицы, права доступа и журнал действий в PostgreSQL Zhangak.</p>
              </div>
            </div>

            <section className="mt-6" aria-labelledby="migration-plan-title">
              <h2 id="migration-plan-title" className="text-lg font-black text-slate-950">Что появится после безопасного переноса</h2>
              <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                {plannedCapabilities.map(capability => (
                  <li key={capability} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold leading-5 text-slate-800">
                    {capability}
                  </li>
                ))}
              </ul>
            </section>

            <section className="mt-6 grid gap-3 sm:grid-cols-2" aria-label="Доступные рабочие разделы">
              <Link href="/admin/lessons" className="group flex min-h-24 items-center gap-4 rounded-2xl border border-blue-100 bg-blue-50 p-4 transition-colors hover:bg-blue-100">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-[#1B4FD8] shadow-sm"><BookOpen size={21} aria-hidden="true" /></span>
                <span className="min-w-0"><span className="block text-sm font-black text-slate-950">Уроки</span><span className="mt-0.5 block text-xs leading-5 text-slate-600">Создавайте проверенный учебный контент.</span></span>
                <ArrowRight size={18} className="ml-auto shrink-0 text-[#1B4FD8] transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </Link>
              <Link href="/admin/students" className="group flex min-h-24 items-center gap-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 transition-colors hover:bg-emerald-100">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-emerald-700 shadow-sm"><Users size={21} aria-hidden="true" /></span>
                <span className="min-w-0"><span className="block text-sm font-black text-slate-950">Ученики</span><span className="mt-0.5 block text-xs leading-5 text-slate-600">Управляйте учётными записями в собственной системе.</span></span>
                <ArrowRight size={18} className="ml-auto shrink-0 text-emerald-700 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </Link>
              <Link href="/admin/groups" className="group flex min-h-24 items-center gap-4 rounded-2xl border border-violet-100 bg-violet-50 p-4 transition-colors hover:bg-violet-100">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-violet-700 shadow-sm"><Users size={21} aria-hidden="true" /></span>
                <span className="min-w-0"><span className="block text-sm font-black text-slate-950">Группы</span><span className="mt-0.5 block text-xs leading-5 text-slate-600">Назначайте преподавателя и учеников в собственной системе.</span></span>
                <ArrowRight size={18} className="ml-auto shrink-0 text-violet-700 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </Link>
            </section>
          </div>
        </section>
      </main>
    </div>
  )
}
