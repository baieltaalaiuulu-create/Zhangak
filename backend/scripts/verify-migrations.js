import { createHash } from 'node:crypto'
import { spawn } from 'node:child_process'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import pg from 'pg'

const { Client } = pg
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const migrationsDirectory = path.join(root, 'migrations')
const migrationName = /^(\d+)_[a-z0-9_-]+\.sql$/i
const requiredTables = [
  'users',
  'profiles',
  'auth_sessions',
  'auth_login_attempts',
  'audit_log',
  'courses',
  'groups',
  'group_students',
  'lessons',
  'lesson_progress',
  'practice_tests',
  'practice_questions',
  'practice_attempts',
  'practice_attempt_items',
  'legacy_content_imports',
  'universities',
  'university_specialties',
  'university_advantages',
  'offline_class_sessions',
  'offline_attendance_records',
  'offline_homework',
  'offline_homework_submissions',
  'offline_grades',
  'offline_comments',
  'offline_announcements',
  'lesson_materials',
  'student_xp_awards',
  'daily_challenges',
  'daily_challenge_questions',
  'daily_challenge_attempts',
  'trainer_answers',
  'trainer_question_issues',
  'trainer_question_mastery',
  'trainer_progress_resets',
  'course_units',
  'course_unit_lessons',
  'public_applications',
  'public_application_events',
  'ai_consents',
  'ai_conversations',
  'ai_messages',
  'push_subscriptions',
  'student_xp_totals',
  'gamification_events',
  'quest_definitions',
  'quest_definition_revisions',
  'quest_instances',
  'student_quest_progress',
  'achievement_definitions',
  'student_achievements',
  'profile_cosmetic_definitions',
  'student_profile_cosmetics',
  'student_featured_achievements',
  'student_social_friendships',
  'student_social_blocks',
]

function fail(message) {
  throw new Error(`Migration verification failed: ${message}`)
}

function runMigrator(pass) {
  return new Promise((resolve, reject) => {
    console.log(`Running first-party migrator (${pass})...`)
    const child = spawn(process.execPath, [path.join(root, 'scripts', 'migrate.js')], {
      cwd: root,
      env: process.env,
      stdio: 'inherit',
    })

    child.once('error', reject)
    child.once('exit', code => {
      if (code === 0) resolve()
      else reject(new Error(`migrate.js exited with code ${code ?? 'unknown'}`))
    })
  })
}

async function loadExpectedMigrations() {
  const files = (await readdir(migrationsDirectory, { withFileTypes: true }))
    .filter(entry => entry.isFile() && entry.name.endsWith('.sql'))
    .map(entry => entry.name)
    .sort()

  if (files.length === 0) fail('no executable migration files were found')

  const versions = new Set()
  for (const file of files) {
    const match = migrationName.exec(file)
    if (!match) fail(`invalid migration filename: ${file}`)
    if (versions.has(match[1])) fail(`duplicate migration version: ${match[1]}`)
    versions.add(match[1])
  }

  return Promise.all(files.map(async version => {
    const source = await readFile(path.join(migrationsDirectory, version), 'utf8')
    return {
      version,
      checksum: createHash('sha256').update(source).digest('hex'),
    }
  }))
}

function assertSameMigrations(expected, actual) {
  if (actual.length !== expected.length) {
    fail(`expected ${expected.length} migration ledger entries, found ${actual.length}`)
  }

  for (let index = 0; index < expected.length; index += 1) {
    const expectedEntry = expected[index]
    const actualEntry = actual[index]
    if (actualEntry.version !== expectedEntry.version) {
      fail(`migration ledger mismatch at position ${index + 1}: expected ${expectedEntry.version}, found ${actualEntry.version}`)
    }
    if (actualEntry.checksum !== expectedEntry.checksum) {
      fail(`migration checksum mismatch for ${expectedEntry.version}`)
    }
    if (!actualEntry.applied_at) {
      fail(`migration ledger entry has no applied_at timestamp: ${expectedEntry.version}`)
    }
  }
}

async function verifySchema(client) {
  const tableResult = await client.query(
    `SELECT table_name
       FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
        AND table_name = ANY($1::text[])`,
    [requiredTables],
  )
  const presentTables = new Set(tableResult.rows.map(row => row.table_name))
  const missingTables = requiredTables.filter(table => !presentTables.has(table))
  if (missingTables.length > 0) fail(`required tables are missing: ${missingTables.join(', ')}`)

  const profileColumns = [
    'profile_color', 'daily_study_goal_minutes', 'public_profile_id', 'community_visibility',
    'community_display_name', 'community_profile_visibility', 'community_show_xp',
    'community_show_achievements', 'community_show_streak', 'community_allow_friend_requests',
    'community_discoverable', 'profile_frame_code', 'profile_background_code', 'profile_title_code',
  ]
  const columnResult = await client.query(
    `SELECT column_name
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'profiles'
        AND column_name = ANY($1::text[])`,
    [profileColumns],
  )
  const presentColumns = new Set(columnResult.rows.map(row => row.column_name))
  const missingColumns = profileColumns.filter(column => !presentColumns.has(column))
  if (missingColumns.length > 0) fail(`latest profile preference columns are missing: ${missingColumns.join(', ')}`)

  const materialColumns = ['scan_status', 'scanned_at', 'scanned_by', 'original_filename', 'content_sha256']
  const materialResult = await client.query(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'lesson_materials'
        AND column_name = ANY($1::text[])`,
    [materialColumns],
  )
  const presentMaterialColumns = new Set(materialResult.rows.map(row => row.column_name))
  const missingMaterialColumns = materialColumns.filter(column => !presentMaterialColumns.has(column))
  if (missingMaterialColumns.length > 0) fail(`private material columns are missing: ${missingMaterialColumns.join(', ')}`)

  const applicationColumns = ['status', 'course_id', 'enrollment_id', 'payment_confirmed_at', 'payment_confirmed_by']
  const applicationResult = await client.query(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'public_applications'
        AND column_name = ANY($1::text[])`,
    [applicationColumns],
  )
  const presentApplicationColumns = new Set(applicationResult.rows.map(row => row.column_name))
  const missingApplicationColumns = applicationColumns.filter(column => !presentApplicationColumns.has(column))
  if (missingApplicationColumns.length > 0) fail(`public application columns are missing: ${missingApplicationColumns.join(', ')}`)
}

async function main() {
  if (!process.env.DATABASE_URL?.trim()) fail('DATABASE_URL is required for an isolated test database')

  const expected = await loadExpectedMigrations()
  await runMigrator('first pass')
  await runMigrator('repeat-safe second pass')

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === '1' ? { rejectUnauthorized: true } : false,
  })

  try {
    await client.connect()
    const ledger = await client.query(
      'SELECT version, checksum, applied_at FROM schema_migrations ORDER BY version',
    )
    assertSameMigrations(expected, ledger.rows)
    await verifySchema(client)
  } finally {
    await client.end().catch(() => {})
  }

  console.log(`Migration integration verification passed (${expected.length} migrations, two migrator passes).`)
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
