import assert from 'node:assert/strict'
import { test } from 'node:test'
import { resolve } from 'node:path'

import { buildReviewedMaterialPlan, materialStorageKey, reviewedMaterialSummary, REVIEWED_MATERIAL_IMPORT } from '../src/reviewed-material-import.js'

const sourceRoot = resolve(import.meta.dirname, '../../sorted_data')

test('reviewed PDF plan is an exact, chat-free allowlist', async () => {
  const plan = await buildReviewedMaterialPlan(sourceRoot)
  const summary = reviewedMaterialSummary(plan)
  assert.equal(summary.materialCount, 34)
  assert.equal(summary.materialCount, REVIEWED_MATERIAL_IMPORT.expectedPdfCount)
  assert.deepEqual(summary.courses, ['demo-ort-kyr', 'demo-ort-math'])
  assert.ok(summary.totalBytes > 10_000_000)
  assert.ok(plan.materials.every(item => !item.sourceId.includes('06_chat_exports_and_history')))
  assert.ok(plan.materials.every(item => /^[a-f0-9]{64}$/u.test(item.contentSha256)))
})

test('storage keys are private, opaque and lesson-scoped', () => {
  const key = materialStorageKey(42)
  assert.match(key, /^lesson\/42\/[a-f0-9]{32}$/u)
  assert.throws(() => materialStorageKey(0), /invalid lesson id/u)
})
