// Server-only gamification helpers.  Every function below is called from an
// already successful domain transaction; nothing accepts a browser-supplied
// XP amount, counter, student id or timestamp.

const PERIODS = new Set(['daily', 'weekly'])
const EVENT_TYPES = new Set([
  'platform_visit', 'lesson_completed', 'practice_submitted',
  'daily_challenge_completed', 'trainer_mastered', 'daily_quest_completed',
  'weekly_quest_completed',
])

function assertEvent(input) {
  if (!input || typeof input !== 'object' || !EVENT_TYPES.has(input.eventType)) {
    throw new Error('Invalid gamification event')
  }
  if (typeof input.eventKey !== 'string' || input.eventKey.length < 3 || input.eventKey.length > 240) {
    throw new Error('Invalid gamification event key')
  }
  if (input.metadata != null && (typeof input.metadata !== 'object' || Array.isArray(input.metadata))) {
    throw new Error('Invalid gamification metadata')
  }
}

async function ensureQuestInstances(client) {
  await client.query(
    `WITH bounds AS (
       SELECT (now() AT TIME ZONE 'Asia/Bishkek')::date AS today,
              date_trunc('week', now() AT TIME ZONE 'Asia/Bishkek')::date AS week_start
     )
     INSERT INTO quest_instances (
       quest_definition_id, period_start, period_end, title, description, target_count, xp_reward
     )
     SELECT d.id,
            CASE WHEN d.period = 'daily' THEN b.today ELSE b.week_start END,
            CASE WHEN d.period = 'daily' THEN b.today + 1 ELSE b.week_start + 7 END,
            revision.title, revision.description, revision.target_count, revision.xp_reward
       FROM quest_definitions d
       CROSS JOIN bounds b
       JOIN LATERAL (
         SELECT r.title, r.description, r.target_count, r.xp_reward, r.is_active
           FROM quest_definition_revisions r
          WHERE r.quest_definition_id = d.id
            AND r.effective_from <= CASE WHEN d.period = 'daily' THEN b.today ELSE b.week_start END
          ORDER BY r.effective_from DESC
          LIMIT 1
       ) revision ON true
      WHERE revision.is_active = true
     ON CONFLICT (quest_definition_id, period_start) DO NOTHING`,
  )
}

async function awardQuestXp(client, studentId, progressId, xpReward) {
  const award = await client.query(
    `INSERT INTO student_xp_awards (student_id, course_id, award_key, source_type, source_id, xp_amount)
     VALUES ($1, NULL, $2, 'quest', $3, $4)
     ON CONFLICT (student_id, award_key) DO NOTHING
     RETURNING id`,
    [studentId, `quest:${progressId}`, String(progressId), xpReward],
  )
  if (!award.rows[0]) return false
  const completed = await client.query(
    `UPDATE student_quest_progress
        SET completed_at = now(), xp_award_id = $2, updated_at = now()
      WHERE id = $1 AND completed_at IS NULL
      RETURNING id`,
    [progressId, award.rows[0].id],
  )
  return Boolean(completed.rows[0])
}

export async function claimQuestReward(client, studentId, progressId) {
  const result = await client.query(
    `SELECT p.id, p.current_count, p.ready_at, p.completed_at, i.target_count, i.xp_reward, d.period
       FROM student_quest_progress p
       JOIN quest_instances i ON i.id = p.quest_instance_id
       JOIN quest_definitions d ON d.id = i.quest_definition_id
      WHERE p.id = $1 AND p.student_id = $2
      FOR UPDATE OF p`,
    [progressId, studentId],
  )
  const row = result.rows[0]
  if (!row) return { state: 'not_found' }
  if (row.completed_at) return { state: 'already_claimed' }
  if (!row.ready_at || Number(row.current_count) < Number(row.target_count)) return { state: 'not_ready' }
  const claimed = await awardQuestXp(client, studentId, progressId, Number(row.xp_reward))
  if (!claimed) return { state: 'already_claimed' }
  const eventType = row.period === 'daily' ? 'daily_quest_completed' : 'weekly_quest_completed'
  const event = await recordGamificationEvent(client, studentId, {
    eventKey: `quest-claimed:${progressId}`,
    eventType,
    metadata: { questProgressId: progressId },
  })
  return { state: 'claimed', achievements: event.achievements }
}

export async function grantAchievement(client, studentId, code) {
  const result = await client.query(
    `INSERT INTO student_achievements (student_id, achievement_id)
     SELECT $1, id FROM achievement_definitions WHERE code = $2 AND is_active = true
     ON CONFLICT DO NOTHING
     RETURNING achievement_id`,
    [studentId, code],
  )
  return Boolean(result.rows[0])
}

async function evaluateAchievements(client, studentId, eventType, metadata) {
  const unlocked = []
  if (['lesson_completed', 'practice_submitted', 'daily_challenge_completed', 'trainer_mastered'].includes(eventType)) {
    if (await grantAchievement(client, studentId, 'first_step')) unlocked.push('first_step')
  }
  if (eventType === 'lesson_completed') {
    const lessons = await client.query(
      `SELECT count(*)::int AS count FROM gamification_events
        WHERE student_id = $1 AND event_type = 'lesson_completed'`, [studentId],
    )
    if (Number(lessons.rows[0].count) >= 1 && await grantAchievement(client, studentId, 'roadmap_start')) unlocked.push('roadmap_start')
    if (Number(lessons.rows[0].count) >= 5 && await grantAchievement(client, studentId, 'roadmap_five')) unlocked.push('roadmap_five')
  }
  if (eventType === 'trainer_mastered') {
    const mastered = await client.query(
      `SELECT count(*)::int AS count FROM gamification_events
        WHERE student_id = $1 AND event_type = 'trainer_mastered'`, [studentId],
    )
    if (Number(mastered.rows[0].count) >= 10 && await grantAchievement(client, studentId, 'trainer_ten')) unlocked.push('trainer_ten')
    if (Number(mastered.rows[0].count) >= 100 && await grantAchievement(client, studentId, 'trainer_hundred')) unlocked.push('trainer_hundred')
  }
  if (eventType === 'daily_challenge_completed' && metadata?.starCount === 3) {
    if (await grantAchievement(client, studentId, 'perfect_day')) unlocked.push('perfect_day')
  }
  if (eventType === 'platform_visit') {
    const streak = await client.query(
      `WITH bounds AS (
         SELECT (now() AT TIME ZONE 'Asia/Bishkek')::date AS today
       ), visits AS (
         SELECT DISTINCT (created_at AT TIME ZONE 'Asia/Bishkek')::date AS day
           FROM gamification_events
          WHERE student_id = $1 AND event_type = 'platform_visit'
       ), required AS (
         SELECT generate_series(today - 6, today, interval '1 day')::date AS day FROM bounds
       )
       SELECT count(*)::int AS count FROM required WHERE day IN (SELECT day FROM visits)`,
      [studentId],
    )
    if (Number(streak.rows[0].count) === 7 && await grantAchievement(client, studentId, 'rhythm_seven')) unlocked.push('rhythm_seven')
  }
  if (eventType === 'weekly_quest_completed') {
    const completed = await client.query(
      `WITH bounds AS (
         SELECT date_trunc('week', now() AT TIME ZONE 'Asia/Bishkek')::date AS start_day
       )
       SELECT count(*) FILTER (WHERE p.completed_at IS NOT NULL)::int AS completed,
              count(*)::int AS total
         FROM quest_instances i
         JOIN quest_definitions d ON d.id = i.quest_definition_id AND d.period = 'weekly'
         LEFT JOIN student_quest_progress p ON p.quest_instance_id = i.id AND p.student_id = $1
        WHERE i.period_start = (SELECT start_day FROM bounds)`,
      [studentId],
    )
    const row = completed.rows[0]
    if (Number(row.total) > 0 && Number(row.completed) === Number(row.total)
      && await grantAchievement(client, studentId, 'weekly_hero')) unlocked.push('weekly_hero')
  }
  return unlocked
}

/**
 * Insert one immutable evidence event and apply only the quests configured to
 * consume this event.  Call it within the business transaction that proves
 * the event; a replay produces no quest counters or XP.
 */
export async function recordGamificationEvent(client, studentId, input) {
  assertEvent(input)
  const inserted = await client.query(
    `INSERT INTO gamification_events (student_id, event_key, event_type, metadata)
     VALUES ($1, $2, $3, $4::jsonb)
     ON CONFLICT (student_id, event_key) DO NOTHING
     RETURNING id`,
    [studentId, input.eventKey, input.eventType, JSON.stringify(input.metadata ?? {})],
  )
  if (!inserted.rows[0]) return { recorded: false, readyQuestIds: [], achievements: [] }

  await ensureQuestInstances(client)
  const progress = await client.query(
    `WITH bounds AS (
       SELECT (now() AT TIME ZONE 'Asia/Bishkek')::date AS today,
              date_trunc('week', now() AT TIME ZONE 'Asia/Bishkek')::date AS week_start
     ), applicable AS (
       SELECT i.id, i.target_count, i.xp_reward, d.period
         FROM quest_instances i
         JOIN quest_definitions d ON d.id = i.quest_definition_id
         CROSS JOIN bounds b
        WHERE d.target_event_type = $2
          AND i.period_start = CASE WHEN d.period = 'daily' THEN b.today ELSE b.week_start END
     )
     INSERT INTO student_quest_progress (student_id, quest_instance_id, current_count)
     SELECT $1, id, 1 FROM applicable
     ON CONFLICT (student_id, quest_instance_id) DO UPDATE
       SET current_count = LEAST(
             (SELECT target_count FROM quest_instances WHERE id = student_quest_progress.quest_instance_id),
             student_quest_progress.current_count + 1
           ),
           updated_at = now()
     RETURNING id, quest_instance_id`,
    [studentId, input.eventType],
  )

  const readyQuestIds = []
  for (const row of progress.rows) {
    const target = await client.query(
      `SELECT p.current_count, p.ready_at, p.completed_at, i.target_count, d.period
         FROM student_quest_progress p
         JOIN quest_instances i ON i.id = p.quest_instance_id
         JOIN quest_definitions d ON d.id = i.quest_definition_id
        WHERE p.id = $1 FOR UPDATE`, [row.id],
    )
    const current = target.rows[0]
    if (!current || current.ready_at || current.completed_at || Number(current.current_count) < Number(current.target_count)) continue
    const ready = await client.query(
      `UPDATE student_quest_progress SET ready_at = now(), updated_at = now()
        WHERE id = $1 AND ready_at IS NULL AND completed_at IS NULL RETURNING id`,
      [row.id],
    )
    if (ready.rows[0]) readyQuestIds.push(Number(row.id))
  }
  const achievements = await evaluateAchievements(client, studentId, input.eventType, input.metadata ?? {})
  return { recorded: true, readyQuestIds, achievements }
}

function dateOnly(value) {
  return typeof value === 'string' ? value.slice(0, 10) : String(value).slice(0, 10)
}

function currentStreak(days, today) {
  const available = new Set(days.map(dateOnly))
  const cursor = new Date(`${today}T00:00:00.000Z`)
  let streak = 0
  while (available.has(cursor.toISOString().slice(0, 10))) {
    streak += 1
    cursor.setUTCDate(cursor.getUTCDate() - 1)
  }
  return streak
}

export async function loadGamificationSummary(client, studentId) {
  await ensureQuestInstances(client)
  const [totals, questRows, achievementRows, visitRows, activityRows] = await Promise.all([
    client.query(`SELECT xp_total FROM student_xp_totals WHERE student_id = $1`, [studentId]),
    client.query(
      `WITH bounds AS (
         SELECT (now() AT TIME ZONE 'Asia/Bishkek')::date AS today,
                date_trunc('week', now() AT TIME ZONE 'Asia/Bishkek')::date AS week_start
       )
       SELECT d.code, d.period, i.title, i.description, i.target_count, i.xp_reward,
              i.period_end, COALESCE(p.current_count, 0)::int AS current_count,
              p.id AS progress_id, p.ready_at, p.completed_at
         FROM quest_instances i
         JOIN quest_definitions d ON d.id = i.quest_definition_id
         CROSS JOIN bounds b
         LEFT JOIN student_quest_progress p ON p.quest_instance_id = i.id AND p.student_id = $1
        WHERE i.period_start = CASE WHEN d.period = 'daily' THEN b.today ELSE b.week_start END
        ORDER BY d.period, d.sort_order, d.code`,
      [studentId],
    ),
    client.query(
      `SELECT d.code, d.title, d.description, d.icon_key, a.unlocked_at
         FROM student_achievements a
         JOIN achievement_definitions d ON d.id = a.achievement_id
        WHERE a.student_id = $1
        ORDER BY a.unlocked_at DESC, d.sort_order ASC`,
      [studentId],
    ),
    client.query(
      `SELECT to_char((created_at AT TIME ZONE 'Asia/Bishkek')::date, 'YYYY-MM-DD') AS day,
              to_char((now() AT TIME ZONE 'Asia/Bishkek')::date, 'YYYY-MM-DD') AS today
         FROM gamification_events
        WHERE student_id = $1 AND event_type = 'platform_visit'
        ORDER BY day DESC LIMIT 370`,
      [studentId],
    ),
    client.query(
      `SELECT count(*) FILTER (WHERE event_type = 'lesson_completed')::int AS lessons_completed,
              count(*) FILTER (WHERE event_type = 'trainer_mastered')::int AS trainer_mastered,
              count(*) FILTER (WHERE event_type = 'daily_challenge_completed')::int AS daily_challenges
         FROM gamification_events WHERE student_id = $1`,
      [studentId],
    ),
  ])
  const xp = Number(totals.rows[0]?.xp_total ?? 0)
  const today = visitRows.rows[0]?.today ?? new Date().toISOString().slice(0, 10)
  return {
    xp,
    level: Math.floor(xp / 500) + 1,
    levelStartXp: Math.floor(xp / 500) * 500,
    levelEndXp: (Math.floor(xp / 500) + 1) * 500,
    streak: currentStreak(visitRows.rows.map(row => row.day), today),
    activity: {
      lessonsCompleted: Number(activityRows.rows[0]?.lessons_completed ?? 0),
      trainerMastered: Number(activityRows.rows[0]?.trainer_mastered ?? 0),
      dailyChallenges: Number(activityRows.rows[0]?.daily_challenges ?? 0),
    },
    pendingQuestRewards: questRows.rows.filter(row => row.ready_at && !row.completed_at).length,
    quests: questRows.rows.map(row => ({
      progressId: row.progress_id == null ? null : Number(row.progress_id),
      code: row.code,
      period: row.period,
      title: row.title,
      description: row.description,
      targetCount: Number(row.target_count),
      currentCount: Number(row.current_count),
      xpReward: Number(row.xp_reward),
      claimable: Boolean(row.ready_at && !row.completed_at),
      completedAt: row.completed_at ?? null,
      periodEnd: `${dateOnly(row.period_end)}T00:00:00+06:00`,
    })),
    achievements: achievementRows.rows.map(row => ({
      code: row.code,
      title: row.title,
      description: row.description,
      iconKey: row.icon_key,
      unlockedAt: row.unlocked_at,
    })),
  }
}

export function isGamificationPeriod(value) {
  return PERIODS.has(value)
}
