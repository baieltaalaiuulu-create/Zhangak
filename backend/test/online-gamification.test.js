import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const [migration, platformRoute, adminRoute, server] = await Promise.all([
  readFile(path.join(root, 'migrations', '009_online_gamification.sql'), 'utf8'),
  readFile(path.join(root, 'src', 'routes', 'platform-gamification.js'), 'utf8'),
  readFile(path.join(root, 'src', 'routes', 'admin-gamification.js'), 'utf8'),
  readFile(path.join(root, 'src', 'server.js'), 'utf8'),
])

test('online gamification schema makes daily completion and XP awards idempotent', () => {
  assert.match(migration, /daily_challenge_attempts_once UNIQUE \(student_id, daily_challenge_id\)/)
  assert.match(migration, /student_xp_awards_once UNIQUE \(student_id, award_key\)/)
  assert.match(migration, /position BETWEEN 1 AND 15/)
  assert.match(migration, /CREATE TABLE daily_challenge_attempt_answers/)
  assert.match(migration, /published daily challenge must contain exactly 15 questions/)
  assert.match(migration, /published daily challenge questions are immutable/)
})

test('trainer mastery is per student and reset does not delete XP', () => {
  assert.match(migration, /CREATE TABLE trainer_question_mastery/)
  assert.match(migration, /PRIMARY KEY \(student_id, practice_question_id\)/)
  assert.match(platformRoute, /NOT EXISTS \(SELECT 1 FROM trainer_question_mastery/)
  assert.match(platformRoute, /DELETE FROM trainer_question_mastery WHERE student_id = \$1/)
  assert.doesNotMatch(platformRoute.match(/POST\('\/v1\/platform\/trainer\/reset'[\s\S]*?\n}\)/)?.[0] ?? '', /student_xp_awards/)
})

test('daily and trainer routes are own-backend student-scoped and keep keys private until scoring', () => {
  assert.match(server, /platform-gamification\.js/)
  assert.match(server, /admin-gamification\.js/)
  assert.match(platformRoute, /GET\('\/v1\/platform\/daily-challenge'/)
  assert.match(platformRoute, /POST\('\/v1\/platform\/daily-challenge\/submit'/)
  assert.match(platformRoute, /GET\('\/v1\/platform\/trainer\/question'/)
  assert.match(platformRoute, /GET\('\/v1\/platform\/trainer\/history'/)
  assert.match(platformRoute, /trainer_question_issues/)
  assert.match(platformRoute, /daily_challenge_attempt_answers/)
  assert.match(platformRoute, /correct_answer/)
  assert.doesNotMatch(platformRoute.match(/function publicQuestion[\s\S]*?\n}/)?.[0] ?? '', /correct_answer/)
  assert.match(adminRoute, /CONTENT_MANAGER|ROLES = \['admin', 'super_admin'\]/)
  assert.match(adminRoute, /questionIds\.length !== 15/)
  assert.doesNotMatch(platformRoute, /supabase/i)
})
