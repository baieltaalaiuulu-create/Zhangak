'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  fetchTodayChallenge, fetchChallengeQuestions, fetchChallengeResult,
  loadDailyProgress, saveDailyProgress, clearDailyProgress, saveCompletionSnapshot,
  recordChallengeCompletion, optionText, isCorrect, SUBJECT_META,
  type DailyChallenge, type DailyChallengeQuestion, type AnswerLetter,
} from '@/lib/daily-challenge-data'
import { useStudentSession } from '@/components/student/StudentSessionContext'

const LETTERS: AnswerLetter[] = ['A', 'B', 'C', 'D']

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function LoadingScreen() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F4F6FA', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ color: '#9CA3AF', fontSize: 14 }}>Загрузка задания дня...</div>
    </div>
  )
}

export default function DailyChallengeFlowPage() {
  const router = useRouter()
  const sessionUser = useStudentSession()
  const [loading, setLoading] = useState(true)
  const [studentId, setStudentId] = useState<string | null>(null)
  const [challenge, setChallenge] = useState<DailyChallenge | null>(null)
  const [questions, setQuestions] = useState<DailyChallengeQuestion[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, AnswerLetter>>({})
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const load = async () => {
      const user = sessionUser
      setStudentId(user.id)

      const today = await fetchTodayChallenge()
      if (!today) { router.replace('/student/online/practice'); return }

      const existingResult = await fetchChallengeResult(today.id, user.id)
      if (existingResult) { router.replace('/student/online/practice/daily/results'); return }

      const qs = await fetchChallengeQuestions(today.id)
      if (qs.length === 0) { router.replace('/student/online/practice'); return }

      setChallenge(today)
      setQuestions(qs)

      const progress = loadDailyProgress(today.id, user.id)
      if (progress) {
        setAnswers(progress.answers)
        setCurrentIndex(Math.min(progress.currentIndex, qs.length - 1))
        setElapsedSeconds(progress.elapsedSeconds)
      }

      setLoading(false)
    }
    load()
  }, [router, sessionUser])

  // Ticking session timer — persisted alongside answers so "Прошло времени"
  // survives a resume.
  useEffect(() => {
    if (loading) return
    const timer = window.setInterval(() => setElapsedSeconds(s => s + 1), 1000)
    return () => window.clearInterval(timer)
  }, [loading])

  const persist = useCallback((nextAnswers: Record<string, AnswerLetter>, nextIndex: number, nextElapsed: number) => {
    if (!challenge || !studentId) return
    saveDailyProgress(challenge.id, studentId, { answers: nextAnswers, currentIndex: nextIndex, elapsedSeconds: nextElapsed })
  }, [challenge, studentId])

  useEffect(() => {
    persist(answers, currentIndex, elapsedSeconds)
  }, [answers, currentIndex, elapsedSeconds, persist])

  if (loading || !challenge) return <LoadingScreen />

  const question = questions[currentIndex]
  const total = questions.length
  const answeredCount = Object.keys(answers).length
  const selected = answers[question.id]
  const isLast = currentIndex === total - 1
  const meta = SUBJECT_META[question.subject]

  const handleSelect = (letter: AnswerLetter) => {
    setAnswers(prev => ({ ...prev, [question.id]: letter }))
  }

  const handleBack = () => {
    if (currentIndex > 0) setCurrentIndex(i => i - 1)
  }

  const finish = async () => {
    if (!studentId || submitting) return
    setSubmitting(true)

    const correctAnswers = questions.filter(q => {
      const a = answers[q.id]
      return a ? isCorrect(q, a) : false
    }).length

    const outcome = await recordChallengeCompletion({
      challengeId: challenge.id,
      studentId,
      totalQuestions: total,
      correctAnswers,
      timeSpentSeconds: elapsedSeconds,
    })

    saveCompletionSnapshot(challenge.id, {
      answers,
      correctAnswers,
      totalQuestions: total,
      timeSpentSeconds: elapsedSeconds,
      xpEarned: outcome.xpEarned,
      previousRank: outcome.previousRank,
      newRank: outcome.newRank,
    })
    clearDailyProgress(challenge.id, studentId)

    router.push('/student/online/practice/daily/results')
  }

  const handlePrimary = () => {
    if (!selected) return
    if (isLast) { finish(); return }
    setCurrentIndex(i => i + 1)
  }

  const primaryLabel = !selected ? 'Ответить' : isLast ? (submitting ? 'Завершение...' : 'Завершить задание') : 'Следующий →'

  return (
    <div className="flex min-h-screen flex-col bg-[#F4F6FA]">
      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-gray-200 bg-white px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-2">
          <Link href="/student/online/practice" className="text-sm font-semibold text-gray-500 hover:text-gray-700">
            ← Задание дня
          </Link>
          <span className="text-sm font-bold text-[#191B23]">Вопрос {currentIndex + 1} из {total}</span>
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold`} style={{ background: `${meta.color}1A`, color: meta.color }}>
            {meta.icon} {meta.label}{question.topic ? ` · ${question.topic}` : ''}
          </span>
        </div>

        {/* Progress dots */}
        <div className="mx-auto mt-3 flex max-w-2xl gap-1.5 overflow-x-auto pb-1">
          {questions.map((q, i) => {
            const state = i === currentIndex ? 'current' : answers[q.id] ? 'done' : 'future'
            return (
              <span
                key={q.id}
                className={`h-2.5 w-2.5 shrink-0 rounded-full transition-colors ${
                  state === 'done' ? 'bg-[#1B4FD8]' : state === 'current' ? 'bg-white ring-2 ring-[#1B4FD8]' : 'bg-gray-200'
                }`}
              />
            )
          })}
        </div>
      </header>

      {/* Question card */}
      <div className="flex flex-1 items-start justify-center px-4 py-6 sm:px-6">
        <div className="w-full max-w-2xl">
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-7">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: `${meta.color}1A`, color: meta.color }}>
                {meta.icon} {meta.label}
              </span>
              <span className="text-xs text-gray-400">Время на вопрос не ограничено</span>
            </div>

            <p className="mt-4 text-lg font-bold leading-relaxed text-gray-900">{question.question_text}</p>

            <div className="mt-6 flex flex-col gap-3">
              {LETTERS.map(letter => {
                const isSelected = selected === letter
                return (
                  <button
                    key={letter}
                    type="button"
                    onClick={() => handleSelect(letter)}
                    className={`flex w-full items-center gap-3 rounded-xl border-2 px-4 py-3.5 text-left transition-colors ${
                      isSelected ? 'border-[#1B4FD8] bg-blue-50' : 'border-gray-100 bg-gray-50 hover:border-gray-200'
                    }`}
                  >
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                      isSelected ? 'bg-[#1B4FD8] text-white' : 'bg-white text-gray-500'
                    }`}>
                      {letter}
                    </span>
                    <span className={`text-sm ${isSelected ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>{optionText(question, letter)}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="sticky bottom-0 border-t border-gray-200 bg-white px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-semibold text-gray-500">
            <span>Осталось вопросов: {total - answeredCount}</span>
            <span>Прошло времени: {formatTime(elapsedSeconds)}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleBack}
              disabled={currentIndex === 0}
              className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Назад
            </button>
            <button
              type="button"
              onClick={handlePrimary}
              disabled={!selected || submitting}
              className="rounded-xl bg-[#1B4FD8] px-6 py-2.5 text-sm font-bold text-white shadow-md shadow-blue-200 transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none"
            >
              {primaryLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
