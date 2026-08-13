'use client'

export const dynamic = 'force-dynamic'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Calculator,
  Flame,
  Languages,
  RefreshCw,
  Shapes,
  Target,
} from 'lucide-react'

import { useStudentSession } from '@/components/student/StudentSessionContext'
import LessonCard from '@/components/student/LessonCard'
import MobileSubjectAccordion from '@/components/student/mobile/MobileSubjectAccordion'
import MobileLessonRow from '@/components/student/mobile/MobileLessonRow'
import MobileToast from '@/components/student/mobile/MobileToast'
import {
  PLATFORM_LESSON_SUBJECT_META,
  completedPlatformLessonIds,
  computePlatformLessonStatuses,
  fetchPlatformLessons,
  platformLessonCompletionStreak,
  platformLocalDayKey,
  type PlatformLesson,
  type PlatformLessonSubject,
} from '@/lib/platform-lessons'

const TOAST_DURATION_MS = 2500

const SECTIONS: { subject: PlatformLessonSubject; label: string }[] = [
  { subject: 'math', label: 'Математика' },
  { subject: 'kyr', label: 'Кыргыз тили' },
  { subject: 'other', label: 'Другие предметы' },
]

const SECTION_ICON = {
  math: Calculator,
  kyr: Languages,
  other: Shapes,
} satisfies Record<PlatformLessonSubject, typeof BookOpen>

export default function LessonsPage() {
  const user = useStudentSession()
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [lessons, setLessons] = useState<PlatformLesson[]>([])
  const [openMap, setOpenMap] = useState<Partial<Record<PlatformLessonSubject, boolean>>>({})
  const [toast, setToast] = useState<string | null>(null)

  const loadLessons = useCallback(async () => {
    try {
      setLessons(await fetchPlatformLessons())
    } catch {
      setLoadError('Не удалось получить уроки из учебного сервиса.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    void fetchPlatformLessons()
      .then(items => { if (active) setLessons(items) })
      .catch(() => { if (active) setLoadError('Не удалось получить уроки из учебного сервиса.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const retryLoad = () => {
    setLoading(true)
    setLoadError(null)
    void loadLessons()
  }

  const showToast = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(null), TOAST_DURATION_MS)
  }

  if (loadError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#F4F6FA] px-6 text-center">
        <BookOpen size={30} className="text-gray-400" aria-hidden="true" />
        <p className="text-sm font-semibold text-gray-700">{loadError}</p>
        <p className="max-w-sm text-xs leading-relaxed text-gray-500">
          Прогресс не подменён локальными данными. Проверь подключение и попробуй снова.
        </p>
        <button
          type="button"
          onClick={retryLoad}
          className="flex min-h-11 items-center gap-1.5 rounded-xl bg-[#1B4FD8] px-5 py-2.5 text-sm font-bold text-white"
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
          <div className="h-24 animate-pulse rounded-2xl bg-white" />
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-[72px] animate-pulse rounded-2xl bg-white" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  const completedIds = completedPlatformLessonIds(lessons)
  const statuses = computePlatformLessonStatuses(lessons, completedIds)
  const completedCount = completedIds.size
  const total = lessons.length
  const overallPct = total > 0 ? Math.round((completedCount / total) * 100) : 0
  const streak = platformLessonCompletionStreak(lessons)
  const currentLesson = lessons.find(lesson => statuses[lesson.id] === 'current')
  const todayKey = platformLocalDayKey(new Date())
  const completedToday = new Set(
    lessons
      .filter(lesson => lesson.completedAt && platformLocalDayKey(lesson.completedAt) === todayKey)
      .map(lesson => lesson.id),
  )
  const remainingToday = currentLesson && !completedToday.has(currentLesson.id) ? 1 : 0

  const sections = SECTIONS.map(section => {
    const list = lessons.filter(lesson => lesson.subject === section.subject)
    const completed = list.filter(lesson => completedIds.has(lesson.id)).length
    return {
      ...section,
      list,
      completed,
      progress: list.length > 0 ? Math.round((completed / list.length) * 100) : 0,
    }
  })

  const isOpen = (subject: PlatformLessonSubject) => openMap[subject] ?? (subject === currentLesson?.subject)
  const toggleOpen = (subject: PlatformLessonSubject) => {
    setOpenMap(previous => ({ ...previous, [subject]: !isOpen(subject) }))
  }

  const emptyState = (
    <div className="rounded-2xl border border-gray-100 bg-white p-10 text-center shadow-sm">
      <BookOpen size={30} className="mx-auto text-gray-300" aria-hidden="true" />
      <p className="mt-3 text-sm font-bold text-gray-700">Для твоей группы пока нет опубликованных уроков</p>
      <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-gray-500">
        Здесь появятся только назначенные и опубликованные материалы. Можно вернуться на главную и проверить позже.
      </p>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#F4F6FA]">
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        <Link href="/student/online" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-gray-700">
          <ArrowLeft size={16} aria-hidden="true" />
          На главную
        </Link>

        <div className="block space-y-4 md:hidden">
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <BookOpen size={22} className="text-[#1B4FD8]" aria-hidden="true" />
              <h1 className="text-lg font-bold text-[#191B23]">Мои уроки</h1>
            </div>
            <p className="mt-1 text-sm text-gray-500">Пройдено {completedCount}/{total}</p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100">
              <div className="h-full rounded-full bg-[#1B4FD8] transition-all duration-700" style={{ width: `${overallPct}%` }} />
            </div>

            {remainingToday > 0 && currentLesson && (
              <p className="mt-3 text-sm font-semibold text-blue-700">
                Следующий шаг сегодня: урок {currentLesson.order_number}
                {currentLesson.durationMinutes ? ` · ${currentLesson.durationMinutes} минут` : ''}
              </p>
            )}

            {currentLesson && (
              <Link
                href={`/student/online/lessons/${currentLesson.id}`}
                prefetch
                className="mt-4 flex h-14 w-full items-center justify-center rounded-2xl bg-[#1B4FD8] text-base font-bold text-white"
              >
                Продолжить обучение
                <ArrowRight size={19} className="ml-2" aria-hidden="true" />
              </Link>
            )}
          </div>

          {total === 0 ? emptyState : (
            <div className="space-y-3">
              {sections.filter(section => section.list.length > 0).map(section => {
                const SectionIcon = SECTION_ICON[section.subject]
                return (
                  <MobileSubjectAccordion
                    key={section.subject}
                    icon={<SectionIcon size={21} aria-hidden="true" />}
                    label={PLATFORM_LESSON_SUBJECT_META[section.subject].label}
                    completed={section.completed}
                    total={section.list.length}
                    open={isOpen(section.subject)}
                    onToggle={() => toggleOpen(section.subject)}
                  >
                    {section.list.map(lesson => (
                      <MobileLessonRow
                        key={lesson.id}
                        lesson={lesson}
                        status={statuses[lesson.id]}
                        onLockedTap={() => showToast('Сначала заверши предыдущий урок этого предмета')}
                      />
                    ))}
                  </MobileSubjectAccordion>
                )
              })}
            </div>
          )}
        </div>
        <MobileToast message={toast} />

        <div className="hidden space-y-6 md:block">
          <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <BookOpen size={22} className="text-[#1B4FD8]" aria-hidden="true" />
                  <h1 className="text-xl font-bold text-gray-900">Мои уроки</h1>
                </div>
                <p className="mt-1 text-sm text-gray-500">Пройдено {completedCount} из {total} уроков</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {streak > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-50 px-3 py-1.5 text-sm font-semibold text-orange-600">
                    <Flame size={15} aria-hidden="true" /> {streak} дней подряд
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-700">
                  <Target size={15} aria-hidden="true" /> Цель: {user.targetScore ?? 200} баллов
                </span>
              </div>
            </div>
            <div className="mt-4">
              <div className="mb-1.5 flex justify-between text-xs font-semibold text-gray-500">
                <span>Общий прогресс</span><span>{overallPct}%</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-gray-100">
                <div className="h-full rounded-full bg-[#1B4FD8] transition-all duration-700" style={{ width: `${overallPct}%` }} />
              </div>
            </div>
          </div>

          {remainingToday > 0 && currentLesson && (
            <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700">
              Следующий шаг: урок {currentLesson.order_number}
              {currentLesson.durationMinutes ? ` · ${currentLesson.durationMinutes} минут` : ''}
            </div>
          )}

          {total === 0 ? emptyState : (
            <div className="space-y-10">
              {sections.filter(section => section.list.length > 0).map(section => (
                <section key={section.subject}>
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-lg font-bold text-gray-900">{section.label}</h2>
                    <span className="text-sm font-semibold text-gray-500">{section.completed}/{section.list.length} уроков пройдено</span>
                  </div>
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {section.list.map(lesson => (
                      <LessonCard
                        key={lesson.id}
                        lesson={lesson}
                        status={statuses[lesson.id]}
                        questionCount={0}
                        courseProgress={section.progress}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
