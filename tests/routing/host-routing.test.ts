import assert from 'node:assert/strict'
import test from 'node:test'

import { getRedirectUrl, getRewrittenUrl, isRewrite } from 'next/experimental/testing/server.js'
import { NextRequest } from 'next/server.js'

import { proxy } from '../../proxy.ts'
import { normalizeHostname, siteSurfaceForHost } from '../../lib/site-hosts.ts'

function request(url: string, method = 'GET'): NextRequest {
  return new NextRequest(url, { method })
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

test('login is shared by workspace hosts but leaves the marketing host', () => {
  assert.equal(
    getRedirectUrl(proxy(request('https://zhangak.com/login'))),
    'https://platform.zhangak.com/login',
  )
  assert.equal(proxy(request('https://admin.zhangak.com/login')).headers.get('x-middleware-next'), '1')
  assert.equal(
    getRedirectUrl(proxy(request('https://admin.zhangak.com/'))),
    'https://admin.zhangak.com/login',
  )
})

test('wrong-host API writes fail without redirecting credentials or request bodies', async () => {
  const response = proxy(request('https://platform.zhangak.com/api/admin/settings', 'POST'))
  assert.equal(response.status, 404)
  assert.equal(response.headers.get('location'), null)
  assert.deepEqual(await response.json(), { error: 'Not found' })
})

test('platform and admin hosts are noindex at both header and robots layers', async () => {
  const platform = proxy(request('https://platform.zhangak.com/student/online'))
  assert.equal(platform.headers.get('x-robots-tag'), 'noindex, nofollow, noarchive')

  const robots = proxy(request('https://admin.zhangak.com/robots.txt'))
  assert.equal(robots.status, 200)
  assert.match(await robots.text(), /Disallow: \/(?:\r?\n|$)/)
  assert.equal(robots.headers.get('x-robots-tag'), 'noindex, nofollow, noarchive')
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
