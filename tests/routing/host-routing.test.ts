import assert from 'node:assert/strict'
import test from 'node:test'

import { NextRequest } from 'next/server.js'

import { proxy } from '../../proxy.ts'
import { normalizeHostname, siteSurfaceForHost, workspaceSurfaceForRole } from '../../lib/site-hosts.ts'

function request(url: string, method = 'GET', host?: string): NextRequest {
  return new NextRequest(url, {
    method,
    headers: host ? { host } : undefined,
  })
}

// Next 16's experimental testing helpers schedule an AsyncLocalStorage task
// after Node 22's test has already completed. The proxy contract is fully
// observable through the stable response headers, so keep this suite on the
// production response surface instead of depending on the experimental shim.
function getRedirectUrl(response: Response): string | null {
  return response.headers.get('location')
}

function getRewrittenUrl(response: Response): string | null {
  return response.headers.get('x-middleware-rewrite')
}

function isRewrite(response: Response): boolean {
  return getRewrittenUrl(response) !== null
}

test('host normalization is strict and supports development ports', () => {
  assert.equal(normalizeHostname('Platform.Zhangak.com:443'), 'platform.zhangak.com')
  assert.equal(normalizeHostname('[::1]:3000'), '::1')
  assert.equal(siteSurfaceForHost('www.zhangak.com'), 'marketing')
  assert.equal(siteSurfaceForHost('preview.example.com'), null)
})

test('marketing root renders the landing page without changing the canonical URL', () => {
  const response = proxy(request('https://zhangak.com/'))
  assert.equal(isRewrite(response), true)
  assert.equal(getRewrittenUrl(response), 'https://zhangak.com/landing')
  assert.equal(response.headers.get('x-robots-tag'), null)

  const tlsTerminated = proxy(request('https://localhost:3200/', 'GET', 'zhangak.com'))
  assert.equal(getRewrittenUrl(tlsTerminated), 'http://localhost:3200/landing')
})

test('workspace pages move to their dedicated hosts', () => {
  assert.equal(
    getRedirectUrl(proxy(request('https://zhangak.com/student/online?from=home'))),
    'https://platform.zhangak.com/student/online?from=home',
  )
  assert.equal(
    getRedirectUrl(proxy(request('https://platform.zhangak.com/admin/analytics'))),
    'https://admin.zhangak.com/admin/analytics',
  )
  assert.equal(
    getRedirectUrl(proxy(request('https://admin.zhangak.com/student/online'))),
    'https://platform.zhangak.com/student/online',
  )
  assert.equal(
    getRedirectUrl(proxy(request('https://admin.zhangak.com/teacher'))),
    'https://offline.zhangak.com/teacher',
  )
  assert.equal(
    getRedirectUrl(proxy(request('https://platform.zhangak.com/student'))),
    'https://offline.zhangak.com/student',
  )
  assert.equal(
    getRedirectUrl(proxy(request('https://offline.zhangak.com/student/online'))),
    'https://platform.zhangak.com/student/online',
  )
})

test('online and offline learning workspaces are isolated from administration', () => {
  assert.equal(workspaceSurfaceForRole('student', 'online'), 'platform')
  assert.equal(workspaceSurfaceForRole('student', 'offline'), 'offline')
  assert.equal(workspaceSurfaceForRole('teacher'), 'offline')
  assert.equal(workspaceSurfaceForRole('admin'), 'admin')
  assert.equal(workspaceSurfaceForRole('director'), 'admin')

  assert.equal(proxy(request('https://offline.zhangak.com/v1/platform/teacher-dashboard')).headers.get('x-middleware-next'), '1')
  assert.equal(proxy(request('https://platform.zhangak.com/v1/platform/offline-dashboard', 'POST')).status, 404)
  assert.equal(proxy(request('https://admin.zhangak.com/v1/platform/teacher-dashboard', 'POST')).status, 404)
})

test('Math marketing stays public while Math accounts use workspace hosts', () => {
  assert.equal(proxy(request('https://zhangak.com/math')).headers.get('x-middleware-next'), '1')
  assert.equal(
    getRedirectUrl(proxy(request('https://zhangak.com/math/student'))),
    'https://platform.zhangak.com/math/student',
  )
  assert.equal(
    getRedirectUrl(proxy(request('https://zhangak.com/math/admin'))),
    'https://admin.zhangak.com/math/admin',
  )
})

test('the online root reaches its first-visit gate while offline and admin start at login', () => {
  assert.equal(
    getRedirectUrl(proxy(request('https://zhangak.com/login'))),
    'https://platform.zhangak.com/login',
  )
  assert.equal(proxy(request('https://admin.zhangak.com/login')).headers.get('x-middleware-next'), '1')
  assert.equal(proxy(request('https://platform.zhangak.com/')).headers.get('x-middleware-next'), '1')
  assert.equal(
    getRedirectUrl(proxy(request('https://offline.zhangak.com/'))),
    'https://offline.zhangak.com/login',
  )
  assert.equal(
    getRedirectUrl(proxy(request('https://admin.zhangak.com/'))),
    'https://admin.zhangak.com/login',
  )
})

test('retired Supabase API paths fail with a direct 404 on every owned host', async () => {
  const requests = [
    request('https://platform.zhangak.com/api/admin/settings', 'POST'),
    request('https://admin.zhangak.com/api/teacher/groups'),
    request('https://zhangak.com/api/ai-mentor', 'POST'),
    request('https://platform.zhangak.com/api/delete-own-account', 'DELETE'),
  ]

  for (const retiredRequest of requests) {
    const response = proxy(retiredRequest)
    assert.equal(response.status, 404)
    assert.equal(response.headers.get('location'), null)
    assert.deepEqual(await response.json(), { error: 'Not found' })
  }
})

test('first-party auth is available only on workspace hosts', async () => {
  const marketing = proxy(request('https://zhangak.com/v1/auth/login', 'POST'))
  assert.equal(marketing.status, 404)
  assert.equal(marketing.headers.get('location'), null)
  assert.equal(proxy(request('https://platform.zhangak.com/v1/auth/login', 'POST')).headers.get('x-middleware-next'), '1')
  assert.equal(proxy(request('https://offline.zhangak.com/v1/auth/login', 'POST')).headers.get('x-middleware-next'), '1')
  assert.equal(proxy(request('https://admin.zhangak.com/v1/auth/me')).headers.get('x-middleware-next'), '1')
})

test('workspace hosts are noindex at both header and robots layers', async () => {
  const platform = proxy(request('https://platform.zhangak.com/student/online'))
  assert.equal(platform.headers.get('x-robots-tag'), 'noindex, nofollow, noarchive')

  const robots = proxy(request('https://admin.zhangak.com/robots.txt'))
  assert.equal(robots.status, 200)
  assert.match(await robots.text(), /Disallow: \/(?:\r?\n|$)/)
  assert.equal(robots.headers.get('x-robots-tag'), 'noindex, nofollow, noarchive')

  const offline = proxy(request('https://offline.zhangak.com/student'))
  assert.equal(offline.headers.get('x-robots-tag'), 'noindex, nofollow, noarchive')
})

test('PWA assets belong to the platform host only', () => {
  assert.equal(
    getRedirectUrl(proxy(request('https://zhangak.com/platform.webmanifest'))),
    'https://platform.zhangak.com/platform.webmanifest',
  )
  assert.equal(
    getRedirectUrl(proxy(request('https://admin.zhangak.com/sw.js'))),
    'https://platform.zhangak.com/sw.js',
  )
  assert.equal(proxy(request('https://platform.zhangak.com/sw.js')).headers.get('x-middleware-next'), '1')
})

test('www permanently canonicalizes to the apex host', () => {
  const response = proxy(request('https://www.zhangak.com/privacy?lang=ky'))
  assert.equal(response.status, 308)
  assert.equal(getRedirectUrl(response), 'https://zhangak.com/privacy?lang=ky')
})
