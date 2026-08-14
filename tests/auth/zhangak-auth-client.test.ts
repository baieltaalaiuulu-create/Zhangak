import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getCurrentZhangakUser,
  loginZhangak,
  logoutZhangak,
  ZhangakAuthError,
} from '../../lib/zhangak-auth-client.ts'

const USER = {
  id: '9d794428-2199-46e5-9149-10b55188bd5b',
  email: 'student@example.com',
  fullName: 'Test Student',
  role: 'student',
  studentType: 'online',
  phone: null,
  targetScore: 200,
  avatarUrl: null,
  profileColor: 'blue',
  dailyStudyGoalMinutes: 30,
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

test('login uses the same-origin HttpOnly session contract', async () => {
  const originalFetch = globalThis.fetch
  const captured: { input?: string; init?: RequestInit } = {}
  globalThis.fetch = async (input, init) => {
    captured.input = String(input)
    captured.init = init
    return json({ user: USER })
  }
  try {
    assert.deepEqual(await loginZhangak('student@example.com', 'strong-password'), USER)
    assert.equal(captured?.input, '/v1/auth/login')
    assert.equal(captured?.init?.method, 'POST')
    assert.equal(captured?.init?.credentials, 'include')
    assert.deepEqual(JSON.parse(String(captured?.init?.body)), {
      email: 'student@example.com',
      password: 'strong-password',
    })
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('current user rotates an expired access cookie once', async () => {
  const originalFetch = globalThis.fetch
  const calls: string[] = []
  const responses = [
    json({ error: 'Требуется авторизация', code: 'unauthorized' }, 401),
    json({}),
    json({ user: USER }),
  ]
  globalThis.fetch = async input => {
    calls.push(String(input))
    const response = responses.shift()
    if (!response) throw new Error('Unexpected fetch')
    return response
  }
  try {
    assert.deepEqual(await getCurrentZhangakUser(), USER)
    assert.deepEqual(calls, ['/v1/auth/me', '/v1/auth/refresh', '/v1/auth/me'])
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('invalid credentials and missing refresh remain fail-closed', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async input => String(input).endsWith('/login')
    ? json({ error: 'Неверный email или пароль', code: 'invalid_credentials' }, 401)
    : json({ error: 'Сессия истекла', code: 'refresh_invalid' }, 401)
  try {
    await assert.rejects(
      loginZhangak('student@example.com', 'wrong-password'),
      (error: unknown) => error instanceof ZhangakAuthError
        && error.status === 401
        && error.code === 'invalid_credentials',
    )
    assert.equal(await getCurrentZhangakUser(), null)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('logout is a credentialed same-origin POST', async () => {
  const originalFetch = globalThis.fetch
  let init: RequestInit | undefined
  globalThis.fetch = async (_input, requestInit) => {
    init = requestInit
    return json({ success: true })
  }
  try {
    await logoutZhangak()
    assert.equal(init?.method, 'POST')
    assert.equal(init?.credentials, 'include')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('network failures become a bounded service error instead of hanging the login UI', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => { throw new TypeError('network down') }
  try {
    await assert.rejects(
      getCurrentZhangakUser(),
      (error: unknown) => error instanceof ZhangakAuthError
        && error.status === 503
        && error.code === 'network_error',
    )
  } finally {
    globalThis.fetch = originalFetch
  }
})
