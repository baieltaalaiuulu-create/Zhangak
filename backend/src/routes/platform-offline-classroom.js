import { requireAuth } from '../auth.js'
import { transaction } from '../db.js'
import { GET, HttpError, POST, readJson } from '../http.js'

const STAFF_ROLES = new Set(['teacher', 'admin', 'super_admin'])
const ATTENDANCE = new Set(['present', 'late', 'absent'])
const VISIBILITY = new Set(['student', 'internal'])
const GRADE_TYPES = new Set(['lesson', 'homework', 'manual'])
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function positiveId(value, field) {
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) throw new HttpError(400, 'Некорректный идентификатор', `invalid_${field}`)
  const id = Number(value)
  if (!Number.isSafeInteger(id)) throw new HttpError(400, 'Некорректный идентификатор', `invalid_${field}`)
  return id
}

function bodyObject(value, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new HttpError(400, 'Некорректные данные', code)
  return value
}

function only(value, fields, code, required = []) {
  const body = bodyObject(value, code)
  if (!required.every(field => Object.hasOwn(body, field)) || !Object.keys(body).every(field => fields.includes(field))) {
    throw new HttpError(400, 'Некорректные данные', code)
  }
  return body
}

function requiredText(value, max, code) {
  if (typeof value !== 'string') throw new HttpError(400, 'Некорректный текст', code)
  const normalized = value.trim()
  if (!normalized || normalized.length > max) throw new HttpError(400, 'Некорректный текст', code)
  return normalized
}

function optionalText(value, max, code) {
  if (value === undefined || value === null) return null
  return requiredText(value, max, code)
}

function nullableId(value, field) {
  if (value === undefined || value === null) return null
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) throw new HttpError(400, 'Некорректный идентификатор', `invalid_${field}`)
  return value
}

function uuid(value, field) {
  if (typeof value !== 'string' || !UUID.test(value)) throw new HttpError(400, 'Некорректный идентификатор ученика', `invalid_${field}`)
  return value
}

function timestamp(value, field) {
  if (typeof value !== 'string' || value.length > 64) throw new HttpError(400, 'Некорректная дата и время', `invalid_${field}`)
  const parsed = new Date(value)
  if (!Number.isFinite(parsed.getTime())) throw new HttpError(400, 'Некорректная дата и время', `invalid_${field}`)
  return parsed.toISOString()
}

function optionalTimestamp(value, field) {
  if (value === undefined || value === null) return null
  return timestamp(value, field)
}

function score(value) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > 100) {
    throw new HttpError(400, 'Оценка должна быть от 0 до 100', 'invalid_grade_score')
  }
  return value
}

async function requireOfflineStaff(config, req) {
  const actor = await requireAuth(config, req)
  if (!STAFF_ROLES.has(actor.role)) throw new HttpError(403, 'Доступ запрещён', 'offline_staff_required')
  return actor
}

async function offlineGroup(client, actor, groupId) {
  const result = await client.query(
    `SELECT g.id, g.course_id, g.teacher_id, g.name, c.name AS course_name
       FROM groups g
       JOIN courses c ON c.id = g.course_id AND c.delivery_mode = 'offline' AND c.is_active = true
      WHERE g.id = $1 AND g.delivery_mode = 'offline' AND g.is_active = true
      FOR UPDATE`,
    [groupId],
  )
  const group = result.rows[0]
  if (!group) throw new HttpError(404, 'Группа не найдена', 'offline_group_not_found')
  if (actor.role === 'teacher' && group.teacher_id !== actor.id) throw new HttpError(404, 'Группа не найдена', 'offline_group_not_found')
  return group
}

async function studentInGroup(client, groupId, studentId) {
  const result = await client.query(
    `SELECT p.user_id, p.full_name
       FROM group_students gs
       JOIN profiles p ON p.user_id = gs.student_id
      WHERE gs.group_id = $1 AND gs.student_id = $2 AND gs.left_at IS NULL
        AND p.role = 'student' AND p.student_type = 'offline'
      FOR UPDATE`,
    [groupId, studentId],
  )
  if (!result.rows[0]) throw new HttpError(409, 'Ученик не состоит в этой активной группе', 'offline_student_not_in_group')
  return result.rows[0]
}

async function sessionInGroup(client, groupId, sessionId) {
  const result = await client.query(
    `SELECT s.id, s.group_id, s.lesson_id, s.starts_at, s.status, l.title AS lesson_title
       FROM offline_class_sessions s
       JOIN lessons l ON l.id = s.lesson_id
      WHERE s.id = $1 AND s.group_id = $2
      FOR UPDATE`,
    [sessionId, groupId],
  )
  if (!result.rows[0]) throw new HttpError(404, 'Занятие не найдено', 'offline_session_not_found')
  return result.rows[0]
}

async function homeworkInGroup(client, groupId, homeworkId) {
  const result = await client.query(
    `SELECT id, group_id, title FROM offline_homework WHERE id = $1 AND group_id = $2 FOR UPDATE`,
    [homeworkId, groupId],
  )
  if (!result.rows[0]) throw new HttpError(404, 'Домашнее задание не найдено', 'offline_homework_not_found')
  return result.rows[0]
}

async function audit(client, actor, action, targetType, targetId, metadata = {}) {
  await client.query(
    `INSERT INTO audit_log (actor_user_id, action, target_type, target_id, metadata)
     VALUES ($1, $2, $3, $4, $5::jsonb)`,
    [actor.id, action, targetType, String(targetId), JSON.stringify(metadata)],
  )
}

function publicSession(row) {
  return {
    id: Number(row.id),
    lessonId: Number(row.lesson_id),
    lessonTitle: requiredText(row.lesson_title, 300, 'invalid_offline_session'),
    startsAt: new Date(row.starts_at).toISOString(),
    endsAt: row.ends_at ? new Date(row.ends_at).toISOString() : null,
    room: row.room ?? null,
    status: row.status,
  }
}

export function parseSession(value) {
  const body = only(value, ['lessonId', 'startsAt', 'endsAt', 'room'], 'invalid_offline_session', ['lessonId', 'startsAt'])
  const lessonId = nullableId(body.lessonId, 'lesson_id')
  const startsAt = timestamp(body.startsAt, 'starts_at')
  const endsAt = optionalTimestamp(body.endsAt, 'ends_at')
  if (endsAt && new Date(endsAt) <= new Date(startsAt)) throw new HttpError(400, 'Окончание должно быть позже начала', 'invalid_session_duration')
  return { lessonId, startsAt, endsAt, room: optionalText(body.room, 160, 'invalid_room') }
}

export function parseAttendance(value) {
  const body = only(value, ['entries'], 'invalid_attendance_batch', ['entries'])
  if (!Array.isArray(body.entries) || body.entries.length < 1 || body.entries.length > 500) throw new HttpError(400, 'Некорректный список посещаемости', 'invalid_attendance_batch')
  const ids = new Set()
  return body.entries.map(entry => {
    const row = only(entry, ['studentId', 'status', 'note'], 'invalid_attendance_entry', ['studentId', 'status'])
    const studentId = uuid(row.studentId, 'student_id')
    if (ids.has(studentId)) throw new HttpError(400, 'Ученик указан дважды', 'duplicate_attendance_student')
    ids.add(studentId)
    if (typeof row.status !== 'string' || !ATTENDANCE.has(row.status)) throw new HttpError(400, 'Некорректный статус посещаемости', 'invalid_attendance_status')
    return { studentId, status: row.status, note: optionalText(row.note, 2_000, 'invalid_attendance_note') }
  })
}

export function parseHomework(value) {
  const body = only(value, ['lessonId', 'title', 'body', 'dueAt'], 'invalid_homework', ['title'])
  return {
    lessonId: nullableId(body.lessonId, 'lesson_id'),
    title: requiredText(body.title, 300, 'invalid_homework_title'),
    body: optionalText(body.body, 50_000, 'invalid_homework_body'),
    dueAt: optionalTimestamp(body.dueAt, 'due_at'),
  }
}

export function parseGrade(value) {
  const body = only(value, ['studentId', 'gradeType', 'sessionId', 'homeworkId', 'title', 'score', 'publish'], 'invalid_grade', ['studentId', 'gradeType', 'title', 'score'])
  const gradeType = body.gradeType
  if (typeof gradeType !== 'string' || !GRADE_TYPES.has(gradeType)) throw new HttpError(400, 'Некорректный тип оценки', 'invalid_grade_type')
  const sessionId = nullableId(body.sessionId, 'session_id')
  const homeworkId = nullableId(body.homeworkId, 'homework_id')
  if ((gradeType === 'lesson' && (!sessionId || homeworkId)) || (gradeType === 'homework' && (!homeworkId || sessionId)) || (gradeType === 'manual' && (sessionId || homeworkId))) {
    throw new HttpError(400, 'Некорректная связь оценки', 'invalid_grade_source')
  }
  if (body.publish !== undefined && typeof body.publish !== 'boolean') throw new HttpError(400, 'Некорректный статус публикации', 'invalid_grade_publish')
  return { studentId: uuid(body.studentId, 'student_id'), gradeType, sessionId, homeworkId, title: requiredText(body.title, 300, 'invalid_grade_title'), score: score(body.score), publish: body.publish ?? true }
}

export function parseComment(value) {
  const body = only(value, ['studentId', 'visibility', 'body', 'sessionId', 'homeworkId', 'gradeId'], 'invalid_offline_comment', ['studentId', 'visibility', 'body'])
  if (typeof body.visibility !== 'string' || !VISIBILITY.has(body.visibility)) throw new HttpError(400, 'Некорректная видимость комментария', 'invalid_comment_visibility')
  return {
    studentId: uuid(body.studentId, 'student_id'),
    visibility: body.visibility,
    body: requiredText(body.body, 10_000, 'invalid_comment_body'),
    sessionId: nullableId(body.sessionId, 'session_id'),
    homeworkId: nullableId(body.homeworkId, 'homework_id'),
    gradeId: nullableId(body.gradeId, 'grade_id'),
  }
}

POST('/v1/platform/offline/groups/:groupId/sessions', async ({ req, params, config }) => {
  const actor = await requireOfflineStaff(config, req)
  const groupId = positiveId(params.groupId, 'group_id')
  const input = parseSession(await readJson(req, 16_000))
  const created = await transaction(async client => {
    const group = await offlineGroup(client, actor, groupId)
    const lesson = await client.query('SELECT id FROM lessons WHERE id = $1 AND course_id = $2 FOR UPDATE', [input.lessonId, group.course_id])
    if (!lesson.rows[0]) throw new HttpError(409, 'Урок не относится к курсу этой группы', 'offline_session_lesson_conflict')
    const result = await client.query(
      `INSERT INTO offline_class_sessions (group_id, lesson_id, starts_at, ends_at, room, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $6)
       RETURNING id, lesson_id, starts_at, ends_at, room, status`,
      [groupId, input.lessonId, input.startsAt, input.endsAt, input.room, actor.id],
    )
    const row = result.rows[0]
    await audit(client, actor, 'create_offline_class_session', 'offline_class_session', row.id, { groupId, lessonId: input.lessonId })
    return { ...row, lesson_title: (await client.query('SELECT title FROM lessons WHERE id = $1', [input.lessonId])).rows[0].title }
  })
  return { status: 201, body: { session: publicSession(created) } }
})

POST('/v1/platform/offline/groups/:groupId/sessions/:sessionId/attendance', async ({ req, params, config }) => {
  const actor = await requireOfflineStaff(config, req)
  const groupId = positiveId(params.groupId, 'group_id')
  const sessionId = positiveId(params.sessionId, 'session_id')
  const entries = parseAttendance(await readJson(req, 64_000))
  await transaction(async client => {
    await offlineGroup(client, actor, groupId)
    await sessionInGroup(client, groupId, sessionId)
    for (const entry of entries) {
      await studentInGroup(client, groupId, entry.studentId)
      await client.query(
        `INSERT INTO offline_attendance_records (session_id, student_id, attendance_status, note, recorded_by)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (session_id, student_id) DO UPDATE
           SET attendance_status = EXCLUDED.attendance_status, note = EXCLUDED.note,
               recorded_by = EXCLUDED.recorded_by, recorded_at = now(), updated_at = now()`,
        [sessionId, entry.studentId, entry.status, entry.note, actor.id],
      )
    }
    await audit(client, actor, 'record_offline_attendance', 'offline_class_session', sessionId, { groupId, count: entries.length })
  })
  return { status: 200, body: { recorded: entries.length } }
})

POST('/v1/platform/offline/groups/:groupId/homework', async ({ req, params, config }) => {
  const actor = await requireOfflineStaff(config, req)
  const groupId = positiveId(params.groupId, 'group_id')
  const input = parseHomework(await readJson(req, 64_000))
  const homework = await transaction(async client => {
    const group = await offlineGroup(client, actor, groupId)
    if (input.lessonId) {
      const lesson = await client.query('SELECT id FROM lessons WHERE id = $1 AND course_id = $2 FOR UPDATE', [input.lessonId, group.course_id])
      if (!lesson.rows[0]) throw new HttpError(409, 'Урок не относится к курсу этой группы', 'offline_homework_lesson_conflict')
    }
    const defaultDue = input.dueAt ?? (await client.query(
      `SELECT starts_at FROM offline_class_sessions WHERE group_id = $1 AND status = 'scheduled' AND starts_at > now() ORDER BY starts_at LIMIT 1`,
      [groupId],
    )).rows[0]?.starts_at ?? null
    const result = await client.query(
      `INSERT INTO offline_homework (group_id, lesson_id, title, body, due_at, is_published, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, true, $6, $6)
       RETURNING id, lesson_id, title, body, due_at, is_published, created_at`,
      [groupId, input.lessonId, input.title, input.body, defaultDue, actor.id],
    )
    await audit(client, actor, 'create_offline_homework', 'offline_homework', result.rows[0].id, { groupId, lessonId: input.lessonId })
    return result.rows[0]
  })
  return { status: 201, body: { homework: { id: Number(homework.id), lessonId: homework.lesson_id == null ? null : Number(homework.lesson_id), title: homework.title, body: homework.body, dueAt: homework.due_at ? new Date(homework.due_at).toISOString() : null, published: homework.is_published } } }
})

POST('/v1/platform/offline/groups/:groupId/grades', async ({ req, params, config }) => {
  const actor = await requireOfflineStaff(config, req)
  const groupId = positiveId(params.groupId, 'group_id')
  const input = parseGrade(await readJson(req, 16_000))
  const grade = await transaction(async client => {
    await offlineGroup(client, actor, groupId)
    await studentInGroup(client, groupId, input.studentId)
    if (input.sessionId) await sessionInGroup(client, groupId, input.sessionId)
    if (input.homeworkId) await homeworkInGroup(client, groupId, input.homeworkId)
    let result
    if (input.sessionId) {
      result = await client.query(
        `INSERT INTO offline_grades (group_id, student_id, class_session_id, grade_type, title, score, is_published, recorded_by, updated_by)
         VALUES ($1, $2, $3, 'lesson', $4, $5, $6, $7, $7)
         ON CONFLICT (student_id, class_session_id) WHERE class_session_id IS NOT NULL DO UPDATE
           SET title = EXCLUDED.title, score = EXCLUDED.score, is_published = EXCLUDED.is_published, updated_by = EXCLUDED.updated_by, updated_at = now()
         RETURNING id, score, is_published`,
        [groupId, input.studentId, input.sessionId, input.title, input.score, input.publish, actor.id],
      )
    } else if (input.homeworkId) {
      result = await client.query(
        `INSERT INTO offline_grades (group_id, student_id, homework_id, grade_type, title, score, is_published, recorded_by, updated_by)
         VALUES ($1, $2, $3, 'homework', $4, $5, $6, $7, $7)
         ON CONFLICT (student_id, homework_id) WHERE homework_id IS NOT NULL DO UPDATE
           SET title = EXCLUDED.title, score = EXCLUDED.score, is_published = EXCLUDED.is_published, updated_by = EXCLUDED.updated_by, updated_at = now()
         RETURNING id, score, is_published`,
        [groupId, input.studentId, input.homeworkId, input.title, input.score, input.publish, actor.id],
      )
    } else {
      result = await client.query(
        `INSERT INTO offline_grades (group_id, student_id, grade_type, title, score, is_published, recorded_by, updated_by)
         VALUES ($1, $2, 'manual', $3, $4, $5, $6, $6)
         RETURNING id, score, is_published`,
        [groupId, input.studentId, input.title, input.score, input.publish, actor.id],
      )
    }
    await audit(client, actor, 'record_offline_grade', 'offline_grade', result.rows[0].id, { groupId, studentId: input.studentId, gradeType: input.gradeType })
    return result.rows[0]
  })
  return { status: 200, body: { grade: { id: Number(grade.id), score: Number(grade.score), published: grade.is_published } } }
})

POST('/v1/platform/offline/groups/:groupId/comments', async ({ req, params, config }) => {
  const actor = await requireOfflineStaff(config, req)
  const groupId = positiveId(params.groupId, 'group_id')
  const input = parseComment(await readJson(req, 16_000))
  const comment = await transaction(async client => {
    await offlineGroup(client, actor, groupId)
    await studentInGroup(client, groupId, input.studentId)
    if (input.sessionId) await sessionInGroup(client, groupId, input.sessionId)
    if (input.homeworkId) await homeworkInGroup(client, groupId, input.homeworkId)
    const result = await client.query(
      `INSERT INTO offline_comments (group_id, student_id, class_session_id, homework_id, grade_id, visibility, body, author_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, created_at`,
      [groupId, input.studentId, input.sessionId, input.homeworkId, input.gradeId, input.visibility, input.body, actor.id],
    )
    await audit(client, actor, 'create_offline_comment', 'offline_comment', result.rows[0].id, { groupId, studentId: input.studentId, visibility: input.visibility })
    return result.rows[0]
  })
  return { status: 201, body: { comment: { id: Number(comment.id), createdAt: new Date(comment.created_at).toISOString() } } }
})

POST('/v1/platform/offline/homework/:homeworkId/submission', async ({ req, params, config }) => {
  const student = await requireAuth(config, req)
  if (student.role !== 'student' || student.student_type !== 'offline') throw new HttpError(403, 'Доступен только ученику офлайн-курса', 'offline_student_required')
  const homeworkId = positiveId(params.homeworkId, 'homework_id')
  const body = only(await readJson(req, 64_000), ['body'], 'invalid_homework_submission', ['body'])
  const submissionBody = requiredText(body.body, 50_000, 'invalid_homework_submission_body')
  const submission = await transaction(async client => {
    const homework = await client.query(
      `SELECT h.id, h.group_id FROM offline_homework h
       JOIN group_students gs ON gs.group_id = h.group_id AND gs.student_id = $2 AND gs.left_at IS NULL
      WHERE h.id = $1 AND h.is_published = true FOR UPDATE`,
      [homeworkId, student.id],
    )
    if (!homework.rows[0]) throw new HttpError(404, 'Домашнее задание недоступно', 'offline_homework_not_found')
    const result = await client.query(
      `INSERT INTO offline_homework_submissions (homework_id, student_id, body, status, submitted_at)
       VALUES ($1, $2, $3, 'submitted', now())
       ON CONFLICT (homework_id, student_id) DO UPDATE
         SET body = EXCLUDED.body, status = 'submitted', submitted_at = now(), reviewed_at = NULL, reviewed_by = NULL,
             student_feedback = NULL, updated_at = now()
       RETURNING id, submitted_at`,
      [homeworkId, student.id, submissionBody],
    )
    await audit(client, student, 'submit_offline_homework', 'offline_homework_submission', result.rows[0].id, { homeworkId })
    return result.rows[0]
  })
  return { status: 200, body: { submission: { id: Number(submission.id), submittedAt: new Date(submission.submitted_at).toISOString(), status: 'submitted' } } }
})

GET('/v1/platform/offline/teacher/groups/:groupId', async ({ req, params, config }) => {
  const actor = await requireOfflineStaff(config, req)
  const groupId = positiveId(params.groupId, 'group_id')
  const workspace = await transaction(async client => {
    const group = await offlineGroup(client, actor, groupId)
    const [students, lessons, sessions, homework] = await Promise.all([
      client.query(
        `SELECT p.user_id AS id, p.full_name FROM group_students gs JOIN profiles p ON p.user_id = gs.student_id
          WHERE gs.group_id = $1 AND gs.left_at IS NULL AND p.role = 'student' AND p.student_type = 'offline' ORDER BY p.full_name, p.user_id`,
        [groupId],
      ),
      client.query(
        `SELECT id, lesson_number, title
           FROM lessons
          WHERE course_id = $1 AND is_published = true
          ORDER BY lesson_number, id`,
        [group.course_id],
      ),
      client.query(
        `SELECT s.id, s.lesson_id, l.title AS lesson_title, s.starts_at, s.ends_at, s.room, s.status
           FROM offline_class_sessions s JOIN lessons l ON l.id = s.lesson_id WHERE s.group_id = $1 ORDER BY s.starts_at, s.id`,
        [groupId],
      ),
      client.query(
        `SELECT id, title, due_at, is_published FROM offline_homework WHERE group_id = $1 ORDER BY created_at DESC, id DESC LIMIT 50`,
        [groupId],
      ),
    ])
    return { group, students: students.rows, lessons: lessons.rows, sessions: sessions.rows, homework: homework.rows }
  })
  return {
    status: 200,
    headers: { 'Cache-Control': 'private, no-store' },
    body: {
      group: { id: Number(workspace.group.id), name: workspace.group.name, courseName: workspace.group.course_name },
      students: workspace.students.map(row => ({ id: row.id, fullName: row.full_name })),
      lessons: workspace.lessons.map(row => ({ id: Number(row.id), lessonNumber: Number(row.lesson_number), title: row.title })),
      sessions: workspace.sessions.map(publicSession),
      homework: workspace.homework.map(row => ({ id: Number(row.id), title: row.title, dueAt: row.due_at ? new Date(row.due_at).toISOString() : null, published: row.is_published })),
    },
  }
})
