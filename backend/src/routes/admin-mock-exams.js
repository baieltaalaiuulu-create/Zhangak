import { requireAuth } from '../auth.js'
import { query, transaction } from '../db.js'
import { GET, HttpError, PATCH, POST, readJson } from '../http.js'
import { requireRole } from '../authorization.js'

const MANAGER_ROLES = ['admin', 'super_admin']
const FIELDS = new Set(['title', 'startsAt', 'city', 'venue', 'capacity', 'registrationClosesAt', 'isPublished'])

async function manager(config, req) {
  return requireRole(await requireAuth(config, req), MANAGER_ROLES)
}

function text(value, max, code) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw new HttpError(400, 'Некорректные данные пробного ОРТ', code)
  return value.trim()
}

function timestamp(value, code) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
    throw new HttpError(400, 'Некорректная дата и время', code)
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) throw new HttpError(400, 'Некорректная дата и время', code)
  return date.toISOString()
}

function nullableTimestamp(value, code) { return value === null ? null : timestamp(value, code) }
function capacity(value) {
  if (value === null) return null
  if (!Number.isSafeInteger(value) || value < 1 || value > 10_000) throw new HttpError(400, 'Некорректное количество мест', 'invalid_mock_exam_capacity')
  return value
}
function positiveRouteId(value) {
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) throw new HttpError(400, 'Некорректный пробный ОРТ', 'invalid_mock_exam_id')
  return Number(value)
}
function object(body, code) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'Некорректные данные пробного ОРТ', code)
  if (Object.keys(body).some(key => !FIELDS.has(key))) throw new HttpError(400, 'Некорректные данные пробного ОРТ', code)
  return body
}
function input(body, { create }) {
  object(body, create ? 'invalid_mock_exam_create' : 'invalid_mock_exam_patch')
  const required = ['title', 'startsAt', 'city', 'venue']
  if (create && required.some(key => !Object.hasOwn(body, key))) throw new HttpError(400, 'Заполни название, время, город и место', 'invalid_mock_exam_create')
  if (!create && Object.keys(body).length === 0) throw new HttpError(400, 'Нет изменений', 'invalid_mock_exam_patch')
  const value = {}
  if (Object.hasOwn(body, 'title')) value.title = text(body.title, 200, 'invalid_mock_exam_title')
  if (Object.hasOwn(body, 'startsAt')) value.startsAt = timestamp(body.startsAt, 'invalid_mock_exam_starts_at')
  if (Object.hasOwn(body, 'city')) value.city = text(body.city, 120, 'invalid_mock_exam_city')
  if (Object.hasOwn(body, 'venue')) value.venue = text(body.venue, 300, 'invalid_mock_exam_venue')
  if (Object.hasOwn(body, 'capacity')) value.capacity = capacity(body.capacity)
  if (Object.hasOwn(body, 'registrationClosesAt')) value.registrationClosesAt = nullableTimestamp(body.registrationClosesAt, 'invalid_mock_exam_registration_closes_at')
  if (Object.hasOwn(body, 'isPublished')) {
    if (typeof body.isPublished !== 'boolean') throw new HttpError(400, 'Некорректный статус публикации', 'invalid_mock_exam_published')
    value.isPublished = body.isPublished
  }
  return value
}
function assertWindow(startsAt, closesAt) {
  if (closesAt !== null && new Date(closesAt).getTime() > new Date(startsAt).getTime()) {
    throw new HttpError(400, 'Регистрация не может закрываться после начала пробного ОРТ', 'invalid_mock_exam_registration_window')
  }
}
function publicSession(row) {
  return { id: Number(row.id), title: row.title, startsAt: row.starts_at, city: row.city, venue: row.venue,
    capacity: row.capacity === null ? null : Number(row.capacity), registrationClosesAt: row.registration_closes_at ?? null,
    isPublished: row.is_published, registeredCount: Number(row.registered_count ?? 0), createdAt: row.created_at, updatedAt: row.updated_at }
}
async function readSession(execute, id, { lock = false } = {}) {
  const result = await execute(
    `SELECT s.*, (SELECT count(*)::int FROM mock_exam_registrations r WHERE r.mock_exam_session_id = s.id) AS registered_count
       FROM mock_exam_sessions s WHERE s.id = $1${lock ? ' FOR UPDATE' : ''}`,
    [id],
  )
  if (!result.rows[0]) throw new HttpError(404, 'Пробный ОРТ не найден', 'mock_exam_not_found')
  return result.rows[0]
}

GET('/v1/admin/mock-exams', async ({ req, config }) => {
  await manager(config, req)
  const result = await query(
    `SELECT s.*, (SELECT count(*)::int FROM mock_exam_registrations r WHERE r.mock_exam_session_id = s.id) AS registered_count
       FROM mock_exam_sessions s ORDER BY s.starts_at DESC, s.id DESC LIMIT 100`,
  )
  return { status: 200, body: { items: result.rows.map(publicSession) } }
})

POST('/v1/admin/mock-exams', async ({ req, config }) => {
  const actor = await manager(config, req)
  const value = input(await readJson(req, 8_000), { create: true })
  assertWindow(value.startsAt, value.registrationClosesAt ?? null)
  const session = await transaction(async client => {
    const inserted = await client.query(
      `INSERT INTO mock_exam_sessions (title, starts_at, city, venue, capacity, registration_closes_at, is_published, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [value.title, value.startsAt, value.city, value.venue, value.capacity ?? null, value.registrationClosesAt ?? null, value.isPublished ?? false, actor.id],
    )
    await client.query(
      `INSERT INTO audit_log (actor_user_id, action, target_type, target_id, metadata)
       VALUES ($1, 'create_mock_exam', 'mock_exam_session', $2, $3::jsonb)`,
      [actor.id, inserted.rows[0].id, JSON.stringify({ fields: Object.keys(value) })],
    )
    return readSession((sql, params) => client.query(sql, params), inserted.rows[0].id)
  })
  return { status: 201, body: { session: publicSession(session) } }
})

PATCH('/v1/admin/mock-exams/:sessionId', async ({ req, params, config }) => {
  const actor = await manager(config, req)
  const id = positiveRouteId(params.sessionId)
  const value = input(await readJson(req, 8_000), { create: false })
  const session = await transaction(async client => {
    const existing = await readSession((sql, values) => client.query(sql, values), id, { lock: true })
    const startsAt = value.startsAt ?? existing.starts_at
    const closesAt = Object.hasOwn(value, 'registrationClosesAt') ? value.registrationClosesAt : existing.registration_closes_at
    assertWindow(startsAt, closesAt)
    const fields = { title: 'title', startsAt: 'starts_at', city: 'city', venue: 'venue', capacity: 'capacity', registrationClosesAt: 'registration_closes_at', isPublished: 'is_published' }
    const entries = Object.entries(value)
    const values = [id]
    const assignments = entries.map(([key, item], index) => { values.push(item); return `${fields[key]} = $${index + 2}` })
    await client.query(`UPDATE mock_exam_sessions SET ${assignments.join(', ')}, updated_at = now() WHERE id = $1`, values)
    await client.query(
      `INSERT INTO audit_log (actor_user_id, action, target_type, target_id, metadata)
       VALUES ($1, 'update_mock_exam', 'mock_exam_session', $2, $3::jsonb)`,
      [actor.id, id, JSON.stringify({ fields: Object.keys(value) })],
    )
    return readSession((sql, params) => client.query(sql, params), id)
  })
  return { status: 200, body: { session: publicSession(session) } }
})
