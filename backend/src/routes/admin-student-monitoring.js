import { requireAuth } from '../auth.js'
import { query } from '../db.js'
import { GET, HttpError } from '../http.js'
import { requireRole } from '../authorization.js'

const ADMIN_ROLES = ['admin', 'super_admin']
const ACCESS_STATES = new Set(['active', 'frozen', 'expired', 'pending', 'none'])

function integer(value, fallback, minimum, maximum) {
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : fallback
}

function accessState(row) {
  if (row.enrollment_id == null) return 'none'
  if (row.frozen_at) return 'frozen'
  if (row.enrollment_status === 'active' && row.access_expires_at && new Date(row.access_expires_at).getTime() <= Date.now()) return 'expired'
  if (row.enrollment_status === 'active') return 'active'
  return 'pending'
}

function publicStudent(row) {
  const state = accessState(row)
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    blocked: row.blocked,
    studentType: row.student_type,
    phone: row.phone,
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at,
    metrics: {
      xp: Number(row.xp),
      level: Math.floor(Number(row.xp) / 500) + 1,
      visits30d: Number(row.visits_30d),
      lessonsCompleted: Number(row.lessons_completed),
      practiceSubmitted: Number(row.practice_submitted),
      trainerMastered: Number(row.trainer_mastered),
      dailyChallenges: Number(row.daily_challenges),
      questsClaimed: Number(row.quests_claimed),
    },
    access: row.enrollment_id == null ? null : {
      enrollmentId: Number(row.enrollment_id),
      state,
      status: row.enrollment_status,
      plan: row.access_plan,
      courseName: row.course_name,
      startedAt: row.access_started_at,
      expiresAt: row.access_expires_at,
      frozenAt: row.frozen_at,
      freezeReason: row.freeze_reason,
    },
  }
}

GET('/v1/admin/student-monitoring', async ({ req, config, query: search }) => {
  requireRole(await requireAuth(config, req), ADMIN_ROLES)
  const limit = integer(search.get('limit'), 100, 1, 100)
  const offset = integer(search.get('offset'), 0, 0, 100_000)
  const phrase = String(search.get('q') ?? '').trim().slice(0, 100)
  const state = String(search.get('accessState') ?? '').trim()
  if (state && !ACCESS_STATES.has(state)) throw new HttpError(400, 'Некорректный фильтр доступа', 'invalid_access_state')

  const result = await query(
    `WITH students AS (
       SELECT u.id, u.email, u.blocked, u.created_at, p.full_name, p.student_type, p.phone
         FROM users u JOIN profiles p ON p.user_id = u.id
        WHERE p.role = 'student'
          AND ($1 = '' OR u.email ILIKE '%' || $1 || '%' OR p.full_name ILIKE '%' || $1 || '%' OR COALESCE(p.phone, '') ILIKE '%' || $1 || '%')
     ), current_enrollment AS (
       SELECT DISTINCT ON (e.student_id)
              e.student_id, e.id AS enrollment_id, e.status AS enrollment_status,
              e.access_plan, e.access_started_at, e.access_expires_at,
              e.frozen_at, e.freeze_reason, c.name AS course_name
         FROM course_enrollments e JOIN courses c ON c.id = e.course_id
        WHERE e.status IN ('awaiting_payment', 'awaiting_confirmation', 'active', 'suspended')
        ORDER BY e.student_id, e.updated_at DESC, e.id DESC
     ), session_activity AS (
       SELECT user_id, max(last_seen_at) AS last_seen_at
         FROM auth_sessions GROUP BY user_id
     ), activity AS (
       SELECT student_id,
              count(*) FILTER (WHERE event_type = 'platform_visit' AND created_at >= now() - interval '30 days')::int AS visits_30d,
              count(*) FILTER (WHERE event_type = 'lesson_completed')::int AS lessons_completed,
              count(*) FILTER (WHERE event_type = 'practice_submitted')::int AS practice_submitted,
              count(*) FILTER (WHERE event_type = 'trainer_mastered')::int AS trainer_mastered,
              count(*) FILTER (WHERE event_type = 'daily_challenge_completed')::int AS daily_challenges,
              count(*) FILTER (WHERE event_type IN ('daily_quest_completed', 'weekly_quest_completed'))::int AS quests_claimed
         FROM gamification_events GROUP BY student_id
     ), projected AS (
       SELECT s.*, ce.*, sa.last_seen_at, COALESCE(x.xp_total, 0)::int AS xp,
              COALESCE(a.visits_30d, 0)::int AS visits_30d,
              COALESCE(a.lessons_completed, 0)::int AS lessons_completed,
              COALESCE(a.practice_submitted, 0)::int AS practice_submitted,
              COALESCE(a.trainer_mastered, 0)::int AS trainer_mastered,
              COALESCE(a.daily_challenges, 0)::int AS daily_challenges,
              COALESCE(a.quests_claimed, 0)::int AS quests_claimed,
              CASE
                WHEN ce.enrollment_id IS NULL THEN 'none'
                WHEN ce.frozen_at IS NOT NULL THEN 'frozen'
                WHEN ce.enrollment_status = 'active' AND ce.access_expires_at <= now() THEN 'expired'
                WHEN ce.enrollment_status = 'active' THEN 'active'
                ELSE 'pending'
              END AS access_state
         FROM students s
         LEFT JOIN current_enrollment ce ON ce.student_id = s.id
         LEFT JOIN session_activity sa ON sa.user_id = s.id
         LEFT JOIN student_xp_totals x ON x.student_id = s.id
         LEFT JOIN activity a ON a.student_id = s.id
     )
     SELECT *, count(*) OVER()::int AS total
       FROM projected
      WHERE ($2 = '' OR access_state = $2)
      ORDER BY COALESCE(last_seen_at, created_at) DESC, id
      LIMIT $3 OFFSET $4`,
    [phrase, state, limit, offset],
  )
  return {
    status: 200,
    body: {
      items: result.rows.map(publicStudent),
      total: result.rows[0]?.total ?? 0,
      limit,
      offset,
    },
  }
})
