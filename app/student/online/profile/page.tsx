'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { calcStreak, DEFAULT_TARGET_SCORE } from '@/lib/student-data'
import {
  fetchProfileInfo,
  fetchLatestMockScore,
  fetchScoreHistory,
  fetchLearningProgress,
  fetchQuestionsSolvedCount,
  type ProfileInfo,
  type ScorePoint,
  type LearningProgress,
} from '@/lib/profile-data'

import ProfileHeader from '@/components/student/profile/ProfileHeader'
import ProfileInfoCard from '@/components/student/profile/ProfileInfoCard'
import ProfileGoalCard from '@/components/student/profile/ProfileGoalCard'
import ProfileProgressCard from '@/components/student/profile/ProfileProgressCard'
import ScoreSparkline from '@/components/student/profile/ScoreSparkline'
import AchievementsCard from '@/components/student/profile/AchievementsCard'
import NotificationSettings from '@/components/student/profile/NotificationSettings'

export default function ProfilePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [studentId, setStudentId] = useState<string | null>(null)
  const [profile, setProfile] = useState<ProfileInfo | null>(null)
  const [latestScore, setLatestScore] = useState<number | null>(null)
  const [scoreHistory, setScoreHistory] = useState<ScorePoint[]>([])
  const [progress, setProgress] = useState<LearningProgress>({ lessonsCompleted: 0, lessonsTotal: 0, testsCompleted: 0, mocksCompleted: 0 })
  const [questionsSolved, setQuestionsSolved] = useState(0)
  const [streak, setStreak] = useState(0)
  const [level, setLevel] = useState(1)

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: authProfile } = await supabase
        .from('profiles')
        .select('role, student_type')
        .eq('id', user.id)
        .single()

      if (!authProfile || authProfile.role !== 'student') { router.push('/login'); return }
      if (authProfile.student_type === 'offline') { router.push('/student'); return }

      setStudentId(user.id)

      const [info, latest, history, learningProgress, solved, { data: allResults }] = await Promise.all([
        fetchProfileInfo(user.id),
        fetchLatestMockScore(user.id),
        fetchScoreHistory(user.id),
        fetchLearningProgress(user.id),
        fetchQuestionsSolvedCount(user.id),
        supabase
          .from('practice_results')
          .select('completed_at')
          .eq('student_id', user.id)
          .not('completed_at', 'is', null),
      ])

      setProfile(info)
      setLatestScore(latest)
      setScoreHistory(history)
      setProgress(learningProgress)
      setQuestionsSolved(solved)

      const rows = allResults ?? []
      setStreak(calcStreak(rows.map(r => r.completed_at as string)))
      setLevel(Math.max(1, Math.floor(rows.length / 10) + 1))

      setLoading(false)
    }
    checkAuth()
  }, [router])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const handleGoalUpdate = (newGoal: number) => {
    setProfile(prev => prev ? { ...prev, target_score: newGoal } : prev)
  }

  const handleNameUpdate = (name: string) => {
    setProfile(prev => prev ? { ...prev, full_name: name } : prev)
  }

  const handleAvatarUpdate = (url: string) => {
    setProfile(prev => prev ? { ...prev, avatar_url: url } : prev)
  }

  if (loading || !profile || !studentId) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FAF8FF', fontFamily: 'Inter, sans-serif' }}>
        <div style={{ color: '#9CA3AF', fontSize: 14 }}>Загрузка...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FAF8FF]">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <h1 className="mb-5 text-xl font-bold text-[#191B23]">Профиль</h1>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[320px_1fr]">
          <div className="space-y-5 min-w-0">
            <ProfileHeader
              studentId={studentId}
              fullName={profile.full_name}
              avatarUrl={profile.avatar_url}
              studentType={profile.student_type}
              latestScore={latestScore}
              streak={streak}
              level={level}
              onSignOut={handleSignOut}
              onNameUpdate={handleNameUpdate}
              onAvatarUpdate={handleAvatarUpdate}
            />
            <ProfileInfoCard fullName={profile.full_name} phone={profile.phone} />
            <ProfileGoalCard targetScore={profile.target_score ?? DEFAULT_TARGET_SCORE} onGoalUpdate={handleGoalUpdate} />
          </div>

          <div className="space-y-5 min-w-0">
            <ProfileProgressCard
              lessonsCompleted={progress.lessonsCompleted}
              lessonsTotal={progress.lessonsTotal}
              testsCompleted={progress.testsCompleted}
              mocksCompleted={progress.mocksCompleted}
            />
            <ScoreSparkline history={scoreHistory} />
            <AchievementsCard
              streak={streak}
              questionsSolved={questionsSolved}
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
