'use client'

export const dynamic = 'force-dynamic'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, ClipboardList, LoaderCircle, RefreshCw, Send } from 'lucide-react'

import AdminTopbar from '@/components/admin/AdminTopbar'
import { createAdminDailyChallenge, listAdminDailyChallenges, publishAdminDailyChallenge, type AdminDailyChallenge, type DailySubject } from '@/lib/admin-daily-challenges-client'
import { listAdminCoursePracticeTests, listAdminPracticeQuestions, type AdminPracticeQuestion, type AdminPracticeTest } from '@/lib/admin-assessments-client'
import { listAdminCourses, type AdminCourse } from '@/lib/admin-learning-client'

function message(cause: unknown, fallback: string): string {
  return cause instanceof Error && cause.message ? cause.message : fallback
}

function initialDate(): string {
  const current = new Date()
  return new Date(current.getTime() - current.getTimezoneOffset() * 60_000).toISOString().slice(0, 10)
}

export default function AdminDailyChallengePage() {
  const [courses, setCourses] = useState<AdminCourse[]>([])
  const [courseId, setCourseId] = useState<number | null>(null)
  const [tests, setTests] = useState<AdminPracticeTest[]>([])
  const [testId, setTestId] = useState<number | null>(null)
  const [questions, setQuestions] = useState<AdminPracticeQuestion[]>([])
  const [chosen, setChosen] = useState<number[]>([])
  const [subject, setSubject] = useState<DailySubject>('math')
  const [challengeDate, setChallengeDate] = useState(initialDate)
  const [title, setTitle] = useState('Задание дня')
  const [xpReward, setXpReward] = useState('30')
  const [isPublished, setIsPublished] = useState(false)
  const [items, setItems] = useState<AdminDailyChallenge[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const selectedCourse = useMemo(() => courses.find(course => course.id === courseId) ?? null, [courses, courseId])

  const loadCourses = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const result = await listAdminCourses({ limit: 100 })
      const online = result.items.filter(course => course.isActive && course.deliveryMode === 'online')
      setCourses(online)
      setCourseId(current => online.some(course => course.id === current) ? current : online[0]?.id ?? null)
    } catch (cause) { setError(message(cause, 'Не удалось загрузить курсы')) } finally { setLoading(false) }
  }, [])

  const loadDaily = useCallback(async (id: number | null) => {
    if (id === null) { setItems([]); return }
    try { setItems(await listAdminDailyChallenges(id)) } catch (cause) { setError(message(cause, 'Не удалось загрузить задания')) }
  }, [])

  useEffect(() => { const timer = window.setTimeout(() => { void loadCourses() }, 0); return () => window.clearTimeout(timer) }, [loadCourses])
  useEffect(() => { const timer = window.setTimeout(() => { void loadDaily(courseId) }, 0); return () => window.clearTimeout(timer) }, [courseId, loadDaily])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (courseId === null) { setTests([]); setTestId(null); setQuestions([]); return }
      void (async () => {
        try {
          const result = await listAdminCoursePracticeTests(courseId, { limit: 100 })
          const matching = result.items.filter(item => item.subject === subject && item.activeQuestionCount > 0)
          setTests(matching); setTestId(matching[0]?.id ?? null); setQuestions([]); setChosen([])
        } catch (cause) { setError(message(cause, 'Не удалось загрузить тесты')) }
      })()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [courseId, subject])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (testId === null) { setQuestions([]); return }
      void (async () => {
        try { setQuestions((await listAdminPracticeQuestions(testId, { limit: 200 })).items.filter(item => item.isActive)) } catch (cause) { setError(message(cause, 'Не удалось загрузить вопросы')) }
      })()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [testId])

  const toggle = (id: number) => setChosen(current => current.includes(id) ? current.filter(value => value !== id) : current.length === 15 ? current : [...current, id])
  const save = async () => {
    if (courseId === null || chosen.length !== 15) return
    setSaving(true); setError(''); setSuccess('')
    try {
      const challenge = await createAdminDailyChallenge({ courseId, challengeDate, title, subject, xpReward: Number(xpReward), questionIds: chosen, isPublished })
      setItems(current => [challenge, ...current]); setChosen([])
      setSuccess(isPublished ? 'Задание опубликовано.' : 'Черновик сохранён. Проверьте вопросы и опубликуйте его в списке справа.')
    } catch (cause) { setError(message(cause, 'Не удалось создать задание')) } finally { setSaving(false) }
  }
  const publishDraft = async (id: number) => {
    setSaving(true); setError(''); setSuccess('')
    try {
      const updated = await publishAdminDailyChallenge(id)
      setItems(current => current.map(item => item.id === updated.id ? updated : item)); setSuccess('Черновик опубликован.')
    } catch (cause) { setError(message(cause, 'Не удалось опубликовать черновик')) } finally { setSaving(false) }
  }

  return <div className="min-h-screen bg-[#FAF8FF]"><AdminTopbar title="Задание дня" actionLabel="Обновить" actionIcon={RefreshCw} onAction={() => { void loadCourses(); void loadDaily(courseId) }} />
    <main className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6">
      <section className="rounded-2xl border border-blue-100 bg-blue-50 p-4"><h1 className="text-base font-black text-[#0D1E4A]">Ежедневное задание: 15 вопросов и одна попытка</h1><p className="mt-1 text-sm text-slate-600">Выберите курс, дату и 15 вопросов одного предмета. После публикации задание появляется в 00:00 по Бишкеку. Звёзды: 50 / 75 / 90%.</p></section>
      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
      {success && <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{success}</p>}
      {loading ? <div className="flex min-h-40 items-center justify-center text-sm font-semibold text-gray-500"><LoaderCircle className="mr-2 animate-spin" size={18} />Загружаем данные…</div> : courses.length === 0 ? <section className="rounded-2xl border border-dashed bg-white p-8 text-center"><ClipboardList className="mx-auto text-[#1B3F92]" /><h2 className="mt-3 font-black">Сначала создайте онлайн-курс</h2><p className="mt-1 text-sm text-gray-500">Задание дня привязано к активному онлайн-курсу.</p></section> : <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]"><section className="rounded-2xl border bg-white p-5"><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-bold">Онлайн-курс<select value={courseId ?? ''} onChange={event => setCourseId(Number(event.target.value))} className="mt-1 block min-h-11 w-full rounded-xl border px-3 text-sm">{courses.map(course => <option key={course.id} value={course.id}>{course.name}</option>)}</select></label><label className="text-sm font-bold">Дата<input type="date" value={challengeDate} onChange={event => setChallengeDate(event.target.value)} className="mt-1 block min-h-11 w-full rounded-xl border px-3 text-sm" /></label><label className="text-sm font-bold">Предмет<select value={subject} onChange={event => setSubject(event.target.value as DailySubject)} className="mt-1 block min-h-11 w-full rounded-xl border px-3 text-sm"><option value="math">Математика</option><option value="kyr">Кыргыз тили</option></select></label><label className="text-sm font-bold">XP за 3 звезды<input inputMode="numeric" value={xpReward} onChange={event => setXpReward(event.target.value)} className="mt-1 block min-h-11 w-full rounded-xl border px-3 text-sm" /></label></div><label className="mt-4 block text-sm font-bold">Название<input value={title} onChange={event => setTitle(event.target.value)} maxLength={300} className="mt-1 block min-h-11 w-full rounded-xl border px-3 text-sm" /></label><label className="mt-4 block text-sm font-bold">Источник вопросов<select value={testId ?? ''} onChange={event => { setTestId(Number(event.target.value)); setChosen([]) }} className="mt-1 block min-h-11 w-full rounded-xl border px-3 text-sm"><option value="">Выберите тест</option>{tests.map(test => <option key={test.id} value={test.id}>{test.title} · {test.activeQuestionCount} вопросов</option>)}</select></label><div className="mt-5 flex items-center justify-between gap-3"><div><h2 className="font-black">Выберите 15 вопросов</h2><p className="text-sm text-gray-500">{chosen.length}/15 выбрано. Порядок одинаков для всех учеников курса.</p></div><span className={chosen.length === 15 ? 'rounded-full bg-emerald-100 px-3 py-1 text-sm font-black text-emerald-700' : 'rounded-full bg-amber-100 px-3 py-1 text-sm font-black text-amber-800'}>{chosen.length}/15</span></div><div className="mt-3 max-h-[32rem] space-y-2 overflow-y-auto pr-1">{questions.map(question => <label key={question.id} className={`flex cursor-pointer gap-3 rounded-xl border p-3 text-sm ${chosen.includes(question.id) ? 'border-[#1B3F92] bg-blue-50' : 'border-gray-200'}`}><input type="checkbox" checked={chosen.includes(question.id)} onChange={() => toggle(question.id)} disabled={!chosen.includes(question.id) && chosen.length >= 15} className="mt-0.5 h-4 w-4" /><span><b>#{question.id}</b> · {question.questionText}<small className="ml-2 text-gray-500">{question.section} · {question.difficulty}</small></span></label>)}{testId && questions.length === 0 && <p className="py-6 text-center text-sm text-gray-500">В этом тесте нет активных вопросов.</p>}</div><label className="mt-5 flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={isPublished} onChange={event => setIsPublished(event.target.checked)} />Опубликовать сразу</label><button type="button" onClick={() => void save()} disabled={saving || chosen.length !== 15 || !selectedCourse} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#1B3F92] px-5 text-sm font-bold text-white disabled:opacity-50"><Send size={16} />{saving ? 'Сохраняем…' : isPublished ? 'Опубликовать задание' : 'Сохранить черновик'}</button></section><aside className="rounded-2xl border bg-white p-5"><h2 className="font-black">Задания курса</h2><div className="mt-4 space-y-3">{items.length === 0 ? <p className="text-sm text-gray-500">Для выбранного курса заданий ещё нет.</p> : items.map(item => <article key={item.id} className="rounded-xl border p-3"><div className="flex items-center justify-between gap-2"><b className="text-sm">{item.challengeDate}</b>{item.isPublished ? <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700"><CheckCircle2 size={13} />Опубликовано</span> : <span className="text-xs font-bold text-amber-700">Черновик</span>}</div><p className="mt-1 text-sm font-semibold">{item.title}</p><p className="mt-1 text-xs text-gray-500">{item.questionCount}/15 · {item.subject === 'math' ? 'Математика' : 'Кыргыз тили'} · до {item.xpReward} XP</p>{!item.isPublished && <button type="button" disabled={saving} onClick={() => void publishDraft(item.id)} className="mt-3 min-h-9 rounded-lg border border-[#1B3F92] px-3 text-xs font-bold text-[#1B3F92] disabled:opacity-50">Опубликовать</button>}</article>)}</div></aside></div>}
    </main></div>
}
