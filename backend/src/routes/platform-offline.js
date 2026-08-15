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

function dateOnly(value) {
  if (value == null) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10)
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null
}

/**
 * The offline cabinet is deliberately a narrow, read-only projection of the
 * first-party learning schema.  It does not imply that attendance, homework,
 * grades, files, or an ОРТ score have been migrated: those tables do not
 * exist in the owned schema yet, so the response must keep them unavailable.
 */
export function requireOfflineStudent(user) {
  if (user.role !== 'student' || !OFFLINE_STUDENT_TYPES.has(user.student_type)) {
    throw new HttpError(403, 'Офлайн-кабинет недоступен для этого аккаунта', 'offline_student_required')
  }
  return user
}

export function publicOfflineLesson(row) {
  const lessonDate = dateOnly(row.lesson_date)
  if (row.lesson_date != null && !lessonDate) {
    throw new HttpError(500, 'Некорректные данные: lesson_date', 'invalid_offline_dashboard')
  }
  if (typeof row.is_test !== 'boolean') {
    throw new HttpError(500, 'Некорректные данные: is_test', 'invalid_offline_dashboard')
  }
  const topic = text(row.topic)
  return {
    id: positiveInteger(row.id, 'lesson_id'),
    lessonNumber: positiveInteger(row.lesson_number, 'lesson_number'),
    title: requiredText(row.title, 'lesson_title'),
    startsAt: lessonDate,
    durationMinutes: nullablePositiveInteger(row.duration_minutes, 'duration_minutes'),
    isTest: row.is_test,
    // There is no owned attendance model yet.  "pending" is intentionally
    // the only possible value, not a synthetic presence record.
    attendance: 'pending',
    topics: topic ? [topic] : [],
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
    // These domains are intentionally unavailable until their own schema and
    // audited write flows are introduced.  Do not backfill them from a legacy
    // data source or fabricate client-side values.
    homework: [],
    grades: [],
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
  const lessons = await query(
    `SELECT id, lesson_number, title, topic, lesson_date, duration_minutes, is_test
       FROM lessons
      WHERE course_id = $1
        AND is_published = true
      ORDER BY lesson_number, id`,
    [groupRow.course_id],
  )

  return {
    status: 200,
    headers: { 'Cache-Control': 'private, no-store' },
    body: {
      ...dashboard,
      group,
      lessons: lessons.rows.map(publicOfflineLesson),
    },
  }
})
