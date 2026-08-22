import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  parsePracticeQuestionCreateBody,
  parseQuestionCatalogQuery,
  parsePracticeQuestionPatchBody,
  parsePracticeTestCreateBody,
  parsePracticeTestPatchBody,
} from '../src/routes/admin-assessments.js'
import { HttpError } from '../src/http.js'

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function invalid(parser, body, code) {
  assert.throws(
    () => parser(body),
    error => error instanceof HttpError && error.status === 400 && error.code === code,
  )
}

test('assessment administration validates a bounded, unpublish-by-default test shape', () => {
  assert.deepEqual(parsePracticeTestCreateBody({
    title: '  Диагностика ОРТ  ',
    subject: 'Математика',
    testType: 'diagnostic',
    description: 'Проверка базы.',
    timeLimitSeconds: 3_600,
    maxAttempts: 2,
    passScoreRatio: 0.725,
    availableFrom: '2026-09-01T08:00:00+06:00',
    availableUntil: '2026-09-30T08:00:00+06:00',
  }), {
    title: 'Диагностика ОРТ',
    subject: 'Математика',
    testType: 'diagnostic',
    description: 'Проверка базы.',
    timeLimitSeconds: 3_600,
    maxAttempts: 2,
    passScoreRatio: 0.725,
    isPublished: false,
    availableFrom: '2026-09-01T02:00:00.000Z',
    availableUntil: '2026-09-30T02:00:00.000Z',
  })
  assert.deepEqual(parsePracticeTestPatchBody({ isPublished: false, availableUntil: null }), {
    isPublished: false,
    availableUntil: null,
  })
})

test('test administration rejects relationship injection, invalid windows, and lossy scores', () => {
  invalid(parsePracticeTestCreateBody, { title: 'Тест', subject: 'ОРТ', courseId: 44 }, 'invalid_practice_test')
  invalid(parsePracticeTestCreateBody, { title: 'Тест', subject: 'ОРТ', lessonId: 44 }, 'invalid_practice_test')
  invalid(parsePracticeTestCreateBody, { title: 'Тест', subject: 'ОРТ', availableFrom: '2026-02-29T00:00:00Z' }, 'invalid_practice_test_available_from')
  invalid(parsePracticeTestCreateBody, {
    title: 'Тест',
    subject: 'ОРТ',
    availableFrom: '2026-09-02T00:00:00Z',
    availableUntil: '2026-09-02T00:00:00Z',
  }, 'invalid_practice_test_availability')
  invalid(parsePracticeTestCreateBody, { title: 'Тест', subject: 'ОРТ', passScoreRatio: 0.12345 }, 'invalid_practice_test_pass_score_ratio')
  invalid(parsePracticeTestPatchBody, {}, 'invalid_practice_test_patch')
  invalid(parsePracticeTestPatchBody, { isPublished: 'true' }, 'invalid_practice_test_published')
})

test('question administration accepts exactly four normalized choices and a key', () => {
  assert.deepEqual(parsePracticeQuestionCreateBody({
    questionText: '  2 + 2 = ? ',
    options: { a: ' 3 ', b: ' 4 ', c: '5', d: '6' },
    correctAnswer: 'b',
    explanation: '  Сложите два и два. ',
    section: ' Algebra ',
    topic: 'Сложение',
    difficulty: 'easy',
    imageUrl: 'https://cdn.zhangak.com/questions/2-plus-2.webp',
    position: 1,
    isActive: false,
  }), {
    questionText: '2 + 2 = ?',
    options: { a: '3', b: '4', c: '5', d: '6' },
    correctAnswer: 'b',
    explanation: 'Сложите два и два.',
    section: 'algebra',
    topic: 'Сложение',
    difficulty: 'easy',
    imageUrl: 'https://cdn.zhangak.com/questions/2-plus-2.webp',
    position: 1,
    isActive: false,
  })
  assert.deepEqual(parsePracticeQuestionPatchBody({ explanation: null, section: null, isActive: true }), {
    explanation: null,
    section: 'general',
    isActive: true,
  })
})

test('question administration fails closed for extra choices, forged ownership, and invalid answer keys', () => {
  const base = {
    questionText: 'Вопрос',
    options: { a: 'A', b: 'B', c: 'C', d: 'D' },
    correctAnswer: 'a',
    position: 1,
  }
  invalid(parsePracticeQuestionCreateBody, { ...base, practiceTestId: 88 }, 'invalid_practice_question')
  invalid(parsePracticeQuestionCreateBody, { ...base, options: { ...base.options, e: 'E' } }, 'invalid_practice_question_options')
  invalid(parsePracticeQuestionCreateBody, { ...base, correctAnswer: 'e' }, 'invalid_practice_question_correct_answer')
  invalid(parsePracticeQuestionCreateBody, { ...base, section: 'На русском' }, 'invalid_practice_question_section')
  invalid(parsePracticeQuestionCreateBody, { ...base, imageUrl: 'http://example.test/q.png' }, 'invalid_practice_question_image_url')
  invalid(parsePracticeQuestionPatchBody, {}, 'invalid_practice_question_patch')
  invalid(parsePracticeQuestionPatchBody, { isActive: 1 }, 'invalid_practice_question_active')
})

test('assessment routes are first-party, role-gated, audited, and keep key reads out of student APIs', async () => {
  const [route, server, studentRoute] = await Promise.all([
    readFile(path.join(backendRoot, 'src', 'routes', 'admin-assessments.js'), 'utf8'),
    readFile(path.join(backendRoot, 'src', 'server.js'), 'utf8'),
    readFile(path.join(backendRoot, 'src', 'routes', 'platform-learning.js'), 'utf8'),
  ])
  assert.match(server, /import '\.\/routes\/admin-assessments\.js'/)
  assert.match(route, /CONTENT_MANAGER_ROLES = \['admin', 'super_admin'\]/)
  assert.match(route, /GET\('\/v1\/admin\/courses\/:courseId\/practice-tests'/)
  assert.match(route, /POST\('\/v1\/admin\/courses\/:courseId\/practice-tests'/)
  assert.match(route, /GET\('\/v1\/admin\/lessons\/:lessonId\/practice-tests'/)
  assert.match(route, /POST\('\/v1\/admin\/lessons\/:lessonId\/practice-tests'/)
  assert.match(route, /PATCH\('\/v1\/admin\/practice-tests\/:testId'/)
  assert.match(route, /GET\('\/v1\/admin\/practice-tests\/:testId\/questions'/)
  assert.match(route, /POST\('\/v1\/admin\/practice-tests\/:testId\/questions'/)
  assert.match(route, /PATCH\('\/v1\/admin\/practice-questions\/:questionId'/)
  assert.match(route, /INSERT INTO audit_log/)
  assert.match(route, /published_test_requires_question/)
  assert.match(route, /FOR UPDATE OF q, t/)
  assert.doesNotMatch(route, /supabase/i)
  assert.doesNotMatch(route, /DELETE\('/)
  assert.match(studentRoute, /publicAttemptQuestion/)
  assert.match(studentRoute, /correct_answer, explanation, selected_answer, is_correct,/)
})

// --- Question catalogue: server-side search, filters and pagination --------

test('question catalogue filters are validated, never silently ignored', () => {
  const params = value => new URLSearchParams(value)

  assert.deepEqual(parseQuestionCatalogQuery(params('')), {
    status: 'all', difficulty: null, search: null, section: null,
  })
  assert.deepEqual(parseQuestionCatalogQuery(params('status=archived&difficulty=hard&section=algebra&q=%20дроби%20')), {
    status: 'archived', difficulty: 'hard', section: 'algebra', search: 'дроби',
  })
  // Blank values mean "no filter" rather than a filter that matches nothing.
  assert.deepEqual(parseQuestionCatalogQuery(params('q=%20%20&section=&difficulty=')), {
    status: 'all', difficulty: null, search: null, section: null,
  })

  const rejected = [
    ['status=deleted', 'invalid_question_status_filter'],
    ['status=Active', 'invalid_question_status_filter'],
    ['difficulty=impossible', 'invalid_question_difficulty_filter'],
    [`q=${'x'.repeat(201)}`, 'invalid_question_search'],
    [`section=${'y'.repeat(65)}`, 'invalid_question_section_filter'],
  ]
  for (const [queryString, code] of rejected) {
    assert.throws(
      () => parseQuestionCatalogQuery(params(queryString)),
      error => error instanceof HttpError && error.status === 400 && error.code === code,
      `should reject ${queryString}`,
    )
  }
})

test('the question list is filtered and ordered deterministically in SQL', async () => {
  const source = await readFile(path.join(backendRoot, 'src', 'routes', 'admin-assessments.js'), 'utf8')
  const start = source.indexOf("GET('/v1/admin/practice-tests/:testId/questions'")
  const route = source.slice(start, source.indexOf("POST('/v1/admin/practice-tests/:testId/questions'"))
  assert.ok(route.includes('parseQuestionCatalogQuery(searchParams)'), 'the list must apply validated filters')
  // `position, id` keeps a page boundary stable, so paging cannot duplicate or
  // drop a row between two requests.
  assert.ok(route.includes('ORDER BY position ASC, id ASC'), 'ordering must be deterministic')
  assert.ok(route.includes('LIMIT $6 OFFSET $7'), 'the bank must be paged in SQL, not in the browser')
  // Total is its own scalar query rather than `count(*) OVER()`: a window
  // function only survives in the result when a row makes it past
  // LIMIT/OFFSET, so a page requested past the last row (right after an
  // archive shrinks the filtered set) would otherwise report a false
  // `total: 0` instead of the real count.
  assert.ok(!route.includes('count(*) OVER()::int AS total'), 'total must not depend on a row surviving LIMIT/OFFSET')
  assert.ok(/SELECT count\(\*\)::int AS total\s+FROM practice_questions/.test(route), 'total must be computed independently of the page')
  // The free position ignores the current filter/page and looks at the whole
  // test: a filtered first page must never suggest a position that is only
  // free-looking because another row scrolled out of view.
  assert.ok(route.includes('nextAvailablePosition'), 'the DTO must expose the next free position')
  assert.ok(route.includes('generate_series(1, $2) AS candidate'), 'the free position must scan the whole 1..200 range, not just the current page')
})

test('archive and restore are distinguishable in the audit trail', async () => {
  const source = await readFile(path.join(backendRoot, 'src', 'routes', 'admin-assessments.js'), 'utf8')
  const start = source.indexOf("PATCH('/v1/admin/practice-questions/:questionId'")
  const route = source.slice(start)
  assert.ok(route.includes("'archive_practice_question'"), 'archiving needs its own audit action')
  assert.ok(route.includes("'restore_practice_question'"), 'restoring needs its own audit action')
  assert.ok(route.includes("'update_practice_question'"), 'ordinary edits stay distinct')
  // Field names only: an audit row must never carry question or answer text.
  // The metadata object literal passed to audit() is checked directly rather
  // than scanning the whole route, which legitimately mentions `options` in
  // its RETURNING clause.
  const metadata = route.slice(route.indexOf("await audit(client, actor, action, 'practice_question', row.id, {"))
  const literal = metadata.slice(0, metadata.indexOf('})') + 2)
  assert.ok(literal.includes('fields,'), 'audit metadata records field names')
  for (const forbidden of ['questionText', 'correctAnswer', 'options', 'explanation']) {
    assert.ok(!literal.includes(forbidden), `audit metadata must not carry ${forbidden}`)
  }
})
