'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import {
  fetchLessons,
  fetchLessonById,
  fetchCompletedLessonIds,
  computeLessonStatuses,
  markLessonStarted,
  LESSON_SUBJECT_META,
  type Lesson,
} from '@/lib/lessons-data'
import UpNextLesson from '@/components/student/UpNextLesson'
import LessonSidebarList from '@/components/student/LessonSidebarList'

function getYoutubeEmbed(url: string): string {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/)
  return match ? `https://www.youtube.com/embed/${match[1]}` : url
}

const STEPS = ['Теория', 'Пример', 'Тренажёр', 'Мини-тест']

const MATERIALS = [
  { icon: '📄', label: 'Конспект' },
  { icon: '🧮', label: 'Формулы' },
  { icon: '✏️', label: 'ДЗ' },
]

export default function LessonDetailPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const lessonId = params.id

  const [loading, setLoading] = useState(true)
  const [lesson, setLesson] = useState<Lesson | null>(null)
  const [allLessons, setAllLessons] = useState<Lesson[]>([])
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set())
  const [askText, setAskText] = useState('')
  const [askSent, setAskSent] = useState(false)
  const startedRef = useRef(false)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, student_type')
        .eq('id', user.id)
        .single()

      if (!profile || profile.role !== 'student') { router.push('/login'); return }
      if (profile.student_type === 'offline') { router.push('/student'); return }

      const [thisLesson, lessons, completed] = await Promise.all([
        fetchLessonById(lessonId),
        fetchLessons(),
        fetchCompletedLessonIds(user.id),
      ])

      setLesson(thisLesson)
      setAllLessons(lessons)
      setCompletedIds(completed)
      setLoading(false)

      if (thisLesson && !startedRef.current) {
        startedRef.current = true
        markLessonStarted(user.id, thisLesson.id)
      }
    }
    load()
  }, [router, lessonId])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F4F6FA', fontFamily: 'Inter, sans-serif' }}>
        <div style={{ color: '#9CA3AF', fontSize: 14 }}>Загрузка...</div>
      </div>
    )
  }

  if (!lesson) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#F4F6FA] p-6">
        <p className="text-sm font-semibold text-gray-600">Урок не найден</p>
        <Link href="/student/online/lessons" className="text-sm font-bold text-[#1B4FD8]">
          ← Ко всем урокам
        </Link>
      </div>
    )
  }

  const statuses = computeLessonStatuses(allLessons, completedIds)

  // Scoped to the same subject — otherwise "next lesson" could jump from a
  // math lesson straight into Кыргыз тили just because that's the next row
  // in the combined, subject-sorted list.
  const sameSubjectLessons = allLessons.filter(l => l.subject === lesson.subject)
  const currentIndex = sameSubjectLessons.findIndex(l => l.id === lesson.id)
  const upcoming = currentIndex >= 0 ? sameSubjectLessons[currentIndex + 1] ?? null : null
  const subjectCompletedCount = sameSubjectLessons.filter(l => completedIds.has(l.id)).length
  const subjectProgress = sameSubjectLessons.length > 0 ? Math.round((subjectCompletedCount / sameSubjectLessons.length) * 100) : 0

  const meta = LESSON_SUBJECT_META[lesson.subject]
  const embedUrl = lesson.video_url ? getYoutubeEmbed(lesson.video_url) : null

  const handleAskSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!askText.trim()) return
    setAskSent(true)
    setAskText('')
    window.setTimeout(() => setAskSent(false), 4000)
  }

  return (
    <div className="min-h-screen bg-[#F4F6FA]">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <Link href="/student/online/lessons" className="text-sm font-semibold text-gray-500 hover:text-gray-700">
          ← Ко всем урокам
        </Link>

        <div className="mt-4 flex flex-col items-start gap-5 lg:flex-row">
          {/* Main column */}
          <div className="w-full min-w-0 flex-1 space-y-5">
            {/* Video */}
            <div className="flex aspect-video items-center justify-center overflow-hidden rounded-2xl bg-gray-900">
              {embedUrl ? (
                <iframe
                  src={embedUrl}
                  className="h-full w-full"
                  allowFullScreen
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  title={lesson.title}
                />
              ) : (
                <div className="text-center text-gray-400">
                  <div className="mb-2 text-4xl">🎬</div>
                  <p className="text-sm">Видео скоро появится</p>
                </div>
              )}
            </div>

            {/* Title block */}
            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${meta.bg} ${meta.color}`}>
                {meta.icon} {meta.label}
              </span>
              <h1 className="mt-3 text-xl font-bold leading-snug text-gray-900">{lesson.title}</h1>
              {lesson.description && (
                <p className="mt-2 text-sm leading-relaxed text-gray-500">{lesson.description}</p>
              )}

              {/* Structure steps */}
              <div className="mt-5 flex flex-wrap gap-2">
                {STEPS.map((step, i) => (
                  <span
                    key={step}
                    className="flex items-center gap-1.5 rounded-full border border-gray-100 bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-600"
                  >
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#1B4FD8] text-[9px] text-white">
                      {i + 1}
                    </span>
                    {step}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="w-full shrink-0 space-y-5 lg:w-80">
            <UpNextLesson lesson={upcoming} progress={subjectProgress} />

            {/* Materials */}
            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <h3 className="mb-3 text-sm font-bold text-gray-900">Материалы</h3>
              <div className="flex flex-col gap-2">
                {MATERIALS.map(m => (
                  <button
                    key={m.label}
                    type="button"
                    className="flex items-center gap-2.5 rounded-xl bg-gray-50 px-3 py-2.5 text-left text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-100"
                  >
                    <span>{m.icon}</span> {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Ask teacher */}
            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <h3 className="mb-3 text-sm font-bold text-gray-900">Вопрос учителю</h3>
              {askSent ? (
                <p className="text-xs font-semibold text-green-600">✓ Вопрос отправлен учителю</p>
              ) : (
                <form onSubmit={handleAskSubmit} className="space-y-2">
                  <textarea
                    value={askText}
                    onChange={(e) => setAskText(e.target.value)}
                    placeholder="Напиши свой вопрос..."
                    rows={3}
                    className="w-full resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1B4FD8]/30"
                  />
                  <button
                    type="submit"
                    disabled={!askText.trim()}
                    className="w-full rounded-xl bg-gray-100 py-2 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Отправить
                  </button>
                </form>
              )}
            </div>

            {/* Start test CTA */}
            <Link
              href={`/student/online/practice?lesson=${lesson.id}`}
              className="block w-full rounded-xl bg-[#1B4FD8] py-3 text-center text-sm font-bold text-white shadow-md shadow-blue-200 transition-colors hover:bg-blue-700"
            >
              Начать тест →
            </Link>

            {/* Compact lesson list */}
            <LessonSidebarList lessons={allLessons} statuses={statuses} activeId={lesson.id} />
          </div>
        </div>
      </div>
    </div>
  )
}
