import { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'

import { requireRoleAuth, TEACHER_ROLES } from '@/lib/api-auth'
import { JsonBodyError, readJsonObject } from '@/lib/server-json'
import {
  gradeTotal,
  parseAttendanceEntries,
  parseGradeEntries,
  type TeacherAttendanceStatus,
  type TeacherGroupSummary,
  type TeacherGroupWorkspace,
} from '@/lib/teacher-contract'

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

function integer(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : Number.NaN
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null
}

function finite(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function topics(row: Row): string[] {
  return [...new Set([row.math_topic, row.kyr_topic, row.reading_topic].map(text).filter((value): value is string => !!value))]
}

async function ownGroup(admin: SupabaseClient, teacherId: string, groupId: number) {
  const { data, error } = await admin
    .from('groups')
    .select('id, name, course_id, teacher_id')
    .eq('id', groupId)
    .eq('teacher_id', teacherId)
    .maybeSingle()
  if (error) return { error: json({ error: 'Не удалось проверить группу' }, 503) }
  if (!data) return { error: json({ error: 'Группа не найдена' }, 404) }
  const courseId = integer(data.course_id)
  if (!courseId) return { error: json({ error: 'Для группы не назначен курс' }, 409) }
  return { group: data as Row, courseId }
}

async function ownLesson(admin: SupabaseClient, courseId: number, lessonId: number) {
  const { data, error } = await admin
    .from('lessons')
    .select('id, course_id, is_test')
    .eq('id', lessonId)
    .eq('course_id', courseId)
    .maybeSingle()
  if (error) return { error: json({ error: 'Не удалось проверить урок' }, 503) }
  if (!data) return { error: json({ error: 'Урок не найден в этой группе' }, 404) }
  return { lesson: data as Row }
}

async function groupStudentIds(admin: SupabaseClient, groupId: number): Promise<{ ids: Set<string> } | { error: NextResponse }> {
  const { data, error } = await admin.from('group_students').select('student_id').eq('group_id', groupId)
  if (error) return { error: json({ error: 'Не удалось проверить учеников группы' }, 503) }
  return { ids: new Set((data ?? []).map(row => String(row.student_id))) }
}

function groupSummary(group: Row, course: Row | null): TeacherGroupSummary | null {
  const id = integer(group.id)
  const courseId = integer(group.course_id)
  if (!id || !courseId) return null
  return {
    id,
    name: text(group.name) ?? 'Учебная группа',
    courseId,
    courseName: text(course?.name),
    level: text(course?.level),
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireRoleAuth(request, TEACHER_ROLES)
  if (!auth.authorized) return auth.response

  const queryKeys = [...request.nextUrl.searchParams.keys()]
  if (queryKeys.some(key => key !== 'groupId') || queryKeys.filter(key => key === 'groupId').length > 1) {
    return json({ error: 'Некорректные параметры' }, 400)
  }
  const rawGroupId = request.nextUrl.searchParams.get('groupId')
  if (rawGroupId == null) {
    try {
      const { data: groups, error } = await auth.admin
        .from('groups')
        .select('id, name, course_id, courses(name, level)')
        .eq('teacher_id', auth.user.id)
        .order('name', { ascending: true })
      if (error) return json({ error: 'Не удалось загрузить группы' }, 503)
      const result = (groups ?? []).flatMap(raw => {
        const row = raw as unknown as Row
        const relation = Array.isArray(row.courses) ? row.courses[0] : row.courses
        const summary = groupSummary(row, relation && typeof relation === 'object' ? relation as Row : null)
        return summary ? [summary] : []
      })
      return json({ groups: result })
    } catch {
      return json({ error: 'Сервис временно недоступен' }, 503)
    }
  }

  const groupId = integer(rawGroupId)
  if (!groupId) return json({ error: 'Некорректная группа' }, 400)

  try {
    const ownership = await ownGroup(auth.admin, auth.user.id, groupId)
    if ('error' in ownership) return ownership.error

    const [courseResult, lessonsResult, studentsResult] = await Promise.all([
      auth.admin.from('courses').select('name, level').eq('id', ownership.courseId).maybeSingle(),
      auth.admin
        .from('lessons')
        .select('id, lesson_number, title, lesson_date, duration_minutes, is_test, math_topic, kyr_topic, reading_topic')
        .eq('course_id', ownership.courseId)
        .order('lesson_number', { ascending: true }),
      auth.admin
        .from('group_students')
        .select('student_id, profiles(full_name, phone)')
        .eq('group_id', groupId),
    ])
    if (courseResult.error || lessonsResult.error || studentsResult.error) return json({ error: 'Не удалось загрузить группу' }, 503)

    const group = groupSummary(ownership.group, courseResult.data as Row | null)
    if (!group) return json({ error: 'Некорректные данные группы' }, 503)

    const students = (studentsResult.data ?? []).flatMap(raw => {
      const row = raw as unknown as Row
      const id = text(row.student_id)
      const relation = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
      const profile = relation && typeof relation === 'object' ? relation as Row : null
      return id ? [{ id, fullName: text(profile?.full_name) ?? 'Ученик', phone: text(profile?.phone) }] : []
    }).sort((a, b) => a.fullName.localeCompare(b.fullName, 'ru'))
    const allowedStudentIds = new Set(students.map(student => student.id))

    const lessons = (lessonsResult.data ?? []).flatMap(raw => {
      const row = raw as Row
      const id = integer(row.id)
      if (!id) return []
      return [{
        id,
        lessonNumber: integer(row.lesson_number) ?? 0,
        title: text(row.title) ?? `Урок ${integer(row.lesson_number) ?? ''}`.trim(),
        lessonDate: text(row.lesson_date),
        durationMinutes: finite(row.duration_minutes),
        isTest: row.is_test === true,
        topics: topics(row),
      }]
    })
    const lessonIds = lessons.map(lesson => lesson.id)
    const [attendanceResult, gradesResult, homeworkResult] = lessonIds.length > 0 ? await Promise.all([
      auth.admin.from('attendance').select('lesson_id, student_id, status').in('lesson_id', lessonIds),
      auth.admin.from('test_results').select('lesson_id, student_id, math_score, analogy_score, reading_score, grammar_score').in('lesson_id', lessonIds),
      auth.admin.from('homeworks').select('id, lesson_id, title, description, due_date, homework_submissions(student_id)').in('lesson_id', lessonIds).order('due_date', { ascending: true, nullsFirst: false }),
    ]) : [
      { data: [], error: null },
      { data: [], error: null },
      { data: [], error: null },
    ]
    if (attendanceResult.error || gradesResult.error || homeworkResult.error) return json({ error: 'Не удалось загрузить данные уроков' }, 503)

    const attendance: TeacherGroupWorkspace['attendance'] = {}
    for (const raw of attendanceResult.data ?? []) {
      const row = raw as Row
      const lessonId = integer(row.lesson_id)
      const studentId = text(row.student_id)
      const status = row.status
      if (!lessonId || !studentId || !allowedStudentIds.has(studentId)) continue
      if (status !== 'present' && status !== 'late' && status !== 'absent') continue
      attendance[lessonId] ??= {}
      attendance[lessonId][studentId] = status as TeacherAttendanceStatus
    }

    const grades: TeacherGroupWorkspace['grades'] = {}
    for (const raw of gradesResult.data ?? []) {
      const row = raw as Row
      const lessonId = integer(row.lesson_id)
      const studentId = text(row.student_id)
      if (!lessonId || !studentId || !allowedStudentIds.has(studentId)) continue
      grades[lessonId] ??= {}
      grades[lessonId][studentId] = {
        math: finite(row.math_score),
        analogy: finite(row.analogy_score),
        reading: finite(row.reading_score),
        grammar: finite(row.grammar_score),
      }
    }

    const homework = (homeworkResult.data ?? []).flatMap(raw => {
      const row = raw as unknown as Row
      const id = integer(row.id)
      const lessonId = integer(row.lesson_id)
      if (!id || !lessonId) return []
      const submissions = Array.isArray(row.homework_submissions) ? row.homework_submissions as Row[] : []
      return [{
        id,
        lessonId,
        title: text(row.title) ?? 'Домашнее задание',
        description: text(row.description),
        dueAt: text(row.due_date),
        submittedCount: new Set(submissions.map(submission => text(submission.student_id)).filter((id): id is string => !!id && allowedStudentIds.has(id))).size,
      }]
    })

    const workspace: TeacherGroupWorkspace = { group, students, lessons, attendance, grades, homework }
    return json(workspace)
  } catch {
    return json({ error: 'Сервис временно недоступен' }, 503)
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireRoleAuth(request, TEACHER_ROLES)
  if (!auth.authorized) return auth.response

  try {
    const body = await readJsonObject(request, 64_000)
    const allowedKeys = new Set(['operation', 'groupId', 'lessonId', 'entries'])
    if (Object.keys(body).some(key => !allowedKeys.has(key))) return json({ error: 'Некорректный запрос' }, 400)
    const groupId = integer(body.groupId)
    const lessonId = integer(body.lessonId)
    if (!groupId || !lessonId || (body.operation !== 'attendance' && body.operation !== 'grades')) {
      return json({ error: 'Некорректный запрос' }, 400)
    }

    const ownership = await ownGroup(auth.admin, auth.user.id, groupId)
    if ('error' in ownership) return ownership.error
    const lessonOwnership = await ownLesson(auth.admin, ownership.courseId, lessonId)
    if ('error' in lessonOwnership) return lessonOwnership.error
    const membership = await groupStudentIds(auth.admin, groupId)
    if ('error' in membership) return membership.error

    if (body.operation === 'attendance') {
      const entries = parseAttendanceEntries(body.entries)
      if (!entries || entries.some(entry => !membership.ids.has(entry.studentId))) return json({ error: 'Некорректные отметки посещаемости' }, 400)
      const rows = entries.map(entry => ({ lesson_id: lessonId, student_id: entry.studentId, status: entry.status }))
      const { error } = await auth.admin.from('attendance').upsert(rows, { onConflict: 'lesson_id,student_id' })
      if (error) return json({ error: 'Не удалось сохранить посещаемость' }, 503)
      return json({ success: true })
    }

    if (lessonOwnership.lesson.is_test !== true) return json({ error: 'Оценки доступны только для контрольного урока' }, 409)
    const entries = parseGradeEntries(body.entries)
    if (!entries || entries.some(entry => !membership.ids.has(entry.studentId))) return json({ error: 'Некорректные оценки' }, 400)
    const rows = entries.map(entry => ({
      lesson_id: lessonId,
      student_id: entry.studentId,
      math_score: entry.scores.math,
      analogy_score: entry.scores.analogy,
      reading_score: entry.scores.reading,
      grammar_score: entry.scores.grammar,
      total_score: gradeTotal(entry.scores),
    }))
    const { error } = await auth.admin.from('test_results').upsert(rows, { onConflict: 'lesson_id,student_id' })
    if (error) return json({ error: 'Не удалось сохранить оценки' }, 503)
    return json({ success: true })
  } catch (error) {
    if (error instanceof JsonBodyError) return json({ error: error.message }, error.status)
    return json({ error: 'Сервис временно недоступен' }, 503)
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireRoleAuth(request, TEACHER_ROLES)
  if (!auth.authorized) return auth.response

  try {
    const body = await readJsonObject(request)
    const allowedKeys = new Set(['groupId', 'lessonId', 'title', 'description', 'dueAt'])
    if (Object.keys(body).some(key => !allowedKeys.has(key))) return json({ error: 'Некорректный запрос' }, 400)
    const groupId = integer(body.groupId)
    const lessonId = integer(body.lessonId)
    const title = text(body.title)
    if (body.description != null && typeof body.description !== 'string') return json({ error: 'Некорректное описание' }, 400)
    if (body.dueAt != null && typeof body.dueAt !== 'string') return json({ error: 'Некорректный срок' }, 400)
    const description = body.description == null ? null : text(body.description)
    const dueAt = body.dueAt == null || body.dueAt === '' ? null : text(body.dueAt)
    if (!groupId || !lessonId || !title || title.length > 200 || (description?.length ?? 0) > 2_000) return json({ error: 'Проверь данные задания' }, 400)
    if (dueAt && (dueAt.length > 40 || !Number.isFinite(new Date(dueAt).getTime()))) return json({ error: 'Некорректный срок' }, 400)

    const ownership = await ownGroup(auth.admin, auth.user.id, groupId)
    if ('error' in ownership) return ownership.error
    const lessonOwnership = await ownLesson(auth.admin, ownership.courseId, lessonId)
    if ('error' in lessonOwnership) return lessonOwnership.error

    const { data, error } = await auth.admin
      .from('homeworks')
      .insert({ lesson_id: lessonId, title, description, due_date: dueAt })
      .select('id')
      .single()
    if (error || !data) return json({ error: 'Не удалось опубликовать задание' }, 503)
    return json({ id: data.id }, 201)
  } catch (error) {
    if (error instanceof JsonBodyError) return json({ error: error.message }, error.status)
    return json({ error: 'Сервис временно недоступен' }, 503)
  }
}
