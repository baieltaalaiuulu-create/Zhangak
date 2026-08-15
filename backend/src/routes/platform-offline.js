import { requireAuth } from '../auth.js'
import { query } from '../db.js'
import { GET, HttpError } from '../http.js'

const OFFLINE_STUDENT_TYPES = new Set(['offline'])

function text(value, fallback = null) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function requiredText(value, field) {
  const result = text(value)
  if (!result) throw new HttpError(500, `Некорректные данные: ${field}`, 'invalid_offline_dashboard')
  return result
}

function positiveInteger(value, field) {
  const number = Number(value)
  if (!Number.isSafeInteger(number) || number <= 0) {
    throw new HttpError(500, `Некорректные данные: ${field}`, 'invalid_offline_dashboard')
  }
  return number
}

function nullablePositiveInteger(value, field) {
  if (value == null) return null
  return positiveInteger(value, field)
}

function nullableTargetScore(value) {
  if (value == null) return null
  const score = Number(value)
  if (!Number.isSafeInteger(score) || score < 0 || score > 245) {
    throw new HttpError(500, 'Некорректные данные: target_score', 'invalid_offline_dashboard')
  }
  return score
}

function dateOrTime(value) {
  if (value == null) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString()
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

/**
 * The offline cabinet is deliberately a narrow, read-only projection of the
 * first-party learning and offline-classroom schemas. Private PDF/video
 * delivery is still absent until the owned storage stage introduces viewer URLs.
 */
export function requireOfflineStudent(user) {
  if (user.role !== 'student' || !OFFLINE_STUDENT_TYPES.has(user.student_type)) {
    throw new HttpError(403, 'Офлайн-кабинет недоступен для этого аккаунта', 'offline_student_required')
  }
  return user
}

export function publicOfflineLesson(row) {
  const startsAt = dateOrTime(row.starts_at ?? row.lesson_date)
  if ((row.starts_at ?? row.lesson_date) != null && !startsAt) {
    throw new HttpError(500, 'Некорректные данные: starts_at', 'invalid_offline_dashboard')
  }
  if (typeof row.is_test !== 'boolean') {
    throw new HttpError(500, 'Некорректные данные: is_test', 'invalid_offline_dashboard')
  }
  const topic = text(row.topic)
  return {
    id: positiveInteger(row.id, 'lesson_id'),
    lessonNumber: positiveInteger(row.lesson_number, 'lesson_number'),
    title: requiredText(row.title, 'lesson_title'),
    startsAt,
    durationMinutes: nullablePositiveInteger(row.duration_minutes, 'duration_minutes'),
    isTest: row.is_test,
    attendance: ['present', 'late', 'absent'].includes(row.attendance_status) ? row.attendance_status : 'pending',
    topics: topic ? [topic] : [],
  }
}

export function publicOfflineHomework(row) {
  const dueAt = dateOrTime(row.due_at)
  if (row.due_at != null && !dueAt) throw new HttpError(500, 'Некорректные данные: due_at', 'invalid_offline_dashboard')
  return {
    id: positiveInteger(row.id, 'homework_id'),
    lessonId: row.lesson_id == null ? null : positiveInteger(row.lesson_id, 'lesson_id'),
    lessonTitle: text(row.lesson_title, 'Домашнее задание'),
    title: requiredText(row.title, 'homework_title'),
    description: text(row.body),
    dueAt,
    completed: ['submitted', 'returned', 'accepted'].includes(row.submission_status),
  }
}

export function publicOfflineGrade(row) {
  const score = Number(row.score)
  if (!Number.isSafeInteger(score) || score < 0 || score > 100) throw new HttpError(500, 'Некорректные данные: grade_score', 'invalid_offline_dashboard')
  return {
    lessonId: positiveInteger(row.class_session_id ?? row.homework_id ?? row.id, 'grade_source_id'),
    lessonTitle: requiredText(row.title, 'grade_title'),
    math: null, analogy: null, reading: null, grammar: null, total: score,
  }
}

export function publicOfflineComment(row) {
  const createdAt = dateOrTime(row.created_at)
  if (!createdAt) throw new HttpError(500, 'Некорректные данные: comment_created_at', 'invalid_offline_dashboard')
  return {
    id: positiveInteger(row.id, 'comment_id'),
    body: requiredText(row.body, 'comment_body'),
    createdAt,
  }
}

export function publicOfflineAnnouncement(row) {
  const publishedAt = dateOrTime(row.published_at)
  if (!publishedAt) throw new HttpError(500, 'Некорректные данные: announcement_published_at', 'invalid_offline_dashboard')
  return {
    id: positiveInteger(row.id, 'announcement_id'),
    title: requiredText(row.title, 'announcement_title'),
    body: requiredText(row.body, 'announcement_body'),
    publishedAt,
  }
}

export function emptyOfflineDashboard(user) {
  const student = requireOfflineStudent(user)
  const targetScore = nullableTargetScore(student.target_score)
  return {
    profile: {
      id: student.id,
      fullName: requiredText(student.full_name, 'full_name'),
      studentType: student.student_type,
      targetScore,
    },
    group: null,
    lessons: [],
    homework: [],
    grades: [],
    comments: [],
    announcements: [],
    progress: { latestOrtScore: null, targetScore },
    availability: { exactSchedule: false, materials: false },
  }
}

export function publicOfflineGroup(row) {
  return {
    id: positiveInteger(row.group_id, 'group_id'),
    name: requiredText(row.group_name, 'group_name'),
    courseName: text(row.course_name),
    teacherName: text(row.teacher_name),
  }
}

GET('/v1/platform/offline-dashboard', async ({ req, config }) => {
  const student = requireOfflineStudent(await requireAuth(config, req))
  const dashboard = emptyOfflineDashboard(student)

  // The current UI is a single-group cabinet.  Memberships are retained for
  // history, so choose the most recently joined active offline group
  // deterministically rather than allowing a caller-selected group id.
  const membership = await query(
    `SELECT g.id AS group_id, g.name AS group_name, g.course_id, c.name AS course_name,
            teacher_profile.full_name AS teacher_name
       FROM group_students gs
       JOIN groups g
         ON g.id = gs.group_id
        AND g.is_active = true
        AND g.delivery_mode = 'offline'
       JOIN courses c
         ON c.id = g.course_id
        AND c.is_active = true
        AND c.delivery_mode = 'offline'
  LEFT JOIN profiles teacher_profile
         ON teacher_profile.user_id = g.teacher_id
        AND teacher_profile.role = 'teacher'
      WHERE gs.student_id = $1
        AND gs.left_at IS NULL
      ORDER BY gs.joined_at DESC, gs.id DESC
      LIMIT 1`,
    [student.id],
  )
  const groupRow = membership.rows[0]
  if (!groupRow) {
    return { status: 200, headers: { 'Cache-Control': 'private, no-store' }, body: dashboard }
  }

  const group = publicOfflineGroup(groupRow)
  const [lessons, homework, grades, comments, announcements] = await Promise.all([
    query(
      `SELECT l.id, l.lesson_number, l.title, l.topic, l.lesson_date, l.duration_minutes, l.is_test,
              s.starts_at, a.attendance_status
         FROM lessons l
    LEFT JOIN offline_class_sessions s ON s.group_id = $1 AND s.lesson_id = l.id AND s.status <> 'cancelled'
    LEFT JOIN offline_attendance_records a ON a.session_id = s.id AND a.student_id = $2
        WHERE l.course_id = $3 AND l.is_published = true
        ORDER BY COALESCE(s.starts_at, l.lesson_date::timestamptz), l.lesson_number, l.id`,
      [group.id, student.id, groupRow.course_id],
    ),
    query(
      `SELECT h.id, h.lesson_id, h.title, h.body, h.due_at, l.title AS lesson_title, sub.status AS submission_status
         FROM offline_homework h
    LEFT JOIN lessons l ON l.id = h.lesson_id
    LEFT JOIN offline_homework_submissions sub ON sub.homework_id = h.id AND sub.student_id = $2
        WHERE h.group_id = $1 AND h.is_published = true
        ORDER BY h.due_at NULLS LAST, h.id DESC`,
      [group.id, student.id],
    ),
    query(
      `SELECT id, body, created_at
         FROM offline_comments
        WHERE group_id = $1 AND student_id = $2 AND visibility = 'student'
        ORDER BY created_at DESC, id DESC
        LIMIT 30`,
      [group.id, student.id],
    ),
    query(
      `SELECT id, class_session_id, homework_id, title, score
         FROM offline_grades
        WHERE group_id = $1 AND student_id = $2 AND is_published = true
        ORDER BY created_at DESC, id DESC`,
      [group.id, student.id],
    ),
    query(
      `SELECT id, title, body, published_at
         FROM offline_announcements
        WHERE group_id = $1 AND is_published = true
        ORDER BY published_at DESC, id DESC
        LIMIT 30`,
      [group.id],
    ),
  ])

  return {
    status: 200,
    headers: { 'Cache-Control': 'private, no-store' },
    body: {
      ...dashboard,
      group,
      lessons: lessons.rows.map(publicOfflineLesson),
      homework: homework.rows.map(publicOfflineHomework),
      grades: grades.rows.map(publicOfflineGrade),
      comments: comments.rows.map(publicOfflineComment),
      announcements: announcements.rows.map(publicOfflineAnnouncement),
      availability: { exactSchedule: lessons.rows.some(row => row.starts_at != null), materials: false },
    },
  }
})
