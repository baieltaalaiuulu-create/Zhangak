import { requireAuth } from '../auth.js'
import { query } from '../db.js'
import { GET, HttpError } from '../http.js'

const STUDENT_ROLES = ['student', 'math_student']

async function currentOnlineStudent(config, req) {
  const user = await requireAuth(config, req)
  if (!STUDENT_ROLES.includes(user.role) || (user.role === 'student' && user.student_type !== 'online')) {
    throw new HttpError(403, 'Roadmap доступен только ученику онлайн-курса', 'online_student_required')
  }
  return user
}

function boolean(value) {
  return value === true || value === 't'
}

function number(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function roadmapStarCount(completionPercent) {
  if (completionPercent >= 90) return 3
  if (completionPercent >= 75) return 2
  if (completionPercent >= 50) return 1
  return 0
}

/** The client receives no private material URL or assessment answer fields. */
export function publicRoadmapLesson(row) {
  const isLocked = boolean(row.is_locked)
  const completed = row.completed_at !== null
  return {
    id: number(row.lesson_id),
    lessonNumber: number(row.lesson_number),
    title: row.title,
    description: isLocked ? null : row.description ?? null,
    subject: row.subject ?? null,
    section: row.section ?? null,
    topic: row.topic ?? null,
    durationMinutes: row.duration_minutes == null ? null : number(row.duration_minutes),
    isTest: boolean(row.is_test),
    completionMode: boolean(row.is_test) || boolean(row.has_active_bound_practice_test) ? 'practice' : 'self',
    completionPercent: completed ? 100 : number(row.completion_percent),
    completedAt: completed ? new Date(row.completed_at).toISOString() : null,
    isLocked,
    state: completed ? 'done' : isLocked ? 'locked' : 'available',
    isCurrent: false,
  }
}

function publicUnit(row, lessons) {
  const completedLessons = lessons.filter(lesson => lesson.state === 'done').length
  const completionPercent = lessons.length === 0 ? 0 : Math.round((completedLessons / lessons.length) * 100)
  return {
    id: number(row.unit_id),
    unitNumber: number(row.unit_number),
    title: row.unit_title,
    description: row.unit_description ?? null,
    accentColor: row.accent_color,
    completedLessons,
    lessonCount: lessons.length,
    completionPercent,
    starCount: roadmapStarCount(completionPercent),
    lessons,
  }
}

async function activeCourse(studentId) {
  const result = await query(
    `SELECT c.id, c.name, c.code, c.subject
       FROM active_course_enrollments ce
       JOIN courses c ON c.id = ce.course_id
      WHERE ce.student_id = $1
        AND ce.status = 'active'
        AND c.is_active = true
        AND c.delivery_mode = 'online'
      ORDER BY ce.activated_at NULLS LAST, ce.id DESC
      LIMIT 1`,
    [studentId],
  )
  return result.rows[0] ?? null
}

GET('/v1/platform/roadmap', async ({ req, config }) => {
  const student = await currentOnlineStudent(config, req)
  const course = await activeCourse(student.id)
  if (!course) return { status: 200, body: { course: null, direction: 'bottom_to_top', units: [], summary: { completedLessons: 0, lessonCount: 0, completionPercent: 0 } } }

  const result = await query(
    `SELECT u.id AS unit_id, u.unit_number, u.title AS unit_title,
            u.description AS unit_description, u.accent_color,
            l.id AS lesson_id, l.lesson_number, l.title, l.description,
            l.subject, l.section, l.topic, l.duration_minutes, l.is_test,
            ul.position,
            coalesce(lp.completion_percent, 0)::int AS completion_percent,
            lp.completed_at,
            EXISTS (
              SELECT 1
                FROM practice_tests completion_test
               WHERE completion_test.lesson_id = l.id
                 AND completion_test.is_published = true
                 AND (completion_test.available_from IS NULL OR completion_test.available_from <= now())
                 AND (completion_test.available_until IS NULL OR completion_test.available_until > now())
                 AND EXISTS (
                   SELECT 1 FROM practice_questions completion_question
                    WHERE completion_question.practice_test_id = completion_test.id
                      AND completion_question.is_active = true
                 )
            ) AS has_active_bound_practice_test,
            EXISTS (
              SELECT 1
                FROM course_unit_lessons previous_item
                JOIN course_units previous_unit
                  ON previous_unit.id = previous_item.unit_id
                 AND previous_unit.course_id = previous_item.course_id
                 AND previous_unit.is_published = true
                JOIN lessons previous_lesson ON previous_lesson.id = previous_item.lesson_id
                LEFT JOIN lesson_progress previous_progress
                  ON previous_progress.lesson_id = previous_lesson.id
                 AND previous_progress.student_id = $1
               WHERE previous_item.course_id = u.course_id
                 AND previous_lesson.is_published = true
                 AND (
                   previous_unit.unit_number < u.unit_number
                   OR (previous_unit.unit_number = u.unit_number AND previous_item.position < ul.position)
                 )
                 AND previous_progress.completed_at IS NULL
            ) AS is_locked
       FROM course_units u
       JOIN course_unit_lessons ul ON ul.unit_id = u.id AND ul.course_id = u.course_id
       JOIN lessons l ON l.id = ul.lesson_id AND l.course_id = ul.course_id
       LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.student_id = $1
      WHERE u.course_id = $2
        AND u.is_published = true
        AND l.is_published = true
      ORDER BY u.unit_number, ul.position, l.id`,
    [student.id, course.id],
  )

  const unitRows = new Map()
  for (const row of result.rows) {
    const id = number(row.unit_id)
    const entry = unitRows.get(id) ?? { row, lessons: [] }
    entry.lessons.push(publicRoadmapLesson(row))
    unitRows.set(id, entry)
  }
  const units = [...unitRows.values()].map(({ row, lessons }) => publicUnit(row, lessons))
  let currentAssigned = false
  for (const unit of units) {
    for (const lesson of unit.lessons) {
      if (!currentAssigned && lesson.state === 'available') {
        lesson.state = 'current'
        lesson.isCurrent = true
        currentAssigned = true
      }
    }
  }
  const lessonCount = units.reduce((total, unit) => total + unit.lessonCount, 0)
  const completedLessons = units.reduce((total, unit) => total + unit.completedLessons, 0)
  return {
    status: 200,
    body: {
      course: { id: number(course.id), name: course.name, code: course.code ?? null, subject: course.subject ?? null },
      direction: 'bottom_to_top',
      units,
      summary: {
        completedLessons,
        lessonCount,
        completionPercent: lessonCount === 0 ? 0 : Math.round((completedLessons / lessonCount) * 100),
      },
    },
  }
})
