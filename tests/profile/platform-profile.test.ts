import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getPlatformProfile,
  parsePlatformProfile,
  updatePlatformProfile,
} from '../../lib/platform-profile.ts'

const PROFILE = {
  id: '9d794428-2199-46e5-9149-10b55188bd5b',
  email: 'student@example.com',
  fullName: 'Айзада Токтосунова',
  role: 'student',
  studentType: 'online',
  phone: null,
  targetScore: 210,
  avatarUrl: null,
  profileColor: 'violet',
  dailyStudyGoalMinutes: 45,
  communityVisibility: true,
  publicProfileId: '74316e07-7603-443b-95a5-7bb61d9f7fb4',
  communityDisplayName: null,
  communityProfileVisibility: 'leaderboard',
  communityShowXp: true,
  communityShowAchievements: true,
  communityShowStreak: true,
  communityAllowFriendRequests: true,
  communityDiscoverable: true,
  profileFrameCode: 'frame_classic',
  profileBackgroundCode: 'background_clear',
  profileTitleCode: 'title_student',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function installBrowserWindow(): () => void {
  const existing = Object.getOwnPropertyDescriptor(globalThis, 'window')
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {} })
  return () => {
    if (existing) Object.defineProperty(globalThis, 'window', existing)
    else delete (globalThis as { window?: unknown }).window
  }
}

test('profile client stays in the same-origin first-party BFF namespace', async () => {
  const restoreWindow = installBrowserWindow()
  const originalFetch = globalThis.fetch
  const calls: { input: string; init?: RequestInit }[] = []
  globalThis.fetch = async (input, init) => {
    calls.push({ input: String(input), init })
    return json({ profile: PROFILE })
  }

  try {
    assert.deepEqual(await getPlatformProfile(), PROFILE)
    assert.deepEqual(await updatePlatformProfile({
      fullName: 'Нурбек Садыков',
      targetScore: 220,
      profileColor: 'emerald',
      dailyStudyGoalMinutes: 60,
      communityVisibility: false,
    }), PROFILE)
    assert.deepEqual(calls.map(call => call.input), ['/v1/platform/profile', '/v1/platform/profile'])
    assert.deepEqual(calls.map(call => call.init?.method ?? 'GET'), ['GET', 'PATCH'])
    assert.ok(calls.every(call => call.init?.credentials === 'include'))
    assert.deepEqual(JSON.parse(String(calls[1].init?.body)), {
      fullName: 'Нурбек Садыков',
      targetScore: 220,
      profileColor: 'emerald',
      dailyStudyGoalMinutes: 60,
      communityVisibility: false,
    })
  } finally {
    globalThis.fetch = originalFetch
    restoreWindow()
  }
})

test('profile client rejects malformed server projections before rendering them', () => {
  assert.throws(
    () => parsePlatformProfile({ profile: { ...PROFILE, role: 'admin' } }),
    /некорректный профиль/,
  )
  assert.throws(
    () => parsePlatformProfile({ profile: { ...PROFILE, targetScore: 246 } }),
    /некорректный профиль/,
  )
  assert.throws(
    () => parsePlatformProfile({ profile: { ...PROFILE, avatarUrl: 42 } }),
    /некорректный профиль/,
  )
  assert.throws(
    () => parsePlatformProfile({ profile: { ...PROFILE, profileColor: 'url(javascript:alert(1))' } }),
    /некорректный профиль/,
  )
  assert.throws(
    () => parsePlatformProfile({ profile: { ...PROFILE, dailyStudyGoalMinutes: 23 } }),
    /некорректный профиль/,
  )
  assert.throws(
    () => parsePlatformProfile({ profile: { ...PROFILE, communityVisibility: 'yes' } }),
    /некорректный профиль/,
  )
})
