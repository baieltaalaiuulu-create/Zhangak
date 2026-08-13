import { useCallback, useEffect, useState } from 'react'
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl } from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import {
  completedLessonIds,
  computeLessonStatuses,
  fetchLessons,
  LESSON_SUBJECT_META,
  type LessonStatus,
  type LessonSubject,
  type PlatformLesson,
} from '@/lib/lessons'

const BRAND_BLUE = '#1B3F92'
const SECTIONS: LessonSubject[] = ['math', 'kyr', 'other']

interface LessonsState {
  lessons: PlatformLesson[]
  completedIds: Set<string>
}

async function loadLessons(): Promise<LessonsState> {
  const lessons = await fetchLessons()
  return { lessons, completedIds: completedLessonIds(lessons) }
}

function lessonDuration(lesson: PlatformLesson) {
  return lesson.durationMinutes === null ? 'Длительность не указана' : `${lesson.durationMinutes} мин`
}

function LessonRow({ lesson, status, onLockedPress }: { lesson: PlatformLesson; status: LessonStatus; onLockedPress: () => void }) {
  if (status === 'locked') {
    return (
      <Pressable style={styles.row} onPress={onLockedPress}>
        <Ionicons name="lock-closed" size={18} color="#D1D5DB" />
        <Text style={styles.rowTitleLocked} numberOfLines={1}>{lesson.lessonNumber}. {lesson.title}</Text>
      </Pressable>
    )
  }

  if (status === 'done') {
    return (
      <Pressable style={styles.row} onPress={() => router.push(`/(student)/lessons/${lesson.id}`)}>
        <Ionicons name="checkmark-circle" size={22} color="#16A34A" />
        <View style={styles.rowBody}>
          <View style={styles.rowTitleLine}>
            <Text style={styles.rowTitle} numberOfLines={1}>{lesson.lessonNumber}. {lesson.title}</Text>
            <View style={styles.doneBadge}><Text style={styles.doneBadgeText}>Пройден</Text></View>
          </View>
          <Text style={styles.rowMeta}>{lessonDuration(lesson)}</Text>
        </View>
      </Pressable>
    )
  }

  return (
    <Pressable style={[styles.row, styles.rowCurrent]} onPress={() => router.push(`/(student)/lessons/${lesson.id}`)}>
      <Ionicons name="play-circle" size={22} color={BRAND_BLUE} />
      <View style={styles.rowBody}>
        <Text style={styles.rowTitleBold} numberOfLines={2}>{lesson.lessonNumber}. {lesson.title}</Text>
        <Text style={styles.rowMeta}>{lessonDuration(lesson)}</Text>
      </View>
      <View style={styles.continueButton}>
        <Text style={styles.continueButtonText}>Продолжить</Text>
        <Ionicons name="chevron-forward" size={14} color="#fff" />
      </View>
    </Pressable>
  )
}

export default function LessonsScreen() {
  const [data, setData] = useState<LessonsState | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(false)
  const [openMap, setOpenMap] = useState<Partial<Record<LessonSubject, boolean>>>({})
  const [toast, setToast] = useState<string | null>(null)

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true)
    setError(false)
    try {
      setData(await loadLessons())
    } catch {
      setError(true)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const showToast = (message: string) => {
    setToast(message)
    setTimeout(() => setToast(null), 2200)
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={BRAND_BLUE} size="large" /></View>
  }

  if (error || !data) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Не удалось загрузить уроки. Попробуй ещё раз.</Text>
        <Pressable style={styles.retryButton} onPress={() => { void load() }}>
          <Text style={styles.retryButtonText}>Попробовать ещё раз</Text>
        </Pressable>
      </View>
    )
  }

  const statuses = computeLessonStatuses(data.lessons, data.completedIds)
  const total = data.lessons.length
  const completedCount = data.lessons.filter(lesson => data.completedIds.has(lesson.id)).length
  const currentLesson = data.lessons.find(lesson => statuses[lesson.id] === 'current')

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { void load(true) }} tintColor={BRAND_BLUE} />}
      >
        <View style={styles.card}>
          <Text style={styles.title}>Мои уроки</Text>
          <Text style={styles.subtitle}>Пройдено {completedCount}/{total}</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${total > 0 ? Math.round((completedCount / total) * 100) : 0}%` }]} />
          </View>
          {currentLesson && (
            <Pressable
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
              onPress={() => router.push(`/(student)/lessons/${currentLesson.id}`)}
            >
              <Text style={styles.primaryButtonText}>Продолжить обучение</Text>
            </Pressable>
          )}
        </View>

        {total === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="school-outline" size={28} color={BRAND_BLUE} />
            <Text style={styles.emptyTitle}>Уроки пока не назначены</Text>
            <Text style={styles.emptyDescription}>После добавления в учебную группу они появятся здесь.</Text>
          </View>
        ) : SECTIONS.map(subject => {
          const list = data.lessons.filter(lesson => lesson.subject === subject)
          if (list.length === 0) return null
          const completed = list.filter(lesson => data.completedIds.has(lesson.id)).length
          const open = openMap[subject] ?? (subject === currentLesson?.subject)
          const meta = LESSON_SUBJECT_META[subject]

          return (
            <View key={subject} style={styles.accordion}>
              <Pressable
                style={styles.accordionHeader}
                onPress={() => setOpenMap(previous => ({ ...previous, [subject]: !open }))}
              >
                <View style={[styles.accordionIcon, { backgroundColor: `${meta.color}18` }]}>
                  <Ionicons name={meta.icon} size={18} color={meta.color} />
                </View>
                <View style={styles.accordionHeaderBody}>
                  <View style={styles.accordionHeaderLine}>
                    <Text style={styles.accordionLabel}>{meta.label}</Text>
                    <Text style={styles.accordionCount}>{completed}/{list.length} уроков</Text>
                  </View>
                  <View style={styles.accordionProgressTrack}>
                    <View style={[styles.accordionProgressFill, { width: `${Math.round((completed / list.length) * 100)}%`, backgroundColor: meta.color }]} />
                  </View>
                </View>
                <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color="#9CA3AF" />
              </Pressable>

              {open && list.map(lesson => (
                <LessonRow
                  key={lesson.id}
                  lesson={lesson}
                  status={statuses[lesson.id]}
                  onLockedPress={() => showToast('Сначала пройди предыдущий урок')}
                />
              ))}
            </View>
          )
        })}
      </ScrollView>

      {toast && (
        <View style={styles.toast}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F6FA' },
  content: { padding: 16, paddingBottom: 32, gap: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F4F6FA', gap: 12, padding: 24 },
  errorText: { fontSize: 14, fontWeight: '600', color: '#4B5563', textAlign: 'center' },
  retryButton: { backgroundColor: BRAND_BLUE, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12 },
  retryButtonText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#F1F1F4' },
  title: { fontSize: 17, fontWeight: '800', color: '#191B23' },
  subtitle: { fontSize: 13, color: '#6B7280', marginTop: 4 },
  progressTrack: { height: 8, borderRadius: 999, backgroundColor: '#E5E7EB', marginTop: 8, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999, backgroundColor: BRAND_BLUE },
  primaryButton: { marginTop: 16, height: 52, borderRadius: 16, backgroundColor: BRAND_BLUE, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.85 },
  primaryButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  emptyCard: { alignItems: 'center', backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#F1F1F4', padding: 24 },
  emptyTitle: { marginTop: 10, color: '#191B23', fontSize: 16, fontWeight: '800', textAlign: 'center' },
  emptyDescription: { marginTop: 6, color: '#6B7280', fontSize: 13, lineHeight: 19, textAlign: 'center' },
  accordion: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#F1F1F4', overflow: 'hidden' },
  accordionHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, minHeight: 44 },
  accordionIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  accordionHeaderBody: { flex: 1 },
  accordionHeaderLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  accordionLabel: { fontSize: 14, fontWeight: '700', color: '#191B23' },
  accordionCount: { fontSize: 12, fontWeight: '600', color: '#9CA3AF' },
  accordionProgressTrack: { height: 6, borderRadius: 999, backgroundColor: '#E5E7EB', marginTop: 6, overflow: 'hidden' },
  accordionProgressFill: { height: '100%', borderRadius: 999, backgroundColor: BRAND_BLUE },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, minHeight: 64, borderTopWidth: 1, borderTopColor: '#F5F5F7' },
  rowCurrent: { backgroundColor: '#EEF2FF', borderLeftWidth: 4, borderLeftColor: BRAND_BLUE },
  rowBody: { flex: 1, minWidth: 0 },
  rowTitleLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowTitle: { flexShrink: 1, fontSize: 14, fontWeight: '600', color: '#374151' },
  rowTitleBold: { fontSize: 15, fontWeight: '700', color: '#191B23' },
  rowTitleLocked: { flex: 1, fontSize: 14, fontWeight: '600', color: '#9CA3AF' },
  rowMeta: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  doneBadge: { backgroundColor: '#DCFCE7', borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1 },
  doneBadgeText: { fontSize: 10, fontWeight: '700', color: '#16A34A' },
  continueButton: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: BRAND_BLUE, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  continueButtonText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  toast: {
    position: 'absolute', bottom: 24, left: 24, right: 24, backgroundColor: '#111827',
    borderRadius: 999, paddingVertical: 12, paddingHorizontal: 20, alignItems: 'center',
  },
  toastText: { color: '#fff', fontSize: 13, fontWeight: '600' },
})
