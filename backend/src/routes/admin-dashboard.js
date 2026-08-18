import { requireAuth } from '../auth.js'
import { isSuperAdmin, requireRole } from '../authorization.js'
import { query } from '../db.js'
import { GET, HttpError } from '../http.js'

const FULL_ADMIN_ROLES = ['admin', 'super_admin']
const RECENT_LIMIT = 8
const ATTEMPT_TYPES = new Set(['practice', 'mock', 'bank', 'diagnostic'])
const AUDIT_TARGETS = new Map([
  ['create_user', 'user'],
  ['block_user', 'user'],
  ['unblock_user', 'user'],
  ['reset_user_password', 'user'],
  ['delete_user', 'user'],
  ['create_course', 'course'],
  ['update_course', 'course'],
  ['create_lesson', 'lesson'],
  ['update_lesson', 'lesson'],
])

function invalid(field) {
  throw new HttpError(500, `Некорректные данные: ${field}`, 'invalid_admin_dashboard')
}

function text(value, field, maxLength = 500) {
  if (typeof value !== 'string' || !value.trim() || value.length > maxLength) invalid(field)
  return value.trim()
}

function count(value, field) {
  const number = Number(value)
  if (!Number.isSafeInteger(number) || number < 0) invalid(field)
  return number
}

function scorePercent(value) {
  const number = Number(value)
  if (!Number.isSafeInteger(number) || number < 0 || number > 100) invalid('score_percent')
  return number
}

function timestamp(value, field) {
  const date = value instanceof Date ? value : new Date(String(value))
  if (Number.isNaN(date.getTime())) invalid(field)
  return date.toISOString()
}

function uuid(value, field) {
  const result = text(value, field, 36)
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(result)) invalid(field)
  return result
}

/** The mounted admin overview is only available to full administrators. */
export function requireDashboardAdmin(user) {
  return requireRole(user, FULL_ADMIN_ROLES)
}

/** Convert count-only dashboard totals from the first-party PostgreSQL schema. */
export function publicDashboardMetrics(row) {
  return {
    totalStudents: count(row.total_students, 'total_students'),
    newStudentsLast7Days: count(row.new_students_last_7_days, 'new_students_last_7_days'),
    lessonCount: count(row.lesson_count, 'lesson_count'),
    newLessonsLast7Days: count(row.new_lessons_last_7_days, 'new_lessons_last_7_days'),
    submittedAttemptCount: count(row.submitted_attempt_count, 'submitted_attempt_count'),
    submittedAttemptCountToday: count(row.submitted_attempt_count_today, 'submitted_attempt_count_today'),
  }
}

/** A submitted attempt is safe for an administrator summary; it contains no answer key or answer choices. */
export function publicDashboardAttempt(row) {
  const testType = text(row.test_type, 'test_type', 32)
  if (!ATTEMPT_TYPES.has(testType)) invalid('test_type')
  return {
    id: uuid(row.id, 'attempt_id'),
    studentName: text(row.student_name, 'student_name', 200),
    testTitle: text(row.test_title, 'test_title', 500),
    testType,
    scorePercent: scorePercent(row.score_percent),
    completedAt: timestamp(row.submitted_at, 'submitted_at'),
  }
}

/** Audit records are reduced to a whitelisted, metadata-free feed for the overview. */
export function publicDashboardAudit(row) {
  const action = text(row.action, 'audit_action', 80)
  const targetType = text(row.target_type, 'audit_target_type', 80)
  if (AUDIT_TARGETS.get(action) !== targetType) invalid('audit_action')
  return {
    id: count(row.id, 'audit_id'),
    action,
    targetType,
    createdAt: timestamp(row.created_at, 'audit_created_at'),
  }
}

GET('/v1/admin/dashboard', async ({ req, config }) => {
  const currentAdmin = requireDashboardAdmin(await requireAuth(config, req))
  const auditAvailable = isSuperAdmin(currentAdmin.role)

  // There is no owned request/event telemetry or payment ledger yet.  The
  // overview deliberately does not invent "active today", revenue, or other
  // legacy-only metrics.  Every value below is derived from our PostgreSQL
  // tables, and empty arrays/counts remain real empty/zero values.
  const [metricsResult, attemptsResult, auditResult] = await Promise.all([
    query(
      `SELECT
         (SELECT count(*)::int
            FROM users u
            JOIN profiles p ON p.user_id = u.id
           WHERE p.role IN ('student', 'math_student')) AS total_students,
         (SELECT count(*)::int
            FROM users u
            JOIN profiles p ON p.user_id = u.id
           WHERE p.role IN ('student', 'math_student')
             AND p.created_at >= now() - interval '7 days') AS new_students_last_7_days,
         (SELECT count(*)::int FROM lessons) AS lesson_count,
         (SELECT count(*)::int
            FROM lessons
           WHERE created_at >= now() - interval '7 days') AS new_lessons_last_7_days,
         (SELECT count(*)::int
            FROM practice_attempts
           WHERE status = 'submitted') AS submitted_attempt_count,
         (SELECT count(*)::int
            FROM practice_attempts
           WHERE status = 'submitted'
             AND submitted_at >= (
               date_trunc('day', now() AT TIME ZONE 'Asia/Bishkek') AT TIME ZONE 'Asia/Bishkek'
             )) AS submitted_attempt_count_today`,
    ),
    query(
      `SELECT a.id::text, p.full_name AS student_name, a.test_title, a.test_type,
              round(a.score_percent)::int AS score_percent, a.submitted_at
         FROM practice_attempts a
         JOIN profiles p ON p.user_id = a.student_id
        WHERE a.status = 'submitted'
          AND a.submitted_at IS NOT NULL
        ORDER BY a.submitted_at DESC, a.id DESC
        LIMIT $1`,
      [RECENT_LIMIT],
    ),
    auditAvailable
      ? query(
        `SELECT id, action, target_type, created_at
           FROM audit_log
          WHERE action = ANY($1::text[])
            AND target_id IS NOT NULL
          ORDER BY created_at DESC, id DESC
          LIMIT $2`,
        [Array.from(AUDIT_TARGETS.keys()), RECENT_LIMIT],
      )
      : Promise.resolve({ rows: [] }),
  ])

  const metricsRow = metricsResult.rows[0]
  if (!metricsRow) invalid('dashboard_metrics')
  return {
    status: 200,
    headers: { 'Cache-Control': 'private, no-store' },
    body: {
      metrics: publicDashboardMetrics(metricsRow),
      // Explicitly expose unavailable domains so a browser cannot mistake an
      // absent value for zero actual activity or zero revenue.
      availability: {
        dailyActiveStudents: false,
        payments: false,
        auditFeed: auditAvailable,
      },
      recentAttempts: attemptsResult.rows.map(publicDashboardAttempt),
      recentChanges: auditResult.rows.map(publicDashboardAudit),
    },
  }
})
