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
import {
  fetchPracticeTest,
  fetchQuestions,
  fetchPreviousScore,
  savePracticeResult,
  type PracticeTest,
  type PracticeQuestion,
  type AnswerLetter,
} from '@/lib/practice-data'
import UpNextLesson from '@/components/student/UpNextLesson'
import LessonSidebarList from '@/components/student/LessonSidebarList'
import MobileLessonVideo from '@/components/student/mobile/MobileLessonVideo'
import MobileAIHelp from '@/components/student/mobile/MobileAIHelp'
import MobileNextStepCard from '@/components/student/mobile/MobileNextStepCard'
import MobileLessonPractice, { type LessonAnswerEntry } from '@/components/student/mobile/MobileLessonPractice'
import MobileLessonComplete from '@/components/student/mobile/MobileLessonComplete'
import { Calculator, ChevronDown, FileText, Languages, PencilLine, Sigma, Video, type LucideIcon } from 'lucide-react'

function getYoutubeEmbed(url: string): string {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/)
  return match ? `https://www.youtube.com/embed/${match[1]}` : url
}

const STEPS = ['Теория', 'Пример', 'Тренажёр', 'Мини-тест']
const XP_PER_CORRECT = 10
const XP_NO_QUESTIONS = 50

const MATERIALS: { icon: LucideIcon; label: string }[] = [
  { icon: FileText, label: 'Конспект' },
  { icon: Sigma, label: 'Формулы' },
  { icon: PencilLine, label: 'ДЗ' },
]

type LessonStep = 'video' | 'practice' | 'complete'

export default function LessonDetailPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const lessonId = params.id

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [lesson, setLesson] = useState<Lesson | null>(null)
  const [allLessons, setAllLessons] = useState<Lesson[]>([])
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set())
  const [studentId, setStudentId] = useState<string | null>(null)
  const [practiceTest, setPracticeTest] = useState<PracticeTest | null>(null)
  const [lessonQuestions, setLessonQuestions] = useState<PracticeQuestion[]>([])
  const [practiceScore, setPracticeScore] = useState<number | null>(null)
  const [askText, setAskText] = useState('')
  const [askSent, setAskSent] = useState(false)
  const [askTeacherOpen, setAskTeacherOpen] = useState(false)
  const [videoWatched, setVideoWatched] = useState(false)
  const startedRef = useRef(false)

  // ── Mobile inline lesson flow state ─────────────────────────────────────
  const [lessonStep, setLessonStep] = useState<LessonStep>('video')
  const [finishedAnswers, setFinishedAnswers] = useState<LessonAnswerEntry[] | null>(null)

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

      setStudentId(user.id)

      try {
        const [thisLesson, lessons, completed] = await Promise.all([
          fetchLessonById(lessonId),
          fetchLessons(),
          fetchCompletedLessonIds(user.id),
        ])

        setLesson(thisLesson)
        setAllLessons(lessons)
        setCompletedIds(completed)

        if (thisLesson) {
          const test = await fetchPracticeTest(thisLesson.id)
          setPracticeTest(test)

          if (test) {
            const qs = await fetchQuestions(test.id)
            setLessonQuestions(qs)
          }

          if (test) setPracticeScore(await fetchPreviousScore(user.id, test.id))

          // Always start at the video step (or practice, for a lesson with
          // no video) — never auto-skip to the complete screen just
          // because the lesson was already finished in a past session.
          // Re-watching/re-practicing an already-completed lesson is
          // surfaced instead via the "Урок пройден" banner + repeat-mode
          // CTAs below (isCompleted), not by hiding the video/practice
          // steps entirely.
          setLessonStep(thisLesson.video_url ? 'video' : 'practice')

          if (!startedRef.current) {
            startedRef.current = true
            markLessonStarted(user.id, thisLesson.id)
          }
        }
      } catch {
        setLoadError(true)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [router, lessonId])

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
          <div className="aspect-video animate-pulse rounded-2xl bg-white md:hidden" />
          <div className="hidden aspect-video animate-pulse rounded-2xl bg-white md:block" />
          <div className="h-24 animate-pulse rounded-2xl bg-white" />
        </div>
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
  const SubjectIcon = lesson.subject === 'math' ? Calculator : Languages
  const embedUrl = lesson.video_url ? getYoutubeEmbed(lesson.video_url) : null
  const hasVideo = !!lesson.video_url

  // Drives the "already completed" banner + repeat-mode CTAs on the video
  // and complete steps — it only ever reflects the pre-session state from
  // fetchCompletedLessonIds (not touched again this render), so a first
  // completion this session still lands on the "first time" complete
  // screen (see completeStep below), and only becomes true again on the
  // next real visit.
  const isCompleted = completedIds.has(lesson.id)

  const handleAskSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!askText.trim()) return
    setAskSent(true)
    setAskText('')
    window.setTimeout(() => setAskSent(false), 4000)
  }

  // ── Mobile inline lesson flow handlers ──────────────────────────────────
  // "Повторить ещё раз" on the complete screen — sends an already-completed
  // lesson back to the video step for another pass, resetting videoWatched
  // so the repeat-mode CTAs on that step stay gated the same way a first
  // watch is.
  const handleRepeat = () => {
    setLessonStep('video')
    setVideoWatched(false)
  }

  const handleFinishNoQuestions = async () => {
    if (studentId && lesson) {
      await savePracticeResult({ studentId, testId: null, lessonId: lesson.id, score: 0, answers: {} })
    }
    setLessonStep('complete')
  }

  const handleFinishPractice = async (finalAnswers: LessonAnswerEntry[]) => {
    if (studentId && lesson && practiceTest) {
      const correctCount = finalAnswers.filter(a => a.correct).length
      const answersRecord: Record<number, AnswerLetter> = {}
      finalAnswers.forEach(a => { answersRecord[a.questionId] = a.answer })
      await savePracticeResult({ studentId, testId: practiceTest.id, lessonId: lesson.id, score: correctCount, answers: answersRecord })
    }
    setFinishedAnswers(finalAnswers)
    setLessonStep('complete')
  }

  // Complete-screen stats: from the quiz just taken this session if there
  // is one, otherwise (a returning visit to an already-completed lesson)
  // fall back to the stored score — no per-question detail survives a
  // reload, so wrongQuestions is empty in that case.
  const completeStats = finishedAnswers
    ? {
        correct: finishedAnswers.filter(a => a.correct).length,
        total: lessonQuestions.length,
        wrongQuestions: finishedAnswers
          .filter(a => !a.correct)
          .map(a => ({ question: lessonQuestions.find(q => q.id === a.questionId)?.question_text ?? '' })),
      }
    : {
        correct: practiceScore ?? 0,
        total: lessonQuestions.length,
        wrongQuestions: [] as { question: string }[],
      }
  const completeXp = completeStats.total > 0 ? completeStats.correct * XP_PER_CORRECT : XP_NO_QUESTIONS

  const askTeacherBlock = (
    <div>
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
            className="flex min-h-11 w-full items-center justify-center rounded-xl bg-gray-100 py-2 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Отправить
          </button>
        </form>
      )}
    </div>
  )

  return (
    <div className="min-h-screen bg-[#F4F6FA]">
      {/* ============ MOBILE (< 768px) ============ */}
      <div className="block md:hidden">
        {lessonStep === 'video' && (
          <>
            <div className="flex items-center gap-3 border-b border-gray-100 bg-white px-4 py-3">
              <Link href="/student/online/lessons" className="flex min-h-11 min-w-11 shrink-0 items-center text-sm font-bold text-gray-600">
                ← Уроки
              </Link>
              <div className="min-w-0 flex-1 text-center">
                <p className="truncate text-xs font-semibold text-gray-400">
                  {meta.label}{currentIndex >= 0 ? ` • Урок ${currentIndex + 1} из ${sameSubjectLessons.length}` : ''}
                </p>
              </div>
              <div className="w-11 shrink-0" aria-hidden="true" />
            </div>

            {isCompleted && (
              <div className="mx-4 mt-3 flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 p-3">
                <span className="text-lg text-green-500">✓</span>
                <div>
                  <div className="text-sm font-semibold text-green-700">Урок пройден</div>
                  <div className="text-xs text-green-600">Можешь посмотреть ещё раз</div>
                </div>
              </div>
            )}

            <div className="space-y-4 px-4 py-4">
              <h1 className="text-xl font-bold leading-snug text-[#191B23]">{lesson.title}</h1>

              {hasVideo && embedUrl && (
                <MobileLessonVideo videoUrl={lesson.video_url!} title={lesson.title} watched={videoWatched} onWatched={() => setVideoWatched(true)} />
              )}

              <MobileAIHelp lessonTitle={lesson.title} />

              <MobileNextStepCard
                questionCount={lessonQuestions.length}
                locked={hasVideo && !videoWatched}
                onStartPractice={() => setLessonStep('practice')}
                onFinishNoQuestions={handleFinishNoQuestions}
                isRepeat={isCompleted}
                nextLessonHref={upcoming ? `/student/online/lessons/${upcoming.id}` : null}
              />

              {/* Ask teacher — collapsed, moved to the bottom */}
              <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                <button
                  type="button"
                  onClick={() => setAskTeacherOpen(v => !v)}
                  className="flex min-h-11 w-full items-center justify-between text-left text-sm font-bold text-gray-900"
                >
                  Вопрос учителю
                  <ChevronDown size={18} className={`text-gray-400 transition-transform ${askTeacherOpen ? 'rotate-180' : ''}`} />
                </button>
                {askTeacherOpen && <div className="mt-3">{askTeacherBlock}</div>}
              </div>
            </div>
          </>
        )}

        {lessonStep === 'practice' && (
          <MobileLessonPractice
            questions={lessonQuestions}
            onBack={() => setLessonStep('video')}
            onFinish={handleFinishPractice}
          />
        )}

        {lessonStep === 'complete' && (
          <MobileLessonComplete
            correct={completeStats.correct}
            total={completeStats.total}
            xp={completeXp}
            wrongQuestions={completeStats.wrongQuestions}
            nextLessonHref={upcoming ? `/student/online/lessons/${upcoming.id}` : null}
            onBackToLessons={() => router.push('/student/online/lessons')}
            isRepeat={isCompleted}
            onRepeat={handleRepeat}
          />
        )}
      </div>

      {/* ============ DESKTOP (>= 768px) — unchanged ============ */}
      <div className="hidden md:block">
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
                    <Video size={36} className="mx-auto mb-2" aria-hidden="true" />
                    <p className="text-sm">Видео скоро появится</p>
                  </div>
                )}
              </div>

              {/* Title block */}
              <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
                <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${meta.bg} ${meta.color}`}>
                  <SubjectIcon size={14} aria-hidden="true" /> {meta.label}
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
                  {MATERIALS.map(m => {
                    const MaterialIcon = m.icon
                    return (
                      <button
                        key={m.label}
                        type="button"
                        className="flex items-center gap-2.5 rounded-xl bg-gray-50 px-3 py-2.5 text-left text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-100"
                      >
                        <MaterialIcon size={17} aria-hidden="true" /> {m.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Ask teacher */}
              <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                <h3 className="mb-3 text-sm font-bold text-gray-900">Вопрос учителю</h3>
                {askTeacherBlock}
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
    </div>
  )
}
