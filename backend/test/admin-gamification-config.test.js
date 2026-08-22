import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const [migration, service, route] = await Promise.all([
  readFile(path.join(root, 'migrations', '017_gamification_definition_revisions.sql'), 'utf8'),
  readFile(path.join(root, 'src', 'gamification.js'), 'utf8'),
  readFile(path.join(root, 'src', 'routes', 'admin-gamification.js'), 'utf8'),
])

test('quest definitions are revised at a future period boundary without changing open instances', () => {
  assert.match(migration, /CREATE TABLE quest_definition_revisions/)
  assert.match(migration, /UNIQUE \(quest_definition_id, effective_from\)/)
  assert.match(migration, /INSERT INTO quest_definition_revisions/)
  assert.match(service, /JOIN LATERAL \(/)
  assert.match(service, /r\.effective_from <= CASE WHEN d\.period = 'daily'/)
  assert.doesNotMatch(service.match(/const progress = await client\.query\([\s\S]*?RETURNING id, quest_instance_id/m)?.[0] ?? '', /d\.is_active = true/)
})

test('admin gamification settings are first-party, role-gated, audited and cannot touch student XP', () => {
  assert.match(route, /GET\('\/v1\/admin\/gamification\/definitions'/)
  assert.match(route, /PATCH\('\/v1\/admin\/gamification\/quests\/:definitionId'/)
  assert.match(route, /PATCH\('\/v1\/admin\/gamification\/achievements\/:achievementId'/)
  assert.match(route, /const ROLES = \['admin', 'super_admin'\]/)
  assert.match(route, /schedule_quest_definition/)
  assert.match(route, /update_achievement_definition/)
  assert.match(route, /now\(\) AT TIME ZONE 'Asia\/Bishkek'/)
  assert.doesNotMatch(route, /student_xp_awards|student_quest_progress\s+SET|INSERT INTO gamification_events/)
})
