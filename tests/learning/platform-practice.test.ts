import assert from 'node:assert/strict'
import test from 'node:test'

import {
  parseBeginPracticeAttempt,
  parseSubmitPracticeAttempt,
} from '../../lib/platform-practice.ts'

const ATTEMPT = {
  id: 'e9f62422-e028-43ae-ae9e-06c85c750a87',
  status: 'started',
  practiceTestId: 31,
  courseId: 4,
  lessonId: 8,
  attemptNumber: 1,
  testTitle: 'Дроби',
  testType: 'practice',
  timeLimitSeconds: 600,
  passScoreRatio: 0.7,
  questionCount: 2,
  correctCount: null,
  scorePercent: null,
  passed: null,
  elapsedSeconds: null,
  startedAt: '2026-08-13T12:00:00.000Z',
  expiresAt: '2026-08-13T12:10:00.000Z',
  submittedAt: null,
}

const OPEN_QUESTION = {
  questionId: 101,
  position: 1,
  questionText: '1/2 + 1/2 = ?',
  options: { a: '1/2', b: '1', c: '2', d: '0' },
  section: 'math',
  topic: 'Дроби',
  difficulty: 'easy',
  imageUrl: null,
}

test('first-party open-attempt parser preserves an answer-key-free question shape', () => {
  const response = parseBeginPracticeAttempt({
    attempt: ATTEMPT,
    questions: [OPEN_QUESTION, { ...OPEN_QUESTION, questionId: 102, position: 2 }],
    replayed: false,
    resumed: false,
  })
  assert.deepEqual(Object.keys(response.questions[0]).sort(), [
    'difficulty', 'imageUrl', 'options', 'position', 'questionId', 'questionText', 'section', 'topic',
  ])
  assert.equal(Object.hasOwn(response.questions[0], 'correctAnswer'), false)
  assert.equal(Object.hasOwn(response.questions[0], 'correct_answer'), false)
})

test('open-attempt parser rejects incomplete and malformed API projections', () => {
  assert.throws(() => parseBeginPracticeAttempt({
    attempt: ATTEMPT,
    questions: [OPEN_QUESTION],
    replayed: false,
    resumed: false,
  }), /вопросы попытки/)

  assert.throws(() => parseBeginPracticeAttempt({
    attempt: ATTEMPT,
    questions: [OPEN_QUESTION, { ...OPEN_QUESTION, questionId: 102, options: { ...OPEN_QUESTION.options, d: 3 } }],
    replayed: false,
    resumed: false,
  }), /вариант D/)
})

test('results are accepted only after a server-finalized, self-consistent review', () => {
  const response = parseSubmitPracticeAttempt({
    attempt: {
      ...ATTEMPT,
      status: 'submitted',
      correctCount: 1,
      scorePercent: 50,
      passed: false,
      elapsedSeconds: 72,
      submittedAt: '2026-08-13T12:01:12.000Z',
    },
    review: [
      { ...OPEN_QUESTION, selectedAnswer: 'b', correctAnswer: 'b', isCorrect: true, explanation: null },
      { ...OPEN_QUESTION, questionId: 102, position: 2, selectedAnswer: 'a', correctAnswer: 'c', isCorrect: false, explanation: 'Приведи к общему знаменателю.' },
    ],
    replayed: false,
  })
  assert.equal(response.attempt.correctCount, 1)
  assert.equal(response.review[1].correctAnswer, 'c')

  assert.throws(() => parseSubmitPracticeAttempt({
    attempt: {
      ...ATTEMPT,
      status: 'submitted',
      correctCount: 2,
      scorePercent: 100,
      passed: true,
      elapsedSeconds: 72,
      submittedAt: '2026-08-13T12:01:12.000Z',
    },
    review: [{ ...OPEN_QUESTION, selectedAnswer: 'b', correctAnswer: 'b', isCorrect: true, explanation: null }, { ...OPEN_QUESTION, questionId: 102, position: 2, selectedAnswer: 'a', correctAnswer: 'c', isCorrect: false, explanation: null }],
    replayed: false,
  }), /несогласованный разбор/)
})
