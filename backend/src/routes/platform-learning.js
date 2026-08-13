import { requireAuth } from '../auth.js'
import { query, transaction } from '../db.js'
import { GET, HttpError, POST, readJson } from '../http.js'

const STUDENT_ROLES = ['student', 'math_student']
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const ANSWERS = new Set(['a', 'b', 'c', 'd'])
const MAX_ANSWERS = 200
const MAX_ELAPSED_SECONDS = 86_400

class AttemptDeadlineElapsed extends Error {}

function requireStudent(user) {
  if (!STUDENT_ROLES.includes(user.role)) throw new HttpError(403, 'Доступен только ученику', 'student_required')
  return user
}

async function currentStudent(config, req) {
  return requireStudent(await requireAuth(config, req))
}

function exactKeys(body, keys) {
  const actual = Object.keys(body).sort()
  const expected = [...keys].sort()
  return actual.length === expected.length && actual.every((key, index) => key === expected[index])
}

function isUuid(value) {
  return typeof value === 'string' && UUID_PATTERN.test(value)
}

function positiveInteger(value) {
  return Number.isSafeInteger(value) && value > 0
}

function positiveId(value, field) {
  const parsed = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : Number.NaN
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new HttpError(400, `Некорректный ${field}`, `invalid_${field}`)
  return parsed
}

function pagination(searchParams) {
  const limitValue = searchParams.get('limit')
  const offsetValue = searchParams.get('offset')
  const limit = limitValue == null || limitValue === '' ? 30 : Number(limitValue)
  const offset = offsetValue == null || offsetValue === '' ? 0 : Number(offsetValue)
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100 || !Number.isSafeInteger(offset) || offset < 0 || offset > 100_000) {
    throw new HttpError(400, 'Некорректная пагинация', 'invalid_pagination')
  }
  return { limit, offset }
}

function nullableNumber(value) {
  if (value == null) return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function dateValue(value) {
  if (value == null) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function publicProfile(user) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.full_name,
    role: user.role,
    studentType: user.student_type,
    phone: user.phone,
    targetScore: user.target_score,
    avatarUrl: user.avatar_url,
  }
}

function publicCourse(row) {
  return {
    id: nullableNumber(row.id),
    name: row.name,
    code: row.code,
    level: row.level,
    subject: row.subject,
    description: row.description,
    coverImageUrl: row.cover_image_url,
    lessonCount: Number(row.lesson_count ?? 0),
    completedLessonCount: Number(row.completed_lesson_count ?? 0),
  }
}

function publicLesson(row) {
  return {
    id: nullableNumber(row.id),
    courseId: nullableNumber(row.course_id),
    lessonNumber: Number(row.lesson_number),
    title: row.title,
    description: row.description,
    subject: row.subject,
    section: row.section,
    topic: row.topic,
    lessonDate: row.lesson_date ?? null,
    durationMinutes: nullableNumber(row.duration_minutes),
    contentUrl: row.content_url,
    isTest: row.is_test,
    completionPercent: Number(row.completion_percent ?? 0),
    completedAt: dateValue(row.completed_at),
    lastViewedAt: dateValue(row.last_viewed_at),
  }
}

function publicPracticeTest(row) {
  return {
    id: nullableNumber(row.id),
    courseId: nullableNumber(row.course_id),
    lessonId: nullableNumber(row.lesson_id),
    title: row.title,
    subject: row.subject,
    testType: row.test_type,
    description: row.description,
    timeLimitSeconds: nullableNumber(row.time_limit_seconds),
    maxAttempts: nullableNumber(row.max_attempts),
    passScoreRatio: nullableNumber(row.pass_score_ratio),
    availableFrom: dateValue(row.available_from),
    availableUntil: dateValue(row.available_until),
    questionCount: Number(row.question_count ?? 0),
  }
}

/**
 * This is intentionally the only question projection used while an attempt
 * is open. Keep `correct_answer`, selected answers, and explanations out of
 * this object: a student may retrieve it before submitting.
 */
export function publicAttemptQuestion(row) {
  return {
    questionId: nullableNumber(row.practice_question_id),
    position: Number(row.position),
    questionText: row.question_text,
    options: row.options,
    section: row.section,
    topic: row.topic,
    difficulty: row.difficulty,
    imageUrl: row.image_url,
  }
}

function publicAttempt(row) {
  return {
    id: row.id,
    status: row.status,
    practiceTestId: nullableNumber(row.practice_test_id),
    courseId: nullableNumber(row.course_id),
    lessonId: nullableNumber(row.lesson_id),
    attemptNumber: Number(row.attempt_number),
    testTitle: row.test_title,
    testType: row.test_type,
    timeLimitSeconds: nullableNumber(row.time_limit_seconds),
    passScoreRatio: nullableNumber(row.pass_score_ratio),
    questionCount: Number(row.question_count),
    correctCount: row.status === 'submitted' ? nullableNumber(row.correct_count) : null,
    scorePercent: row.status === 'submitted' ? nullableNumber(row.score_percent) : null,
    passed: row.status === 'submitted' ? row.passed : null,
    elapsedSeconds: row.status === 'submitted' ? nullableNumber(row.elapsed_seconds) : null,
    startedAt: dateValue(row.started_at),
    expiresAt: dateValue(row.expires_at),
    submittedAt: dateValue(row.submitted_at),
  }
}

function submittedReview(row) {
  return {
    questionId: nullableNumber(row.practice_question_id),
    position: Number(row.position),
    questionText: row.question_text,
    options: row.options,
    selectedAnswer: row.selected_answer,
    correctAnswer: row.correct_answer,
    isCorrect: row.is_correct,
    explanation: row.explanation,
    section: row.section,
    topic: row.topic,
    difficulty: row.difficulty,
    imageUrl: row.image_url,
  }
}

export function parseBeginAttemptBody(body) {
  if (!exactKeys(body, ['testId', 'idempotencyKey']) || !positiveInteger(body.testId) || !isUuid(body.idempotencyKey)) {
    throw new HttpError(400, 'Некорректные данные попытки', 'invalid_attempt_request')
  }
  return { testId: body.testId, idempotencyKey: body.idempotencyKey }
}

export function parseSubmitAttemptBody(body) {
  if (!exactKeys(body, ['idempotencyKey', 'elapsedSeconds', 'answers'])
    || !isUuid(body.idempotencyKey)
    || !Number.isSafeInteger(body.elapsedSeconds)
    || body.elapsedSeconds < 0
    || body.elapsedSeconds > MAX_ELAPSED_SECONDS
    || !Array.isArray(body.answers)
    || body.answers.length > MAX_ANSWERS) {
    throw new HttpError(400, 'Некорректные ответы', 'invalid_submission')
  }

  const questionIds = new Set()
  const answers = []
  for (const answer of body.answers) {
    if (!answer || typeof answer !== 'object' || Array.isArray(answer)
      || !exactKeys(answer, ['questionId', 'answer'])
      || !positiveInteger(answer.questionId)
      || !ANSWERS.has(answer.answer)
      || questionIds.has(answer.questionId)) {
      throw new HttpError(400, 'Некорректные ответы', 'invalid_submission')
    }
    questionIds.add(answer.questionId)
    answers.push({ questionId: answer.questionId, answer: answer.answer })
  }
  return { idempotencyKey: body.idempotencyKey, elapsedSeconds: body.elapsedSeconds, answers }
}

async function lockStudent(client, studentId) {
  // Serialize a student's begins/submissions. This prevents two simultaneous
  // begins from consuming more than max_attempts and makes idempotency replay
  // deterministic without relying on a race-prone count-then-insert.
  await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [studentId])
}

async function loadAccessibleTest(client, studentId, testId, forUpdate = false) {
  const lock = forUpdate ? ' FOR UPDATE OF t' : ''
  const result = await client.query(
    `SELECT t.id, t.course_id, t.lesson_id, t.title, t.subject, t.test_type,
            t.description, t.time_limit_seconds, t.max_attempts, t.pass_score_ratio,
            t.available_from, t.available_until,
            (SELECT count(*)::int
               FROM practice_questions q
              WHERE q.practice_test_id = t.id AND q.is_active = true) AS question_count
       FROM practice_tests t
      WHERE t.id = $2
        AND t.is_published = true
        AND (t.available_from IS NULL OR t.available_from <= now())
        AND (t.available_until IS NULL OR t.available_until > now())
        AND (
          t.course_id IS NULL OR EXISTS (
            SELECT 1
              FROM group_students gs
              JOIN groups g ON g.id = gs.group_id
             WHERE gs.student_id = $1
               AND gs.left_at IS NULL
               AND g.course_id = t.course_id
               AND g.is_active = true
          )
        )${lock}`,
    [studentId, testId],
  )
  return result.rows[0] ?? null
}

async function loadAttemptItems(client, attemptId, { review = false, lock = false } = {}) {
  const result = await client.query(
    `SELECT practice_question_id, position, question_text, options,
            ${review ? 'correct_answer, explanation, selected_answer, is_correct,' : ''}
            section, topic, difficulty, image_url
       FROM practice_attempt_items
      WHERE attempt_id = $1
      ORDER BY position${lock ? ' FOR UPDATE' : ''}`,
    [attemptId],
  )
  return result.rows
}

async function beginAttempt(client, student, input) {
  await lockStudent(client, student.id)

  const replay = await client.query(
    `SELECT *
       FROM practice_attempts
      WHERE student_id = $1 AND begin_idempotency_key = $2
      FOR UPDATE`,
    [student.id, input.idempotencyKey],
  )
  if (replay.rows[0]) {
    const attempt = replay.rows[0]
    if (Number(attempt.practice_test_id) !== input.testId) {
      throw new HttpError(409, 'Ключ попытки уже использован', 'begin_idempotency_conflict')
    }
    const items = attempt.status === 'started' ? await loadAttemptItems(client, attempt.id) : []
    return { attempt, questions: items.map(publicAttemptQuestion), replayed: true }
  }

  const test = await loadAccessibleTest(client, student.id, input.testId, true)
  if (!test) throw new HttpError(404, 'Тест недоступен', 'test_unavailable')
  if (Number(test.question_count) < 1) throw new HttpError(409, 'В тесте пока нет вопросов', 'test_empty')

  // A timed attempt becomes terminal before availability is calculated. The
  // update is committed together with a potential next begin.
  await client.query(
    `UPDATE practice_attempts
        SET status = 'expired'
      WHERE student_id = $1
        AND practice_test_id = $2
        AND status = 'started'
        AND expires_at IS NOT NULL
        AND expires_at <= now()`,
    [student.id, test.id],
  )

  const open = await client.query(
    `SELECT *
       FROM practice_attempts
      WHERE student_id = $1 AND practice_test_id = $2 AND status = 'started'
      FOR UPDATE`,
    [student.id, test.id],
  )
  if (open.rows[0]) {
    const attempt = open.rows[0]
    const items = await loadAttemptItems(client, attempt.id)
    return { attempt, questions: items.map(publicAttemptQuestion), resumed: true }
  }

  const previous = await client.query(
    `SELECT count(*)::int AS count
       FROM practice_attempts
      WHERE student_id = $1 AND practice_test_id = $2`,
    [student.id, test.id],
  )
  const priorCount = Number(previous.rows[0].count)
  if (test.max_attempts !== null && priorCount >= Number(test.max_attempts)) {
    throw new HttpError(409, 'Лимит попыток исчерпан', 'attempts_exhausted')
  }

  const inserted = await client.query(
    `INSERT INTO practice_attempts (
       student_id, practice_test_id, course_id, lesson_id, attempt_number,
       begin_idempotency_key, test_title, test_type, time_limit_seconds,
       pass_score_ratio, question_count, expires_at
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
       CASE WHEN $9::integer IS NULL THEN NULL ELSE now() + ($9::integer * interval '1 second') END
     )
     RETURNING *`,
    [
      student.id,
      test.id,
      test.course_id,
      test.lesson_id,
      priorCount + 1,
      input.idempotencyKey,
      test.title,
      test.test_type,
      test.time_limit_seconds,
      test.pass_score_ratio,
      test.question_count,
    ],
  )
  const attempt = inserted.rows[0]

  await client.query(
    `INSERT INTO practice_attempt_items (
       attempt_id, practice_question_id, position, question_text, options,
       correct_answer, explanation, section, topic, difficulty, image_url
     )
     SELECT $1, q.id, q.position, q.question_text, q.options,
            q.correct_answer, q.explanation, q.section, q.topic, q.difficulty, q.image_url
       FROM practice_questions q
      WHERE q.practice_test_id = $2 AND q.is_active = true
      ORDER BY q.position`,
    [attempt.id, test.id],
  )

  const items = await loadAttemptItems(client, attempt.id)
  if (items.length !== Number(attempt.question_count)) {
    // This should be impossible under the locked test row, but fail closed if
    // malformed data bypassed the application-level invariant.
    throw new HttpError(409, 'Состав теста изменился, начните снова', 'attempt_snapshot_failed')
  }
  await client.query(
    `INSERT INTO audit_log (actor_user_id, action, target_type, target_id, metadata)
     VALUES ($1, 'begin_practice_attempt', 'practice_attempt', $2, $3::jsonb)`,
    [student.id, attempt.id, JSON.stringify({ practiceTestId: Number(test.id), attemptNumber: priorCount + 1 })],
  )
  return { attempt, questions: items.map(publicAttemptQuestion), replayed: false, resumed: false }
}

async function expireAttempt(client, attempt) {
  await client.query(
    `UPDATE practice_attempts
        SET status = 'expired'
      WHERE id = $1 AND status = 'started'`,
    [attempt.id],
  )
}

async function submittedResponse(client, attempt) {
  const items = await loadAttemptItems(client, attempt.id, { review: true })
  return { attempt: publicAttempt(attempt), review: items.map(submittedReview) }
}

async function submitAttempt(client, student, attemptId, input) {
  await lockStudent(client, student.id)

  const existingSubmitKey = await client.query(
    `SELECT id
       FROM practice_attempts
      WHERE student_id = $1 AND submit_idempotency_key = $2
      FOR UPDATE`,
    [student.id, input.idempotencyKey],
  )
  if (existingSubmitKey.rows[0] && existingSubmitKey.rows[0].id !== attemptId) {
    throw new HttpError(409, 'Ключ отправки уже использован', 'submit_idempotency_conflict')
  }

  const loaded = await client.query(
    `SELECT *
       FROM practice_attempts
      WHERE id = $1 AND student_id = $2
      FOR UPDATE`,
    [attemptId, student.id],
  )
  const attempt = loaded.rows[0]
  if (!attempt) throw new HttpError(404, 'Попытка не найдена', 'attempt_not_found')

  if (attempt.status === 'submitted') {
    if (attempt.submit_idempotency_key !== input.idempotencyKey) {
      throw new HttpError(409, 'Попытка уже отправлена', 'attempt_already_submitted')
    }
    return { ...await submittedResponse(client, attempt), replayed: true }
  }
  if (attempt.status !== 'started') throw new HttpError(409, 'Попытка уже закрыта', 'attempt_not_open')

  if (attempt.expires_at && new Date(attempt.expires_at).getTime() <= Date.now()) {
    await expireAttempt(client, attempt)
    return { expired: true }
  }

  const items = await loadAttemptItems(client, attempt.id, { lock: true })
  const assigned = new Set(items.map(item => Number(item.practice_question_id)))
  for (const answer of input.answers) {
    if (!assigned.has(answer.questionId)) {
      throw new HttpError(400, 'В ответах есть вопрос не из этой попытки', 'unassigned_question')
    }
  }

  // Score all snapshots inside the same transaction. Omitted answers remain
  // NULL and are explicitly marked incorrect. The browser never supplies a
  // score, pass flag, answer key, or student identity.
  if (input.answers.length > 0) {
    await client.query(
      `UPDATE practice_attempt_items item
          SET selected_answer = submitted.answer,
              is_correct = (submitted.answer = item.correct_answer)
         FROM jsonb_to_recordset($2::jsonb) AS submitted(practice_question_id bigint, answer text)
        WHERE item.attempt_id = $1
          AND item.practice_question_id = submitted.practice_question_id`,
      [attempt.id, JSON.stringify(input.answers.map(answer => ({ practice_question_id: answer.questionId, answer: answer.answer })))],
    )
  }
  // The trigger intentionally makes scored rows immutable. Mark unanswered
  // rows only after the answered rows have been scored, so every snapshot is
  // transitioned exactly once from NULL to its authoritative final state.
  await client.query(
    `UPDATE practice_attempt_items
        SET selected_answer = NULL, is_correct = false
      WHERE attempt_id = $1 AND selected_answer IS NULL`,
    [attempt.id],
  )

  const score = await client.query(
    `SELECT count(*) FILTER (WHERE is_correct)::int AS correct_count,
            count(*)::int AS total
       FROM practice_attempt_items
      WHERE attempt_id = $1`,
    [attempt.id],
  )
  const correctCount = Number(score.rows[0].correct_count)
  const total = Number(score.rows[0].total)
  if (total !== Number(attempt.question_count) || total < 1) {
    throw new HttpError(409, 'Состав попытки повреждён', 'attempt_snapshot_invalid')
  }

  // The persisted duration comes from the server clock. `elapsedSeconds` is
  // still syntax-validated for a stable client contract, but cannot forge a
  // result or extend a timed test.
  const finalized = await client.query(
    `UPDATE practice_attempts
        SET status = 'submitted',
            submit_idempotency_key = $2,
            correct_count = $3,
            score_percent = round(($3::numeric / question_count) * 100, 2),
            passed = round(($3::numeric / question_count) * 100, 2) >= pass_score_ratio * 100,
            elapsed_seconds = LEAST(
              86400,
              GREATEST(0, floor(extract(epoch FROM now() - started_at))::int)
            ),
            submitted_at = now()
      WHERE id = $1
        AND (expires_at IS NULL OR expires_at > clock_timestamp())
      RETURNING *`,
    [attempt.id, input.idempotencyKey, correctCount],
  )
  const submitted = finalized.rows[0]
  if (!submitted) {
    // Force a rollback so partially scored items never remain on an expired
    // attempt. The route marks it expired in a clean follow-up transaction.
    throw new AttemptDeadlineElapsed()
  }
  // Lesson completion is derived from a successfully finalized, lesson-bound
  // server-scored attempt. The browser cannot mark a lesson complete merely
  // by opening it or posting a fabricated progress percentage.
  if (submitted.lesson_id !== null) {
    await client.query(
      `INSERT INTO lesson_progress (student_id, lesson_id, completion_percent, last_viewed_at, completed_at)
       VALUES ($1, $2, 100, now(), now())
       ON CONFLICT (student_id, lesson_id) DO UPDATE
          SET completion_percent = 100,
              last_viewed_at = now(),
              completed_at = COALESCE(lesson_progress.completed_at, now())`,
      [student.id, submitted.lesson_id],
    )
  }
  await client.query(
    `INSERT INTO audit_log (actor_user_id, action, target_type, target_id, metadata)
     VALUES ($1, 'submit_practice_attempt', 'practice_attempt', $2, $3::jsonb)`,
    [student.id, attempt.id, JSON.stringify({ correctCount, questionCount: total })],
  )
  return { ...await submittedResponse(client, submitted), replayed: false }
}

GET('/v1/platform/dashboard', async ({ req, config }) => {
  const student = await currentStudent(config, req)
  const [courses, lessons, practice, latest] = await Promise.all([
    query(
      `SELECT count(DISTINCT g.course_id)::int AS count
         FROM group_students gs
         JOIN groups g ON g.id = gs.group_id
        WHERE gs.student_id = $1 AND gs.left_at IS NULL AND g.is_active = true`,
      [student.id],
    ),
    query(
      `SELECT count(*)::int AS total,
              count(*) FILTER (WHERE lp.completed_at IS NOT NULL)::int AS completed
         FROM lessons l
         LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.student_id = $1
        WHERE l.is_published = true
          AND EXISTS (
            SELECT 1
              FROM group_students gs
              JOIN groups g ON g.id = gs.group_id
             WHERE gs.student_id = $1 AND gs.left_at IS NULL
               AND g.is_active = true AND g.course_id = l.course_id
          )`,
      [student.id],
    ),
    query(
      `SELECT count(*)::int AS attempts,
              count(*) FILTER (WHERE passed)::int AS passed,
              coalesce(round(avg(score_percent), 2), 0)::numeric AS average_score,
              coalesce(max(score_percent), 0)::numeric AS best_score
         FROM practice_attempts
        WHERE student_id = $1 AND status = 'submitted'`,
      [student.id],
    ),
    query(
      `SELECT id, test_title, test_type, score_percent, correct_count, question_count, submitted_at
         FROM practice_attempts
        WHERE student_id = $1 AND status = 'submitted'
        ORDER BY submitted_at DESC, id DESC
        LIMIT 1`,
      [student.id],
    ),
  ])
  const lessonTotal = Number(lessons.rows[0].total)
  const lessonCompleted = Number(lessons.rows[0].completed)
  const latestResult = latest.rows[0]
    ? {
        id: latest.rows[0].id,
        title: latest.rows[0].test_title,
        testType: latest.rows[0].test_type,
        scorePercent: nullableNumber(latest.rows[0].score_percent),
        correctCount: Number(latest.rows[0].correct_count),
        questionCount: Number(latest.rows[0].question_count),
        submittedAt: dateValue(latest.rows[0].submitted_at),
      }
    : null
  return {
    status: 200,
    body: {
      profile: publicProfile(student),
      summary: {
        courseCount: Number(courses.rows[0].count),
        lessons: {
          total: lessonTotal,
          completed: lessonCompleted,
          completionPercent: lessonTotal === 0 ? 0 : Math.round((lessonCompleted / lessonTotal) * 100),
        },
        practice: {
          attempts: Number(practice.rows[0].attempts),
          passed: Number(practice.rows[0].passed),
          averageScorePercent: nullableNumber(practice.rows[0].average_score) ?? 0,
          bestScorePercent: nullableNumber(practice.rows[0].best_score) ?? 0,
        },
        latestResult,
      },
    },
  }
})

GET('/v1/platform/courses', async ({ req, config }) => {
  const student = await currentStudent(config, req)
  const result = await query(
    `SELECT c.id, c.name, c.code, c.level, c.subject, c.description, c.cover_image_url,
            count(DISTINCT l.id) FILTER (WHERE l.is_published)::int AS lesson_count,
            count(DISTINCT lp.lesson_id) FILTER (WHERE lp.completed_at IS NOT NULL)::int AS completed_lesson_count
       FROM courses c
       JOIN groups g ON g.course_id = c.id AND g.is_active = true
       JOIN group_students gs ON gs.group_id = g.id AND gs.student_id = $1 AND gs.left_at IS NULL
       LEFT JOIN lessons l ON l.course_id = c.id AND l.is_published = true
       LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.student_id = $1
      WHERE c.is_active = true
      GROUP BY c.id
      ORDER BY c.name, c.id`,
    [student.id],
  )
  return { status: 200, body: { items: result.rows.map(publicCourse) } }
})

GET('/v1/platform/lessons', async ({ req, config, query: searchParams }) => {
  const student = await currentStudent(config, req)
  const rawCourseId = searchParams.get('courseId')
  const courseId = rawCourseId == null ? null : positiveId(rawCourseId, 'course_id')
  const result = await query(
    `SELECT l.id, l.course_id, l.lesson_number, l.title, l.description, l.subject,
            l.section, l.topic, l.lesson_date, l.duration_minutes, l.content_url, l.is_test,
            coalesce(lp.completion_percent, 0)::int AS completion_percent,
            lp.completed_at, lp.last_viewed_at
       FROM lessons l
       LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.student_id = $1
      WHERE l.is_published = true
        AND ($2::bigint IS NULL OR l.course_id = $2)
        AND EXISTS (
          SELECT 1
            FROM group_students gs
            JOIN groups g ON g.id = gs.group_id
           WHERE gs.student_id = $1 AND gs.left_at IS NULL
             AND g.is_active = true AND g.course_id = l.course_id
        )
      ORDER BY l.course_id, l.lesson_number, l.id`,
    [student.id, courseId],
  )
  return { status: 200, body: { items: result.rows.map(publicLesson) } }
})

GET('/v1/platform/lessons/:id', async ({ req, params, config }) => {
  const student = await currentStudent(config, req)
  const lessonId = positiveId(params.id, 'lesson_id')
  const result = await query(
    `SELECT l.id, l.course_id, l.lesson_number, l.title, l.description, l.subject,
            l.section, l.topic, l.lesson_date, l.duration_minutes, l.content_url, l.is_test,
            coalesce(lp.completion_percent, 0)::int AS completion_percent,
            lp.completed_at, lp.last_viewed_at
       FROM lessons l
       LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.student_id = $1
      WHERE l.id = $2 AND l.is_published = true
        AND EXISTS (
          SELECT 1
            FROM group_students gs
            JOIN groups g ON g.id = gs.group_id
           WHERE gs.student_id = $1 AND gs.left_at IS NULL
             AND g.is_active = true AND g.course_id = l.course_id
        )`,
    [student.id, lessonId],
  )
  if (!result.rows[0]) throw new HttpError(404, 'Урок не найден', 'lesson_not_found')
  return { status: 200, body: { lesson: publicLesson(result.rows[0]) } }
})

GET('/v1/platform/practice-tests', async ({ req, config }) => {
  const student = await currentStudent(config, req)
  const result = await query(
    `SELECT t.id, t.course_id, t.lesson_id, t.title, t.subject, t.test_type,
            t.description, t.time_limit_seconds, t.max_attempts, t.pass_score_ratio,
            t.available_from, t.available_until, count(q.id)::int AS question_count
       FROM practice_tests t
       JOIN practice_questions q ON q.practice_test_id = t.id AND q.is_active = true
      WHERE t.is_published = true
        AND (t.available_from IS NULL OR t.available_from <= now())
        AND (t.available_until IS NULL OR t.available_until > now())
        AND (
          t.course_id IS NULL OR EXISTS (
            SELECT 1
              FROM group_students gs
              JOIN groups g ON g.id = gs.group_id
             WHERE gs.student_id = $1 AND gs.left_at IS NULL
               AND g.is_active = true AND g.course_id = t.course_id
          )
        )
      GROUP BY t.id
      ORDER BY t.created_at DESC, t.id DESC`,
    [student.id],
  )
  return { status: 200, body: { items: result.rows.map(publicPracticeTest) } }
})

POST('/v1/platform/practice-attempts', async ({ req, config }) => {
  const student = await currentStudent(config, req)
  const input = parseBeginAttemptBody(await readJson(req, 16_000))
  const result = await transaction(client => beginAttempt(client, student, input))
  return {
    status: result.replayed || result.resumed ? 200 : 201,
    body: {
      attempt: publicAttempt(result.attempt),
      questions: result.questions,
      replayed: Boolean(result.replayed),
      resumed: Boolean(result.resumed),
    },
  }
})

GET('/v1/platform/practice-attempts', async ({ req, config, query: searchParams }) => {
  const student = await currentStudent(config, req)
  const { limit, offset } = pagination(searchParams)
  const result = await query(
    `SELECT a.*, count(*) OVER()::int AS total
       FROM practice_attempts a
      WHERE a.student_id = $1
      ORDER BY coalesce(a.submitted_at, a.started_at) DESC, a.id DESC
      LIMIT $2 OFFSET $3`,
    [student.id, limit, offset],
  )
  return {
    status: 200,
    body: {
      items: result.rows.map(publicAttempt),
      total: result.rows[0]?.total ?? 0,
      limit,
      offset,
    },
  }
})

GET('/v1/platform/practice-attempts/:id', async ({ req, params, config }) => {
  const student = await currentStudent(config, req)
  if (!isUuid(params.id)) throw new HttpError(400, 'Некорректный id попытки', 'invalid_attempt_id')
  const detail = await transaction(async client => {
    const loaded = await client.query(
      `SELECT *
         FROM practice_attempts
        WHERE id = $1 AND student_id = $2
        FOR UPDATE`,
      [params.id, student.id],
    )
    const attempt = loaded.rows[0]
    if (!attempt) throw new HttpError(404, 'Попытка не найдена', 'attempt_not_found')
    if (attempt.status === 'started' && attempt.expires_at && new Date(attempt.expires_at).getTime() <= Date.now()) {
      await expireAttempt(client, attempt)
      attempt.status = 'expired'
    }
    if (attempt.status === 'submitted') return submittedResponse(client, attempt)
    const items = attempt.status === 'started' ? await loadAttemptItems(client, attempt.id) : []
    return { attempt: publicAttempt(attempt), questions: items.map(publicAttemptQuestion) }
  })
  return { status: 200, body: detail }
})

POST('/v1/platform/practice-attempts/:id/submit', async ({ req, params, config }) => {
  const student = await currentStudent(config, req)
  if (!isUuid(params.id)) throw new HttpError(400, 'Некорректный id попытки', 'invalid_attempt_id')
  const input = parseSubmitAttemptBody(await readJson(req, 32_000))
  let result
  try {
    result = await transaction(client => submitAttempt(client, student, params.id, input))
  } catch (error) {
    if (!(error instanceof AttemptDeadlineElapsed)) throw error
    // The final conditional update observed an elapsed deadline. Its scoring
    // transaction rolled back; persist only the terminal expiry transition.
    await transaction(async client => {
      await lockStudent(client, student.id)
      await client.query(
        `UPDATE practice_attempts
            SET status = 'expired'
          WHERE id = $1 AND student_id = $2 AND status = 'started'
            AND expires_at IS NOT NULL AND expires_at <= clock_timestamp()`,
        [params.id, student.id],
      )
    })
    throw new HttpError(409, 'Время попытки истекло', 'attempt_expired')
  }
  if (result.expired) throw new HttpError(409, 'Время попытки истекло', 'attempt_expired')
  return { status: 200, body: result }
})
