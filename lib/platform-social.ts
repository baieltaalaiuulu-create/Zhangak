'use client'

import { ZhangakApiError, zhangakApiJson, zhangakApiRequest } from './zhangak-api-client.ts'

export interface SocialPerson {
  friendshipId: string
  publicProfileId: string
  displayName: string
  profileColor: 'blue' | 'violet' | 'emerald' | 'rose'
  xp: number
  status: 'pending' | 'accepted'
  createdAt: string
  incoming?: boolean
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ZhangakApiError('Некорректный ответ сервиса дружбы', 502, 'invalid_response')
  return value as Record<string, unknown>
}

function person(value: unknown, requests = false): SocialPerson {
  const item = record(value)
  if (typeof item.friendshipId !== 'string' || typeof item.publicProfileId !== 'string' || typeof item.displayName !== 'string'
    || !['blue', 'violet', 'emerald', 'rose'].includes(String(item.profileColor))
    || !Number.isSafeInteger(item.xp) || (item.xp as number) < 0 || !['pending', 'accepted'].includes(String(item.status))
    || typeof item.createdAt !== 'string' || (requests && typeof item.incoming !== 'boolean')) {
    throw new ZhangakApiError('Некорректный ответ сервиса дружбы', 502, 'invalid_response')
  }
  return { friendshipId: item.friendshipId, publicProfileId: item.publicProfileId, displayName: item.displayName, profileColor: item.profileColor as SocialPerson['profileColor'], xp: item.xp as number, status: item.status as SocialPerson['status'], createdAt: item.createdAt, ...(requests ? { incoming: item.incoming as boolean } : {}) }
}

export async function getFriends(): Promise<SocialPerson[]> {
  const source = record(await zhangakApiRequest<unknown>('/v1/platform/community/friends'))
  if (!Array.isArray(source.items)) throw new ZhangakApiError('Некорректный ответ сервиса дружбы', 502, 'invalid_response')
  return source.items.map(item => person(item))
}

export async function getFriendRequests(): Promise<SocialPerson[]> {
  const source = record(await zhangakApiRequest<unknown>('/v1/platform/community/friend-requests'))
  if (!Array.isArray(source.items)) throw new ZhangakApiError('Некорректный ответ сервиса дружбы', 502, 'invalid_response')
  return source.items.map(item => person(item, true))
}

export async function requestFriendship(publicProfileId: string): Promise<void> {
  await zhangakApiJson<unknown>('/v1/platform/community/friend-requests', 'POST', { publicProfileId })
}
export async function respondFriendship(friendshipId: string, action: 'accept' | 'decline'): Promise<void> {
  await zhangakApiJson<unknown>(`/v1/platform/community/friend-requests/${encodeURIComponent(friendshipId)}/${action}`, 'PATCH', {})
}
export async function removeFriendship(friendshipId: string): Promise<void> {
  await zhangakApiJson<unknown>(`/v1/platform/community/friends/${encodeURIComponent(friendshipId)}`, 'DELETE', undefined)
}
export async function blockCommunityProfile(publicProfileId: string): Promise<void> {
  await zhangakApiJson<unknown>('/v1/platform/community/blocks', 'POST', { publicProfileId })
}
