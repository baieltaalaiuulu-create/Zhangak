import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  parsePracticeQuestionCreateBody,
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
