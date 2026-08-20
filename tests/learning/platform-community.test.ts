import assert from 'node:assert/strict'
import test from 'node:test'

import {
  checkInGamification,
  getOverallLeaderboard,
  parseGamificationSummary,
} from '../../lib/platform-community.ts'

const SUMMARY = {
  xp: 65,
  level: 1,
  levelStartXp: 0,
  levelEndXp: 500,
  streak: 2,
  activity: { lessonsCompleted: 1, trainerMastered: 3, dailyChallenges: 0 },
  quests: [{
    code: 'daily_check_in', period: 'daily', title: 'На связи', description: 'Открой платформу сегодня.',
    targetCount: 1, currentCount: 1, xpReward: 5, completedAt: '2026-08-20T01:00:00Z', periodEnd: '2026-08-21T00:00:00+06:00',
  }],
  achievements: [{
    code: 'first_step', title: 'Первый шаг', description: 'Выполни первое действие.', iconKey: 'footprints', unlockedAt: '2026-08-20T01:00:00Z',
  }],
}

function response(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

function installBrowserWindow(): () => void {
  const existing = Object.getOwnPropertyDescriptor(globalThis, 'window')
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {} })
  return () => {
    if (existing) Object.defineProperty(globalThis, 'window', existing)
    else delete (globalThis as { window?: unknown }).window
  }
}

test('gamification summary validates server-computed progress only', () => {
  assert.deepEqual(parseGamificationSummary(SUMMARY), SUMMARY)
  assert.throws(() => parseGamificationSummary({ ...SUMMARY, xp: -1 }), /Некорректный ответ/)
  assert.throws(() => parseGamificationSummary({ ...SUMMARY, activity: { lessonsCompleted: 1 } }), /Некорректный ответ/)
})

test('community client uses first-party endpoints without caller-controlled XP', async () => {
  const restoreWindow = installBrowserWindow()
  const originalFetch = globalThis.fetch
  const calls: { input: string; init?: RequestInit }[] = []
  globalThis.fetch = async (input, init) => {
    calls.push({ input: String(input), init })
    if (String(input).endsWith('/check-in')) return response({ recorded: true, achievements: ['first_step'], summary: SUMMARY })
    return response({ scope: 'overall', items: [], me: null })
  }
  try {
    const checkIn = await checkInGamification()
    assert.equal(checkIn.summary.xp, 65)
    await getOverallLeaderboard()
    assert.deepEqual(calls.map(call => call.input), ['/v1/platform/gamification/check-in', '/v1/platform/leaderboard'])
    assert.deepEqual(JSON.parse(String(calls[0].init?.body)), {})
    assert.ok(calls.every(call => call.init?.credentials === 'include'))
  } finally {
    globalThis.fetch = originalFetch
    restoreWindow()
  }
})
