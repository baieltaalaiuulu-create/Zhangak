'use client'

import Image from 'next/image'
import { AlertCircle, LogIn, LogOut, RefreshCw, ShieldCheck, Wrench } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import {
  getCurrentZhangakUser,
  logoutZhangak,
  type ZhangakSessionUser,
} from '@/lib/zhangak-auth-client'

type WorkspaceSurface = 'admin' | 'platform'
type WorkspaceState =
  | { kind: 'loading' }
  | { kind: 'ready'; user: ZhangakSessionUser }
  | { kind: 'wrong_role'; user: ZhangakSessionUser }
  | { kind: 'error'; message: string }

interface RoleMigrationWorkspaceProps {
  expectedRole: ZhangakSessionUser['role']
  surface: WorkspaceSurface
  title: string
  description: string
  capabilities: readonly string[]
}

function LoadingState() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F6F7FB] p-5">
      <div className="flex items-center gap-3 rounded-2xl bg-white px-5 py-4 text-sm font-semibold text-slate-600 shadow-sm">
        <RefreshCw size={18} className="animate-spin text-[#1B3F92]" aria-hidden="true" />
        Проверяем доступ к кабинету
      </div>
    </div>
  )
}

export default function RoleMigrationWorkspace({
  expectedRole,
  surface,
  title,
  description,
  capabilities,
}: RoleMigrationWorkspaceProps) {
  const [state, setState] = useState<WorkspaceState>({ kind: 'loading' })
  const loginHref = `/login?surface=${surface}`

  const load = useCallback(async () => {
    setState({ kind: 'loading' })
    try {
      const user = await getCurrentZhangakUser()
      if (!user) {
        window.location.replace(loginHref)
        return
      }
      setState(user.role === expectedRole ? { kind: 'ready', user } : { kind: 'wrong_role', user })
    } catch (cause) {
      setState({
        kind: 'error',
        message: cause instanceof Error ? cause.message : 'Не удалось проверить сессию',
      })
    }
  }, [expectedRole, loginHref])

  useEffect(() => {
    let cancelled = false

    const loadInitialAccess = async () => {
      try {
        const user = await getCurrentZhangakUser()
        if (cancelled) return
        if (!user) {
          window.location.replace(loginHref)
          return
        }
        setState(user.role === expectedRole ? { kind: 'ready', user } : { kind: 'wrong_role', user })
      } catch (cause) {
        if (!cancelled) {
          setState({
            kind: 'error',
            message: cause instanceof Error ? cause.message : 'Не удалось проверить сессию',
          })
        }
      }
    }

    void loadInitialAccess()
    return () => { cancelled = true }
  }, [expectedRole, loginHref])

  const signOut = async () => {
    await logoutZhangak().catch(() => {})
    window.location.replace(loginHref)
  }

  if (state.kind === 'loading') return <LoadingState />

  if (state.kind === 'error' || state.kind === 'wrong_role') {
    const wrongRole = state.kind === 'wrong_role'
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F6F7FB] p-5">
        <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 text-center shadow-sm">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600">
            <AlertCircle size={24} aria-hidden="true" />
          </span>
          <h1 className="mt-4 text-xl font-black text-slate-950">{wrongRole ? 'Нет доступа к этому кабинету' : 'Кабинет временно недоступен'}</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            {wrongRole
              ? 'Эта учётная запись относится к другому рабочему пространству. Выйдите и войдите под нужной ролью.'
              : state.message}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {wrongRole
              ? <button type="button" onClick={() => void signOut()} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#1B3F92] px-5 text-sm font-bold text-white"><LogOut size={17} aria-hidden="true" />Сменить учётную запись</button>
              : <button type="button" onClick={() => void load()} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#1B3F92] px-5 text-sm font-bold text-white"><RefreshCw size={17} aria-hidden="true" />Повторить</button>}
            <a href={loginHref} className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-slate-200 px-5 text-sm font-bold text-slate-700"><LogIn size={17} aria-hidden="true" />Ко входу</a>
          </div>
        </section>
      </main>
    )
  }

  const firstName = state.user.fullName.split(' ')[0] || 'Коллега'
  return (
    <div className="min-h-screen bg-[#F6F7FB] text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex min-h-16 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Image src="/images/logo.png" alt="Жангак" width={40} height={40} className="h-10 w-10 rounded-xl object-cover" priority />
            <div className="min-w-0"><p className="truncate text-sm font-black">Жангак</p><p className="truncate text-xs text-slate-500">Собственный кабинет</p></div>
          </div>
          <button type="button" onClick={() => void signOut()} aria-label="Выйти" className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-bold text-slate-600 hover:bg-red-50 hover:text-red-700"><LogOut size={18} aria-hidden="true" /><span className="hidden sm:inline">Выйти</span></button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
        <section className="overflow-hidden rounded-3xl bg-[#0D1E4A] p-6 text-white shadow-sm sm:p-9">
          <span className="inline-flex min-h-9 items-center gap-2 rounded-xl bg-white/10 px-3 text-sm font-bold text-blue-100"><ShieldCheck size={18} aria-hidden="true" />Собственный backend Zhangak</span>
          <p className="mt-6 text-sm font-semibold text-blue-100">Здравствуйте, {firstName}</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">{title}</h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-blue-100 sm:text-base">{description}</p>
        </section>

        <section className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-6 sm:p-8">
          <div className="flex gap-3"><Wrench className="mt-0.5 shrink-0 text-amber-700" size={22} aria-hidden="true" /><div><h2 className="text-lg font-black text-amber-950">Раздел переносится без старой базы</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-amber-900">Чтобы не показывать непроверенные данные и не возвращать вас к старому входу, этот кабинет пока работает в безопасном режиме. Функции будут включаться по мере появления проверенных маршрутов и таблиц в PostgreSQL Zhangak.</p></div></div>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {capabilities.map(capability => <li key={capability} className="rounded-2xl border border-amber-200 bg-white/80 p-4 text-sm font-bold text-slate-800">{capability}</li>)}
          </ul>
        </section>
      </main>
    </div>
  )
}
