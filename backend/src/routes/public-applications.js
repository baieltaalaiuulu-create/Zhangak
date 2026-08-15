import { requireAuth } from '../auth.js'
import { query as dbQuery, transaction } from '../db.js'
import { GET, HttpError, PATCH, POST, readJson } from '../http.js'
import { requireRole } from '../authorization.js'

const APPLICATION_STAFF_ROLES = ['manager', 'admin', 'super_admin']
const PAYMENT_CONFIRMER_ROLES = ['admin', 'super_admin']
const PUBLIC_STATUSES = new Set(['new', 'contacted', 'awaiting_payment', 'awaiting_confirmation', 'enrolled', 'declined', 'cancelled'])
const STAFF_STATUSES = new Set(['contacted', 'awaiting_payment', 'awaiting_confirmation', 'declined', 'cancelled'])
const TRANSITIONS = new Map([
  ['new', new Set(['contacted', 'awaiting_payment', 'declined', 'cancelled'])],
  ['contacted', new Set(['awaiting_payment', 'awaiting_confirmation', 'declined', 'cancelled'])],
  ['awaiting_payment', new Set(['contacted', 'awaiting_confirmation', 'declined', 'cancelled'])],
  ['awaiting_confirmation', new Set(['awaiting_payment', 'declined', 'cancelled'])],
  ['enrolled', new Set()],
  ['declined', new Set()],
  ['cancelled', new Set()],
])
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const PHONE_DIGITS = /^[1-9][0-9]{7,18}$/
const RATE_WINDOW_MS = 10 * 60_000
const RATE_LIMIT = 5
const intakeBuckets = new Map()

function exact(body, required, optional = []) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return false
  const allowed = new Set([...required, ...optional])
  return required.every(key => Object.hasOwn(body, key)) && Object.keys(body).every(key => allowed.has(key))
}

function text(value, maxLength, code, minLength = 1) {
  if (typeof value !== 'string') throw new HttpError(400, 'Некорректные данные заявки', code)
  const normalized = value.trim().replace(/\s+/g, ' ')
  if (normalized.length < minLength || normalized.length > maxLength) throw new HttpError(400, 'Некорректные данные заявки', code)
  return normalized
}

function positiveId(value, code) {
  if (!Number.isSafeInteger(value) || value < 1) throw new HttpError(400, 'Некорректный курс', code)
  return value
}

function routeId(value, code) {
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) throw new HttpError(400, 'Некорректная заявка', code)
  return positiveId(Number(value), code)
}

function phone(value) {
  if (typeof value !== 'string') throw new HttpError(400, 'Введите номер WhatsApp', 'invalid_phone')
  const digits = value.replace(/[^0-9]/g, '')
  if (!PHONE_DIGITS.test(digits)) throw new HttpError(400, 'Введите номер WhatsApp', 'invalid_phone')
  return `+${digits}`
}

function requireApplicationStaff(config, req) {
  return requireAuth(config, req).then(user => requireRole(user, APPLICATION_STAFF_ROLES))
}

function requirePaymentConfirmer(config, req) {
  return requireAuth(config, req).then(user => requireRole(user, PAYMENT_CONFIRMER_ROLES))
}

function limitedIntake(ip) {
  const now = Date.now()
  for (const [key, values] of intakeBuckets) {
    const active = values.filter(value => value > now - RATE_WINDOW_MS)
    if (active.length === 0) intakeBuckets.delete(key)
    else intakeBuckets.set(key, active)
  }
  const attempts = intakeBuckets.get(ip) ?? []
  if (attempts.length >= RATE_LIMIT) throw new HttpError(429, 'Слишком много заявок. Попробуйте позже.', 'application_rate_limited')
  attempts.push(now)
  intakeBuckets.set(ip, attempts)
}

export function parsePublicApplicationBody(body) {
  if (!exact(body, ['name', 'phone', 'city', 'courseId'])) throw new HttpError(400, 'Некорректные данные заявки', 'invalid_application')
  return {
    name: text(body.name, 200, 'invalid_application_name', 2),
    phone: phone(body.phone),
    city: text(body.city, 120, 'invalid_application_city', 2),
    courseId: positiveId(body.courseId, 'invalid_course_id'),
  }
}

export function parseApplicationPatchBody(body) {
  if (!exact(body, [], ['status', 'note', 'assignedTo'])) throw new HttpError(400, 'Некорректные данные заявки', 'invalid_application_update')
  if (!Object.hasOwn(body, 'status') && !Object.hasOwn(body, 'note') && !Object.hasOwn(body, 'assignedTo')) {
    throw new HttpError(400, 'Некорректные данные заявки', 'invalid_application_update')
  }
  const status = body.status == null ? null : body.status
  if (status !== null && (typeof status !== 'string' || !STAFF_STATUSES.has(status))) throw new HttpError(400, 'Некорректный статус заявки', 'invalid_application_status')
  const note = body.note == null ? null : text(body.note, 4_000, 'invalid_application_note')
  const assignedTo = body.assignedTo == null ? null : body.assignedTo
  if (assignedTo !== null && (typeof assignedTo !== 'string' || !UUID_PATTERN.test(assignedTo))) throw new HttpError(400, 'Некорректный ответственный', 'invalid_application_assignee')
  return { status, note, assignedTo, hasAssignedTo: Object.hasOwn(body, 'assignedTo') }
}

export function parsePaymentConfirmationBody(body) {
  if (!exact(body, ['studentId'])) throw new HttpError(400, 'Некорректное подтверждение оплаты', 'invalid_payment_confirmation')
  if (typeof body.studentId !== 'string' || !UUID_PATTERN.test(body.studentId)) throw new HttpError(400, 'Некорректный ученик', 'invalid_student_id')
  return { studentId: body.studentId }
}

function publicCourse(row) {
  return { id: Number(row.id), name: row.name, code: row.code, level: row.level, subject: row.subject, deliveryMode: row.delivery_mode }
}

function staffApplication(row) {
  const id = Number(row.id)
  const courseId = Number(row.course_id)
  if (!Number.isSafeInteger(id) || !Number.isSafeInteger(courseId) || !PUBLIC_STATUSES.has(row.status)) {
    throw new HttpError(500, 'Некорректные данные заявки', 'invalid_application_record')
  }
  return {
    id,
    applicant: { name: row.applicant_name, phone: row.phone, city: row.city },
    course: { id: courseId, name: row.course_name, code: row.course_code, deliveryMode: row.delivery_mode },
    status: row.status,
    assignedTo: row.assigned_to ? { id: row.assigned_to, fullName: row.assigned_name } : null,
    enrollmentId: row.enrollment_id == null ? null : Number(row.enrollment_id),
    paymentConfirmedAt: row.payment_confirmed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

const APPLICATION_SELECT = `SELECT a.id, a.applicant_name, a.phone, a.city, a.course_id, a.status,
                                    a.assigned_to, a.enrollment_id, a.payment_confirmed_at, a.created_at, a.updated_at,
                                    c.name AS course_name, c.code AS course_code, c.delivery_mode,
                                    p.full_name AS assigned_name
                               FROM public_applications a
                               JOIN courses c ON c.id = a.course_id
                          LEFT JOIN profiles p ON p.user_id = a.assigned_to`

async function event(client, applicationId, actorId, eventType, { fromStatus = null, toStatus = null, note = null } = {}) {
  await client.query(
    `INSERT INTO public_application_events (application_id, actor_user_id, event_type, from_status, to_status, note)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [applicationId, actorId, eventType, fromStatus, toStatus, note],
  )
}

async function audit(client, actorId, action, applicationId, metadata) {
  await client.query(
    `INSERT INTO audit_log (actor_user_id, action, target_type, target_id, metadata)
     VALUES ($1, $2, 'public_application', $3, $4::jsonb)`,
    [actorId, action, String(applicationId), JSON.stringify(metadata)],
  )
}

function whatsappUrl(application) {
  const message = `Здравствуйте! Я оставил(а) заявку №${application.id} на курс «${application.course.name}» (${application.course.deliveryMode === 'online' ? 'онлайн' : 'оффлайн'}). Город: ${application.city}. Мой номер: ${application.phone}.`
  return `https://wa.me/996502245245?text=${encodeURIComponent(message)}`
}

GET('/v1/public/courses', async () => {
  const result = await dbQuery(
    `SELECT id, name, code, level, subject, delivery_mode
       FROM courses
      WHERE is_active = true AND delivery_mode IN ('online', 'offline')
      ORDER BY delivery_mode, name, id`,
  )
  return { status: 200, body: { items: result.rows.map(publicCourse) } }
})

POST('/v1/public/applications', async ({ req, ip }) => {
  limitedIntake(ip)
  const input = parsePublicApplicationBody(await readJson(req, 8_000))
  const application = await transaction(async client => {
    const courseResult = await client.query(
      `SELECT id, name, code, level, subject, delivery_mode
         FROM courses
        WHERE id = $1 AND is_active = true AND delivery_mode IN ('online', 'offline')
        FOR SHARE`,
      [input.courseId],
    )
    const course = courseResult.rows[0]
    if (!course) throw new HttpError(404, 'Курс пока недоступен для записи', 'course_not_available')
    const inserted = await client.query(
      `INSERT INTO public_applications (applicant_name, phone, city, course_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id, applicant_name, phone, city, course_id, status, assigned_to, enrollment_id, payment_confirmed_at, created_at, updated_at`,
      [input.name, input.phone, input.city, input.courseId],
    )
    const applicationRow = { ...inserted.rows[0], course_name: course.name, course_code: course.code, delivery_mode: course.delivery_mode, assigned_name: null }
    const response = staffApplication(applicationRow)
    await event(client, response.id, null, 'submitted')
    await audit(client, null, 'submit_public_application', response.id, { courseId: input.courseId, deliveryMode: course.delivery_mode })
    return response
  })
  return { status: 201, body: { application: { id: application.id, status: application.status, course: application.course, createdAt: application.createdAt }, whatsappUrl: whatsappUrl({ ...application, city: application.applicant.city, phone: application.applicant.phone }) } }
})

GET('/v1/admin/applications', async ({ req, config, query: searchParams }) => {
  await requireApplicationStaff(config, req)
  const status = searchParams.get('status')
  if (status && !PUBLIC_STATUSES.has(status)) throw new HttpError(400, 'Некорректный статус заявки', 'invalid_application_status')
  const result = await dbQuery(
    `${APPLICATION_SELECT}
      WHERE ($1::text IS NULL OR a.status = $1)
      ORDER BY a.updated_at DESC, a.id DESC
      LIMIT 100`,
    [status || null],
  )
  return { status: 200, body: { items: result.rows.map(staffApplication) } }
})

GET('/v1/admin/applications/:applicationId/events', async ({ req, config, params }) => {
  await requireApplicationStaff(config, req)
  const applicationId = routeId(params.applicationId, 'invalid_application_id')
  const result = await dbQuery(
    `SELECT e.id, e.event_type, e.from_status, e.to_status, e.note, e.created_at,
            p.full_name AS actor_name
       FROM public_application_events e
  LEFT JOIN profiles p ON p.user_id = e.actor_user_id
      WHERE e.application_id = $1
      ORDER BY e.created_at DESC, e.id DESC
      LIMIT 100`,
    [applicationId],
  )
  return { status: 200, body: { items: result.rows.map(row => ({ id: Number(row.id), eventType: row.event_type, fromStatus: row.from_status, toStatus: row.to_status, note: row.note, actorName: row.actor_name, createdAt: row.created_at })) } }
})

PATCH('/v1/admin/applications/:applicationId', async ({ req, config, params }) => {
  const actor = await requireApplicationStaff(config, req)
  const applicationId = routeId(params.applicationId, 'invalid_application_id')
  const input = parseApplicationPatchBody(await readJson(req, 8_000))
  const application = await transaction(async client => {
    const currentResult = await client.query(`${APPLICATION_SELECT} WHERE a.id = $1 FOR UPDATE OF a, c, p`, [applicationId])
    const current = currentResult.rows[0]
    if (!current) throw new HttpError(404, 'Заявка не найдена', 'application_not_found')
    if (input.status && !TRANSITIONS.get(current.status)?.has(input.status)) throw new HttpError(409, 'Недопустимый переход статуса', 'application_transition_forbidden')
    if (input.hasAssignedTo && input.assignedTo) {
      const assignee = await client.query(`SELECT p.user_id FROM profiles p JOIN users u ON u.id = p.user_id WHERE p.user_id = $1 AND u.blocked = false AND p.role = ANY($2::text[])`, [input.assignedTo, APPLICATION_STAFF_ROLES])
      if (!assignee.rows[0]) throw new HttpError(409, 'Ответственный недоступен', 'application_assignee_unavailable')
    }
    const updated = await client.query(
      `UPDATE public_applications
          SET status = COALESCE($2, status),
              assigned_to = CASE WHEN $3 THEN $4::uuid ELSE assigned_to END
        WHERE id = $1
      RETURNING id`,
      [applicationId, input.status, input.hasAssignedTo, input.assignedTo],
    )
    if (input.status) await event(client, applicationId, actor.id, 'status_changed', { fromStatus: current.status, toStatus: input.status })
    if (input.note) await event(client, applicationId, actor.id, 'note_added', { note: input.note })
    await audit(client, actor.id, 'update_public_application', applicationId, { status: input.status, assignedTo: input.hasAssignedTo ? input.assignedTo : undefined, noteAdded: !!input.note })
    const loaded = await client.query(`${APPLICATION_SELECT} WHERE a.id = $1`, [updated.rows[0].id])
    return staffApplication(loaded.rows[0])
  })
  return { status: 200, body: { application } }
})

POST('/v1/admin/applications/:applicationId/confirm-payment', async ({ req, config, params }) => {
  const actor = await requirePaymentConfirmer(config, req)
  const applicationId = routeId(params.applicationId, 'invalid_application_id')
  const input = parsePaymentConfirmationBody(await readJson(req, 4_000))
  const application = await transaction(async client => {
    const currentResult = await client.query(`${APPLICATION_SELECT} WHERE a.id = $1 FOR UPDATE OF a, c, p`, [applicationId])
    const current = currentResult.rows[0]
    if (!current) throw new HttpError(404, 'Заявка не найдена', 'application_not_found')
    if (current.status !== 'awaiting_confirmation') throw new HttpError(409, 'Сначала переведите заявку в ожидание подтверждения', 'payment_confirmation_unavailable')
    const studentResult = await client.query(
      `SELECT u.id, u.blocked, p.role, p.student_type
         FROM users u JOIN profiles p ON p.user_id = u.id
        WHERE u.id = $1
        FOR UPDATE OF u, p`,
      [input.studentId],
    )
    const student = studentResult.rows[0]
    if (!student || student.role !== 'student' || student.blocked) throw new HttpError(409, 'Для оплаты выберите активный аккаунт ученика', 'payment_student_unavailable')
    if (student.student_type !== current.delivery_mode) throw new HttpError(409, 'Тип обучения ученика не совпадает с курсом', 'student_course_mode_mismatch')
    let enrollmentId
    try {
      const enrollment = await client.query(
        `INSERT INTO course_enrollments (student_id, course_id, status, created_by, updated_by, confirmed_at, activated_at)
         VALUES ($1, $2, 'active', $3, $3, now(), now())
         RETURNING id`,
        [input.studentId, current.course_id, actor.id],
      )
      enrollmentId = Number(enrollment.rows[0].id)
    } catch (error) {
      if (error?.code === '23505') throw new HttpError(409, 'У ученика уже есть текущий курс', 'current_enrollment_exists')
      throw error
    }
    await client.query(
      `UPDATE public_applications
          SET status = 'enrolled', enrollment_id = $2, payment_confirmed_at = now(), payment_confirmed_by = $3
        WHERE id = $1`,
      [applicationId, enrollmentId, actor.id],
    )
    await event(client, applicationId, actor.id, 'payment_confirmed')
    await audit(client, actor.id, 'confirm_application_payment', applicationId, { studentId: input.studentId, enrollmentId })
    const loaded = await client.query(`${APPLICATION_SELECT} WHERE a.id = $1`, [applicationId])
    return staffApplication(loaded.rows[0])
  })
  return { status: 200, body: { application } }
})
