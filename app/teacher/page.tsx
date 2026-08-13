'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { useRouter } from 'next/navigation'

import TeacherWorkspace from '@/components/teacher/TeacherWorkspace'
import { fetchTeacherGroups, fetchTeacherWorkspace, TeacherRequestError } from '@/lib/teacher-data'
import type { TeacherGroupSummary, TeacherGroupWorkspace } from '@/lib/teacher-contract'

export const dynamic = 'force-dynamic'

function Skeleton() {
  return <div className="min-h-screen animate-pulse bg-[#F6F7FB] p-4 sm:p-6"><div className="mx-auto max-w-7xl space-y-4"><div className="h-16 rounded-2xl bg-white" /><div className="grid gap-4 lg:grid-cols-[240px_1fr]"><div className="h-80 rounded-3xl bg-white" /><div className="h-[520px] rounded-3xl bg-white" /></div></div></div>
}

export default function TeacherPage() {
  const router = useRouter()
  const [groups, setGroups] = useState<TeacherGroupSummary[]>([])
  const [workspace, setWorkspace] = useState<TeacherGroupWorkspace | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const handleError = useCallback((requestError: unknown) => {
    // Authentication is now first-party. A 401 from a legacy Supabase data
    // endpoint is a migration error, not proof that the Zhangak session has
    // ended; redirecting here recreated the login loop.
    if (requestError instanceof TeacherRequestError && requestError.status === 401) {
      setError('Учебные данные учителя переносятся на новый сервис. Вход сохранён, попробуйте немного позже.')
      return
    }
    if (requestError instanceof TeacherRequestError && requestError.status === 403) { router.replace('/'); return }
    setError(requestError instanceof Error ? requestError.message : 'Не удалось загрузить кабинет')
  }, [router])

  const load = useCallback(async (preferredGroupId?: number) => {
    setLoading(true)
    setError(null)
    try {
      const availableGroups = await fetchTeacherGroups()
      setGroups(availableGroups)
      const selectedId = preferredGroupId && availableGroups.some(group => group.id === preferredGroupId)
        ? preferredGroupId
        : availableGroups[0]?.id
      setWorkspace(selectedId ? await fetchTeacherWorkspace(selectedId) : null)
    } catch (requestError) {
      handleError(requestError)
    } finally {
      setLoading(false)
    }
  }, [handleError])

  useEffect(() => {
    let cancelled = false
    void fetchTeacherGroups()
      .then(async availableGroups => {
        if (cancelled) return
        const initialWorkspace = availableGroups[0] ? await fetchTeacherWorkspace(availableGroups[0].id) : null
        if (cancelled) return
        setGroups(availableGroups)
        setWorkspace(initialWorkspace)
      })
      .catch(requestError => { if (!cancelled) handleError(requestError) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [handleError])

  const selectGroup = async (groupId: number) => {
    setLoading(true)
    setError(null)
    try { setWorkspace(await fetchTeacherWorkspace(groupId)) }
    catch (requestError) { handleError(requestError) }
    finally { setLoading(false) }
  }

  const refresh = async () => {
    if (!workspace) return void load()
    try { setWorkspace(await fetchTeacherWorkspace(workspace.group.id)) }
    catch (requestError) { handleError(requestError) }
  }

  if (loading) return <Skeleton />
  if (error) return <div className="flex min-h-screen items-center justify-center bg-[#F6F7FB] p-5"><div className="w-full max-w-md rounded-3xl border border-red-100 bg-white p-6 text-center shadow-sm"><span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600"><AlertCircle size={24} /></span><h1 className="mt-4 text-lg font-black text-slate-950">Кабинет не загрузился</h1><p className="mt-2 text-sm leading-6 text-slate-500">{error}</p><button type="button" onClick={() => void load(workspace?.group.id)} className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#1B4FD8] px-5 text-sm font-bold text-white"><RefreshCw size={17} />Повторить</button></div></div>

  return <TeacherWorkspace key={workspace ? workspace.group.id : `empty:${groups.map(group => group.id).join(',')}`} groups={groups} workspace={workspace} onSelectGroup={selectGroup} onRefresh={refresh} />
}
