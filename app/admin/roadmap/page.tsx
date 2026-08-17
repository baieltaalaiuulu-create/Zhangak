'use client'

export const dynamic = 'force-dynamic'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, ChevronDown, Circle, ListTree, LoaderCircle, Plus, RefreshCw, Trash2 } from 'lucide-react'
import AdminTopbar from '@/components/admin/AdminTopbar'
import {
  createAdminRoadmapUnit,
  getAdminCourseRoadmap,
  listAdminCourses,
  patchAdminRoadmapUnit,
  placeAdminRoadmapLesson,
  removeAdminRoadmapLesson,
  type AdminCourse,
  type AdminCourseRoadmap,
  type AdminRoadmapUnit,
} from '@/lib/admin-learning-client'

const ACCENTS: { value: AdminRoadmapUnit['accentColor']; label: string }[] = [
  { value: 'green', label: 'Зелёный' }, { value: 'blue', label: 'Синий' },
  { value: 'violet', label: 'Фиолетовый' }, { value: 'red', label: 'Красный' },
]

function errorMessage(cause: unknown): string {
  return cause instanceof Error && cause.message ? cause.message : 'Не удалось сохранить дорожную карту.'
}

export default function AdminRoadmapPage() {
  const [courses, setCourses] = useState<AdminCourse[]>([])
  const [courseId, setCourseId] = useState<number | null>(null)
  const [roadmap, setRoadmap] = useState<AdminCourseRoadmap | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [unitNumber, setUnitNumber] = useState('1')
  const [unitTitle, setUnitTitle] = useState('')
  const [accentColor, setAccentColor] = useState<AdminRoadmapUnit['accentColor']>('green')
  const [publishUnit, setPublishUnit] = useState(false)

  const selectedCourse = useMemo(() => courses.find(course => course.id === courseId) ?? null, [courses, courseId])

  const loadCourses = useCallback(async () => {
    setError('')
    try {
      const result = await listAdminCourses({ limit: 100 })
      setCourses(result.items.filter(course => course.deliveryMode === 'online'))
      setCourseId(current => result.items.some(course => course.id === current && course.deliveryMode === 'online') ? current : result.items.find(course => course.deliveryMode === 'online')?.id ?? null)
    } catch (cause) { setError(errorMessage(cause)) } finally { setLoading(false) }
  }, [])

  const loadRoadmap = useCallback(async (id: number) => {
    setError('')
    try { setRoadmap(await getAdminCourseRoadmap(id)) } catch (cause) { setError(errorMessage(cause)); setRoadmap(null) }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadCourses() }, 0)
    return () => window.clearTimeout(timer)
  }, [loadCourses])

  useEffect(() => {
    if (courseId === null) return
    const timer = window.setTimeout(() => { void loadRoadmap(courseId) }, 0)
    return () => window.clearTimeout(timer)
  }, [courseId, loadRoadmap])

  const refresh = () => { if (courseId !== null) void loadRoadmap(courseId) }

  const addUnit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (courseId === null) return
    const parsed = Number(unitNumber)
    if (!Number.isSafeInteger(parsed) || parsed < 1 || !unitTitle.trim()) { setError('Укажите номер и название раздела.'); return }
    setSaving(true); setError('')
    try {
      await createAdminRoadmapUnit(courseId, { unitNumber: parsed, title: unitTitle, accentColor, isPublished: publishUnit })
      setUnitTitle(''); setUnitNumber(String(parsed + 1)); setPublishUnit(false)
      await loadRoadmap(courseId)
    } catch (cause) { setError(errorMessage(cause)) } finally { setSaving(false) }
  }

  const togglePublication = async (unit: AdminRoadmapUnit) => {
    setSaving(true); setError('')
    try { await patchAdminRoadmapUnit(unit.id, { isPublished: !unit.isPublished }); refresh() } catch (cause) { setError(errorMessage(cause)) } finally { setSaving(false) }
  }

  const placeLesson = async (unitId: number, lessonId: number) => {
    if (!roadmap) return
    const position = Math.max(0, ...roadmap.placements.filter(item => item.unitId === unitId).map(item => item.position)) + 1
    setSaving(true); setError('')
    try { await placeAdminRoadmapLesson(unitId, lessonId, position); await loadRoadmap(roadmap.courseId) } catch (cause) { setError(errorMessage(cause)) } finally { setSaving(false) }
  }

  const removeLesson = async (unitId: number, lessonId: number) => {
    if (!roadmap || !window.confirm('Убрать урок из дорожной карты? Сам урок и его материалы сохранятся.')) return
    setSaving(true); setError('')
    try { await removeAdminRoadmapLesson(unitId, lessonId); await loadRoadmap(roadmap.courseId) } catch (cause) { setError(errorMessage(cause)) } finally { setSaving(false) }
  }

  return (
    <div className="min-h-screen bg-[#F4F6FA]">
      <AdminTopbar title="Дорожная карта" />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 lg:px-6">
        <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div><div className="flex items-center gap-2 text-[#1B3F92]"><ListTree size={21} aria-hidden="true" /><h2 className="text-lg font-black">Путь курса снизу вверх</h2></div><p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">Создайте разделы, расставьте уроки и опубликуйте их. Ученику будет виден только опубликованный порядок.</p></div>
            <button type="button" onClick={refresh} disabled={courseId === null || saving} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-600 disabled:opacity-50"><RefreshCw size={16} aria-hidden="true" /> Обновить</button>
          </div>
          <label className="mt-5 block max-w-md text-sm font-bold text-slate-700">Онлайн-курс<select value={courseId ?? ''} onChange={event => { setRoadmap(null); setCourseId(event.target.value ? Number(event.target.value) : null) }} className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium"><option value="">Выберите курс</option>{courses.map(course => <option key={course.id} value={course.id}>{course.name}</option>)}</select></label>
          {!loading && courses.length === 0 && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-800">Сначала создайте активный онлайн-курс в разделе «Уроки».</p>}
        </section>

        {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}

        {selectedCourse && (
          <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-4">
              {roadmap?.units.length === 0 && <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">В карте ещё нет разделов. Добавьте первый справа.</div>}
              {roadmap?.units.map(unit => {
                const placements = roadmap.placements.filter(item => item.unitId === unit.id)
                return <article key={unit.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Раздел {unit.unitNumber}</p><h2 className="text-base font-black text-[#191B23]">{unit.title}</h2></div><button type="button" disabled={saving} onClick={() => void togglePublication(unit)} className={`inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3 text-xs font-extrabold ${unit.isPublished ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{unit.isPublished ? <CheckCircle2 size={15} /> : <Circle size={15} />}{unit.isPublished ? 'Опубликован' : 'Черновик'}</button></div>
                  <ol className="mt-4 space-y-2">{placements.length === 0 ? <li className="rounded-xl bg-slate-50 px-3 py-3 text-sm text-slate-500">Добавьте урок из списка справа.</li> : placements.map(item => <li key={item.lessonId} className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#EAF2FF] text-xs font-black text-[#1B3F92]">{item.position}</span><span className="min-w-0 flex-1 truncate text-sm font-bold text-slate-700">{item.title}</span><button type="button" disabled={saving} onClick={() => void removeLesson(unit.id, item.lessonId)} aria-label={`Убрать ${item.title}`} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"><Trash2 size={16} aria-hidden="true" /></button></li>)}</ol>
                  {roadmap && roadmap.unassignedLessons.length > 0 && <details className="mt-4"><summary className="cursor-pointer text-sm font-bold text-[#1B3F92]">Добавить урок в этот раздел <ChevronDown className="inline" size={15} aria-hidden="true" /></summary><div className="mt-2 max-h-48 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-2">{roadmap.unassignedLessons.map(lesson => <button key={lesson.id} type="button" disabled={saving} onClick={() => void placeLesson(unit.id, lesson.id)} className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-blue-50 disabled:opacity-50"><span className="truncate"><span className="mr-2 text-xs font-black text-slate-400">{lesson.lessonNumber}</span>{lesson.title}</span><Plus size={16} className="shrink-0 text-[#1B3F92]" aria-hidden="true" /></button>)}</div></details>}
                </article>
              })}
            </div>
            <form onSubmit={event => void addUnit(event)} className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-base font-black text-[#191B23]">Новый раздел</h2><label className="mt-4 block text-xs font-bold text-slate-600">Номер<input value={unitNumber} onChange={event => setUnitNumber(event.target.value)} inputMode="numeric" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" /></label><label className="mt-3 block text-xs font-bold text-slate-600">Название<input value={unitTitle} onChange={event => setUnitTitle(event.target.value)} maxLength={200} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" placeholder="Например, Алгебра" /></label><label className="mt-3 block text-xs font-bold text-slate-600">Цвет<select value={accentColor} onChange={event => setAccentColor(event.target.value as AdminRoadmapUnit['accentColor'])} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm">{ACCENTS.map(accent => <option key={accent.value} value={accent.value}>{accent.label}</option>)}</select></label><label className="mt-3 flex items-center gap-2 text-sm font-semibold text-slate-700"><input type="checkbox" checked={publishUnit} onChange={event => setPublishUnit(event.target.checked)} /> Опубликовать сразу</label><button type="submit" disabled={saving} className="mt-5 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#1B3F92] px-4 text-sm font-bold text-white disabled:opacity-50">{saving ? <LoaderCircle className="animate-spin" size={16} /> : <Plus size={16} />} Добавить раздел</button></form>
          </section>
        )}
      </main>
    </div>
  )
}
