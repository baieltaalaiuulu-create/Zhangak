'use client'

export const dynamic = 'force-dynamic'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BookOpen, CheckCircle, Circle, ExternalLink, ListChecks, Pencil, Plus, RefreshCw } from 'lucide-react'
import AdminTopbar from '@/components/admin/AdminTopbar'
import CourseCreateModal from '@/components/admin/lessons/CourseCreateModal'
import CourseEditModal from '@/components/admin/lessons/CourseEditModal'
import LessonEditModal from '@/components/admin/lessons/LessonEditModal'
import {
  listAdminCourses,
  listAdminLessons,
  type AdminCourse,
  type AdminLesson,
} from '@/lib/admin-learning-client'

function displayError(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'Не удалось загрузить учебный контент. Повторите попытку.'
}

function dateLabel(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

function courseMeta(course: AdminCourse): string {
  return [course.subject, course.level].filter((value): value is string => Boolean(value)).join(' · ') || 'Параметры не указаны'
}

export default function AdminLessonsPage() {
  const router = useRouter()
  const [courses, setCourses] = useState<AdminCourse[]>([])
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null)
  const [lessons, setLessons] = useState<AdminLesson[]>([])
  const [coursesLoading, setCoursesLoading] = useState(true)
  const [lessonsLoading, setLessonsLoading] = useState(false)
  const [courseError, setCourseError] = useState('')
  const [lessonError, setLessonError] = useState('')
  const [courseCreateOpen, setCourseCreateOpen] = useState(false)
  const [courseEditTarget, setCourseEditTarget] = useState<AdminCourse | null>(null)
  const [editTarget, setEditTarget] = useState<AdminLesson | null>(null)
  const lessonRequest = useRef(0)

  const selectedCourse = useMemo(
    () => courses.find(course => course.id === selectedCourseId) ?? null,
    [courses, selectedCourseId],
  )

  const loadCourses = useCallback(async () => {
    setCourseError('')
    try {
      const result = await listAdminCourses({ limit: 100 })
      setCourses(result.items)
      setSelectedCourseId(current => result.items.some(course => course.id === current)
        ? current
        : result.items[0]?.id ?? null)
    } catch (cause) {
      setCourseError(displayError(cause))
    } finally {
      setCoursesLoading(false)
    }
  }, [])

  const loadLessons = useCallback(async (courseId: number) => {
    const requestId = lessonRequest.current + 1
    lessonRequest.current = requestId
    setLessonsLoading(true)
    setLessonError('')
    try {
      const result = await listAdminLessons(courseId, { limit: 100 })
      if (lessonRequest.current !== requestId) return
      setLessons(result.items)
    } catch (cause) {
      if (lessonRequest.current !== requestId) return
      setLessons([])
      setLessonError(displayError(cause))
    } finally {
      if (lessonRequest.current === requestId) setLessonsLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadCourses() }, 0)
    return () => window.clearTimeout(timer)
  }, [loadCourses])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (selectedCourseId === null) {
        lessonRequest.current += 1
        setLessons([])
        setLessonError('')
        setLessonsLoading(false)
        return
      }
      void loadLessons(selectedCourseId)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [loadLessons, selectedCourseId])

  const openNewLesson = () => {
    if (selectedCourseId === null) {
      setCourseCreateOpen(true)
      return
    }
    router.push(`/admin/lessons/new?courseId=${selectedCourseId}`)
  }

  const handleCourseCreated = (course: AdminCourse) => {
    setCourses(current => [course, ...current])
    setSelectedCourseId(course.id)
    setLessons([])
  }

  const handleLessonSaved = () => {
    if (selectedCourseId !== null) void loadLessons(selectedCourseId)
    void loadCourses()
  }

  const handleCourseSaved = (course: AdminCourse) => {
    setCourses(current => current.map(item => item.id === course.id ? course : item))
  }

  const retry = () => {
    setCoursesLoading(true)
    void loadCourses()
  }

  return (
    <div className="min-h-screen bg-[#FAF8FF]">
      <AdminTopbar title="Учебный контент" actionLabel="Новый урок" actionIcon={Plus} onAction={openNewLesson} />

      <main className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6">
        <section className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4 sm:flex sm:items-center sm:justify-between sm:gap-5">
          <div>
            <h2 className="text-sm font-bold text-[#0D1E4A]">Курсы и уроки работают через backend Zhangak</h2>
            <p className="mt-1 max-w-3xl text-sm leading-5 text-slate-600">Создайте курс, добавьте материалы и публикуйте только готовые уроки. Редактор тестовых вопросов переносится отдельно, поэтому количество вопросов здесь намеренно не показывается.</p>
          </div>
          <button type="button" onClick={() => setCourseCreateOpen(true)}
            className="mt-3 inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl border border-[#1B4FD8]/20 bg-white px-4 text-sm font-bold text-[#1B4FD8] hover:bg-blue-50 sm:mt-0">
            <Plus size={16} aria-hidden="true" /> Создать курс
          </button>
        </section>

        {courseError && (
          <section role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            <span>{courseError}</span>
            <button type="button" onClick={retry} className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-100"><RefreshCw size={14} /> Повторить</button>
          </section>
        )}

        <section aria-labelledby="courses-heading">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 id="courses-heading" className="text-base font-bold text-[#191B23]">Курсы</h2>
              <p className="mt-0.5 text-sm text-gray-400">Выберите курс, чтобы увидеть его уроки.</p>
            </div>
            {!coursesLoading && <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-gray-500">{courses.length}</span>}
          </div>

          {coursesLoading ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => <div key={index} className="h-32 animate-pulse rounded-2xl border border-gray-200 bg-white" />)}
            </div>
          ) : courses.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-5 py-9 text-center">
              <BookOpen size={24} className="mx-auto text-[#1B4FD8]" aria-hidden="true" />
              <h3 className="mt-3 text-sm font-bold text-[#191B23]">Курсов пока нет</h3>
              <p className="mt-1 text-sm text-gray-500">Первый курс задаст структуру для уроков и будущих групп.</p>
              <button type="button" onClick={() => setCourseCreateOpen(true)} className="mt-4 rounded-xl bg-[#1B4FD8] px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700">Создать первый курс</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {courses.map(course => {
                const selected = course.id === selectedCourseId
                return (
                  <button key={course.id} type="button" onClick={() => setSelectedCourseId(course.id)}
                    className={`min-h-32 rounded-2xl border p-4 text-left transition-colors ${selected ? 'border-[#1B4FD8] bg-[#EEF2FF] shadow-sm' : 'border-gray-200 bg-white hover:border-[#1B4FD8]/40 hover:bg-blue-50/30'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${selected ? 'bg-[#1B4FD8] text-white' : 'bg-blue-50 text-[#1B4FD8]'}`}><BookOpen size={18} aria-hidden="true" /></span>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold ${course.isActive ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {course.isActive ? <CheckCircle size={12} aria-hidden="true" /> : <Circle size={12} aria-hidden="true" />}
                        {course.isActive ? 'Активен' : 'Архив'}
                      </span>
                    </div>
                    <h3 className="mt-3 line-clamp-2 text-sm font-bold text-[#191B23]">{course.name}</h3>
                    <p className="mt-1 truncate text-xs text-gray-500">{courseMeta(course)}</p>
                    <p className="mt-3 text-xs font-semibold text-[#1B4FD8]">{course.lessonCount} {course.lessonCount === 1 ? 'урок' : course.lessonCount >= 2 && course.lessonCount <= 4 ? 'урока' : 'уроков'}</p>
                  </button>
                )
              })}
            </div>
          )}
        </section>

        <section aria-labelledby="lessons-heading" className="rounded-2xl border border-gray-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-4 py-4 sm:px-5">
            <div>
              <h2 id="lessons-heading" className="text-base font-bold text-[#191B23]">{selectedCourse ? `Уроки: ${selectedCourse.name}` : 'Уроки'}</h2>
              <p className="mt-0.5 text-sm text-gray-400">{selectedCourse ? 'Черновики не видны ученикам; публикацию можно изменить в редакторе.' : 'Выберите курс выше.'}</p>
            </div>
            {selectedCourse && (
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => setCourseEditTarget(selectedCourse)} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-4 text-sm font-bold text-gray-600 hover:bg-gray-50"><Pencil size={15} /> Настроить курс</button>
                <button type="button" onClick={openNewLesson} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-[#1B4FD8] px-4 text-sm font-bold text-white hover:bg-blue-700"><Plus size={16} /> Добавить урок</button>
              </div>
            )}
          </div>

          {selectedCourseId === null ? (
            <div className="px-5 py-10 text-center text-sm text-gray-400">После создания курса здесь появится его программа.</div>
          ) : lessonsLoading ? (
            <div className="px-5 py-10 text-center text-sm text-gray-400">Загрузка уроков…</div>
          ) : lessonError ? (
            <div role="alert" className="px-5 py-8 text-center">
              <p className="text-sm font-semibold text-red-600">{lessonError}</p>
              <button type="button" onClick={() => void loadLessons(selectedCourseId)} className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-100"><RefreshCw size={14} /> Повторить</button>
            </div>
          ) : lessons.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <BookOpen size={22} className="mx-auto text-[#1B4FD8]" aria-hidden="true" />
              <p className="mt-3 text-sm font-bold text-[#191B23]">В этом курсе пока нет уроков</p>
              <button type="button" onClick={openNewLesson} className="mt-3 text-sm font-bold text-[#1B4FD8] hover:text-blue-700">Добавить первый урок</button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="w-16 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">№</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Урок</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Материал</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Статус</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Обновлён</th>
                    <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-400">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {lessons.map(lesson => (
                    <tr key={lesson.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                      <td className="px-4 py-3 font-bold text-gray-400">{lesson.lessonNumber}</td>
                      <td className="px-3 py-3">
                        <p className="font-semibold text-[#191B23]">{lesson.title}</p>
                        <p className="mt-0.5 line-clamp-1 text-xs text-gray-400">{[lesson.subject, lesson.section, lesson.topic].filter(Boolean).join(' · ') || 'Детали не указаны'}</p>
                      </td>
                      <td className="px-3 py-3">
                        {lesson.contentUrl ? <a href={lesson.contentUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-bold text-[#1B4FD8] hover:text-blue-700"><ExternalLink size={13} /> Открыть</a> : <span className="text-xs text-gray-400">Не добавлен</span>}
                      </td>
                      <td className="px-3 py-3">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${lesson.isPublished ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{lesson.isPublished ? 'Опубликован' : 'Черновик'}</span>
                      </td>
                      <td className="px-3 py-3 text-xs text-gray-400">{dateLabel(lesson.updatedAt)}</td>
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button type="button" onClick={() => router.push(`/admin/lessons/${lesson.id}/questions`)} aria-label={`Статус вопросов урока ${lesson.title}`} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-[#1B4FD8]"><ListChecks size={15} /></button>
                          <button type="button" onClick={() => setEditTarget(lesson)} aria-label={`Редактировать урок ${lesson.title}`} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-[#1B4FD8]"><Pencil size={15} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      {courseCreateOpen && <CourseCreateModal onClose={() => setCourseCreateOpen(false)} onCreated={handleCourseCreated} />}
      {courseEditTarget && <CourseEditModal course={courseEditTarget} onClose={() => setCourseEditTarget(null)} onSaved={handleCourseSaved} />}
      {editTarget && <LessonEditModal lesson={editTarget} onClose={() => setEditTarget(null)} onSaved={handleLessonSaved} />}
    </div>
  )
}
