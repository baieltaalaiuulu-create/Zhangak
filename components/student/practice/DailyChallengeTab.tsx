'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BrainCircuit, Calculator, CalendarClock, Eye, Flame, Languages, Users, Trophy, Sparkles, type LucideIcon } from 'lucide-react'
import {
  fetchTodayChallenge, fetchChallengeQuestions, fetchChallengeResult, fetchChallengeCompletionCount,
  fetchBestAccuracy, fetchChallengeStreak, fetchWeakTopic, loadDailyProgress,
  SUBJECT_META, type ChallengeSubject, type DailyChallenge, type DailyChallengeQuestion, type WeakTopicInfo,
} from '@/lib/daily-challenge-data'

interface Props {
  studentId: string | null
}

const SUBJECT_ICON: Record<ChallengeSubject, LucideIcon> = {
  math: Calculator,
  kyr: Languages,
  analogy: BrainCircuit,
  reading: Eye,
}

function LoadingCard() {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-10 text-center text-sm text-gray-400">
      Загрузка задания дня...
    </div>
  )
}

export default function DailyChallengeTab({ studentId }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [challenge, setChallenge] = useState<DailyChallenge | null>(null)
  const [questions, setQuestions] = useState<DailyChallengeQuestion[]>([])
  const [completed, setCompleted] = useState(false)
  const [completionCount, setCompletionCount] = useState(0)
  const [bestAccuracy, setBestAccuracy] = useState<number | null>(null)
  const [streak, setStreak] = useState(0)
  const [weakTopic, setWeakTopic] = useState<WeakTopicInfo | null>(null)
  const [progressCount, setProgressCount] = useState(0)

  useEffect(() => {
    if (!studentId) return
    const load = async () => {
      const today = await fetchTodayChallenge()
      setChallenge(today)
      if (!today) { setLoading(false); return }

      const [qs, result, count, best, streakDays, weak] = await Promise.all([
        fetchChallengeQuestions(today.id),
        fetchChallengeResult(today.id, studentId),
        fetchChallengeCompletionCount(today.id),
        fetchBestAccuracy(studentId),
        fetchChallengeStreak(studentId),
        fetchWeakTopic(studentId),
      ])
      setQuestions(qs)
      setCompleted(!!result)
      setCompletionCount(count)
      setBestAccuracy(best)
      setStreak(streakDays)
      setWeakTopic(weak)

      const progress = loadDailyProgress(today.id, studentId)
      setProgressCount(progress ? Object.keys(progress.answers).length : 0)

      setLoading(false)
    }
    load()
  }, [studentId])

  if (loading) return <LoadingCard />

  if (!challenge) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-10 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-orange-50 text-orange-500"><CalendarClock size={24} aria-hidden="true" /></div>
        <p className="text-sm font-bold text-gray-700">Задание дня скоро появится</p>
        <p className="mt-1 text-xs text-gray-400">Загляни чуть позже — новое задание публикуется каждый день</p>
      </div>
    )
  }

  const dateLabel = new Date(`${challenge.date}T00:00:00`).toLocaleDateString('ru', { day: 'numeric', month: 'long' })
  const minutesEstimate = Math.max(5, Math.round(challenge.question_count * 0.85))
  const progressPct = challenge.question_count > 0 ? Math.round((progressCount / challenge.question_count) * 100) : 0

  const subjectCounts = new Map<string, number>()
  for (const q of questions) subjectCounts.set(q.subject, (subjectCounts.get(q.subject) ?? 0) + 1)

  const ctaLabel = completed ? 'Задание выполнено — посмотреть результат' : progressCount > 0 ? 'Продолжить задание' : 'Начать задание дня'
  const ctaHref = completed ? '/student/online/practice/daily/results' : '/student/online/practice/daily'

  return (
    <div className="space-y-4">
      <div
        className="rounded-2xl p-6 text-white shadow-sm sm:p-7"
        style={{ background: 'linear-gradient(135deg, #F5890A 0%, #EA580C 60%, #C2410C 100%)' }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-lg font-extrabold sm:text-xl"><Flame size={20} aria-hidden="true" /> Задание дня — {dateLabel}</h2>
          <span className="inline-flex items-center rounded-full bg-white/20 px-3 py-1 text-xs font-bold backdrop-blur-sm">
            +{challenge.xp_reward} XP за завершение
          </span>
        </div>
        <p className="mt-2 text-sm font-medium text-white/85">
          {challenge.question_count} вопросов • ~{minutesEstimate} минут
        </p>
        {!completed && (
          <p className="mt-1 text-xs text-white/70">Успей пройти до конца суток и сохрани серию огня!</p>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {Array.from(subjectCounts.entries()).map(([subject, count]) => {
            const typedSubject = subject as ChallengeSubject
            const meta = SUBJECT_META[typedSubject]
            const SubjectIcon = SUBJECT_ICON[typedSubject]
            return (
              <span key={subject} className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold backdrop-blur-sm">
                <SubjectIcon size={14} aria-hidden="true" /> {meta?.label} — {count}
              </span>
            )
          })}
        </div>

        {progressCount > 0 && !completed && (
          <div className="mt-5">
            <div className="mb-1.5 flex justify-between text-xs font-semibold text-white/80">
              <span>{progressCount} из {challenge.question_count} пройдено</span>
              <span>{progressPct}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/20">
              <div className="h-full rounded-full bg-white transition-all duration-500" style={{ width: `${progressPct}%` }} />
            </div>
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-semibold text-white/85">
          <span className="flex items-center gap-1.5"><Flame size={14} /> {streak} дней подряд</span>
          {bestAccuracy !== null && <span>Лучший результат: {bestAccuracy}%</span>}
          <span className="flex items-center gap-1.5"><Users size={14} /> Сегодня прошли: {completionCount} учеников</span>
        </div>

        <button
          type="button"
          onClick={() => router.push(ctaHref)}
          className="mt-6 w-full rounded-xl bg-white py-3 text-sm font-bold text-orange-600 shadow-md transition-colors hover:bg-orange-50 sm:w-auto sm:px-8"
        >
          {completed && <Trophy size={15} className="mr-1.5 inline -mt-0.5" />}
          {ctaLabel}
        </button>
      </div>

      {weakTopic && (
        <div className="rounded-2xl border border-[#1B4FD8]/15 bg-[#EEF2FF] p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1B4FD8] text-white">
              <Sparkles size={16} />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold text-[#191B23]">AI рекомендует</p>
              <p className="mt-1 text-sm leading-relaxed text-gray-600">
                У тебя больше всего ошибок в теме «{weakTopic.topic}». Рекомендую решить 10 вопросов для закрепления навыка.
              </p>
              <a
                href="/student/online/ai"
                className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-[#1B4FD8] px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-blue-700"
              >
                Начать AI-тренажёр
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
