import { requireAuth } from '../auth.js'
import { query as dbQuery, transaction } from '../db.js'
import { DELETE, GET, HttpError, PATCH, POST, readJson } from '../http.js'
import { requireRole } from '../authorization.js'

const GROUP_MANAGER_ROLES = ['admin', 'super_admin']
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const DELIVERY_MODES = new Set(['online', 'offline', 'hybrid'])
const STUDENT_TYPES = new Set(['online', 'offline', 'both'])

const GROUP_FIELDS = Object.freeze({
  name: 'name',
  deliveryMode: 'delivery_mode',
  capacity: 'capacity',
  startsOn: 'starts_on',
  endsOn: 'ends_on',
  isActive: 'is_active',
})

const GROUP_SELECT = `SELECT g.id, g.course_id, g.teacher_id, g.name, g.delivery_mode, g.capacity,
                             g.starts_on, g.ends_on, g.is_active, g.created_at, g.updated_at,
                             c.name AS course_name, c.code AS course_code, c.level AS course_level,
                             c.subject AS course_subject,
                             teacher_profile.full_name AS teacher_full_name,
                             teacher_profile.role AS teacher_role,
                             (
                               SELECT count(*)::int
                                 FROM group_students active_members
                                WHERE active_members.group_id = g.id
                                  AND active_members.left_at IS NULL
                             ) AS active_student_count
                        FROM groups g
                        JOIN courses c ON c.id = g.course_id
                   LEFT JOIN profiles teacher_profile ON teacher_profile.user_id = g.teacher_id
                       WHERE g.id = $1`

async function adminGroupManager(config, req) {
  return requireRole(await requireAuth(config, req), GROUP_MANAGER_ROLES)
}

function objectBody(body, code) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'Некорректные данные группы', code)
  }
  return body
}

function hasOnly(body, fields, code, { required = [] } = {}) {
  objectBody(body, code)
  const allowed = new Set(fields)
  if (!required.every(field => Object.hasOwn(body, field)) || !Object.keys(body).every(field => allowed.has(field))) {
    throw new HttpError(400, 'Некорректные данные группы', code)
  }
}

function positiveId(value, field) {
  const number = typeof value === 'number' ? value : Number.NaN
  if (!Number.isSafeInteger(number) || number < 1) {
    throw new HttpError(400, 'Некорректный идентификатор', `invalid_${field}`)
  }
  return number
}

/** URL and query ids arrive as strings; request bodies must still use JSON numbers. */
function routePositiveId(value, field) {
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) {
    throw new HttpError(400, 'Некорректный идентификатор', `invalid_${field}`)
  }
  return positiveId(Number(value), field)
}

function uuid(value, field) {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    throw new HttpError(400, 'Некорректный идентификатор пользователя', `invalid_${field}`)
  }
  return value
}

function requiredText(value, maxLength, code) {
  if (typeof value !== 'string') throw new HttpError(400, 'Некорректный текст', code)
  const text = value.trim()
  if (!text || text.length > maxLength) throw new HttpError(400, 'Некорректный текст', code)
  return text
}

function nullableInteger(value, min, max, code) {
  if (value === null) return null
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new HttpError(400, 'Некорректное число', code)
  }
  return value
}

function deliveryMode(value, code) {
  if (typeof value !== 'string' || !DELIVERY_MODES.has(value)) {
    throw new HttpError(400, 'Некорректный формат обучения', code)
  }
  return value
}

function nullableDate(value, code) {
  if (value === null) return null
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new HttpError(400, 'Некорректная дата', code)
  }
  const parsed = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new HttpError(400, 'Некорректная дата', code)
  }
  return value
}

function assertDateWindow(startsOn, endsOn) {
  if (startsOn && endsOn && endsOn < startsOn) {
    throw new HttpError(400, 'Дата окончания не может быть раньше даты начала', 'invalid_group_dates')
  }
}

function optionalQueryPositiveId(value, code) {
  if (value == null || value === '') return null
  return routePositiveId(value, code)
}

function optionalQueryBoolean(value, code) {
  if (value == null || value === '') return null
  if (value === 'true') return true
  if (value === 'false') return false
  throw new HttpError(400, 'Некорректный логический параметр', code)
}

function pagination(searchParams) {
  const parse = (value, fallback, min, max) => {
    if (value == null || value === '') return fallback
    const number = Number(value)
    if (!Number.isSafeInteger(number) || number < min || number > max) {
      throw new HttpError(400, 'Некорректная пагинация', 'invalid_pagination')
    }
    return number
  }
  return {
    limit: parse(searchParams.get('limit'), 50, 1, 100),
    offset: parse(searchParams.get('offset'), 0, 0, 100_000),
  }
}

function dateOnly(value, field) {
  if (value == null) return null
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10)
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  throw new HttpError(500, 'Некорректные данные группы', `invalid_${field}`)
}

function nullableText(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function responsePositiveId(value, field) {
  const number = Number(value)
  if (!Number.isSafeInteger(number) || number < 1) {
    throw new HttpError(500, 'Некорректные данные группы', `invalid_${field}`)
  }
  return number
}

function responseCount(value, field) {
  const number = Number(value)
  if (!Number.isSafeInteger(number) || number < 0) {
    throw new HttpError(500, 'Некорректные данные группы', `invalid_${field}`)
  }
  return number
}

function requiredResponseText(value, field) {
  const text = nullableText(value)
  if (!text) throw new HttpError(500, 'Некорректные данные группы', `invalid_${field}`)
  return text
}

function responseDeliveryMode(value) {
  if (!DELIVERY_MODES.has(value)) throw new HttpError(500, 'Некорректные данные группы', 'invalid_delivery_mode')
  return value
}

function responseStudentType(value) {
  if (!STUDENT_TYPES.has(value)) throw new HttpError(500, 'Некорректные данные группы', 'invalid_student_type')
  return value
}

function responseUuid(value, field) {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    throw new HttpError(500, 'Некорректные данные группы', `invalid_${field}`)
  }
  return value
}

function nullableCapacity(value) {
  if (value == null) return null
  const capacity = Number(value)
  if (!Number.isSafeInteger(capacity) || capacity < 1 || capacity > 5_000) {
    throw new HttpError(500, 'Некорректные данные группы', 'invalid_capacity')
  }
  return capacity
}

function publicGroup(row) {
  const teacherId = row.teacher_id == null ? null : responseUuid(row.teacher_id, 'teacher_id')
  if (teacherId !== null && row.teacher_role !== 'teacher') {
    throw new HttpError(500, 'Некорректные данные группы', 'invalid_group_teacher')
  }
  const teacher = teacherId === null
    ? null
    : { id: teacherId, fullName: requiredResponseText(row.teacher_full_name, 'teacher_full_name') }
  if (typeof row.is_active !== 'boolean') throw new HttpError(500, 'Некорректные данные группы', 'invalid_is_active')

  return {
    id: responsePositiveId(row.id, 'group_id'),
    course: {
      id: responsePositiveId(row.course_id, 'course_id'),
      name: requiredResponseText(row.course_name, 'course_name'),
      code: nullableText(row.course_code),
      level: nullableText(row.course_level),
      subject: nullableText(row.course_subject),
    },
    teacher,
    name: requiredResponseText(row.name, 'group_name'),
    deliveryMode: responseDeliveryMode(row.delivery_mode),
    capacity: nullableCapacity(row.capacity),
    startsOn: dateOnly(row.starts_on, 'starts_on'),
    endsOn: dateOnly(row.ends_on, 'ends_on'),
    isActive: row.is_active,
    activeStudentCount: responseCount(row.active_student_count, 'active_student_count'),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function publicMember(row) {
  return {
    membershipId: responsePositiveId(row.membership_id, 'membership_id'),
    id: responseUuid(row.student_id, 'student_id'),
    fullName: requiredResponseText(row.full_name, 'student_full_name'),
    email: requiredResponseText(row.email, 'student_email'),
    studentType: responseStudentType(row.student_type),
    joinedAt: row.joined_at,
  }
}

function publicAssignee(row, kind) {
  const result = {
    id: responseUuid(row.id, 'assignee_id'),
    fullName: requiredResponseText(row.full_name, 'assignee_full_name'),
    email: requiredResponseText(row.email, 'assignee_email'),
  }
  if (kind === 'student') result.studentType = responseStudentType(row.student_type)
  return result
}

/** Only permits fields that belong to a group; course and teacher links have dedicated routes. */
export function parseGroupCreateBody(body) {
  hasOnly(body, ['courseId', 'name', 'deliveryMode', 'capacity', 'startsOn', 'endsOn', 'isActive'], 'invalid_group', {
    required: ['courseId', 'name'],
  })
  const input = {
    courseId: positiveId(body.courseId, 'course_id'),
    name: requiredText(body.name, 160, 'invalid_group_name'),
    deliveryMode: Object.hasOwn(body, 'deliveryMode') ? deliveryMode(body.deliveryMode, 'invalid_group_delivery_mode') : 'offline',
    capacity: Object.hasOwn(body, 'capacity') ? nullableInteger(body.capacity, 1, 5_000, 'invalid_group_capacity') : null,
    startsOn: Object.hasOwn(body, 'startsOn') ? nullableDate(body.startsOn, 'invalid_group_starts_on') : null,
    endsOn: Object.hasOwn(body, 'endsOn') ? nullableDate(body.endsOn, 'invalid_group_ends_on') : null,
    isActive: Object.hasOwn(body, 'isActive') ? body.isActive : true,
  }
  if (typeof input.isActive !== 'boolean') throw new HttpError(400, 'Некорректный статус группы', 'invalid_group_active')
  assertDateWindow(input.startsOn, input.endsOn)
  return input
}

/** Course membership is immutable after creation, preserving the curriculum context for retained memberships. */
export function parseGroupPatchBody(body) {
  const fields = ['name', 'deliveryMode', 'capacity', 'startsOn', 'endsOn', 'isActive']
  hasOnly(body, fields, 'invalid_group')
  if (Object.keys(body).length === 0) throw new HttpError(400, 'Требуется хотя бы одно поле', 'invalid_group_patch')
  const input = {}
  if (Object.hasOwn(body, 'name')) input.name = requiredText(body.name, 160, 'invalid_group_name')
  if (Object.hasOwn(body, 'deliveryMode')) input.deliveryMode = deliveryMode(body.deliveryMode, 'invalid_group_delivery_mode')
  if (Object.hasOwn(body, 'capacity')) input.capacity = nullableInteger(body.capacity, 1, 5_000, 'invalid_group_capacity')
  if (Object.hasOwn(body, 'startsOn')) input.startsOn = nullableDate(body.startsOn, 'invalid_group_starts_on')
  if (Object.hasOwn(body, 'endsOn')) input.endsOn = nullableDate(body.endsOn, 'invalid_group_ends_on')
  if (Object.hasOwn(body, 'isActive')) {
    if (typeof body.isActive !== 'boolean') throw new HttpError(400, 'Некорректный статус группы', 'invalid_group_active')
    input.isActive = body.isActive
  }
  return input
}

export function parseTeacherAssignmentBody(body) {
  hasOnly(body, ['teacherId'], 'invalid_group_teacher', { required: ['teacherId'] })
  return { teacherId: body.teacherId === null ? null : uuid(body.teacherId, 'teacher_id') }
}

export function parseStudentAssignmentBody(body) {
  hasOnly(body, ['studentId'], 'invalid_group_student', { required: ['studentId'] })
  return { studentId: uuid(body.studentId, 'student_id') }
}

async function audit(client, actor, action, targetType, targetId, metadata = {}) {
  await client.query(
    `INSERT INTO audit_log (actor_user_id, action, target_type, target_id, metadata)
     VALUES ($1, $2, $3, $4, $5::jsonb)`,
    [actor.id, action, targetType, String(targetId), JSON.stringify(metadata)],
  )
}

async function groupById(execute, groupId) {
  const result = await execute(GROUP_SELECT, [groupId])
  const row = result.rows[0]
  if (!row) throw new HttpError(404, 'Группа не найдена', 'group_not_found')
  return row
}

async function lockedGroup(client, groupId) {
  const result = await client.query(
    `SELECT id, course_id, teacher_id, name, delivery_mode, capacity, starts_on, ends_on, is_active
       FROM groups
      WHERE id = $1
      FOR UPDATE`,
    [groupId],
  )
  const row = result.rows[0]
  if (!row) throw new HttpError(404, 'Группа не найдена', 'group_not_found')
  return row
}

async function activeCourse(client, courseId) {
  const result = await client.query('SELECT id, is_active FROM courses WHERE id = $1 FOR SHARE', [courseId])
  const course = result.rows[0]
  if (!course) throw new HttpError(404, 'Курс не найден', 'course_not_found')
  if (!course.is_active) throw new HttpError(409, 'Нельзя создать группу в неактивном курсе', 'course_inactive')
  return course
}

async function lockedTeacher(client, teacherId) {
  const result = await client.query(
    `SELECT u.id, u.blocked, p.role, p.full_name
       FROM users u
       JOIN profiles p ON p.user_id = u.id
      WHERE u.id = $1
      FOR UPDATE OF u, p`,
    [teacherId],
  )
  const teacher = result.rows[0]
  if (!teacher) throw new HttpError(404, 'Преподаватель не найден', 'teacher_not_found')
  if (teacher.role !== 'teacher') throw new HttpError(409, 'Указанный пользователь не является преподавателем', 'teacher_required')
  if (teacher.blocked) throw new HttpError(409, 'Заблокированного преподавателя нельзя назначить', 'teacher_blocked')
  return teacher
}

async function lockedStudent(client, studentId) {
  const result = await client.query(
    `SELECT u.id, u.email, u.blocked, p.role, p.full_name, p.student_type
       FROM users u
       JOIN profiles p ON p.user_id = u.id
      WHERE u.id = $1
      FOR UPDATE OF u, p`,
    [studentId],
  )
  const student = result.rows[0]
  if (!student) throw new HttpError(404, 'Ученик не найден', 'student_not_found')
  if (student.role !== 'student' || !STUDENT_TYPES.has(student.student_type)) {
    throw new HttpError(409, 'Указанный пользователь не является учеником учебного контура', 'student_required')
  }
  if (student.blocked) throw new HttpError(409, 'Заблокированного ученика нельзя добавить', 'student_blocked')
  return student
}

function canJoinDeliveryMode(studentType, groupDeliveryMode) {
  if (groupDeliveryMode === 'hybrid') return studentType === 'both'
  return studentType === groupDeliveryMode || studentType === 'both'
}

async function activeStudentCount(client, groupId) {
  const result = await client.query(
    `SELECT count(*)::int AS count
       FROM group_students
      WHERE group_id = $1 AND left_at IS NULL`,
    [groupId],
  )
  return responseCount(result.rows[0]?.count, 'active_student_count')
}

async function assertGroupPatchCompatibility(client, group, input) {
  const startsOn = Object.hasOwn(input, 'startsOn') ? input.startsOn : dateOnly(group.starts_on, 'starts_on')
  const endsOn = Object.hasOwn(input, 'endsOn') ? input.endsOn : dateOnly(group.ends_on, 'ends_on')
  assertDateWindow(startsOn, endsOn)

  if (Object.hasOwn(input, 'capacity') || Object.hasOwn(input, 'deliveryMode')) {
    const count = await activeStudentCount(client, group.id)
    const capacity = Object.hasOwn(input, 'capacity') ? input.capacity : nullableCapacity(group.capacity)
    if (capacity !== null && count > capacity) {
      throw new HttpError(409, 'В группе уже больше учеников, чем новая вместимость', 'group_capacity_below_membership')
    }
    if (Object.hasOwn(input, 'deliveryMode')) {
      const members = await client.query(
        `SELECT p.student_type
           FROM group_students gs
           JOIN profiles p ON p.user_id = gs.student_id
          WHERE gs.group_id = $1
            AND gs.left_at IS NULL`,
        [group.id],
      )
      if (members.rows.some(member => !canJoinDeliveryMode(member.student_type, input.deliveryMode))) {
        throw new HttpError(409, 'Сначала измените состав группы для нового формата обучения', 'group_delivery_mode_membership_conflict')
      }
    }
  }
}

function updateGroupSql(groupId, input) {
  const entries = Object.entries(input)
  const values = [groupId]
  const assignments = entries.map(([field, value], index) => {
    values.push(value)
    return `${GROUP_FIELDS[field]} = $${index + 2}`
  })
  assignments.push('updated_at = now()')
  return {
    text: `UPDATE groups SET ${assignments.join(', ')} WHERE id = $1`,
    values,
  }
}

GET('/v1/admin/groups', async ({ req, config, query: searchParams }) => {
  await adminGroupManager(config, req)
  const { limit, offset } = pagination(searchParams)
  const courseId = optionalQueryPositiveId(searchParams.get('courseId'), 'course_id')
  const isActive = optionalQueryBoolean(searchParams.get('isActive'), 'invalid_group_active')
  const search = String(searchParams.get('q') ?? '').trim().slice(0, 100)
  const result = await dbQuery(
    `SELECT g.id, g.course_id, g.teacher_id, g.name, g.delivery_mode, g.capacity,
            g.starts_on, g.ends_on, g.is_active, g.created_at, g.updated_at,
            c.name AS course_name, c.code AS course_code, c.level AS course_level,
            c.subject AS course_subject,
            teacher_profile.full_name AS teacher_full_name,
            teacher_profile.role AS teacher_role,
            (
              SELECT count(*)::int
                FROM group_students active_members
               WHERE active_members.group_id = g.id
                 AND active_members.left_at IS NULL
            ) AS active_student_count,
            count(*) OVER()::int AS total
       FROM groups g
       JOIN courses c ON c.id = g.course_id
  LEFT JOIN profiles teacher_profile ON teacher_profile.user_id = g.teacher_id
      WHERE ($1::bigint IS NULL OR g.course_id = $1)
        AND ($2::boolean IS NULL OR g.is_active = $2)
        AND ($3 = '' OR g.name ILIKE '%' || $3 || '%'
             OR c.name ILIKE '%' || $3 || '%'
             OR COALESCE(teacher_profile.full_name, '') ILIKE '%' || $3 || '%')
      ORDER BY g.is_active DESC, g.updated_at DESC, g.id DESC
      LIMIT $4 OFFSET $5`,
    [courseId, isActive, search, limit, offset],
  )
  return {
    status: 200,
    headers: { 'Cache-Control': 'private, no-store' },
    body: {
      items: result.rows.map(publicGroup),
      total: responseCount(result.rows[0]?.total ?? 0, 'total'),
      limit,
      offset,
    },
  }
})

GET('/v1/admin/groups/:groupId', async ({ req, params, config }) => {
  await adminGroupManager(config, req)
  const groupId = routePositiveId(params.groupId, 'group_id')
  const group = await groupById(dbQuery, groupId)
  return {
    status: 200,
    headers: { 'Cache-Control': 'private, no-store' },
    body: { group: publicGroup(group) },
  }
})

GET('/v1/admin/groups/:groupId/members', async ({ req, params, config, query: searchParams }) => {
  await adminGroupManager(config, req)
  const groupId = routePositiveId(params.groupId, 'group_id')
  const { limit, offset } = pagination(searchParams)
  const [group, members] = await Promise.all([
    groupById(dbQuery, groupId),
    dbQuery(
      `SELECT gs.id AS membership_id, gs.student_id, gs.joined_at,
              u.email, p.full_name, p.student_type,
              count(*) OVER()::int AS total
         FROM group_students gs
         JOIN users u ON u.id = gs.student_id
         JOIN profiles p ON p.user_id = gs.student_id AND p.role = 'student'
        WHERE gs.group_id = $1
          AND gs.left_at IS NULL
        ORDER BY gs.joined_at ASC, gs.id ASC
        LIMIT $2 OFFSET $3`,
      [groupId, limit, offset],
    ),
  ])
  return {
    status: 200,
    headers: { 'Cache-Control': 'private, no-store' },
    body: {
      group: publicGroup(group),
      items: members.rows.map(publicMember),
      total: responseCount(members.rows[0]?.total ?? 0, 'total'),
      limit,
      offset,
    },
  }
})

/** A minimized, role-specific directory for group assignment; no phone, score, or password data is exposed. */
GET('/v1/admin/group-assignees', async ({ req, config, query: searchParams }) => {
  await adminGroupManager(config, req)
  const kind = searchParams.get('kind')
  if (kind !== 'teacher' && kind !== 'student') {
    throw new HttpError(400, 'Требуется kind=teacher или kind=student', 'invalid_assignee_kind')
  }
  const { limit, offset } = pagination(searchParams)
  const search = String(searchParams.get('q') ?? '').trim().slice(0, 100)
  const result = await dbQuery(
    `SELECT u.id, u.email, p.full_name, p.student_type, count(*) OVER()::int AS total
       FROM users u
       JOIN profiles p ON p.user_id = u.id
      WHERE u.blocked = false
        AND p.role = $1
        AND ($1 <> 'student' OR p.student_type IS NOT NULL)
        AND ($2 = '' OR u.email ILIKE '%' || $2 || '%' OR p.full_name ILIKE '%' || $2 || '%')
      ORDER BY p.full_name, u.id
      LIMIT $3 OFFSET $4`,
    [kind, search, limit, offset],
  )
  return {
    status: 200,
    headers: { 'Cache-Control': 'private, no-store' },
    body: {
      items: result.rows.map(row => publicAssignee(row, kind)),
      total: responseCount(result.rows[0]?.total ?? 0, 'total'),
      limit,
      offset,
    },
  }
})

POST('/v1/admin/groups', async ({ req, config }) => {
  const actor = await adminGroupManager(config, req)
  const input = parseGroupCreateBody(await readJson(req, 16_000))
  try {
    const group = await transaction(async client => {
      await activeCourse(client, input.courseId)
      const inserted = await client.query(
        `INSERT INTO groups (course_id, name, delivery_mode, capacity, starts_on, ends_on, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [input.courseId, input.name, input.deliveryMode, input.capacity, input.startsOn, input.endsOn, input.isActive],
      )
      const groupId = inserted.rows[0].id
      await audit(client, actor, 'create_group', 'group', groupId, {
        courseId: input.courseId,
        fields: Object.keys(input).filter(field => field !== 'courseId'),
      })
      return groupById((text, values) => client.query(text, values), groupId)
    })
    return { status: 201, body: { group: publicGroup(group) } }
  } catch (error) {
    if (error?.code === '23505') throw new HttpError(409, 'В этом курсе уже есть активная группа с таким названием', 'group_name_conflict')
    throw error
  }
})

PATCH('/v1/admin/groups/:groupId', async ({ req, params, config }) => {
  const actor = await adminGroupManager(config, req)
  const groupId = routePositiveId(params.groupId, 'group_id')
  const input = parseGroupPatchBody(await readJson(req, 16_000))
  try {
    const group = await transaction(async client => {
      const existing = await lockedGroup(client, groupId)
      await assertGroupPatchCompatibility(client, existing, input)
      const statement = updateGroupSql(groupId, input)
      await client.query(statement.text, statement.values)
      await audit(client, actor, 'update_group', 'group', groupId, { fields: Object.keys(input) })
      return groupById((text, values) => client.query(text, values), groupId)
    })
    return { status: 200, body: { group: publicGroup(group) } }
  } catch (error) {
    if (error?.code === '23505') throw new HttpError(409, 'В этом курсе уже есть активная группа с таким названием', 'group_name_conflict')
    throw error
  }
})

PATCH('/v1/admin/groups/:groupId/teacher', async ({ req, params, config }) => {
  const actor = await adminGroupManager(config, req)
  const groupId = routePositiveId(params.groupId, 'group_id')
  const { teacherId } = parseTeacherAssignmentBody(await readJson(req, 4_000))
  const group = await transaction(async client => {
    const existing = await lockedGroup(client, groupId)
    if (teacherId !== null) await lockedTeacher(client, teacherId)
    const changed = existing.teacher_id !== teacherId
    if (changed) {
      await client.query('UPDATE groups SET teacher_id = $2, updated_at = now() WHERE id = $1', [groupId, teacherId])
      await audit(client, actor, teacherId === null ? 'remove_group_teacher' : 'assign_group_teacher', 'group', groupId, {
        previousTeacherId: existing.teacher_id,
        teacherId,
      })
    }
    return {
      changed,
      group: await groupById((text, values) => client.query(text, values), groupId),
    }
  })
  return { status: 200, body: { changed: group.changed, group: publicGroup(group.group) } }
})

POST('/v1/admin/groups/:groupId/students', async ({ req, params, config }) => {
  const actor = await adminGroupManager(config, req)
  const groupId = routePositiveId(params.groupId, 'group_id')
  const { studentId } = parseStudentAssignmentBody(await readJson(req, 4_000))
  const result = await transaction(async client => {
    const group = await lockedGroup(client, groupId)
    if (!group.is_active) throw new HttpError(409, 'Нельзя добавить ученика в неактивную группу', 'group_inactive')
    const student = await lockedStudent(client, studentId)
    if (!canJoinDeliveryMode(student.student_type, group.delivery_mode)) {
      throw new HttpError(409, 'Тип обучения ученика несовместим с форматом группы', 'student_delivery_mode_conflict')
    }
    const current = await client.query(
      `SELECT id AS membership_id, joined_at
         FROM group_students
        WHERE group_id = $1 AND student_id = $2 AND left_at IS NULL
        FOR UPDATE`,
      [groupId, studentId],
    )
    if (current.rows[0]) {
      return {
        created: false,
        member: publicMember({ ...current.rows[0], student_id: student.id, ...student }),
      }
    }

    const count = await activeStudentCount(client, groupId)
    const capacity = nullableCapacity(group.capacity)
    if (capacity !== null && count >= capacity) {
      throw new HttpError(409, 'В группе нет свободных мест', 'group_capacity_reached')
    }
    const inserted = await client.query(
      `INSERT INTO group_students (group_id, student_id)
       VALUES ($1, $2)
       RETURNING id AS membership_id, joined_at`,
      [groupId, studentId],
    )
    const membership = inserted.rows[0]
    await audit(client, actor, 'assign_group_student', 'group_student', membership.membership_id, { groupId, studentId })
    return {
      created: true,
      member: publicMember({ ...membership, student_id: student.id, ...student }),
    }
  })
  return { status: result.created ? 201 : 200, body: result }
})

DELETE('/v1/admin/groups/:groupId/students/:studentId', async ({ req, params, config }) => {
  const actor = await adminGroupManager(config, req)
  const groupId = routePositiveId(params.groupId, 'group_id')
  const studentId = uuid(params.studentId, 'student_id')
  const result = await transaction(async client => {
    await lockedGroup(client, groupId)
    const membership = await client.query(
      `SELECT id
         FROM group_students
        WHERE group_id = $1 AND student_id = $2 AND left_at IS NULL
        FOR UPDATE`,
      [groupId, studentId],
    )
    const row = membership.rows[0]
    if (!row) throw new HttpError(404, 'Активное назначение ученика не найдено', 'group_membership_not_found')
    const removed = await client.query(
      'UPDATE group_students SET left_at = now() WHERE id = $1 RETURNING id, left_at',
      [row.id],
    )
    await audit(client, actor, 'remove_group_student', 'group_student', row.id, { groupId, studentId })
    return removed.rows[0]
  })
  return { status: 200, body: { success: true, membershipId: responsePositiveId(result.id, 'membership_id'), leftAt: result.left_at } }
})
