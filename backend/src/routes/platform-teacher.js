import { requireAuth } from '../auth.js'
import { query } from '../db.js'
import { GET, HttpError } from '../http.js'

const TEACHER_ROLE = 'teacher'

function text(value, fallback = null) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function requiredText(value, field) {
  const result = text(value)
  if (!result) throw new HttpError(500, `Некорректные данные: ${field}`, 'invalid_teacher_dashboard')
  return result
}

function positiveInteger(value, field) {
  const number = Number(value)
  if (!Number.isSafeInteger(number) || number <= 0) {
    throw new HttpError(500, `Некорректные данные: ${field}`, 'invalid_teacher_dashboard')
  }
  return number
}

function nonNegativeInteger(value, field) {
  const number = Number(value)
  if (!Number.isSafeInteger(number) || number < 0) {
    throw new HttpError(500, `Некорректные данные: ${field}`, 'invalid_teacher_dashboard')
  }
  return number
}

function dateOnly(value) {
  if (value == null) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10)
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null
}

function deliveryMode(value) {
  if (value === 'online' || value === 'offline' || value === 'hybrid') return value
  throw new HttpError(500, 'Некорректные данные: delivery_mode', 'invalid_teacher_dashboard')
}

/**
 * Project only the data a teacher needs to see that a group exists.  In
 * particular, this read model never includes student identities, attendance,
 * grades, homework, practice attempts, or question/answer material.  Those
 * workflows need separate audited migrations before they can be exposed.
 */
export function publicTeacherGroup(row) {
  return {
    id: positiveInteger(row.id, 'group_id'),
    name: requiredText(row.name, 'group_name'),
    course: {
      id: positiveInteger(row.course_id, 'course_id'),
      name: requiredText(row.course_name, 'course_name'),
      level: text(row.course_level),
      subject: text(row.course_subject),
    },
    deliveryMode: deliveryMode(row.delivery_mode),
    startsOn: dateOnly(row.starts_on),
    endsOn: dateOnly(row.ends_on),
    activeStudentCount: nonNegativeInteger(row.active_student_count, 'active_student_count'),
    publishedLessonCount: nonNegativeInteger(row.published_lesson_count, 'published_lesson_count'),
  }
}

export function requireTeacher(user) {
  if (user.role !== TEACHER_ROLE) {
    throw new HttpError(403, 'Доступен только преподавателю', 'teacher_required')
  }
  return user
}

GET('/v1/platform/teacher-dashboard', async ({ req, config }) => {
  const teacher = requireTeacher(await requireAuth(config, req))
  const result = await query(
    `SELECT g.id, g.name, g.course_id, g.delivery_mode, g.starts_on, g.ends_on,
            c.name AS course_name, c.level AS course_level, c.subject AS course_subject,
            (
              SELECT count(*)::int
                FROM group_students gs
               JOIN profiles member_profile
                 ON member_profile.user_id = gs.student_id
                AND member_profile.role IN ('student', 'math_student')
               WHERE gs.group_id = g.id AND gs.left_at IS NULL
            ) AS active_student_count,
            (
              SELECT count(*)::int
                FROM lessons l
               WHERE l.course_id = g.course_id AND l.is_published = true
            ) AS published_lesson_count
       FROM groups g
       JOIN courses c ON c.id = g.course_id AND c.is_active = true
      WHERE g.teacher_id = $1 AND g.is_active = true
      ORDER BY g.name, g.id`,
    [teacher.id],
  )

  return {
    status: 200,
    headers: { 'Cache-Control': 'private, no-store' },
    body: {
      teacher: { fullName: text(teacher.full_name, 'Преподаватель') },
      groups: result.rows.map(publicTeacherGroup),
    },
  }
})
