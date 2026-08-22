import assert from 'node:assert/strict'
import test from 'node:test'

import { buildLegacyDemoPlan, importPlanSummary, sourceImportConfig } from '../src/legacy-demo-content.js'

const source = {
  practiceLessons: [
    {
      id: '14d8be8c-f37b-4275-944f-77acb61c4021',
      subject: 'math',
      title: 'Сандар',
      description: '',
      video_url: 'https://www.youtube.com/watch?v=demo',
      order_number: 1,
    },
    {
      id: '024f6c0f-8545-4436-a2aa-0392c575bcc8',
      subject: 'kyr',
      title: 'Аналогия',
      description: 'Кыскача сүрөттөмө',
      video_url: 'https://www.youtube.com/watch?v=kyr',
      order_number: 1,
    },
  ],
  practiceTests: [{
    id: 5,
    title: 'Сандар: тест',
    subject: 'math',
    type: 'practice',
    time_limit_minutes: 15,
    lesson_id: '14d8be8c-f37b-4275-944f-77acb61c4021',
  }],
  questions: [
    {
      id: 11,
      practice_test_id: 5,
      question_text: '2 + 2 = ?',
      option_a: '3', option_b: '4', option_c: '5', option_d: '6',
      correct_answer: 'B',
      image_url: null,
      order_num: 1,
      section: 'numbers',
      difficulty: 'easy',
      topic: 'addition',
    },
    {
      id: 12,
      practice_test_id: 5,
      question_text: '',
      option_a: '1', option_b: '2', option_c: '3', option_d: '4',
      correct_answer: 'a',
      image_url: 'https://olqikkvjeutdgewmhnub.supabase.co/storage/v1/object/public/demo/image.png',
      order_num: 2,
      section: 'numbers',
      difficulty: 'medium',
      topic: null,
    },
  ],
}

test('legacy demo plan imports only validated text content and defers source storage images', () => {
  const plan = buildLegacyDemoPlan(source)
  assert.deepEqual(importPlanSummary(plan), {
    sourceSystem: 'supabase-demo-v1', courses: 1, lessons: 2, tests: 1, questions: 1, deferred: 1,
  })
  assert.equal(plan.courses[0].code, 'demo-ort-2026')
  assert.equal(plan.courses[0].subject, 'ort')
  assert.deepEqual(plan.lessons.map(lesson => [lesson.subject, lesson.lessonNumber]), [['math', 1], ['kyr', 2]])
  assert.equal(plan.tests[0].maxAttempts, null)
  assert.equal(plan.tests[0].passScoreRatio, 0.5)
  assert.equal(plan.questions[0].correctAnswer, 'b')
  assert.equal(plan.questions[0].imageUrl, undefined)
  assert.deepEqual(
    { ...plan.deferred[0], fingerprint: undefined },
    { sourceId: '12', sourceTestId: '5', subject: 'math', reason: 'private_image_migration_required', fingerprint: undefined },
  )
  assert.match(plan.deferred[0].fingerprint, /^[a-f0-9]{64}$/)
})

test('legacy demo plan rejects malformed source question options before a target write is possible', () => {
  const invalid = structuredClone(source)
  invalid.questions[0].option_d = ''
  assert.throws(() => buildLegacyDemoPlan(invalid), /question\.d has an invalid length/)
})

test('legacy source configuration is restricted to the approved project', () => {
  const config = sourceImportConfig({
    LEGACY_SOURCE_SUPABASE_URL: 'https://olqikkvjeutdgewmhnub.supabase.co',
    LEGACY_SOURCE_SUPABASE_SECRET_KEY: 'sb_secret_this_is_only_a_test_fixture_123456',
  })
  assert.equal(config.url, 'https://olqikkvjeutdgewmhnub.supabase.co')
  assert.equal(config.key, 'sb_secret_this_is_only_a_test_fixture_123456')
  assert.throws(() => sourceImportConfig({
    LEGACY_SOURCE_SUPABASE_URL: 'https://another.supabase.co',
    LEGACY_SOURCE_SUPABASE_SECRET_KEY: 'sb_secret_this_is_only_a_test_fixture_123456',
  }), /approved source project/)
})

test('a question whose source test references an absent lesson is deferred and cannot be imported alone', () => {
  const invalidRelationship = structuredClone(source)
  invalidRelationship.practiceTests[0].lesson_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
  const plan = buildLegacyDemoPlan(invalidRelationship)

  assert.equal(plan.tests.length, 0)
  assert.equal(plan.questions.length, 0)
  assert.equal(plan.deferred.length, 2)
  assert.equal(plan.deferred.find(item => item.sourceId === '11')?.reason, 'source_lesson_missing')
})
