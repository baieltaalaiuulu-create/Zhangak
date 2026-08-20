import { requireAuth } from '../auth.js'
import { query, transaction } from '../db.js'
import { claimQuestReward, loadGamificationSummary, recordGamificationEvent } from '../gamification.js'
import { GET, HttpError, POST, readJson } from '../http.js'

const STUDENT_ROLES = ['student', 'math_student']
const ANSWERS = new Set(['a', 'b', 'c', 'd'])
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function positiveId(value, field) {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isSafeInteger(parsed) || parsed < 1) throw new HttpError(400, `Некорректный ${field}`, `invalid_${field}`)
  return parsed
}

function object(value, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new HttpError(400, 'Некорректные данные', code)
  return value
}

function exact(body, keys, code) {
  const current = Object.keys(object(body, code)).sort()
  const expected = [...keys].sort()
  if (current.length !== expected.length || current.some((key, index) => key !== expected[index])) throw new HttpError(400, 'Некорректные данные', code)
}

function uuid(value, code) {
  if (typeof value !== 'string' || !UUID.test(value)) throw new HttpError(400, 'Некорректный ключ запроса', code)
  return value
}

async function student(config, req) {
  const user = await requireAuth(config, req)
  if (!STUDENT_ROLES.includes(user.role) || (user.role === 'student' && user.student_type !== 'online')) {
    throw new HttpError(403, 'Доступен только ученику онлайн-курса', 'online_student_required')
  }
  return user
}

function publicQuestion(row, issueId = null) {
  return {
    id: Number(row.id), issueId,
    questionText: row.question_text,
    options: row.options,
    section: row.section,
    topic: row.topic ?? null,
    difficulty: row.difficulty,
    imageUrl: row.image_url ?? null,
  }
}

function dailyAttempt(row, includeQuestions = false) {
  const result = {
    id: row.id, status: row.status, startedAt: row.started_at,
    submittedAt: row.submitted_at ?? null,
    correctCount: row.correct_count == null ? null : Number(row.correct_count),
    scorePercent: row.score_percent == null ? null : Number(row.score_percent),
    starCount: row.star_count == null ? null : Number(row.star_count),
    xpAwarded: row.xp_awarded == null ? null : Number(row.xp_awarded),
  }
  if (includeQuestions) result.questions = row.questions.map(question => publicQuestion(question))
  if (row.review) result.review = row.review.map(question => ({
    questionId: Number(question.id), questionText: question.question_text, options: question.options,
    selectedAnswer: question.selected_answer ?? null, correctAnswer: question.correct_answer,
    isCorrect: question.is_correct, explanation: question.explanation ?? null,
    section: question.section, topic: question.topic ?? null, difficulty: question.difficulty,
    imageUrl: question.image_url ?? null,
  }))
  return result
}

async function todayChallenge(execute, studentId, { forUpdate = false } = {}) {
  const lock = forUpdate ? ' FOR UPDATE OF d' : ''
  const result = await execute(
    `SELECT d.id, d.course_id, d.challenge_date, d.title, d.subject, d.xp_reward, d.is_published
       FROM daily_challenges d
       JOIN courses c ON c.id = d.course_id AND c.is_active = true AND c.delivery_mode = 'online'
      WHERE d.challenge_date = (now() AT TIME ZONE 'Asia/Bishkek')::date
        AND d.is_published = true
        AND EXISTS (
          SELECT 1 FROM active_course_enrollments ce
           WHERE ce.student_id = $1 AND ce.course_id = d.course_id AND ce.status = 'active'
        )${lock}`,
    [studentId],
  )
  return result.rows[0] ?? null
}

async function challengeQuestions(execute, challengeId) {
  const result = await execute(
    `SELECT practice_question_id AS id, question_text, options, correct_answer, explanation, section, topic, difficulty, image_url
       FROM daily_challenge_questions WHERE daily_challenge_id = $1 ORDER BY position`,
    [challengeId],
  )
  if (result.rows.length !== 15) throw new HttpError(503, 'Ежедневное задание подготовлено некорректно', 'daily_challenge_invalid')
  return result.rows
}

async function dailyReview(execute, attemptId) {
  const result = await execute(
    `SELECT q.practice_question_id AS id, q.question_text, q.options, q.correct_answer, q.explanation,
            q.section, q.topic, q.difficulty, q.image_url, a.selected_answer, a.is_correct
       FROM daily_challenge_questions q
       JOIN daily_challenge_attempt_answers a
         ON a.practice_question_id = q.practice_question_id AND a.daily_challenge_attempt_id = $1
      WHERE q.daily_challenge_id = (
        SELECT daily_challenge_id FROM daily_challenge_attempts WHERE id = $1
      )
      ORDER BY q.position`,
    [attemptId],
  )
  if (result.rows.length !== 15) throw new HttpError(503, 'История задания дня подготовлена некорректно', 'daily_review_invalid')
  return result.rows
}

function parseBegin(body) {
  exact(body, ['idempotencyKey'], 'invalid_daily_begin')
  return { idempotencyKey: uuid(body.idempotencyKey, 'invalid_daily_begin_key') }
}

function parseSubmit(body) {
  exact(body, ['idempotencyKey', 'answers'], 'invalid_daily_submit')
  if (!Array.isArray(body.answers) || body.answers.length > 15) throw new HttpError(400, 'Некорректные ответы', 'invalid_daily_answers')
  const answers = body.answers.map(value => {
    const row = object(value, 'invalid_daily_answers')
    exact(row, ['questionId', 'answer'], 'invalid_daily_answers')
    const questionId = positiveId(row.questionId, 'question_id')
    if (typeof row.answer !== 'string' || !ANSWERS.has(row.answer)) throw new HttpError(400, 'Некорректный ответ', 'invalid_daily_answers')
    return { questionId, answer: row.answer }
  })
  if (new Set(answers.map(answer => answer.questionId)).size !== answers.length) throw new HttpError(400, 'Повторяющийся ответ', 'invalid_daily_answers')
  return { idempotencyKey: uuid(body.idempotencyKey, 'invalid_daily_submit_key'), answers }
}

function stars(score) {
  if (score >= 90) return 3
  if (score >= 75) return 2
  if (score >= 50) return 1
  return 0
}

function trainerFilter(search) {
  const subject = String(search.get('subject') ?? '').trim().toLowerCase()
  const section = String(search.get('section') ?? '').trim().toLowerCase()
  const difficulty = String(search.get('difficulty') ?? '').trim().toLowerCase()
  if (!/^(math|kyr)$/.test(subject) || !/^[a-z][a-z0-9_-]{0,63}$/.test(section) || !['easy', 'medium', 'hard'].includes(difficulty)) {
    throw new HttpError(400, 'Выбери предмет, раздел и сложность', 'invalid_trainer_filter')
  }
  return { subject, section, difficulty }
}

GET('/v1/platform/daily-challenge', async ({ req, config }) => {
  const user = await student(config, req)
  const challenge = await todayChallenge(query, user.id)
  if (!challenge) return { status: 200, body: { available: false } }
  const attempt = await query(
    `SELECT id, status, started_at, submitted_at, correct_count, score_percent, star_count, xp_awarded
       FROM daily_challenge_attempts WHERE daily_challenge_id = $1 AND student_id = $2`,
    [challenge.id, user.id],
  )
  const openAttempt = attempt.rows[0]
  const questions = openAttempt?.status === 'started' ? await challengeQuestions(query, challenge.id) : []
  const review = openAttempt?.status === 'submitted' ? await dailyReview(query, openAttempt.id) : null
  return { status: 200, body: {
    available: true,
    challenge: { id: Number(challenge.id), title: challenge.title, subject: challenge.subject, questionCount: 15, xpReward: Number(challenge.xp_reward) },
    attempt: openAttempt ? dailyAttempt({ ...openAttempt, questions, review }, openAttempt.status === 'started') : null,
  } }
})

POST('/v1/platform/daily-challenge/start', async ({ req, config }) => {
  const user = await student(config, req)
  const input = parseBegin(await readJson(req, 2_000))
  const output = await transaction(async client => {
    const challenge = await todayChallenge((text, values) => client.query(text, values), user.id, { forUpdate: true })
    if (!challenge) throw new HttpError(404, 'Задание дня пока не опубликовано', 'daily_challenge_unavailable')
    const existing = await client.query(
      `SELECT id, status, started_at, submitted_at, correct_count, score_percent, star_count, xp_awarded, begin_idempotency_key
         FROM daily_challenge_attempts WHERE daily_challenge_id = $1 AND student_id = $2 FOR UPDATE`, [challenge.id, user.id],
    )
    let attempt = existing.rows[0]
    if (attempt && attempt.begin_idempotency_key !== input.idempotencyKey) {
      throw new HttpError(409, attempt.status === 'submitted' ? 'Задание дня уже выполнено' : 'Задание дня уже открыто', attempt.status === 'submitted' ? 'daily_completed' : 'daily_attempt_open')
    }
    if (!attempt) {
      const inserted = await client.query(
        `INSERT INTO daily_challenge_attempts (daily_challenge_id, student_id, begin_idempotency_key)
         VALUES ($1, $2, $3) RETURNING id, status, started_at, submitted_at, correct_count, score_percent, star_count, xp_awarded`,
        [challenge.id, user.id, input.idempotencyKey],
      )
      attempt = inserted.rows[0]
    }
    const questions = attempt.status === 'started' ? await challengeQuestions((text, values) => client.query(text, values), challenge.id) : []
    const review = attempt.status === 'submitted' ? await dailyReview((text, values) => client.query(text, values), attempt.id) : null
    return { challenge, attempt, questions, review }
  })
  return { status: 200, body: {
    challenge: { id: Number(output.challenge.id), title: output.challenge.title, subject: output.challenge.subject, questionCount: 15, xpReward: Number(output.challenge.xp_reward) },
    attempt: dailyAttempt({ ...output.attempt, questions: output.questions, review: output.review }, output.attempt.status === 'started'),
  } }
})

POST('/v1/platform/daily-challenge/submit', async ({ req, config }) => {
  const user = await student(config, req)
  const input = parseSubmit(await readJson(req, 32_000))
  const result = await transaction(async client => {
    const challenge = await todayChallenge((text, values) => client.query(text, values), user.id, { forUpdate: true })
    if (!challenge) throw new HttpError(404, 'Задание дня недоступно', 'daily_challenge_unavailable')
    const found = await client.query(
      `SELECT id, status, started_at, submitted_at, correct_count, score_percent, star_count, xp_awarded, submit_idempotency_key
         FROM daily_challenge_attempts WHERE daily_challenge_id = $1 AND student_id = $2 FOR UPDATE`, [challenge.id, user.id],
    )
    const attempt = found.rows[0]
    if (!attempt) throw new HttpError(409, 'Сначала открой задание дня', 'daily_not_started')
    if (attempt.status === 'submitted') {
      if (attempt.submit_idempotency_key === input.idempotencyKey) {
        return { attempt, review: await dailyReview((text, values) => client.query(text, values), attempt.id) }
      }
      throw new HttpError(409, 'Задание дня уже выполнено', 'daily_completed')
    }
    const questions = await challengeQuestions((text, values) => client.query(text, values), challenge.id)
    const answerMap = new Map(input.answers.map(answer => [answer.questionId, answer.answer]))
    if ([...answerMap.keys()].some(id => !questions.some(question => Number(question.id) === id))) throw new HttpError(400, 'В ответах есть чужой вопрос', 'invalid_daily_answers')
    const correct = questions.reduce((count, question) => count + (answerMap.get(Number(question.id)) === question.correct_answer ? 1 : 0), 0)
    const score = Number(((correct / questions.length) * 100).toFixed(2))
    const starCount = stars(score)
    const xpAwarded = Math.round((Number(challenge.xp_reward) * starCount) / 3)
    for (const question of questions) {
      const selectedAnswer = answerMap.get(Number(question.id)) ?? null
      await client.query(
        `INSERT INTO daily_challenge_attempt_answers (daily_challenge_attempt_id, practice_question_id, selected_answer, is_correct)
         VALUES ($1, $2, $3, $4)`,
        [attempt.id, question.id, selectedAnswer, selectedAnswer === question.correct_answer],
      )
    }
    const updated = await client.query(
      `UPDATE daily_challenge_attempts
          SET status = 'submitted', submit_idempotency_key = $2, correct_count = $3, score_percent = $4,
              star_count = $5, xp_awarded = $6, submitted_at = now()
        WHERE id = $1
        RETURNING id, status, started_at, submitted_at, correct_count, score_percent, star_count, xp_awarded`,
      [attempt.id, input.idempotencyKey, correct, score, starCount, xpAwarded],
    )
    if (xpAwarded > 0) await client.query(
      `INSERT INTO student_xp_awards (student_id, course_id, award_key, source_type, source_id, xp_amount)
       VALUES ($1, $2, $3, 'daily', $4, $5) ON CONFLICT (student_id, award_key) DO NOTHING`,
      [user.id, challenge.course_id, `daily:${challenge.id}`, String(challenge.id), xpAwarded],
    )
    await recordGamificationEvent(client, user.id, {
      eventKey: `daily-challenge:${attempt.id}`,
      eventType: 'daily_challenge_completed',
      metadata: { challengeId: Number(challenge.id), starCount, scorePercent: score },
    })
    await client.query(`INSERT INTO audit_log (actor_user_id, action, target_type, target_id, metadata) VALUES ($1, 'submit_daily_challenge', 'daily_challenge_attempt', $2, $3::jsonb)`, [user.id, attempt.id, JSON.stringify({ correct, score, starCount, xpAwarded })])
    return { attempt: updated.rows[0], review: await dailyReview((text, values) => client.query(text, values), attempt.id) }
  })
  return { status: 200, body: { attempt: dailyAttempt({ ...result.attempt, review: result.review }) } }
})

GET('/v1/platform/trainer/question', async ({ req, config, query: search }) => {
  const user = await student(config, req)
  const filter = trainerFilter(search)
  const issued = await transaction(async client => {
    const selected = await client.query(
      `SELECT q.id, q.question_text, q.options, q.section, q.topic, q.difficulty, q.image_url
         FROM practice_questions q JOIN practice_tests t ON t.id = q.practice_test_id
        WHERE q.is_active = true AND t.is_published = true AND t.test_type = 'bank'
          AND t.subject = $2 AND q.section = $3 AND q.difficulty = $4
          AND (t.available_from IS NULL OR t.available_from <= now())
          AND (t.available_until IS NULL OR t.available_until > now())
          AND (t.course_id IS NULL OR EXISTS (SELECT 1 FROM active_course_enrollments ce WHERE ce.student_id = $1 AND ce.course_id = t.course_id))
          AND NOT EXISTS (SELECT 1 FROM trainer_question_mastery m WHERE m.student_id = $1 AND m.practice_question_id = q.id)
        ORDER BY random() LIMIT 1 FOR UPDATE SKIP LOCKED`,
      [user.id, filter.subject, filter.section, filter.difficulty],
    )
    const question = selected.rows[0]
    if (!question) return null
    const issue = await client.query(
      `INSERT INTO trainer_question_issues (student_id, practice_question_id) VALUES ($1, $2)
       ON CONFLICT (student_id, practice_question_id) DO UPDATE SET issued_at = now()
       RETURNING id`, [user.id, question.id],
    )
    return { question, issueId: issue.rows[0].id }
  })
  if (!issued) return { status: 200, body: { question: null } }
  return { status: 200, body: { question: publicQuestion(issued.question, issued.issueId) } }
})

GET('/v1/platform/trainer/catalog', async ({ req, config }) => {
  const user = await student(config, req)
  const result = await query(
    `SELECT t.subject, q.section, q.difficulty, count(*)::int AS remaining_count
       FROM practice_questions q
       JOIN practice_tests t ON t.id = q.practice_test_id
      WHERE q.is_active = true
        AND t.is_published = true
        AND t.test_type = 'bank'
        AND t.subject IN ('math', 'kyr')
        AND (t.available_from IS NULL OR t.available_from <= now())
        AND (t.available_until IS NULL OR t.available_until > now())
        AND (t.course_id IS NULL OR EXISTS (
          SELECT 1 FROM active_course_enrollments ce
           WHERE ce.student_id = $1 AND ce.course_id = t.course_id AND ce.status = 'active'
        ))
        AND NOT EXISTS (
          SELECT 1 FROM trainer_question_mastery mastery
           WHERE mastery.student_id = $1 AND mastery.practice_question_id = q.id
        )
      GROUP BY t.subject, q.section, q.difficulty
      ORDER BY t.subject, q.section, q.difficulty`,
    [user.id],
  )
  const items = result.rows.map(row => ({
    subject: row.subject,
    section: row.section,
    difficulty: row.difficulty,
    remainingCount: Number(row.remaining_count),
  }))
  return { status: 200, body: { items, totalRemaining: items.reduce((total, item) => total + item.remainingCount, 0) } }
})

POST('/v1/platform/trainer/answers', async ({ req, config }) => {
  const user = await student(config, req)
  const body = await readJson(req, 2_000)
  exact(body, ['issueId', 'answer', 'idempotencyKey'], 'invalid_trainer_answer')
  const issueId = uuid(body.issueId, 'invalid_trainer_issue')
  const idempotencyKey = uuid(body.idempotencyKey, 'invalid_trainer_answer_key')
  if (typeof body.answer !== 'string' || !ANSWERS.has(body.answer)) throw new HttpError(400, 'Некорректный ответ', 'invalid_trainer_answer')
  const result = await transaction(async client => {
    const replay = await client.query(`SELECT is_correct FROM trainer_answers WHERE student_id = $1 AND idempotency_key = $2`, [user.id, idempotencyKey])
    if (replay.rows[0]) return { isCorrect: replay.rows[0].is_correct, replay: true }
    const issue = await client.query(
      `SELECT i.id, q.id AS question_id, q.question_text, q.options, q.correct_answer, q.explanation FROM trainer_question_issues i
       JOIN practice_questions q ON q.id = i.practice_question_id
       WHERE i.id = $1 AND i.student_id = $2 FOR UPDATE`, [issueId, user.id],
    )
    const row = issue.rows[0]
    if (!row) throw new HttpError(409, 'Этот вопрос больше не ожидает ответа', 'trainer_issue_not_found')
    const isCorrect = body.answer === row.correct_answer
    await client.query(
      `INSERT INTO trainer_answers (student_id, practice_question_id, question_text, options, correct_answer, explanation, selected_answer, is_correct, idempotency_key)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9)`,
      [user.id, row.question_id, row.question_text, JSON.stringify(row.options), row.correct_answer, row.explanation, body.answer, isCorrect, idempotencyKey],
    )
    const mastery = isCorrect
      ? await client.query(
        `INSERT INTO trainer_question_mastery (student_id, practice_question_id)
         VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING practice_question_id`,
        [user.id, row.question_id],
      )
      : null
    if (mastery?.rows[0]) await recordGamificationEvent(client, user.id, {
      eventKey: `trainer:${row.question_id}`,
      eventType: 'trainer_mastered',
      metadata: { questionId: Number(row.question_id) },
    })
    await client.query(`DELETE FROM trainer_question_issues WHERE id = $1`, [issueId])
    return { isCorrect, replay: false }
  })
  return { status: 200, body: result }
})

GET('/v1/platform/trainer/history', async ({ req, config }) => {
  const user = await student(config, req)
  const result = await query(
    `SELECT practice_question_id, question_text, options, correct_answer, explanation, selected_answer, is_correct, answered_at
       FROM trainer_answers WHERE student_id = $1 ORDER BY answered_at DESC, id DESC LIMIT 100`,
    [user.id],
  )
  return { status: 200, body: { items: result.rows.map(row => ({
    questionId: Number(row.practice_question_id), questionText: row.question_text, options: row.options,
    correctAnswer: row.correct_answer, selectedAnswer: row.selected_answer, isCorrect: row.is_correct,
    explanation: row.explanation ?? null, answeredAt: row.answered_at,
  })) } }
})

GET('/v1/platform/gamification/summary', async ({ req, config }) => {
  const user = await student(config, req)
  const summary = await transaction(client => loadGamificationSummary(client, user.id))
  return { status: 200, body: { summary } }
})

POST('/v1/platform/gamification/quests/:progressId/claim', async ({ req, params, config }) => {
  const user = await student(config, req)
  exact(await readJson(req, 1_000), [], 'invalid_quest_claim')
  const progressId = positiveId(params.progressId, 'quest_progress_id')
  const result = await transaction(async client => {
    const claim = await claimQuestReward(client, user.id, progressId)
    if (claim.state === 'not_found') throw new HttpError(404, 'Квест не найден', 'quest_not_found')
    if (claim.state === 'not_ready') throw new HttpError(409, 'Квест ещё не выполнен', 'quest_not_ready')
    return { claim, summary: await loadGamificationSummary(client, user.id) }
  })
  return { status: 200, body: result }
})

POST('/v1/platform/gamification/check-in', async ({ req, config }) => {
  const user = await student(config, req)
  exact(await readJson(req, 1_000), [], 'invalid_gamification_check_in')
  const result = await transaction(async client => {
    const today = await client.query(`SELECT to_char((now() AT TIME ZONE 'Asia/Bishkek')::date, 'YYYY-MM-DD') AS day`)
    const event = await recordGamificationEvent(client, user.id, {
      eventKey: `visit:${today.rows[0].day}`,
      eventType: 'platform_visit',
      metadata: {},
    })
    const summary = await loadGamificationSummary(client, user.id)
    return { ...event, summary }
  })
  return { status: 200, body: result }
})

POST('/v1/platform/trainer/reset', async ({ req, config }) => {
  const user = await student(config, req)
  exact(await readJson(req, 1_000), [], 'invalid_trainer_reset')
  const result = await transaction(async client => {
    const removed = await client.query(`DELETE FROM trainer_question_mastery WHERE student_id = $1 RETURNING practice_question_id`, [user.id])
    await client.query(`DELETE FROM trainer_question_issues WHERE student_id = $1`, [user.id])
    await client.query(`INSERT INTO trainer_progress_resets (student_id, removed_mastery_count) VALUES ($1, $2)`, [user.id, removed.rowCount])
    await client.query(`INSERT INTO audit_log (actor_user_id, action, target_type, target_id, metadata) VALUES ($1, 'reset_trainer_progress', 'trainer', $1, $2::jsonb)`, [user.id, JSON.stringify({ removed: removed.rowCount })])
    return removed.rowCount
  })
  return { status: 200, body: { reset: true, removedMasteryCount: result } }
})

GET('/v1/platform/leaderboard', async ({ req, config }) => {
  const user = await student(config, req)
  const result = await query(
    `WITH participants AS (
       SELECT p.user_id, p.public_profile_id, COALESCE(total.xp_total, 0)::int AS xp,
              COALESCE(NULLIF(p.community_display_name, ''), ('Ученик-' || upper(substr(replace(p.public_profile_id::text, '-', ''), 1, 5)))) AS display_name,
              p.profile_color, p.profile_frame_code, p.profile_background_code, p.profile_title_code
         FROM profiles p
         JOIN users u ON u.id = p.user_id AND u.blocked = false
         LEFT JOIN student_xp_totals total ON total.student_id = p.user_id
        WHERE ((p.role = 'student' AND p.student_type = 'online') OR p.role = 'math_student')
          AND p.community_profile_visibility = 'leaderboard'
          AND p.community_discoverable = true
          AND EXISTS (
            SELECT 1 FROM active_course_enrollments ce
            JOIN courses c ON c.id = ce.course_id AND c.is_active = true AND c.delivery_mode = 'online'
             WHERE ce.student_id = p.user_id AND ce.status = 'active'
          )
     ), ranked AS (
       SELECT *, row_number() OVER (ORDER BY xp DESC, user_id ASC)::int AS rank FROM participants
     )
     SELECT user_id, public_profile_id, display_name, xp, rank, profile_color,
            profile_frame_code, profile_background_code, profile_title_code
       FROM ranked
      ORDER BY rank`,
  )
  const mine = result.rows.find(row => row.user_id === user.id) ?? null
  return {
    status: 200,
    body: {
      scope: 'overall',
      items: result.rows.slice(0, 100).map(row => ({
        rank: Number(row.rank), publicProfileId: row.public_profile_id,
        displayName: row.display_name, xp: Number(row.xp), isMe: row.user_id === user.id,
        profileColor: row.profile_color, frameCode: row.profile_frame_code,
        backgroundCode: row.profile_background_code, titleCode: row.profile_title_code,
      })),
      me: mine ? {
        rank: Number(mine.rank), publicProfileId: mine.public_profile_id,
        displayName: mine.display_name, xp: Number(mine.xp), profileColor: mine.profile_color,
        frameCode: mine.profile_frame_code, backgroundCode: mine.profile_background_code,
        titleCode: mine.profile_title_code,
      } : null,
    },
  }
})

GET('/v1/platform/community/profiles/:publicProfileId', async ({ req, params, config }) => {
  const viewer = await student(config, req)
  const publicProfileId = uuid(params.publicProfileId, 'invalid_public_profile_id')
  const profile = await query(
    `SELECT p.user_id, p.public_profile_id, p.profile_color, p.profile_frame_code, p.profile_background_code, p.profile_title_code,
            p.community_show_xp, p.community_show_achievements, p.community_show_streak,
            COALESCE(total.xp_total, 0)::int AS xp,
            COALESCE(NULLIF(p.community_display_name, ''), ('Ученик-' || upper(substr(replace(p.public_profile_id::text, '-', ''), 1, 5)))) AS display_name
       FROM profiles p
       JOIN users u ON u.id = p.user_id AND u.blocked = false
       LEFT JOIN student_xp_totals total ON total.student_id = p.user_id
      WHERE p.public_profile_id = $1
        AND ((p.role = 'student' AND p.student_type = 'online') OR p.role = 'math_student')
        AND p.community_profile_visibility <> 'private'
        AND p.community_discoverable = true`,
    [publicProfileId],
  )
  const row = profile.rows[0]
  if (!row) throw new HttpError(404, 'Профиль недоступен', 'community_profile_not_found')
  const achievements = row.community_show_achievements
    ? await query(
      `SELECT d.code, d.title, d.description, d.icon_key, a.unlocked_at
         FROM student_featured_achievements f
         JOIN student_achievements a ON a.student_id = f.student_id AND a.achievement_id = f.achievement_id
         JOIN achievement_definitions d ON d.id = a.achievement_id AND d.is_active = true
        WHERE f.student_id = $1
        ORDER BY f.slot`,
      [row.user_id],
    )
    : { rows: [] }
  const summary = row.community_show_streak
    ? await transaction(client => loadGamificationSummary(client, row.user_id))
    : null
  const xp = Number(row.xp)
  return { status: 200, body: { profile: {
    publicProfileId: row.public_profile_id,
    displayName: row.display_name,
    profileColor: row.profile_color,
    frameCode: row.profile_frame_code,
    backgroundCode: row.profile_background_code,
    titleCode: row.profile_title_code,
    xp: row.community_show_xp ? xp : null,
    level: row.community_show_xp ? Math.floor(xp / 500) + 1 : null,
    streak: summary?.streak ?? null,
    isMe: row.user_id === viewer.id,
    achievements: achievements.rows.map(item => ({
      code: item.code, title: item.title, description: item.description,
      iconKey: item.icon_key, unlockedAt: item.unlocked_at,
    })),
  } } }
})
