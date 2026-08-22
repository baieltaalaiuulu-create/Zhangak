import { requireAuth } from '../auth.js'
import { query as dbQuery, transaction } from '../db.js'
import { DELETE, GET, HttpError, PATCH, POST, readJson } from '../http.js'
import { requireRole } from '../authorization.js'
import { receiveMaterialUpload } from '../multipart.js'
import { removePrivateObject } from '../storage.js'
import { canonicalYoutubeWatchUrl, normalizeYoutubeVideoId } from '../youtube.js'

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
  deliveryMode: 'delivery_mode',
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

const MATERIAL_FIELDS = Object.freeze({
  materialType: 'material_type',
  title: 'title',
  position: 'position',
  bodyMarkdown: 'body_markdown',
  externalUrl: 'external_url',
  isPublished: 'is_published',
})

// `hasOnly` validates the keys a client may send; these column maps add the
// server-derived `video_id`, which a client must never be able to set.
const LESSON_COLUMNS = Object.freeze({ ...LESSON_FIELDS, videoId: 'video_id', videoQuarantined: 'video_quarantined' })

const ROADMAP_UNIT_FIELDS = Object.freeze({
  unitNumber: 'unit_number',
  title: 'title',
  description: 'description',
  accentColor: 'accent_color',
  isPublished: 'is_published',
})

const ROADMAP_PLACEMENT_FIELDS = Object.freeze({
  lessonId: 'lesson_id',
  position: 'position',
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

function positivePosition(value) {
  if (!Number.isSafeInteger(value) || value < 1 || value > 10_000) {
    throw new HttpError(400, 'Некорректная позиция материала', 'invalid_material_position')
  }
  return value
}

function roadmapUnitNumber(value) {
  if (!Number.isSafeInteger(value) || value < 1 || value > 10_000) {
    throw new HttpError(400, 'Некорректный номер раздела', 'invalid_roadmap_unit_number')
  }
  return value
}

function roadmapPosition(value) {
  if (!Number.isSafeInteger(value) || value < 1 || value > 10_000) {
    throw new HttpError(400, 'Некорректная позиция урока', 'invalid_roadmap_position')
  }
  return value
}

function roadmapAccent(value) {
  if (!['green', 'blue', 'violet', 'red'].includes(value)) {
    throw new HttpError(400, 'Некорректный цвет раздела', 'invalid_roadmap_accent_color')
  }
  return value
}

function roadmapUnitInput(body, { requireTitleAndNumber }) {
  const keys = hasOnly(body, ROADMAP_UNIT_FIELDS, 'invalid_roadmap_unit', {
    required: requireTitleAndNumber ? ['unitNumber', 'title'] : [],
  })
  if (!requireTitleAndNumber && keys.length === 0) throw new HttpError(400, 'Некорректные данные', 'invalid_roadmap_unit_patch')
  const input = {}
  if (Object.hasOwn(body, 'unitNumber')) input.unitNumber = roadmapUnitNumber(body.unitNumber)
  if (Object.hasOwn(body, 'title')) input.title = requiredText(body.title, 200, 'invalid_roadmap_unit_title')
  if (Object.hasOwn(body, 'description')) input.description = nullableText(body.description, 10_000, 'invalid_roadmap_unit_description')
  if (Object.hasOwn(body, 'accentColor')) input.accentColor = roadmapAccent(body.accentColor)
  if (Object.hasOwn(body, 'isPublished')) {
    if (typeof body.isPublished !== 'boolean') throw new HttpError(400, 'Некорректный статус раздела', 'invalid_roadmap_unit_publish')
    input.isPublished = body.isPublished
  }
  return input
}

export function parseRoadmapUnitCreateBody(body) {
  const input = roadmapUnitInput(body, { requireTitleAndNumber: true })
  return {
    unitNumber: input.unitNumber, title: input.title, description: input.description ?? null,
    accentColor: input.accentColor ?? 'green', isPublished: input.isPublished ?? false,
  }
}

export function parseRoadmapUnitPatchBody(body) {
  return roadmapUnitInput(body, { requireTitleAndNumber: false })
}

export function parseRoadmapPlacementBody(body) {
  hasOnly(body, ROADMAP_PLACEMENT_FIELDS, 'invalid_roadmap_placement', { required: ['lessonId', 'position'] })
  return {
    lessonId: positiveId(String(body.lessonId), 'lesson_id'),
    position: roadmapPosition(body.position),
  }
}

/**
 * Every administrator-supplied video reference collapses to one verified id
 * here. The stored URL is regenerated from that id, so a playlist, a live
 * stream, a tracking parameter or a lookalike host never reaches the
 * database and the student route never re-parses operator input.
 */
function youtubeVideoSource(value) {
  const videoId = normalizeYoutubeVideoId(value)
  return { videoId, externalUrl: canonicalYoutubeWatchUrl(videoId) }
}

function publicMaterial(row) {
  return {
    id: Number(row.id), lessonId: Number(row.lesson_id), materialType: row.material_type,
    title: row.title, position: Number(row.position), bodyMarkdown: row.body_markdown ?? null,
    externalUrl: row.external_url ?? null, videoId: row.video_id ?? null,
    // A video row with no verified id is quarantined: preserved and
    // unpublishable until an administrator re-enters the reference.
    needsVideoRepair: row.material_type === 'video' && !row.video_id,
    mimeType: row.mime_type ?? null,
    byteSize: row.byte_size == null ? null : Number(row.byte_size),
    isPublished: row.is_published, scanStatus: row.scan_status,
    originalFilename: row.original_filename ?? null, createdAt: row.created_at,
  }
}

export function parseMaterialTextBody(body) {
  const keys = hasOnly(body, MATERIAL_FIELDS, 'invalid_lesson_material', {
    required: ['materialType', 'title', 'position'],
  })
  const materialType = body.materialType
  if (materialType !== 'rich_text' && materialType !== 'video') {
    throw new HttpError(400, 'Для файла используйте загрузку, а не JSON', 'invalid_material_type')
  }
  if (typeof body.isPublished !== 'undefined' && typeof body.isPublished !== 'boolean') {
    throw new HttpError(400, 'Некорректный статус публикации', 'invalid_material_publish')
  }
  if (materialType === 'rich_text') {
    if (keys.some(key => !['materialType', 'title', 'position', 'bodyMarkdown', 'isPublished'].includes(key))) throw new HttpError(400, 'Некорректный текстовый материал', 'invalid_lesson_material')
    return { materialType, title: requiredText(body.title, 300, 'invalid_material_title'), position: positivePosition(body.position), bodyMarkdown: requiredText(body.bodyMarkdown, 500_000, 'invalid_material_body'), externalUrl: null, videoId: null, isPublished: body.isPublished ?? false }
  }
  if (keys.some(key => !['materialType', 'title', 'position', 'externalUrl', 'isPublished'].includes(key))) throw new HttpError(400, 'Некорректный видео-материал', 'invalid_lesson_material')
  const video = youtubeVideoSource(body.externalUrl)
  return { materialType, title: requiredText(body.title, 300, 'invalid_material_title'), position: positivePosition(body.position), bodyMarkdown: null, externalUrl: video.externalUrl, videoId: video.videoId, isPublished: body.isPublished ?? false }
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
    deliveryMode: row.delivery_mode,
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

function publicRoadmapUnit(row) {
  return {
    id: Number(row.id), courseId: Number(row.course_id), unitNumber: Number(row.unit_number), title: row.title,
    description: row.description ?? null, accentColor: row.accent_color, isPublished: row.is_published,
    lessonCount: Number(row.lesson_count ?? 0), createdAt: row.created_at, updatedAt: row.updated_at,
  }
}

function publicRoadmapPlacement(row) {
  return {
    unitId: Number(row.unit_id), lessonId: Number(row.lesson_id), position: Number(row.position),
    lessonNumber: Number(row.lesson_number), title: row.title, isPublished: row.is_published,
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
  if (Object.hasOwn(body, 'deliveryMode')) {
    if (body.deliveryMode !== 'online' && body.deliveryMode !== 'offline') {
      throw new HttpError(400, 'Некорректный формат обучения', 'invalid_course_delivery_mode')
    }
    input.deliveryMode = body.deliveryMode
  }
  if (Object.hasOwn(body, 'isActive')) {
    if (typeof body.isActive !== 'boolean') throw new HttpError(400, 'Некорректный статус курса', 'invalid_course_active')
    input.isActive = body.isActive
  }
  return input
}

/** Strictly validates data accepted when a course is created. */
export function parseCourseCreateBody(body) {
  const input = courseInput(body, { requireName: true })
  const deliveryMode = input.deliveryMode ?? 'online'
  return {
    name: input.name,
    code: input.code ?? null,
    level: input.level ?? null,
    subject: deliveryMode === 'online' ? 'ort' : (input.subject ?? null),
    description: input.description ?? null,
    coverImageUrl: input.coverImageUrl ?? null,
    deliveryMode,
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
  if (Object.hasOwn(body, 'contentUrl')) {
    // A lesson may still point at a non-YouTube resource (an external
    // reading). Only a YouTube value becomes a playable video, and it is
    // normalized here so `video_id` and `content_url` can never disagree.
    const raw = nullableHttpsUrl(body.contentUrl, 'invalid_lesson_content_url')
    const looksLikeYoutube = raw !== null && /^https:\/\/(?:[a-z0-9-]+\.)*(?:youtube\.com|youtu\.be|youtube-nocookie\.com)(?:[/:?]|$)/i.test(raw)
    const video = looksLikeYoutube ? youtubeVideoSource(raw) : null
    input.contentUrl = video ? video.externalUrl : raw
    input.videoId = video ? video.videoId : null
    // Any accepted write leaves a decodable state, so a legacy quarantine
    // flag set by migration 015 is cleared here rather than lingering.
    input.videoQuarantined = false
  }
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
    videoId: input.videoId ?? null,
    videoQuarantined: false,
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

async function lessonExists(execute, lessonId) {
  const result = await execute('SELECT id FROM lessons WHERE id = $1', [lessonId])
  if (!result.rows[0]) throw new HttpError(404, 'Урок не найден', 'lesson_not_found')
}

async function insertTextMaterial(client, actor, lessonId, input) {
  await lessonExists((text, values) => client.query(text, values), lessonId)
  const inserted = await client.query(
    `INSERT INTO lesson_materials (
       lesson_id, material_type, title, position, body_markdown, external_url, video_id,
       is_published, scan_status, scanned_at, scanned_by, created_by
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'clean', now(), $9, $9)
     RETURNING id, lesson_id, material_type, title, position, body_markdown, external_url, video_id,
               mime_type, byte_size, is_published, scan_status, original_filename, created_at`,
    [lessonId, input.materialType, input.title, input.position, input.bodyMarkdown, input.externalUrl, input.videoId, input.isPublished, actor.id],
  )
  const row = inserted.rows[0]
  await audit(client, actor, 'create_lesson_material', 'lesson_material', row.id, [input.materialType, 'text'])
  return row
}

GET('/v1/admin/lessons/:lessonId/materials', async ({ req, params, config }) => {
  await adminContentManager(config, req)
  const lessonId = positiveId(params.lessonId, 'lesson_id')
  await lessonExists(dbQuery, lessonId)
  const result = await dbQuery(
    `SELECT id, lesson_id, material_type, title, position, body_markdown, external_url, video_id,
            mime_type, byte_size, is_published, scan_status, original_filename, created_at
       FROM lesson_materials WHERE lesson_id = $1 ORDER BY position, id`,
    [lessonId],
  )
  return { status: 200, body: { items: result.rows.map(publicMaterial) } }
})

POST('/v1/admin/lessons/:lessonId/materials', async ({ req, params, config }) => {
  const actor = await adminContentManager(config, req)
  const lessonId = positiveId(params.lessonId, 'lesson_id')
  const input = parseMaterialTextBody(await readJson(req, 512_000))
  try {
    const material = await transaction(client => insertTextMaterial(client, actor, lessonId, input))
    return { status: 201, body: { material: publicMaterial(material) } }
  } catch (error) {
    if (error?.code === '23505') throw new HttpError(409, 'Эта позиция материала уже занята', 'material_position_conflict')
    throw error
  }
})

POST('/v1/admin/lessons/:lessonId/materials/upload', async ({ req, params, config }) => {
  const actor = await adminContentManager(config, req)
  const lessonId = positiveId(params.lessonId, 'lesson_id')
  await lessonExists(dbQuery, lessonId)
  const upload = await receiveMaterialUpload(req, config, lessonId)
  let storagePersisted = false
  try {
    const title = requiredText(upload.fields.title, 300, 'invalid_material_title')
    const position = positivePosition(Number(upload.fields.position))
    // Binary files are never publishable on upload. They remain inaccessible
    // until a trusted administrator records a clean review.
    if (upload.fields.isPublished != null && upload.fields.isPublished !== 'false') {
      throw new HttpError(400, 'Файл можно опубликовать только после проверки', 'material_review_required')
    }
    const material = await transaction(async client => {
      const inserted = await client.query(
        `INSERT INTO lesson_materials (
           lesson_id, material_type, title, position, storage_key, mime_type, byte_size,
           is_published, scan_status, original_filename, content_sha256, created_by
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, false, 'pending', $8, $9, $10)
         RETURNING id, lesson_id, material_type, title, position, body_markdown, external_url, video_id,
                   mime_type, byte_size, is_published, scan_status, original_filename, created_at`,
        [lessonId, upload.file.materialType, title, position, upload.key, upload.file.mimeType,
          upload.file.bytes, upload.file.originalFilename, upload.file.sha256, actor.id],
      )
      const row = inserted.rows[0]
      await audit(client, actor, 'upload_lesson_material_pending_review', 'lesson_material', row.id, [upload.file.materialType, upload.file.bytes])
      return row
    })
    storagePersisted = true
    return { status: 202, body: { material: publicMaterial(material) } }
  } catch (error) {
    if (!storagePersisted) await removePrivateObject(config, upload.key).catch(() => {})
    if (error?.code === '23505') throw new HttpError(409, 'Эта позиция материала уже занята', 'material_position_conflict')
    throw error
  }
})

POST('/v1/admin/materials/:materialId/review', async ({ req, params, config }) => {
  const actor = await adminContentManager(config, req)
  const materialId = positiveId(params.materialId, 'material_id')
  const body = objectBody(await readJson(req, 2_000), 'invalid_material_review')
  if (!hasOnly(body, { status: 'status', publish: 'publish' }, 'invalid_material_review', { required: ['status'] })
    || !['clean', 'rejected'].includes(body.status)
    || (Object.hasOwn(body, 'publish') && typeof body.publish !== 'boolean')) {
    throw new HttpError(400, 'Некорректное решение по материалу', 'invalid_material_review')
  }
  if (body.status === 'rejected' && body.publish === true) throw new HttpError(400, 'Отклонённый материал нельзя публиковать', 'invalid_material_review')
  const result = await transaction(async client => {
    const current = await client.query(
      `SELECT id, lesson_id, material_type, title, position, body_markdown, external_url, video_id, storage_key,
              mime_type, byte_size, is_published, scan_status, original_filename, created_at
         FROM lesson_materials WHERE id = $1 FOR UPDATE`, [materialId],
    )
    const row = current.rows[0]
    if (!row) throw new HttpError(404, 'Материал не найден', 'material_not_found')
    if (!['document', 'image'].includes(row.material_type) || row.scan_status !== 'pending') {
      throw new HttpError(409, 'Материал уже проверен или не требует проверки', 'material_review_not_available')
    }
    const published = body.status === 'clean' ? (body.publish ?? false) : false
    const updated = await client.query(
      `UPDATE lesson_materials
          SET scan_status = $2, scanned_at = now(), scanned_by = $3, is_published = $4
        WHERE id = $1
        RETURNING id, lesson_id, material_type, title, position, body_markdown, external_url, video_id,
                  mime_type, byte_size, is_published, scan_status, original_filename, created_at`,
      [materialId, body.status, actor.id, published],
    )
    await audit(client, actor, `review_lesson_material_${body.status}`, 'lesson_material', materialId, [published])
    return { material: updated.rows[0], storageKey: row.storage_key }
  })
  if (body.status === 'rejected') await removePrivateObject(config, result.storageKey).catch(() => {})
  return { status: 200, body: { material: publicMaterial(result.material) } }
})

/**
 * Publish or hide a non-file material.
 *
 * Rich text and video carry no uploaded object, so there is nothing for an
 * antivirus/review queue to clear: they are created `clean` but unpublished,
 * and this is how an administrator makes one visible after checking it.
 *
 * Documents and images are deliberately excluded. They must continue to go
 * through `/review`, which is the step that records who inspected the file.
 */
/**
 * Publish, hide, or repair a non-file material.
 *
 * Rich text and video carry no uploaded object, so there is nothing for an
 * antivirus/review queue to clear: they are created `clean` but unpublished,
 * and this is how an administrator makes one visible after checking it.
 *
 * `externalUrl` is the repair path for a quarantined video — a legacy row
 * whose reference migration 015 could not decode. The replacement goes
 * through the same normalizer as a fresh insert, so a repair cannot smuggle
 * in a playlist or a lookalike host, and a successful repair moves the row
 * back into the canonical playable state.
 *
 * Documents and images are deliberately excluded. They must continue to go
 * through `/review`, which is the step that records who inspected the file.
 */
PATCH('/v1/admin/materials/:materialId', async ({ req, params, config }) => {
  const actor = await adminContentManager(config, req)
  const materialId = positiveId(params.materialId, 'material_id')
  const body = objectBody(await readJson(req, 4_000), 'invalid_material_patch')
  const keys = hasOnly(body, { isPublished: 'is_published', externalUrl: 'external_url' }, 'invalid_material_patch')
  if (keys.length === 0) throw new HttpError(400, 'Некорректные данные', 'invalid_material_patch')
  if (Object.hasOwn(body, 'isPublished') && typeof body.isPublished !== 'boolean') {
    throw new HttpError(400, 'Некорректный статус публикации', 'invalid_material_publish')
  }
  const repair = Object.hasOwn(body, 'externalUrl') ? youtubeVideoSource(body.externalUrl) : null

  const material = await transaction(async client => {
    const current = await client.query(
      'SELECT id, material_type, video_id, is_published FROM lesson_materials WHERE id = $1 FOR UPDATE',
      [materialId],
    )
    const row = current.rows[0]
    if (!row) throw new HttpError(404, 'Материал не найден', 'material_not_found')
    if (!['rich_text', 'video'].includes(row.material_type)) {
      throw new HttpError(409, 'Файл публикуется только после проверки', 'material_review_required')
    }
    if (repair && row.material_type !== 'video') {
      throw new HttpError(409, 'Ссылку можно заменить только у видео', 'invalid_material_type')
    }
    const videoId = repair ? repair.videoId : row.video_id
    const isPublished = Object.hasOwn(body, 'isPublished') ? body.isPublished : row.is_published
    // A video row without a verified id is quarantined; publishing it would
    // render an empty player. Repairing and publishing in one request is
    // allowed because the repair supplies the id in the same transaction.
    if (row.material_type === 'video' && !videoId && isPublished) {
      throw new HttpError(409, 'Сначала исправьте ссылку на видео', 'material_video_repair_required')
    }
    const updated = await client.query(
      `UPDATE lesson_materials
          SET is_published = $2,
              external_url = COALESCE($3, external_url),
              video_id = COALESCE($4, video_id),
              updated_at = now()
        WHERE id = $1
        RETURNING id, lesson_id, material_type, title, position, body_markdown, external_url, video_id,
                  mime_type, byte_size, is_published, scan_status, original_filename, created_at`,
      [materialId, isPublished, repair?.externalUrl ?? null, repair?.videoId ?? null],
    )
    const action = repair ? 'repair_lesson_material_video' : (isPublished ? 'publish_lesson_material' : 'hide_lesson_material')
    await audit(client, actor, action, 'lesson_material', materialId, [row.material_type])
    return updated.rows[0]
  })
  return { status: 200, body: { material: publicMaterial(material) } }
})

GET('/v1/admin/courses', async ({ req, config, query: searchParams }) => {
  await adminContentManager(config, req)
  const { limit, offset } = pagination(searchParams)
  const search = String(searchParams.get('q') ?? '').trim().slice(0, 100)
  const result = await dbQuery(
    `SELECT c.id, c.name, c.code, c.level, c.subject, c.description, c.cover_image_url, c.delivery_mode,
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
        `INSERT INTO courses (name, code, level, subject, description, cover_image_url, delivery_mode, is_active, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id, name, code, level, subject, description, cover_image_url, delivery_mode, is_active, created_at, updated_at`,
        [input.name, input.code, input.level, input.subject, input.description, input.coverImageUrl, input.deliveryMode, input.isActive, actor.id],
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

GET('/v1/admin/courses/:courseId', async ({ req, params, config }) => {
  await adminContentManager(config, req)
  const courseId = positiveId(params.courseId, 'course_id')
  const result = await dbQuery(
    `SELECT c.id, c.name, c.code, c.level, c.subject, c.description, c.cover_image_url, c.delivery_mode,
            c.is_active, c.created_at, c.updated_at, count(l.id)::int AS lesson_count
       FROM courses c
       LEFT JOIN lessons l ON l.course_id = c.id
      WHERE c.id = $1
      GROUP BY c.id`,
    [courseId],
  )
  const course = result.rows[0]
  if (!course) throw new HttpError(404, 'Курс не найден', 'course_not_found')
  return { status: 200, body: { course: publicCourse(course) } }
})

PATCH('/v1/admin/courses/:courseId', async ({ req, params, config }) => {
  const actor = await adminContentManager(config, req)
  const courseId = positiveId(params.courseId, 'course_id')
  const input = parseCoursePatchBody(await readJson(req, 128_000))
  try {
    const course = await transaction(async client => {
      const current = await client.query('SELECT delivery_mode FROM courses WHERE id = $1 FOR UPDATE', [courseId])
      if (!current.rows[0]) throw new HttpError(404, 'Курс не найден', 'course_not_found')
      const nextDeliveryMode = input.deliveryMode ?? current.rows[0].delivery_mode
      if (nextDeliveryMode === 'online') input.subject = 'ort'
      const statement = updateSql('courses', 'id', courseId, input, COURSE_FIELDS)
      const updated = await client.query(
        `${statement.text}
         RETURNING id, name, code, level, subject, description, cover_image_url, delivery_mode, is_active, created_at, updated_at`,
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
           duration_minutes, content_url, video_id, video_quarantined, is_test, is_published, created_by
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
         RETURNING id, course_id, lesson_number, title, description, subject, section, topic,
                   lesson_date, duration_minutes, content_url, is_test, is_published, created_at, updated_at`,
        [
          courseId, input.lessonNumber, input.title, input.description, input.subject, input.section,
          input.topic, input.lessonDate, input.durationMinutes, input.contentUrl, input.videoId, input.videoQuarantined, input.isTest,
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

GET('/v1/admin/lessons/:lessonId', async ({ req, params, config }) => {
  await adminContentManager(config, req)
  const lessonId = positiveId(params.lessonId, 'lesson_id')
  const result = await dbQuery(
    `SELECT id, course_id, lesson_number, title, description, subject, section, topic,
            lesson_date, duration_minutes, content_url, is_test, is_published, created_at, updated_at
       FROM lessons WHERE id = $1`,
    [lessonId],
  )
  const lesson = result.rows[0]
  if (!lesson) throw new HttpError(404, 'Урок не найден', 'lesson_not_found')
  return { status: 200, body: { lesson: publicLesson(lesson) } }
})

PATCH('/v1/admin/lessons/:lessonId', async ({ req, params, config }) => {
  const actor = await adminContentManager(config, req)
  const lessonId = positiveId(params.lessonId, 'lesson_id')
  const input = parseLessonPatchBody(await readJson(req, 256_000))
  try {
    const lesson = await transaction(async client => {
      const statement = updateSql('lessons', 'id', lessonId, input, LESSON_COLUMNS)
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

GET('/v1/admin/courses/:courseId/roadmap', async ({ req, params, config }) => {
  await adminContentManager(config, req)
  const courseId = positiveId(params.courseId, 'course_id')
  await courseExists(dbQuery, courseId)
  const [unitResult, placementResult, unassignedResult] = await Promise.all([
    dbQuery(
      `SELECT u.id, u.course_id, u.unit_number, u.title, u.description, u.accent_color, u.is_published,
              u.created_at, u.updated_at, count(ul.lesson_id)::int AS lesson_count
         FROM course_units u
         LEFT JOIN course_unit_lessons ul ON ul.unit_id = u.id
        WHERE u.course_id = $1
        GROUP BY u.id
        ORDER BY u.unit_number, u.id`, [courseId],
    ),
    dbQuery(
      `SELECT ul.unit_id, ul.lesson_id, ul.position, l.lesson_number, l.title, l.is_published
         FROM course_unit_lessons ul
         JOIN lessons l ON l.id = ul.lesson_id AND l.course_id = ul.course_id
        WHERE ul.course_id = $1
        ORDER BY ul.unit_id, ul.position, ul.lesson_id`, [courseId],
    ),
    dbQuery(
      `SELECT l.id, l.course_id, l.lesson_number, l.title, l.description, l.subject, l.section, l.topic,
              l.lesson_date, l.duration_minutes, l.content_url, l.is_test, l.is_published, l.created_at, l.updated_at
         FROM lessons l
        WHERE l.course_id = $1
          AND NOT EXISTS (
            SELECT 1 FROM course_unit_lessons ul WHERE ul.course_id = l.course_id AND ul.lesson_id = l.id
          )
        ORDER BY l.lesson_number, l.id`, [courseId],
    ),
  ])
  return {
    status: 200,
    body: {
      courseId,
      units: unitResult.rows.map(publicRoadmapUnit),
      placements: placementResult.rows.map(publicRoadmapPlacement),
      unassignedLessons: unassignedResult.rows.map(publicLesson),
    },
  }
})

POST('/v1/admin/courses/:courseId/roadmap/units', async ({ req, params, config }) => {
  const actor = await adminContentManager(config, req)
  const courseId = positiveId(params.courseId, 'course_id')
  const input = parseRoadmapUnitCreateBody(await readJson(req, 32_000))
  try {
    const unit = await transaction(async client => {
      await courseExists((text, values) => client.query(text, values), courseId)
      const inserted = await client.query(
        `INSERT INTO course_units (course_id, unit_number, title, description, accent_color, is_published, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, course_id, unit_number, title, description, accent_color, is_published, created_at, updated_at`,
        [courseId, input.unitNumber, input.title, input.description, input.accentColor, input.isPublished, actor.id],
      )
      const row = inserted.rows[0]
      await audit(client, actor, 'create_course_roadmap_unit', 'course_unit', row.id, Object.keys(input))
      return row
    })
    return { status: 201, body: { unit: publicRoadmapUnit(unit) } }
  } catch (error) {
    if (error?.code === '23505') throw new HttpError(409, 'Номер раздела уже используется в этом курсе', 'roadmap_unit_number_conflict')
    throw error
  }
})

PATCH('/v1/admin/roadmap/units/:unitId', async ({ req, params, config }) => {
  const actor = await adminContentManager(config, req)
  const unitId = positiveId(params.unitId, 'unit_id')
  const input = parseRoadmapUnitPatchBody(await readJson(req, 32_000))
  try {
    const unit = await transaction(async client => {
      const statement = updateSql('course_units', 'id', unitId, input, ROADMAP_UNIT_FIELDS)
      const updated = await client.query(
        `${statement.text}
         RETURNING id, course_id, unit_number, title, description, accent_color, is_published, created_at, updated_at`, statement.values,
      )
      const row = updated.rows[0]
      if (!row) throw new HttpError(404, 'Раздел дорожной карты не найден', 'roadmap_unit_not_found')
      await audit(client, actor, 'update_course_roadmap_unit', 'course_unit', row.id, Object.keys(input))
      return row
    })
    return { status: 200, body: { unit: publicRoadmapUnit(unit) } }
  } catch (error) {
    if (error?.code === '23505') throw new HttpError(409, 'Номер раздела уже используется в этом курсе', 'roadmap_unit_number_conflict')
    throw error
  }
})

POST('/v1/admin/roadmap/units/:unitId/lessons', async ({ req, params, config }) => {
  const actor = await adminContentManager(config, req)
  const unitId = positiveId(params.unitId, 'unit_id')
  const input = parseRoadmapPlacementBody(await readJson(req, 8_000))
  try {
    const placement = await transaction(async client => {
      const unitResult = await client.query('SELECT id, course_id FROM course_units WHERE id = $1 FOR UPDATE', [unitId])
      const unit = unitResult.rows[0]
      if (!unit) throw new HttpError(404, 'Раздел дорожной карты не найден', 'roadmap_unit_not_found')
      const lessonResult = await client.query('SELECT id, course_id FROM lessons WHERE id = $1 FOR UPDATE', [input.lessonId])
      const lesson = lessonResult.rows[0]
      if (!lesson) throw new HttpError(404, 'Урок не найден', 'lesson_not_found')
      if (Number(lesson.course_id) !== Number(unit.course_id)) {
        throw new HttpError(409, 'Урок относится к другому курсу', 'roadmap_course_mismatch')
      }
      const inserted = await client.query(
        `INSERT INTO course_unit_lessons (unit_id, course_id, lesson_id, position)
         VALUES ($1, $2, $3, $4)
         RETURNING unit_id, lesson_id, position`,
        [unit.id, unit.course_id, lesson.id, input.position],
      )
      const row = inserted.rows[0]
      await audit(client, actor, 'place_course_roadmap_lesson', 'course_unit_lesson', `${row.unit_id}:${row.lesson_id}`, [input.position])
      return row
    })
    return { status: 201, body: { placement: { unitId: Number(placement.unit_id), lessonId: Number(placement.lesson_id), position: Number(placement.position) } } }
  } catch (error) {
    if (error?.code === '23505') throw new HttpError(409, 'Урок уже размещён в карте или эта позиция занята', 'roadmap_placement_conflict')
    throw error
  }
})

DELETE('/v1/admin/roadmap/units/:unitId/lessons/:lessonId', async ({ req, params, config }) => {
  const actor = await adminContentManager(config, req)
  const unitId = positiveId(params.unitId, 'unit_id')
  const lessonId = positiveId(params.lessonId, 'lesson_id')
  const removed = await transaction(async client => {
    const result = await client.query(
      'DELETE FROM course_unit_lessons WHERE unit_id = $1 AND lesson_id = $2 RETURNING unit_id, lesson_id', [unitId, lessonId],
    )
    const row = result.rows[0]
    if (!row) throw new HttpError(404, 'Урок не найден в этом разделе', 'roadmap_placement_not_found')
    await audit(client, actor, 'remove_course_roadmap_lesson', 'course_unit_lesson', `${row.unit_id}:${row.lesson_id}`, [])
    return row
  })
  return { status: 200, body: { removed: { unitId: Number(removed.unit_id), lessonId: Number(removed.lesson_id) } } }
})
