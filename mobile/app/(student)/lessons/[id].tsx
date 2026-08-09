import { useCallback, useEffect, useState } from 'react'
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
import { fetchLessonById, fetchLessons, fetchCompletedLessonIds, fetchQuestionCount, LESSON_SUBJECT_META } from '@/lib/lessons'
import type { PracticeLesson } from '@/lib/supabase'
import LessonVideoPlayer from '@/components/LessonVideoPlayer'

const BRAND_BLUE = '#1B4FD8'

interface DetailState {
  lesson: PracticeLesson
  isCompleted: boolean
  questionCount: number
  nextLesson: PracticeLesson | null
}

async function loadLesson(lessonId: string, studentId: string): Promise<DetailState | null> {
  const [lesson, allLessons, completedIds] = await Promise.all([
    fetchLessonById(lessonId),
    fetchLessons(),
    fetchCompletedLessonIds(studentId),
  ])
  if (!lesson) return null

  const questionCount = await fetchQuestionCount(lesson.id)
  const sameSubject = allLessons.filter(l => l.subject === lesson.subject)
  const idx = sameSubject.findIndex(l => l.id === lesson.id)
  const nextLesson = idx >= 0 ? sameSubject[idx + 1] ?? null : null

  return { lesson, isCompleted: completedIds.has(lesson.id), questionCount, nextLesson }
}

export default function LessonDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [state, setState] = useState<DetailState | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.replace('/(auth)/login'); return }

    setLoading(true)
    setError(false)
    try {
      const result = await loadLesson(id, user.id)
      if (!result) { setError(true); return }
      setState(result)

      // Mirrors the web app's markLessonStarted — logs that this lesson
      // was opened (a practice_results row with no score, so it never
      // counts as "completed" via completed_at, which stays null here).
      await supabase.from('practice_results').insert({
        student_id: user.id, lesson_id: result.lesson.id, test_type: 'practice',
      })
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={BRAND_BLUE} size="large" /></View>
  }

  if (error || !state) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Не удалось загрузить. Попробуй ещё раз.</Text>
        <Pressable style={styles.retryButton} onPress={load}>
          <Text style={styles.retryButtonText}>↻ Попробовать ещё раз</Text>
        </Pressable>
      </View>
    )
  }

  const meta = LESSON_SUBJECT_META[state.lesson.subject]

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Pressable onPress={() => router.back()} style={styles.backRow}>
        <Ionicons name="chevron-back" size={18} color="#6B7280" />
        <Text style={styles.backText}>Ко всем урокам</Text>
      </Pressable>

      <LessonVideoPlayer videoUrl={state.lesson.video_url} />

      <View style={styles.card}>
        <View style={[styles.badge, { backgroundColor: `${meta.color}1A` }]}>
          <Text style={[styles.badgeText, { color: meta.color }]}>{meta.icon} {meta.label}</Text>
        </View>
        <Text style={styles.title}>{state.lesson.title}</Text>
        {state.lesson.description && <Text style={styles.description}>{state.lesson.description}</Text>}
      </View>

      {state.isCompleted ? (
        <View style={styles.card}>
          <Text style={styles.doneText}>✓ Урок пройден</Text>
          {state.nextLesson ? (
            <Pressable
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
              onPress={() => router.push(`/(student)/lessons/${state.nextLesson!.id}`)}
            >
              <Text style={styles.primaryButtonText}>Следующий урок →</Text>
            </Pressable>
          ) : (
            <Text style={styles.description}>Это был последний урок в разделе 🎓</Text>
          )}
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.eyebrow}>ПРАКТИКА</Text>
          <Text style={styles.description}>
            {state.questionCount > 0 ? `${state.questionCount} вопросов` : 'Практика к этому уроку скоро появится'}
          </Text>
          {state.questionCount > 0 && (
            <Pressable
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
              onPress={() => router.push('/(student)/practice')}
            >
              <Text style={styles.primaryButtonText}>Начать практику</Text>
            </Pressable>
          )}
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
  badge: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  title: { fontSize: 18, fontWeight: '800', color: '#191B23', marginTop: 10 },
  description: { fontSize: 14, color: '#6B7280', marginTop: 6, lineHeight: 20 },
  eyebrow: { fontSize: 11, fontWeight: '700', color: '#9CA3AF', letterSpacing: 0.5, textTransform: 'uppercase' },
  doneText: { fontSize: 15, fontWeight: '700', color: '#16A34A' },
  primaryButton: { marginTop: 16, height: 52, borderRadius: 16, backgroundColor: BRAND_BLUE, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.85 },
  primaryButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
})
