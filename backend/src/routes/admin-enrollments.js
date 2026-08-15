import { requireAuth } from '../auth.js'
import { query as dbQuery, transaction } from '../db.js'
import { GET, HttpError, PATCH, POST, readJson } from '../http.js'
import { requireRole } from '../authorization.js'

// A manager is intentionally limited to the manual enrolment/payment
// workflow. Curriculum, roles and audit visibility remain admin/super-admin
// responsibilities.
const ENROLLMENT_MANAGER_ROLES = ['manager', 'admin', 'super_admin']
const CURRENT_STATUSES = new Set(['awaiting_payment', 'awaiting_confirmation', 'active', 'suspended'])
const STATUSES = new Set([...CURRENT_STATUSES, 'completed', 'cancelled'])
const TRANSITIONS = new Map([
  ['awaiting_payment', new Set(['awaiting_confirmation', 'cancelled'])],
  ['awaiting_confirmation', new Set(['active', 'cancelled'])],
  ['active', new Set(['suspended', 'completed', 'cancelled'])],
  ['suspended', new Set(['active', 'cancelled'])],
  ['completed', new Set()],
  ['cancelled', new Set()],
])
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function requireEnrollmentManager(config, req) {
  return requireAuth(config, req).then(user => requireRole(user, ENROLLMENT_MANAGER_ROLES))
}

function positiveId(value, field) {
  const id = typeof value === 'number' ? value : Number.NaN
  if (!Number.isSafeInteger(id) || id < 1) throw new HttpError(400, 'Некорректный идентификатор', `invalid_${field}`)
  return id
}

function routeId(value, field) {
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) throw new HttpError(400, 'Некорректный идентификатор', `invalid_${field}`)
  return positiveId(Number(value), field)
}

function studentId(value) {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) throw new HttpError(400, 'Некорректный ученик', 'invalid_student_id')
  return value
}

function exact(body, required, optional = []) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return false
  const allowed = new Set([...required, ...optional])
  return required.every(key => Object.hasOwn(body, key)) && Object.keys(body).every(key => allowed.has(key))
}

export function parseEnrollmentCreateBody(body) {
  if (!exact(body, ['studentId', 'courseId'], ['status'])) throw new HttpError(400, 'Некорректные данные зачисления', 'invalid_enrollment')
  const status = body.status ?? 'awaiting_payment'
  if (!STATUSES.has(status)) throw new HttpError(400, 'Некорректный статус зачисления', 'invalid_enrollment_status')
  return { studentId: studentId(body.studentId), courseId: positiveId(body.courseId, 'course_id'), status }
}

export function parseEnrollmentPatchBody(body) {
  if (!exact(body, ['status'])) throw new HttpError(400, 'Некорректные данные зачисления', 'invalid_enrollment')
  if (!STATUSES.has(body.status)) throw new HttpError(400, 'Некорректный статус зачисления', 'invalid_enrollment_status')
  return { status: body.status }
}

function publicEnrollment(row) {
  const id = Number(row.id)
  const courseId = Number(row.course_id)
  if (!Number.isSafeInteger(id) || id < 1 || !Number.isSafeInteger(courseId) || courseId < 1 || !STATUSES.has(row.status)) {
    throw new HttpError(500, 'Некорректные данные зачисления', 'invalid_enrollment_record')
  }
  return {
    id,
    student: { id: row.student_id, fullName: row.student_name, email: row.student_email, studentType: row.student_type },
    course: { id: courseId, name: row.course_name, code: row.course_code, deliveryMode: row.delivery_mode },
    status: row.status,
    requestedAt: row.requested_at,
    confirmedAt: row.confirmed_at,
    activatedAt: row.activated_at,
    suspendedAt: row.suspended_at,
    completedAt: row.completed_at,
    cancelledAt: row.cancelled_at,
    updatedAt: row.updated_at,
  }
}

const ENROLLMENT_SELECT = `SELECT e.id, e.student_id, e.course_id, e.status, e.requested_at,
                                  e.confirmed_at, e.activated_at, e.suspended_at, e.completed_at,
                                  e.cancelled_at, e.updated_at,
                                  p.full_name AS student_name, u.email AS student_email, p.student_type,
                                  c.name AS course_name, c.code AS course_code, c.delivery_mode
                             FROM course_enrollments e
                             JOIN users u ON u.id = e.student_id
                             JOIN profiles p ON p.user_id = e.student_id
                             JOIN courses c ON c.id = e.course_id`

async function lockedStudent(client, id) {
  const result = await client.query(
    `SELECT u.id, u.blocked, p.role, p.student_type
       FROM users u JOIN profiles p ON p.user_id = u.id
      WHERE u.id = $1
      FOR UPDATE OF u, p`,
    [id],
  )
  const row = result.rows[0]
  if (!row) throw new HttpError(404, 'Ученик не найден', 'student_not_found')
  if (row.role !== 'student' || !['online', 'offline'].includes(row.student_type)) throw new HttpError(409, 'У пользователя нет учебного типа', 'student_type_required')
  if (row.blocked) throw new HttpError(409, 'Заблокированного ученика нельзя зачислить', 'student_blocked')
  return row
}

async function lockedCourse(client, id) {
  const result = await client.query(
    `SELECT id, is_active, delivery_mode
       FROM courses
      WHERE id = $1
      FOR UPDATE`,
    [id],
  )
  const row = result.rows[0]
  if (!row) throw new HttpError(404, 'Курс не найден', 'course_not_found')
  if (!row.is_active) throw new HttpError(409, 'Нельзя зачислить на неактивный курс', 'course_inactive')
  if (!['online', 'offline'].includes(row.delivery_mode)) throw new HttpError(500, 'Некорректный формат курса', 'invalid_course_delivery_mode')
  return row
}

function requireStudentMatchesCourse(student, course) {
  if (student.student_type !== course.delivery_mode) {
    throw new HttpError(409, 'Тип обучения ученика не совпадает с форматом курса', 'student_course_mode_mismatch')
  }
}

function transitionUpdate(status) {
  const fields = ['status = $2', 'updated_by = $3', 'updated_at = now()']
  if (status === 'awaiting_confirmation') fields.push('confirmed_at = COALESCE(confirmed_at, now())')
  if (status === 'active') fields.push('activated_at = COALESCE(activated_at, now())', 'suspended_at = NULL')
  if (status === 'suspended') fields.push('suspended_at = COALESCE(suspended_at, now())')
  if (status === 'completed') fields.push('completed_at = COALESCE(completed_at, now())')
  if (status === 'cancelled') fields.push('cancelled_at = COALESCE(cancelled_at, now())')
  return fields.join(', ')
}

async function audit(client, actor, action, enrollmentId, metadata) {
  await client.query(
    `INSERT INTO audit_log (actor_user_id, action, target_type, target_id, metadata)
     VALUES ($1, $2, 'course_enrollment', $3, $4::jsonb)`,
    [actor.id, action, String(enrollmentId), JSON.stringify(metadata)],
  )
}

GET('/v1/admin/enrollments', async ({ req, config, query: searchParams }) => {
  await requireEnrollmentManager(config, req)
  const status = searchParams.get('status')
  if (status != null && status !== '' && !STATUSES.has(status)) throw new HttpError(400, 'Некорректный статус зачисления', 'invalid_enrollment_status')
  const result = await dbQuery(
    `${ENROLLMENT_SELECT}
      WHERE ($1::text IS NULL OR e.status = $1)
      ORDER BY e.updated_at DESC, e.id DESC
      LIMIT 100`,
    [status || null],
  )
  return { status: 200, body: { items: result.rows.map(publicEnrollment) } }
})

POST('/v1/admin/enrollments', async ({ req, config }) => {
  const actor = await requireEnrollmentManager(config, req)
  const input = parseEnrollmentCreateBody(await readJson(req, 4_000))
  try {
    const enrollment = await transaction(async client => {
      const student = await lockedStudent(client, input.studentId)
      const course = await lockedCourse(client, input.courseId)
      requireStudentMatchesCourse(student, course)
      const inserted = await client.query(
        `INSERT INTO course_enrollments (student_id, course_id, status, created_by, updated_by, confirmed_at, activated_at)
         VALUES ($1, $2, $3, $4, $4,
                 CASE WHEN $3 IN ('awaiting_confirmation', 'active') THEN now() ELSE NULL END,
                 CASE WHEN $3 = 'active' THEN now() ELSE NULL END)
         RETURNING id`,
        [input.studentId, input.courseId, input.status, actor.id],
      )
      const id = Number(inserted.rows[0].id)
      await audit(client, actor, 'create_course_enrollment', id, { courseId: input.courseId, studentId: input.studentId, status: input.status })
      const loaded = await client.query(`${ENROLLMENT_SELECT} WHERE e.id = $1`, [id])
      return publicEnrollment(loaded.rows[0])
    })
    return { status: 201, body: { enrollment } }
  } catch (error) {
    if (error?.code === '23505') throw new HttpError(409, 'У ученика уже есть текущий курс', 'current_enrollment_exists')
    throw error
  }
})

PATCH('/v1/admin/enrollments/:enrollmentId', async ({ req, params, config }) => {
  const actor = await requireEnrollmentManager(config, req)
  const enrollmentId = routeId(params.enrollmentId, 'enrollment_id')
  const input = parseEnrollmentPatchBody(await readJson(req, 2_000))
  const enrollment = await transaction(async client => {
    const current = await client.query(`${ENROLLMENT_SELECT} WHERE e.id = $1 FOR UPDATE OF e, u, p, c`, [enrollmentId])
    const row = current.rows[0]
    if (!row) throw new HttpError(404, 'Зачисление не найдено', 'enrollment_not_found')
    if (!TRANSITIONS.get(row.status)?.has(input.status)) {
      throw new HttpError(409, 'Недопустимый переход статуса', 'enrollment_transition_forbidden')
    }
    const updated = await client.query(
      `UPDATE course_enrollments SET ${transitionUpdate(input.status)} WHERE id = $1 RETURNING id`,
      [enrollmentId, input.status, actor.id],
    )
    await audit(client, actor, 'update_course_enrollment_status', enrollmentId, { from: row.status, to: input.status })
    const loaded = await client.query(`${ENROLLMENT_SELECT} WHERE e.id = $1`, [updated.rows[0].id])
    return publicEnrollment(loaded.rows[0])
  })
  return { status: 200, body: { enrollment } }
})
