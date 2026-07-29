import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import StatsCard from '@/components/student/StatsCard'
import StreakWidget from '@/components/student/StreakWidget'
import SubjectProgressCard from '@/components/student/SubjectProgressCard'
import RecentTestsTable from '@/components/student/RecentTestsTable'
import LeaderboardWidget from '@/components/student/LeaderboardWidget'
import SubscriptionBanner from '@/components/student/SubscriptionBanner'
import { BookOpen, Trophy, Target, Zap } from 'lucide-react'

// Типы для данных дашборда
interface SubjectProgress {
  subject_id: string
  subject_name: string
  completed_lessons: number
  total_lessons: number
  average_score: number
  color: string
}

interface MockTest {
  id: string
  title: string
  score: number
  max_score: number
  created_at: string
  subject_name: string
}

interface StreakData {
  current_streak: number
  longest_streak: number
  last_activity: string
}

interface LeaderboardEntry {
  rank: number
  full_name: string
  avatar_url: string | null
  score: number
  is_current_user: boolean
}

interface SubscriptionData {
  status: 'active' | 'expired' | 'trial'
  expires_at: string | null
  plan_name: string | null
}

export default async function StudentDashboardPage() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Параллельно загружаем все данные
  const [
    profileResult,
    streakResult,
    subjectsProgressResult,
    recentTestsResult,
    leaderboardResult,
    subscriptionResult,
    totalLessonsResult,
    completedHomeworkResult,
  ] = await Promise.all([
    // Профиль
    supabase
      .from('profiles')
      .select('full_name, avatar_url, grade')
      .eq('id', user.id)
      .single(),

    // Стрик
    supabase
      .from('streaks')
      .select('current_streak, longest_streak, last_activity')
      .eq('user_id', user.id)
      .single(),

    // Прогресс по предметам
    supabase
      .from('enrollments')
      .select(`
        courses (
          id,
          subject_id,
          subjects (
            id,
            name,
            color
          ),
          lessons (count)
        ),
        progress_percentage,
        completed_lessons_count
      `)
      .eq('student_id', user.id),

    // Последние тесты
    supabase
      .from('mock_tests')
      .select(`
        id,
        title,
        score,
        max_score,
        created_at,
        subjects (name)
      `)
      .eq('student_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5),

    // Рейтинг топ-5 + текущий пользователь
    supabase
      .from('leaderboard_entries')
      .select(`
        rank,
        score,
        user_id,
        profiles (full_name, avatar_url)
      `)
      .order('rank', { ascending: true })
      .limit(5),

    // Подписка
    supabase
      .from('subscriptions')
      .select('status, expires_at, plan_name')
      .eq('user_id', user.id)
      .single(),

    // Всего уроков пройдено
    supabase
      .from('practice_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('student_id', user.id)
      .eq('status', 'completed'),

    // Выполнено ДЗ
    supabase
      .from('practice_results')
      .select('*', { count: 'exact', head: true })
      .eq('student_id', user.id)
      .eq('passed', true),
  ])

  const profile = profileResult.data
  const streak = streakResult.data as StreakData | null
  const recentTests = (recentTestsResult.data ?? []) as unknown as MockTest[]
  const subscription = subscriptionResult.data as SubscriptionData | null
  const totalCompleted = totalLessonsResult.count ?? 0
  const completedHomework = completedHomeworkResult.count ?? 0

  // Форматируем прогресс по предметам
  const subjectsProgress: SubjectProgress[] = []
  if (subjectsProgressResult.data) {
    for (const enrollment of subjectsProgressResult.data) {
      const course = enrollment.courses

=== Backend Developer ===
# ZHANGAK — Student Dashboard Implementation

Полная реализация личного кабинета ученика.

---

[FILE: supabase/migrations/20241201_student_dashboard.sql]