import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { canonicalYoutubeWatchUrl, normalizeYoutubeVideoId, youtubeVideoIdOrNull } from '../src/youtube.js'
import { publicLesson, publicLessonMaterial, parseVideoEventBody } from '../src/routes/platform-learning.js'
import { HttpError } from '../src/http.js'

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const VIDEO_ID = 'dQw4w9WgXcQ'

// --- Acceptance test 1: invalid and lookalike URLs are rejected ------------

test('every accepted YouTube form collapses to the same verified video id', () => {
  const accepted = [
    `https://www.youtube.com/watch?v=${VIDEO_ID}`,
    `https://youtube.com/watch?v=${VIDEO_ID}`,
    `https://m.youtube.com/watch?v=${VIDEO_ID}`,
    `https://youtu.be/${VIDEO_ID}`,
    `https://www.youtube.com/embed/${VIDEO_ID}`,
    `https://www.youtube-nocookie.com/embed/${VIDEO_ID}`,
    `  https://www.youtube.com/watch?v=${VIDEO_ID}  `,
  ]
  for (const value of accepted) {
    assert.equal(normalizeYoutubeVideoId(value), VIDEO_ID, `should accept ${value}`)
  }
})

test('lookalike hosts, protocol tricks and non-video surfaces are rejected', () => {
  const rejected = [
    // Lookalike and embedded-authority hosts.
    `https://youtube.com.attacker.example/watch?v=${VIDEO_ID}`,
    `https://notyoutube.com/watch?v=${VIDEO_ID}`,
    `https://www.youtube.com.evil.test/embed/${VIDEO_ID}`,
    `https://attacker.example/https://www.youtube.com/watch?v=${VIDEO_ID}`,
    `https://user:pass@www.youtube.com/watch?v=${VIDEO_ID}`,
    `https://www.youtube.com:8443/watch?v=${VIDEO_ID}`,
    // Protocol tricks.
    `http://www.youtube.com/watch?v=${VIDEO_ID}`,
    `javascript:alert(1)//www.youtube.com/watch?v=${VIDEO_ID}`,
    `//www.youtube.com/watch?v=${VIDEO_ID}`,
    `data:text/html,<iframe src="https://www.youtube.com/embed/${VIDEO_ID}"></iframe>`,
    // Fragments and playlists.
    `https://www.youtube.com/watch?v=${VIDEO_ID}#t=30`,
    `https://www.youtube.com/watch?v=${VIDEO_ID}&list=PLabcdefghijklmnop`,
    'https://www.youtube.com/playlist?list=PLabcdefghijklmnop',
    // Surfaces without their own reviewed contract.
    `https://www.youtube.com/shorts/${VIDEO_ID}`,
    `https://www.youtube.com/live/${VIDEO_ID}`,
    'https://www.youtube.com/@zhangak',
    'https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv',
    'https://www.youtube.com/results?search_query=ort',
    // Raw markup and malformed ids.
    `<iframe src="https://www.youtube.com/embed/${VIDEO_ID}"></iframe>`,
    'https://www.youtube.com/watch?v=short',
    `https://www.youtube.com/watch?v=${VIDEO_ID}toolong`,
    'https://www.youtube.com/watch',
    'https://youtu.be/',
    `https://youtu.be/${VIDEO_ID}/extra`,
    '',
    null,
    42,
  ]
  for (const value of rejected) {
    assert.throws(() => normalizeYoutubeVideoId(value), HttpError, `should reject ${String(value)}`)
    assert.equal(youtubeVideoIdOrNull(value), null, `probe should also reject ${String(value)}`)
  }
})

test('the stored reference is regenerated from the verified id', () => {
  // Tracking parameters an operator pasted must not survive into the database.
  const id = normalizeYoutubeVideoId(`https://www.youtube.com/watch?v=${VIDEO_ID}&si=track&feature=share`)
  assert.equal(canonicalYoutubeWatchUrl(id), `https://www.youtube.com/watch?v=${VIDEO_ID}`)
  assert.throws(() => canonicalYoutubeWatchUrl('not-an-id'), HttpError)
})

// --- Acceptance test 4: no raw watch URL in a student payload -------------

const YOUTUBE_HOST = /youtube\.com|youtu\.be|youtube-nocookie\.com/

test('an unlocked video lesson exposes a session path, never a watch URL', () => {
  const projected = publicLesson({
    id: '12', course_id: '4', lesson_number: 2, title: 'Дроби', description: 'Сложение',
    subject: 'math', section: 'algebra', topic: 'fractions', lesson_date: null,
    duration_minutes: 35, content_url: `https://www.youtube.com/watch?v=${VIDEO_ID}`,
    video_id: VIDEO_ID, is_test: false, has_active_bound_practice_test: false,
    is_locked: false, completion_percent: 0, completed_at: null, last_viewed_at: null,
  })
  assert.equal(projected.contentUrl, null)
  assert.deepEqual(projected.video, { available: true, sessionPath: '/v1/platform/lessons/12/video' })
  assert.ok(!YOUTUBE_HOST.test(JSON.stringify(projected)), 'lesson payload must not carry a YouTube URL')
  // Admin-only columns must not ride along either.
  for (const field of ['videoId', 'video_id', 'isPublished', 'createdBy', 'scanStatus']) {
    assert.ok(!Object.hasOwn(projected, field), `lesson payload must not expose ${field}`)
  }
})

test('a locked lesson exposes neither the video handle nor the content URL', () => {
  const projected = publicLesson({
    id: '12', course_id: '4', lesson_number: 9, title: 'Позже', description: 'секрет',
    subject: 'math', section: null, topic: null, lesson_date: null, duration_minutes: null,
    content_url: `https://www.youtube.com/watch?v=${VIDEO_ID}`, video_id: VIDEO_ID,
    is_test: false, has_active_bound_practice_test: false, is_locked: true,
    completion_percent: 0, completed_at: null, last_viewed_at: null,
  })
  assert.equal(projected.video, null)
  assert.equal(projected.contentUrl, null)
  assert.equal(projected.description, null)
})

test('a video material exposes a session path and no external URL', () => {
  const projected = publicLessonMaterial({
    id: '77', lesson_id: '12', material_type: 'video', title: 'Разбор', position: 1,
    body_markdown: null, video_id: VIDEO_ID, mime_type: null, byte_size: null,
  })
  assert.deepEqual(projected.video, { available: true, sessionPath: '/v1/platform/materials/77/video' })
  assert.equal(projected.viewerPath, null)
  assert.ok(!Object.hasOwn(projected, 'externalUrl'), 'material payload must not expose externalUrl')
  assert.ok(!YOUTUBE_HOST.test(JSON.stringify(projected)), 'material payload must not carry a YouTube URL')
})

test('a non-YouTube lesson reading keeps its plain external link', () => {
  const projected = publicLesson({
    id: '13', course_id: '4', lesson_number: 3, title: 'Статья', description: null,
    subject: 'math', section: null, topic: null, lesson_date: null, duration_minutes: null,
    content_url: 'https://example.org/reading.pdf', video_id: null, is_test: false,
    has_active_bound_practice_test: false, is_locked: false, completion_percent: 0,
    completed_at: null, last_viewed_at: null,
  })
  assert.equal(projected.contentUrl, 'https://example.org/reading.pdf')
  assert.equal(projected.video, null)
})

// --- Acceptance test 8: a spoofed `ended` buys nothing --------------------

test('a video event body carries no identity, score or reward field', () => {
  const parsed = parseVideoEventBody({ lessonId: 12, materialId: null, event: 'ended', positionSeconds: 610 })
  assert.deepEqual(parsed, { lessonId: 12, materialId: null, event: 'ended', positionSeconds: 610 })

  const forged = [
    { lessonId: 12, materialId: null, event: 'ended', positionSeconds: 0, studentId: 'other-student' },
    { lessonId: 12, materialId: null, event: 'ended', positionSeconds: 0, xp: 500 },
    { lessonId: 12, materialId: null, event: 'completed', positionSeconds: 0 },
    { lessonId: 12, materialId: null, event: 'ended', positionSeconds: -1 },
    { lessonId: 12, materialId: null, event: 'ended', positionSeconds: 86_401 },
    { lessonId: 0, materialId: null, event: 'ended', positionSeconds: 0 },
    { lessonId: 12, materialId: 0, event: 'ended', positionSeconds: 0 },
    { lessonId: 12, event: 'ended', positionSeconds: 0 },
    null,
    [],
  ]
  for (const body of forged) {
    assert.throws(() => parseVideoEventBody(body), HttpError, `should reject ${JSON.stringify(body)}`)
  }
})

test('the video event route never awards XP or completes a lesson', async () => {
  const source = await readFile(path.join(backendRoot, 'src/routes/platform-learning.js'), 'utf8')
  const start = source.indexOf("POST('/v1/platform/video-events'")
  assert.ok(start > 0, 'the video event route must exist')
  // Comments are stripped first: this asserts on what the handler *runs*,
  // not on prose that happens to name the grading helpers.
  const handler = source
    .slice(start, source.indexOf("POST('/v1/platform/lessons/:id/complete'"))
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
  for (const forbidden of ['awardLessonXp', 'completeSelfPacedLesson', 'lesson_progress', 'student_xp_awards']) {
    assert.ok(!handler.includes(forbidden), `video events must not touch ${forbidden}`)
  }
  assert.ok(handler.includes('awardedXp: 0'), 'the response must state plainly that nothing was awarded')

  // The grading paths must not read the analytics table either.
  assert.ok(!source.includes('FROM lesson_video_events'), 'no route may grade from playback events')
})

// --- Acceptance tests 2, 3, 9: the session route re-checks access ---------

test('both video session routes re-check enrollment, publication and the lock', async () => {
  const source = await readFile(path.join(backendRoot, 'src/routes/platform-learning.js'), 'utf8')

  const lessonRoute = source.slice(
    source.indexOf("POST('/v1/platform/lessons/:id/video'"),
    source.indexOf("POST('/v1/platform/materials/:id/video'"),
  )
  // currentStudent enforces authentication, the student role and the online
  // student type; loadAccessibleLesson enforces the active online enrollment
  // and publication; requireUnlockedLesson enforces sequencing.
  assert.ok(lessonRoute.includes('currentStudent(config, req)'), 'lesson video must require a verified session')
  assert.ok(lessonRoute.includes('authorizedLessonVideo'), 'lesson video must go through the shared authorization')

  const materialRoute = source.slice(
    source.indexOf("POST('/v1/platform/materials/:id/video'"),
    source.indexOf("POST('/v1/platform/video-events'"),
  )
  assert.ok(materialRoute.includes('currentStudent(config, req)'), 'material video must require a verified session')
  assert.ok(materialRoute.includes("ce.status = 'active'"), 'material video must require an active enrollment')
  assert.ok(materialRoute.includes("c.delivery_mode = 'online'"), 'material video must require an online course')
  assert.ok(materialRoute.includes('m.is_published = true'), 'material video must require a published material')
  assert.ok(materialRoute.includes("m.scan_status = 'clean'"), 'material video must require a reviewed material')
  assert.ok(materialRoute.includes('l.is_published = true'), 'material video must require a published lesson')
  assert.ok(materialRoute.includes('requireUnlockedLesson'), 'material video must require an unlocked lesson')

  const authorization = source.slice(source.indexOf('async function authorizedLessonVideo'), source.indexOf("POST('/v1/platform/lessons/:id/video'"))
  assert.ok(authorization.includes('requireUnlockedLesson'), 'the shared helper must enforce the lock')
  assert.ok(authorization.includes('loadAccessibleLesson'), 'the shared helper must enforce enrollment')
})

// --- Schema guarantees ----------------------------------------------------

test('migration 015 stores a verified id and grants playback no authority', async () => {
  const migration = await readFile(path.join(backendRoot, 'migrations/015_lesson_video_sources.sql'), 'utf8')
  assert.match(migration, /ALTER TABLE lesson_materials\s+ADD COLUMN video_id text/)
  assert.match(migration, /ALTER TABLE lessons\s+ADD COLUMN video_id text/)
  assert.ok(migration.includes("video_id ~ '^[A-Za-z0-9_-]{11}$'"), 'the id column must be constrained to a real video id')
  assert.ok(migration.includes('lesson_materials_video_id_type'), 'only a video row may carry a video id')
  assert.ok(migration.includes('lesson_video_events_daily_unique'), 'playback events must be idempotent')
  assert.ok(migration.includes("event IN ('started', 'progress', 'ended')"), 'playback events are closed to analytics values')
  // The playback table must not reference any column or table that decides
  // progress. ('started' legitimately contains "star", hence these precise
  // identifiers rather than loose word matching.)
  const schema = migration.replace(/--[^\n]*/g, '')
  for (const forbidden of ['xp_amount', 'student_xp_awards', 'lesson_progress', 'stars', 'score', 'completed_at', 'is_correct']) {
    assert.ok(!schema.includes(forbidden), `the video schema must not reference ${forbidden}`)
  }

  // Forward fix for the 006 defect: its video branch required a literal
  // backslash in the URL (`'^https://(www\\.)?...'` under
  // standard_conforming_strings), so no real YouTube URL could ever be
  // stored. 015 replaces the branch and anchors it on the verified id.
  assert.ok(
    migration.includes('DROP CONSTRAINT lesson_materials_payload_shape'),
    'the unsatisfiable video branch from 006 must be replaced, not left in place',
  )
  assert.ok(
    migration.includes("external_url = 'https://www.youtube.com/watch?v=' || video_id"),
    'the stored URL and the verified id must be constrained to agree',
  )
  // Checked against the comment-stripped schema: the explanation above
  // quotes the broken pattern on purpose.
  assert.ok(
    !/\(www\\\\\.\)\?/.test(schema),
    'the replacement must not repeat the doubled-backslash pattern',
  )

  // Already-applied migrations stay untouched.
  const applied = await readFile(path.join(backendRoot, 'migrations/006_course_delivery_enrollments_and_materials.sql'), 'utf8')
  assert.ok(!applied.includes('video_id'), 'migration 006 must not be edited')
})

test('the admin write path normalizes video references before storing them', async () => {
  const source = await readFile(path.join(backendRoot, 'src/routes/admin-learning.js'), 'utf8')
  assert.ok(source.includes("from '../youtube.js'"), 'admin writes must use the shared normalizer')
  assert.ok(!source.includes('function youtubeUrl('), 'the permissive host-prefix check must be gone')
  assert.ok(source.includes('canonicalYoutubeWatchUrl'), 'the stored URL must be regenerated from the verified id')
  // A client must never be able to set the derived column directly.
  assert.ok(!/MATERIAL_FIELDS = Object\.freeze\(\{[^}]*videoId/s.test(source), 'videoId must not be a client-settable material field')
  assert.ok(!/LESSON_FIELDS = Object\.freeze\(\{[^}]*videoId/s.test(source), 'videoId must not be a client-settable lesson field')
})
