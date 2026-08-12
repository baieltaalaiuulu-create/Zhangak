import assert from 'node:assert/strict'
import test from 'node:test'

import {
  MAX_PRACTICE_ANSWERS,
  MAX_PRACTICE_ELAPSED_SECONDS,
  parseBeginPracticeRequest,
  parsePracticeAttemptResponse,
  parsePracticeSubmissionResponse,
  parseSubmitPracticeRequest,
} from '../../lib/learning/practice-validation.ts'
import {
  checkAttemptAvailability,
  decideIdempotentSubmission,
  gradeAssignedPracticeQuestions,
} from '../../lib/learning/practice-reference.ts'

const ATTEMPT_ID = '018f47a2-4c55-7b9c-8b65-bf8d0f5b31bd'
const BEGIN_KEY = 'f65e7300-6a12-4c59-8b40-2b704d502b4d'
const SUBMIT_KEY = '25931cc8-2072-4bd2-a531-77fb75391d12'

test('begin request accepts only the two documented modes', () => {
  assert.deepEqual(parseBeginPracticeRequest({
    mode: 'test',
    testId: 12,
    idempotencyKey: BEGIN_KEY,
  }), {
    ok: true,
    value: { mode: 'test', testId: 12, idempotencyKey: BEGIN_KEY },
  })

  const topic = parseBeginPracticeRequest({
    mode: 'topic',
    section: 'math',
    topic: '  Дроби  ',
    idempotencyKey: BEGIN_KEY,
  })
  assert.equal(topic.ok, true)
  if (topic.ok) {
    assert.equal(topic.value.mode, 'topic')
    if (topic.value.mode === 'topic') assert.equal(topic.value.topic, 'Дроби')
  }
})

test('submission rejects every client-authored authority field', () => {
  for (const field of ['studentId', 'score', 'totalScore', 'attemptNumber', 'completedAt', 'passed']) {
    const parsed = parseSubmitPracticeRequest({
      attemptId: ATTEMPT_ID,
      idempotencyKey: SUBMIT_KEY,
      elapsedSeconds: 90,
      answers: [],
      [field]: field === 'studentId' ? 'someone-else' : 245,
    })
    assert.deepEqual(parsed, { ok: false, code: 'unknown_field', field: 'request' })
  }
})

test('submission validates bounds, answer letters and duplicate IDs', () => {
  assert.equal(parseSubmitPracticeRequest({
    attemptId: ATTEMPT_ID,
    idempotencyKey: SUBMIT_KEY,
    elapsedSeconds: MAX_PRACTICE_ELAPSED_SECONDS + 1,
    answers: [],
  }).ok, false)

  assert.equal(parseSubmitPracticeRequest({
    attemptId: ATTEMPT_ID,
    idempotencyKey: SUBMIT_KEY,
    elapsedSeconds: 10,
    answers: [{ questionId: 1, answer: 'A' }],
  }).ok, false)

  const duplicate = parseSubmitPracticeRequest({
    attemptId: ATTEMPT_ID,
    idempotencyKey: SUBMIT_KEY,
    elapsedSeconds: 10,
    answers: [{ questionId: 1, answer: 'a' }, { questionId: 1, answer: 'b' }],
  })
  assert.deepEqual(duplicate, { ok: false, code: 'duplicate_question', field: 'answers.1.questionId' })

  const tooMany = Array.from({ length: MAX_PRACTICE_ANSWERS + 1 }, (_, index) => ({
    questionId: index + 1,
    answer: 'a',
  }))
  assert.deepEqual(parseSubmitPracticeRequest({
    attemptId: ATTEMPT_ID,
    idempotencyKey: SUBMIT_KEY,
    elapsedSeconds: 10,
    answers: tooMany,
  }), { ok: false, code: 'too_many_answers', field: 'answers' })
})

test('reference grader derives score and treats unanswered items as wrong', () => {
  const result = gradeAssignedPracticeQuestions(
    [
      { questionId: 10, answerKey: 'b' },
      { questionId: 20, answerKey: 'd' },
      { questionId: 30, answerKey: 'a' },
    ],
    [
      { questionId: 10, answer: 'b' },
      { questionId: 20, answer: 'a' },
    ],
  )
  assert.equal(result.score, 1)
  assert.equal(result.total, 3)
  assert.deepEqual(result.review.map(item => item.isCorrect), [true, false, false])
  assert.equal(result.review[2].selectedAnswer, null)
})

test('reference grader rejects answers for unassigned questions', () => {
  assert.throws(() => gradeAssignedPracticeQuestions(
    [{ questionId: 10, answerKey: 'b' }],
    [{ questionId: 99, answer: 'b' }],
  ), /unassigned question/)
})

test('reference grader fails closed on an empty or corrupt assignment', () => {
  assert.throws(() => gradeAssignedPracticeQuestions([], []), /no assigned questions/)
  assert.throws(() => gradeAssignedPracticeQuestions(
    [{ questionId: 10, answerKey: 'z' as 'a' }],
    [],
  ), /invalid answer key/)
})

test('availability enforces active state, schedule and finalized attempt limit', () => {
  const now = new Date('2026-08-13T12:00:00Z')
  assert.deepEqual(checkAttemptAvailability({
    active: false, scheduledAt: null, maxAttempts: 1, finalizedAttempts: 0,
  }, now), { allowed: false, reason: 'inactive' })
  assert.deepEqual(checkAttemptAvailability({
    active: true, scheduledAt: new Date('2026-08-14T12:00:00Z'), maxAttempts: 1, finalizedAttempts: 0,
  }, now), { allowed: false, reason: 'not_started' })
  assert.deepEqual(checkAttemptAvailability({
    active: true, scheduledAt: null, maxAttempts: 1, finalizedAttempts: 1,
  }, now), { allowed: false, reason: 'attempts_exhausted' })
  assert.deepEqual(checkAttemptAvailability({
    active: true, scheduledAt: null, maxAttempts: 2, finalizedAttempts: 1,
  }, now), { allowed: true, attemptNumber: 2 })
})

test('idempotency replays the same submission and conflicts on a new key', () => {
  const committed = { score: 4 }
  assert.deepEqual(decideIdempotentSubmission(null, SUBMIT_KEY), { action: 'execute' })
  assert.deepEqual(
    decideIdempotentSubmission({ key: SUBMIT_KEY, result: committed }, SUBMIT_KEY),
    { action: 'replay', result: committed },
  )
  assert.deepEqual(
    decideIdempotentSubmission({ key: SUBMIT_KEY, result: committed }, BEGIN_KEY),
    { action: 'conflict' },
  )
})

test('attempt response parser rejects answer-key-shaped extra data', () => {
  const response = {
    contractVersion: 2,
    attemptId: ATTEMPT_ID,
    idempotencyKey: BEGIN_KEY,
    mode: 'test',
    title: 'Практика',
    testId: 12,
    lessonId: null,
    attemptNumber: 1,
    maxAttempts: 2,
    timeLimitSeconds: 600,
    questions: [{
      id: 10,
      text: '2 + 2 = ?',
      options: { a: '3', b: '4', c: '5', d: '6' },
      imageUrl: null,
      order: 1,
      section: 'math',
      topic: 'Арифметика',
      difficulty: 'easy',
      answerKey: 'b',
    }],
  }
  assert.equal(parsePracticeAttemptResponse(response).ok, false)
})

test('submission response is self-consistent with its review', () => {
  const base = {
    contractVersion: 2,
    attemptId: ATTEMPT_ID,
    score: 1,
    total: 2,
    passed: false,
    attemptNumber: 1,
    elapsedSeconds: 90,
    completedAt: '2026-08-13T12:00:00.000Z',
    review: [
      { questionId: 10, selectedAnswer: 'b', correctAnswer: 'b', isCorrect: true },
      { questionId: 20, selectedAnswer: null, correctAnswer: 'd', isCorrect: false },
    ],
  }
  assert.equal(parsePracticeSubmissionResponse(base).ok, true)
  assert.equal(parsePracticeSubmissionResponse({ ...base, completedAt: '2026-08-13T18:00:00+06:00' }).ok, true)
  assert.equal(parsePracticeSubmissionResponse({ ...base, score: 2 }).ok, false)
})
