import assert from 'node:assert/strict'
import test from 'node:test'

import { getAdminAudit, parseAdminAudit } from '../../lib/admin-access-client.ts'

const AUDIT = {
  items: [{
    id: 12,
    action: 'change_user_role',
    targetType: 'user',
    actorName: 'Айжан Админова',
    actorRole: 'super_admin',
    createdAt: '2026-08-14T08:00:00.000Z',
  }],
  total: 12,
  limit: 50,
  offset: 0,
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

test('super-admin audit client accepts only the minimized own-backend DTO', () => {
  assert.deepEqual(parseAdminAudit(AUDIT), AUDIT)
  assert.throws(
    () => parseAdminAudit({ ...AUDIT, items: [{ ...AUDIT.items[0], actorRole: 'admin_root' }] }),
    /автор аудита/,
  )
  assert.throws(
    () => parseAdminAudit({ ...AUDIT, total: 0 }),
    /пагинация аудита/,
  )
})

test('super-admin audit client stays inside the cookie-authenticated admin BFF', async () => {
  const restoreWindow = installBrowserWindow()
  const originalFetch = globalThis.fetch
  const calls: { input: string; init?: RequestInit }[] = []
  globalThis.fetch = async (input, init) => {
    calls.push({ input: String(input), init })
    return json({ ...AUDIT, limit: 25 })
  }

  try {
    assert.deepEqual(await getAdminAudit(25), { ...AUDIT, limit: 25 })
    assert.equal(calls.length, 1)
    assert.equal(calls[0].input, '/v1/admin/audit?limit=25')
    assert.equal(calls[0].init?.credentials, 'include')
    assert.equal(calls[0].init?.cache, 'no-store')
  } finally {
    globalThis.fetch = originalFetch
    restoreWindow()
  }
})
