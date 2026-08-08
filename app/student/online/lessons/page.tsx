'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { BookOpen, Calculator, BookMarked, Brain, Eye, type LucideIcon } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  fetchLessons,
  fetchCompletedLessonIds,
  fetchQuestionCounts,
  computeLessonStatuses,
  type Lesson,
  type LessonSubject,
} from '@/lib/lessons-data'
import { calcStreak, DEFAULT_TARGET_SCORE } from '@/lib/student-data'
import LessonsBanner from '@/components/student/LessonsBanner'
import LessonCard from '@/components/student/LessonCard'

type FilterKey = 'all' | LessonSubject | 'analogy' | 'reading'

const FILTERS: { key: FilterKey; label: string; icon: LucideIcon }[] = [
  { key: 'all', label: 'Все', icon: BookOpen },
  { key: 'math', label: 'Математика', icon: Calculator },
  { key: 'kyr', label: 'Кыргыз тили', icon: BookMarked },
  { key: 'analogy', label: 'Аналогия', icon: Brain },
  { key: 'reading', label: 'Окуу', icon: Eye },
]

const MINUTES_PER_LESSON = 25

export default function LessonsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set())
  const [todayLessonIds, setTodayLessonIds] = useState<Set<string>>(new Set())
  const [questionCounts, setQuestionCounts] = useState<Record<string, number>>({})
  const [streak, setStreak] = useState(0)
  const [targetScore, setTargetScore] = useState(DEFAULT_TARGET_SCORE)
  const [filter, setFilter] = useState<FilterKey>('all')

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

      setLoading(false)
    }
    checkAuth()
  }, [router])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F4F6FA', fontFamily: 'Inter, sans-serif' }}>
        <div style={{ color: '#9CA3AF', fontSize: 14 }}>Загрузка...</div>
      </div>
    )
  }

  const statuses = computeLessonStatuses(lessons, completedIds)
  const total = lessons.length
  const completedCount = lessons.filter(l => completedIds.has(l.id)).length
  const courseProgress = total > 0 ? Math.round((completedCount / total) * 100) : 0

  const currentLesson = lessons.find(l => statuses[l.id] === 'current')
  const remainingToday = currentLesson && !todayLessonIds.has(currentLesson.id) ? 1 : 0

  const visibleLessons = lessons.filter(l => filter === 'all' || l.subject === filter)

  // Grouped-by-subject view (filter==='all' only) — each section tracks its
  // own progress instead of the combined-subjects number, since "45%"
  // across both math and kyr together doesn't tell a student how far along
  // either one actually is.
  const subjectGroups: { subject: LessonSubject; label: string; list: Lesson[]; completed: number; progress: number }[] =
    (['math', 'kyr'] as LessonSubject[]).map(subject => {
      const list = lessons.filter(l => l.subject === subject)
      const completed = list.filter(l => completedIds.has(l.id)).length
      return {
        subject,
        label: subject === 'math' ? '📐 Математика' : '📘 Кыргыз тили',
        list,
        completed,
        progress: list.length > 0 ? Math.round((completed / list.length) * 100) : 0,
      }
    })
  const singleSubjectProgress = filter === 'math' || filter === 'kyr'
    ? subjectGroups.find(g => g.subject === filter)?.progress ?? courseProgress
    : courseProgress

  return (
    <div className="min-h-screen bg-[#F4F6FA]">
      <div className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6">
        <Link href="/student/online" className="text-sm font-semibold text-gray-500 hover:text-gray-700">
          ← В кабинет
        </Link>

        <LessonsBanner completed={completedCount} total={total} streak={streak} targetScore={targetScore} />

        <div className="flex gap-2 overflow-x-auto pb-1 md:flex-wrap md:overflow-visible md:pb-0">
          {FILTERS.map(f => {
            const Icon = f.icon
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                  filter === f.key
                    ? 'bg-[#1B4FD8] text-white'
                    : 'border border-gray-100 bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Icon size={16} />
                {f.label}
              </button>
            )
          })}
        </div>

        {remainingToday > 0 && (
          <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700">
            Сегодня осталось: {remainingToday} урок · ~{remainingToday * MINUTES_PER_LESSON} минут
          </div>
        )}

        {visibleLessons.length === 0 ? (
          <div className="rounded-2xl border border-gray-100 bg-white p-10 text-center text-sm text-gray-400">
            Уроков по этому предмету пока нет
          </div>
        ) : filter === 'all' ? (
          <div className="space-y-8">
            {subjectGroups.filter(g => g.list.length > 0).map(group => (
              <div key={group.subject}>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-lg font-bold text-gray-900">{group.label}</h2>
                  <span className="text-sm font-semibold text-gray-500">{group.completed}/{group.list.length} уроков пройдено</span>
                </div>
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
                  {group.list.map(lesson => (
                    <LessonCard
                      key={lesson.id}
                      lesson={lesson}
                      status={statuses[lesson.id]}
                      questionCount={questionCounts[lesson.id] ?? 0}
                      courseProgress={group.progress}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            {visibleLessons.map(lesson => (
              <LessonCard
                key={lesson.id}
                lesson={lesson}
                status={statuses[lesson.id]}
                questionCount={questionCounts[lesson.id] ?? 0}
                courseProgress={singleSubjectProgress}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
