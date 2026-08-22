import assert from 'node:assert/strict'
import test from 'node:test'

import { canonicalLearningSubject } from '../src/learning-subject.js'

test('legacy ORT subject labels collapse to stable student-facing identifiers', () => {
  for (const value of ['math', 'Математика', ' математика ']) {
    assert.equal(canonicalLearningSubject(value), 'math')
  }
  for (const value of ['kyr', 'Кыргыз тил', 'Кыргызский язык', 'kyrgyz']) {
    assert.equal(canonicalLearningSubject(value), 'kyr')
  }
})

test('unknown editorial subjects are preserved instead of guessed', () => {
  assert.equal(canonicalLearningSubject('Физика'), 'Физика')
  assert.equal(canonicalLearningSubject('   '), null)
  assert.equal(canonicalLearningSubject(null), null)
})
