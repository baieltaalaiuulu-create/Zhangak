import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { parsePushSubscription } from '../src/routes/platform-push.js'
import { HttpError } from '../src/http.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const valid = {
  endpoint: 'https://push.example.test/subscriptions/device-1',
  expirationTime: null,
  keys: { p256dh: 'A'.repeat(64), auth: 'B'.repeat(16) },
  preferences: { lessonReminders: true, resultNotifications: false, announcementNotifications: true },
}

test('push subscription parser accepts only bounded HTTPS credentials and typed preferences', () => {
  assert.deepEqual(parsePushSubscription(valid), {
    endpoint: valid.endpoint,
    p256dh: valid.keys.p256dh,
    auth: valid.keys.auth,
    lessonReminders: true,
    resultNotifications: false,
    announcementNotifications: true,
  })
  for (const body of [
    { ...valid, endpoint: 'http://push.example.test/device' },
    { ...valid, userId: 'other-user' },
    { ...valid, keys: { ...valid.keys, p256dh: 'not base64+' } },
    { ...valid, preferences: { lessonReminders: 'yes' } },
  ]) {
    assert.throws(() => parsePushSubscription(body), error => error instanceof HttpError && error.status === 400)
  }
})

test('push routes bind subscriptions to current user session and protect delivery credentials', async () => {
  const [migration, route, server, reminder] = await Promise.all([
    readFile(path.join(root, 'migrations', '014_push_notifications.sql'), 'utf8'),
    readFile(path.join(root, 'src', 'routes', 'platform-push.js'), 'utf8'),
    readFile(path.join(root, 'src', 'server.js'), 'utf8'),
    readFile(path.join(root, 'scripts', 'send-study-reminders.js'), 'utf8'),
  ])
  assert.match(server, /platform-push\.js/)
  assert.match(migration, /session_id uuid NOT NULL REFERENCES auth_sessions/)
  assert.match(migration, /endpoint_hash bytea NOT NULL UNIQUE/)
  assert.match(route, /await requireAuth\(config, req\)/)
  assert.match(route, /student\.sessionId/)
  assert.match(route, /POST\('\/v1\/platform\/push\/subscriptions'/)
  assert.match(route, /DELETE\('\/v1\/platform\/push\/subscriptions'/)
  assert.match(route, /POST\('\/v1\/platform\/push\/test'/)
  assert.doesNotMatch(route, /privateKey|VAPID_PRIVATE_KEY/)
  assert.match(reminder, /JOIN auth_sessions/)
  assert.match(reminder, /last_reminder_at/)
})

