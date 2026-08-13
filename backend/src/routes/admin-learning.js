import { requireAuth } from '../auth.js'
import { query as dbQuery, transaction } from '../db.js'
import { GET, HttpError, PATCH, POST, readJson } from '../http.js'
import { requireRole } from '../authorization.js'

// Curriculum publishing is intentionally narrower than user management.  A
// junior administrator can administer assigned student accounts, but cannot
// publish or alter the learning programme for every student.
const CONTENT_MANAGER_ROLES = ['admin', 'super_admin']
const MAX_URL_LENGTH = 2_048

const COURSE_FIELDS = Object.freeze({
  name: 'name',
  code: 'code',
  level: 'level',
  subject: 'subject',
  description: 'description',
  coverImageUrl: 'cover_image_url',
  isActive: 'is_active',
})

const LESSON_FIELDS = Object.freeze({
  lessonNumber: 'lesson_number',
  title: 'title',
  description: 'description',
  subject: 'subject',
  section: 'section',
  topic: 'topic',
  lessonDate: 'lesson_date',
  durationMinutes: 'duration_minutes',
  contentUrl: 'content_url',
  isTest: 'is_test',
  isPublished: 'is_published',
})

function adminContentManager(config, req) {
  return requireAuth(config, req).then(user => requireRole(user, CONTENT_MANAGER_ROLES))
}

function objectBody(body, code) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'Некорректные данные', code)
  }
  return body
}

function hasOnly(body, fields, code, { required = [] } = {}) {
  const keys = Object.keys(objectBody(body, code))
  if (keys.some(key => !Object.hasOwn(fields, key)) || required.some(key => !Object.hasOwn(body, key))) {
    throw new HttpError(400, 'Некорректные данные', code)
  }
  return keys
}

function requiredText(value, maxLength, code) {
  if (typeof value !== 'string') throw new HttpError(400, 'Некорректные данные', code)
  const text = value.trim()
  if (!text || text.length > maxLength) throw new HttpError(400, 'Некорректные данные', code)
  return text
}

function nullableText(value, maxLength, code) {
  if (value === null) return null
  return requiredText(value, maxLength, code)
}

function nullableHttpsUrl(value, code) {
  if (value === null) return null
  if (typeof value !== 'string') throw new HttpError(400, 'Некорректная ссылка', code)
  const raw = value.trim()
  if (!raw || raw.length > MAX_URL_LENGTH) throw new HttpError(400, 'Некорректная ссылка', code)
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error('unsafe URL')
    return url.toString()
  } catch {
    throw new HttpError(400, 'Некорректная ссылка', code)
  }
}

function nullableCourseCode(value) {
  if (value === null) return null
  if (typeof value !== 'string') throw new HttpError(400, 'Некорректный код курса', 'invalid_course_code')
  const code = value.trim().toLowerCase()
  if (!/^[a-z0-9][a-z0-9_-]{1,63}$/.test(code)) {
    throw new HttpError(400, 'Некорректный код курса', 'invalid_course_code')
  }
  return code
}

function nullableDate(value) {
  if (value === null) return null
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new HttpError(400, 'Некорректная дата урока', 'invalid_lesson_date')
  }
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new HttpError(400, 'Некорректная дата урока', 'invalid_lesson_date')
  }
  return value
}

function positiveId(value, field) {
  const parsed = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : Number.NaN
  if (!Number.isSafeInteger(parsed) || parsed < 1) throw new HttpError(400, `Некорректный ${field}`, `invalid_${field}`)
  return parsed
}

function pagination(searchParams) {
  const parse = (key, fallback, min, max) => {
    const raw = searchParams.get(key)
    if (raw == null || raw === '') return fallback
    const value = Number(raw)
    if (!Number.isSafeInteger(value) || value < min || value > max) {
      throw new HttpError(400, 'Некорректная пагинация', 'invalid_pagination')
    }
    return value
  }
  return { limit: parse('limit', 50, 1, 100), offset: parse('offset', 0, 0, 100_000) }
}

function publicCourse(row) {
  return {
    id: Number(row.id),
    name: row.name,
    code: row.code,
    level: row.level,
    subject: row.subject,
    description: row.description,
    coverImageUrl: row.cover_image_url,
    isActive: row.is_active,
    lessonCount: Number(row.lesson_count ?? 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function publicLesson(row) {
  return {
    id: Number(row.id),
    courseId: Number(row.course_id),
    lessonNumber: Number(row.lesson_number),
    title: row.title,
    description: row.description,
    subject: row.subject,
    section: row.section,
    topic: row.topic,
    lessonDate: row.lesson_date,
    durationMinutes: row.duration_minutes,
    contentUrl: row.content_url,
    isTest: row.is_test,
    isPublished: row.is_published,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function courseInput(body, { requireName }) {
  const keys = hasOnly(body, COURSE_FIELDS, 'invalid_course', { required: requireName ? ['name'] : [] })
  if (!requireName && keys.length === 0) throw new HttpError(400, 'Некорректные данные', 'invalid_course_patch')
  const input = {}
  if (Object.hasOwn(body, 'name')) input.name = requiredText(body.name, 200, 'invalid_course_name')
  if (Object.hasOwn(body, 'code')) input.code = nullableCourseCode(body.code)
  if (Object.hasOwn(body, 'level')) input.level = nullableText(body.level, 80, 'invalid_course_level')
  if (Object.hasOwn(body, 'subject')) input.subject = nullableText(body.subject, 80, 'invalid_course_subject')
  if (Object.hasOwn(body, 'description')) input.description = nullableText(body.description, 20_000, 'invalid_course_description')
  if (Object.hasOwn(body, 'coverImageUrl')) input.coverImageUrl = nullableHttpsUrl(body.coverImageUrl, 'invalid_course_cover_image_url')
  if (Object.hasOwn(body, 'isActive')) {
    if (typeof body.isActive !== 'boolean') throw new HttpError(400, 'Некорректный статус курса', 'invalid_course_active')
    input.isActive = body.isActive
  }
  return input
}

/** Strictly validates data accepted when a course is created. */
export function parseCourseCreateBody(body) {
  const input = courseInput(body, { requireName: true })
  return {
    name: input.name,
    code: input.code ?? null,
    level: input.level ?? null,
    subject: input.subject ?? null,
    description: input.description ?? null,
    coverImageUrl: input.coverImageUrl ?? null,
    isActive: input.isActive ?? true,
  }
}

/** A patch never accepts ownership, group, or practice-test relationship fields. */
export function parseCoursePatchBody(body) {
  return courseInput(body, { requireName: false })
}

function lessonInput(body, { requireTitleAndNumber }) {
  const keys = hasOnly(body, LESSON_FIELDS, 'invalid_lesson', {
    required: requireTitleAndNumber ? ['lessonNumber', 'title'] : [],
  })
  if (!requireTitleAndNumber && keys.length === 0) throw new HttpError(400, 'Некорректные данные', 'invalid_lesson_patch')
  const input = {}
  if (Object.hasOwn(body, 'lessonNumber')) {
    if (!Number.isSafeInteger(body.lessonNumber) || body.lessonNumber < 1 || body.lessonNumber > 10_000) {
      throw new HttpError(400, 'Некорректный номер урока', 'invalid_lesson_number')
    }
    input.lessonNumber = body.lessonNumber
  }
  if (Object.hasOwn(body, 'title')) input.title = requiredText(body.title, 300, 'invalid_lesson_title')
  if (Object.hasOwn(body, 'description')) input.description = nullableText(body.description, 50_000, 'invalid_lesson_description')
  if (Object.hasOwn(body, 'subject')) input.subject = nullableText(body.subject, 80, 'invalid_lesson_subject')
  if (Object.hasOwn(body, 'section')) input.section = nullableText(body.section, 64, 'invalid_lesson_section')
  if (Object.hasOwn(body, 'topic')) input.topic = nullableText(body.topic, 200, 'invalid_lesson_topic')
  if (Object.hasOwn(body, 'lessonDate')) input.lessonDate = nullableDate(body.lessonDate)
  if (Object.hasOwn(body, 'durationMinutes')) {
    if (body.durationMinutes !== null && (!Number.isSafeInteger(body.durationMinutes) || body.durationMinutes < 1 || body.durationMinutes > 600)) {
      throw new HttpError(400, 'Некорректная длительность урока', 'invalid_lesson_duration')
    }
    input.durationMinutes = body.durationMinutes
  }
  if (Object.hasOwn(body, 'contentUrl')) input.contentUrl = nullableHttpsUrl(body.contentUrl, 'invalid_lesson_content_url')
  if (Object.hasOwn(body, 'isTest')) {
    if (typeof body.isTest !== 'boolean') throw new HttpError(400, 'Некорректный тип урока', 'invalid_lesson_test')
    input.isTest = body.isTest
  }
  if (Object.hasOwn(body, 'isPublished')) {
    if (typeof body.isPublished !== 'boolean') throw new HttpError(400, 'Некорректный статус урока', 'invalid_lesson_published')
    input.isPublished = body.isPublished
  }
  return input
}

/** Strictly validates lesson data without allowing a client to change its course. */
export function parseLessonCreateBody(body) {
  const input = lessonInput(body, { requireTitleAndNumber: true })
  return {
    lessonNumber: input.lessonNumber,
    title: input.title,
    description: input.description ?? null,
    subject: input.subject ?? null,
    section: input.section ?? null,
    topic: input.topic ?? null,
    lessonDate: input.lessonDate ?? null,
    durationMinutes: input.durationMinutes ?? null,
    contentUrl: input.contentUrl ?? null,
    isTest: input.isTest ?? false,
    isPublished: input.isPublished ?? false,
  }
}

export function parseLessonPatchBody(body) {
  return lessonInput(body, { requireTitleAndNumber: false })
}

async function audit(client, actor, action, targetType, targetId, fields) {
  await client.query(
    `INSERT INTO audit_log (actor_user_id, action, target_type, target_id, metadata)
     VALUES ($1, $2, $3, $4, $5::jsonb)`,
    [actor.id, action, targetType, String(targetId), JSON.stringify({ fields })],
  )
}

async function courseExists(execute, courseId) {
  const result = await execute('SELECT id FROM courses WHERE id = $1', [courseId])
  if (!result.rows[0]) throw new HttpError(404, 'Курс не найден', 'course_not_found')
}

function updateSql(table, idColumn, id, fields, fieldMap) {
  const entries = Object.entries(fields)
  const values = [id]
  const assignments = entries.map(([field], index) => {
    values.push(fields[field])
    return `${fieldMap[field]} = $${index + 2}`
  })
  assignments.push('updated_at = now()')
  return { text: `UPDATE ${table} SET ${assignments.join(', ')} WHERE ${idColumn} = $1`, values }
}

GET('/v1/admin/courses', async ({ req, config, query: searchParams }) => {
  await adminContentManager(config, req)
  const { limit, offset } = pagination(searchParams)
  const search = String(searchParams.get('q') ?? '').trim().slice(0, 100)
  const result = await dbQuery(
    `SELECT c.id, c.name, c.code, c.level, c.subject, c.description, c.cover_image_url,
            c.is_active, c.created_at, c.updated_at, count(l.id)::int AS lesson_count,
            count(*) OVER()::int AS total
       FROM courses c
       LEFT JOIN lessons l ON l.course_id = c.id
      WHERE $1 = '' OR c.name ILIKE '%' || $1 || '%' OR COALESCE(c.code, '') ILIKE '%' || $1 || '%'
      GROUP BY c.id
      ORDER BY c.updated_at DESC, c.id DESC
      LIMIT $2 OFFSET $3`,
    [search, limit, offset],
  )
  return {
    status: 200,
    body: {
      items: result.rows.map(publicCourse),
      total: Number(result.rows[0]?.total ?? 0),
      limit,
      offset,
    },
  }
})

POST('/v1/admin/courses', async ({ req, config }) => {
  const actor = await adminContentManager(config, req)
  // Text fields allow long lesson descriptions, but requests still have a
  // finite, well below proxy-limit cap.
  const input = parseCourseCreateBody(await readJson(req, 128_000))
  try {
    const course = await transaction(async client => {
      const inserted = await client.query(
        `INSERT INTO courses (name, code, level, subject, description, cover_image_url, is_active, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, name, code, level, subject, description, cover_image_url, is_active, created_at, updated_at`,
        [input.name, input.code, input.level, input.subject, input.description, input.coverImageUrl, input.isActive, actor.id],
      )
      const row = inserted.rows[0]
      await audit(client, actor, 'create_course', 'course', row.id, Object.keys(input))
      return row
    })
    return { status: 201, body: { course: publicCourse(course) } }
  } catch (error) {
    if (error?.code === '23505') throw new HttpError(409, 'Код курса уже используется', 'course_code_conflict')
    throw error
  }
})

PATCH('/v1/admin/courses/:courseId', async ({ req, params, config }) => {
  const actor = await adminContentManager(config, req)
  const courseId = positiveId(params.courseId, 'course_id')
  const input = parseCoursePatchBody(await readJson(req, 128_000))
  try {
    const course = await transaction(async client => {
      const statement = updateSql('courses', 'id', courseId, input, COURSE_FIELDS)
      const updated = await client.query(
        `${statement.text}
         RETURNING id, name, code, level, subject, description, cover_image_url, is_active, created_at, updated_at`,
        statement.values,
      )
      const row = updated.rows[0]
      if (!row) throw new HttpError(404, 'Курс не найден', 'course_not_found')
      await audit(client, actor, 'update_course', 'course', row.id, Object.keys(input))
      return row
    })
    return { status: 200, body: { course: publicCourse(course) } }
  } catch (error) {
    if (error?.code === '23505') throw new HttpError(409, 'Код курса уже используется', 'course_code_conflict')
    throw error
  }
})

GET('/v1/admin/courses/:courseId/lessons', async ({ req, params, config, query: searchParams }) => {
  await adminContentManager(config, req)
  const courseId = positiveId(params.courseId, 'course_id')
  const { limit, offset } = pagination(searchParams)
  await courseExists(dbQuery, courseId)
  const result = await dbQuery(
    `SELECT id, course_id, lesson_number, title, description, subject, section, topic,
            lesson_date, duration_minutes, content_url, is_test, is_published, created_at, updated_at,
            count(*) OVER()::int AS total
       FROM lessons
      WHERE course_id = $1
      ORDER BY lesson_number ASC, id ASC
      LIMIT $2 OFFSET $3`,
    [courseId, limit, offset],
  )
  return {
    status: 200,
    body: {
      courseId,
      items: result.rows.map(publicLesson),
      total: Number(result.rows[0]?.total ?? 0),
      limit,
      offset,
    },
  }
})

POST('/v1/admin/courses/:courseId/lessons', async ({ req, params, config }) => {
  const actor = await adminContentManager(config, req)
  const courseId = positiveId(params.courseId, 'course_id')
  const input = parseLessonCreateBody(await readJson(req, 256_000))
  try {
    const lesson = await transaction(async client => {
      await courseExists((text, values) => client.query(text, values), courseId)
      const inserted = await client.query(
        `INSERT INTO lessons (
           course_id, lesson_number, title, description, subject, section, topic, lesson_date,
           duration_minutes, content_url, is_test, is_published, created_by
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         RETURNING id, course_id, lesson_number, title, description, subject, section, topic,
                   lesson_date, duration_minutes, content_url, is_test, is_published, created_at, updated_at`,
        [
          courseId, input.lessonNumber, input.title, input.description, input.subject, input.section,
          input.topic, input.lessonDate, input.durationMinutes, input.contentUrl, input.isTest,
          input.isPublished, actor.id,
        ],
      )
      const row = inserted.rows[0]
      await audit(client, actor, 'create_lesson', 'lesson', row.id, Object.keys(input))
      return row
    })
    return { status: 201, body: { lesson: publicLesson(lesson) } }
  } catch (error) {
    if (error?.code === '23505') throw new HttpError(409, 'Номер урока уже используется в этом курсе', 'lesson_number_conflict')
    throw error
  }
})

PATCH('/v1/admin/lessons/:lessonId', async ({ req, params, config }) => {
  const actor = await adminContentManager(config, req)
  const lessonId = positiveId(params.lessonId, 'lesson_id')
  const input = parseLessonPatchBody(await readJson(req, 256_000))
  try {
    const lesson = await transaction(async client => {
      const statement = updateSql('lessons', 'id', lessonId, input, LESSON_FIELDS)
      const updated = await client.query(
        `${statement.text}
         RETURNING id, course_id, lesson_number, title, description, subject, section, topic,
                   lesson_date, duration_minutes, content_url, is_test, is_published, created_at, updated_at`,
        statement.values,
      )
      const row = updated.rows[0]
      if (!row) throw new HttpError(404, 'Урок не найден', 'lesson_not_found')
      await audit(client, actor, 'update_lesson', 'lesson', row.id, Object.keys(input))
      return row
    })
    return { status: 200, body: { lesson: publicLesson(lesson) } }
  } catch (error) {
    if (error?.code === '23505') throw new HttpError(409, 'Номер урока уже используется в этом курсе', 'lesson_number_conflict')
    throw error
  }
})
