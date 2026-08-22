import { requireAuth } from '../auth.js'
import { query as dbQuery, transaction } from '../db.js'
import { GET, HttpError, PATCH, POST, readJson } from '../http.js'
import { requireRole } from '../authorization.js'

// A manager is intentionally limited to the manual enrolment/payment
// workflow. Curriculum, roles and audit visibility remain admin/super-admin
// responsibilities.
const ENROLLMENT_MANAGER_ROLES = ['manager', 'admin', 'super_admin']
const ACCESS_MANAGER_ROLES = ['admin', 'super_admin']
const ACCESS_PLAN_MONTHS = new Map([
  ['one_month', 1],
  ['three_months', 3],
  ['one_year', 12],
])
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
  if (!exact(body, ['studentId', 'courseId'], ['status', 'accessPlan'])) throw new HttpError(400, 'Некорректные данные зачисления', 'invalid_enrollment')
  const status = body.status ?? 'awaiting_payment'
  const accessPlan = body.accessPlan ?? 'one_month'
  if (!STATUSES.has(status)) throw new HttpError(400, 'Некорректный статус зачисления', 'invalid_enrollment_status')
  if (!ACCESS_PLAN_MONTHS.has(accessPlan)) throw new HttpError(400, 'Некорректный срок доступа', 'invalid_access_plan')
  return { studentId: studentId(body.studentId), courseId: positiveId(body.courseId, 'course_id'), status, accessPlan }
}

export function parseEnrollmentPatchBody(body) {
  if (!exact(body, ['status'])) throw new HttpError(400, 'Некорректные данные зачисления', 'invalid_enrollment')
  if (!STATUSES.has(body.status)) throw new HttpError(400, 'Некорректный статус зачисления', 'invalid_enrollment_status')
  return { status: body.status }
}

export function parseEnrollmentAccessBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || typeof body.action !== 'string') {
    throw new HttpError(400, 'Некорректные данные доступа', 'invalid_access_action')
  }
  if (body.action === 'extend') {
    if (!exact(body, ['action', 'accessPlan'])) throw new HttpError(400, 'Некорректные данные продления', 'invalid_access_action')
    if (!ACCESS_PLAN_MONTHS.has(body.accessPlan)) throw new HttpError(400, 'Некорректный срок доступа', 'invalid_access_plan')
    return { action: body.action, accessPlan: body.accessPlan }
  }
  if (body.action === 'freeze') {
    if (!exact(body, ['action'], ['reason'])) throw new HttpError(400, 'Некорректные данные заморозки', 'invalid_access_action')
    const reason = body.reason == null ? null : String(body.reason).trim()
    if (reason != null && (reason.length < 1 || reason.length > 300)) throw new HttpError(400, 'Причина должна быть короче 300 символов', 'invalid_freeze_reason')
    return { action: body.action, reason }
  }
  if (body.action === 'resume') {
    if (!exact(body, ['action'])) throw new HttpError(400, 'Некорректные данные возобновления', 'invalid_access_action')
    return { action: body.action }
  }
  throw new HttpError(400, 'Некорректное действие с доступом', 'invalid_access_action')
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
    access: {
      plan: row.access_plan,
      startedAt: row.access_started_at,
      expiresAt: row.access_expires_at,
      frozenAt: row.frozen_at,
      frozenSecondsRemaining: row.frozen_seconds_remaining == null ? null : Number(row.frozen_seconds_remaining),
      freezeReason: row.freeze_reason,
    },
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
                                  e.cancelled_at, e.updated_at, e.access_plan, e.access_started_at,
                                  e.access_expires_at, e.frozen_at, e.frozen_seconds_remaining, e.freeze_reason,
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

function transitionUpdate(status, deliveryMode) {
  const fields = ['status = $2', 'updated_by = $3', 'updated_at = now()']
  if (status === 'awaiting_confirmation') fields.push('confirmed_at = COALESCE(confirmed_at, now())')
  if (status === 'active') {
    fields.push('activated_at = COALESCE(activated_at, now())', 'suspended_at = NULL')
    if (deliveryMode === 'online') fields.push("access_started_at = COALESCE(access_started_at, now())", "access_expires_at = COALESCE(access_expires_at, now() + interval '1 month')")
  }
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
        `INSERT INTO course_enrollments (student_id, course_id, status, created_by, updated_by, confirmed_at, activated_at,
                                         access_plan, access_started_at, access_expires_at)
         VALUES ($1, $2, $3, $4, $4,
                 CASE WHEN $3 IN ('awaiting_confirmation', 'active') THEN now() ELSE NULL END,
                 CASE WHEN $3 = 'active' THEN now() ELSE NULL END,
                 CASE WHEN $6 = 'online' THEN $5 ELSE NULL END,
                 CASE WHEN $3 = 'active' AND $6 = 'online' THEN now() ELSE NULL END,
                 CASE WHEN $3 = 'active' AND $6 = 'online' THEN now() + make_interval(months => $7) ELSE NULL END)
         RETURNING id`,
        [input.studentId, input.courseId, input.status, actor.id, input.accessPlan, course.delivery_mode, ACCESS_PLAN_MONTHS.get(input.accessPlan)],
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
      `UPDATE course_enrollments SET ${transitionUpdate(input.status, row.delivery_mode)} WHERE id = $1 RETURNING id`,
      [enrollmentId, input.status, actor.id],
    )
    await audit(client, actor, 'update_course_enrollment_status', enrollmentId, { from: row.status, to: input.status })
    const loaded = await client.query(`${ENROLLMENT_SELECT} WHERE e.id = $1`, [updated.rows[0].id])
    return publicEnrollment(loaded.rows[0])
  })
  return { status: 200, body: { enrollment } }
})

PATCH('/v1/admin/enrollments/:enrollmentId/access', async ({ req, params, config }) => {
  const actor = requireRole(await requireAuth(config, req), ACCESS_MANAGER_ROLES)
  const enrollmentId = routeId(params.enrollmentId, 'enrollment_id')
  const input = parseEnrollmentAccessBody(await readJson(req, 3_000))
  const enrollment = await transaction(async client => {
    const current = await client.query(`${ENROLLMENT_SELECT} WHERE e.id = $1 FOR UPDATE OF e, u, p, c`, [enrollmentId])
    const row = current.rows[0]
    if (!row) throw new HttpError(404, 'Зачисление не найдено', 'enrollment_not_found')
    if (row.delivery_mode !== 'online') throw new HttpError(409, 'Срок доступа применяется только к онлайн-курсам', 'online_access_only')

    if (input.action === 'extend') {
      const months = ACCESS_PLAN_MONTHS.get(input.accessPlan)
      await client.query(
        `UPDATE course_enrollments
            SET access_plan = $2,
                access_started_at = COALESCE(access_started_at, now()),
                access_expires_at = GREATEST(COALESCE(access_expires_at, now()), now()) + make_interval(months => $3),
                frozen_seconds_remaining = CASE WHEN frozen_at IS NULL THEN NULL ELSE EXTRACT(EPOCH FROM (GREATEST(COALESCE(access_expires_at, now()), now()) + make_interval(months => $3) - now()))::bigint END,
                updated_by = $4,
                updated_at = now()
          WHERE id = $1`,
        [enrollmentId, input.accessPlan, months, actor.id],
      )
      await audit(client, actor, 'extend_online_course_access', enrollmentId, { accessPlan: input.accessPlan, months })
    } else if (input.action === 'freeze') {
      if (row.status !== 'active') throw new HttpError(409, 'Заморозить можно только активный курс', 'access_not_active')
      if (!row.access_expires_at || new Date(row.access_expires_at).getTime() <= Date.now()) throw new HttpError(409, 'Истёкший доступ нужно сначала продлить', 'access_expired')
      if (row.frozen_at) throw new HttpError(409, 'Доступ уже заморожен', 'access_already_frozen')
      await client.query(
        `UPDATE course_enrollments
            SET frozen_at = now(),
                frozen_seconds_remaining = GREATEST(0, EXTRACT(EPOCH FROM (access_expires_at - now())))::bigint,
                freeze_reason = $2,
                updated_by = $3,
                updated_at = now()
          WHERE id = $1`,
        [enrollmentId, input.reason, actor.id],
      )
      await audit(client, actor, 'freeze_online_course_access', enrollmentId, { reason: input.reason })
    } else {
      if (!row.frozen_at) throw new HttpError(409, 'Доступ не заморожен', 'access_not_frozen')
      await client.query(
        `UPDATE course_enrollments
            SET access_expires_at = now() + make_interval(secs => GREATEST(0, COALESCE(frozen_seconds_remaining, 0))::double precision),
                frozen_at = NULL,
                frozen_seconds_remaining = NULL,
                freeze_reason = NULL,
                updated_by = $2,
                updated_at = now()
          WHERE id = $1`,
        [enrollmentId, actor.id],
      )
      await audit(client, actor, 'resume_online_course_access', enrollmentId, {})
    }

    const loaded = await client.query(`${ENROLLMENT_SELECT} WHERE e.id = $1`, [enrollmentId])
    return publicEnrollment(loaded.rows[0])
  })
  return { status: 200, body: { enrollment } }
})
