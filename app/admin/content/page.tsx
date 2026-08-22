'use client'

export const dynamic = 'force-dynamic'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, BookOpen, CheckCircle2, CircleAlert, ClipboardList, ExternalLink, FileText, Image as ImageIcon, LoaderCircle, PanelsTopLeft, PlayCircle, Search, Settings2 } from 'lucide-react'
import AdminTopbar from '@/components/admin/AdminTopbar'
import {
  listAdminCourses,
  listAdminLessonMaterials,
  listAdminLessons,
  type AdminCourse,
  type AdminLesson,
  type AdminLessonMaterial,
} from '@/lib/admin-learning-client'

function message(error: unknown): string {
  return error instanceof Error ? error.message : 'Не удалось загрузить учебную программу.'
}

function materialIcon(type: AdminLessonMaterial['materialType']) {
  if (type === 'video') return PlayCircle
  if (type === 'image') return ImageIcon
  if (type === 'document') return FileText
  return BookOpen
}

function materialLabel(type: AdminLessonMaterial['materialType']) {
  return ({ rich_text: 'Текст', video: 'Видео', document: 'PDF / документ', image: 'Изображение' } as const)[type]
}

export default function AdminContentStudioPage() {
  const router = useRouter()
  const [courses, setCourses] = useState<AdminCourse[]>([])
  const [courseId, setCourseId] = useState<number | null>(null)
  const [lessons, setLessons] = useState<AdminLesson[]>([])
  const [lessonId, setLessonId] = useState<number | null>(null)
  const [materials, setMaterials] = useState<AdminLessonMaterial[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadingLesson, setLoadingLesson] = useState(false)
  const [error, setError] = useState('')

  const selectedCourse = useMemo(() => courses.find(course => course.id === courseId) ?? null, [courses, courseId])
  const selectedLesson = useMemo(() => lessons.find(lesson => lesson.id === lessonId) ?? null, [lessons, lessonId])
  const filteredLessons = useMemo(() => {
    const search = query.trim().toLocaleLowerCase('ru')
    if (!search) return lessons
    return lessons.filter(lesson => [lesson.title, lesson.subject, lesson.section, lesson.topic].filter(Boolean).join(' ').toLocaleLowerCase('ru').includes(search))
  }, [lessons, query])

  const loadCourses = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const result = await listAdminCourses({ limit: 100 })
      const online = result.items.find(course => course.deliveryMode === 'online') ?? result.items[0] ?? null
      setCourses(result.items)
      setCourseId(current => result.items.some(course => course.id === current) ? current : online?.id ?? null)
    } catch (cause) {
      setError(message(cause))
    } finally {
      setLoading(false)
    }
  }, [])

  const loadCourse = useCallback(async (nextCourseId: number) => {
    setLoadingLesson(true)
    setError('')
    setMaterials([])
    try {
      const result = await listAdminLessons(nextCourseId, { limit: 100 })
      setLessons(result.items)
      setLessonId(current => result.items.some(lesson => lesson.id === current) ? current : result.items[0]?.id ?? null)
    } catch (cause) {
      setLessons([])
      setLessonId(null)
      setError(message(cause))
    } finally {
      setLoadingLesson(false)
    }
  }, [])

  const loadLesson = useCallback(async (nextLessonId: number) => {
    setLoadingLesson(true)
    setError('')
    try {
      setMaterials(await listAdminLessonMaterials(nextLessonId))
    } catch (cause) {
      setMaterials([])
      setError(message(cause))
    } finally {
      setLoadingLesson(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadCourses() }, 0)
    return () => window.clearTimeout(timer)
  }, [loadCourses])
  useEffect(() => {
    if (courseId === null) return
    const timer = window.setTimeout(() => { void loadCourse(courseId) }, 0)
    return () => window.clearTimeout(timer)
  }, [courseId, loadCourse])
  useEffect(() => {
    if (lessonId === null) return
    const timer = window.setTimeout(() => { void loadLesson(lessonId) }, 0)
    return () => window.clearTimeout(timer)
  }, [lessonId, loadLesson])

  const readiness = selectedLesson
    ? [
        { label: 'Название', ok: Boolean(selectedLesson.title.trim()) },
        { label: 'Состав урока', ok: materials.length > 0 },
        { label: 'Все файлы проверены', ok: materials.every(item => item.materialType === 'rich_text' || item.materialType === 'video' || item.scanStatus === 'clean') },
        { label: 'Есть опубликованный блок', ok: materials.some(item => item.isPublished) },
      ]
    : []
  const readyCount = readiness.filter(item => item.ok).length

  return (
    <div className="min-h-screen bg-[#F6F8FC]">
      <AdminTopbar title="Content Studio" actionLabel="Открыть старый список" actionIcon={PanelsTopLeft} onAction={() => router.push('/admin/lessons')} />
      <main className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6">
        <section className="mb-4 rounded-2xl border border-blue-100 bg-white p-4 shadow-sm sm:flex sm:items-start sm:justify-between sm:gap-5">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#1B3F92]">Единая программа</p>
            <h2 className="mt-1 text-xl font-black text-[#0D1E4A]">Собирайте урок из проверенных блоков</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">Этот рабочий экран объединяет структуру курса, состав урока и readiness-проверку. Ученик по-прежнему видит только опубликованный контент.</p>
          </div>
          {selectedCourse && <span className="mt-3 inline-flex rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-[#1B3F92] sm:mt-0">{selectedCourse.subject === 'ort' ? 'Единый курс ОРТ' : selectedCourse.name}</span>}
        </section>

        {error && <div role="alert" className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700"><AlertCircle size={17} />{error}</div>}

        <div className="grid min-h-[680px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm xl:grid-cols-[290px_minmax(0,1fr)_300px]">
          <aside className="border-b border-slate-200 bg-slate-50/60 p-3 xl:border-b-0 xl:border-r">
            <label className="block text-xs font-extrabold uppercase tracking-[0.14em] text-slate-400">Курс</label>
            <select value={courseId ?? ''} onChange={event => setCourseId(Number(event.target.value) || null)} className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-[#0D1E4A]">
              <option value="">Выберите курс</option>
              {courses.map(course => <option key={course.id} value={course.id}>{course.name}</option>)}
            </select>
            <label className="relative mt-4 block">
              <Search className="pointer-events-none absolute left-3 top-3 text-slate-400" size={16} />
              <span className="sr-only">Найти урок</span>
              <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Найти урок" className="min-h-11 w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm" />
            </label>
            <div className="mt-3 max-h-[440px] space-y-1 overflow-y-auto pr-1" aria-label="Уроки курса">
              {loading || loadingLesson ? <p className="px-3 py-6 text-center text-sm text-slate-400"><LoaderCircle className="mx-auto mb-2 animate-spin" size={18} />Загрузка…</p> : filteredLessons.map(lesson => {
                const active = lesson.id === lessonId
                return <button type="button" key={lesson.id} onClick={() => setLessonId(lesson.id)} className={`w-full rounded-xl px-3 py-2.5 text-left transition-colors ${active ? 'bg-[#1B3F92] text-white shadow-sm' : 'hover:bg-white text-slate-700'}`}>
                  <span className="flex items-center gap-2 text-xs font-extrabold"><span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${active ? 'bg-white/20' : 'bg-slate-200 text-slate-600'}`}>{lesson.lessonNumber}</span>{lesson.isPublished ? 'Опубликован' : 'Черновик'}</span>
                  <span className="mt-1 block line-clamp-2 text-sm font-bold">{lesson.title}</span>
                </button>
              })}
              {!loading && !loadingLesson && filteredLessons.length === 0 && <p className="px-3 py-6 text-center text-sm text-slate-400">Уроки не найдены.</p>}
            </div>
          </aside>

          <section className="min-w-0 p-4 sm:p-6">
            {!selectedLesson ? <div className="flex min-h-96 flex-col items-center justify-center text-center text-slate-400"><BookOpen size={32} /><p className="mt-3 text-sm font-semibold">Выберите урок в структуре курса.</p></div> : <>
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
                <div><p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#1B3F92]">Урок {selectedLesson.lessonNumber} · {selectedLesson.subject ?? 'ОРТ'}</p><h2 className="mt-1 text-xl font-black text-[#0D1E4A]">{selectedLesson.title}</h2><p className="mt-1 text-sm text-slate-500">{selectedLesson.description || 'Описание ещё не добавлено.'}</p></div>
                <div className="flex gap-2"><button type="button" onClick={() => router.push(`/admin/lessons/${selectedLesson.id}/materials`)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#1B3F92] px-4 text-sm font-bold text-white"><Settings2 size={16} /> Редактировать состав</button><button type="button" onClick={() => router.push(`/admin/lessons/${selectedLesson.id}/questions`)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-600"><ClipboardList size={16} /> Тест</button></div>
              </div>
              <div className="mt-5 space-y-3">
                {materials.map(material => { const Icon = materialIcon(material.materialType); return <article key={material.id} className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#1B3F92]"><Icon size={19} /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold text-[#0D1E4A]">{material.title}</h3><span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500">{materialLabel(material.materialType)}</span>{material.isPublished ? <span className="rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-bold text-green-700">Видно ученику</span> : <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700">Черновик</span>}</div><p className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">{material.bodyMarkdown || material.originalFilename || material.externalUrl || 'Содержимое доступно через приватную раздачу.'}</p></div><span className="text-xs font-bold text-slate-400">#{material.position}</span></div></article> })}
                {materials.length === 0 && <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center"><CircleAlert className="mx-auto text-amber-500" size={24} /><p className="mt-3 text-sm font-bold text-[#0D1E4A]">В уроке пока нет блоков</p><button type="button" onClick={() => router.push(`/admin/lessons/${selectedLesson.id}/materials`)} className="mt-3 text-sm font-bold text-[#1B3F92]">Добавить первый материал</button></div>}
              </div>
            </>}
          </section>

          <aside className="border-t border-slate-200 bg-slate-50/60 p-4 xl:border-l xl:border-t-0">
            <h2 className="text-sm font-black text-[#0D1E4A]">Готовность к публикации</h2>
            {!selectedLesson ? <p className="mt-2 text-sm text-slate-400">Выберите урок для проверки.</p> : <><p className="mt-1 text-sm text-slate-500">{readyCount} из {readiness.length} критериев выполнено.</p><ul className="mt-4 space-y-2">{readiness.map(item => <li key={item.label} className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-slate-700">{item.ok ? <CheckCircle2 size={17} className="text-green-600" /> : <CircleAlert size={17} className="text-amber-500" />}{item.label}</li>)}</ul><div className="mt-5 rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs leading-5 text-[#1B3F92]">Публикация через Content Studio станет атомарной после backend cutover: черновик, review и версия курса. Пока изменения выполняются через существующие проверенные редакторы.</div><a href={`/student/online/lessons/${selectedLesson.id}`} target="_blank" rel="noreferrer" className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-[#1B3F92] hover:underline">Предпросмотр ученика <ExternalLink size={15} /></a></>}
          </aside>
        </div>
      </main>
    </div>
  )
}
