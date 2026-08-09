'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  fetchTodayChallenge, fetchChallengeQuestions, fetchChallengeResult, loadDailyProgress,
  SUBJECT_META, type DailyChallenge, type DailyChallengeQuestion,
} from '@/lib/daily-challenge-data'

interface Props {
  studentId: string | null
}

function LoadingCard() {
  return (
    <div className="mx-4 mt-3 rounded-2xl border border-gray-100 bg-white p-10 text-center text-sm text-gray-400">
      Загрузка задания дня...
    </div>
  )
}

// Compact mobile-only card for the "🔥 Задание дня" tab — same real data as
// the desktop DailyChallengeTab (lib/daily-challenge-data.ts), just laid
// out per the mobile spec instead of the desktop gradient hero.
export default function MobileDailyChallengeTab({ studentId }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [challenge, setChallenge] = useState<DailyChallenge | null>(null)
  const [questions, setQuestions] = useState<DailyChallengeQuestion[]>([])
  const [completed, setCompleted] = useState(false)
  const [progressCount, setProgressCount] = useState(0)

  useEffect(() => {
    if (!studentId) return
    const load = async () => {
      const today = await fetchTodayChallenge()
      setChallenge(today)
      if (!today) { setLoading(false); return }

      const [qs, result] = await Promise.all([
        fetchChallengeQuestions(today.id),
        fetchChallengeResult(today.id, studentId),
      ])
      setQuestions(qs)
      setCompleted(!!result)

      const progress = loadDailyProgress(today.id, studentId)
      setProgressCount(progress ? Object.keys(progress.answers).length : 0)

      setLoading(false)
    }
    load()
  }, [studentId])

  if (loading) return <LoadingCard />

  if (!challenge) {
    return (
      <div className="mx-4 mt-3 rounded-2xl border border-gray-100 bg-white p-8 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-orange-50 text-2xl">🔥</div>
        <p className="text-sm font-bold text-gray-700">Задание дня скоро появится</p>
        <p className="mt-1 text-xs text-gray-400">Загляни чуть позже</p>
      </div>
    )
  }

  const dateLabel = new Date(`${challenge.date}T00:00:00`).toLocaleDateString('ru', { day: 'numeric', month: 'long' })
  const minutesEstimate = Math.max(5, Math.round(challenge.question_count * 0.85))
  const progressPct = challenge.question_count > 0 ? Math.round((progressCount / challenge.question_count) * 100) : 0

  const subjectLabels = Array.from(new Set(questions.map(q => SUBJECT_META[q.subject]?.label).filter(Boolean)))

  const ctaLabel = completed ? 'Посмотреть результат' : progressCount > 0 ? 'Продолжить →' : 'Начать задание дня →'
  const ctaHref = completed ? '/student/online/practice/daily/results' : '/student/online/practice/daily'

  return (
    <div className="mx-4 mt-3 rounded-2xl bg-orange-400 p-5">
      <p className="text-xs font-semibold uppercase tracking-widest text-white/70">Задание дня</p>
      <p className="mt-1 text-2xl font-bold text-white">{dateLabel}</p>
      <p className="mt-1 text-sm text-white/80">{challenge.question_count} вопросов • ~{minutesEstimate} мин</p>
      {subjectLabels.length > 0 && (
        <p className="mt-0.5 text-sm text-white/70">{subjectLabels.join(', ')}</p>
      )}

      {progressCount > 0 && !completed && (
        <div className="mt-4">
          <div className="h-1.5 overflow-hidden rounded-full bg-white/20">
            <div className="h-full rounded-full bg-white transition-all duration-500" style={{ width: `${progressPct}%` }} />
          </div>
          <p className="mt-1.5 text-xs font-semibold text-white/80">Пройдено {progressPct}%</p>
        </div>
      )}

      <button
        type="button"
        onClick={() => router.push(ctaHref)}
        className="mt-4 flex h-12 w-full items-center justify-center rounded-xl bg-white text-sm font-bold text-orange-500"
      >
        {ctaLabel}
      </button>
    </div>
  )
}
