import { useCallback, useEffect, useState } from 'react'
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl } from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
import { fetchLessons, fetchCompletedLessonIds, LESSON_SUBJECT_META } from '@/lib/lessons'
import type { PracticeLesson } from '@/lib/supabase'

const BRAND_BLUE = '#1B4FD8'
const DEFAULT_TARGET_SCORE = 180

interface TodayItem {
  label: string
  done: boolean
}

interface DashboardState {
  firstName: string
  latestScore: number
  targetScore: number
  heroLesson: PracticeLesson | null
  today: TodayItem[]
}

async function loadDashboard(studentId: string): Promise<DashboardState> {
  const [{ data: profile }, { data: mockResults }, lessons, completedIds, { data: todayResults }] = await Promise.all([
    supabase.from('profiles').select('full_name, target_score').eq('id', studentId).single(),
    supabase
      .from('practice_results')
      .select('total_score')
      .eq('student_id', studentId)
      .eq('test_type', 'mock')
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false })
      .limit(1),
    fetchLessons(),
    fetchCompletedLessonIds(studentId),
    supabase
      .from('practice_results')
      .select('lesson_id, math_raw_score, math_comparison_score, analogy_score, completed_at')
      .eq('student_id', studentId)
      .not('completed_at', 'is', null)
      .gte('completed_at', new Date().toISOString().slice(0, 10)),
  ])

  const heroLesson = lessons.find(l => !completedIds.has(l.id)) ?? null
  const today = todayResults ?? []

  const lessonDoneToday = heroLesson ? today.some(r => r.lesson_id === heroLesson.id) : true
  const practiceDoneToday = today.some(r => (r.math_raw_score ?? 0) > 0 || (r.math_comparison_score ?? 0) > 0)
  const challengeDoneToday = today.some(r => (r.analogy_score ?? 0) > 0)

  return {
    firstName: (profile?.full_name ?? 'Студент').split(' ')[0],
    latestScore: mockResults?.[0]?.total_score ?? 0,
    targetScore: profile?.target_score ?? DEFAULT_TARGET_SCORE,
    heroLesson,
    today: [
      { label: 'Урок', done: lessonDoneToday },
      { label: 'Практика', done: practiceDoneToday },
      { label: 'Задание дня', done: challengeDoneToday },
    ],
  }
}

export default function DashboardScreen() {
  const [state, setState] = useState<DashboardState | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(false)

  const load = useCallback(async (isRefresh = false) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.replace('/(auth)/login'); return }

    isRefresh ? setRefreshing(true) : setLoading(true)
    setError(false)
    try {
      setState(await loadDashboard(user.id))
    } catch {
      setError(true)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={BRAND_BLUE} size="large" />
      </View>
    )
  }

  if (error || !state) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Не удалось загрузить. Попробуй ещё раз.</Text>
        <Pressable style={styles.retryButton} onPress={() => load()}>
          <Text style={styles.retryButtonText}>↻ Попробовать ещё раз</Text>
        </Pressable>
      </View>
    )
  }

  const pct = state.targetScore > 0 ? Math.min(100, Math.round((state.latestScore / state.targetScore) * 100)) : 0
  const doneCount = state.today.filter(i => i.done).length
  const meta = state.heroLesson ? LESSON_SUBJECT_META[state.heroLesson.subject] : null

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={BRAND_BLUE} />}
    >
      <Text style={styles.greeting}>Салам, {state.firstName} 👋</Text>
      <Text style={styles.scoreLine}>ОРТ максаты: {state.latestScore} → {state.targetScore}</Text>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${pct}%` }]} />
      </View>

      {state.heroLesson && meta ? (
        <View style={styles.card}>
          <Text style={styles.eyebrow}>ПРОДОЛЖИТЬ ОБУЧЕНИЕ</Text>
          <View style={[styles.badge, { backgroundColor: `${meta.color}1A` }]}>
            <Text style={[styles.badgeText, { color: meta.color }]}>{meta.icon} {meta.label}</Text>
          </View>
          <Text style={styles.lessonTitle}>{state.heroLesson.title}</Text>
          <Text style={styles.lessonMeta}>~25 мин</Text>
          <Pressable
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
            onPress={() => router.push(`/(student)/lessons/${state.heroLesson!.id}`)}
          >
            <Ionicons name="play" size={18} color="#fff" />
            <Text style={styles.primaryButtonText}>Продолжить урок</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.lessonTitle}>🎉 Все уроки пройдены!</Text>
          <Pressable style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]} onPress={() => router.push('/(student)/practice')}>
            <Text style={styles.primaryButtonText}>Открыть тренажёр →</Text>
          </Pressable>
        </View>
      )}

      <View style={styles.card}>
        <View style={styles.todayHeader}>
          <Text style={styles.todayTitle}>Сегодня</Text>
          <Text style={styles.todayCounter}>{doneCount} из {state.today.length} выполнено</Text>
        </View>
        {state.today.map(item => (
          <View key={item.label} style={styles.todayRow}>
            <Ionicons
              name={item.done ? 'checkmark-circle' : 'ellipse-outline'}
              size={22}
              color={item.done ? '#16A34A' : '#D1D5DB'}
            />
            <Text style={[styles.todayLabel, item.done && styles.todayLabelDone]}>{item.label}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F6FA' },
  content: { padding: 16, paddingBottom: 32, gap: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F4F6FA', gap: 12, padding: 24 },
  errorText: { fontSize: 14, fontWeight: '600', color: '#4B5563', textAlign: 'center' },
  retryButton: { backgroundColor: BRAND_BLUE, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12 },
  retryButtonText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  greeting: { fontSize: 20, fontWeight: '800', color: '#191B23' },
  scoreLine: { fontSize: 14, color: '#6B7280', marginTop: 4 },
  progressTrack: { height: 8, borderRadius: 999, backgroundColor: '#E5E7EB', marginTop: 8, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999, backgroundColor: BRAND_BLUE },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#F1F1F4' },
  eyebrow: { fontSize: 11, fontWeight: '700', color: '#9CA3AF', letterSpacing: 0.5, textTransform: 'uppercase' },
  badge: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, marginTop: 8 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  lessonTitle: { fontSize: 17, fontWeight: '800', color: '#191B23', marginTop: 8 },
  lessonMeta: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  primaryButton: {
    marginTop: 16, height: 52, borderRadius: 16, backgroundColor: BRAND_BLUE,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  pressed: { opacity: 0.85 },
  primaryButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  todayHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  todayTitle: { fontSize: 14, fontWeight: '800', color: '#191B23' },
  todayCounter: { fontSize: 12, fontWeight: '600', color: '#9CA3AF' },
  todayRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
  todayLabel: { fontSize: 15, fontWeight: '600', color: '#191B23' },
  todayLabelDone: { color: '#9CA3AF', textDecorationLine: 'line-through' },
})
