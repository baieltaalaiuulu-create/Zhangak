'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Brain, Target, TrendingUp, Clock, ClipboardList, PenLine, Sparkles } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { DEFAULT_TARGET_SCORE } from '@/lib/student-data'
import { fetchLatestMockScore } from '@/lib/profile-data'
import {
  fetchWeakSections, fetchRecentActivity, projectScore, recommendedPracticeCount,
  type WeakSection, type RecentActivityItem,
} from '@/lib/ai-coach-data'

function LoadingScreen() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FAF8FF', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ color: '#9CA3AF', fontSize: 14 }}>Загрузка...</div>
    </div>
  )
}

export default function AiCoachPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [latestScore, setLatestScore] = useState<number | null>(null)
  const [targetScore, setTargetScore] = useState(DEFAULT_TARGET_SCORE)
  const [weakSections, setWeakSections] = useState<WeakSection[]>([])
  const [activity, setActivity] = useState<RecentActivityItem[]>([])

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

      const [score, weak, recent] = await Promise.all([
        fetchLatestMockScore(user.id),
        fetchWeakSections(user.id),
        fetchRecentActivity(user.id),
      ])
      setLatestScore(score)
      setWeakSections(weak)
      setActivity(recent)
      setLoading(false)
    }
    init()
  }, [router])

  if (loading) return <LoadingScreen />

  const current = latestScore ?? 0
  const weakest = weakSections[0] ?? null
  const projection = projectScore(current, weakest)
  const recommendedCount = weakest ? recommendedPracticeCount(weakest) : 0

  return (
    <div className="min-h-screen bg-[#FAF8FF]">
      <div className="mx-auto max-w-5xl space-y-5 px-4 py-6 sm:px-6">
        <div className="flex items-center gap-2">
          <Brain size={22} className="text-[#1B4FD8]" />
          <h1 className="text-xl font-bold text-[#191B23]">AI Коуч</h1>
        </div>

        {/* Recommendation hero */}
        <div className="overflow-hidden rounded-2xl shadow-sm">
          <div className="flex flex-col gap-4 p-6" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e2d4e 100%)' }}>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-blue-300">
              <Sparkles size={14} /> Рекомендация
            </div>
            {weakest ? (
              <>
                <p className="text-lg font-bold leading-snug text-white">
                  Твоя слабая тема: {weakest.label}. Реши {recommendedCount} вопросов.
                </p>
                <p className="text-sm text-gray-300">
                  Неверных ответов в этой теме: {weakest.wrongCount} из {weakest.wrongCount + weakest.correctCount}.
                </p>
                <Link
                  href={`/student/online/practice?section=${encodeURIComponent(weakest.section)}&topic=${encodeURIComponent(weakest.label)}`}
                  className="mt-1 w-fit rounded-xl bg-[#1B4FD8] px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-blue-700"
                >
                  Начать практику →
                </Link>
              </>
            ) : (
              <p className="text-sm text-gray-300">
                Пройди пару практик или пробный ОРТ — тогда мы найдём твою слабую тему и подскажем, что подтянуть.
              </p>
            )}
          </div>
        </div>

        {/* Score projection */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          <div className="flex items-center gap-2 text-sm font-bold text-[#191B23]">
            <Target size={16} className="text-[#1B4FD8]" /> Прогноз балла
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <div>
              <div className="text-3xl font-extrabold text-[#191B23]">{projection.current}</div>
              <div className="text-xs text-gray-400">Текущий балл</div>
            </div>
            <TrendingUp size={20} className="text-gray-300" />
            <div>
              <div className="text-3xl font-extrabold text-green-600">{projection.projected}</div>
              <div className="text-xs text-gray-400">Если подтянуть слабую тему</div>
            </div>
            {projection.gain > 0 && (
              <span className="rounded-full bg-green-50 px-3 py-1 text-sm font-bold text-green-600">+{projection.gain}</span>
            )}
          </div>
          <p className="mt-3 text-xs text-gray-400">Цель: {targetScore} баллов</p>
        </div>

        {/* Quick practice per weak topic */}
        {weakSections.length > 0 && (
          <div className="rounded-2xl border border-gray-200 bg-white p-6">
            <div className="flex items-center gap-2 text-sm font-bold text-[#191B23]">
              <PenLine size={16} className="text-[#1B4FD8]" /> Быстрая практика по темам
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {weakSections.slice(0, 4).map(s => (
                <Link
                  key={s.section}
                  href={`/student/online/practice?section=${encodeURIComponent(s.section)}&topic=${encodeURIComponent(s.label)}`}
                  className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3 transition-colors hover:border-[#1B4FD8] hover:bg-[#EEF2FF]"
                >
                  <div>
                    <div className="text-sm font-bold text-[#191B23]">{s.label}</div>
                    <div className="text-xs text-gray-400">{s.wrongCount} неверных ответов</div>
                  </div>
                  <span className="text-sm font-bold text-[#1B4FD8]">→</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Recent activity */}
        <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
          <div className="flex items-center gap-2 border-b border-gray-100 px-6 py-4 text-sm font-bold text-[#191B23]">
            <Clock size={16} className="text-[#1B4FD8]" /> Последняя активность
          </div>
          {activity.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400">Пока нет завершённых попыток</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {activity.map(item => (
                <div key={`${item.type}-${item.id}`} className="flex items-center gap-3 px-6 py-3">
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${item.type === 'mock' ? 'bg-[#EEF2FF] text-[#1B4FD8]' : 'bg-amber-50 text-amber-600'}`}>
                    {item.type === 'mock' ? <ClipboardList size={15} /> : <PenLine size={15} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-[#191B23]">{item.title}</div>
                    <div className="text-xs text-gray-400">{new Date(item.completedAt).toLocaleDateString('ru')}</div>
                  </div>
                  <div className="text-sm font-bold text-[#1B4FD8]">{item.score}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
