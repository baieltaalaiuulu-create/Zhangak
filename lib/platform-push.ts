'use client'

import { zhangakApiJson, zhangakApiRequest } from './zhangak-api-client.ts'

export interface PushPreferences {
  lessonReminders: boolean
  resultNotifications: boolean
  announcementNotifications: boolean
}

export interface PushConfig {
  enabled: boolean
  publicKey: string | null
  subscribed: boolean
  preferences: PushPreferences
}

function boolean(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`Invalid ${field}`)
  return value
}

export function parsePushConfig(value: unknown): PushConfig {
  if (!value || typeof value !== 'object') throw new Error('Invalid push config')
  const row = value as Record<string, unknown>
  const preferences = row.preferences as Record<string, unknown> | null
  if (!preferences || typeof preferences !== 'object') throw new Error('Invalid push preferences')
  if (row.publicKey !== null && typeof row.publicKey !== 'string') throw new Error('Invalid VAPID public key')
  return {
    enabled: boolean(row.enabled, 'enabled'),
    publicKey: row.publicKey as string | null,
    subscribed: boolean(row.subscribed, 'subscribed'),
    preferences: {
      lessonReminders: boolean(preferences.lessonReminders, 'lessonReminders'),
      resultNotifications: boolean(preferences.resultNotifications, 'resultNotifications'),
      announcementNotifications: boolean(preferences.announcementNotifications, 'announcementNotifications'),
    },
  }
}

export async function loadPushConfig(): Promise<PushConfig> {
  return parsePushConfig(await zhangakApiRequest('/v1/platform/push/config'))
}

export async function savePushSubscription(subscription: PushSubscription, preferences: PushPreferences): Promise<void> {
  const serialized = subscription.toJSON()
  if (!serialized.endpoint || !serialized.keys?.p256dh || !serialized.keys.auth) throw new Error('Incomplete push subscription')
  await zhangakApiJson('/v1/platform/push/subscriptions', 'POST', {
    endpoint: serialized.endpoint,
    expirationTime: serialized.expirationTime ?? null,
    keys: serialized.keys,
    preferences,
  })
}

export async function removePushSubscription(subscription: PushSubscription): Promise<void> {
  await zhangakApiJson('/v1/platform/push/subscriptions', 'DELETE', { endpoint: subscription.endpoint })
}

export async function sendTestPush(): Promise<number> {
  const result = await zhangakApiJson<{ delivered: number }>('/v1/platform/push/test', 'POST')
  return result.delivered
}

export function decodeApplicationServerKey(value: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - value.length % 4) % 4)
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  return Uint8Array.from(raw, character => character.charCodeAt(0))
}
