import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const [migration, route, ai, server] = await Promise.all([
  readFile(path.join(root, 'migrations', '011_ai_conversations.sql'), 'utf8'),
  readFile(path.join(root, 'src', 'routes', 'platform-ai.js'), 'utf8'),
  readFile(path.join(root, 'src', 'ai.js'), 'utf8'),
  readFile(path.join(root, 'src', 'server.js'), 'utf8'),
])

test('AI history is owned, consented, and constrained to user or assistant messages', () => {
  assert.match(migration, /CREATE TABLE ai_consents/)
  assert.match(migration, /CREATE TABLE ai_conversations/)
  assert.match(migration, /CREATE TABLE ai_messages/)
  assert.match(migration, /role IN \('user', 'assistant'\)/)
  assert.match(route, /JOIN ai_conversations c ON c\.id=m\.conversation_id WHERE c\.user_id=\$1/)
  assert.match(route, /ai_consent_required/)
  assert.match(route, /interval '15 minutes'/)
  assert.match(route, /Number\(rate\.rows\[0\]\.count\) >= 8/)
})

test('AI route requires an active online enrollment and keeps provider data server-side', () => {
  assert.match(server, /platform-ai\.js/)
  assert.match(route, /c\.delivery_mode = 'online'/)
  assert.match(route, /ce\.status = 'active'/)
  assert.match(route, /ai_course_access_required/)
  assert.match(route, /POST\('\/v1\/platform\/ai\/messages'/)
  assert.doesNotMatch(route, /supabase/i)
  assert.match(ai, /config\.aiEnabled/)
  assert.match(ai, /config\.deepseekApiKey/)
  assert.match(ai, /max_tokens: 900/)
  assert.doesNotMatch(ai, /console\.|error\.message/)
})
