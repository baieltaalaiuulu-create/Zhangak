import assert from 'node:assert/strict'
import test from 'node:test'

import {
  hashPassword,
  randomRefreshToken,
  signAccessToken,
  tokenHash,
  verifyAccessToken,
  verifyPassword,
} from '../src/security.js'
import { clientSessionTokens } from '../src/auth.js'

const config = {
  jwtSecret: 'test-only-secret-that-is-longer-than-thirty-two-characters',
  accessTtlSeconds: 900,
}

test('password hashes are salted and verified in constant-sized form', async () => {
  const first = await hashPassword('a-strong-test-password')
  const second = await hashPassword('a-strong-test-password')
  assert.notEqual(first, second)
  assert.equal(await verifyPassword('a-strong-test-password', first), true)
  assert.equal(await verifyPassword('wrong-password', first), false)
  assert.equal(await verifyPassword('anything', 'broken'), false)
})

test('access token validates issuer, audience, session and version', () => {
  const token = signAccessToken(config, { sub: 'user-id', sid: 'session-id', sv: 3 })
  const claims = verifyAccessToken(config, token)
  assert.equal(claims?.sub, 'user-id')
  assert.equal(claims?.sid, 'session-id')
  assert.equal(claims?.sv, 3)
  assert.equal(verifyAccessToken({ ...config, jwtSecret: `${config.jwtSecret}-wrong` }, token), null)
  assert.equal(verifyAccessToken(config, `${token}x`), null)
})

test('refresh tokens are opaque and stored only as hashes', () => {
  const token = randomRefreshToken()
  assert.match(token, /^[A-Za-z0-9_-]{40,}$/)
  assert.notEqual(tokenHash(token), token)
  assert.equal(tokenHash(token), tokenHash(token))
})

test('browser sessions expose tokens only through HttpOnly cookies', () => {
  const session = { access: 'access-token', refresh: 'refresh-token' }
  assert.deepEqual(clientSessionTokens({ headers: { origin: 'https://platform.zhangak.com' } }, session), {})
  assert.deepEqual(clientSessionTokens({ headers: {} }, session), {
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
  })
})
