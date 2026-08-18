import assert from 'node:assert/strict'
import test from 'node:test'

import { decodeApplicationServerKey, parsePushConfig } from '../../lib/platform-push.ts'

test('push config parser fails closed and preserves notification preferences', () => {
  assert.deepEqual(parsePushConfig({
    enabled: true,
    publicKey: 'public-key',
    subscribed: false,
    preferences: { lessonReminders: true, resultNotifications: false, announcementNotifications: true },
  }), {
    enabled: true,
    publicKey: 'public-key',
    subscribed: false,
    preferences: { lessonReminders: true, resultNotifications: false, announcementNotifications: true },
  })
  assert.throws(() => parsePushConfig({ enabled: 'yes', preferences: {} }))
})

test('VAPID public key decoder accepts URL-safe base64', () => {
  globalThis.window = { atob } as unknown as Window & typeof globalThis
  const decoded = decodeApplicationServerKey('AQIDBA')
  assert.deepEqual([...decoded], [1, 2, 3, 4])
  delete (globalThis as { window?: unknown }).window
})

