'use client'

export const dynamic = 'force-dynamic'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { BookOpen, CheckCircle, Clock3, Play, Plus, RefreshCw } from 'lucide-react'
import AdminTopbar from '@/components/admin/AdminTopbar'
import CourseCreateModal from '@/components/admin/lessons/CourseCreateModal'
import {
  createAdminLesson,
  listAdminCourses,
  type AdminCourse,
} from '@/lib/admin-learning-client'

function optionalText(value: string): string | null {
  const normalized = value.trim()
  return normalized === '' ? null : normalized
}

function positiveInteger(value: string, label: string, max: number): number {
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > max) throw new Error(`Введите корректный ${label}`)
  return parsed
}

function displayError(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'Не удалось сохранить урок. Повторите попытку.'
}

export default function AdminNewLessonPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const requestedCourseId = searchParams.get('courseId')
  const [courses, setCourses] = useState<AdminCourse[]>([])
  const [courseId, setCourseId] = useState<number | null>(null)
  const [coursesLoading, setCoursesLoading] = useState(true)
  const [coursesError, setCoursesError] = useState('')
  const [courseCreateOpen, setCourseCreateOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [subject, setSubject] = useState('Математика')
  const [section, setSection] = useState('')
  const [topic, setTopic] = useState('')
  const [lessonNumber, setLessonNumber] = useState('1')
  const [durationMinutes, setDurationMinutes] = useState('')
  const [lessonDate, setLessonDate] = useState('')
  const [contentUrl, setContentUrl] = useState('')
  const [isTest, setIsTest] = useState(false)
  const [isPublished, setIsPublished] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const selectedCourse = useMemo(
    () => courses.find(course => course.id === courseId) ?? null,
    [courseId, courses],
  )

  const loadCourses = useCallback(async () => {
    setCoursesError('')
    setCoursesLoading(true)
    try {
      const result = await listAdminCourses({ limit: 100 })
      setCourses(result.items)
      const requested = Number(requestedCourseId)
      setCourseId(current => {
        if (Number.isSafeInteger(requested) && result.items.some(course => course.id === requested)) return requested
        if (result.items.some(course => course.id === current)) return current
        return result.items[0]?.id ?? null
      })
    } catch (cause) {
      setCoursesError(displayError(cause))
    } finally {
      setCoursesLoading(false)
    }
  }, [requestedCourseId])

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadCourses() }, 0)
    return () => window.clearTimeout(timer)
  }, [loadCourses])

  const handleCourseCreated = (course: AdminCourse) => {
    setCourses(current => [course, ...current])
    setCourseId(course.id)
  }

  const handleSave = async () => {
    setError('')
    if (courseId === null) {
      setError('Сначала выберите или создайте курс')
      return
    }
    if (!title.trim()) {
      setError('Введите название урока')
      return
    }

    setSaving(true)
    try {
      const parsedDuration = durationMinutes.trim() === ''
        ? null
        : positiveInteger(durationMinutes, 'время урока', 600)
      await createAdminLesson(courseId, {
        lessonNumber: positiveInteger(lessonNumber, 'номер урока', 10_000),
        title: title.trim(),
        description: optionalText(description),
        subject: optionalText(subject),
        section: optionalText(section),
        topic: optionalText(topic),
        lessonDate: optionalText(lessonDate),
        durationMinutes: parsedDuration,
        contentUrl: optionalText(contentUrl),
        isTest,
        isPublished,
      })
      router.replace('/admin/lessons')
    } catch (cause) {
      setError(displayError(cause))
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#FAF8FF]">
      <AdminTopbar title="Новый урок" />

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-[#191B23]">Добавьте урок в курс</h1>
            <p className="mt-1 text-sm text-gray-500">Черновик можно проверить и опубликовать позже из списка уроков.</p>
          </div>
          <button type="button" onClick={() => setCourseCreateOpen(true)} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-[#1B3F92]/20 bg-white px-4 text-sm font-bold text-[#1B3F92] hover:bg-blue-50"><Plus size={16} /> Новый курс</button>
        </div>

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-500">Курс *</label>
              {coursesLoading ? (
                <div className="h-10 animate-pulse rounded-lg bg-gray-100" />
              ) : coursesError ? (
                <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                  {coursesError}
                  <button type="button" onClick={() => void loadCourses()} className="ml-2 inline-flex items-center gap-1 text-xs font-bold underline"><RefreshCw size={12} /> Повторить</button>
                </div>
              ) : courses.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-4 text-sm text-gray-600">
                  <p>Урок нельзя добавить без курса.</p>
                  <button type="button" onClick={() => setCourseCreateOpen(true)} className="mt-2 font-bold text-[#1B3F92] hover:text-blue-700">Создать курс</button>
                </div>
              ) : (
                <select value={courseId ?? ''} onChange={event => setCourseId(Number(event.target.value))}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1B3F92]/20">
                  {courses.map(course => <option key={course.id} value={course.id}>{course.name}{course.isActive ? '' : ' (архив)'}</option>)}
                </select>
              )}
              {selectedCourse && <p className="mt-1.5 text-xs text-gray-400">{[selectedCourse.subject, selectedCourse.level].filter(Boolean).join(' · ') || 'Параметры курса не указаны'}</p>}
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-500">Название *</label>
              <input value={title} onChange={event => setTitle(event.target.value)} placeholder="Например, Квадратные уравнения"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1B3F92]/20" />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-500">Описание</label>
              <textarea value={description} onChange={event => setDescription(event.target.value)} rows={3} placeholder="Что ученик поймёт или сможет сделать после урока"
                className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1B3F92]/20" />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-500">Номер урока *</label>
                <input type="number" min={1} max={10_000} value={lessonNumber} onChange={event => setLessonNumber(event.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1B3F92]/20" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-500">Длительность, мин.</label>
                <input type="number" min={1} max={600} value={durationMinutes} onChange={event => setDurationMinutes(event.target.value)} placeholder="Например, 40"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1B3F92]/20" />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-500">Предмет</label>
                <input value={subject} onChange={event => setSubject(event.target.value)} placeholder="Математика"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1B3F92]/20" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-500">Раздел</label>
                <input value={section} onChange={event => setSection(event.target.value)} placeholder="Алгебра"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1B3F92]/20" />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-500">Тема</label>
                <input value={topic} onChange={event => setTopic(event.target.value)} placeholder="Дискриминант"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1B3F92]/20" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-500">Дата урока</label>
                <input type="date" value={lessonDate} onChange={event => setLessonDate(event.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1B3F92]/20" />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-500">Ссылка на материал</label>
              <input value={contentUrl} onChange={event => setContentUrl(event.target.value)} placeholder="https://..."
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1B3F92]/20" />
              <p className="mt-1 text-[11px] text-gray-400">Для безопасности принимаются только HTTPS-ссылки.</p>
            </div>

            <div className="flex flex-wrap gap-x-5 gap-y-2">
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-600"><input type="checkbox" checked={isTest} onChange={event => setIsTest(event.target.checked)} /> Это тестовый урок</label>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-600"><input type="checkbox" checked={isPublished} onChange={event => setIsPublished(event.target.checked)} /> Опубликовать для учеников</label>
            </div>

            {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">{error}</p>}

            <div className="flex flex-wrap gap-2 pt-2">
              <button type="button" onClick={handleSave} disabled={saving || coursesLoading || courseId === null}
                className="rounded-xl bg-[#1B3F92] px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:opacity-60">
                {saving ? 'Сохранение…' : isPublished ? 'Сохранить и опубликовать' : 'Сохранить черновик'}
              </button>
              <button type="button" onClick={() => router.push('/admin/lessons')} disabled={saving}
                className="rounded-xl bg-gray-100 px-5 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-200 disabled:opacity-60">Отмена</button>
            </div>
          </section>

          <aside className="lg:sticky lg:top-6">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Предпросмотр карточки ученика</p>
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="h-1.5 bg-[#1B3F92]" />
              <div className="space-y-4 p-5">
                <div className="flex items-center justify-between">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-sm font-bold text-blue-600">{lessonNumber || '1'}</span>
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-[#1B3F92]"><BookOpen size={18} /></span>
                </div>
                <div>
                  <h2 className="line-clamp-2 text-sm font-bold text-gray-900">{title || 'Урок без названия'}</h2>
                  <p className="mt-1 line-clamp-2 text-xs text-gray-400">{description || subject || 'Описание урока'}</p>
                </div>
                <div className="flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 w-fit"><Clock3 size={13} /> {durationMinutes ? `${durationMinutes} мин` : 'Время не указано'}</div>
                <span className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#1B3F92] py-2.5 text-sm font-bold text-white"><Play size={17} /> Начать урок</span>
              </div>
            </div>
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800">
              <CheckCircle size={15} className="mr-1 inline align-text-bottom" /> Вопросы и тесты добавляются отдельным этапом после переноса защищённого редактора заданий.
            </div>
          </aside>
        </div>
      </main>

      {courseCreateOpen && <CourseCreateModal onClose={() => setCourseCreateOpen(false)} onCreated={handleCourseCreated} />}
    </div>
  )
}
