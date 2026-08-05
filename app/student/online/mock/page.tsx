'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarClock } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  fetchActiveMockTest, fetchQuestionCount, fetchAttemptCount, fetchMockHistory,
  type MockTest, type MockHistoryItem,
} from '@/lib/mock-data'
import MockAnnouncementCard from '@/components/student/mock/MockAnnouncementCard'
import MockHistoryList from '@/components/student/mock/MockHistoryList'

export default function MockOrtPage() {
  const [loading, setLoading] = useState(true)
  const [test, setTest] = useState<MockTest | null>(null)
  const [questionCount, setQuestionCount] = useState(0)
  const [attemptCount, setAttemptCount] = useState(0)
  const [history, setHistory] = useState<MockHistoryItem[]>([])
  const router = useRouter()

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, student_type')
        .eq('id', user.id)
        .single()

      if (!profile || profile.role !== 'student') { router.push('/login'); return }
      if (profile.student_type === 'offline') { router.push('/student'); return }

      const activeTest = await fetchActiveMockTest()
      const historyData = await fetchMockHistory(user.id)
      setHistory(historyData)

      if (activeTest) {
        const [qCount, aCount] = await Promise.all([
          fetchQuestionCount(activeTest.id),
          fetchAttemptCount(user.id, activeTest.id),
        ])
        setTest(activeTest)
        setQuestionCount(qCount)
        setAttemptCount(aCount)
      }

      setLoading(false)
    }
    checkAuth()
  }, [router])

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center bg-[#FAF8FF]">
      <div className="text-sm text-gray-400">Загрузка...</div>
    </div>
  )

  const attemptsLeft = test ? Math.max(0, test.max_attempts - attemptCount) : null
  const alreadyDone = test ? attemptCount > 0 && attemptsLeft === 0 : false
  const latestOwnResult = test ? history.find(h => h.test_id === test.id) : undefined

  return (
    <div className="min-h-screen bg-[#FAF8FF]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <h1 className="text-xl font-bold text-[#191B23]">Пробный ОРТ</h1>

        {test ? (
          <MockAnnouncementCard
            test={test}
            questionCount={questionCount}
            attemptsLeft={test.max_attempts > 0 ? attemptsLeft : null}
            cta={
              alreadyDone && latestOwnResult
                ? { label: 'Посмотреть результат →', href: `/student/online/mock/${test.id}/results?r=${latestOwnResult.id}` }
                : { label: 'Начать пробный ОРТ →', href: `/student/online/mock/${test.id}` }
            }
          />
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-gray-200 bg-white p-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#EEF2FF]">
              <CalendarClock size={28} className="text-[#1B4FD8]" />
            </div>
            <h2 className="text-lg font-bold text-[#191B23]">Пока нет активного пробного ОРТ</h2>
            <p className="max-w-sm text-sm text-gray-400">
              Следующий пробный ОРТ скоро будет объявлен. Загляните позже.
            </p>
          </div>
        )}

        <MockHistoryList history={history} />
      </div>
    </div>
  )
}
