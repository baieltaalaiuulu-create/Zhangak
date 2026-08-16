/**
 * Imports only the two reviewed DOCX question banks allowlisted in
 * src/sorted-content-import.js. Dry-run is the default; --apply is explicit.
 * It never reads sorted_data/06_chat_exports_and_history or uploads materials.
 */
import process from 'node:process'

import { loadConfig } from '../src/config.js'
import { closeDatabase, connectDatabase, transaction } from '../src/db.js'
import { fetchSortedDocxPlan, sortedDocxImportSummary } from '../src/sorted-content-import.js'

const LEDGER_MIGRATION = '005_legacy_demo_import_ledger.sql'

function fail(message) {
  throw new Error(`Content importer blocked: ${message}`)
}

function parseArgs(args) {
  if (args.length === 0 || (args.length === 1 && args[0] === '--dry-run')) return { apply: false }
  if (args.length === 1 && args[0] === '--apply') return { apply: true }
  fail('usage: node scripts/import_content.mjs [--dry-run|--apply]')
}

async function requireLedger(client) {
  const result = await client.query('SELECT 1 FROM schema_migrations WHERE version = $1', [LEDGER_MIGRATION])
  if (result.rowCount !== 1) fail(`${LEDGER_MIGRATION} has not been applied to the target database`)
}

async function existingTarget(client, plan, sourceEntity, sourceId, fingerprint) {
  const found = await client.query(
    `SELECT target_id, content_sha256, status
       FROM legacy_content_imports
      WHERE source_system = $1 AND source_entity = $2 AND source_id = $3
      FOR UPDATE`,
    [plan.sourceSystem, sourceEntity, sourceId],
  )
  const row = found.rows[0]
  if (!row) return null
  if (row.status !== 'imported' || row.content_sha256 !== fingerprint || !/^\d+$/u.test(String(row.target_id))) {
    fail(`source ${sourceEntity}/${sourceId} was previously imported with a different immutable fingerprint`)
  }
  return Number(row.target_id)
}

async function recordImport(client, plan, sourceEntity, sourceId, targetEntity, targetId, fingerprint, details) {
  await client.query(
    `INSERT INTO legacy_content_imports (
       source_system, source_entity, source_id, target_entity, target_id, content_sha256, status, details
     ) VALUES ($1, $2, $3, $4, $5, $6, 'imported', $7::jsonb)`,
    [plan.sourceSystem, sourceEntity, sourceId, targetEntity, String(targetId), fingerprint, JSON.stringify(details)],
  )
}

async function importTest(client, plan, test) {
  const existingId = await existingTarget(client, plan, 'practice_test', test.sourceId, test.fingerprint)
  if (existingId !== null) {
    const target = await client.query('SELECT id FROM practice_tests WHERE id = $1 FOR UPDATE', [existingId])
    if (target.rowCount === 1) return existingId
    fail(`ledger target practice test ${existingId} no longer exists`)
  }
  const inserted = await client.query(
    `INSERT INTO practice_tests (course_id, lesson_id, title, subject, test_type, description, max_attempts, pass_score_ratio, is_published)
     VALUES (NULL, NULL, $1, $2, $3, $4, NULL, 0.7000, false) RETURNING id`,
    [test.title, test.subject, test.testType, test.description],
  )
  const id = Number(inserted.rows[0].id)
  await recordImport(client, plan, 'practice_test', test.sourceId, 'practice_tests', id, test.fingerprint, { reviewed: true, published: false })
  return id
}

async function importQuestion(client, plan, question, testId) {
  const existingId = await existingTarget(client, plan, 'practice_question', question.sourceId, question.fingerprint)
  if (existingId !== null) {
    const target = await client.query('SELECT id FROM practice_questions WHERE id = $1 FOR UPDATE', [existingId])
    if (target.rowCount === 1) return
    fail(`ledger target practice question ${existingId} no longer exists`)
  }
  const inserted = await client.query(
    `INSERT INTO practice_questions (
       practice_test_id, question_text, options, correct_answer, explanation, section, topic, difficulty, image_url, position, is_active
     ) VALUES ($1, $2, $3::jsonb, $4, NULL, $5, $6, $7, NULL, $8, true) RETURNING id`,
    [testId, question.questionText, JSON.stringify(question.options), question.correctAnswer, question.section, question.topic, question.difficulty, question.position],
  )
  await recordImport(client, plan, 'practice_question', question.sourceId, 'practice_questions', Number(inserted.rows[0].id), question.fingerprint, { practiceTestId: testId, position: question.position })
}

async function applyPlan(plan) {
  connectDatabase(loadConfig())
  try {
    return await transaction(async client => {
      await requireLedger(client)
      const testIds = new Map()
      for (const test of plan.tests) testIds.set(test.sourceId, await importTest(client, plan, test))
      for (const question of plan.questions) {
        const testId = testIds.get(question.sourceTestId)
        if (!testId) fail(`missing test target for question ${question.sourceId}`)
        await importQuestion(client, plan, question, testId)
      }
      const summary = sortedDocxImportSummary(plan)
      await client.query(
        `INSERT INTO audit_log (actor_user_id, action, target_type, target_id, metadata)
         VALUES (NULL, 'import_sorted_docx_questions', 'content_import', $1, $2::jsonb)`,
        [plan.sourceSystem, JSON.stringify(summary)],
      )
      return summary
    })
  } finally {
    await closeDatabase()
  }
}

async function main() {
  const { apply } = parseArgs(process.argv.slice(2))
  const plan = await fetchSortedDocxPlan()
  const summary = sortedDocxImportSummary(plan)
  if (!apply) {
    process.stdout.write(`${JSON.stringify({ status: 'dry-run', ...summary }, null, 2)}\n`)
    return
  }
  const result = await applyPlan(plan)
  process.stdout.write(`${JSON.stringify({ status: 'applied', ...result }, null, 2)}\n`)
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : 'Content importer failed')
  process.exitCode = 1
})
