'use client'

export const dynamic = 'force-dynamic'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Calculator,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileText,
  Languages,
  MessageCircle,
  RefreshCw,
  Shapes,
  ShieldCheck,
  Video,
} from 'lucide-react'

import { useStudentSession } from '@/components/student/StudentSessionContext'
import UpNextLesson from '@/components/student/UpNextLesson'
import LessonSidebarList from '@/components/student/LessonSidebarList'
import LessonVideo from '@/components/student/LessonVideo'
import MobileAIHelp from '@/components/student/mobile/MobileAIHelp'
import {
  PLATFORM_LESSON_SUBJECT_META,
  completePlatformLesson,
  completedPlatformLessonIds,
  computePlatformLessonStatuses,
  fetchPlatformLesson,
  fetchPlatformLessons,
  type PlatformLesson,
  type PlatformLessonSubject,
} from '@/lib/platform-lessons'
import { ZhangakApiError } from '@/lib/zhangak-api-client'
import { fetchPlatformLessonMaterials, type PlatformLessonMaterial } from '@/lib/platform-materials'

const SUBJECT_ICON = {
  math: Calculator,
  kyr: Languages,
  other: Shapes,
} satisfies Record<PlatformLessonSubject, typeof BookOpen>

function unavailableMessage(error: unknown): string {
  if (error instanceof ZhangakApiError) {
    if (error.code === 'backend_unavailable' || error.status === 503) {
      return 'Учебный сервис временно недоступен.'
    }
    return error.message
  }
  return 'Не удалось получить урок из учебного сервиса.'
}

async function requestLessonPage(lessonId: string): Promise<{ detail: PlatformLesson; catalog: PlatformLesson[] }> {
  const detail = await fetchPlatformLesson(lessonId)
  try {
    const catalog = await fetchPlatformLessons()
    return {
      detail,
      catalog: catalog.some(item => item.id === detail.id) ? catalog : [...catalog, detail],
    }
  } catch {
    return { detail, catalog: [detail] }
  }
}

function isUnavailableLesson(error: unknown): boolean {
  return (error instanceof ZhangakApiError && (error.status === 404 || error.code === 'lesson_not_found'))
    || error instanceof Error && error.message === 'Некорректный id урока'
}

export default function LessonDetailPage() {
  // StudentLayout already established the first-party HttpOnly-cookie session.
  useStudentSession()
  const params = useParams<{ id: string }>()
  const lessonId = params.id

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [lesson, setLesson] = useState<PlatformLesson | null>(null)
  const [allLessons, setAllLessons] = useState<PlatformLesson[]>([])
  const [materials, setMaterials] = useState<PlatformLessonMaterial[]>([])
  const [completionPending, setCompletionPending] = useState(false)
  const [completionError, setCompletionError] = useState<string | null>(null)

  const loadLesson = useCallback(async () => {
    try {
      const result = await requestLessonPage(lessonId)
      setLesson(result.detail)
      setAllLessons(result.catalog)
    } catch (error) {
      if (isUnavailableLesson(error)) {
        setNotFound(true)
      } else {
        setLoadError(unavailableMessage(error))
      }
    } finally {
      setLoading(false)
    }
  }, [lessonId])

  useEffect(() => {
    let active = true
    void requestLessonPage(lessonId)
      .then(result => {
        if (!active) return
        setLesson(result.detail)
        setAllLessons(result.catalog)
        // A temporary material-service error must not hide the otherwise
        // valid lesson. The lesson route remains the source of truth.
        void fetchPlatformLessonMaterials(lessonId)
          .then(items => { if (active) setMaterials(items) })
          .catch(() => { if (active) setMaterials([]) })
      })
      .catch(error => {
        if (!active) return
        if (isUnavailableLesson(error)) setNotFound(true)
        else setLoadError(unavailableMessage(error))
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [lessonId])

  const retryLoad = () => {
    setLoading(true)
    setLoadError(null)
    setNotFound(false)
    void loadLesson()
  }

  const completeLesson = useCallback(async () => {
    if (!lesson || lesson.completionMode !== 'self' || completionPending) return
    setCompletionPending(true)
    setCompletionError(null)
    try {
      const completed = await completePlatformLesson(lesson.id)
      setLesson(completed)
      // The server recalculates locks for the entire catalog. Refreshing it
      // after completion makes the newly unlocked next lesson visible without
      // ever guessing its status in the browser.
      try {
        setAllLessons(await fetchPlatformLessons())
      } catch {
        setAllLessons(previous => previous.map(item => item.id === completed.id ? completed : item))
      }
    } catch (error) {
      if (error instanceof ZhangakApiError && error.code === 'lesson_locked') {
        setCompletionError('Этот урок пока заблокирован. Обнови список уроков и заверши предыдущий.')
        return
      }
      if (error instanceof ZhangakApiError && error.code === 'lesson_requires_practice') {
        setCompletionError('Для этого урока требуется практика с серверной проверкой.')
        return
      }
      setCompletionError(unavailableMessage(error))
    } finally {
      setCompletionPending(false)
    }
  }, [completionPending, lesson])

  if (loadError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#F4F6FA] px-6 text-center">
        <BookOpen size={30} className="text-gray-400" aria-hidden="true" />
        <p className="text-sm font-semibold text-gray-700">{loadError}</p>
        <p className="max-w-sm text-xs leading-relaxed text-gray-500">
          Мы не показываем старую копию урока, потому что она может содержать неверный прогресс.
        </p>
        <button
          type="button"
          onClick={retryLoad}
          className="flex min-h-11 items-center gap-1.5 rounded-xl bg-[#1B3F92] px-5 py-2.5 text-sm font-bold text-white"
        >
          <RefreshCw size={16} aria-hidden="true" />
          Попробовать ещё раз
        </button>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F4F6FA]">
        <div className="mx-auto max-w-7xl space-y-4 px-4 py-6 sm:px-6">
          <div className="aspect-video animate-pulse rounded-2xl bg-white" />
          <div className="h-24 animate-pulse rounded-2xl bg-white" />
        </div>
      </div>
    )
  }

  if (notFound || !lesson) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#F4F6FA] p-6 text-center">
        <BookOpen size={30} className="text-gray-300" aria-hidden="true" />
        <p className="text-sm font-semibold text-gray-700">Урок не найден или не назначен твоей группе</p>
        <Link href="/student/online/lessons" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-bold text-[#1B3F92]">
          <ArrowLeft size={16} aria-hidden="true" /> Ко всем урокам
        </Link>
      </div>
    )
  }

  const catalog = [...allLessons].sort((a, b) => a.courseId - b.courseId || a.order_number - b.order_number || a.apiId - b.apiId)
  const completedIds = completedPlatformLessonIds(catalog)
  const statuses = computePlatformLessonStatuses(catalog, completedIds)
  const sameSubjectLessons = catalog.filter(item => item.courseId === lesson.courseId
    && item.subject === lesson.subject
    && (lesson.subject !== 'other' || item.sourceSubject === lesson.sourceSubject))
  const currentIndex = sameSubjectLessons.findIndex(item => item.id === lesson.id)
  const upcoming = currentIndex >= 0 ? sameSubjectLessons[currentIndex + 1] ?? null : null
  const unlockedUpcoming = upcoming && !upcoming.isLocked ? upcoming : null
  const subjectCompletedCount = sameSubjectLessons.filter(item => completedIds.has(item.id)).length
  const subjectProgress = sameSubjectLessons.length > 0
    ? Math.round((subjectCompletedCount / sameSubjectLessons.length) * 100)
    : 0
  const isCompleted = lesson.completedAt !== null || lesson.completionPercent >= 100
  const meta = PLATFORM_LESSON_SUBJECT_META[lesson.subject]
  const SubjectIcon = SUBJECT_ICON[lesson.subject]
  const subjectLabel = lesson.sourceSubject ?? meta.label
  // The lesson's own video and any video material both resolve to one
  // server-issued handle; the page never holds a watch URL.
  const videoMaterial = materials.find(item => item.materialType === 'video' && item.video !== null) ?? null
  const videoHandle = lesson.video ?? videoMaterial?.video ?? null
  const videoTitle = lesson.video ? lesson.title : videoMaterial?.title ?? lesson.title
  const practiceHref = `/student/online/practice?lesson=${lesson.id}`
  const requiresPractice = lesson.completionMode === 'practice'

  const extraMaterials = materials.filter(item => item.materialType !== 'video')

  const material = videoHandle ? (
    <LessonVideo
      handle={videoHandle}
      lessonId={lesson.apiId}
      materialId={lesson.video ? null : videoMaterial?.id ?? null}
      title={videoTitle}
    />
  ) : lesson.contentUrl ? (
    <div className="flex aspect-video flex-col items-center justify-center rounded-2xl border border-blue-100 bg-blue-50 p-6 text-center">
      <FileText size={38} className="text-[#1B3F92]" aria-hidden="true" />
      <p className="mt-3 text-sm font-bold text-gray-800">Материал урока откроется в новой вкладке</p>
      <a
        href={lesson.contentUrl}
        target="_blank"
        rel="noreferrer"
        className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#1B3F92] px-4 py-2.5 text-sm font-bold text-white"
      >
        Открыть материал <ExternalLink size={16} aria-hidden="true" />
      </a>
    </div>
  ) : extraMaterials.length > 0 ? (
    <div className="flex aspect-video flex-col items-center justify-center rounded-[22px] bg-[var(--student-brand)] px-6 text-center text-white">
      <BookOpen size={38} aria-hidden="true" />
      <p className="mt-3 text-base font-extrabold">Материалы урока готовы</p>
      <p className="mt-1 text-xs leading-5 text-white/75">Открой авторские книги и конспекты ниже.</p>
    </div>
  ) : (
    <div className="flex aspect-video flex-col items-center justify-center rounded-2xl bg-gray-900 px-6 text-center text-gray-300">
      <Video size={36} aria-hidden="true" />
      <p className="mt-3 text-sm font-semibold">Материал урока пока не опубликован</p>
      <p className="mt-1 text-xs text-gray-400">Когда преподаватель добавит материал, он появится здесь.</p>
    </div>
  )

  const materialsSection = extraMaterials.length > 0 ? (
    <section className="rounded-[22px] border border-[var(--student-line)] bg-white p-4 sm:p-6">
      <h2 className="flex items-center gap-2 text-base font-extrabold text-gray-900"><FileText size={18} aria-hidden="true" /> Материалы урока</h2>
      <p className="mt-1 text-xs leading-5 text-gray-500">Файлы открываются только внутри авторизованного кабинета.</p>
      <div className="mt-4 space-y-2.5">
        {extraMaterials.map(item => item.materialType === 'rich_text' ? (
          <article key={item.id} className="rounded-2xl bg-[var(--student-surface-2)] p-4">
            <h3 className="font-bold text-gray-800">{item.title}</h3>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-gray-700">{item.bodyMarkdown}</p>
          </article>
        ) : item.viewerPath ? (
          <a key={item.id} href={item.viewerPath} target="_blank" rel="noreferrer" className="flex min-h-14 items-center gap-3 rounded-2xl border border-[var(--student-line)] bg-white px-3.5 text-sm font-semibold text-gray-700 hover:bg-blue-50">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--student-brand-50)] text-[var(--student-brand)]"><FileText size={18} aria-hidden="true" /></span>
            <span className="min-w-0 flex-1 break-words">{item.title}</span>
            <ExternalLink size={16} className="shrink-0 text-[var(--student-brand)]" aria-hidden="true" />
          </a>
        ) : null)}
      </div>
    </section>
  ) : null

  const practiceCard = (
    <div className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#1B3F92]">
          <ShieldCheck size={21} aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-base font-bold text-gray-900">{requiresPractice ? 'Практика по уроку' : 'Завершение урока'}</h2>
          <p className="mt-1 text-xs leading-relaxed text-gray-500">
            {requiresPractice
              ? 'Доступные задания и результат проверяет учебный сервер. Ответы и баллы не вычисляются на этой странице.'
              : 'Разбери материал, затем явно отметь урок пройденным. Сервер сохранит прогресс только для твоего аккаунта.'}
          </p>
        </div>
      </div>
      {requiresPractice ? (
        <Link
          href={practiceHref}
          className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#1B3F92] px-4 text-sm font-bold text-white"
        >
          Открыть практику <ArrowRight size={17} aria-hidden="true" />
        </Link>
      ) : (
        <button
          type="button"
          onClick={() => void completeLesson()}
          disabled={isCompleted || completionPending}
          className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#1B3F92] px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-green-600"
        >
          {isCompleted ? <CheckCircle2 size={17} aria-hidden="true" /> : <ArrowRight size={17} aria-hidden="true" />}
          {isCompleted ? 'Урок пройден' : completionPending ? 'Сохраняем прогресс…' : 'Завершить урок'}
        </button>
      )}
      {completionError && <p role="alert" className="mt-3 text-xs font-medium text-red-600">{completionError}</p>}
    </div>
  )

  return (
    <div className="min-h-screen bg-[var(--student-bg)] pb-24 md:pb-0">
      <div className="block md:hidden">
        <div className="flex items-center gap-3 border-b border-gray-100 bg-white px-4 py-3">
          <Link href="/student/online/lessons" className="flex min-h-11 shrink-0 items-center gap-1 text-sm font-bold text-gray-600">
            <ArrowLeft size={16} aria-hidden="true" /> Уроки
          </Link>
          <p className="min-w-0 flex-1 truncate text-center text-xs font-semibold text-gray-400">
            {subjectLabel}{currentIndex >= 0 ? ` · Урок ${currentIndex + 1} из ${sameSubjectLessons.length}` : ''}
          </p>
          <div className="w-14 shrink-0" aria-hidden="true" />
        </div>

        {isCompleted && (
          <div className="mx-4 mt-3 flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 p-3">
            <CheckCircle2 size={20} className="text-green-600" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-green-700">Урок пройден</p>
              <p className="text-xs text-green-600">Прогресс подтверждён учебным сервером</p>
            </div>
          </div>
        )}

        <div className="space-y-4 px-4 py-4">
          <div>
            <div className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${meta.bg} ${meta.color}`}>
              <SubjectIcon size={14} aria-hidden="true" /> {subjectLabel}
            </div>
            <h1 className="mt-3 text-xl font-bold leading-snug text-[#191B23]">{lesson.title}</h1>
            {lesson.description && <p className="mt-2 text-sm leading-relaxed text-gray-600">{lesson.description}</p>}
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-gray-500">
              <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1.5">
                <Clock3 size={13} aria-hidden="true" /> {lesson.durationMinutes ? `${lesson.durationMinutes} минут` : 'Время не указано'}
              </span>
              {lesson.topic && <span className="rounded-full bg-white px-2.5 py-1.5">{lesson.topic}</span>}
            </div>
          </div>

          {material}

          {materialsSection}
          <MobileAIHelp lessonTitle={lesson.title} />
          {practiceCard}

          {unlockedUpcoming && (
            <Link
              href={`/student/online/lessons/${unlockedUpcoming.id}`}
              className="flex min-h-12 items-center justify-between rounded-2xl border border-gray-100 bg-white px-4 text-sm font-bold text-gray-700 shadow-sm"
            >
              Следующий урок: {unlockedUpcoming.title}
              <ArrowRight size={17} className="shrink-0 text-[#1B3F92]" aria-hidden="true" />
            </Link>
          )}

          <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <p className="flex items-center gap-2 text-sm font-bold text-gray-800">
              <MessageCircle size={17} aria-hidden="true" /> Вопрос учителю
            </p>
            <p className="mt-1 text-xs leading-relaxed text-gray-500">Отправка вопросов появится после подключения чата с преподавателем.</p>
          </div>
        </div>
      </div>

      <div className="hidden md:block">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
          <Link href="/student/online/lessons" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-gray-700">
            <ArrowLeft size={16} aria-hidden="true" /> Ко всем урокам
          </Link>

          <div className="mt-4 flex flex-col items-start gap-5 lg:flex-row">
            <main className="w-full min-w-0 flex-1 space-y-5">
              {material}

              <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${meta.bg} ${meta.color}`}>
                    <SubjectIcon size={14} aria-hidden="true" /> {subjectLabel}
                  </span>
                  {isCompleted && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
                      <CheckCircle2 size={14} aria-hidden="true" /> Пройдено
                    </span>
                  )}
                </div>
                <h1 className="mt-3 text-2xl font-bold leading-snug text-gray-900">{lesson.title}</h1>
                {lesson.description && <p className="mt-3 text-sm leading-relaxed text-gray-600">{lesson.description}</p>}
                <div className="mt-5 flex flex-wrap gap-2 text-xs font-semibold text-gray-500">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-50 px-3 py-1.5">
                    <Clock3 size={14} aria-hidden="true" /> {lesson.durationMinutes ? `${lesson.durationMinutes} минут` : 'Время не указано'}
                  </span>
                  <span className="rounded-full bg-gray-50 px-3 py-1.5">Урок {lesson.order_number}</span>
                  {lesson.section && <span className="rounded-full bg-gray-50 px-3 py-1.5">{lesson.section}</span>}
                  {lesson.topic && <span className="rounded-full bg-gray-50 px-3 py-1.5">{lesson.topic}</span>}
                </div>
              </div>

              {practiceCard}

              {materialsSection}
            </main>

            <aside className="w-full shrink-0 space-y-5 lg:w-80">
              <UpNextLesson lesson={unlockedUpcoming} progress={subjectProgress} />

              <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                <h2 className="flex items-center gap-2 text-sm font-bold text-gray-900"><FileText size={17} aria-hidden="true" /> Материалы</h2>
                {lesson.contentUrl ? (
                  <a
                    href={lesson.contentUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 flex min-h-11 items-center justify-between rounded-xl bg-gray-50 px-3 text-sm font-semibold text-gray-700"
                  >
                    Открыть материал <ExternalLink size={15} aria-hidden="true" />
                  </a>
                ) : (
                  <p className="mt-2 text-xs leading-relaxed text-gray-500">Дополнительные материалы пока не опубликованы.</p>
                )}
              </div>

              <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                <h2 className="flex items-center gap-2 text-sm font-bold text-gray-900"><MessageCircle size={17} aria-hidden="true" /> Вопрос учителю</h2>
                <p className="mt-2 text-xs leading-relaxed text-gray-500">Отправка вопросов появится после подключения чата с преподавателем.</p>
              </div>

              {requiresPractice && (
                <Link
                  href={practiceHref}
                  className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#1B3F92] px-4 text-sm font-bold text-white shadow-md shadow-blue-200"
                >
                  Открыть практику <ArrowRight size={17} aria-hidden="true" />
                </Link>
              )}

              <LessonSidebarList lessons={catalog} statuses={statuses} activeId={lesson.id} />
            </aside>
          </div>
        </div>
      </div>
    </div>
  )
}
