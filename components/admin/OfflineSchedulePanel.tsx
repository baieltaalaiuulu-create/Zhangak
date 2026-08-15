'use client'

import { useCallback, useEffect, useState } from 'react'
import { Bell, CalendarPlus, LoaderCircle, RefreshCw, Save } from 'lucide-react'

import {
  createAdminOfflineAnnouncement,
  createAdminOfflineSession,
  getAdminOfflineSchedule,
  type AdminOfflineScheduleWorkspace,
} from '@/lib/admin-offline-schedule-client'

function localDateTime(value = new Date(Date.now() + 60 * 60 * 1000)) {
  const offset = value.getTimezoneOffset() * 60_000
  return new Date(value.getTime() - offset).toISOString().slice(0, 16)
}

function formatDate(value: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date)
    : '—'
}

function errorText(error: unknown) {
  return error instanceof Error ? error.message : 'Не удалось сохранить изменения.'
}

export default function OfflineSchedulePanel({ groupId, disabled = false }: { groupId: number; disabled?: boolean }) {
  const [workspace, setWorkspace] = useState<AdminOfflineScheduleWorkspace | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try { setWorkspace(await getAdminOfflineSchedule(groupId)) }
    catch (error) { setNotice({ kind: 'error', text: errorText(error) }) }
    finally { setLoading(false) }
  }, [groupId])

  useEffect(() => {
    let cancelled = false
    const loadInitial = async () => {
      try {
        const nextWorkspace = await getAdminOfflineSchedule(groupId)
        if (!cancelled) setWorkspace(nextWorkspace)
      } catch (error) {
        if (!cancelled) setNotice({ kind: 'error', text: errorText(error) })
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void loadInitial()
    return () => { cancelled = true }
  }, [groupId])

  const save = async (work: () => Promise<unknown>, success: string) => {
    setSaving(true); setNotice(null)
    try { await work(); setNotice({ kind: 'success', text: success }); await refresh() }
    catch (error) { setNotice({ kind: 'error', text: errorText(error) }) }
    finally { setSaving(false) }
  }

  if (loading && !workspace) return <section className="border-t border-slate-100 px-4 py-5 sm:px-5"><div className="flex min-h-24 items-center justify-center gap-2 text-sm font-semibold text-slate-400"><LoaderCircle className="animate-spin" size={18} />Загружаем расписание…</div></section>
  if (!workspace) return <section className="border-t border-slate-100 px-4 py-5 sm:px-5"><p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">Расписание пока недоступно.</p></section>

  return (
    <section className="border-t border-slate-100 bg-slate-50/70 px-4 py-5 sm:px-5" aria-labelledby="offline-schedule-heading">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 id="offline-schedule-heading" className="text-sm font-black text-slate-950">Расписание и объявления</h3><p className="mt-1 text-xs leading-5 text-slate-500">Только администратор настраивает время занятий и сообщения для офлайн-группы.</p></div><button type="button" onClick={() => void refresh()} disabled={loading || saving} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-white px-3 text-xs font-bold text-[#1B3F92] shadow-sm hover:bg-blue-50 disabled:opacity-50"><RefreshCw size={15} aria-hidden="true" />Обновить</button></div>
      {notice && <p role="status" className={`mt-3 rounded-xl px-3 py-2.5 text-sm font-semibold ${notice.kind === 'success' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`}>{notice.text}</p>}
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <form className="rounded-2xl border border-slate-200 bg-white p-4" onSubmit={event => { event.preventDefault(); const form = new FormData(event.currentTarget); const lessonId = Number(form.get('lessonId')); const startsAt = new Date(String(form.get('startsAt'))).toISOString(); const endsAtValue = String(form.get('endsAt') || ''); void save(() => createAdminOfflineSession(groupId, { lessonId, startsAt, endsAt: endsAtValue ? new Date(endsAtValue).toISOString() : null, room: String(form.get('room') || '').trim() || null }), 'Занятие добавлено в расписание.'); event.currentTarget.reset() }}>
          <div className="flex items-center gap-2 text-sm font-black text-slate-900"><CalendarPlus size={17} className="text-[#1B3F92]" />Новое занятие</div>
          <div className="mt-3 grid gap-3"><select name="lessonId" required disabled={disabled || saving || workspace.lessons.length === 0} className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="">Выберите опубликованный урок</option>{workspace.lessons.map(lesson => <option key={lesson.id} value={lesson.id}>Урок {lesson.lessonNumber}: {lesson.title}</option>)}</select><div className="grid gap-3 sm:grid-cols-2"><input name="startsAt" type="datetime-local" required defaultValue={localDateTime()} disabled={disabled || saving} className="min-h-11 rounded-xl border border-slate-200 px-3 text-sm" /><input name="endsAt" type="datetime-local" disabled={disabled || saving} className="min-h-11 rounded-xl border border-slate-200 px-3 text-sm" /></div><input name="room" maxLength={160} disabled={disabled || saving} placeholder="Кабинет (необязательно)" className="min-h-11 rounded-xl border border-slate-200 px-3 text-sm" /><button type="submit" disabled={disabled || saving || workspace.lessons.length === 0} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#1B3F92] px-4 text-sm font-bold text-white disabled:opacity-50"><Save size={16} />Добавить занятие</button></div>
          {workspace.lessons.length === 0 && <p className="mt-2 text-xs text-amber-700">Сначала опубликуйте уроки курса.</p>}
        </form>
        <form className="rounded-2xl border border-slate-200 bg-white p-4" onSubmit={event => { event.preventDefault(); const form = new FormData(event.currentTarget); void save(() => createAdminOfflineAnnouncement(groupId, { title: String(form.get('title')), body: String(form.get('body')), publish: form.get('publish') === 'on' }), 'Объявление сохранено.'); event.currentTarget.reset() }}>
          <div className="flex items-center gap-2 text-sm font-black text-slate-900"><Bell size={17} className="text-[#1B3F92]" />Объявление группе</div>
          <div className="mt-3 grid gap-3"><input name="title" required maxLength={300} disabled={disabled || saving} placeholder="Заголовок" className="min-h-11 rounded-xl border border-slate-200 px-3 text-sm" /><textarea name="body" required maxLength={20000} rows={3} disabled={disabled || saving} placeholder="Текст для учеников" className="rounded-xl border border-slate-200 p-3 text-sm" /><label className="flex min-h-10 items-center gap-2 text-sm font-semibold text-slate-700"><input name="publish" type="checkbox" defaultChecked />Показать ученикам сразу</label><button type="submit" disabled={disabled || saving} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#1B3F92] bg-white px-4 text-sm font-bold text-[#1B3F92] disabled:opacity-50"><Bell size={16} />Сохранить объявление</button></div>
        </form>
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-2"><div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-black uppercase tracking-wide text-slate-400">Ближайшие занятия</p>{workspace.sessions.length === 0 ? <p className="mt-3 text-sm text-slate-500">Расписание ещё не задано.</p> : <ul className="mt-3 space-y-2">{workspace.sessions.slice(0, 6).map(session => <li key={session.id} className="rounded-xl bg-slate-50 px-3 py-2 text-sm"><span className="font-bold text-slate-900">{session.lessonTitle}</span><span className="ml-2 text-slate-500">{formatDate(session.startsAt)}{session.room ? ` · ${session.room}` : ''}</span></li>)}</ul>}</div><div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-black uppercase tracking-wide text-slate-400">Последние объявления</p>{workspace.announcements.length === 0 ? <p className="mt-3 text-sm text-slate-500">Объявлений пока нет.</p> : <ul className="mt-3 space-y-2">{workspace.announcements.slice(0, 4).map(item => <li key={item.id} className="rounded-xl bg-slate-50 px-3 py-2 text-sm"><span className="font-bold text-slate-900">{item.title}</span><span className={`ml-2 text-xs font-bold ${item.published ? 'text-emerald-700' : 'text-amber-700'}`}>{item.published ? 'Опубликовано' : 'Черновик'}</span></li>)}</ul>}</div></div>
    </section>
  )
}
