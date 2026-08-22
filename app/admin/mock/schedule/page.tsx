'use client'

export const dynamic = 'force-dynamic'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { CalendarDays, CheckCircle2, ExternalLink, LoaderCircle, Plus, RefreshCw, Save } from 'lucide-react'

import AdminTopbar from '@/components/admin/AdminTopbar'
import { createAdminMockExam, listAdminMockExams, updateAdminMockExam, type AdminMockExam, type MockExamInput } from '@/lib/admin-mock-exams-client'

function localDateTime(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '' : new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

function initialForm(): MockExamInput {
  const next = new Date()
  next.setDate(next.getDate() + 7)
  next.setHours(10, 0, 0, 0)
  return { title: 'Пробный ОРТ', startsAt: next.toISOString(), city: 'Бишкек', venue: '', capacity: null, registrationClosesAt: null, isPublished: false }
}

function formFrom(item: AdminMockExam): MockExamInput {
  return { title: item.title, startsAt: item.startsAt, city: item.city, venue: item.venue, capacity: item.capacity, registrationClosesAt: item.registrationClosesAt, isPublished: item.isPublished }
}

function feedback(error: unknown): string { return error instanceof Error && error.message ? error.message : 'Не удалось сохранить изменения.' }

export default function MockExamSchedulePage() {
  const [items, setItems] = useState<AdminMockExam[]>([])
  const [selected, setSelected] = useState<AdminMockExam | null>(null)
  const [form, setForm] = useState<MockExamInput>(initialForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try { setItems(await listAdminMockExams()) } catch (cause) { setError(feedback(cause)) } finally { setLoading(false) }
  }, [])
  useEffect(() => { const timer = window.setTimeout(() => { void load() }, 0); return () => window.clearTimeout(timer) }, [load])

  const choose = (item: AdminMockExam | null) => { setSelected(item); setForm(item ? formFrom(item) : initialForm()); setError(''); setNotice('') }
  const set = <K extends keyof MockExamInput>(key: K, value: MockExamInput[K]) => setForm(current => ({ ...current, [key]: value }))
  const save = async () => {
    setSaving(true); setError(''); setNotice('')
    try {
      const result = selected
        ? await updateAdminMockExam(selected.id, form)
        : await createAdminMockExam(form)
      setItems(current => [result, ...current.filter(item => item.id !== result.id)].sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()))
      setSelected(result); setForm(formFrom(result)); setNotice(result.isPublished ? 'Событие опубликовано и видимо ученикам, пока регистрация открыта.' : 'Черновик сохранён. Ученики его не увидят до публикации.')
    } catch (cause) { setError(feedback(cause)) } finally { setSaving(false) }
  }
  const togglePublished = async (item: AdminMockExam) => {
    setSaving(true); setError(''); setNotice('')
    try { const result = await updateAdminMockExam(item.id, { isPublished: !item.isPublished }); setItems(current => current.map(value => value.id === result.id ? result : value)); if (selected?.id === result.id) { setSelected(result); setForm(formFrom(result)) } } catch (cause) { setError(feedback(cause)) } finally { setSaving(false) }
  }

  return <div className="min-h-screen bg-[#FAF8FF]"><AdminTopbar title="Пробный ОРТ: расписание" actionLabel="Обновить" actionIcon={RefreshCw} onAction={() => void load()} />
    <main className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6">
      <section className="rounded-2xl border border-blue-100 bg-blue-50 p-4"><div className="flex items-start gap-3"><CalendarDays className="mt-0.5 text-[#1B3F92]" size={22} /><div><h1 className="font-black text-[#0D1E4A]">Очные пробные ОРТ</h1><p className="mt-1 text-sm leading-6 text-slate-600">Опубликуйте дату, время и место — ближайшее открытое событие появится на главной странице ученика. Регистрация автоматически закроется в указанное время или в момент начала.</p></div></div></section>
      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
      {notice && <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{notice}</p>}
      <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="rounded-2xl border bg-white p-4"><div className="flex items-center justify-between gap-2"><h2 className="font-black text-[#191B23]">События</h2><button type="button" onClick={() => choose(null)} className="inline-flex min-h-10 items-center gap-1 rounded-xl bg-[#1B3F92] px-3 text-xs font-bold text-white"><Plus size={15} />Новое</button></div>{loading ? <p className="mt-6 flex items-center text-sm text-slate-500"><LoaderCircle className="mr-2 animate-spin" size={17} />Загружаем…</p> : <div className="mt-4 space-y-2">{items.length === 0 ? <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Событий ещё нет. Создайте первый пробный ОРТ.</p> : items.map(item => <article key={item.id} className={`rounded-xl border p-3 ${selected?.id === item.id ? 'border-[#1B3F92] bg-blue-50' : 'border-slate-200'}`}><button type="button" onClick={() => choose(item)} className="w-full text-left"><p className="font-bold text-[#191B23]">{item.title}</p><p className="mt-1 text-xs text-slate-500">{new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Bishkek' }).format(new Date(item.startsAt))}</p><p className="mt-1 text-xs text-slate-500">{item.city} · {item.registeredCount}{item.capacity !== null ? `/${item.capacity}` : ''} мест</p></button><button type="button" disabled={saving} onClick={() => void togglePublished(item)} className={`mt-3 min-h-9 rounded-lg px-3 text-xs font-bold ${item.isPublished ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'}`}>{item.isPublished ? <><CheckCircle2 className="mr-1 inline" size={13} />Опубликовано</> : 'Черновик'}</button></article>)}</div>}</aside>
        <section className="rounded-2xl border bg-white p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-black text-[#191B23]">{selected ? 'Изменить событие' : 'Новое событие'}</h2><p className="mt-1 text-sm text-slate-500">Поля со звёздочкой обязательны.</p></div>{selected && <Link href={`/student/online/mock/${selected.id}`} target="_blank" className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-[#1B3F92] px-3 text-xs font-bold text-[#1B3F92]"><ExternalLink size={14} />Старый экран</Link>}</div><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-sm font-bold text-[#334155] sm:col-span-2">Название *<input value={form.title} onChange={event => set('title', event.target.value)} maxLength={200} className="mt-1 block min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm" /></label><label className="text-sm font-bold text-[#334155]">Дата и время *<input type="datetime-local" value={localDateTime(form.startsAt)} onChange={event => { if (event.target.value) set('startsAt', new Date(event.target.value).toISOString()) }} className="mt-1 block min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm" /></label><label className="text-sm font-bold text-[#334155]">Закрыть регистрацию<input type="datetime-local" value={localDateTime(form.registrationClosesAt)} onChange={event => set('registrationClosesAt', event.target.value ? new Date(event.target.value).toISOString() : null)} className="mt-1 block min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm" /><span className="mt-1 block text-xs font-medium text-slate-400">Пусто — до начала события.</span></label><label className="text-sm font-bold text-[#334155]">Город *<input value={form.city} onChange={event => set('city', event.target.value)} maxLength={120} className="mt-1 block min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm" /></label><label className="text-sm font-bold text-[#334155]">Место проведения *<input value={form.venue} onChange={event => set('venue', event.target.value)} maxLength={300} className="mt-1 block min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm" /></label><label className="text-sm font-bold text-[#334155]">Количество мест<input type="number" min="1" max="10000" value={form.capacity ?? ''} onChange={event => set('capacity', event.target.value ? Number(event.target.value) : null)} className="mt-1 block min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm" /><span className="mt-1 block text-xs font-medium text-slate-400">Пусто — без ограничения.</span></label><label className="mt-5 flex min-h-11 items-center gap-2 text-sm font-bold text-[#334155]"><input type="checkbox" checked={form.isPublished} onChange={event => set('isPublished', event.target.checked)} />Опубликовать для учеников</label></div><button type="button" disabled={saving || !form.venue.trim() || !form.title.trim()} onClick={() => void save()} className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#1B3F92] px-5 text-sm font-bold text-white shadow-md shadow-blue-200 disabled:opacity-50"><Save size={16} />{saving ? 'Сохраняем…' : selected ? 'Сохранить изменения' : 'Создать событие'}</button></section>
      </div>
    </main>
  </div>
}
