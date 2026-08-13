import { useCallback, useEffect, useState } from 'react'
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import {
  completedLessonIds,
  fetchLessonById,
  fetchLessons,
  LESSON_SUBJECT_META,
  type PlatformLesson,
} from '@/lib/lessons'
import LessonVideoPlayer from '@/components/LessonVideoPlayer'

const BRAND_BLUE = '#1B4FD8'

interface DetailState {
  lesson: PlatformLesson
  isCompleted: boolean
  nextLesson: PlatformLesson | null
}

async function loadLesson(lessonId: string): Promise<DetailState> {
  const [lesson, allLessons] = await Promise.all([fetchLessonById(lessonId), fetchLessons()])
  const completedIds = completedLessonIds(allLessons)
  const sameTrack = allLessons
    .filter(item => item.courseId === lesson.courseId && item.subject === lesson.subject)
    .sort((left, right) => left.lessonNumber - right.lessonNumber || left.apiId - right.apiId)
  const index = sameTrack.findIndex(item => item.id === lesson.id)
  const nextLesson = index >= 0 ? sameTrack[index + 1] ?? null : null

  return { lesson, isCompleted: completedIds.has(lesson.id), nextLesson }
}

export default function LessonDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [state, setState] = useState<DetailState | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(false)
    try {
      setState(await loadLesson(id))
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { void load() }, [load])

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={BRAND_BLUE} size="large" /></View>
  }

  if (error || !state) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Не удалось загрузить урок. Попробуй ещё раз.</Text>
        <Pressable style={styles.retryButton} onPress={() => { void load() }}>
          <Text style={styles.retryButtonText}>Попробовать ещё раз</Text>
        </Pressable>
      </View>
    )
  }

  const meta = LESSON_SUBJECT_META[state.lesson.subject]
  const duration = state.lesson.durationMinutes === null ? 'Длительность не указана' : `${state.lesson.durationMinutes} мин`

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Pressable onPress={() => router.back()} style={styles.backRow}>
        <Ionicons name="chevron-back" size={18} color="#6B7280" />
        <Text style={styles.backText}>Ко всем урокам</Text>
      </Pressable>

      <LessonVideoPlayer videoUrl={state.lesson.videoUrl} />

      <View style={styles.card}>
        <View style={[styles.badge, { backgroundColor: `${meta.color}1A` }]}>
          <Ionicons name={meta.icon} size={15} color={meta.color} />
          <Text style={[styles.badgeText, { color: meta.color }]}>{meta.label}</Text>
        </View>
        <Text style={styles.title}>{state.lesson.title}</Text>
        <Text style={styles.duration}>{duration}</Text>
        {state.lesson.description && <Text style={styles.description}>{state.lesson.description}</Text>}
      </View>

      {state.isCompleted ? (
        <View style={styles.card}>
          <Text style={styles.doneText}>Урок пройден</Text>
          {state.nextLesson ? (
            <Pressable
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
              onPress={() => router.push(`/(student)/lessons/${state.nextLesson!.id}`)}
            >
              <Text style={styles.primaryButtonText}>Следующий урок</Text>
            </Pressable>
          ) : (
            <Text style={styles.description}>Это последний доступный урок в этом разделе.</Text>
          )}
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.eyebrow}>ПРОГРЕСС</Text>
          <Text style={styles.description}>
            Прогресс этого урока: {state.lesson.completionPercent}%.
          </Text>
          <Text style={styles.migrationNote}>
            Мобильный тренажёр для завершения урока ещё подключается. Результат появится после серверной проверки попытки, а не по открытию страницы.
          </Text>
          {state.lesson.isTest && <Text style={styles.migrationNote}>Этот урок содержит тестовый материал.</Text>}
        </View>
      )}
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
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 44 },
  backText: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#F1F1F4' },
  badge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  title: { fontSize: 18, fontWeight: '800', color: '#191B23', marginTop: 10 },
  duration: { fontSize: 13, fontWeight: '600', color: '#64748B', marginTop: 6 },
  description: { fontSize: 14, color: '#6B7280', marginTop: 6, lineHeight: 20 },
  eyebrow: { fontSize: 11, fontWeight: '700', color: '#9CA3AF', letterSpacing: 0.5, textTransform: 'uppercase' },
  doneText: { fontSize: 15, fontWeight: '700', color: '#16A34A' },
  migrationNote: { fontSize: 13, color: '#64748B', marginTop: 10, lineHeight: 19 },
  primaryButton: { marginTop: 16, height: 52, borderRadius: 16, backgroundColor: BRAND_BLUE, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.85 },
  primaryButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
})
