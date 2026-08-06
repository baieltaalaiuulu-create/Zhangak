'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarClock, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import {
  fetchRelevantMockSession, getMockSessionStatus, fetchQuestionCount, fetchAttemptCount, fetchMockHistory,
  fetchMyMockRegistration, fetchMockRegisteredCount, registerForMock,
  type MockTest, type MockHistoryItem, type MockSessionStatus,
} from '@/lib/mock-data'
import MockAnnouncementCard from '@/components/student/mock/MockAnnouncementCard'
import MockUpcomingCard from '@/components/student/mock/MockUpcomingCard'
import MockHistoryList from '@/components/student/mock/MockHistoryList'

export default function MockOrtPage() {
  const [loading, setLoading] = useState(true)
  const [studentId, setStudentId] = useState<string | null>(null)
  const [test, setTest] = useState<MockTest | null>(null)
  const [status, setStatus] = useState<MockSessionStatus | null>(null)
  const [questionCount, setQuestionCount] = useState(0)
  const [attemptCount, setAttemptCount] = useState(0)
  const [history, setHistory] = useState<MockHistoryItem[]>([])
  const [registered, setRegistered] = useState(false)
  const [registeredCount, setRegisteredCount] = useState(0)
  const [registering, setRegistering] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
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

      setStudentId(user.id)

      const session = await fetchRelevantMockSession()
      const historyData = await fetchMockHistory(user.id)
      setHistory(historyData)

      if (session) {
        const sessionStatus = getMockSessionStatus(session)
        setTest(session)
        setStatus(sessionStatus)

        const [qCount, aCount] = await Promise.all([
          fetchQuestionCount(session.id),
          fetchAttemptCount(user.id, session.id),
        ])
        setQuestionCount(qCount)
        setAttemptCount(aCount)

        if (sessionStatus === 'upcoming') {
          const [myReg, count] = await Promise.all([
            fetchMyMockRegistration(user.id, session.id),
            fetchMockRegisteredCount(session.id),
          ])
          setRegistered(!!myReg)
          setRegisteredCount(count)
        }
      }

      setLoading(false)
    }
    checkAuth()
  }, [router, reloadKey])

  const handleRegister = async () => {
    if (!studentId || !test) return
    setRegistering(true)
    try {
      await registerForMock(studentId, test.id)
      setRegistered(true)
      setRegisteredCount(c => c + 1)
    } catch {
      // best-effort — registration is non-critical to taking the exam itself
    } finally {
      setRegistering(false)
    }
  }

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

        {!test && (
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

        {test && status === 'upcoming' && (
          <MockUpcomingCard
            test={test}
            registered={registered}
            registeredCount={registeredCount}
            registering={registering}
            onRegister={handleRegister}
            onCountdownComplete={() => setReloadKey(k => k + 1)}
          />
        )}

        {test && (status === 'live' || status === 'open') && (
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
        )}

        {test && status === 'ended' && (
          latestOwnResult ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-gray-200 bg-white p-10 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-50">
                <CheckCircle2 size={28} className="text-green-600" />
              </div>
              <h2 className="text-lg font-bold text-[#191B23]">{test.title} завершён</h2>
              <p className="max-w-sm text-sm text-gray-400">Пробный ОРТ окончен — доступен только результат.</p>
              <Link
                href={`/student/online/mock/${test.id}/results?r=${latestOwnResult.id}`}
                className="mt-1 rounded-xl bg-[#1B4FD8] px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-blue-700"
              >
                Посмотреть результат →
              </Link>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-gray-200 bg-white p-12 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#EEF2FF]">
                <CalendarClock size={28} className="text-[#1B4FD8]" />
              </div>
              <h2 className="text-lg font-bold text-[#191B23]">{test.title} завершён</h2>
              <p className="max-w-sm text-sm text-gray-400">Вы не участвовали в этом пробном ОРТ.</p>
            </div>
          )
        )}

        <MockHistoryList history={history} />
      </div>
    </div>
  )
}
