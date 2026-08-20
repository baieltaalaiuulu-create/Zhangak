'use client'

import { CheckCircle2, ChevronDown, ClipboardList, LoaderCircle, MessageCircle, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import { listAdminAccounts, type AdminAccount } from '@/lib/admin-account-client'
import {
  confirmApplicationPayment,
  listApplicationEvents,
  listStaffApplications,
  updateStaffApplication,
  type ApplicationEvent,
  type PublicApplicationStatus,
  type StaffApplication,
} from '@/lib/public-applications'
import { getCurrentZhangakUser } from '@/lib/zhangak-auth-client'

const STATUS_LABEL: Record<PublicApplicationStatus, string> = {
  new: 'Новая',
  contacted: 'Связались',
  awaiting_payment: 'Ожидает оплаты',
  awaiting_confirmation: 'Ожидает подтверждения',
  enrolled: 'Зачислен',
  declined: 'Отклонена',
  cancelled: 'Отменена',
}

const NEXT_STATUSES: Partial<Record<PublicApplicationStatus, PublicApplicationStatus[]>> = {
  new: ['contacted', 'awaiting_payment', 'declined', 'cancelled'],
  contacted: ['awaiting_payment', 'awaiting_confirmation', 'declined', 'cancelled'],
  awaiting_payment: ['contacted', 'awaiting_confirmation', 'declined', 'cancelled'],
  awaiting_confirmation: ['awaiting_payment', 'declined', 'cancelled'],
}

function date(value: string): string {
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? '—' : new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeStyle: 'short' }).format(parsed)
}

export default function ApplicationQueueWorkspace({ title, managerMode = false }: { title: string; managerMode?: boolean }) {
  const [items, setItems] = useState<StaffApplication[]>([])
  const [students, setStudents] = useState<AdminAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<number | null>(null)
  const [events, setEvents] = useState<Record<number, ApplicationEvent[]>>({})
  const [openEvents, setOpenEvents] = useState<number | null>(null)
  const [notes, setNotes] = useState<Record<number, string>>({})
  const [studentId, setStudentId] = useState<Record<number, string>>({})
  const [accessPlans, setAccessPlans] = useState<Record<number, 'one_month' | 'three_months' | 'one_year'>>({})
  const [error, setError] = useState<string | null>(null)
  const [canConfirm, setCanConfirm] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const user = await getCurrentZhangakUser()
      if (!user || !['manager', 'admin', 'super_admin'].includes(user.role)) {
        window.location.replace('/login')
        return
      }
      const [applications, accounts] = await Promise.all([
        listStaffApplications(),
        ['admin', 'super_admin'].includes(user.role) ? listAdminAccounts({ limit: 100 }) : Promise.resolve(null),
      ])
      setItems(applications)
      setCanConfirm(user.role === 'admin' || user.role === 'super_admin')
      setStudents((accounts?.items ?? []).filter(account => account.role === 'student' && !account.blocked))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось загрузить заявки')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const applyStatus = async (application: StaffApplication, status: Exclude<PublicApplicationStatus, 'new' | 'enrolled'>) => {
    setSavingId(application.id)
    try {
      const updated = await updateStaffApplication(application.id, { status, note: notes[application.id]?.trim() || undefined })
      setItems(items => items.map(item => item.id === updated.id ? updated : item))
      setNotes(notes => ({ ...notes, [application.id]: '' }))
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Не удалось обновить заявку') }
    finally { setSavingId(null) }
  }

  const addNote = async (application: StaffApplication) => {
    const note = notes[application.id]?.trim()
    if (!note) return
    setSavingId(application.id)
    try {
      await updateStaffApplication(application.id, { note })
      setNotes(notes => ({ ...notes, [application.id]: '' }))
      const history = await listApplicationEvents(application.id)
      setEvents(events => ({ ...events, [application.id]: history }))
      setOpenEvents(application.id)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Не удалось добавить заметку') }
    finally { setSavingId(null) }
  }

  const showEvents = async (application: StaffApplication) => {
    if (openEvents === application.id) { setOpenEvents(null); return }
    setOpenEvents(application.id)
    if (events[application.id]) return
    try {
      const history = await listApplicationEvents(application.id)
      setEvents(events => ({ ...events, [application.id]: history }))
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Не удалось загрузить историю') }
  }

  const confirmPayment = async (application: StaffApplication) => {
    const selected = studentId[application.id]
    if (!selected) { setError('Выберите созданный аккаунт ученика перед подтверждением оплаты.'); return }
    setSavingId(application.id)
    try {
      const updated = await confirmApplicationPayment(application.id, selected, application.course.deliveryMode === 'online' ? (accessPlans[application.id] ?? 'one_month') : 'one_month')
      setItems(items => items.map(item => item.id === updated.id ? updated : item))
      const history = await listApplicationEvents(application.id)
      setEvents(events => ({ ...events, [application.id]: history }))
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Не удалось подтвердить оплату') }
    finally { setSavingId(null) }
  }

  return (
    <main className={managerMode ? 'min-h-screen bg-[#F6F7FB] px-4 py-8 sm:px-6' : 'p-5 sm:p-8'}>
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div><p className="text-xs font-black uppercase tracking-[0.15em] text-[#1B3F92]">Ручная оплата</p><h1 className="mt-1 text-3xl font-black tracking-tight text-[#0D1E4A]">{title}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Заявка не даёт доступ автоматически: сначала свяжитесь в WhatsApp, создайте аккаунт ученика и только затем подтвердите оплату.</p></div>
          <button type="button" onClick={() => void load()} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700"><RefreshCw size={16} aria-hidden="true" />Обновить</button>
        </div>
        {error && <p role="alert" className="mt-5 rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
        {loading ? <div className="mt-8 flex justify-center py-16 text-slate-500"><LoaderCircle className="animate-spin" size={28} aria-hidden="true" /></div> : items.length === 0 ? <div className="mt-8 rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500"><ClipboardList className="mx-auto text-slate-300" size={32} aria-hidden="true" /><p className="mt-3 font-bold">Новых заявок пока нет</p></div> : <div className="mt-7 grid gap-4">{items.map(application => {
          const next = NEXT_STATUSES[application.status] ?? []
          const isSaving = savingId === application.id
          return <article key={application.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-black text-slate-400">ЗАЯВКА №{application.id} · {date(application.createdAt)}</p><h2 className="mt-1 text-xl font-black text-[#0D1E4A]">{application.applicant.name}</h2><p className="mt-1 text-sm text-slate-600">{application.applicant.city} · {application.course.name} · {application.course.deliveryMode === 'online' ? 'онлайн' : 'оффлайн'}</p></div><span className="rounded-full bg-[#EEF4FF] px-3 py-1.5 text-xs font-black text-[#1B3F92]">{STATUS_LABEL[application.status]}</span></div>
            <div className="mt-4 flex flex-wrap gap-3 text-sm"><a href={`https://wa.me/${application.applicant.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-emerald-600 px-4 font-bold text-white"><MessageCircle size={16} aria-hidden="true" />{application.applicant.phone}</a><button type="button" onClick={() => void showEvents(application)} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-4 font-bold text-slate-700"><ChevronDown size={16} aria-hidden="true" />Журнал</button></div>
            {next.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{next.map(status => <button key={status} disabled={isSaving} type="button" onClick={() => void applyStatus(application, status as Exclude<PublicApplicationStatus, 'new' | 'enrolled'>)} className="min-h-10 rounded-xl border border-[#1B3F92]/20 px-3 text-xs font-black text-[#1B3F92] disabled:opacity-50">{STATUS_LABEL[status]}</button>)}</div>}
            <div className="mt-4 flex flex-col gap-2 sm:flex-row"><input value={notes[application.id] ?? ''} onChange={event => setNotes(notes => ({ ...notes, [application.id]: event.target.value }))} maxLength={4000} placeholder="Внутренняя заметка для команды" className="min-h-11 flex-1 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-[#1B3F92]" /><button type="button" disabled={isSaving || !notes[application.id]?.trim()} onClick={() => void addNote(application)} className="min-h-11 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-700 disabled:opacity-50">Сохранить заметку</button></div>
            {canConfirm && application.status === 'awaiting_confirmation' && <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><p className="text-sm font-black text-emerald-950">Подтвердить ручную оплату</p><p className="mt-1 text-xs leading-5 text-emerald-800">Сначала создайте аккаунт ученика в разделе «Ученики». Доступ к выбранному курсу появится сразу после подтверждения.</p><div className="mt-3 flex flex-col gap-2 sm:flex-row"><select value={studentId[application.id] ?? ''} onChange={event => setStudentId(values => ({ ...values, [application.id]: event.target.value }))} className="min-h-11 flex-1 rounded-xl border border-emerald-200 bg-white px-3 text-sm"><option value="">Выберите аккаунт ученика</option>{students.filter(student => student.studentType === application.course.deliveryMode).map(student => <option key={student.id} value={student.id}>{student.fullName} · {student.email}</option>)}</select>{application.course.deliveryMode === 'online' && <select aria-label="Срок онлайн-доступа" value={accessPlans[application.id] ?? 'one_month'} onChange={event => setAccessPlans(values => ({ ...values, [application.id]: event.target.value as 'one_month' | 'three_months' | 'one_year' }))} className="min-h-11 rounded-xl border border-emerald-200 bg-white px-3 text-sm"><option value="one_month">1 месяц</option><option value="three_months">3 месяца</option><option value="one_year">1 год</option></select>}<button type="button" disabled={isSaving} onClick={() => void confirmPayment(application)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-black text-white disabled:opacity-50"><CheckCircle2 size={17} aria-hidden="true" />Подтвердить</button></div></div>}
            {openEvents === application.id && <ol className="mt-4 grid gap-2 border-t border-slate-100 pt-4">{(events[application.id] ?? []).map(event => <li key={event.id} className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600"><span className="font-black text-slate-800">{event.eventType === 'submitted' ? 'Заявка отправлена' : event.eventType === 'status_changed' ? `${STATUS_LABEL[event.fromStatus ?? 'new']} → ${STATUS_LABEL[event.toStatus ?? 'new']}` : event.eventType === 'payment_confirmed' ? 'Оплата подтверждена' : 'Заметка'}</span>{event.note && <span className="ml-1">— {event.note}</span>}<span className="ml-2 text-slate-400">{event.actorName ?? 'Гость'} · {date(event.createdAt)}</span></li>)}</ol>}
          </article>
        })}</div>}
      </div>
    </main>
  )
}
