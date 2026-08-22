import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'

const root = process.cwd()

test('daily and trainer browser clients stay in the first-party platform namespace', async () => {
  const source = await readFile(path.join(root, 'lib', 'platform-gamification.ts'), 'utf8')
  assert.match(source, /\/v1\/platform\/daily-challenge\/start/)
  assert.match(source, /\/v1\/platform\/daily-challenge\/submit/)
  assert.match(source, /\/v1\/platform\/trainer\/question/)
  assert.match(source, /\/v1\/platform\/trainer\/catalog/)
  assert.match(source, /\/v1\/platform\/trainer\/answers/)
  assert.match(source, /\/v1\/platform\/trainer\/reset/)
  assert.match(source, /\/v1\/platform\/trainer\/history/)
  assert.doesNotMatch(source, /supabase/i)
})

test('daily and trainer UI send only selected answers and use server-finalised reviews', async () => {
  const [daily, trainer] = await Promise.all([
    readFile(path.join(root, 'app', 'student', 'online', 'practice', 'daily', 'page.tsx'), 'utf8'),
    readFile(path.join(root, 'app', 'student', 'online', 'trainer', 'page.tsx'), 'utf8'),
  ])
  assert.match(daily, /submitDailyChallenge/)
  assert.match(trainer, /answerTrainerQuestion/)
  assert.match(daily, /attempt\.review/)
  assert.match(trainer, /getTrainerHistory/)
  assert.match(trainer, /getTrainerCatalog/)
  assert.match(trainer, /вопросов доступно/)
})
