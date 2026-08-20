import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getAdminGamificationDefinitions,
  parseAdminGamificationDefinitions,
  scheduleAdminQuestConfiguration,
  updateAdminAchievementDefinition,
} from '../../lib/admin-gamification-client.ts'

const DEFINITIONS = {
  quests: [{
    id: 1, code: 'daily_check_in', period: 'daily', targetEventType: 'platform_visit', title: 'На связи', description: 'Открой платформу сегодня.', sortOrder: 10,
    current: { effectiveFrom: '2000-01-01', targetCount: 1, xpReward: 5, isActive: true },
    scheduled: null,
  }],
  achievements: [{ id: 1, code: 'first_step', title: 'Первый шаг', description: 'Сделай действие.', iconKey: 'footprints', sortOrder: 10, isActive: true }],
}

function response(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

function installWindow(): () => void {
  const existing = Object.getOwnPropertyDescriptor(globalThis, 'window')
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {} })
  return () => {
    if (existing) Object.defineProperty(globalThis, 'window', existing)
    else delete (globalThis as { window?: unknown }).window
  }
}

test('admin gamification parser accepts only bounded future configuration', () => {
  assert.deepEqual(parseAdminGamificationDefinitions(DEFINITIONS), DEFINITIONS)
  assert.throws(() => parseAdminGamificationDefinitions({ ...DEFINITIONS, quests: [{ ...DEFINITIONS.quests[0], current: { ...DEFINITIONS.quests[0].current, xpReward: 0 } }] }), /Некорректный ответ/)
})

test('admin gamification client stays in own BFF routes and never sends XP authority', async () => {
  const restore = installWindow()
  const originalFetch = globalThis.fetch
  const calls: { input: string, init?: RequestInit }[] = []
  globalThis.fetch = async (input, init) => {
    calls.push({ input: String(input), init })
    if (String(input).endsWith('/definitions')) return response(DEFINITIONS)
    if (String(input).includes('/quests/')) return response({ definition: { ...DEFINITIONS.quests[0], scheduled: { effectiveFrom: '2026-08-21', targetCount: 2, xpReward: 7, isActive: true } } })
    return response({ achievement: { ...DEFINITIONS.achievements[0], sortOrder: 15 } })
  }
  try {
    await getAdminGamificationDefinitions()
    await scheduleAdminQuestConfiguration(1, { targetCount: 2, xpReward: 7, isActive: true })
    await updateAdminAchievementDefinition(1, { sortOrder: 15, isActive: true })
    assert.deepEqual(calls.map(call => call.input), [
      '/v1/admin/gamification/definitions',
      '/v1/admin/gamification/quests/1',
      '/v1/admin/gamification/achievements/1',
    ])
    assert.deepEqual(JSON.parse(String(calls[1].init?.body)), { targetCount: 2, xpReward: 7, isActive: true })
    assert.deepEqual(JSON.parse(String(calls[2].init?.body)), { sortOrder: 15, isActive: true })
    assert.ok(calls.every(call => call.init?.credentials === 'include'))
    assert.ok(calls.every(call => !String(call.init?.body).match(/student|award|progress/i)))
  } finally {
    globalThis.fetch = originalFetch
    restore()
  }
})
