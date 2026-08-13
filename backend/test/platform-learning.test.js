import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  parseBeginAttemptBody,
  parseSubmitAttemptBody,
  publicAttemptQuestion,
} from '../src/routes/platform-learning.js'
import { HttpError } from '../src/http.js'

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

test('open attempt questions never project server-only answer material', () => {
  const question = publicAttemptQuestion({
    practice_question_id: '42',
    position: 1,
    question_text: '2 + 2 = ?',
    options: { a: '3', b: '4', c: '5', d: '6' },
    correct_answer: 'b',
    selected_answer: 'a',
    is_correct: false,
    explanation: 'Basic arithmetic',
    section: 'math',
    topic: 'addition',
    difficulty: 'easy',
    image_url: null,
  })
  assert.deepEqual(question, {
    questionId: 42,
    position: 1,
    questionText: '2 + 2 = ?',
    options: { a: '3', b: '4', c: '5', d: '6' },
    section: 'math',
    topic: 'addition',
    difficulty: 'easy',
    imageUrl: null,
  })
  for (const privateField of ['correctAnswer', 'correct_answer', 'selectedAnswer', 'selected_answer', 'isCorrect', 'explanation']) {
    assert.equal(Object.hasOwn(question, privateField), false)
  }
})

test('attempt request parsers fail closed for injected score, unknown fields, and duplicate answers', () => {
  const beginKey = '550e8400-e29b-41d4-a716-446655440000'
  const submitKey = '550e8400-e29b-41d4-a716-446655440001'
  assert.deepEqual(parseBeginAttemptBody({ testId: 12, idempotencyKey: beginKey }), { testId: 12, idempotencyKey: beginKey })
  assert.throws(
    () => parseBeginAttemptBody({ testId: 12, idempotencyKey: beginKey, studentId: 'forged' }),
    error => error instanceof HttpError && error.code === 'invalid_attempt_request',
  )
  assert.deepEqual(parseSubmitAttemptBody({
    idempotencyKey: submitKey,
    elapsedSeconds: 31,
    answers: [{ questionId: 5, answer: 'a' }, { questionId: 8, answer: 'd' }],
  }), {
    idempotencyKey: submitKey,
    elapsedSeconds: 31,
    answers: [{ questionId: 5, answer: 'a' }, { questionId: 8, answer: 'd' }],
  })
  assert.throws(
    () => parseSubmitAttemptBody({
      idempotencyKey: submitKey,
      elapsedSeconds: 31,
      answers: [{ questionId: 5, answer: 'a' }, { questionId: 5, answer: 'b' }],
    }),
    error => error instanceof HttpError && error.code === 'invalid_submission',
  )
  assert.throws(
    () => parseSubmitAttemptBody({
      idempotencyKey: submitKey,
      elapsedSeconds: 31,
      score: 999,
      answers: [],
    }),
    error => error instanceof HttpError && error.code === 'invalid_submission',
  )
})

test('learning routes use locking, immutable snapshots, and server-side scoring paths', async () => {
  const source = await readFile(path.join(backendRoot, 'src', 'routes', 'platform-learning.js'), 'utf8')
  assert.match(source, /SELECT id FROM users WHERE id = \$1 FOR UPDATE/)
  assert.match(source, /begin_idempotency_key/)
  assert.match(source, /submit_idempotency_key/)
  assert.match(source, /UPDATE practice_attempt_items item/)
  assert.match(source, /is_correct = \(submitted\.answer = item\.correct_answer\)/)
  assert.match(source, /WHERE item\.attempt_id = \$1/)
  assert.match(source, /score_percent = round\(\(\$3::numeric \/ question_count\) \* 100, 2\)/)
  assert.match(source, /WHERE id = \$1 AND student_id = \$2\s+FOR UPDATE/)
  assert.match(source, /INSERT INTO lesson_progress \(student_id, lesson_id, completion_percent, last_viewed_at, completed_at\)/)
  assert.match(source, /ON CONFLICT \(student_id, lesson_id\) DO UPDATE/)
})
