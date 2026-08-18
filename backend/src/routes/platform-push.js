import { createHash } from 'node:crypto'

import { requireAuth } from '../auth.js'
import { query, transaction } from '../db.js'
import { DELETE, GET, HttpError, POST, readJson } from '../http.js'
import { expiredPushEndpoint, pushEnabled, sendPush } from '../push.js'

const STUDENT_ROLES = new Set(['student', 'math_student'])
const BASE64URL = /^[A-Za-z0-9_-]+={0,2}$/
const PREFERENCE_KEYS = ['lessonReminders', 'resultNotifications', 'announcementNotifications']

async function currentStudent(config, req) {
  const user = await requireAuth(config, req)
  if (!STUDENT_ROLES.has(user.role)) throw new HttpError(403, 'Доступен только ученику', 'student_required')
  return user
}

function exactKeys(value, allowed) {
  return Object.keys(value).every(key => allowed.includes(key))
}

function preference(value, key, fallback = true) {
  if (!Object.hasOwn(value, key)) return fallback
  if (typeof value[key] !== 'boolean') throw new HttpError(400, 'Некорректные настройки уведомлений', 'invalid_push_preferences')
  return value[key]
}

export function parsePushSubscription(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)
      || !exactKeys(body, ['endpoint', 'expirationTime', 'keys', 'preferences'])) {
    throw new HttpError(400, 'Некорректная push-подписка', 'invalid_push_subscription')
  }
  if (typeof body.endpoint !== 'string' || body.endpoint.length < 16 || body.endpoint.length > 2_048) {
    throw new HttpError(400, 'Некорректная push-подписка', 'invalid_push_subscription')
  }
  try {
    const endpoint = new URL(body.endpoint)
    if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password) throw new Error('HTTPS required')
  } catch {
    throw new HttpError(400, 'Некорректная push-подписка', 'invalid_push_subscription')
  }
  if (body.expirationTime !== null && body.expirationTime !== undefined && !Number.isSafeInteger(body.expirationTime)) {
    throw new HttpError(400, 'Некорректная push-подписка', 'invalid_push_subscription')
  }
  if (!body.keys || typeof body.keys !== 'object' || Array.isArray(body.keys)
      || !exactKeys(body.keys, ['p256dh', 'auth'])) {
    throw new HttpError(400, 'Некорректная push-подписка', 'invalid_push_subscription')
  }
  const p256dh = body.keys.p256dh
  const auth = body.keys.auth
  if (typeof p256dh !== 'string' || p256dh.length < 32 || p256dh.length > 256 || !BASE64URL.test(p256dh)
      || typeof auth !== 'string' || auth.length < 8 || auth.length > 128 || !BASE64URL.test(auth)) {
    throw new HttpError(400, 'Некорректная push-подписка', 'invalid_push_subscription')
  }
  const preferences = body.preferences ?? {}
  if (!preferences || typeof preferences !== 'object' || Array.isArray(preferences)
      || !exactKeys(preferences, PREFERENCE_KEYS)) {
    throw new HttpError(400, 'Некорректные настройки уведомлений', 'invalid_push_preferences')
  }
  return {
    endpoint: body.endpoint,
    p256dh,
    auth,
    lessonReminders: preference(preferences, 'lessonReminders'),
    resultNotifications: preference(preferences, 'resultNotifications'),
    announcementNotifications: preference(preferences, 'announcementNotifications'),
  }
}

function parseEndpoint(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || !exactKeys(body, ['endpoint'])
      || typeof body.endpoint !== 'string' || body.endpoint.length > 2_048) {
    throw new HttpError(400, 'Некорректная push-подписка', 'invalid_push_subscription')
  }
  return body.endpoint
}

function endpointHash(endpoint) {
  return createHash('sha256').update(endpoint).digest()
}

GET('/v1/platform/push/config', async ({ req, config }) => {
  const student = await currentStudent(config, req)
  const status = await query(
    `SELECT lesson_reminders, result_notifications, announcement_notifications
       FROM push_subscriptions
      WHERE user_id=$1 AND session_id=$2 AND revoked_at IS NULL
      ORDER BY updated_at DESC LIMIT 1`,
    [student.id, student.sessionId],
  )
  const row = status.rows[0]
  return {
    status: 200,
    body: {
      enabled: pushEnabled(config),
      publicKey: pushEnabled(config) ? config.vapidPublicKey : null,
      subscribed: Boolean(row),
      preferences: {
        lessonReminders: row?.lesson_reminders ?? true,
        resultNotifications: row?.result_notifications ?? true,
        announcementNotifications: row?.announcement_notifications ?? true,
      },
    },
  }
})

POST('/v1/platform/push/subscriptions', async ({ req, config }) => {
  const student = await currentStudent(config, req)
  if (!pushEnabled(config)) throw new HttpError(503, 'Push-уведомления временно недоступны', 'push_not_configured')
  const subscription = parsePushSubscription(await readJson(req, 12_000))
  await transaction(async client => {
    const result = await client.query(
      `INSERT INTO push_subscriptions
        (user_id, session_id, endpoint, endpoint_hash, p256dh, auth_secret, user_agent,
         lesson_reminders, result_notifications, announcement_notifications)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (endpoint_hash) DO UPDATE SET
         user_id=EXCLUDED.user_id, session_id=EXCLUDED.session_id, endpoint=EXCLUDED.endpoint,
         p256dh=EXCLUDED.p256dh, auth_secret=EXCLUDED.auth_secret, user_agent=EXCLUDED.user_agent,
         lesson_reminders=EXCLUDED.lesson_reminders,
         result_notifications=EXCLUDED.result_notifications,
         announcement_notifications=EXCLUDED.announcement_notifications,
         revoked_at=NULL, updated_at=now()
       RETURNING id`,
      [student.id, student.sessionId, subscription.endpoint, endpointHash(subscription.endpoint),
        subscription.p256dh, subscription.auth, String(req.headers['user-agent'] ?? '').slice(0, 500) || null,
        subscription.lessonReminders, subscription.resultNotifications, subscription.announcementNotifications],
    )
    await client.query(
      `INSERT INTO audit_log (actor_user_id, action, target_type, target_id, metadata)
       VALUES ($1,'enable_push_notifications','push_subscription',$2,$3::jsonb)`,
      [student.id, result.rows[0].id, JSON.stringify({ preferences: PREFERENCE_KEYS.filter(key => subscription[key]) })],
    )
  })
  return { status: 200, body: { subscribed: true } }
})

DELETE('/v1/platform/push/subscriptions', async ({ req, config }) => {
  const student = await currentStudent(config, req)
  const endpoint = parseEndpoint(await readJson(req, 4_000))
  await query(
    `UPDATE push_subscriptions SET revoked_at=COALESCE(revoked_at,now()), updated_at=now()
      WHERE user_id=$1 AND session_id=$2 AND endpoint_hash=$3 AND endpoint=$4`,
    [student.id, student.sessionId, endpointHash(endpoint), endpoint],
  )
  return { status: 200, body: { subscribed: false } }
})

POST('/v1/platform/push/test', async ({ req, config }) => {
  const student = await currentStudent(config, req)
  if (!pushEnabled(config)) throw new HttpError(503, 'Push-уведомления временно недоступны', 'push_not_configured')
  const subscriptions = await query(
    `SELECT id, endpoint, p256dh, auth_secret, last_tested_at
       FROM push_subscriptions
      WHERE user_id=$1 AND session_id=$2 AND revoked_at IS NULL`,
    [student.id, student.sessionId],
  )
  if (subscriptions.rows.length === 0) throw new HttpError(409, 'Сначала включите уведомления', 'push_subscription_required')
  if (subscriptions.rows.some(row => row.last_tested_at && Date.now() - new Date(row.last_tested_at).getTime() < 60_000)) {
    throw new HttpError(429, 'Повторите проверку через минуту', 'push_test_rate_limited')
  }

  let delivered = 0
  for (const subscription of subscriptions.rows) {
    try {
      await sendPush(config, subscription, {
        title: 'Жангак готов к занятиям',
        body: 'Push-уведомления работают. Вернитесь к следующему шагу roadmap.',
        url: '/student/online/roadmap',
        tag: 'push-test',
      })
      delivered += 1
      await query('UPDATE push_subscriptions SET last_tested_at=now(), updated_at=now() WHERE id=$1', [subscription.id])
    } catch (error) {
      if (expiredPushEndpoint(error)) {
        await query('UPDATE push_subscriptions SET revoked_at=now(), updated_at=now() WHERE id=$1', [subscription.id])
      } else {
        console.error('Push test delivery failed', { subscriptionId: subscription.id, error })
      }
    }
  }
  if (delivered === 0) throw new HttpError(502, 'Не удалось доставить уведомление', 'push_delivery_failed')
  return { status: 200, body: { delivered } }
})

