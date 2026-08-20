import { requireAuth } from '../auth.js'
import { query, transaction } from '../db.js'
import { GET, HttpError, PATCH, POST, readJson } from '../http.js'
import { requireRole } from '../authorization.js'

const ROLES = ['admin', 'super_admin']
const QUEST_PERIODS = new Set(['daily', 'weekly'])
const QUEST_EVENTS = new Set([
  'platform_visit', 'lesson_completed', 'practice_submitted',
  'daily_challenge_completed', 'trainer_mastered', 'daily_quest_completed',
  'weekly_quest_completed',
])

async function admin(config, req) {
  return requireRole(await requireAuth(config, req), ROLES)
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

function positive(value, field) {
  if (!Number.isSafeInteger(value) || value < 1) throw new HttpError(400, `Некорректный ${field}`, `invalid_${field}`)
  return value
}

function date(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new HttpError(400, 'Некорректная дата', 'invalid_daily_date')
  const [year, month, day] = value.split('-').map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) throw new HttpError(400, 'Некорректная дата', 'invalid_daily_date')
  return value
}

function input(body) {
  exact(body, ['courseId', 'challengeDate', 'title', 'subject', 'xpReward', 'questionIds', 'isPublished'], 'invalid_daily_challenge')
  if (typeof body.title !== 'string' || !body.title.trim() || body.title.trim().length > 300) throw new HttpError(400, 'Некорректное название', 'invalid_daily_title')
  if (typeof body.subject !== 'string' || !['math', 'kyr'].includes(body.subject)) throw new HttpError(400, 'Некорректный предмет', 'invalid_daily_subject')
  if (!Number.isSafeInteger(body.xpReward) || body.xpReward < 1 || body.xpReward > 10_000) throw new HttpError(400, 'Некорректный XP', 'invalid_daily_xp')
  if (typeof body.isPublished !== 'boolean') throw new HttpError(400, 'Некорректная публикация', 'invalid_daily_publish')
  if (!Array.isArray(body.questionIds) || body.questionIds.length !== 15) throw new HttpError(400, 'Нужно ровно 15 вопросов', 'invalid_daily_questions')
  const questionIds = body.questionIds.map(id => positive(id, 'question_id'))
  if (new Set(questionIds).size !== 15) throw new HttpError(400, 'Вопросы не должны повторяться', 'invalid_daily_questions')
  return { courseId: positive(body.courseId, 'course_id'), challengeDate: date(body.challengeDate), title: body.title.trim(), subject: body.subject, xpReward: body.xpReward, questionIds, isPublished: body.isPublished }
}

function publicChallenge(row) {
  return { id: Number(row.id), courseId: Number(row.course_id), challengeDate: row.challenge_date, title: row.title, subject: row.subject, xpReward: Number(row.xp_reward), isPublished: row.is_published, questionCount: Number(row.question_count ?? 0), createdAt: row.created_at }
}

GET('/v1/admin/daily-challenges', async ({ req, config, query: search }) => {
  await admin(config, req)
  const courseId = search.get('courseId')
  const result = await query(
    `SELECT d.id, d.course_id, d.challenge_date, d.title, d.subject, d.xp_reward, d.is_published, d.created_at, count(q.daily_challenge_id)::int AS question_count
       FROM daily_challenges d LEFT JOIN daily_challenge_questions q ON q.daily_challenge_id = d.id
      WHERE ($1::bigint IS NULL OR d.course_id = $1)
      GROUP BY d.id ORDER BY d.challenge_date DESC, d.id DESC LIMIT 100`,
    [courseId == null || courseId === '' ? null : positive(Number(courseId), 'course_id')],
  )
  return { status: 200, body: { items: result.rows.map(publicChallenge) } }
})

POST('/v1/admin/daily-challenges', async ({ req, config }) => {
  const actor = await admin(config, req)
  const value = input(await readJson(req, 32_000))
  try {
    const challenge = await transaction(async client => {
      const course = await client.query(`SELECT id FROM courses WHERE id = $1 AND is_active = true AND delivery_mode = 'online'`, [value.courseId])
      if (!course.rows[0]) throw new HttpError(404, 'Активный онлайн-курс не найден', 'course_not_found')
      const questions = await client.query(
        `SELECT q.id, q.question_text, q.options, q.correct_answer, q.explanation, q.section, q.topic, q.difficulty, q.image_url
           FROM practice_questions q JOIN practice_tests t ON t.id = q.practice_test_id
          WHERE q.id = ANY($1::bigint[]) AND q.is_active = true AND t.subject = $2`,
        [value.questionIds, value.subject],
      )
      if (questions.rows.length !== 15) throw new HttpError(400, 'Выбери 15 активных вопросов указанного предмета', 'invalid_daily_questions')
      const byId = new Map(questions.rows.map(row => [Number(row.id), row]))
      const inserted = await client.query(
        `INSERT INTO daily_challenges (course_id, challenge_date, title, subject, xp_reward, is_published, created_by)
         VALUES ($1, $2, $3, $4, $5, false, $6) RETURNING id, course_id, challenge_date, title, subject, xp_reward, is_published, created_at`,
        [value.courseId, value.challengeDate, value.title, value.subject, value.xpReward, actor.id],
      )
      const daily = inserted.rows[0]
      for (const [index, questionId] of value.questionIds.entries()) {
        const question = byId.get(questionId)
        await client.query(
          `INSERT INTO daily_challenge_questions (daily_challenge_id, practice_question_id, position, question_text, options, correct_answer, explanation, section, topic, difficulty, image_url)
           VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10, $11)`,
          [daily.id, question.id, index + 1, question.question_text, JSON.stringify(question.options), question.correct_answer, question.explanation, question.section, question.topic, question.difficulty, question.image_url],
        )
      }
      if (value.isPublished) await client.query(`UPDATE daily_challenges SET is_published = true WHERE id = $1`, [daily.id])
      await client.query(`INSERT INTO audit_log (actor_user_id, action, target_type, target_id, metadata) VALUES ($1, 'create_daily_challenge', 'daily_challenge', $2, $3::jsonb)`, [actor.id, daily.id, JSON.stringify({ courseId: value.courseId, questionCount: 15, published: value.isPublished })])
      return { ...daily, is_published: value.isPublished, question_count: 15 }
    })
    return { status: 201, body: { challenge: publicChallenge(challenge) } }
  } catch (error) {
    if (error?.code === '23505') throw new HttpError(409, 'Для этого курса уже есть задание на выбранную дату', 'daily_challenge_conflict')
    throw error
  }
})

PATCH('/v1/admin/daily-challenges/:challengeId/publish', async ({ req, params, config }) => {
  const actor = await admin(config, req)
  exact(await readJson(req, 1_000), [], 'invalid_daily_publish')
  const challengeId = positive(Number(params.challengeId), 'daily_challenge_id')
  const updated = await transaction(async client => {
    const found = await client.query(
      `SELECT id, course_id, challenge_date, title, subject, xp_reward, is_published, created_at
         FROM daily_challenges WHERE id = $1 FOR UPDATE`,
      [challengeId],
    )
    const current = found.rows[0]
    if (!current) throw new HttpError(404, 'Задание дня не найдено', 'daily_challenge_not_found')
    if (!current.is_published) await client.query(`UPDATE daily_challenges SET is_published = true WHERE id = $1`, [challengeId])
    await client.query(`INSERT INTO audit_log (actor_user_id, action, target_type, target_id, metadata) VALUES ($1, 'publish_daily_challenge', 'daily_challenge', $2, '{}'::jsonb)`, [actor.id, challengeId])
    return { ...current, is_published: true, question_count: 15 }
  })
  return { status: 200, body: { challenge: publicChallenge(updated) } }
})

function questConfiguration(body) {
  exact(body, ['targetCount', 'xpReward', 'isActive'], 'invalid_quest_configuration')
  if (!Number.isSafeInteger(body.targetCount) || body.targetCount < 1 || body.targetCount > 1000) {
    throw new HttpError(400, 'Некорректная цель квеста', 'invalid_quest_target')
  }
  if (!Number.isSafeInteger(body.xpReward) || body.xpReward < 1 || body.xpReward > 10_000) {
    throw new HttpError(400, 'Некорректная награда XP', 'invalid_quest_xp')
  }
  if (typeof body.isActive !== 'boolean') throw new HttpError(400, 'Некорректный статус квеста', 'invalid_quest_status')
  return { targetCount: body.targetCount, xpReward: body.xpReward, isActive: body.isActive }
}

function achievementConfiguration(body) {
  exact(body, ['isActive', 'sortOrder'], 'invalid_achievement_configuration')
  if (typeof body.isActive !== 'boolean') throw new HttpError(400, 'Некорректный статус достижения', 'invalid_achievement_status')
  if (!Number.isSafeInteger(body.sortOrder) || body.sortOrder < 0 || body.sortOrder > 10_000) {
    throw new HttpError(400, 'Некорректный порядок достижения', 'invalid_achievement_order')
  }
  return { isActive: body.isActive, sortOrder: body.sortOrder }
}

function publicQuestDefinition(row) {
  const current = {
    effectiveFrom: row.current_effective_from,
    targetCount: Number(row.current_target_count),
    xpReward: Number(row.current_xp_reward),
    isActive: row.current_is_active,
  }
  return {
    id: Number(row.id),
    code: row.code,
    period: row.period,
    targetEventType: row.target_event_type,
    title: row.title,
    description: row.description,
    sortOrder: Number(row.sort_order),
    current,
    scheduled: row.scheduled_effective_from == null ? null : {
      effectiveFrom: row.scheduled_effective_from,
      targetCount: Number(row.scheduled_target_count),
      xpReward: Number(row.scheduled_xp_reward),
      isActive: row.scheduled_is_active,
    },
  }
}

function publicAchievementDefinition(row) {
  return {
    id: Number(row.id),
    code: row.code,
    title: row.title,
    description: row.description,
    iconKey: row.icon_key,
    sortOrder: Number(row.sort_order),
    isActive: row.is_active,
  }
}

async function gamificationDefinitions(execute) {
  const [quests, achievements] = await Promise.all([
    execute(
      `WITH bounds AS (
         SELECT (now() AT TIME ZONE 'Asia/Bishkek')::date AS today,
                date_trunc('week', now() AT TIME ZONE 'Asia/Bishkek')::date AS week_start
       )
       SELECT d.id, d.code, d.period, d.target_event_type,
              current_revision.title, current_revision.description, current_revision.sort_order,
              current_revision.effective_from AS current_effective_from,
              current_revision.target_count AS current_target_count,
              current_revision.xp_reward AS current_xp_reward,
              current_revision.is_active AS current_is_active,
              scheduled_revision.effective_from AS scheduled_effective_from,
              scheduled_revision.target_count AS scheduled_target_count,
              scheduled_revision.xp_reward AS scheduled_xp_reward,
              scheduled_revision.is_active AS scheduled_is_active
         FROM quest_definitions d
         CROSS JOIN bounds b
         JOIN LATERAL (
           SELECT r.* FROM quest_definition_revisions r
            WHERE r.quest_definition_id = d.id
              AND r.effective_from <= CASE WHEN d.period = 'daily' THEN b.today ELSE b.week_start END
            ORDER BY r.effective_from DESC
            LIMIT 1
         ) current_revision ON true
         LEFT JOIN LATERAL (
           SELECT r.* FROM quest_definition_revisions r
            WHERE r.quest_definition_id = d.id
              AND r.effective_from > CASE WHEN d.period = 'daily' THEN b.today ELSE b.week_start END
            ORDER BY r.effective_from ASC
            LIMIT 1
         ) scheduled_revision ON true
        ORDER BY d.period, current_revision.sort_order, d.code`,
    ),
    execute(
      `SELECT id, code, title, description, icon_key, sort_order, is_active
         FROM achievement_definitions
        ORDER BY sort_order, code`,
    ),
  ])
  return {
    quests: quests.rows.map(publicQuestDefinition),
    achievements: achievements.rows.map(publicAchievementDefinition),
  }
}

/**
 * XP is never adjusted from the dashboard.  These settings create immutable
 * future-period quest revisions; already-created instances stay unchanged.
 */
GET('/v1/admin/gamification/definitions', async ({ req, config }) => {
  await admin(config, req)
  return { status: 200, headers: { 'Cache-Control': 'private, no-store' }, body: await gamificationDefinitions(query) }
})

PATCH('/v1/admin/gamification/quests/:definitionId', async ({ req, params, config }) => {
  const actor = await admin(config, req)
  const definitionId = positive(Number(params.definitionId), 'quest_definition_id')
  const value = questConfiguration(await readJson(req, 1_000))
  const result = await transaction(async client => {
    const found = await client.query(
      `SELECT id, code, period, target_event_type
         FROM quest_definitions WHERE id = $1 FOR UPDATE`,
      [definitionId],
    )
    const definition = found.rows[0]
    if (!definition || !QUEST_PERIODS.has(definition.period) || !QUEST_EVENTS.has(definition.target_event_type)) {
      throw new HttpError(404, 'Квест не найден', 'quest_definition_not_found')
    }
    const boundary = await client.query(
      `SELECT CASE WHEN $1 = 'daily'
          THEN ((now() AT TIME ZONE 'Asia/Bishkek')::date + 1)
          ELSE (date_trunc('week', now() AT TIME ZONE 'Asia/Bishkek')::date + 7)::date
        END AS effective_from`,
      [definition.period],
    )
    const effectiveFrom = boundary.rows[0].effective_from
    const base = await client.query(
      `SELECT title, description, sort_order
         FROM quest_definition_revisions
        WHERE quest_definition_id = $1 AND effective_from <= $2
        ORDER BY effective_from DESC
        LIMIT 1`,
      [definition.id, effectiveFrom],
    )
    if (!base.rows[0]) throw new HttpError(500, 'Не найдена базовая версия квеста', 'quest_revision_missing')
    await client.query(
      `INSERT INTO quest_definition_revisions (
         quest_definition_id, effective_from, target_count, xp_reward,
         title, description, sort_order, is_active, created_by
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (quest_definition_id, effective_from) DO UPDATE
         SET target_count = EXCLUDED.target_count,
             xp_reward = EXCLUDED.xp_reward,
             is_active = EXCLUDED.is_active,
             created_at = now(),
             created_by = EXCLUDED.created_by`,
      [definition.id, effectiveFrom, value.targetCount, value.xpReward,
        base.rows[0].title, base.rows[0].description, base.rows[0].sort_order, value.isActive, actor.id],
    )
    await client.query(
      `INSERT INTO audit_log (actor_user_id, action, target_type, target_id, metadata)
       VALUES ($1, 'schedule_quest_definition', 'quest_definition', $2, $3::jsonb)`,
      [actor.id, definition.id, JSON.stringify({ effectiveFrom, targetCount: value.targetCount, xpReward: value.xpReward, isActive: value.isActive })],
    )
    return gamificationDefinitions((text, values) => client.query(text, values))
  })
  return { status: 200, body: { definition: result.quests.find(item => item.id === definitionId) } }
})

PATCH('/v1/admin/gamification/achievements/:achievementId', async ({ req, params, config }) => {
  const actor = await admin(config, req)
  const achievementId = positive(Number(params.achievementId), 'achievement_id')
  const value = achievementConfiguration(await readJson(req, 1_000))
  const result = await transaction(async client => {
    const updated = await client.query(
      `UPDATE achievement_definitions
          SET is_active = $2, sort_order = $3
        WHERE id = $1
      RETURNING id, code, title, description, icon_key, sort_order, is_active`,
      [achievementId, value.isActive, value.sortOrder],
    )
    const achievement = updated.rows[0]
    if (!achievement) throw new HttpError(404, 'Достижение не найдено', 'achievement_definition_not_found')
    await client.query(
      `INSERT INTO audit_log (actor_user_id, action, target_type, target_id, metadata)
       VALUES ($1, 'update_achievement_definition', 'achievement_definition', $2, $3::jsonb)`,
      [actor.id, achievementId, JSON.stringify({ isActive: value.isActive, sortOrder: value.sortOrder })],
    )
    return publicAchievementDefinition(achievement)
  })
  return { status: 200, body: { achievement: result } }
})
