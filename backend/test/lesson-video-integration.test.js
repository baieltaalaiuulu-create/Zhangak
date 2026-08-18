import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { closeDatabase, connectDatabase, query } from '../src/db.js'
import { HttpError } from '../src/http.js'

/**
 * Integration coverage for the lesson video authorization and the migration
 * 015 quarantine/repair flow, executed against a real PostgreSQL.
 *
 * These assertions cannot be made against SQL text: the point is what the
 * database actually accepts and what the authorization SQL actually returns.
 *
 * Set `ZHANGAK_TEST_DATABASE_URL` to a **disposable** database. The suite
 * creates and drops its own objects and must never be pointed at production.
 * Without the variable the tests skip loudly rather than pretending to pass.
 */

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const databaseUrl = process.env.ZHANGAK_TEST_DATABASE_URL?.trim()
const skip = databaseUrl
  ? false
  : 'ZHANGAK_TEST_DATABASE_URL is not set; disposable PostgreSQL integration tests were not executed'

const VIDEO_A = 'aaaaaaaaaaa'
const VIDEO_B = 'bbbbbbbbbbb'
const STUDENT_A = '00000000-0000-4000-8000-00000000000a'
const STUDENT_B = '00000000-0000-4000-8000-00000000000b'

/**
 * Refuses to touch anything that does not look disposable.
 *
 * This suite resets the `public` schema, which is destructive. The name guard
 * is the difference between a rerunnable test and an accident: a URL without
 * an obviously disposable database name is rejected outright rather than
 * trusted.
 */
function assertDisposable(url) {
  const parsed = new URL(url)
  const name = parsed.pathname.replace(/^\//, '')
  // A database called `something_test` can still be a remote shared service.
  // This suite drops the whole public schema, so a disposable-looking name is
  // not enough: execution is allowed only through a loopback connection. An
  // SSH tunnel to an isolated test database still satisfies this boundary.
  if (!['127.0.0.1', 'localhost', '::1'].includes(parsed.hostname)) {
    throw new Error(`Refusing remote database host "${parsed.hostname}": ZHANGAK_TEST_DATABASE_URL must use loopback`)
  }
  if (!/(test|ci|disposable|verify)/i.test(name)) {
    throw new Error(`Refusing to reset database "${name}": ZHANGAK_TEST_DATABASE_URL must name a disposable database`)
  }
  return name
}

test('destructive video integration guard accepts only loopback disposable databases', () => {
  assert.equal(
    assertDisposable('postgresql://tester:secret@127.0.0.1:5432/zhangak_video_test'),
    'zhangak_video_test',
  )
  assert.equal(
    assertDisposable('postgresql://tester:secret@localhost:5432/zhangak_ci'),
    'zhangak_ci',
  )
  assert.throws(
    () => assertDisposable('postgresql://tester:secret@db.example.com:5432/zhangak_test'),
    /Refusing remote database host/,
  )
  assert.throws(
    () => assertDisposable('postgresql://tester:secret@127.0.0.1:5432/zhangak'),
    /must name a disposable database/,
  )
})

async function resetSchema() {
  await query('DROP SCHEMA public CASCADE')
  await query('CREATE SCHEMA public')
}

async function migrationFiles() {
  const directory = path.join(backendRoot, 'migrations')
  return (await readdir(directory)).filter(name => name.endsWith('.sql')).sort()
}

async function applyMigrations(files = null) {
  const directory = path.join(backendRoot, 'migrations')
  const selected = files ?? await migrationFiles()
  for (const file of selected) {
    await query(await readFile(path.join(directory, file), 'utf8'))
  }
  return selected
}

/**
 * Two courses, two students, and a lesson shape that reproduces the defect
 * this suite exists for: `lessonMaterialOnly` owns no video of its own but
 * carries a published video material.
 */
async function seed() {
  await query(
    `INSERT INTO users (id, email, password_hash) VALUES
       ($1, 'a@test.invalid', 'x'), ($2, 'b@test.invalid', 'x')`,
    [STUDENT_A, STUDENT_B],
  )
  await query(
    `INSERT INTO profiles (user_id, full_name, role, student_type)
     VALUES ($1, 'A', 'student', 'online'), ($2, 'B', 'student', 'online')`,
    [STUDENT_A, STUDENT_B],
  )
  await query(`INSERT INTO courses (id, name) OVERRIDING SYSTEM VALUE VALUES (1, 'Course A'), (2, 'Course B')`)
  await query(
    `INSERT INTO course_enrollments (student_id, course_id, status) VALUES ($1, 1, 'active'), ($2, 2, 'active')`,
    [STUDENT_A, STUDENT_B],
  )
  await query(
    `INSERT INTO lessons (id, course_id, lesson_number, title, content_url, video_id, is_published)
     OVERRIDING SYSTEM VALUE VALUES
       (1, 1, 1, 'Lesson with own video', $1, $2, true),
       (2, 1, 2, 'Lesson with material only', NULL, NULL, true),
       (3, 2, 1, 'Other course lesson', NULL, NULL, true)`,
    [`https://www.youtube.com/watch?v=${VIDEO_A}`, VIDEO_A],
  )
  // Lesson 1 is completed so lesson 2 is unlocked for student A.
  await query(
    `INSERT INTO lesson_progress (student_id, lesson_id, completion_percent, completed_at)
     VALUES ($1, 1, 100, now())`,
    [STUDENT_A],
  )
  await query(
    `INSERT INTO lesson_materials (id, lesson_id, material_type, title, position, external_url, video_id, is_published, scan_status, scanned_at, scanned_by)
     OVERRIDING SYSTEM VALUE VALUES
       (10, 2, 'video', 'Published material video', 1, $1, $2, true, 'clean', now(), $4),
       (11, 2, 'video', 'Unpublished material video', 2, $1, $2, false, 'clean', now(), $4),
       (12, 3, 'video', 'Other course material', 1, $3, $2, true, 'clean', now(), $4)`,
    [`https://www.youtube.com/watch?v=${VIDEO_B}`, VIDEO_B, `https://www.youtube.com/watch?v=${VIDEO_B}`, STUDENT_A],
  )
}

async function rejectsWith(promise, code) {
  await assert.rejects(promise, error => {
    assert.ok(error instanceof HttpError, `expected HttpError, got ${error}`)
    assert.equal(error.code, code)
    return true
  })
}

test('lesson video authorization and quarantine repair', { skip }, async t => {
  assertDisposable(databaseUrl)
  connectDatabase({ databaseUrl, databaseSsl: false })
  t.after(async () => { await closeDatabase() })
  const { authorizedVideoSource } = await import('../src/routes/platform-learning.js')
  const files = await migrationFiles()

  // Prove the actual forward transition, not just the final constraint. Apply
  // 001-014, create representative legacy rows, then apply 015 by itself.
  await resetSchema()
  const beforeVideo = files.filter(file => file !== '015_lesson_video_sources.sql')
  await applyMigrations(beforeVideo)
  await query(`INSERT INTO courses (id, name) OVERRIDING SYSTEM VALUE VALUES (90, 'Legacy video course')`)
  await query(
    `INSERT INTO lessons (id, course_id, lesson_number, title, content_url, is_published)
     OVERRIDING SYSTEM VALUE VALUES
       (90, 90, 1, 'Legacy canonical lesson', $1, true),
       (91, 90, 2, 'Legacy quarantined lesson', $2, true)`,
    [`https://youtu.be/${VIDEO_A}`, 'https://www.youtube.com/playlist?list=PLlegacy'],
  )
  // Migration 006's historical regex accepted a literal backslash in the
  // hostname and rejected genuine YouTube material URLs. This row reproduces
  // the only invalid legacy shape that old constraint could persist.
  await query(
    `INSERT INTO lesson_materials
       (id, lesson_id, material_type, title, position, external_url, is_published, scan_status)
     OVERRIDING SYSTEM VALUE VALUES
       (90, 91, 'video', 'Legacy invalid material', 1, $1, true, 'pending')`,
    ['https://youtube\\.com/playlist?list=PLlegacy'],
  )
  await applyMigrations(['015_lesson_video_sources.sql'])

  await t.test('migration 015 backfills valid legacy lessons and quarantines invalid sources', async () => {
    const lessons = await query(
      `SELECT id, content_url, video_id, video_quarantined FROM lessons WHERE id IN (90, 91) ORDER BY id`,
    )
    assert.deepEqual(lessons.rows, [
      {
        id: '90',
        content_url: `https://www.youtube.com/watch?v=${VIDEO_A}`,
        video_id: VIDEO_A,
        video_quarantined: false,
      },
      {
        id: '91',
        content_url: 'https://www.youtube.com/playlist?list=PLlegacy',
        video_id: null,
        video_quarantined: true,
      },
    ])
    const material = await query(
      'SELECT external_url, video_id, is_published FROM lesson_materials WHERE id = 90',
    )
    assert.deepEqual(material.rows[0], {
      external_url: 'https://youtube\\.com/playlist?list=PLlegacy',
      video_id: null,
      is_published: false,
    })
  })

  // Reset again so the authorization lifecycle below runs on a clean final
  // schema and remains independently rerunnable.
  await resetSchema()
  const applied = await applyMigrations(files)
  await seed()

  const studentA = { id: STUDENT_A }
  const studentB = { id: STUDENT_B }

  await t.test('all migrations applied', () => {
    assert.ok(applied.includes('015_lesson_video_sources.sql'), 'migration 015 must be part of the ledger')
  })

  // --- F2 regression: the defect this fix exists for ---------------------

  await t.test('a material-owned video resolves on a lesson that owns no video', async () => {
    // Before the fix this threw video_not_found because the lesson had no
    // video_id of its own, so no playback event could ever be recorded.
    const source = await authorizedVideoSource(studentA, 2, 10)
    assert.deepEqual(source, { videoId: VIDEO_B, title: 'Published material video' })
  })

  await t.test('the same lesson still refuses a lesson-level video it does not have', async () => {
    await rejectsWith(authorizedVideoSource(studentA, 2, null), 'video_not_found')
  })

  await t.test('a lesson that owns a video resolves without a material', async () => {
    const source = await authorizedVideoSource(studentA, 1, null)
    assert.deepEqual(source, { videoId: VIDEO_A, title: 'Lesson with own video' })
  })

  // --- Ownership and isolation ------------------------------------------

  await t.test('a material from another lesson is refused', async () => {
    await rejectsWith(authorizedVideoSource(studentA, 2, 12), 'video_not_found')
  })

  await t.test('an unpublished material is refused', async () => {
    await rejectsWith(authorizedVideoSource(studentA, 2, 11), 'video_not_found')
  })

  await t.test('a student cannot reach another course', async () => {
    await rejectsWith(authorizedVideoSource(studentB, 2, 10), 'lesson_not_found')
    await rejectsWith(authorizedVideoSource(studentA, 3, 12), 'lesson_not_found')
  })

  await t.test('a suspended enrollment loses access immediately', async () => {
    await query(`UPDATE course_enrollments SET status = 'suspended' WHERE student_id = $1`, [STUDENT_A])
    await rejectsWith(authorizedVideoSource(studentA, 2, 10), 'lesson_not_found')
    await query(`UPDATE course_enrollments SET status = 'active' WHERE student_id = $1`, [STUDENT_A])
  })

  await t.test('a locked lesson is refused even with a valid material', async () => {
    await query(`DELETE FROM lesson_progress WHERE student_id = $1`, [STUDENT_A])
    await rejectsWith(authorizedVideoSource(studentA, 2, 10), 'lesson_locked')
    await query(
      `INSERT INTO lesson_progress (student_id, lesson_id, completion_percent, completed_at)
       VALUES ($1, 1, 100, now())`,
      [STUDENT_A],
    )
  })

  await t.test('an unpublished lesson is refused', async () => {
    await query('UPDATE lessons SET is_published = false WHERE id = 2')
    await rejectsWith(authorizedVideoSource(studentA, 2, 10), 'lesson_not_found')
    await query('UPDATE lessons SET is_published = true WHERE id = 2')
  })

  // --- F3: quarantine, publish refusal, and repair ----------------------

  await t.test('a canonical video row is accepted', async () => {
    await query(
      `INSERT INTO lesson_materials (id, lesson_id, material_type, title, position, external_url, video_id, is_published, scan_status, scanned_at, scanned_by)
       OVERRIDING SYSTEM VALUE VALUES (20, 2, 'video', 'Canonical', 20, $1, $2, true, 'clean', now(), $3)`,
      [`https://www.youtube.com/watch?v=${VIDEO_A}`, VIDEO_A, STUDENT_A],
    )
    const row = await query('SELECT video_id FROM lesson_materials WHERE id = 20')
    assert.equal(row.rows[0].video_id, VIDEO_A)
  })

  await t.test('a URL that disagrees with the id is rejected by the database', async () => {
    await assert.rejects(
      query(
        `INSERT INTO lesson_materials (lesson_id, material_type, title, position, external_url, video_id, is_published, scan_status, scanned_at, scanned_by)
         VALUES (2, 'video', 'Mismatch', 21, $1, $2, false, 'clean', now(), $3)`,
        [`https://www.youtube.com/watch?v=${VIDEO_A}`, VIDEO_B, STUDENT_A],
      ),
      /lesson_materials_payload_shape/,
    )
  })

  await t.test('a quarantined row is storable only while unpublished', async () => {
    // Preserved, not deleted, and not guessed at.
    await query(
      `INSERT INTO lesson_materials (id, lesson_id, material_type, title, position, external_url, video_id, is_published, scan_status, scanned_at, scanned_by)
       OVERRIDING SYSTEM VALUE VALUES (22, 2, 'video', 'Quarantined', 22, $1, NULL, false, 'clean', now(), $2)`,
      ['https://www.youtube.com/playlist?list=PLbroken', STUDENT_A],
    )
    const stored = await query('SELECT external_url, video_id, is_published FROM lesson_materials WHERE id = 22')
    assert.equal(stored.rows[0].external_url, 'https://www.youtube.com/playlist?list=PLbroken', 'the original reference is preserved')
    assert.equal(stored.rows[0].video_id, null)
    assert.equal(stored.rows[0].is_published, false)
  })

  await t.test('publishing a quarantined row is refused by the database', async () => {
    await assert.rejects(
      query('UPDATE lesson_materials SET is_published = true WHERE id = 22'),
      /lesson_materials_payload_shape/,
    )
  })

  await t.test('a quarantined row is never served to a student', async () => {
    await rejectsWith(authorizedVideoSource(studentA, 2, 22), 'video_not_found')
  })

  await t.test('repair restores the canonical state and then publishing succeeds', async () => {
    await query(
      `UPDATE lesson_materials SET external_url = $1, video_id = $2 WHERE id = 22`,
      [`https://www.youtube.com/watch?v=${VIDEO_A}`, VIDEO_A],
    )
    await query('UPDATE lesson_materials SET is_published = true WHERE id = 22')
    const source = await authorizedVideoSource(studentA, 2, 22)
    assert.equal(source.videoId, VIDEO_A, 'a repaired row becomes playable')
  })

  // --- Playback events stay idempotent ----------------------------------

  await t.test('replaying an event keeps one row and the furthest position', async () => {
    const insert = position => query(
      `INSERT INTO lesson_video_events (student_id, lesson_id, material_id, video_id, event, position_seconds)
       VALUES ($1, 2, 10, $2, 'ended', $3)
       ON CONFLICT (student_id, lesson_id, COALESCE(material_id, 0), video_id, event, occurred_on)
       DO UPDATE SET position_seconds = GREATEST(lesson_video_events.position_seconds, EXCLUDED.position_seconds)`,
      [STUDENT_A, VIDEO_B, position],
    )
    await insert(120)
    await insert(45)
    const rows = await query('SELECT count(*)::int AS n, max(position_seconds)::int AS furthest FROM lesson_video_events')
    assert.equal(rows.rows[0].n, 1)
    assert.equal(rows.rows[0].furthest, 120)
  })

  await t.test('the lesson-level series stays distinct from a material series', async () => {
    await query(
      `INSERT INTO lesson_video_events (student_id, lesson_id, material_id, video_id, event, position_seconds)
       VALUES ($1, 2, NULL, $2, 'ended', 10)
       ON CONFLICT (student_id, lesson_id, COALESCE(material_id, 0), video_id, event, occurred_on) DO NOTHING`,
      [STUDENT_A, VIDEO_B],
    )
    const rows = await query('SELECT count(*)::int AS n FROM lesson_video_events')
    assert.equal(rows.rows[0].n, 2, 'a NULL material must not collide with a material row')
  })
})
