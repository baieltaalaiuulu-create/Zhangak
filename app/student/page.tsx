'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { useRouter } from 'next/navigation'

import OfflineStudentCabinet from '@/components/offline-student/OfflineStudentCabinet'
import { fetchOfflineStudentDashboard, OfflineStudentRequestError } from '@/lib/offline-student-data'
import type { OfflineStudentDashboard } from '@/lib/offline-student-contract'

export const dynamic = 'force-dynamic'

function LoadingCabinet() {
  return (
    <div className="min-h-screen bg-[#F6F7FB] px-4 py-5">
      <div className="mx-auto max-w-6xl animate-pulse space-y-4">
        <div className="h-16 rounded-2xl bg-white" />
        <div className="h-12 rounded-2xl bg-white" />
        <div className="grid gap-4 md:grid-cols-2">
          <div className="h-52 rounded-3xl bg-white" />
          <div className="h-52 rounded-3xl bg-white" />
        </div>
      </div>
    </div>
  )
}

export default function OfflineStudentPage() {
  const router = useRouter()
  const [dashboard, setDashboard] = useState<OfflineStudentDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const handleRequestError = useCallback((requestError: unknown) => {
    if (requestError instanceof OfflineStudentRequestError && requestError.status === 401) {
      router.replace('/login')
      return
    }
    if (requestError instanceof OfflineStudentRequestError && requestError.status === 403) {
      router.replace('/student/online')
      return
    }
    setError(requestError instanceof Error ? requestError.message : 'Не удалось загрузить кабинет')
  }, [router])

  const retry = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setDashboard(await fetchOfflineStudentDashboard())
    } catch (requestError) {
      handleRequestError(requestError)
    } finally {
      setLoading(false)
    }
  }, [handleRequestError])

  useEffect(() => {
    let cancelled = false
    void fetchOfflineStudentDashboard()
      .then(data => {
        if (!cancelled) setDashboard(data)
      })
      .catch(requestError => {
        if (!cancelled) handleRequestError(requestError)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [handleRequestError])

  if (loading) return <LoadingCabinet />
  if (error || !dashboard) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F6F7FB] p-5">
        <div className="w-full max-w-md rounded-3xl border border-red-100 bg-white p-6 text-center shadow-sm">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600">
            <AlertCircle size={24} aria-hidden="true" />
          </span>
          <h1 className="mt-4 text-lg font-extrabold text-slate-900">Кабинет не загрузился</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">{error ?? 'Попробуй ещё раз.'}</p>
          <button type="button" onClick={() => void retry()} className="mt-5 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#1B4FD8] px-5 text-sm font-bold text-white">
            <RefreshCw size={17} aria-hidden="true" />
            Повторить
          </button>
        </div>
      </div>
    )
  }

  return <OfflineStudentCabinet dashboard={dashboard} />
}
