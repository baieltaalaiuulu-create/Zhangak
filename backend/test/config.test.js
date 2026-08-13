import assert from 'node:assert/strict'
import test from 'node:test'

import { loadConfig } from '../src/config.js'

const ORIGINAL = { ...process.env }

function validEnvironment() {
  process.env.NODE_ENV = 'production'
  process.env.DATABASE_URL = 'postgresql://zhangak:secret@127.0.0.1:5433/zhangak'
  process.env.JWT_SECRET = 'test-secret-that-is-definitely-longer-than-thirty-two-characters'
  process.env.ALLOWED_ORIGINS = 'https://platform.zhangak.com,https://admin.zhangak.com'
}

test.afterEach(() => {
  for (const key of Object.keys(process.env)) if (!(key in ORIGINAL)) delete process.env[key]
  Object.assign(process.env, ORIGINAL)
})

test('production configuration is fail-closed and localhost-bound by default', () => {
  validEnvironment()
  delete process.env.HOST
  const config = loadConfig()
  assert.equal(config.host, '127.0.0.1')
  assert.equal(config.port, 3210)
  assert.equal(config.allowedOrigins.has('https://platform.zhangak.com'), true)
})

test('missing and placeholder secrets are rejected', () => {
  validEnvironment()
  delete process.env.JWT_SECRET
  assert.throws(() => loadConfig(), /JWT_SECRET is required/)
  process.env.JWT_SECRET = 'dev-secret-change-me'
  assert.throws(() => loadConfig(), /at least 32|placeholder/)
})

test('production rejects insecure browser origins', () => {
  validEnvironment()
  process.env.ALLOWED_ORIGINS = 'http://platform.zhangak.com'
  assert.throws(() => loadConfig(), /HTTPS/)
})
