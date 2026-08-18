import assert from 'node:assert/strict'
import test from 'node:test'

import { forwardTrustedClientIp } from '../../lib/trusted-client-ip.ts'

test('forwards only the Nginx-controlled real client IPv4 address', () => {
  const request = new Headers({
    'x-real-ip': '203.0.113.42',
    'x-forwarded-for': '198.51.100.99, 203.0.113.42',
  })
  const upstream = new Headers()

  forwardTrustedClientIp(request, upstream)

  assert.equal(upstream.get('x-forwarded-for'), '203.0.113.42')
})

test('accepts IPv6 and fails closed for malformed or missing X-Real-IP', () => {
  const ipv6Upstream = new Headers()
  forwardTrustedClientIp(new Headers({ 'x-real-ip': '2001:db8::7' }), ipv6Upstream)
  assert.equal(ipv6Upstream.get('x-forwarded-for'), '2001:db8::7')

  const malformedUpstream = new Headers()
  forwardTrustedClientIp(new Headers({
    'x-real-ip': 'not-an-ip',
    'x-forwarded-for': '203.0.113.10',
  }), malformedUpstream)
  assert.equal(malformedUpstream.get('x-forwarded-for'), null)
})
