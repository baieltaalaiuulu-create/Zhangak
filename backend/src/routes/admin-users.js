import { requireAuth } from '../auth.js'
import {
  ACCOUNT_CREATOR_ROLES,
  ACCOUNT_MANAGER_ROLES,
  canCreateAccount,
  canManageAccount,
  isAccountRole,
  requireRole,
  visibleAccountRoles,
} from '../authorization.js'
import { query as dbQuery, transaction } from '../db.js'
import { DELETE, GET, HttpError, PATCH, POST, readJson } from '../http.js'
import { hashPassword } from '../security.js'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function exactBody(body, required, optional = []) {
  const keys = Object.keys(body)
  const allowed = new Set([...required, ...optional])
  return required.every(key => Object.hasOwn(body, key)) && keys.every(key => allowed.has(key))
}

function normalizeEmail(value) {
  if (typeof value !== 'string') return null
  const email = value.trim().toLowerCase()
  return email.length >= 3 && email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null
}

function normalizedString(value, maxLength, nullable = false) {
  if (value == null && nullable) return null
  if (typeof value !== 'string') return undefined
  const text = value.trim()
  if ((!text && !nullable) || text.length > maxLength) return undefined
  return text || null
}

function parseInteger(value, fallback, min, max) {
  if (value == null || value === '') return fallback
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) throw new HttpError(400, 'Некорректная пагинация', 'invalid_pagination')
  return parsed
}

function publicAccount(row) {
  return {
    id: row.id,
    email: row.email,
    blocked: row.blocked,
    fullName: row.full_name,
    role: row.role,
    studentType: row.student_type,
    phone: row.phone,
    targetScore: row.target_score,
    avatarUrl: row.avatar_url,
    createdAt: row.created_at,
  }
}

async function actor(config, req, roles) {
  return requireRole(await requireAuth(config, req), roles)
}

async function manageableTarget(client, currentActor, targetId) {
  if (!UUID_PATTERN.test(targetId)) throw new HttpError(400, 'Некорректный id', 'invalid_user_id')
  if (targetId === currentActor.id) throw new HttpError(400, 'Нельзя изменить собственный аккаунт', 'self_management_forbidden')
  const result = await client.query(
    `SELECT u.id, u.email, p.role
       FROM users u JOIN profiles p ON p.user_id = u.id
      WHERE u.id = $1
      FOR UPDATE OF u, p`,
    [targetId],
  )
  const target = result.rows[0]
  if (!target) throw new HttpError(404, 'Пользователь не найден', 'user_not_found')
  if (!canManageAccount(currentActor.role, target.role)) throw new HttpError(403, 'Доступ запрещён', 'forbidden')
  return target
}

async function audit(client, currentActor, action, targetId, metadata = {}) {
  await client.query(
    `INSERT INTO audit_log (actor_user_id, action, target_type, target_id, metadata)
     VALUES ($1, $2, 'user', $3, $4::jsonb)`,
    [currentActor.id, action, targetId, JSON.stringify(metadata)],
  )
}

GET('/v1/admin/users', async ({ req, config, query: searchParams }) => {
  const currentActor = await actor(config, req, ACCOUNT_MANAGER_ROLES)
  const limit = parseInteger(searchParams.get('limit'), 50, 1, 100)
  const offset = parseInteger(searchParams.get('offset'), 0, 0, 100_000)
  const search = String(searchParams.get('q') ?? '').trim().slice(0, 100)
  const visibleRoles = visibleAccountRoles(currentActor.role)
  const result = await dbQuery(
    `SELECT u.id, u.email, u.blocked, u.created_at,
            p.full_name, p.role, p.student_type, p.phone, p.target_score, p.avatar_url,
            count(*) OVER()::int AS total
       FROM users u JOIN profiles p ON p.user_id = u.id
      WHERE ($1::text[] IS NULL OR p.role = ANY($1::text[]))
        AND ($2 = '' OR u.email ILIKE '%' || $2 || '%' OR p.full_name ILIKE '%' || $2 || '%')
      ORDER BY u.created_at DESC, u.id
      LIMIT $3 OFFSET $4`,
    [visibleRoles, search, limit, offset],
  )
  return {
    status: 200,
    body: {
      items: result.rows.map(publicAccount),
      total: result.rows[0]?.total ?? 0,
      limit,
      offset,
    },
  }
})

POST('/v1/admin/users', async ({ req, config }) => {
  const currentActor = await actor(config, req, ACCOUNT_CREATOR_ROLES)
  const body = await readJson(req, 16_000)
  if (!exactBody(body, ['email', 'password', 'fullName', 'role'], ['studentType', 'phone', 'targetScore'])) {
    throw new HttpError(400, 'Некорректные данные', 'invalid_user')
  }

  const email = normalizeEmail(body.email)
  const fullName = normalizedString(body.fullName, 200)
  const phone = normalizedString(body.phone, 50, true)
  const role = body.role
  const studentType = body.studentType == null ? null : body.studentType
  const targetScore = body.targetScore == null ? null : body.targetScore
  if (!email || !fullName || phone === undefined || !isAccountRole(role) || !canCreateAccount(currentActor.role, role)) {
    throw new HttpError(400, 'Некорректные данные или роль', 'invalid_user')
  }
  if (role === 'student' && !['online', 'offline', 'both'].includes(studentType)) {
    throw new HttpError(400, 'Для ученика требуется тип обучения', 'invalid_student_type')
  }
  if (role !== 'student' && studentType !== null) throw new HttpError(400, 'Тип обучения доступен только ученику', 'invalid_student_type')
  if (targetScore !== null && (!Number.isSafeInteger(targetScore) || targetScore < 0 || targetScore > 245)) {
    throw new HttpError(400, 'Некорректный целевой балл', 'invalid_target_score')
  }
  if (typeof body.password !== 'string' || body.password.length < 10 || body.password.length > 200) {
    throw new HttpError(400, 'Пароль должен содержать от 10 до 200 символов', 'invalid_password')
  }

  const passwordHash = await hashPassword(body.password)
  try {
    const created = await transaction(async client => {
      const inserted = await client.query(
        'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id',
        [email, passwordHash],
      )
      const userId = inserted.rows[0].id
      await client.query(
        `INSERT INTO profiles (user_id, full_name, role, student_type, phone, target_score)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [userId, fullName, role, studentType, phone, targetScore],
      )
      await audit(client, currentActor, 'create_user', userId, { role })
      return userId
    })
    return { status: 201, body: { id: created } }
  } catch (error) {
    if (error?.code === '23505') throw new HttpError(409, 'Пользователь уже существует', 'email_conflict')
    throw error
  }
})

PATCH('/v1/admin/users/:id/block', async ({ req, params, config }) => {
  const currentActor = await actor(config, req, ACCOUNT_MANAGER_ROLES)
  const body = await readJson(req, 4_000)
  if (!exactBody(body, ['blocked']) || typeof body.blocked !== 'boolean') {
    throw new HttpError(400, 'Требуется blocked', 'invalid_block_state')
  }
  await transaction(async client => {
    const target = await manageableTarget(client, currentActor, params.id)
    await client.query(
      `UPDATE users SET blocked = $2, session_version = session_version + 1, updated_at = now()
        WHERE id = $1`,
      [target.id, body.blocked],
    )
    await client.query('UPDATE auth_sessions SET revoked_at = COALESCE(revoked_at, now()) WHERE user_id = $1', [target.id])
    await audit(client, currentActor, body.blocked ? 'block_user' : 'unblock_user', target.id)
  })
  return { status: 200, body: { success: true } }
})

PATCH('/v1/admin/users/:id/password', async ({ req, params, config }) => {
  const currentActor = await actor(config, req, ACCOUNT_MANAGER_ROLES)
  const body = await readJson(req, 8_000)
  if (!exactBody(body, ['password']) || typeof body.password !== 'string' || body.password.length < 10 || body.password.length > 200) {
    throw new HttpError(400, 'Пароль должен содержать от 10 до 200 символов', 'invalid_password')
  }
  const passwordHash = await hashPassword(body.password)
  await transaction(async client => {
    const target = await manageableTarget(client, currentActor, params.id)
    await client.query(
      `UPDATE users SET password_hash = $2, session_version = session_version + 1, updated_at = now()
        WHERE id = $1`,
      [target.id, passwordHash],
    )
    await client.query('UPDATE auth_sessions SET revoked_at = COALESCE(revoked_at, now()) WHERE user_id = $1', [target.id])
    await audit(client, currentActor, 'reset_user_password', target.id)
  })
  return { status: 200, body: { success: true } }
})

DELETE('/v1/admin/users/:id', async ({ req, params, config }) => {
  const currentActor = await actor(config, req, ACCOUNT_MANAGER_ROLES)
  await transaction(async client => {
    const target = await manageableTarget(client, currentActor, params.id)
    await audit(client, currentActor, 'delete_user', target.id, { role: target.role })
    await client.query('DELETE FROM users WHERE id = $1', [target.id])
  })
  return { status: 200, body: { success: true } }
})
