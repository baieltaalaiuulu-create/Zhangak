'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import {
  fetchLessons,
  fetchCompletedLessonIds,
  fetchQuestionCounts,
  computeLessonStatuses,
  LESSON_SUBJECT_META,
  type Lesson,
  type LessonSubject,
} from '@/lib/lessons-data'
import { calcStreak, DEFAULT_TARGET_SCORE } from '@/lib/student-data'
import LessonsBanner from '@/components/student/LessonsBanner'
import LessonCard from '@/components/student/LessonCard'
import MobileSubjectAccordion from '@/components/student/mobile/MobileSubjectAccordion'
import MobileLessonRow from '@/components/student/mobile/MobileLessonRow'
import MobileToast from '@/components/student/mobile/MobileToast'

const MINUTES_PER_LESSON = 25
const TOAST_DURATION_MS = 2500

// Two fixed subjects — no subcategories, no filter tabs. Lessons only ever
// have subject 'math' | 'kyr' (see lib/lessons-data.ts), so this is the
// full, permanent set of sections rather than a dynamic list.
const SECTIONS: { subject: LessonSubject; label: string }[] = [
  { subject: 'math', label: '📐 Математика' },
  { subject: 'kyr', label: '📘 Кыргыз тили' },
]

export default function LessonsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set())
  const [todayLessonIds, setTodayLessonIds] = useState<Set<string>>(new Set())
  const [questionCounts, setQuestionCounts] = useState<Record<string, number>>({})
  const [streak, setStreak] = useState(0)
  const [targetScore, setTargetScore] = useState(DEFAULT_TARGET_SCORE)
  const [openMap, setOpenMap] = useState<Partial<Record<LessonSubject, boolean>>>({})
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, student_type, target_score')
        .eq('id', user.id)
        .single()

      if (!profile || profile.role !== 'student') { router.push('/login'); return }
      if (profile.student_type === 'offline') { router.push('/student'); return }

      setTargetScore(profile.target_score ?? DEFAULT_TARGET_SCORE)

      try {
        const [allLessons, completed] = await Promise.all([
          fetchLessons(),
          fetchCompletedLessonIds(user.id),
        ])
        setLessons(allLessons)
        setCompletedIds(completed)

        const [counts, { data: allResults }] = await Promise.all([
          fetchQuestionCounts(allLessons.map(l => l.id)),
          supabase
            .from('practice_results')
            .select('completed_at, lesson_id')
            .eq('student_id', user.id)
            .not('completed_at', 'is', null),
        ])
        setQuestionCounts(counts)

        const results = allResults ?? []
        setStreak(calcStreak(results.map(r => r.completed_at as string)))

        const todayStr = new Date().toISOString().slice(0, 10)
        setTodayLessonIds(new Set(
          results
            .filter(r => (r.completed_at as string)?.slice(0, 10) === todayStr)
            .map(r => r.lesson_id as string)
            .filter(Boolean)
        ))
      } catch {
        setLoadError(true)
      } finally {
        setLoading(false)
      }
    }
    checkAuth()
  }, [router])

  const showToast = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(null), TOAST_DURATION_MS)
  }

  if (loadError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#F4F6FA] px-6 text-center">
        <p className="text-sm font-semibold text-gray-600">Не удалось загрузить. Попробуй ещё раз.</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="flex min-h-11 items-center gap-1.5 rounded-xl bg-[#1B4FD8] px-5 py-2.5 text-sm font-bold text-white"
        >
          ↻ Попробовать ещё раз
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
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-[72px] animate-pulse rounded-2xl bg-white" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  const statuses = computeLessonStatuses(lessons, completedIds)
  const total = lessons.length
  const completedCount = lessons.filter(l => completedIds.has(l.id)).length

  const currentLesson = lessons.find(l => statuses[l.id] === 'current')
  const remainingToday = currentLesson && !todayLessonIds.has(currentLesson.id) ? 1 : 0

  const sections = SECTIONS.map(section => {
    const list = lessons.filter(l => l.subject === section.subject)
    const completed = list.filter(l => completedIds.has(l.id)).length
    return {
      ...section,
      list,
      completed,
      progress: list.length > 0 ? Math.round((completed / list.length) * 100) : 0,
    }
  })

  const isOpen = (subject: LessonSubject) => openMap[subject] ?? (subject === currentLesson?.subject)
  const toggleOpen = (subject: LessonSubject) => setOpenMap(prev => ({ ...prev, [subject]: !isOpen(subject) }))

  const overallPct = total > 0 ? Math.round((completedCount / total) * 100) : 0

  return (
    <div className="min-h-screen bg-[#F4F6FA]">
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        <Link href="/student/online" className="text-sm font-semibold text-gray-500 hover:text-gray-700">
          ← В кабинет
        </Link>

        {/* ============ MOBILE (< 768px) ============ */}
        <div className="block space-y-4 md:hidden">
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <h1 className="text-lg font-bold text-[#191B23]">📚 Мои уроки</h1>
            <p className="mt-1 text-sm text-gray-500">Пройдено {completedCount}/{total}</p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100">
              <div className="h-full rounded-full bg-[#1B4FD8] transition-all duration-700" style={{ width: `${overallPct}%` }} />
            </div>

            {remainingToday > 0 && currentLesson && (
              <p className="mt-3 text-sm font-semibold text-blue-700">
                Сегодня осталось: {remainingToday} урок • ~{remainingToday * MINUTES_PER_LESSON} минут
              </p>
            )}

            {currentLesson && (
              <Link
                href={`/student/online/lessons/${currentLesson.id}`}
                prefetch={true}
                className="mt-4 flex h-14 w-full items-center justify-center rounded-2xl bg-[#1B4FD8] text-base font-bold text-white"
              >
                Продолжить обучение →
              </Link>
            )}
          </div>

          {total === 0 ? (
            <div className="rounded-2xl border border-gray-100 bg-white p-10 text-center text-sm text-gray-400">
              Уроков пока нет
            </div>
          ) : (
            <div className="space-y-3">
              {sections.filter(s => s.list.length > 0).map(section => (
                <MobileSubjectAccordion
                  key={section.subject}
                  icon={LESSON_SUBJECT_META[section.subject].icon}
                  label={LESSON_SUBJECT_META[section.subject].label}
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
                      onLockedTap={() => showToast('Сначала пройди предыдущий урок')}
                    />
                  ))}
                </MobileSubjectAccordion>
              ))}
            </div>
          )}
        </div>
        <MobileToast message={toast} />

        {/* ============ DESKTOP (>= 768px) — unchanged ============ */}
        <div className="hidden md:block space-y-6">
          <LessonsBanner completed={completedCount} total={total} streak={streak} targetScore={targetScore} />

          {remainingToday > 0 && (
            <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700">
              Сегодня осталось: {remainingToday} урок · ~{remainingToday * MINUTES_PER_LESSON} минут
            </div>
          )}

          {total === 0 ? (
            <div className="rounded-2xl border border-gray-100 bg-white p-10 text-center text-sm text-gray-400">
              Уроков пока нет
            </div>
          ) : (
            <div className="space-y-10">
              {sections.filter(s => s.list.length > 0).map(section => (
                <div key={section.subject}>
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
                        questionCount={questionCounts[lesson.id] ?? 0}
                        courseProgress={section.progress}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
