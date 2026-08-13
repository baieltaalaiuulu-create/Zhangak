import { requireAuth } from '../auth.js'
import { query as dbQuery, transaction } from '../db.js'
import { GET, HttpError, PATCH, POST, readJson } from '../http.js'
import { requireRole } from '../authorization.js'

// Assessment authors are deliberately limited to the same senior content
// roles as course and lesson authors. Student-facing routes never import this
// module: it is the only content-management surface that projects editable
// answer keys.
const CONTENT_MANAGER_ROLES = ['admin', 'super_admin']
const TEST_TYPES = new Set(['practice', 'mock', 'bank', 'diagnostic'])
const ANSWERS = new Set(['a', 'b', 'c', 'd'])
const DIFFICULTIES = new Set(['easy', 'medium', 'hard'])
const MAX_URL_LENGTH = 2_048

const PRACTICE_TEST_FIELDS = Object.freeze({
  title: 'title',
  subject: 'subject',
  testType: 'test_type',
  description: 'description',
  timeLimitSeconds: 'time_limit_seconds',
  maxAttempts: 'max_attempts',
  passScoreRatio: 'pass_score_ratio',
  isPublished: 'is_published',
  availableFrom: 'available_from',
  availableUntil: 'available_until',
})

const PRACTICE_QUESTION_FIELDS = Object.freeze({
  questionText: 'question_text',
  options: 'options',
  correctAnswer: 'correct_answer',
  explanation: 'explanation',
  section: 'section',
  topic: 'topic',
  difficulty: 'difficulty',
  imageUrl: 'image_url',
  position: 'position',
  isActive: 'is_active',
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

function positiveId(value, field) {
  const parsed = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : Number.NaN
  if (!Number.isSafeInteger(parsed) || parsed < 1) throw new HttpError(400, `Некорректный ${field}`, `invalid_${field}`)
  return parsed
}

function positiveInteger(value, max, code) {
  if (!Number.isSafeInteger(value) || value < 1 || value > max) {
    throw new HttpError(400, 'Некорректные данные', code)
  }
  return value
}

function nullablePositiveInteger(value, max, code) {
  if (value === null) return null
  return positiveInteger(value, max, code)
}

function nullableRatio(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new HttpError(400, 'Некорректный проходной балл', 'invalid_practice_test_pass_score_ratio')
  }
  // The database stores at most four decimal places. Rejecting an implicit
  // rounding prevents an author from publishing a threshold they did not see.
  const normalized = Math.round(value * 10_000) / 10_000
  if (Math.abs(normalized - value) > Number.EPSILON) {
    throw new HttpError(400, 'Некорректный проходной балл', 'invalid_practice_test_pass_score_ratio')
  }
  return normalized
}

function nullableTimestamp(value, code) {
  if (value === null) return null
  const match = typeof value === 'string'
    ? /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.exec(value)
    : null
  if (!match) {
    throw new HttpError(400, 'Некорректное время доступности', code)
  }
  const [year, month, day, hour, minute, second] = match.slice(1, 7).map(Number)
  const calendarDate = new Date(Date.UTC(year, month - 1, day, hour, minute, second))
  if (calendarDate.getUTCFullYear() !== year || calendarDate.getUTCMonth() !== month - 1
    || calendarDate.getUTCDate() !== day || calendarDate.getUTCHours() !== hour
    || calendarDate.getUTCMinutes() !== minute || calendarDate.getUTCSeconds() !== second) {
    throw new HttpError(400, 'Некорректное время доступности', code)
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) throw new HttpError(400, 'Некорректное время доступности', code)
  return date.toISOString()
}

function timestampMilliseconds(value) {
  if (value == null) return null
  const timestamp = new Date(value).getTime()
  return Number.isNaN(timestamp) ? null : timestamp
}

function assertAvailability(availableFrom, availableUntil) {
  const from = timestampMilliseconds(availableFrom)
  const until = timestampMilliseconds(availableUntil)
  if (from !== null && until !== null && until <= from) {
    throw new HttpError(400, 'Окончание доступности должно быть позже начала', 'invalid_practice_test_availability')
  }
}

function normalizedSection(value) {
  if (typeof value !== 'string') throw new HttpError(400, 'Некорректный раздел', 'invalid_practice_question_section')
  const section = value.trim().toLowerCase()
  if (!/^[a-z][a-z0-9_-]{0,63}$/.test(section)) {
    throw new HttpError(400, 'Некорректный раздел', 'invalid_practice_question_section')
  }
  return section
}

function options(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new HttpError(400, 'Некорректные варианты ответа', 'invalid_practice_question_options')
  }
  const keys = Object.keys(value).sort()
  if (keys.length !== 4 || keys.some((key, index) => key !== ['a', 'b', 'c', 'd'][index])) {
    throw new HttpError(400, 'Некорректные варианты ответа', 'invalid_practice_question_options')
  }
  return Object.fromEntries(['a', 'b', 'c', 'd'].map(answer => [
    answer,
    requiredText(value[answer], 10_000, 'invalid_practice_question_options'),
  ]))
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

function dateValue(value) {
  if (value == null) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function numberOrNull(value) {
  if (value == null) return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function publicPracticeTest(row) {
  return {
    id: Number(row.id),
    courseId: numberOrNull(row.course_id),
    lessonId: numberOrNull(row.lesson_id),
    title: row.title,
    subject: row.subject,
    testType: row.test_type,
    description: row.description,
    timeLimitSeconds: numberOrNull(row.time_limit_seconds),
    maxAttempts: numberOrNull(row.max_attempts),
    passScoreRatio: numberOrNull(row.pass_score_ratio),
    isPublished: row.is_published,
    availableFrom: dateValue(row.available_from),
    availableUntil: dateValue(row.available_until),
    questionCount: Number(row.question_count ?? 0),
    activeQuestionCount: Number(row.active_question_count ?? 0),
    createdAt: dateValue(row.created_at),
    updatedAt: dateValue(row.updated_at),
  }
}

// This projection is deliberately admin-only. Its correctAnswer property is
// never reused by platform-learning.js, which maps student questions through
// publicAttemptQuestion before an attempt is submitted.
function adminPracticeQuestion(row) {
  return {
    id: Number(row.id),
    practiceTestId: Number(row.practice_test_id),
    questionText: row.question_text,
    options: row.options,
    correctAnswer: row.correct_answer,
    explanation: row.explanation,
    section: row.section,
    topic: row.topic,
    difficulty: row.difficulty,
    imageUrl: row.image_url,
    position: Number(row.position),
    isActive: row.is_active,
    createdAt: dateValue(row.created_at),
    updatedAt: dateValue(row.updated_at),
  }
}

function practiceTestInput(body, { create }) {
  const keys = hasOnly(body, PRACTICE_TEST_FIELDS, 'invalid_practice_test', {
    required: create ? ['title', 'subject'] : [],
  })
  if (!create && keys.length === 0) {
    throw new HttpError(400, 'Некорректные данные', 'invalid_practice_test_patch')
  }
  const input = {}
  if (Object.hasOwn(body, 'title')) input.title = requiredText(body.title, 500, 'invalid_practice_test_title')
  if (Object.hasOwn(body, 'subject')) input.subject = requiredText(body.subject, 80, 'invalid_practice_test_subject')
  if (Object.hasOwn(body, 'testType')) {
    if (!TEST_TYPES.has(body.testType)) throw new HttpError(400, 'Некорректный тип теста', 'invalid_practice_test_type')
    input.testType = body.testType
  }
  if (Object.hasOwn(body, 'description')) input.description = nullableText(body.description, 20_000, 'invalid_practice_test_description')
  if (Object.hasOwn(body, 'timeLimitSeconds')) {
    input.timeLimitSeconds = nullablePositiveInteger(body.timeLimitSeconds, 86_400, 'invalid_practice_test_time_limit')
  }
  if (Object.hasOwn(body, 'maxAttempts')) {
    input.maxAttempts = nullablePositiveInteger(body.maxAttempts, 1_000, 'invalid_practice_test_max_attempts')
  }
  if (Object.hasOwn(body, 'passScoreRatio')) input.passScoreRatio = nullableRatio(body.passScoreRatio)
  if (Object.hasOwn(body, 'isPublished')) {
    if (typeof body.isPublished !== 'boolean') throw new HttpError(400, 'Некорректный статус теста', 'invalid_practice_test_published')
    input.isPublished = body.isPublished
  }
  if (Object.hasOwn(body, 'availableFrom')) {
    input.availableFrom = nullableTimestamp(body.availableFrom, 'invalid_practice_test_available_from')
  }
  if (Object.hasOwn(body, 'availableUntil')) {
    input.availableUntil = nullableTimestamp(body.availableUntil, 'invalid_practice_test_available_until')
  }
  const availableFrom = Object.hasOwn(input, 'availableFrom') ? input.availableFrom : null
  const availableUntil = Object.hasOwn(input, 'availableUntil') ? input.availableUntil : null
  if (create) assertAvailability(availableFrom, availableUntil)
  return input
}

/** Strictly validates a course- or lesson-scoped test body. */
export function parsePracticeTestCreateBody(body) {
  const input = practiceTestInput(body, { create: true })
  return {
    title: input.title,
    subject: input.subject,
    testType: input.testType ?? 'practice',
    description: input.description ?? null,
    timeLimitSeconds: input.timeLimitSeconds ?? null,
    maxAttempts: input.maxAttempts ?? null,
    passScoreRatio: input.passScoreRatio ?? 0.7,
    isPublished: input.isPublished ?? false,
    availableFrom: input.availableFrom ?? null,
    availableUntil: input.availableUntil ?? null,
  }
}

/** A test's course and lesson binding are immutable after creation. */
export function parsePracticeTestPatchBody(body) {
  return practiceTestInput(body, { create: false })
}

function practiceQuestionInput(body, { create }) {
  const keys = hasOnly(body, PRACTICE_QUESTION_FIELDS, 'invalid_practice_question', {
    required: create ? ['questionText', 'options', 'correctAnswer', 'position'] : [],
  })
  if (!create && keys.length === 0) {
    throw new HttpError(400, 'Некорректные данные', 'invalid_practice_question_patch')
  }
  const input = {}
  if (Object.hasOwn(body, 'questionText')) input.questionText = requiredText(body.questionText, 10_000, 'invalid_practice_question_text')
  if (Object.hasOwn(body, 'options')) input.options = options(body.options)
  if (Object.hasOwn(body, 'correctAnswer')) {
    if (!ANSWERS.has(body.correctAnswer)) {
      throw new HttpError(400, 'Некорректный правильный ответ', 'invalid_practice_question_correct_answer')
    }
    input.correctAnswer = body.correctAnswer
  }
  if (Object.hasOwn(body, 'explanation')) {
    input.explanation = nullableText(body.explanation, 20_000, 'invalid_practice_question_explanation')
  }
  if (Object.hasOwn(body, 'section')) {
    input.section = body.section === null
      ? 'general'
      : normalizedSection(body.section)
  }
  if (Object.hasOwn(body, 'topic')) input.topic = nullableText(body.topic, 200, 'invalid_practice_question_topic')
  if (Object.hasOwn(body, 'difficulty')) {
    if (!DIFFICULTIES.has(body.difficulty)) {
      throw new HttpError(400, 'Некорректная сложность', 'invalid_practice_question_difficulty')
    }
    input.difficulty = body.difficulty
  }
  if (Object.hasOwn(body, 'imageUrl')) input.imageUrl = nullableHttpsUrl(body.imageUrl, 'invalid_practice_question_image_url')
  if (Object.hasOwn(body, 'position')) input.position = positiveInteger(body.position, 200, 'invalid_practice_question_position')
  if (Object.hasOwn(body, 'isActive')) {
    if (typeof body.isActive !== 'boolean') throw new HttpError(400, 'Некорректный статус вопроса', 'invalid_practice_question_active')
    input.isActive = body.isActive
  }
  return input
}

/** Questions accept exactly four labelled choices and a server-only key. */
export function parsePracticeQuestionCreateBody(body) {
  const input = practiceQuestionInput(body, { create: true })
  return {
    questionText: input.questionText,
    options: input.options,
    correctAnswer: input.correctAnswer,
    explanation: input.explanation ?? null,
    section: input.section ?? 'general',
    topic: input.topic ?? null,
    difficulty: input.difficulty ?? 'medium',
    imageUrl: input.imageUrl ?? null,
    position: input.position,
    isActive: input.isActive ?? true,
  }
}

export function parsePracticeQuestionPatchBody(body) {
  return practiceQuestionInput(body, { create: false })
}

async function audit(client, actor, action, targetType, targetId, metadata) {
  await client.query(
    `INSERT INTO audit_log (actor_user_id, action, target_type, target_id, metadata)
     VALUES ($1, $2, $3, $4, $5::jsonb)`,
    [actor.id, action, targetType, String(targetId), JSON.stringify(metadata)],
  )
}

async function courseExists(execute, courseId) {
  const result = await execute('SELECT id FROM courses WHERE id = $1', [courseId])
  if (!result.rows[0]) throw new HttpError(404, 'Курс не найден', 'course_not_found')
}

async function courseForLesson(execute, lessonId, { lock = false } = {}) {
  const result = await execute(
    `SELECT id, course_id
       FROM lessons
      WHERE id = $1${lock ? ' FOR SHARE' : ''}`,
    [lessonId],
  )
  const lesson = result.rows[0]
  if (!lesson) throw new HttpError(404, 'Урок не найден', 'lesson_not_found')
  return { lessonId: Number(lesson.id), courseId: Number(lesson.course_id) }
}

function practiceTestSelect(where, { includeTotal = false } = {}) {
  return `SELECT t.id, t.course_id, t.lesson_id, t.title, t.subject, t.test_type,
                 t.description, t.time_limit_seconds, t.max_attempts, t.pass_score_ratio,
                 t.is_published, t.available_from, t.available_until, t.created_at, t.updated_at,
                 count(q.id)::int AS question_count,
                 count(q.id) FILTER (WHERE q.is_active)::int AS active_question_count${includeTotal ? ',\n                 count(*) OVER()::int AS total' : ''}
            FROM practice_tests t
            LEFT JOIN practice_questions q ON q.practice_test_id = t.id
           ${where}
           GROUP BY t.id`
}

async function loadPracticeTest(execute, testId) {
  const result = await execute(
    `${practiceTestSelect('WHERE t.id = $1')}`,
    [testId],
  )
  const test = result.rows[0]
  if (!test) throw new HttpError(404, 'Тест не найден', 'practice_test_not_found')
  return test
}

async function lockPracticeTest(client, testId) {
  const result = await client.query(
    `SELECT id, course_id, lesson_id, available_from, available_until, is_published
       FROM practice_tests
      WHERE id = $1
      FOR UPDATE`,
    [testId],
  )
  const test = result.rows[0]
  if (!test) throw new HttpError(404, 'Тест не найден', 'practice_test_not_found')
  return test
}

async function activeQuestionCount(client, testId) {
  const result = await client.query(
    `SELECT count(*)::int AS count
       FROM practice_questions
      WHERE practice_test_id = $1 AND is_active = true`,
    [testId],
  )
  return Number(result.rows[0].count)
}

async function ensurePublishedTestHasActiveQuestion(client, test) {
  if (test.is_published && await activeQuestionCount(client, test.id) < 1) {
    throw new HttpError(409, 'У опубликованного теста должен остаться активный вопрос', 'published_test_requires_question')
  }
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

function testListResponse(rows, limit, offset) {
  return {
    items: rows.map(publicPracticeTest),
    total: Number(rows[0]?.total ?? 0),
    limit,
    offset,
  }
}

async function listPracticeTests({ query: searchParams }, scope, id) {
  const { limit, offset } = pagination(searchParams)
  if (scope === 'course') await courseExists(dbQuery, id)
  else await courseForLesson(dbQuery, id)
  const predicate = scope === 'course' ? 't.course_id = $1' : 't.lesson_id = $1'
  const result = await dbQuery(
    `${practiceTestSelect(`WHERE ${predicate}`, { includeTotal: true })}
       ORDER BY t.updated_at DESC, t.id DESC
       LIMIT $2 OFFSET $3`,
    [id, limit, offset],
  )
  return { status: 200, body: testListResponse(result.rows, limit, offset) }
}

async function createPracticeTest({ req, config }, actor, scope, id) {
  const input = parsePracticeTestCreateBody(await readJson(req, 128_000))
  if (input.isPublished) {
    // A new test is necessarily empty. Requiring an explicit publish patch
    // after questions have been created avoids silently publishing an
    // invisible/broken student test.
    throw new HttpError(409, 'Сначала добавьте хотя бы один активный вопрос', 'published_test_requires_question')
  }
  const test = await transaction(async client => {
    let courseId = id
    let lessonId = null
    if (scope === 'course') await courseExists((text, values) => client.query(text, values), courseId)
    else {
      const lesson = await courseForLesson((text, values) => client.query(text, values), id, { lock: true })
      courseId = lesson.courseId
      lessonId = lesson.lessonId
    }
    const inserted = await client.query(
      `INSERT INTO practice_tests (
         course_id, lesson_id, title, subject, test_type, description,
         time_limit_seconds, max_attempts, pass_score_ratio, is_published,
         available_from, available_until, created_by
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING id`,
      [
        courseId, lessonId, input.title, input.subject, input.testType,
        input.description, input.timeLimitSeconds, input.maxAttempts,
        input.passScoreRatio, input.isPublished, input.availableFrom,
        input.availableUntil, actor.id,
      ],
    )
    const row = await loadPracticeTest((text, values) => client.query(text, values), inserted.rows[0].id)
    await audit(client, actor, 'create_practice_test', 'practice_test', row.id, {
      fields: Object.keys(input),
      courseId,
      lessonId,
    })
    return row
  })
  return { status: 201, body: { practiceTest: publicPracticeTest(test) } }
}

GET('/v1/admin/courses/:courseId/practice-tests', async context => {
  await adminContentManager(context.config, context.req)
  const courseId = positiveId(context.params.courseId, 'course_id')
  return listPracticeTests(context, 'course', courseId)
})

POST('/v1/admin/courses/:courseId/practice-tests', async context => {
  const actor = await adminContentManager(context.config, context.req)
  const courseId = positiveId(context.params.courseId, 'course_id')
  return createPracticeTest(context, actor, 'course', courseId)
})

GET('/v1/admin/lessons/:lessonId/practice-tests', async context => {
  await adminContentManager(context.config, context.req)
  const lessonId = positiveId(context.params.lessonId, 'lesson_id')
  return listPracticeTests(context, 'lesson', lessonId)
})

POST('/v1/admin/lessons/:lessonId/practice-tests', async context => {
  const actor = await adminContentManager(context.config, context.req)
  const lessonId = positiveId(context.params.lessonId, 'lesson_id')
  return createPracticeTest(context, actor, 'lesson', lessonId)
})

GET('/v1/admin/practice-tests/:testId', async ({ req, params, config }) => {
  await adminContentManager(config, req)
  const testId = positiveId(params.testId, 'practice_test_id')
  const test = await loadPracticeTest(dbQuery, testId)
  return { status: 200, body: { practiceTest: publicPracticeTest(test) } }
})

PATCH('/v1/admin/practice-tests/:testId', async ({ req, params, config }) => {
  const actor = await adminContentManager(config, req)
  const testId = positiveId(params.testId, 'practice_test_id')
  const input = parsePracticeTestPatchBody(await readJson(req, 128_000))
  const test = await transaction(async client => {
    const current = await lockPracticeTest(client, testId)
    const availableFrom = Object.hasOwn(input, 'availableFrom') ? input.availableFrom : current.available_from
    const availableUntil = Object.hasOwn(input, 'availableUntil') ? input.availableUntil : current.available_until
    assertAvailability(availableFrom, availableUntil)
    const publishing = input.isPublished === true && !current.is_published
    if (publishing && await activeQuestionCount(client, testId) < 1) {
      throw new HttpError(409, 'Сначала добавьте хотя бы один активный вопрос', 'published_test_requires_question')
    }
    const statement = updateSql('practice_tests', 'id', testId, input, PRACTICE_TEST_FIELDS)
    await client.query(statement.text, statement.values)
    const row = await loadPracticeTest((text, values) => client.query(text, values), testId)
    await audit(client, actor, 'update_practice_test', 'practice_test', testId, { fields: Object.keys(input) })
    return row
  })
  return { status: 200, body: { practiceTest: publicPracticeTest(test) } }
})

GET('/v1/admin/practice-tests/:testId/questions', async ({ req, params, config, query: searchParams }) => {
  await adminContentManager(config, req)
  const testId = positiveId(params.testId, 'practice_test_id')
  const { limit, offset } = pagination(searchParams)
  await loadPracticeTest(dbQuery, testId)
  const result = await dbQuery(
    `SELECT id, practice_test_id, question_text, options, correct_answer,
            explanation, section, topic, difficulty, image_url, position, is_active,
            created_at, updated_at, count(*) OVER()::int AS total
       FROM practice_questions
      WHERE practice_test_id = $1
      ORDER BY position ASC, id ASC
      LIMIT $2 OFFSET $3`,
    [testId, limit, offset],
  )
  return {
    status: 200,
    body: {
      practiceTestId: testId,
      items: result.rows.map(adminPracticeQuestion),
      total: Number(result.rows[0]?.total ?? 0),
      limit,
      offset,
    },
  }
})

POST('/v1/admin/practice-tests/:testId/questions', async ({ req, params, config }) => {
  const actor = await adminContentManager(config, req)
  const testId = positiveId(params.testId, 'practice_test_id')
  const input = parsePracticeQuestionCreateBody(await readJson(req, 128_000))
  try {
    const question = await transaction(async client => {
      await lockPracticeTest(client, testId)
      const inserted = await client.query(
        `INSERT INTO practice_questions (
           practice_test_id, question_text, options, correct_answer, explanation,
           section, topic, difficulty, image_url, position, is_active
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING id, practice_test_id, question_text, options, correct_answer,
                   explanation, section, topic, difficulty, image_url, position,
                   is_active, created_at, updated_at`,
        [
          testId, input.questionText, input.options, input.correctAnswer,
          input.explanation, input.section, input.topic, input.difficulty,
          input.imageUrl, input.position, input.isActive,
        ],
      )
      const row = inserted.rows[0]
      await audit(client, actor, 'create_practice_question', 'practice_question', row.id, {
        fields: Object.keys(input),
        practiceTestId: testId,
      })
      return row
    })
    return { status: 201, body: { question: adminPracticeQuestion(question) } }
  } catch (error) {
    if (error?.code === '23505') throw new HttpError(409, 'Этот номер вопроса уже используется', 'practice_question_position_conflict')
    throw error
  }
})

PATCH('/v1/admin/practice-questions/:questionId', async ({ req, params, config }) => {
  const actor = await adminContentManager(config, req)
  const questionId = positiveId(params.questionId, 'practice_question_id')
  const input = parsePracticeQuestionPatchBody(await readJson(req, 128_000))
  try {
    const question = await transaction(async client => {
      const loaded = await client.query(
        `SELECT q.id, q.practice_test_id, q.is_active, t.is_published
           FROM practice_questions q
           JOIN practice_tests t ON t.id = q.practice_test_id
          WHERE q.id = $1
          FOR UPDATE OF q, t`,
        [questionId],
      )
      const current = loaded.rows[0]
      if (!current) throw new HttpError(404, 'Вопрос не найден', 'practice_question_not_found')
      const statement = updateSql('practice_questions', 'id', questionId, input, PRACTICE_QUESTION_FIELDS)
      const updated = await client.query(
        `${statement.text}
         RETURNING id, practice_test_id, question_text, options, correct_answer,
                   explanation, section, topic, difficulty, image_url, position,
                   is_active, created_at, updated_at`,
        statement.values,
      )
      const row = updated.rows[0]
      await ensurePublishedTestHasActiveQuestion(client, {
        id: current.practice_test_id,
        is_published: current.is_published,
      })
      await audit(client, actor, 'update_practice_question', 'practice_question', row.id, {
        fields: Object.keys(input),
        practiceTestId: Number(row.practice_test_id),
      })
      return row
    })
    return { status: 200, body: { question: adminPracticeQuestion(question) } }
  } catch (error) {
    if (error?.code === '23505') throw new HttpError(409, 'Этот номер вопроса уже используется', 'practice_question_position_conflict')
    throw error
  }
})
