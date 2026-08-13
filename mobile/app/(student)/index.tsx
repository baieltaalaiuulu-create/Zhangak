import { useCallback, useEffect, useState } from 'react'
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl } from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import {
  completedLessonIds,
  fetchLessons,
  fetchPlatformDashboard,
  LESSON_SUBJECT_META,
  type PlatformLesson,
} from '@/lib/lessons'
import { useNativeAuth } from '@/components/NativeAuthProvider'

const BRAND_BLUE = '#1B4FD8'

interface ProgressItem {
  label: string
  done: boolean
}

interface DashboardState {
  firstName: string
  targetScore: number | null
  lessonCompleted: number
  lessonTotal: number
  lessonCompletionPercent: number
  practiceAttempts: number
  heroLesson: PlatformLesson | null
  progressItems: ProgressItem[]
}

async function loadDashboard(): Promise<DashboardState> {
  const [dashboard, lessons] = await Promise.all([fetchPlatformDashboard(), fetchLessons()])
  const completedIds = completedLessonIds(lessons)
  const heroLesson = lessons.find(lesson => !completedIds.has(lesson.id)) ?? null
  const { summary } = dashboard

  return {
    firstName: dashboard.profile.fullName.split(' ')[0] || 'Студент',
    targetScore: dashboard.profile.targetScore,
    lessonCompleted: summary.lessons.completed,
    lessonTotal: summary.lessons.total,
    lessonCompletionPercent: summary.lessons.completionPercent,
    practiceAttempts: summary.practice.attempts,
    heroLesson,
    // These values come only from the owned dashboard aggregate. We do not
    // infer a fake daily challenge or convert a practice percentage into an
    // ORT score while those product slices are not part of the native app.
    progressItems: [
      {
        label: `Уроки: ${summary.lessons.completed}/${summary.lessons.total}`,
        done: summary.lessons.total > 0 && summary.lessons.completed >= summary.lessons.total,
      },
      {
        label: summary.practice.attempts > 0
          ? `Практика: ${summary.practice.attempts} попыток`
          : 'Практика: пока нет попыток',
        done: summary.practice.attempts > 0,
      },
    ],
  }
}

export default function DashboardScreen() {
  const [state, setState] = useState<DashboardState | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const { signOut } = useNativeAuth()

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true)
    setError(false)
    try {
      setState(await loadDashboard())
    } catch {
      setError(true)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const handleSignOut = async () => {
    setSigningOut(true)
    await signOut()
    router.replace('/(auth)/login')
  }

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
        <Text style={styles.errorText}>Не удалось загрузить учебный прогресс. Попробуй ещё раз.</Text>
        <Pressable style={styles.retryButton} onPress={() => { void load() }}>
          <Text style={styles.retryButtonText}>Попробовать ещё раз</Text>
        </Pressable>
      </View>
    )
  }

  const completedItems = state.progressItems.filter(item => item.done).length
  const meta = state.heroLesson ? LESSON_SUBJECT_META[state.heroLesson.subject] : null
  const goalText = state.targetScore === null ? 'Цель по ОРТ: пока не указана' : `Цель по ОРТ: ${state.targetScore}`

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { void load(true) }} tintColor={BRAND_BLUE} />}
    >
      <View style={styles.greetingRow}>
        <Text style={styles.greeting}>Салам, {state.firstName}</Text>
        <Pressable
          accessibilityLabel="Выйти из аккаунта"
          accessibilityRole="button"
          disabled={signingOut}
          onPress={() => { void handleSignOut() }}
          style={({ pressed }) => [styles.signOutButton, (pressed || signingOut) && styles.pressed]}
        >
          {signingOut ? <ActivityIndicator color="#64748B" size="small" /> : <Ionicons name="log-out-outline" size={20} color="#64748B" />}
        </Pressable>
      </View>
      <Text style={styles.scoreLine}>{goalText}</Text>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${state.lessonCompletionPercent}%` }]} />
      </View>
      <Text style={styles.progressCaption}>Уроки: {state.lessonCompleted} из {state.lessonTotal}</Text>

      {state.heroLesson && meta ? (
        <View style={styles.card}>
          <Text style={styles.eyebrow}>ПРОДОЛЖИТЬ ОБУЧЕНИЕ</Text>
          <View style={[styles.badge, { backgroundColor: `${meta.color}1A` }]}>
            <Ionicons name={meta.icon} size={15} color={meta.color} />
            <Text style={[styles.badgeText, { color: meta.color }]}>{meta.label}</Text>
          </View>
          <Text style={styles.lessonTitle}>{state.heroLesson.title}</Text>
          <Text style={styles.lessonMeta}>
            {state.heroLesson.durationMinutes === null ? 'Длительность не указана' : `${state.heroLesson.durationMinutes} мин`}
          </Text>
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
          <Text style={styles.lessonTitle}>
            {state.lessonTotal === 0 ? 'Уроки пока не назначены' : 'Все доступные уроки пройдены'}
          </Text>
          <Text style={styles.emptyDescription}>
            {state.lessonTotal === 0
              ? 'После добавления в учебную группу уроки появятся здесь.'
              : 'Открой раздел уроков, чтобы повторить материал.'}
          </Text>
          <Pressable style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]} onPress={() => router.push('/(student)/lessons')}>
            <Text style={styles.primaryButtonText}>Открыть уроки</Text>
          </Pressable>
        </View>
      )}

      <View style={styles.card}>
        <View style={styles.todayHeader}>
          <Text style={styles.todayTitle}>Мой прогресс</Text>
          <Text style={styles.todayCounter}>{completedItems} из {state.progressItems.length} этапов</Text>
        </View>
        {state.progressItems.map(item => (
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
  greetingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  greeting: { flex: 1, fontSize: 20, fontWeight: '800', color: '#191B23' },
  signOutButton: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  scoreLine: { fontSize: 14, color: '#6B7280', marginTop: 4 },
  progressTrack: { height: 8, borderRadius: 999, backgroundColor: '#E5E7EB', marginTop: 8, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999, backgroundColor: BRAND_BLUE },
  progressCaption: { fontSize: 12, fontWeight: '600', color: '#6B7280', marginTop: -10 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#F1F1F4' },
  eyebrow: { fontSize: 11, fontWeight: '700', color: '#9CA3AF', letterSpacing: 0.5, textTransform: 'uppercase' },
  badge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, marginTop: 8 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  lessonTitle: { fontSize: 17, fontWeight: '800', color: '#191B23', marginTop: 8 },
  lessonMeta: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  emptyDescription: { fontSize: 14, color: '#6B7280', marginTop: 6, lineHeight: 20 },
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
