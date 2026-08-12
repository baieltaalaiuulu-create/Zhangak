import { NextRequest, NextResponse } from 'next/server'

import { requireRoleAuth, STUDENT_ROLES } from '@/lib/api-auth'
import type {
  AttendanceState,
  OfflineGrade,
  OfflineHomework,
  OfflineLesson,
  OfflineStudentDashboard,
  OfflineStudentType,
} from '@/lib/offline-student-contract'

export const dynamic = 'force-dynamic'

type Row = Record<string, unknown>

function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function number(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function idNumber(value: unknown): number | null {
  const parsed = number(value)
  return parsed != null && Number.isInteger(parsed) && parsed >= 0 ? parsed : null
}

function attendance(value: unknown): AttendanceState {
  return value === 'present' || value === 'late' || value === 'absent' ? value : 'pending'
}

function studentType(value: unknown): OfflineStudentType | null {
  return value === 'offline' || value === 'both' ? value : null
}

function topicList(row: Row): string[] {
  return [...new Set([row.math_topic, row.kyr_topic, row.reading_topic].map(text).filter((value): value is string => !!value))]
}

function emptyDashboard(profile: OfflineStudentDashboard['profile']): OfflineStudentDashboard {
  return {
    profile,
    group: null,
    lessons: [],
    homework: [],
    grades: [],
    progress: { latestOrtScore: null, targetScore: profile.targetScore },
    availability: { exactSchedule: false, materials: false },
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireRoleAuth(request, STUDENT_ROLES)
  if (!auth.authorized) return auth.response

  try {
    const { data: profileRow, error: profileError } = await auth.admin
      .from('profiles')
      .select('full_name, student_type, target_score')
      .eq('id', auth.user.id)
      .maybeSingle()

    const kind = studentType(profileRow?.student_type)
    if (profileError) return json({ error: 'Не удалось загрузить кабинет' }, 503)
    if (!profileRow || !kind) return json({ error: 'Офлайн-кабинет недоступен для этого аккаунта' }, 403)

    const profile: OfflineStudentDashboard['profile'] = {
      id: auth.user.id,
      fullName: text(profileRow.full_name) ?? 'Ученик',
      studentType: kind,
      targetScore: number(profileRow.target_score),
    }

    const { data: membership, error: membershipError } = await auth.admin
      .from('group_students')
      .select('group_id')
      .eq('student_id', auth.user.id)
      .order('group_id', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (membershipError) return json({ error: 'Не удалось загрузить группу' }, 503)
    const groupId = idNumber(membership?.group_id)
    if (groupId == null) return json(emptyDashboard(profile))

    const { data: groupRow, error: groupError } = await auth.admin
      .from('groups')
      .select('id, name, course_id, teacher_id')
      .eq('id', groupId)
      .maybeSingle()

    if (groupError || !groupRow) return json({ error: 'Не удалось загрузить группу' }, 503)
    const courseId = idNumber(groupRow.course_id)
    if (courseId == null) return json({ error: 'Для группы не назначен курс' }, 503)

    const teacherId = text(groupRow.teacher_id)
    const [courseResult, teacherResult, lessonsResult, attendanceResult, gradesResult, mockResult] = await Promise.all([
      auth.admin.from('courses').select('name').eq('id', courseId).maybeSingle(),
      teacherId
        ? auth.admin.from('profiles').select('full_name').eq('id', teacherId).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      auth.admin
        .from('lessons')
        .select('id, lesson_number, title, math_topic, kyr_topic, reading_topic, duration_minutes, lesson_date, is_test')
        .eq('course_id', courseId)
        .order('lesson_number', { ascending: true }),
      auth.admin.from('attendance').select('lesson_id, status').eq('student_id', auth.user.id),
      auth.admin
        .from('test_results')
        .select('lesson_id, math_score, analogy_score, reading_score, grammar_score, total_score')
        .eq('student_id', auth.user.id),
      auth.admin
        .from('practice_results')
        .select('total_score')
        .eq('student_id', auth.user.id)
        .eq('test_type', 'mock')
        .not('completed_at', 'is', null)
        .order('completed_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

    if (courseResult.error || teacherResult.error || lessonsResult.error || attendanceResult.error || gradesResult.error || mockResult.error) {
      return json({ error: 'Не удалось загрузить данные кабинета' }, 503)
    }

    const attendanceByLesson = new Map<number, AttendanceState>()
    for (const raw of attendanceResult.data ?? []) {
      const row = raw as Row
      const lessonId = idNumber(row.lesson_id)
      if (lessonId != null) attendanceByLesson.set(lessonId, attendance(row.status))
    }

    const lessons: OfflineLesson[] = []
    const lessonTitleById = new Map<number, string>()
    for (const raw of lessonsResult.data ?? []) {
      const row = raw as Row
      const lessonId = idNumber(row.id)
      if (lessonId == null) continue
      const title = text(row.title) ?? `Урок ${idNumber(row.lesson_number) ?? lessons.length + 1}`
      lessonTitleById.set(lessonId, title)
      lessons.push({
        id: lessonId,
        lessonNumber: idNumber(row.lesson_number) ?? lessons.length + 1,
        title,
        startsAt: text(row.lesson_date),
        durationMinutes: number(row.duration_minutes),
        isTest: row.is_test === true,
        attendance: attendanceByLesson.get(lessonId) ?? 'pending',
        topics: topicList(row),
      })
    }

    const lessonIds = lessons.map(lesson => lesson.id)
    const homeworkResult = lessonIds.length > 0
      ? await auth.admin
          .from('homeworks')
          .select('id, lesson_id, title, description, due_date, homework_submissions(student_id)')
          .in('lesson_id', lessonIds)
          .order('due_date', { ascending: true, nullsFirst: false })
      : { data: [], error: null }

    if (homeworkResult.error) return json({ error: 'Не удалось загрузить домашние задания' }, 503)

    const homework: OfflineHomework[] = (homeworkResult.data ?? []).flatMap(raw => {
      const row = raw as Row
      const homeworkId = idNumber(row.id)
      const lessonId = idNumber(row.lesson_id)
      if (homeworkId == null || lessonId == null) return []
      const submissions = Array.isArray(row.homework_submissions) ? row.homework_submissions as Row[] : []
      return [{
        id: homeworkId,
        lessonId,
        lessonTitle: lessonTitleById.get(lessonId) ?? 'Урок',
        title: text(row.title) ?? 'Домашнее задание',
        description: text(row.description),
        dueAt: text(row.due_date),
        completed: submissions.some(submission => submission.student_id === auth.user.id),
      }]
    })

    const grades: OfflineGrade[] = (gradesResult.data ?? []).flatMap(raw => {
      const row = raw as Row
      const lessonId = idNumber(row.lesson_id)
      if (lessonId == null) return []
      return [{
        lessonId,
        lessonTitle: lessonTitleById.get(lessonId) ?? 'Контрольная работа',
        math: number(row.math_score),
        analogy: number(row.analogy_score),
        reading: number(row.reading_score),
        grammar: number(row.grammar_score),
        total: number(row.total_score),
      }]
    })

    const dashboard: OfflineStudentDashboard = {
      profile,
      group: {
        id: groupId,
        name: text(groupRow.name) ?? 'Учебная группа',
        courseName: text(courseResult.data?.name),
        teacherName: text(teacherResult.data?.full_name),
      },
      lessons,
      homework,
      grades,
      progress: {
        latestOrtScore: number(mockResult.data?.total_score),
        targetScore: profile.targetScore,
      },
      availability: {
        exactSchedule: lessons.some(lesson => lesson.startsAt?.includes('T') ?? false),
        materials: false,
      },
    }

    return json(dashboard)
  } catch {
    return json({ error: 'Сервис временно недоступен' }, 503)
  }
}
