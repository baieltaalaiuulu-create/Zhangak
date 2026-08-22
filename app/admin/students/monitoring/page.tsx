'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Activity, CalendarClock, PauseCircle, PlayCircle, RefreshCw, Search, ShieldAlert, type LucideIcon } from 'lucide-react'
import AdminTopbar from '@/components/admin/AdminTopbar'
import { changeStudentAccess, getStudentMonitoring, type MonitoredStudent, type OnlineAccessPlan, type OnlineAccessState } from '@/lib/admin-student-monitoring-client'

const STATE_LABELS: Record<OnlineAccessState, string> = { active: 'Активен', frozen: 'Заморожен', expired: 'Истёк', pending: 'Ожидает', none: 'Нет курса' }
const PLAN_LABELS: Record<OnlineAccessPlan, string> = { one_month: '1 месяц', three_months: '3 месяца', one_year: '1 год' }

function date(value: string | null): string { return value ? new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium' }).format(new Date(value)) : '—' }
function datetime(value: string | null): string { return value ? new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : 'Не входил' }

export default function StudentMonitoringPage() {
  const [items, setItems] = useState<MonitoredStudent[]>([])
  const [q, setQ] = useState('')
  const [state, setState] = useState<OnlineAccessState | ''>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<number | null>(null)
  const [plan, setPlan] = useState<OnlineAccessPlan>('one_month')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try { setItems((await getStudentMonitoring({ q, accessState: state })).items) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Не удалось загрузить данные') }
    finally { setLoading(false) }
  }, [q, state])

  useEffect(() => { const timer = window.setTimeout(() => { void load() }, 200); return () => window.clearTimeout(timer) }, [load])
  const totals = useMemo(() => ({ active: items.filter(x => x.access?.state === 'active').length, frozen: items.filter(x => x.access?.state === 'frozen').length, expired: items.filter(x => x.access?.state === 'expired').length }), [items])
  const summaryCards: { label: string; value: number; icon: LucideIcon }[] = [
    { label: 'Активный доступ', value: totals.active, icon: Activity },
    { label: 'Заморожено', value: totals.frozen, icon: PauseCircle },
    { label: 'Истёк срок', value: totals.expired, icon: ShieldAlert },
  ]

  const act = async (student: MonitoredStudent, action: 'extend' | 'freeze' | 'resume') => {
    if (!student.access) return
    setBusy(student.access.enrollmentId); setError('')
    try {
      await changeStudentAccess(student.access.enrollmentId, action === 'extend' ? { action, accessPlan: plan } : action === 'freeze' ? { action, reason: 'Заморожено администратором' } : { action })
      await load()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Действие не выполнено') }
    finally { setBusy(null) }
  }

  return <div className="min-h-screen bg-slate-50">
    <AdminTopbar title="Активность учеников" />
    <main className="mx-auto max-w-7xl space-y-5 px-4 pb-10 pt-24 sm:px-6 lg:ml-64 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/admin/students" className="text-sm font-bold text-[#1B3F92] hover:underline">← Аккаунты учеников</Link>
        <button onClick={() => void load()} className="flex min-h-11 items-center gap-2 rounded-xl border bg-white px-4 text-sm font-bold"><RefreshCw size={16}/>Обновить</button>
      </div>
      <section className="grid gap-3 sm:grid-cols-3">
        {summaryCards.map(card => { const Icon = card.icon; return <div key={card.label} className="rounded-2xl border bg-white p-4 shadow-sm"><div className="flex items-center gap-2 text-slate-500"><Icon size={18}/><span className="text-sm font-bold">{card.label}</span></div><p className="mt-2 text-3xl font-black text-slate-900">{card.value}</p></div> })}
      </section>
      <section className="grid gap-3 rounded-2xl border bg-white p-4 sm:grid-cols-[1fr_220px]">
        <label className="relative"><Search className="absolute left-3 top-3.5 text-slate-400" size={18}/><input value={q} onChange={e => setQ(e.target.value)} placeholder="Имя, email или телефон" className="min-h-11 w-full rounded-xl border pl-10 pr-3"/></label>
        <select value={state} onChange={e => setState(e.target.value as OnlineAccessState | '')} className="min-h-11 rounded-xl border px-3"><option value="">Все статусы</option>{Object.entries(STATE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
      </section>
      {error && <p role="alert" className="rounded-xl bg-red-50 p-4 font-semibold text-red-700">{error}</p>}
      {loading ? <p className="py-16 text-center text-slate-500">Загрузка…</p> : <section className="grid gap-4 xl:grid-cols-2">{items.map(student => <article key={student.id} className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3"><div><h2 className="font-black text-slate-900">{student.fullName}</h2><p className="break-all text-sm text-slate-500">{student.email}</p><p className="mt-1 text-xs text-slate-400">Последний вход: {datetime(student.lastSeenAt)}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-black ${student.access?.state === 'active' ? 'bg-emerald-100 text-emerald-700' : student.access?.state === 'frozen' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>{STATE_LABELS[student.access?.state ?? 'none']}</span></div>
        <div className="mt-4 grid grid-cols-4 gap-2 text-center">{[['XP', student.metrics.xp], ['Визиты', student.metrics.visits30d], ['Уроки', student.metrics.lessonsCompleted], ['Тесты', student.metrics.practiceSubmitted]].map(([label, value]) => <div key={String(label)} className="rounded-xl bg-slate-50 p-2"><p className="font-black">{String(value)}</p><p className="text-[11px] text-slate-500">{String(label)}</p></div>)}</div>
        {student.access && <div className="mt-4 rounded-xl border p-3"><div className="flex items-center gap-2 text-sm"><CalendarClock size={16}/><b>{student.access.courseName}</b></div><p className="mt-1 text-xs text-slate-500">Тариф: {student.access.plan ? PLAN_LABELS[student.access.plan] : 'не задан'} · до {date(student.access.expiresAt)}</p>
          <div className="mt-3 flex flex-wrap gap-2"><select value={plan} onChange={e => setPlan(e.target.value as OnlineAccessPlan)} className="min-h-10 rounded-lg border px-2 text-sm">{Object.entries(PLAN_LABELS).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select><button disabled={busy === student.access.enrollmentId} onClick={() => void act(student, 'extend')} className="min-h-10 rounded-lg bg-[#1B3F92] px-3 text-sm font-bold text-white">Продлить</button>{student.access.state === 'frozen' ? <button disabled={busy === student.access.enrollmentId} onClick={() => void act(student, 'resume')} className="flex min-h-10 items-center gap-1 rounded-lg bg-emerald-600 px-3 text-sm font-bold text-white"><PlayCircle size={15}/>Возобновить</button> : <button disabled={busy === student.access.enrollmentId || student.access.state !== 'active'} onClick={() => void act(student, 'freeze')} className="flex min-h-10 items-center gap-1 rounded-lg border px-3 text-sm font-bold disabled:opacity-40"><PauseCircle size={15}/>Заморозить</button>}</div>
        </div>}
      </article>)}</section>}
    </main>
  </div>
}
