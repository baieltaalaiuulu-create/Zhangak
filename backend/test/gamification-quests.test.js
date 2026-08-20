import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const [migration, claimMigration, socialMigration, service, route] = await Promise.all([
  readFile(path.join(root, 'migrations', '016_gamification_quests_and_achievements.sql'), 'utf8'),
  readFile(path.join(root, 'migrations', '022_quest_reward_claims.sql'), 'utf8'),
  readFile(path.join(root, 'migrations', '018_social_profile_customization.sql'), 'utf8'),
  readFile(path.join(root, 'src', 'gamification.js'), 'utf8'),
  readFile(path.join(root, 'src', 'routes', 'platform-gamification.js'), 'utf8'),
])

test('quest migration stores only server-authored, idempotent rewards and safe public identities', () => {
  assert.match(migration, /CREATE TABLE gamification_events/)
  assert.match(migration, /UNIQUE \(student_id, event_key\)/)
  assert.match(migration, /CREATE TABLE student_quest_progress/)
  assert.match(migration, /UNIQUE \(student_id, quest_instance_id\)/)
  assert.match(migration, /CHECK \(source_type IN \('lesson', 'daily', 'trainer_section', 'admin_adjustment', 'quest'\)\)/)
  assert.match(migration, /\('daily_check_in', 'daily', 'platform_visit', 1, 5/)
  assert.match(migration, /\('daily_trainer_warmup', 'daily', 'trainer_mastered', 3, 10/)
  assert.match(migration, /\('weekly_study_rhythm', 'weekly', 'platform_visit', 4, 30/)
  assert.match(migration, /\('weekly_trainer_master', 'weekly', 'trainer_mastered', 15, 40/)
  assert.match(migration, /\('weekly_daily_consistency', 'weekly', 'daily_quest_completed', 8, 50/)
  assert.match(migration, /public_profile_id uuid NOT NULL DEFAULT gen_random_uuid\(\)/)
  assert.match(migration, /community_visibility boolean NOT NULL DEFAULT true/)
})

test('trusted event service cannot accept browser XP or duplicate an evidence event', () => {
  assert.match(service, /assertEvent\(input\)/)
  assert.match(service, /INSERT INTO gamification_events \(student_id, event_key, event_type, metadata\)/)
  assert.match(service, /ON CONFLICT \(student_id, event_key\) DO NOTHING/)
  assert.match(service, /INSERT INTO student_xp_awards \(student_id, course_id, award_key, source_type, source_id, xp_amount\)/)
  assert.match(service, /now\(\) AT TIME ZONE 'Asia\/Bishkek'/)
  assert.doesNotMatch(service, /input\.xp|input\.studentId|input\.createdAt/)
  assert.match(claimMigration, /ADD COLUMN ready_at timestamptz/)
  assert.match(claimMigration, /WHERE ready_at IS NOT NULL AND completed_at IS NULL/)
  assert.match(service, /export async function claimQuestReward/)
  assert.match(service, /SET ready_at = now\(\)/)
  assert.match(route, /POST\('\/v1\/platform\/gamification\/quests\/:progressId\/claim'/)
})

test('community routes remain online-student-scoped, pseudonymous, privacy-controlled and opt-in', () => {
  assert.match(route, /POST\('\/v1\/platform\/gamification\/check-in'/)
  assert.match(route, /exact\(await readJson\(req, 1_000\), \[\], 'invalid_gamification_check_in'\)/)
  assert.match(route, /GET\('\/v1\/platform\/gamification\/summary'/)
  assert.match(route, /GET\('\/v1\/platform\/community\/profiles\/:publicProfileId'/)
  assert.match(route, /'Ученик-' \|\| upper\(substr\(replace\(p\.public_profile_id::text/)
  assert.match(socialMigration, /CREATE TABLE profile_cosmetic_definitions/)
  assert.match(socialMigration, /CREATE TABLE student_profile_cosmetics/)
  assert.match(socialMigration, /CREATE TABLE student_featured_achievements/)
  assert.match(socialMigration, /community_profile_visibility IN \('private', 'community', 'leaderboard'\)/)
  assert.match(route, /p\.community_profile_visibility = 'leaderboard'/)
  assert.match(route, /p\.community_profile_visibility <> 'private'/)
  assert.match(route, /p\.community_discoverable = true/)
  assert.doesNotMatch(route.match(/GET\('\/v1\/platform\/leaderboard'[\s\S]*?\n}\)/)?.[0] ?? '', /full_name|avatar_url|phone|email/)
})
