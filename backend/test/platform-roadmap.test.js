import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { publicRoadmapLesson, roadmapStarCount } from '../src/routes/platform-roadmap.js'

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

test('Roadmap uses the agreed 50/75/90 star thresholds', () => {
  assert.equal(roadmapStarCount(0), 0)
  assert.equal(roadmapStarCount(49), 0)
  assert.equal(roadmapStarCount(50), 1)
  assert.equal(roadmapStarCount(74), 1)
  assert.equal(roadmapStarCount(75), 2)
  assert.equal(roadmapStarCount(89), 2)
  assert.equal(roadmapStarCount(90), 3)
  assert.equal(roadmapStarCount(100), 3)
})

test('Roadmap lesson projection keeps answer and private material fields server-side', () => {
  const lesson = publicRoadmapLesson({
    lesson_id: 7, lesson_number: 4, title: 'Проценты', description: 'Разбор темы', subject: 'math',
    section: 'numbers', topic: 'percentages', duration_minutes: 12, is_test: false,
    completion_percent: 0, completed_at: null, is_locked: true, has_active_bound_practice_test: false,
    correct_answer: 'a', explanation: 'Private', content_url: 'https://private.example/material.pdf',
  })
  assert.deepEqual(lesson, {
    id: 7, lessonNumber: 4, title: 'Проценты', description: null, subject: 'math', section: 'numbers', topic: 'percentages',
    durationMinutes: 12, isTest: false, completionMode: 'self', completionPercent: 0, completedAt: null,
    isLocked: true, state: 'locked', isCurrent: false,
  })
  for (const key of ['correctAnswer', 'correct_answer', 'explanation', 'contentUrl', 'content_url']) {
    assert.equal(Object.hasOwn(lesson, key), false)
  }
})

test('Roadmap keeps the earned test score after a lesson is completed', () => {
  const lesson = publicRoadmapLesson({
    lesson_id: 8, lesson_number: 5, title: 'Проценты: тест', description: null, subject: 'math',
    section: 'numbers', topic: 'percentages', duration_minutes: 10, is_test: true,
    completion_percent: 70, completed_at: '2026-08-21T08:00:00.000Z', is_locked: false, has_active_bound_practice_test: true,
  })
  assert.equal(lesson.state, 'done')
  assert.equal(lesson.completionPercent, 70)
  assert.equal(roadmapStarCount(lesson.completionPercent), 1)
})

test('Roadmap exposes legacy display labels through canonical subject paths', () => {
  const math = publicRoadmapLesson({
    lesson_id: 9, lesson_number: 2, title: 'Алгебра', description: null, subject: 'Математика',
    section: null, topic: null, duration_minutes: 10, is_test: false,
    completion_percent: 0, completed_at: null, is_locked: false, has_active_bound_practice_test: false,
  })
  const kyr = publicRoadmapLesson({
    lesson_id: 10, lesson_number: 1, title: 'Грамматика', description: null, subject: 'Кыргыз тил',
    section: null, topic: null, duration_minutes: 10, is_test: false,
    completion_percent: 0, completed_at: null, is_locked: false, has_active_bound_practice_test: false,
  })
  assert.equal(math.subject, 'math')
  assert.equal(kyr.subject, 'kyr')
})

test('Roadmap route is first-party, enrollment-scoped and preserves the global unit lock', async () => {
  const route = await readFile(path.join(backendRoot, 'src', 'routes', 'platform-roadmap.js'), 'utf8')
  const learning = await readFile(path.join(backendRoot, 'src', 'routes', 'platform-learning.js'), 'utf8')
  assert.match(route, /GET\('\/v1\/platform\/roadmap'/)
  assert.match(route, /course_enrollments ce/)
  assert.match(route, /c\.delivery_mode = 'online'/)
  assert.match(route, /course_unit_lessons previous_item/)
  assert.match(route, /previous_progress\.completed_at IS NULL/)
  assert.match(route, /direction: 'bottom_to_top'/)
  assert.doesNotMatch(route, /correct_answer|content_url/)
  assert.match(learning, /course_unit_lessons current_item/)
  assert.match(learning, /previous_unit\.unit_number < current_unit\.unit_number/)
})

test('lesson test scores may be completed below 100 so roadmap stars stay honest', async () => {
  const migration = await readFile(path.join(backendRoot, 'migrations', '025_lesson_test_score_progress.sql'), 'utf8')
  assert.match(migration, /DROP CONSTRAINT IF EXISTS lesson_progress_completed/)
  assert.match(migration, /completed_at IS NULL OR completion_percent BETWEEN 0 AND 100/)
})

// --- Regression: the three contract breaks that blanked the live Roadmap ---
//
// Reproduced on 2026-08-22 against a disposable PostgreSQL seeded with
// production-like curriculum rows. The route returned HTTP 200 with a valid
// body, and the strict client parser rejected it, so the page fell back to
// "Не удалось загрузить дорожную карту курса" while the dashboard kept working.
// Each break below was independently sufficient to blank the whole map.

test('a blank legacy description is projected as null, not an empty string', () => {
  // `lessons.description` only constrains length, so '' is storable — unlike
  // section/topic/subject, which the schema guards with btrim(...) >= 1.
  const lesson = publicRoadmapLesson({
    lesson_id: 2, lesson_number: 2, title: 'Урок', description: '   ',
    subject: 'math', section: 'Числа', topic: 'Дроби', duration_minutes: 20,
    is_test: false, has_active_bound_practice_test: false,
    completion_percent: 0, completed_at: null, is_locked: false,
  })
  assert.equal(lesson.description, null, 'a blank description must not reach the client as ""')
})

test('a completed lesson is never reported as locked', () => {
  // `is_locked` is derived only from unfinished predecessors, so an
  // out-of-order completion produced state 'done' together with isLocked true.
  // That pair is self-contradictory and the client refuses it.
  const lesson = publicRoadmapLesson({
    lesson_id: 3, lesson_number: 3, title: 'Урок', description: null,
    subject: 'math', section: null, topic: null, duration_minutes: null,
    is_test: false, has_active_bound_practice_test: false,
    completion_percent: 100, completed_at: '2026-08-20T22:00:12.804Z',
    is_locked: true,
  })
  assert.equal(lesson.state, 'done')
  assert.equal(lesson.isLocked, false, 'a finished lesson cannot also be locked')
})

test('a locked, unfinished lesson still withholds its description', () => {
  const lesson = publicRoadmapLesson({
    lesson_id: 9, lesson_number: 9, title: 'Будущий урок', description: 'секрет',
    subject: 'math', section: null, topic: null, duration_minutes: 20,
    is_test: false, has_active_bound_practice_test: false,
    completion_percent: 0, completed_at: null, is_locked: true,
  })
  assert.equal(lesson.state, 'locked')
  assert.equal(lesson.isLocked, true)
  assert.equal(lesson.description, null)
})

test('the roadmap route never projects an answer key', async () => {
  const source = await readFile(path.join(backendRoot, 'src/routes/platform-roadmap.js'), 'utf8')
  for (const forbidden of ['correct_answer', 'correctAnswer', 'explanation']) {
    assert.ok(!source.includes(forbidden), `the roadmap must not touch ${forbidden}`)
  }
})
