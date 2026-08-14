import assert from 'node:assert/strict'
import test from 'node:test'

import {
  assignableAccountRoles,
  changeAdminAccountRole,
  creatableAccountRoles,
  createAdminAccount,
  deleteAdminAccount,
  listAdminAccounts,
  resetAdminAccountPassword,
  setAdminAccountBlocked,
} from '../../lib/admin-account-client.ts'

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

test('admin account operations remain in the cookie-authenticated BFF namespace', async () => {
  const restoreWindow = installBrowserWindow()
  const originalFetch = globalThis.fetch
  const calls: { input: string; init?: RequestInit }[] = []
  globalThis.fetch = async (input, init) => {
    calls.push({ input: String(input), init })
    return json(init?.method === 'POST' ? { id: '7d794428-2199-46e5-9149-10b55188bd5b' } : { success: true })
  }

  try {
    await listAdminAccounts({ query: 'aibek', limit: 25, offset: 10 })
    await createAdminAccount({
      email: 'aibek@example.com',
      password: 'Temporary!10',
      fullName: 'Айбек Тестов',
      role: 'student',
      studentType: 'online',
      targetScore: 210,
    })
    await setAdminAccountBlocked('7d794428-2199-46e5-9149-10b55188bd5b', true)
    await resetAdminAccountPassword('7d794428-2199-46e5-9149-10b55188bd5b', 'NewPassword!10')
    await changeAdminAccountRole('7d794428-2199-46e5-9149-10b55188bd5b', { role: 'teacher' })
    await deleteAdminAccount('7d794428-2199-46e5-9149-10b55188bd5b')

    assert.deepEqual(calls.map(call => call.input), [
      '/v1/admin/users?q=aibek&limit=25&offset=10',
      '/v1/admin/users',
      '/v1/admin/users/7d794428-2199-46e5-9149-10b55188bd5b/block',
      '/v1/admin/users/7d794428-2199-46e5-9149-10b55188bd5b/password',
      '/v1/admin/users/7d794428-2199-46e5-9149-10b55188bd5b/role',
      '/v1/admin/users/7d794428-2199-46e5-9149-10b55188bd5b',
    ])
    assert.deepEqual(calls.map(call => call.init?.method ?? 'GET'), ['GET', 'POST', 'PATCH', 'PATCH', 'PATCH', 'DELETE'])
    assert.ok(calls.every(call => call.init?.credentials === 'include'))
    assert.deepEqual(JSON.parse(String(calls[1].init?.body)), {
      email: 'aibek@example.com',
      password: 'Temporary!10',
      fullName: 'Айбек Тестов',
      role: 'student',
      studentType: 'online',
      targetScore: 210,
    })
    assert.deepEqual(JSON.parse(String(calls[4].init?.body)), { role: 'teacher', studentType: null })
  } finally {
    globalThis.fetch = originalFetch
    restoreWindow()
  }
})

test('role picker only exposes roles the first-party backend may create', () => {
  assert.deepEqual(creatableAccountRoles('admin'), ['student'])
  assert.deepEqual(creatableAccountRoles('math_admin'), ['math_student', 'math_parent'])
  assert.deepEqual(creatableAccountRoles('teacher'), [])
  assert.equal(creatableAccountRoles('super_admin').length, 10)
  assert.equal(creatableAccountRoles('super_admin').includes('super_admin'), false)
  assert.equal(assignableAccountRoles('super_admin').includes('super_admin'), false)
  assert.equal(assignableAccountRoles('admin').length, 0)
})
