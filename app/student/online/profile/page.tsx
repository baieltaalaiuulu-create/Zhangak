'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { logoutZhangak } from '@/lib/zhangak-auth-client'
import { zhangakApiRequest } from '@/lib/zhangak-api-client'
import {
  DEFAULT_TARGET_SCORE,
  getPlatformProfile,
  type PlatformProfile,
  type ProfileScorePoint,
  updatePlatformProfile,
} from '@/lib/platform-profile'

import ProfileHeader from '@/components/student/profile/ProfileHeader'
import ProfileInfoCard from '@/components/student/profile/ProfileInfoCard'
import ProfileGoalCard from '@/components/student/profile/ProfileGoalCard'
import ProfileProgressCard from '@/components/student/profile/ProfileProgressCard'
import ScoreSparkline from '@/components/student/profile/ScoreSparkline'
import AchievementsCard from '@/components/student/profile/AchievementsCard'
import NotificationSettings from '@/components/student/profile/NotificationSettings'
import { useStudentSession } from '@/components/student/StudentSessionContext'

interface PlatformDashboardResponse {
  summary: {
    lessons: { total: number; completed: number }
    practice: { attempts: number }
  }
}

interface LearningProgress {
  lessonsCompleted: number
  lessonsTotal: number
  testsCompleted: number
  mocksCompleted: number
}

const EMPTY_SCORE_HISTORY: ProfileScorePoint[] = []

function nonNegativeSafeInteger(value: unknown): number {
  return typeof value === 'number' && Number.isSafeInteger(value) ? Math.max(0, value) : 0
}

function progressFromDashboard(response: unknown): LearningProgress {
  const payload = response && typeof response === 'object' ? response as Partial<PlatformDashboardResponse> : null
  const lessons = payload?.summary?.lessons
  const practice = payload?.summary?.practice
  const lessonsTotal = nonNegativeSafeInteger(lessons?.total)
  const lessonsCompleted = Math.min(lessonsTotal, nonNegativeSafeInteger(lessons?.completed))
  const testsCompleted = nonNegativeSafeInteger(practice?.attempts)
  return { lessonsCompleted, lessonsTotal, testsCompleted, mocksCompleted: 0 }
}

export default function ProfilePage() {
  const router = useRouter()
  const sessionUser = useStudentSession()
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [retryNonce, setRetryNonce] = useState(0)
  const [profile, setProfile] = useState<PlatformProfile | null>(null)
  const [progress, setProgress] = useState<LearningProgress>({ lessonsCompleted: 0, lessonsTotal: 0, testsCompleted: 0, mocksCompleted: 0 })

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const [nextProfile, dashboard] = await Promise.all([
          getPlatformProfile(),
          zhangakApiRequest<PlatformDashboardResponse>('/v1/platform/dashboard'),
        ])
        if (!active) return
        setProfile(nextProfile)
        setProgress(progressFromDashboard(dashboard))
        setLoadError(false)
      } catch {
        if (active) setLoadError(true)
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => { active = false }
  }, [retryNonce, sessionUser.id])

  const retryLoad = () => {
    setLoading(true)
    setLoadError(false)
    setRetryNonce(current => current + 1)
  }

  const handleSignOut = async () => {
    await logoutZhangak().catch(() => {})
    router.replace('/login?surface=platform')
  }

  const handleGoalUpdate = (newGoal: number) => {
    setProfile(current => current ? { ...current, targetScore: newGoal } : current)
  }

  const handleNameUpdate = async (fullName: string) => {
    const updated = await updatePlatformProfile({ fullName })
    setProfile(updated)
  }

  const handleAvatarUpdate = async (avatarUrl: string | null) => {
    const updated = await updatePlatformProfile({ avatarUrl })
    setProfile(updated)
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FAF8FF', fontFamily: 'Inter, sans-serif' }}>
        <div style={{ color: '#9CA3AF', fontSize: 14 }}>Загрузка...</div>
      </div>
    )
  }

  if (loadError || !profile) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#FAF8FF] px-6 text-center">
        <p className="text-sm font-semibold text-gray-600">Не удалось загрузить профиль. Проверь соединение и попробуй ещё раз.</p>
        <button
          type="button"
          onClick={retryLoad}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#1B3F92] px-5 py-2.5 text-sm font-bold text-white"
        >
          <RefreshCw size={16} aria-hidden="true" />
          Попробовать ещё раз
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FAF8FF]">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <h1 className="mb-5 text-xl font-bold text-[#191B23]">Профиль</h1>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[320px_1fr]">
          <div className="min-w-0 space-y-5">
            <ProfileHeader
              fullName={profile.fullName}
              avatarUrl={profile.avatarUrl}
              studentType={profile.studentType ?? 'online'}
              latestScore={null}
              streak={0}
              level={1}
              onSignOut={handleSignOut}
              onNameUpdate={handleNameUpdate}
              onAvatarUpdate={handleAvatarUpdate}
            />
            <ProfileInfoCard fullName={profile.fullName} phone={profile.phone} />
            <ProfileGoalCard targetScore={profile.targetScore ?? DEFAULT_TARGET_SCORE} onGoalUpdate={handleGoalUpdate} />
          </div>

          <div className="min-w-0 space-y-5">
            <ProfileProgressCard
              lessonsCompleted={progress.lessonsCompleted}
              lessonsTotal={progress.lessonsTotal}
              testsCompleted={progress.testsCompleted}
              mocksCompleted={progress.mocksCompleted}
            />
            <ScoreSparkline history={EMPTY_SCORE_HISTORY} />
            <AchievementsCard
              streak={0}
              questionsSolved={0}
              mocksCompleted={progress.mocksCompleted}
              lessonsCompleted={progress.lessonsCompleted}
            />
            <NotificationSettings />
          </div>
        </div>
      </div>
    </div>
  )
}
