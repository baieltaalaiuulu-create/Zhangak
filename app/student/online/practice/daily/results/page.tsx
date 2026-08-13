'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { BrainCircuit, Calculator, CheckCircle2, Eye, Flame, Languages, Sparkles, RotateCcw, TrendingUp, type LucideIcon } from 'lucide-react'
import {
  fetchTodayChallenge, fetchChallengeQuestions, fetchChallengeResult, fetchChallengeStreak,
  loadCompletionSnapshot, groupErrorsBySubject, SUBJECT_META,
  type DailyChallenge, type DailyChallengeQuestion, type CompletionSnapshot, type SubjectErrorGroup, type ChallengeSubject,
} from '@/lib/daily-challenge-data'
import { useStudentSession } from '@/components/student/StudentSessionContext'

const SUBJECT_TO_SECTION: Record<ChallengeSubject, string> = {
  math: 'math',
  kyr: 'grammar',
  analogy: 'analogy',
  reading: 'reading',
}

const SUBJECT_ICON: Record<ChallengeSubject, LucideIcon> = {
  math: Calculator,
  kyr: Languages,
  analogy: BrainCircuit,
  reading: Eye,
}

function LoadingScreen() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FAF8FF', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ color: '#9CA3AF', fontSize: 14 }}>Загрузка результата...</div>
    </div>
  )
}

export default function DailyChallengeResultsPage() {
  const router = useRouter()
  const sessionUser = useStudentSession()
  const [loading, setLoading] = useState(true)
  const [challenge, setChallenge] = useState<DailyChallenge | null>(null)
  const [snapshot, setSnapshot] = useState<CompletionSnapshot | null>(null)
  const [fallbackScore, setFallbackScore] = useState<{ correct: number; total: number; xp: number } | null>(null)
  const [errorGroups, setErrorGroups] = useState<SubjectErrorGroup[]>([])
  const [streak, setStreak] = useState(0)

  useEffect(() => {
    const load = async () => {
      const user = sessionUser
      const today = await fetchTodayChallenge()
      if (!today) { router.replace('/student/online/practice'); return }
      setChallenge(today)

      const [snap, result, streakDays] = await Promise.all([
        Promise.resolve(loadCompletionSnapshot(today.id)),
        fetchChallengeResult(today.id, user.id),
        fetchChallengeStreak(user.id),
      ])
      setStreak(streakDays)

      if (!result) { router.replace('/student/online/practice/daily'); return }

      if (snap) {
        setSnapshot(snap)
        const questions: DailyChallengeQuestion[] = await fetchChallengeQuestions(today.id)
        setErrorGroups(groupErrorsBySubject(questions, snap.answers))
      } else {
        setFallbackScore({ correct: result.correct_answers, total: result.total_questions, xp: result.xp_earned })
      }

      setLoading(false)
    }
    load()
  }, [router, sessionUser])

  if (loading || !challenge) return <LoadingScreen />

  const correct = snapshot?.correctAnswers ?? fallbackScore?.correct ?? 0
  const total = snapshot?.totalQuestions ?? fallbackScore?.total ?? challenge.question_count
  const xp = snapshot?.xpEarned ?? fallbackScore?.xp ?? challenge.xp_reward
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0

  const circumference = 2 * Math.PI * 52
  const rankImproved = snapshot?.previousRank != null && snapshot?.newRank != null && snapshot.newRank < snapshot.previousRank

  const worstGroup = [...errorGroups].sort((a, b) => b.count - a.count)[0]
  const totalMistakes = errorGroups.reduce((sum, g) => sum + g.count, 0)
  const reviewHref = worstGroup?.topics[0]
    ? `/student/online/practice?section=${encodeURIComponent(SUBJECT_TO_SECTION[worstGroup.subject])}&topic=${encodeURIComponent(worstGroup.topics[0])}`
    : '/student/online/practice'

  const cleanSubjects: ChallengeSubject[] = (['math', 'kyr', 'analogy', 'reading'] as const).filter(
    s => !errorGroups.some(g => g.subject === s)
  )

  return (
    <div className="min-h-screen bg-[#FAF8FF] px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-xl">
        <div className="rounded-2xl border border-gray-100 bg-white p-6 text-center shadow-sm sm:p-8">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-50 text-green-600">
            <CheckCircle2 size={30} aria-hidden="true" />
          </span>
          <h1 className="mt-3 text-xl font-extrabold text-[#191B23] sm:text-2xl">Задание дня выполнено!</h1>

          <div className="relative mx-auto mt-6 h-32 w-32">
            <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="52" fill="none" stroke="#F3F4F6" strokeWidth="10" />
              <circle
                cx="60" cy="60" r="52" fill="none"
                stroke="#F5890A" strokeWidth="10" strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={circumference * (1 - pct / 100)}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-extrabold text-[#191B23]">{correct}/{total}</span>
              <span className="text-xs font-semibold text-gray-400">{pct}% верных</span>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <span className="inline-flex items-center rounded-full bg-orange-50 px-3 py-1.5 text-sm font-bold text-orange-600">
              +{xp} XP за прохождение
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-3 py-1.5 text-sm font-bold text-red-500">
              <Flame size={15} aria-hidden="true" />
              Серия: {streak} {streak === 1 ? 'день' : streak < 5 ? 'дня' : 'дней'} подряд
            </span>
          </div>

          {rankImproved && (
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1.5 text-sm font-bold text-green-600">
              <TrendingUp size={15} />
              Подъём в лиге недели: #{snapshot!.previousRank} → #{snapshot!.newRank} ↑
            </div>
          )}

          {(errorGroups.length > 0 || cleanSubjects.length > 0) && (
            <div className="mt-6 space-y-2 text-left">
              <h2 className="text-sm font-bold text-gray-900">Ошибки по предметам</h2>
              {errorGroups.map(g => {
                const meta = SUBJECT_META[g.subject]
                const SubjectIcon = SUBJECT_ICON[g.subject]
                return (
                  <div key={g.subject} className="flex items-center justify-between rounded-xl bg-gray-50 px-3.5 py-2.5 text-sm">
                    <span className="inline-flex items-center gap-2 font-semibold text-gray-700"><SubjectIcon size={16} aria-hidden="true" /> {meta.label}</span>
                    <span className="text-gray-500">
                      {g.count} {g.count === 1 ? 'ошибка' : 'ошибки'}{g.topics.length > 0 ? ` (${g.topics.join(', ')})` : ''}
                    </span>
                  </div>
                )
              })}
              {cleanSubjects.length > 0 && (
                <div className="flex items-center justify-between rounded-xl bg-green-50 px-3.5 py-2.5 text-sm">
                  <span className="inline-flex flex-wrap items-center gap-1.5 font-semibold text-green-700">
                    {cleanSubjects.map(subject => {
                      const SubjectIcon = SUBJECT_ICON[subject]
                      return <SubjectIcon key={subject} size={15} aria-hidden="true" />
                    })}
                    {cleanSubjects.map(s => SUBJECT_META[s].label).join(' & ')}
                  </span>
                  <span className="font-semibold text-green-600">Без ошибок ✓</span>
                </div>
              )}
            </div>
          )}

          <div className="mt-6 space-y-2.5">
            {totalMistakes > 0 && (
              <a
                href="/student/online/ai"
                className="flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white shadow-md transition-opacity hover:opacity-90"
                style={{ background: 'linear-gradient(135deg, #6C3DE0 0%, #4338CA 100%)' }}
              >
                <Sparkles size={16} /> Разобрать {totalMistakes} {totalMistakes === 1 ? 'ошибку' : 'ошибки'} с AI
              </a>
            )}
            {totalMistakes > 0 && (
              <Link
                href={reviewHref}
                className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white py-3 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-50"
              >
                <RotateCcw size={15} /> Повторить ошибки самостоятельно
              </Link>
            )}
          </div>

          <Link href="/student/online" className="mt-5 inline-block text-sm font-semibold text-gray-400 hover:text-gray-600">
            Вернуться на главную
          </Link>
        </div>
      </div>
    </div>
  )
}
