'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { RotateCcw, Share2, Check } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { calcStreak, DEFAULT_TARGET_SCORE, type SubjectStat } from '@/lib/student-data'
import {
  fetchMockResultById, fetchLatestMockResult, fetchPreviousMockScore,
  fetchLeaderboard, fetchQuestionCount,
  type MockResultDetail, type Leaderboard,
} from '@/lib/mock-data'
import MockResultsHero from '@/components/student/mock/MockResultsHero'
import MockStatsRow from '@/components/student/mock/MockStatsRow'
import MockLeaderboardCard from '@/components/student/mock/MockLeaderboardCard'
import AICard from '@/components/student/AICard'

const XP_PER_CORRECT = 20

export default function MockResultsPage() {
  const params = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const testId = Number(params.id)
  const resultId = searchParams.get('r')
  const router = useRouter()

  const [studentId, setStudentId] = useState<string | null>(null)
  const [targetScore, setTargetScore] = useState(DEFAULT_TARGET_SCORE)
  const [result, setResult] = useState<MockResultDetail | null>(null)
  const [previousScore, setPreviousScore] = useState<number | null>(null)
  const [leaderboard, setLeaderboard] = useState<Leaderboard | null>(null)
  const [totalQuestions, setTotalQuestions] = useState(0)
  const [streak, setStreak] = useState(0)
  const [loading, setLoading] = useState(true)
  const [shared, setShared] = useState(false)

  useEffect(() => {
    const init = async () => {
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

      const r = resultId ? await fetchMockResultById(resultId) : await fetchLatestMockResult(user.id, testId)
      if (!r) { router.push('/student/online/mock'); return }

      const [prevScore, board, qCount, historyRows] = await Promise.all([
        fetchPreviousMockScore(user.id, r.completed_at),
        fetchLeaderboard(r.test_id, user.id),
        fetchQuestionCount(r.test_id),
        supabase.from('practice_results').select('completed_at').eq('student_id', user.id).not('completed_at', 'is', null),
      ])

      setStudentId(user.id)
      setResult(r)
      setPreviousScore(prevScore)
      setLeaderboard(board)
      setTotalQuestions(qCount)
      setStreak(calcStreak((historyRows.data ?? []).map(row => row.completed_at as string)))
      setLoading(false)
    }
    init()
  }, [testId, resultId, router])

  const handleShare = async () => {
    if (!result) return
    const text = `Я набрал ${result.total_score} из 245 баллов на пробном ОРТ в ZHANGAK! 🎯`
    if (navigator.share) {
      try { await navigator.share({ text }); return } catch { /* user cancelled */ }
    }
    await navigator.clipboard.writeText(text)
    setShared(true)
    window.setTimeout(() => setShared(false), 2000)
  }

  if (loading || !result || !leaderboard || !studentId) return (
    <div className="flex min-h-screen items-center justify-center bg-[#FAF8FF]">
      <div className="text-sm text-gray-400">Загрузка...</div>
    </div>
  )

  const correctCount = result.math_raw_score + result.math_comparison_score + result.analogy_score + result.reading_score + result.grammar_score
  const accuracy = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0
  const xp = correctCount * XP_PER_CORRECT

  const subjects: SubjectStat[] = [
    { subject: 'math', current: result.math_raw_score, max: 40, delta: 0 },
    { subject: 'kyr', current: result.grammar_score, max: 40, delta: 0 },
    { subject: 'analogy', current: result.analogy_score, max: 20, delta: 0 },
    { subject: 'reading', current: result.reading_score, max: 30, delta: 0 },
  ]

  return (
    <div className="min-h-screen bg-[#FAF8FF]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        <MockResultsHero totalScore={result.total_score} previousScore={previousScore} completedAt={result.completed_at} />

        <MockStatsRow xp={xp} elapsedSeconds={result.elapsedSeconds} accuracy={accuracy} streak={streak} />

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <MockLeaderboardCard leaderboard={leaderboard} studentId={studentId} />
          <AICard latestScore={result.total_score} subjects={subjects} targetScore={targetScore} />
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/student/online/lessons"
            className="rounded-xl bg-[#1B4FD8] px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-blue-700"
          >
            Следующий урок →
          </Link>
          <Link
            href="/student/online/mock"
            className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50"
          >
            <RotateCcw size={15} /> Пройти снова
          </Link>
          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50"
          >
            {shared ? <Check size={15} className="text-green-600" /> : <Share2 size={15} />}
            {shared ? 'Скопировано' : 'Поделиться'}
          </button>
        </div>
      </div>
    </div>
  )
}
