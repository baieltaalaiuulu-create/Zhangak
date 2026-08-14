import assert from 'node:assert/strict'
import test from 'node:test'

import { getAdminDashboard, parseAdminDashboard } from '../../lib/admin-dashboard-client.ts'

const ATTEMPT_ID = '018f6586-fca4-7d5c-8f94-cb524f5c4be8'
const DASHBOARD = {
  metrics: {
    totalStudents: 12,
    newStudentsLast7Days: 3,
    lessonCount: 8,
    newLessonsLast7Days: 1,
    submittedAttemptCount: 21,
    submittedAttemptCountToday: 2,
  },
  availability: { dailyActiveStudents: false, payments: false, auditFeed: true },
  recentAttempts: [{
    id: ATTEMPT_ID,
    studentName: 'Айбек Нурланов',
    testTitle: 'Математика: диагностический тест',
    testType: 'diagnostic',
    scorePercent: 75,
    completedAt: '2026-08-13T08:00:00.000Z',
  }],
  recentChanges: [{
    id: 7,
    action: 'create_course',
    targetType: 'course',
    createdAt: '2026-08-13T08:00:00.000Z',
  }],
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function installBrowserWindow(): () => void {
  const existing = Object.getOwnPropertyDescriptor(globalThis, 'window')
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {} })
  return () => {
    if (existing) Object.defineProperty(globalThis, 'window', existing)
    else delete (globalThis as { window?: unknown }).window
  }
}

test('admin dashboard parser accepts only the owned summary DTO', () => {
  assert.deepEqual(parseAdminDashboard(DASHBOARD), DASHBOARD)
  assert.throws(
    () => parseAdminDashboard({ ...DASHBOARD, availability: { dailyActiveStudents: true, payments: false, auditFeed: true } }),
    /доступность метрик/,
  )
  assert.throws(
    () => parseAdminDashboard({ ...DASHBOARD, recentAttempts: [{ ...DASHBOARD.recentAttempts[0], scorePercent: 101 }] }),
    /процент попытки/,
  )
  assert.throws(
    () => parseAdminDashboard({ ...DASHBOARD, recentChanges: [{ ...DASHBOARD.recentChanges[0], targetType: 'user' }] }),
    /действие/,
  )
})

test('admin dashboard uses the first-party cookie-authenticated BFF', async () => {
  const restoreWindow = installBrowserWindow()
  const originalFetch = globalThis.fetch
  const calls: { input: string; init?: RequestInit }[] = []
  globalThis.fetch = async (input, init) => {
    calls.push({ input: String(input), init })
    return json(DASHBOARD)
  }

  try {
    assert.deepEqual(await getAdminDashboard(), DASHBOARD)
    assert.equal(calls.length, 1)
    assert.equal(calls[0].input, '/v1/admin/dashboard')
    assert.equal(calls[0].init?.credentials, 'include')
    assert.equal(calls[0].init?.cache, 'no-store')
  } finally {
    globalThis.fetch = originalFetch
    restoreWindow()
  }
})
