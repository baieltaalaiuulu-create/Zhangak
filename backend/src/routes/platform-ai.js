import { requireAuth } from '../auth.js'
import { completeAi } from '../ai.js'
import { query, transaction } from '../db.js'
import { GET, HttpError, POST, readJson } from '../http.js'
import { requireRole } from '../authorization.js'

const STUDENT_ROLES = ['student']

async function student(config, req) {
  const user = await requireRole(await requireAuth(config, req), STUDENT_ROLES)
  if (user.student_type !== 'online') {
    throw new HttpError(403, 'AI-коуч доступен только ученику онлайн-курса', 'online_student_required')
  }
  const enrollment = await query(
    `SELECT 1
       FROM active_course_enrollments ce
       JOIN courses c ON c.id = ce.course_id
      WHERE ce.student_id = $1
        AND ce.status = 'active'
        AND c.is_active = true
        AND c.delivery_mode = 'online'
      LIMIT 1`,
    [user.id],
  )
  if (enrollment.rowCount !== 1) {
    throw new HttpError(403, 'AI-коуч доступен после подтверждения онлайн-курса', 'ai_course_access_required')
  }
  return user
}
function exact(body, keys) { return body && typeof body === 'object' && !Array.isArray(body) && Object.keys(body).length === keys.length && keys.every(key => Object.hasOwn(body, key)) }

GET('/v1/platform/ai/consent', async ({ req, config }) => {
  const user = await student(config, req)
  const result = await query('SELECT accepted_at FROM ai_consents WHERE user_id = $1', [user.id])
  return { body: { accepted: !!result.rows[0]?.accepted_at } }
})

POST('/v1/platform/ai/consent', async ({ req, config }) => {
  const user = await student(config, req)
  const body = await readJson(req, 2_000)
  if (!exact(body, ['accepted']) || typeof body.accepted !== 'boolean') throw new HttpError(400, 'Некорректное согласие', 'invalid_ai_consent')
  await query(
    `INSERT INTO ai_consents (user_id, accepted_at, revoked_at) VALUES ($1, CASE WHEN $2 THEN now() ELSE NULL END, CASE WHEN $2 THEN NULL ELSE now() END)
     ON CONFLICT (user_id) DO UPDATE SET accepted_at = CASE WHEN $2 THEN now() ELSE NULL END, revoked_at = CASE WHEN $2 THEN NULL ELSE now() END, updated_at = now()`, [user.id, body.accepted],
  )
  return { body: { accepted: body.accepted } }
})

GET('/v1/platform/ai/messages', async ({ req, config }) => {
  const user = await student(config, req)
  const result = await query(`SELECT m.id, m.role, m.content, m.created_at FROM ai_messages m JOIN ai_conversations c ON c.id=m.conversation_id WHERE c.user_id=$1 ORDER BY m.created_at DESC, m.id DESC LIMIT 30`, [user.id])
  return { body: { items: result.rows.reverse().map(row => ({ id: Number(row.id), role: row.role, content: row.content, createdAt: row.created_at })) } }
})

POST('/v1/platform/ai/messages', async ({ req, config }) => {
  const user = await student(config, req)
  const body = await readJson(req, 16_000)
  if (!exact(body, ['message']) || typeof body.message !== 'string') throw new HttpError(400, 'Некорректное сообщение', 'invalid_ai_message')
  const message = body.message.trim()
  if (!message || message.length > 2000) throw new HttpError(400, 'Сообщение должно содержать от 1 до 2000 символов', 'invalid_ai_message')
  const consent = await query('SELECT accepted_at FROM ai_consents WHERE user_id=$1', [user.id])
  if (!consent.rows[0]?.accepted_at) throw new HttpError(403, 'Нужно согласие на обработку сообщения AI-коучем', 'ai_consent_required')
  const rate = await query(`SELECT count(*)::int count FROM ai_messages m JOIN ai_conversations c ON c.id=m.conversation_id WHERE c.user_id=$1 AND m.role='user' AND m.created_at > now() - interval '15 minutes'`, [user.id])
  if (Number(rate.rows[0].count) >= 8) throw new HttpError(429, 'Слишком много сообщений. Попробуйте через несколько минут.', 'ai_rate_limited')
  const saved = await transaction(async client => {
    const existing = await client.query('SELECT id FROM ai_conversations WHERE user_id=$1 ORDER BY updated_at DESC LIMIT 1 FOR UPDATE', [user.id])
    const conversationId = existing.rows[0]?.id ?? (await client.query('INSERT INTO ai_conversations (user_id) VALUES ($1) RETURNING id', [user.id])).rows[0].id
    await client.query(`INSERT INTO ai_messages (conversation_id, role, content) VALUES ($1,'user',$2)`, [conversationId, message])
    const history = await client.query(`SELECT role, content FROM ai_messages WHERE conversation_id=$1 ORDER BY created_at DESC,id DESC LIMIT 10`, [conversationId])
    return { conversationId, history: history.rows.reverse() }
  })
  const answer = await completeAi(config, saved.history)
  const result = await transaction(async client => {
    const inserted = await client.query(`INSERT INTO ai_messages (conversation_id, role, content, provider) VALUES ($1,'assistant',$2,$3) RETURNING id, role, content, created_at`, [saved.conversationId, answer, config.aiProvider])
    await client.query('UPDATE ai_conversations SET updated_at=now() WHERE id=$1', [saved.conversationId])
    return inserted.rows[0]
  })
  return { body: { message: { id: Number(result.id), role: result.role, content: result.content, createdAt: result.created_at } } }
})
