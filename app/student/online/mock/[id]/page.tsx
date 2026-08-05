'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Menu, X, ChevronLeft, ChevronRight, Flag } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  fetchMockTestById, fetchMockQuestions, fetchAttemptCount,
  computeSectionRawScores, saveMockResult, sectionTabFor,
  MOCK_SECTION_TABS, type MockTest, type MockSectionKey,
} from '@/lib/mock-data'
import { optionText, type PracticeQuestion, type AnswerLetter } from '@/lib/practice-data'

const ANSWER_LETTERS: AnswerLetter[] = ['a', 'b', 'c', 'd']
const DEFAULT_DURATION_MIN = 180

function formatClock(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`
}

export default function MockExamPage() {
  const params = useParams<{ id: string }>()
  const testId = Number(params.id)
  const router = useRouter()

  const [studentId, setStudentId] = useState<string | null>(null)
  const [test, setTest] = useState<MockTest | null>(null)
  const [questions, setQuestions] = useState<PracticeQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [answers, setAnswers] = useState<Record<number, AnswerLetter>>({})
  const [currentIndex, setCurrentIndex] = useState(0)
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)
  const [initialSeconds, setInitialSeconds] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [navOpen, setNavOpen] = useState(false)

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, student_type')
        .eq('id', user.id)
        .single()
      if (!profile || profile.role !== 'student') { router.push('/login'); return }
      if (profile.student_type === 'offline') { router.push('/student'); return }

      const t = await fetchMockTestById(testId)
      if (!t) { router.push('/student/online/mock'); return }

      if (t.max_attempts > 0) {
        const used = await fetchAttemptCount(user.id, t.id)
        if (used >= t.max_attempts) { router.push('/student/online/mock'); return }
      }

      const qs = await fetchMockQuestions(t.id)
      const seconds = (t.time_limit_minutes ?? DEFAULT_DURATION_MIN) * 60

      setStudentId(user.id)
      setTest(t)
      setQuestions(qs)
      setInitialSeconds(seconds)
      setSecondsLeft(seconds)
      setLoading(false)
    }
    init()
  }, [testId, router])

  const sectionGroups = useMemo(() => {
    const grouped = MOCK_SECTION_TABS.map(tab => ({
      ...tab,
      questions: questions.filter(q => sectionTabFor(q) === tab.key),
    }))
    const lengths = grouped.map(g => g.questions.length)
    return grouped.map((g, i) => ({
      ...g,
      startIndex: lengths.slice(0, i).reduce((a, b) => a + b, 0),
    }))
  }, [questions])

  const orderedQuestions = useMemo(() => sectionGroups.flatMap(g => g.questions), [sectionGroups])
  const currentQuestion = orderedQuestions[currentIndex] as PracticeQuestion | undefined
  const currentSection = sectionGroups.find(g => currentIndex >= g.startIndex && currentIndex < g.startIndex + g.questions.length)

  const finishExam = async () => {
    if (submitting || !studentId || !test) return
    setSubmitting(true)
    const raw = computeSectionRawScores(questions, answers)
    const elapsedSeconds = initialSeconds - (secondsLeft ?? 0)
    const resultId = await saveMockResult({ studentId, testId: test.id, answers, elapsedSeconds, raw })
    if (resultId) {
      router.push(`/student/online/mock/${test.id}/results?r=${resultId}`)
    } else {
      router.push(`/student/online/mock/${test.id}/results`)
    }
  }

  // Countdown — auto-submits at 0. finishExam is deferred to a macrotask so the
  // setState calls it triggers don't run synchronously inside this effect.
  useEffect(() => {
    if (loading || secondsLeft === null) return
    if (secondsLeft <= 0) {
      window.setTimeout(() => finishExam(), 0)
      return
    }
    const timer = window.setInterval(() => {
      setSecondsLeft(s => (s === null ? null : s - 1))
    }, 1000)
    return () => window.clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, secondsLeft === 0])

  const selectAnswer = (letter: AnswerLetter) => {
    if (!currentQuestion) return
    setAnswers(prev => ({ ...prev, [currentQuestion.id]: letter }))
  }

  const goTo = (index: number) => {
    setCurrentIndex(Math.max(0, Math.min(orderedQuestions.length - 1, index)))
    setNavOpen(false)
  }

  const answeredCount = Object.keys(answers).length
  const isLast = currentIndex === orderedQuestions.length - 1

  if (loading || !test || !currentQuestion) return (
    <div className="flex min-h-screen items-center justify-center bg-[#111827]">
      <div className="text-sm text-gray-400">Загрузка экзамена...</div>
    </div>
  )

  const low = (secondsLeft ?? 0) < 300

  return (
    <div className="flex min-h-screen flex-col bg-[#F4F6FA]">
      {/* Dark top bar */}
      <header className="sticky top-0 z-30 bg-[#111827] text-white">
        <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
          <button onClick={() => setNavOpen(true)} aria-label="Навигация" className="rounded-lg p-1.5 hover:bg-white/10 lg:hidden">
            <Menu size={20} />
          </button>
          <span className="truncate text-sm font-bold sm:text-base">{test.title}</span>
          <div className="ml-auto flex items-center gap-3">
            <span className={`rounded-lg px-3 py-1.5 text-sm font-bold tabular-nums ${low ? 'bg-red-500/20 text-red-400' : 'bg-white/10 text-white'}`}>
              {formatClock(secondsLeft ?? 0)}
            </span>
          </div>
        </div>
        <div className="flex gap-1 overflow-x-auto px-4 pb-2 sm:px-6">
          {sectionGroups.map(g => {
            const active = currentSection?.key === g.key
            const answeredInSection = g.questions.filter(q => answers[q.id]).length
            return (
              <button
                key={g.key}
                onClick={() => goTo(g.startIndex)}
                disabled={g.questions.length === 0}
                className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-30 ${active ? 'bg-white text-[#111827]' : 'text-gray-300 hover:bg-white/10'}`}
              >
                {g.label} {g.questions.length > 0 && <span className="opacity-70">({answeredInSection}/{g.questions.length})</span>}
              </button>
            )
          })}
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-6xl flex-1 gap-5 px-4 py-6 sm:px-6">
        {/* Question card */}
        <div className="min-w-0 flex-1 space-y-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wide text-gray-400">
                Вопрос {currentIndex + 1} из {orderedQuestions.length}
              </span>
            </div>

            {currentQuestion.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={currentQuestion.image_url} alt="Вопрос" className="mb-4 max-h-80 rounded-lg object-contain" />
            ) : (
              <p className="mb-5 text-base font-semibold leading-relaxed text-[#191B23]">{currentQuestion.question_text}</p>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {ANSWER_LETTERS.map(letter => {
                const selected = answers[currentQuestion.id] === letter
                return (
                  <button
                    key={letter}
                    onClick={() => selectAnswer(letter)}
                    className={`flex items-start gap-3 rounded-xl border p-3.5 text-left text-sm transition-colors ${selected ? 'border-[#1B4FD8] bg-[#EEF2FF] text-[#1B4FD8]' : 'border-gray-200 text-gray-700 hover:bg-gray-50'}`}
                  >
                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${selected ? 'bg-[#1B4FD8] text-white' : 'bg-gray-100 text-gray-500'}`}>
                      {letter.toUpperCase()}
                    </span>
                    <span className="pt-0.5">{optionText(currentQuestion, letter)}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <button
              onClick={() => goTo(currentIndex - 1)}
              disabled={currentIndex === 0}
              className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40"
            >
              <ChevronLeft size={16} /> Назад
            </button>

            {isLast ? (
              <button
                onClick={finishExam}
                disabled={submitting}
                className="flex items-center gap-1.5 rounded-xl bg-[#1B4FD8] px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
              >
                <Flag size={16} /> {submitting ? 'Завершается...' : 'Завершить'}
              </button>
            ) : (
              <button
                onClick={() => goTo(currentIndex + 1)}
                className="flex items-center gap-1.5 rounded-xl bg-[#1B4FD8] px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-blue-700"
              >
                Далее <ChevronRight size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Dot-navigation sidebar (desktop) */}
        <aside className="hidden w-64 shrink-0 space-y-4 lg:block">
          <NavPanel sectionGroups={sectionGroups} answers={answers} currentIndex={currentIndex} onSelect={goTo} answeredCount={answeredCount} total={orderedQuestions.length} />
        </aside>
      </div>

      {/* Dot-navigation drawer (mobile) */}
      {navOpen && (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/40 lg:hidden" onClick={() => setNavOpen(false)}>
          <div className="h-full w-72 overflow-y-auto bg-white p-5" onClick={e => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <span className="text-sm font-bold text-[#191B23]">Навигация</span>
              <button onClick={() => setNavOpen(false)} aria-label="Закрыть" className="rounded-lg p-1 text-gray-400 hover:bg-gray-50"><X size={18} /></button>
            </div>
            <NavPanel sectionGroups={sectionGroups} answers={answers} currentIndex={currentIndex} onSelect={goTo} answeredCount={answeredCount} total={orderedQuestions.length} />
          </div>
        </div>
      )}
    </div>
  )
}

function NavPanel({
  sectionGroups, answers, currentIndex, onSelect, answeredCount, total,
}: {
  sectionGroups: { key: MockSectionKey; label: string; questions: PracticeQuestion[]; startIndex: number }[]
  answers: Record<number, AnswerLetter>
  currentIndex: number
  onSelect: (index: number) => void
  answeredCount: number
  total: number
}) {
  return (
    <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-4">
      <div>
        <div className="mb-1 flex justify-between text-xs text-gray-400">
          <span>Прогресс</span>
          <span>{answeredCount}/{total}</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
          <div className="h-full rounded-full bg-[#1B4FD8] transition-all" style={{ width: total > 0 ? `${(answeredCount / total) * 100}%` : '0%' }} />
        </div>
      </div>

      {sectionGroups.filter(g => g.questions.length > 0).map(g => {
        const answeredInSection = g.questions.filter(q => answers[q.id]).length
        return (
          <div key={g.key}>
            <div className="mb-1.5 flex items-center justify-between text-xs font-semibold text-gray-500">
              <span>{g.label}</span>
              <span>{answeredInSection}/{g.questions.length}</span>
            </div>
            <div className="grid grid-cols-6 gap-1.5">
              {g.questions.map((q, i) => {
                const globalIndex = g.startIndex + i
                const isCurrent = globalIndex === currentIndex
                const isAnswered = !!answers[q.id]
                return (
                  <button
                    key={q.id}
                    onClick={() => onSelect(globalIndex)}
                    className={`flex h-7 w-7 items-center justify-center rounded-md text-[11px] font-bold transition-colors ${
                      isCurrent ? 'bg-[#1B4FD8] text-white' :
                      isAnswered ? 'bg-[#EEF2FF] text-[#1B4FD8]' :
                      'bg-gray-100 text-gray-400 hover:bg-gray-200'
                    }`}
                  >
                    {i + 1}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
