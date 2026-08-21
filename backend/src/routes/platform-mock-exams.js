import { requireAuth } from '../auth.js'
import { query, transaction } from '../db.js'
import { GET, HttpError, POST, readJson } from '../http.js'

const STUDENT_ROLES = ['student', 'math_student']

async function onlineStudent(config, req) {
  const user = await requireAuth(config, req)
  if (!STUDENT_ROLES.includes(user.role) || (user.role === 'student' && user.student_type !== 'online')) {
    throw new HttpError(403, 'Доступен только ученику онлайн-курса', 'online_student_required')
  }
  const enrolled = await query(
    `SELECT 1 FROM active_course_enrollments ce
       JOIN courses c ON c.id = ce.course_id AND c.delivery_mode = 'online'
      WHERE ce.student_id = $1 AND ce.status = 'active'
      LIMIT 1`,
    [user.id],
  )
  if (!enrolled.rows[0]) throw new HttpError(403, 'Нужен активный доступ к онлайн-курсу', 'active_online_enrollment_required')
  return user
}

function positiveRouteId(value) {
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) throw new HttpError(400, 'Некорректный пробный ОРТ', 'invalid_mock_exam_id')
  const id = Number(value)
  if (!Number.isSafeInteger(id)) throw new HttpError(400, 'Некорректный пробный ОРТ', 'invalid_mock_exam_id')
  return id
}

function publicSession(row) {
  return {
    id: Number(row.id), title: row.title, startsAt: row.starts_at,
    city: row.city, venue: row.venue, capacity: row.capacity === null ? null : Number(row.capacity),
    registrationClosesAt: row.registration_closes_at ?? null,
    registeredCount: Number(row.registered_count ?? 0),
    isRegistered: Boolean(row.is_registered),
  }
}

async function nextSession(execute, studentId, { lock = false } = {}) {
  const result = await execute(
    `SELECT s.id, s.title, s.starts_at, s.city, s.venue, s.capacity, s.registration_closes_at,
            (SELECT count(*)::int FROM mock_exam_registrations r WHERE r.mock_exam_session_id = s.id) AS registered_count,
            EXISTS (SELECT 1 FROM mock_exam_registrations mine WHERE mine.mock_exam_session_id = s.id AND mine.student_id = $1) AS is_registered
       FROM mock_exam_sessions s
      WHERE s.is_published = true
        AND s.starts_at > now()
        AND COALESCE(s.registration_closes_at, s.starts_at) > now()
      ORDER BY s.starts_at ASC, s.id ASC
      LIMIT 1${lock ? ' FOR UPDATE' : ''}`,
    [studentId],
  )
  return result.rows[0] ?? null
}

GET('/v1/platform/mock-exams/upcoming', async ({ req, config }) => {
  const user = await onlineStudent(config, req)
  const session = await nextSession(query, user.id)
  return { status: 200, body: { session: session ? publicSession(session) : null } }
})

POST('/v1/platform/mock-exams/:sessionId/register', async ({ req, params, config }) => {
  const user = await onlineStudent(config, req)
  const body = await readJson(req, 512)
  if (Object.keys(body).length !== 0) throw new HttpError(400, 'Некорректные данные регистрации', 'invalid_mock_exam_registration')
  const sessionId = positiveRouteId(params.sessionId)
  const registration = await transaction(async client => {
    const selected = await client.query(
      `SELECT id, title, starts_at, city, venue, capacity, registration_closes_at
         FROM mock_exam_sessions
        WHERE id = $1 AND is_published = true
          AND starts_at > now() AND COALESCE(registration_closes_at, starts_at) > now()
        FOR UPDATE`,
      [sessionId],
    )
    const session = selected.rows[0]
    if (!session) throw new HttpError(404, 'Регистрация на этот пробный ОРТ закрыта', 'mock_exam_unavailable')
    const existing = await client.query(
      `SELECT id FROM mock_exam_registrations WHERE mock_exam_session_id = $1 AND student_id = $2`,
      [sessionId, user.id],
    )
    if (!existing.rows[0]) {
      const count = await client.query(`SELECT count(*)::int AS value FROM mock_exam_registrations WHERE mock_exam_session_id = $1`, [sessionId])
      if (session.capacity !== null && Number(count.rows[0].value) >= Number(session.capacity)) {
        throw new HttpError(409, 'Свободных мест на этот пробный ОРТ уже нет', 'mock_exam_capacity_reached')
      }
      await client.query(
        `INSERT INTO mock_exam_registrations (mock_exam_session_id, student_id) VALUES ($1, $2)`,
        [sessionId, user.id],
      )
      await client.query(
        `INSERT INTO audit_log (actor_user_id, action, target_type, target_id, metadata)
         VALUES ($1, 'register_mock_exam', 'mock_exam_session', $2, $3::jsonb)`,
        [user.id, sessionId, JSON.stringify({ sessionId })],
      )
    }
    const registered = await client.query(`SELECT count(*)::int AS value FROM mock_exam_registrations WHERE mock_exam_session_id = $1`, [sessionId])
    return { ...session, registered_count: registered.rows[0].value, is_registered: true }
  })
  return { status: 200, body: { session: publicSession(registration) } }
})
