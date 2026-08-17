import assert from 'node:assert/strict'
import test from 'node:test'

import { fetchPlatformRoadmap, parsePlatformRoadmap } from '../../lib/platform-roadmap.ts'

const ROADMAP = {
  course: { id: 4, name: 'Онлайн ОРТ', code: 'ort-online', subject: 'math' },
  direction: 'bottom_to_top',
  units: [{
    id: 3, unitNumber: 1, title: 'Основы', description: 'Начинаем путь', accentColor: 'green',
    completedLessons: 1, lessonCount: 2, completionPercent: 50, starCount: 1,
    lessons: [
      { id: 11, lessonNumber: 1, title: 'Числа', description: 'База', subject: 'math', section: 'numbers', topic: 'natural', durationMinutes: 15, isTest: false, completionMode: 'self', completionPercent: 100, completedAt: '2026-08-17T08:00:00.000Z', isLocked: false, state: 'done', isCurrent: false },
      { id: 12, lessonNumber: 2, title: 'Дроби', description: 'Дальше', subject: 'math', section: 'numbers', topic: 'fractions', durationMinutes: 20, isTest: true, completionMode: 'practice', completionPercent: 0, completedAt: null, isLocked: false, state: 'current', isCurrent: true },
    ],
  }],
  summary: { completedLessons: 1, lessonCount: 2, completionPercent: 50 },
}

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

function installBrowserWindow(): () => void {
  const existing = Object.getOwnPropertyDescriptor(globalThis, 'window')
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {} })
  return () => { if (existing) Object.defineProperty(globalThis, 'window', existing); else delete (globalThis as { window?: unknown }).window }
}

test('Roadmap parser preserves the bottom-to-top contract and progress stars', () => {
  const roadmap = parsePlatformRoadmap(ROADMAP)
  assert.equal(roadmap.direction, 'bottom_to_top')
  assert.equal(roadmap.units[0].starCount, 1)
  assert.equal(roadmap.units[0].lessons[1].state, 'current')
  assert.equal(roadmap.units[0].lessons[1].completionMode, 'practice')
  assert.equal(roadmap.units[0].lessons[0].id, '11')
})

test('Roadmap parser rejects a client-side unlock or private material field shape', () => {
  assert.throws(() => parsePlatformRoadmap({ ...ROADMAP, direction: 'top_to_bottom' }), /направление/)
  assert.throws(() => parsePlatformRoadmap({ ...ROADMAP, units: [{ ...ROADMAP.units[0], lessons: [{ ...ROADMAP.units[0].lessons[0], state: 'locked', isLocked: false }, ROADMAP.units[0].lessons[1]] }] }), /Несогласованный статус/)
})

test('Roadmap is requested only through the credentialed first-party BFF', async () => {
  const restoreWindow = installBrowserWindow()
  const originalFetch = globalThis.fetch
  const calls: { input: string; init?: RequestInit }[] = []
  globalThis.fetch = async (input, init) => { calls.push({ input: String(input), init }); return json(ROADMAP) }
  try {
    assert.equal((await fetchPlatformRoadmap()).course?.id, 4)
    assert.deepEqual(calls.map(call => call.input), ['/v1/platform/roadmap'])
    assert.equal(calls[0].init?.credentials, 'include')
  } finally {
    globalThis.fetch = originalFetch
    restoreWindow()
  }
})
