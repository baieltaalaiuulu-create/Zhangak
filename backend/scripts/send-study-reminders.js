import { loadConfig } from '../src/config.js'
import { closeDatabase, connectDatabase, query } from '../src/db.js'
import { expiredPushEndpoint, pushEnabled, sendPush } from '../src/push.js'

const config = loadConfig()
if (!pushEnabled(config)) throw new Error('Web Push is not configured')
connectDatabase(config)

let delivered = 0
let expired = 0
let failed = 0

try {
  const result = await query(
    `SELECT ps.id, ps.endpoint, ps.p256dh, ps.auth_secret
       FROM push_subscriptions ps
       JOIN users u ON u.id=ps.user_id AND u.blocked=false
       JOIN auth_sessions s ON s.id=ps.session_id AND s.user_id=ps.user_id
        AND s.revoked_at IS NULL AND s.expires_at > now()
      WHERE ps.revoked_at IS NULL
        AND ps.lesson_reminders=true
        AND (ps.last_reminder_at IS NULL
             OR (ps.last_reminder_at AT TIME ZONE 'Asia/Bishkek')::date
                < (now() AT TIME ZONE 'Asia/Bishkek')::date)
      ORDER BY ps.updated_at ASC
      LIMIT 500`,
  )

  for (const subscription of result.rows) {
    try {
      await sendPush(config, subscription, {
        title: 'Пора сделать шаг вперёд',
        body: 'Продолжите свой roadmap в Жангак — даже один урок сегодня важен.',
        url: '/student/online/roadmap',
        tag: 'daily-study-reminder',
      })
      await query('UPDATE push_subscriptions SET last_reminder_at=now(), updated_at=now() WHERE id=$1', [subscription.id])
      delivered += 1
    } catch (error) {
      if (expiredPushEndpoint(error)) {
        await query('UPDATE push_subscriptions SET revoked_at=now(), updated_at=now() WHERE id=$1', [subscription.id])
        expired += 1
      } else {
        failed += 1
        console.error('Study reminder delivery failed', { subscriptionId: subscription.id, error })
      }
    }
  }
} finally {
  await closeDatabase()
}

console.log(JSON.stringify({ event: 'study_reminders_complete', delivered, expired, failed }))
if (failed > 0) process.exitCode = 1

