import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

import { fetchSortedDocxPlan, sortedDocxImportSummary } from '../src/sorted-content-import.js'

const rawSourcesAvailable = [
  'sorted_data/03_analogies/logical_connections/245 аналогия жообу менен.docx',
  'sorted_data/02_kyrgyz_language/grammar_and_morphology/240_суроо_кыргыз_прг_жообу_менен_2.docx',
].every(path => existsSync(resolve(import.meta.dirname, '../..', path)))

test('approved DOCX banks parse into four-option unpublished trainer tests', { skip: !rawSourcesAvailable }, async () => {
  const plan = await fetchSortedDocxPlan()
  const summary = sortedDocxImportSummary(plan)

  assert.deepEqual(summary.sourceFiles.map(item => item.questionCount), [245, 240])
  assert.equal(summary.practiceTests, 4)
  assert.equal(summary.practiceQuestions, 485)
  assert.equal(summary.published, false)
  assert.equal(plan.tests.every(item => item.testType === 'bank' && item.subject === 'kyr' && item.isPublished === false), true)
  assert.equal(plan.questions.every(item => Object.keys(item.options).sort().join(',') === 'a,b,c,d'), true)
  assert.equal(plan.questions.every(item => ['a', 'b', 'c', 'd'].includes(item.correctAnswer)), true)
  assert.equal(plan.questions.some(item => item.sourceId.includes('chat_exports_and_history')), false)
})

test('each imported test respects the immutable 200-question schema boundary', { skip: !rawSourcesAvailable }, async () => {
  const plan = await fetchSortedDocxPlan()
  const byTest = new Map()
  for (const question of plan.questions) {
    const items = byTest.get(question.sourceTestId) ?? []
    items.push(question)
    byTest.set(question.sourceTestId, items)
  }
  assert.deepEqual([...byTest.values()].map(items => items.length).sort((a, b) => a - b), [40, 45, 200, 200])
  for (const items of byTest.values()) {
    assert.deepEqual(items.map(item => item.position), Array.from({ length: items.length }, (_, index) => index + 1))
  }
})
