'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import nextDynamic from 'next/dynamic'
import { supabase } from '@/lib/supabase'
import { getStudentDashboard, DEFAULT_TARGET_SCORE, type StudentDashboardData } from '@/lib/student-data'
import { fetchDashboardExtras, type DashboardExtras } from '@/lib/dashboard-data'
import { fetchLessons, type Lesson } from '@/lib/lessons-data'
import { fetchWeeklyLeaderboard, type WeeklyLeaderboardEntry } from '@/lib/weekly-leaderboard-data'
import {
  fetchTodayChallenge,
  fetchChallengeCompletionCount,
  fetchChallengeResult,
  currentWeekStart,
  type DailyChallenge,
} from '@/lib/daily-challenge-data'

import AnnouncementBanner from '@/components/student/AnnouncementBanner'
import DashboardHeroCard from '@/components/student/DashboardHeroCard'
import TodayPlanCard from '@/components/student/TodayPlanCard'
import WeeklyProgressCard from '@/components/student/WeeklyProgressCard'
import SubjectsGrid from '@/components/student/SubjectsGrid'
import RecentAchievementsCard from '@/components/student/RecentAchievementsCard'
import MobileHero from '@/components/student/mobile/MobileHero'
import MobileTodayChecklist from '@/components/student/mobile/MobileTodayChecklist'
import MobileDailyChallengeCard from '@/components/student/mobile/MobileDailyChallengeCard'
import MobileLeaderboardCard from '@/components/student/mobile/MobileLeaderboardCard'
import MobileStatsGrid from '@/components/student/mobile/MobileStatsGrid'

// Both below-the-fold on mobile (last 3 sections) and secondary/non-CTA on
// desktop — deferred out of the initial JS bundle rather than pulled in
// eagerly with everything above it. ssr:false because both are pure
// client-rendered cards fed by props already computed before render (no
// server-render benefit, and it keeps their own internal useState from
// running through hydration). AIRecommendationCard in the literal spec
// doesn't exist in this codebase; AIMentorRecommendationCard is the real
// component that fills that role here.
const ActivityHeatmap = nextDynamic(() => import('@/components/student/ActivityHeatmap'), {
  ssr: false,
  loading: () => <div className="h-32 animate-pulse rounded-2xl bg-gray-100" />,
})
const AIMentorRecommendationCard = nextDynamic(() => import('@/components/student/AIMentorRecommendationCard'), {
  ssr: false,
  loading: () => null,
})

const CHALLENGE_MIN_PER_QUESTION = 0.75

export default function StudentOnlinePage() {
  const [profileName, setProfileName] = useState<string | null>(null)
  const [data, setData] = useState<StudentDashboardData | null>(null)
  const [extras, setExtras] = useState<DashboardExtras | null>(null)
  const [heroLesson, setHeroLesson] = useState<Lesson | null>(null)
  const [leaderboardMe, setLeaderboardMe] = useState<WeeklyLeaderboardEntry | null>(null)
  const [xpToNextRank, setXpToNextRank] = useState<number | null>(null)
  const [todayChallenge, setTodayChallenge] = useState<DailyChallenge | null>(null)
  const [challengeParticipants, setChallengeParticipants] = useState(0)
  const [challengeCompleted, setChallengeCompleted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, student_type, full_name, target_score')
        .eq('id', user.id)
        .single()

      if (!profile || profile.role !== 'student') { router.push('/login'); return }
      if (profile.student_type === 'offline') { router.push('/student'); return }

      setProfileName(profile.full_name)
      try {
        // fetchDashboardExtras only depends on getStudentDashboard's score
        // fields, not on any of the other calls below — chained off that
        // one promise (not awaited separately) so it runs in the same wave
        // as everything else instead of only starting once the whole batch
        // below has already resolved, which used to add a full extra
        // round-trip to every dashboard load.
        const dashboardPromise = getStudentDashboard()
        const [dashboard, allLessons, leaderboard, challenge, dashboardExtras] = await Promise.all([
          dashboardPromise,
          fetchLessons(),
          fetchWeeklyLeaderboard(currentWeekStart(), user.id),
          fetchTodayChallenge(),
          dashboardPromise.then(d => fetchDashboardExtras(user.id, d.latestScore, d.previousScore)),
        ])
        setData(dashboard)
        setExtras(dashboardExtras)
        // First incomplete lesson overall, ordered by order_number (already
        // the sort order fetchLessons returns) — the mobile "continue
        // learning" hero, independent of which subject it belongs to.
        // Reuses dashboardExtras.completedLessonIds (already computed
        // inside fetchDashboardExtras) instead of this page issuing its
        // own separate, identical fetchCompletedLessonIds query.
        setHeroLesson(allLessons.find(l => !dashboardExtras.completedLessonIds.has(l.id)) ?? null)

        setLeaderboardMe(leaderboard.me)
        setXpToNextRank(leaderboard.xpToNextRank)

        setTodayChallenge(challenge)
        if (challenge) {
          const [participants, result] = await Promise.all([
            fetchChallengeCompletionCount(challenge.id),
            fetchChallengeResult(challenge.id, user.id),
          ])
          setChallengeParticipants(participants)
          setChallengeCompleted(!!result)
        }
      } catch {
        setLoadError(true)
      } finally {
        setLoading(false)
      }
    }
    checkAuth()
  }, [router])

  if (loadError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#F4F6FA] px-6 text-center">
        <p className="text-sm font-semibold text-gray-600">Не удалось загрузить. Попробуй ещё раз.</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="flex min-h-11 items-center gap-1.5 rounded-xl bg-[#1B4FD8] px-5 py-2.5 text-sm font-bold text-white"
        >
          ↻ Попробовать ещё раз
        </button>
      </div>
    )
  }

  if (loading || !data || !extras) {
    return (
      <div className="min-h-screen bg-[#F4F6FA]">
        <div className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6">
          {/* Mobile skeleton — roughly mirrors the real section stack
              (hero, checklist, challenge/leaderboard, stats) instead of
              just 2-3 generic blocks, so the layout settles with less jank
              once the real data replaces it. */}
          <div className="block space-y-3 md:hidden">
            <div className="animate-pulse space-y-2">
              <div className="h-6 w-48 rounded bg-gray-200" />
              <div className="h-4 w-32 rounded bg-gray-200" />
            </div>
            <div className="h-40 animate-pulse rounded-2xl bg-gray-200" />
            <div className="h-32 animate-pulse rounded-2xl bg-gray-200" />
            <div className="h-24 animate-pulse rounded-2xl bg-gray-200" />
          </div>
          {/* Desktop skeleton */}
          <div className="hidden md:block">
            <div className="h-48 animate-pulse rounded-2xl bg-white" />
          </div>
        </div>
      </div>
    )
  }

  const firstName = (data.profile?.full_name ?? profileName ?? 'Студент').split(' ')[0]
  const targetScore = data.profile?.target_score ?? DEFAULT_TARGET_SCORE
  const continueHref = '/student/online/lessons'

  const handleGoalUpdate = (newGoal: number) => {
    setData(prev => prev ? {
      ...prev,
      profile: prev.profile ? { ...prev.profile, target_score: newGoal } : prev.profile,
    } : prev)
  }

  // ── Mobile "Сегодня" checklist data — real todayPlan/subjectTracks data,
  // just re-read into the 3 fixed rows the mobile spec calls for. ──────────
  const heroSubjectTrack = heroLesson
    ? data.subjectTracks.find(t => t.subject === heroLesson.subject)
    : null
  const lessonDoneToday = heroLesson ? (heroSubjectTrack?.lessonDoneToday ?? false) : true
  const practiceItem = extras.todayPlan.items.find(i => i.kind === 'practice')
  const challengeItem = extras.todayPlan.items.find(i => i.kind === 'mini_mock')

  return (
    <div className="min-h-screen bg-[#F4F6FA]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5 min-w-0">

        <AnnouncementBanner />

        {/* ============ MOBILE (< 768px) ============ */}
        <div className="block space-y-5 md:hidden">
          <MobileHero
            firstName={firstName}
            currentScore={data.latestScore ?? 0}
            targetScore={targetScore}
            heroLesson={heroLesson}
            loading={false}
          />

          <MobileTodayChecklist
            lessonDone={lessonDoneToday}
            lessonHref={heroLesson ? `/student/online/lessons/${heroLesson.id}` : '/student/online/lessons'}
            practiceDone={practiceItem?.done ?? false}
            practiceHref={practiceItem?.href ?? '/student/online/practice'}
            challengeDone={challengeItem?.done ?? false}
            challengeHref={challengeItem?.href ?? '/student/online/practice'}
          />

          {todayChallenge && (
            <MobileDailyChallengeCard
              questionCount={todayChallenge.question_count}
              minutes={Math.max(5, Math.round(todayChallenge.question_count * CHALLENGE_MIN_PER_QUESTION))}
              participantCount={challengeParticipants}
              completed={challengeCompleted}
              href="/student/online/practice/daily"
            />
          )}

          {leaderboardMe && (
            <MobileLeaderboardCard
              rank={leaderboardMe.rank}
              inTopTen={leaderboardMe.rank <= 10}
              xpToNextRank={xpToNextRank}
              href="/student/online/leaderboard"
            />
          )}

          <MobileStatsGrid stats={extras.weeklyStats} />

          {/* Below the fold — secondary, less prominent */}
          <AIMentorRecommendationCard recommendation={extras.aiRecommendation} compact />
          <ActivityHeatmap days={extras.heatmapDays} months={extras.heatmapMonths} collapsible />
          <RecentAchievementsCard achievements={extras.achievements} maxItems={2} />
        </div>

        {/* ============ DESKTOP (>= 768px) — unchanged ============ */}
        <div className="hidden md:block space-y-5">
          <DashboardHeroCard
            firstName={firstName}
            latestScore={data.latestScore}
            targetScore={targetScore}
            minutesRemaining={extras.todayPlan.minutesRemaining}
            ctaHref={continueHref}
            onGoalUpdate={handleGoalUpdate}
          />

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {/* Left column */}
            <div className="space-y-5 min-w-0">
              <TodayPlanCard plan={extras.todayPlan} />
              <WeeklyProgressCard stats={extras.weeklyStats} />
              <ActivityHeatmap days={extras.heatmapDays} months={extras.heatmapMonths} />
            </div>

            {/* Right column */}
            <div className="space-y-5 min-w-0">
              <SubjectsGrid subjects={extras.subjectsGrid} />
              <AIMentorRecommendationCard recommendation={extras.aiRecommendation} />
              <RecentAchievementsCard achievements={extras.achievements} />
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
