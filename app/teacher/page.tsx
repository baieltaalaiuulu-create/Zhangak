'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, LogIn, RefreshCw } from 'lucide-react'

import TeacherWorkspace from '@/components/teacher/TeacherWorkspace'
import { getPlatformTeacherDashboard, type PlatformTeacherDashboard } from '@/lib/platform-teacher'
import { ZhangakApiError } from '@/lib/zhangak-api-client'

export const dynamic = 'force-dynamic'

function Skeleton() {
  return (
    <div className="min-h-screen animate-pulse bg-[#F6F7FB] p-4 sm:p-6">
      <div className="mx-auto max-w-6xl space-y-5"><div className="h-16 rounded-2xl bg-white" /><div className="h-44 rounded-3xl bg-slate-200" /><div className="grid gap-4 lg:grid-cols-2"><div className="h-72 rounded-3xl bg-white" /><div className="h-72 rounded-3xl bg-white" /></div></div>
    </div>
  )
}

function ErrorState({ error, onRetry }: { error: ZhangakApiError | null; onRetry: () => Promise<void> }) {
  const signInRequired = error?.status === 401
  const wrongRole = error?.status === 403
  const description = signInRequired
    ? 'Сессия не найдена или истекла. Войдите в кабинет преподавателя ещё раз.'
    : wrongRole
      ? 'Этот раздел доступен только преподавателю. Войдите под учётной записью преподавателя.'
      : error?.message ?? 'Не удалось загрузить кабинет преподавателя.'

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F6F7FB] p-5">
      <div className="w-full max-w-md rounded-3xl border border-red-100 bg-white p-7 text-center shadow-sm">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600"><AlertCircle size={24} aria-hidden="true" /></span>
        <h1 className="mt-4 text-lg font-black text-slate-950">Кабинет не загрузился</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          {signInRequired || wrongRole ? <button type="button" onClick={() => window.location.replace('/login')} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#1B3F92] px-5 text-sm font-bold text-white"><LogIn size={17} aria-hidden="true" />Войти</button> : <button type="button" onClick={() => void onRetry()} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#1B3F92] px-5 text-sm font-bold text-white"><RefreshCw size={17} aria-hidden="true" />Повторить</button>}
        </div>
      </div>
    </div>
  )
}

export default function TeacherPage() {
  const [dashboard, setDashboard] = useState<PlatformTeacherDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<ZhangakApiError | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setDashboard(await getPlatformTeacherDashboard())
    } catch (cause) {
      setError(cause instanceof ZhangakApiError
        ? cause
        : new ZhangakApiError('Сервис временно недоступен', 503, 'teacher_dashboard_unavailable'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    const loadInitialDashboard = async () => {
      try {
        const nextDashboard = await getPlatformTeacherDashboard()
        if (!cancelled) setDashboard(nextDashboard)
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof ZhangakApiError
            ? cause
            : new ZhangakApiError('Сервис временно недоступен', 503, 'teacher_dashboard_unavailable'))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadInitialDashboard()
    return () => { cancelled = true }
  }, [])

  if (!dashboard && loading) return <Skeleton />
  if (!dashboard) return <ErrorState error={error} onRetry={load} />
  return <TeacherWorkspace dashboard={dashboard} onRefresh={load} refreshing={loading} />
}
