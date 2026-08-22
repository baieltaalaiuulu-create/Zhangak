import assert from 'node:assert/strict'
import test from 'node:test'

import { MATH_DEMO_QUESTIONS, parseArgs, planSeed, validateDemoQuestions } from '../scripts/seed-lesson-assessment-demo.js'

const ANSWER_INDEX = { a: 0, b: 1, c: 2, d: 3 }

test('command line parsing defaults to a dry-run math seed and fails closed for unverifiable subjects', () => {
  assert.deepEqual(parseArgs([]), { apply: false, subject: 'math' })
  assert.deepEqual(parseArgs(['--apply']), { apply: true, subject: 'math' })
  assert.deepEqual(parseArgs(['--subject', 'math', '--apply']), { apply: true, subject: 'math' })
  assert.deepEqual(parseArgs(['--apply', '--dry-run']), { apply: false, subject: 'math' })

  assert.throws(() => parseArgs(['--subject', 'kyr']), /linguist\/methodologist/)
  assert.throws(() => parseArgs(['--subject', 'physics']), /unsupported --subject/)
  assert.throws(() => parseArgs(['--unknown']), /unrecognized argument/)
})

test('the demo question set satisfies the same four-option/answer-key shape the schema enforces', () => {
  assert.equal(validateDemoQuestions(MATH_DEMO_QUESTIONS).length, 15)
  assert.throws(() => validateDemoQuestions([]), /between 1 and 200/)
  assert.throws(() => validateDemoQuestions([{ ...MATH_DEMO_QUESTIONS[0], options: ['1', '2', '3'] }]), /exactly four options/)
  assert.throws(() => validateDemoQuestions([{ ...MATH_DEMO_QUESTIONS[0], correct: 'e' }]), /invalid correct answer/)
  assert.throws(() => validateDemoQuestions([{ ...MATH_DEMO_QUESTIONS[0], difficulty: 'impossible' }]), /invalid difficulty/)
  assert.throws(() => validateDemoQuestions([{ ...MATH_DEMO_QUESTIONS[0], section: 'НЕ ascii' }]), /invalid section/)
})

// Each expected value below was derived independently of the seed file, so a
// transcription mistake in `correct` (pointing at the wrong option) fails
// here even if the question's own internal shape is still valid.
const EXPECTED_ANSWER_TEXT = [
  '15', '7', '42', '5', '44', '9', '3/4', '0,75', '−2', '30',
  '14', '20 см', '24 см²', '17', '7',
]

test('every demo answer key matches an independently recomputed correct value', () => {
  assert.equal(EXPECTED_ANSWER_TEXT.length, MATH_DEMO_QUESTIONS.length)
  MATH_DEMO_QUESTIONS.forEach((question, index) => {
    const answerIndex = ANSWER_INDEX[question.correct]
    assert.equal(
      question.options[answerIndex],
      EXPECTED_ANSWER_TEXT[index],
      `question ${index + 1} ("${question.text}") should answer "${EXPECTED_ANSWER_TEXT[index]}"`,
    )
  })
})

test('no two options within one question collide, so a duplicate string cannot silently create two correct-looking choices', () => {
  for (const question of MATH_DEMO_QUESTIONS) {
    assert.equal(new Set(question.options).size, 4, `question "${question.text}" must have four distinct options`)
  }
})

test('a second run finds the course marker before looking for another empty lesson', async () => {
  const queries = []
  const client = {
    async query(sql) {
      queries.push(sql)
      if (sql.includes("FROM courses WHERE delivery_mode = 'online'")) {
        return { rowCount: 1, rows: [{ id: 2, name: 'Подготовка к ОРТ' }] }
      }
      if (sql.includes("t.description LIKE")) {
        return {
          rowCount: 1,
          rows: [{ id: 91, lesson_id: 3, lesson_number: 1, is_published: true, active_question_count: 15 }],
        }
      }
      throw new Error(`Unexpected query: ${sql}`)
    },
  }

  const result = await planSeed(client, 'math')
  assert.equal(result.status, 'already_seeded')
  assert.equal(result.testId, 91)
  assert.equal(queries.length, 2, 'an idempotent rerun must not search for the next empty lesson')
})

test('an incomplete marked seed blocks duplication and asks for review', async () => {
  const client = {
    async query(sql) {
      if (sql.includes("FROM courses WHERE delivery_mode = 'online'")) {
        return { rowCount: 1, rows: [{ id: 2, name: 'Подготовка к ОРТ' }] }
      }
      return {
        rowCount: 1,
        rows: [{ id: 91, lesson_id: 3, lesson_number: 1, is_published: false, active_question_count: 7 }],
      }
    },
  }
  const result = await planSeed(client, 'math')
  assert.equal(result.status, 'seed_requires_review')
  assert.match(result.reason, /refusing to duplicate/)
})
