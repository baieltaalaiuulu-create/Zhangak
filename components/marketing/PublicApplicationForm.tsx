'use client'

import { CheckCircle2, LoaderCircle, MessageCircle, Send } from 'lucide-react'
import { useEffect, useState } from 'react'

import { listPublicCourses, submitPublicApplication, type PublicCourse } from '@/lib/public-applications'

export default function PublicApplicationForm() {
  const [courses, setCourses] = useState<PublicCourse[]>([])
  const [loadingCourses, setLoadingCourses] = useState(true)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [city, setCity] = useState('Бишкек')
  const [courseId, setCourseId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<{ id: number; whatsappUrl: string } | null>(null)

  useEffect(() => {
    let active = true
    void listPublicCourses().then(items => {
      if (!active) return
      setCourses(items)
      if (items[0]) setCourseId(String(items[0].id))
    }).catch(() => {
      if (active) setError('Не удалось загрузить доступные курсы. Напишите нам в WhatsApp.')
    }).finally(() => { if (active) setLoadingCourses(false) })
    return () => { active = false }
  }, [])

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    const numericCourseId = Number(courseId)
    if (!Number.isSafeInteger(numericCourseId) || numericCourseId < 1) {
      setError('Выберите курс.')
      return
    }
    setSubmitting(true)
    try {
      const result = await submitPublicApplication({ name, phone, city, courseId: numericCourseId })
      setSuccess({ id: result.application.id, whatsappUrl: result.whatsappUrl })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось отправить заявку')
    } finally { setSubmitting(false) }
  }

  if (success) return (
    <section id="apply" className="rounded-3xl bg-white p-6 text-[#0D1E4A] shadow-2xl sm:p-8">
      <CheckCircle2 size={34} className="text-emerald-600" aria-hidden="true" />
      <h2 className="mt-4 text-2xl font-black">Заявка №{success.id} принята</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">Откройте WhatsApp: команда увидит номер заявки и уточнит курс, время и оплату.</p>
      <a href={success.whatsappUrl} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#1B3F92] px-5 text-sm font-extrabold text-white">
        <MessageCircle size={18} aria-hidden="true" />Открыть WhatsApp
      </a>
    </section>
  )

  return (
    <section id="apply" className="rounded-3xl bg-white p-5 text-[#0D1E4A] shadow-2xl sm:p-7">
      <p className="text-xs font-black uppercase tracking-[0.15em] text-[#1B3F92]">Запись на курс</p>
      <h2 className="mt-2 text-2xl font-black tracking-tight">Оставьте заявку</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">Без оплаты на сайте: менеджер подтвердит детали в WhatsApp.</p>
      <form className="mt-5 grid gap-3" onSubmit={submit}>
        <label className="grid gap-1 text-sm font-bold">Имя и фамилия<input required maxLength={200} value={name} onChange={event => setName(event.target.value)} className="min-h-11 rounded-xl border border-slate-200 px-3 text-base font-medium outline-none focus:border-[#1B3F92]" /></label>
        <label className="grid gap-1 text-sm font-bold">WhatsApp<input required inputMode="tel" maxLength={32} value={phone} onChange={event => setPhone(event.target.value)} placeholder="+996 555 123 456" className="min-h-11 rounded-xl border border-slate-200 px-3 text-base font-medium outline-none focus:border-[#1B3F92]" /></label>
        <label className="grid gap-1 text-sm font-bold">Город<input required maxLength={120} value={city} onChange={event => setCity(event.target.value)} className="min-h-11 rounded-xl border border-slate-200 px-3 text-base font-medium outline-none focus:border-[#1B3F92]" /></label>
        <label className="grid gap-1 text-sm font-bold">Курс<select required disabled={loadingCourses || courses.length === 0} value={courseId} onChange={event => setCourseId(event.target.value)} className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-base font-medium outline-none focus:border-[#1B3F92]"><option value="">{loadingCourses ? 'Загружаем…' : 'Выберите курс'}</option>{courses.map(course => <option key={course.id} value={course.id}>{course.name} · {course.deliveryMode === 'online' ? 'онлайн' : 'оффлайн'}</option>)}</select></label>
        {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p>}
        <button type="submit" disabled={submitting || loadingCourses || courses.length === 0} className="mt-1 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#E41228] px-5 text-sm font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-60"><>{submitting ? <LoaderCircle className="animate-spin" size={18} aria-hidden="true" /> : <Send size={17} aria-hidden="true" />}Отправить заявку</></button>
      </form>
      {!loadingCourses && courses.length === 0 && <p className="mt-3 text-sm text-slate-500">Набор ещё не открыт. Напишите команде в WhatsApp, чтобы узнать ближайшую дату.</p>}
    </section>
  )
}
