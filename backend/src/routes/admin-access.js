import { requireAuth } from '../auth.js'
import { isAccountRole, requireSuperAdmin } from '../authorization.js'
import { query } from '../db.js'
import { GET, HttpError } from '../http.js'

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 100

function parseInteger(value, fallback, min, max) {
  if (value == null || value === '') return fallback
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    throw new HttpError(400, 'Некорректная пагинация', 'invalid_pagination')
  }
  return parsed
}

function requiredText(value, field, maxLength) {
  if (typeof value !== 'string' || !value.trim() || value.length > maxLength) {
    throw new HttpError(500, `Некорректные данные: ${field}`, 'invalid_admin_audit')
  }
  return value.trim()
}

function positiveInteger(value, field) {
  const result = Number(value)
  if (!Number.isSafeInteger(result) || result < 1) {
    throw new HttpError(500, `Некорректные данные: ${field}`, 'invalid_admin_audit')
  }
  return result
}

function nonNegativeInteger(value, field) {
  const result = Number(value)
  if (!Number.isSafeInteger(result) || result < 0) {
    throw new HttpError(500, `Некорректные данные: ${field}`, 'invalid_admin_audit')
  }
  return result
}

function timestamp(value, field) {
  const date = value instanceof Date ? value : new Date(String(value))
  if (Number.isNaN(date.getTime())) {
    throw new HttpError(500, `Некорректные данные: ${field}`, 'invalid_admin_audit')
  }
  return date.toISOString()
}

/**
 * Metadata often contains operational details, so the browser audit feed is
 * intentionally a compact, structured projection. It proves what changed
 * and who performed it without turning the audit table into a data export.
 */
export function publicAdminAuditRow(row) {
  const actorName = row.actor_full_name == null
    ? null
    : requiredText(row.actor_full_name, 'actor_full_name', 200)
  const actorRole = row.actor_role == null
    ? null
    : requiredText(row.actor_role, 'actor_role', 40)
  if ((actorName === null) !== (actorRole === null) || (actorRole !== null && !isAccountRole(actorRole))) {
    throw new HttpError(500, 'Некорректные данные: actor', 'invalid_admin_audit')
  }
  return {
    id: positiveInteger(row.id, 'audit_id'),
    action: requiredText(row.action, 'action', 80),
    targetType: requiredText(row.target_type, 'target_type', 80),
    actorName,
    actorRole,
    createdAt: timestamp(row.created_at, 'created_at'),
  }
}

/** The full audit feed is a super-admin-only accountability capability. */
GET('/v1/admin/audit', async ({ req, config, query: searchParams }) => {
  requireSuperAdmin(await requireAuth(config, req))
  const limit = parseInteger(searchParams.get('limit'), DEFAULT_LIMIT, 1, MAX_LIMIT)
  const offset = parseInteger(searchParams.get('offset'), 0, 0, 100_000)
  const [result, totalResult] = await Promise.all([
    query(
      `SELECT a.id, a.action, a.target_type, a.created_at,
              actor_profile.full_name AS actor_full_name,
              actor_profile.role AS actor_role
         FROM audit_log a
         LEFT JOIN profiles actor_profile ON actor_profile.user_id = a.actor_user_id
        ORDER BY a.created_at DESC, a.id DESC
        LIMIT $1 OFFSET $2`,
      [limit, offset],
    ),
    query('SELECT count(*)::int AS total FROM audit_log'),
  ])
  return {
    status: 200,
    headers: { 'Cache-Control': 'private, no-store' },
    body: {
      items: result.rows.map(publicAdminAuditRow),
      total: nonNegativeInteger(totalResult.rows[0]?.total ?? 0, 'total'),
      limit,
      offset,
    },
  }
})
