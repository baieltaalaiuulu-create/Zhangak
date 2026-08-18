/**
 * Explicit one-time importer for the small approved demonstration-content
 * slice of the retired Supabase project. It is never loaded by the API
 * server, is dry-run by default, and does not import accounts, auth material,
 * payments, attempts, XP, results, chat records, or legacy asset URLs.
 */
import process from 'node:process'

import { loadConfig } from '../src/config.js'
import { closeDatabase, connectDatabase, transaction } from '../src/db.js'
import { fetchLegacyDemoPlan, importPlanSummary } from '../src/legacy-demo-content.js'

const migrationName = '005_legacy_demo_import_ledger.sql'

function fail(message) {
  throw new Error(`Legacy demo importer blocked: ${message}`)
}

function parseArgs(args) {
  if (args.length === 0 || (args.length === 1 && args[0] === '--dry-run')) return { apply: false }
  if (args.length === 1 && args[0] === '--apply') return { apply: true }
  fail('usage: node scripts/import-supabase-demo-content.js [--dry-run|--apply]')
}

async function requireMigration(client) {
  const result = await client.query(
    'SELECT 1 FROM schema_migrations WHERE version = $1',
    [migrationName],
  )
  if (result.rowCount !== 1) fail(`${migrationName} has not been applied to the target database`)
}

async function recordImport(client, {
  sourceSystem,
  sourceEntity,
  sourceId,
  targetEntity = null,
  targetId = null,
  fingerprint,
  status,
  details = {},
}) {
  await client.query(
    `INSERT INTO legacy_content_imports (
       source_system, source_entity, source_id, target_entity, target_id,
       content_sha256, status, details
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
     ON CONFLICT (source_system, source_entity, source_id)
     DO UPDATE SET
       target_entity = EXCLUDED.target_entity,
       target_id = EXCLUDED.target_id,
       content_sha256 = EXCLUDED.content_sha256,
       status = EXCLUDED.status,
       details = EXCLUDED.details,
       imported_at = now(),
       updated_at = now()`,
    [
      sourceSystem,
      sourceEntity,
      sourceId,
      targetEntity,
      targetId == null ? null : String(targetId),
      fingerprint,
      status,
      JSON.stringify(details),
    ],
  )
}

async function upsertCourse(client, sourceSystem, course) {
  const existing = await client.query(
    'SELECT id FROM courses WHERE code = $1 FOR UPDATE',
    [course.code],
  )
  let id
  if (existing.rowCount === 1) {
    id = Number(existing.rows[0].id)
    await client.query(
      `UPDATE courses
          SET name = $2, subject = $3, description = $4, is_active = true, updated_at = now()
        WHERE id = $1`,
      [id, course.name, course.subject, course.description],
    )
  } else {
    const inserted = await client.query(
      `INSERT INTO courses (name, code, subject, description, is_active)
       VALUES ($1, $2, $3, $4, true)
       RETURNING id`,
      [course.name, course.code, course.subject, course.description],
    )
    id = Number(inserted.rows[0].id)
  }
  await recordImport(client, {
    sourceSystem,
    sourceEntity: 'subject_course',
    sourceId: course.subject,
    targetEntity: 'courses',
    targetId: id,
    fingerprint: course.fingerprint,
    status: 'imported',
    details: { courseCode: course.code },
  })
  return id
}

async function upsertLesson(client, sourceSystem, lesson, courseId) {
  const existing = await client.query(
    `SELECT id
       FROM lessons
      WHERE course_id = $1 AND lesson_number = $2
      FOR UPDATE`,
    [courseId, lesson.lessonNumber],
  )
  let id
  if (existing.rowCount === 1) {
    id = Number(existing.rows[0].id)
    await client.query(
      `UPDATE lessons
          SET title = $2, description = $3, subject = $4, content_url = $5,
              is_test = false, is_published = true, updated_at = now()
        WHERE id = $1`,
      [id, lesson.title, lesson.description, lesson.subject, lesson.contentUrl],
    )
  } else {
    const inserted = await client.query(
      `INSERT INTO lessons (
         course_id, lesson_number, title, description, subject, content_url,
         is_test, is_published
       ) VALUES ($1, $2, $3, $4, $5, $6, false, true)
       RETURNING id`,
      [courseId, lesson.lessonNumber, lesson.title, lesson.description, lesson.subject, lesson.contentUrl],
    )
    id = Number(inserted.rows[0].id)
  }
  await recordImport(client, {
    sourceSystem,
    sourceEntity: 'practice_lesson',
    sourceId: lesson.sourceId,
    targetEntity: 'lessons',
    targetId: id,
    fingerprint: lesson.fingerprint,
    status: 'imported',
    details: { courseId, lessonNumber: lesson.lessonNumber },
  })
  return id
}

async function importedTargetId(client, sourceSystem, sourceEntity, sourceId) {
  const result = await client.query(
    `SELECT target_id
       FROM legacy_content_imports
      WHERE source_system = $1
        AND source_entity = $2
        AND source_id = $3
        AND status = 'imported'
      FOR UPDATE`,
    [sourceSystem, sourceEntity, sourceId],
  )
  const row = result.rows[0]
  if (!row?.target_id || !/^\d+$/.test(String(row.target_id))) return null
  return Number(row.target_id)
}

async function upsertTest(client, sourceSystem, test, courseId, lessonId) {
  const previousId = await importedTargetId(client, sourceSystem, 'practice_test', test.sourceId)
  let id = previousId
  if (id !== null) {
    const existing = await client.query('SELECT id FROM practice_tests WHERE id = $1 FOR UPDATE', [id])
    if (existing.rowCount === 0) id = null
  }
  if (id === null) {
    const inserted = await client.query(
      `INSERT INTO practice_tests (
         course_id, lesson_id, title, subject, test_type, description,
         time_limit_seconds, max_attempts, pass_score_ratio, is_published
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [
        courseId, lessonId, test.title, test.subject, test.testType,
        test.description, test.timeLimitSeconds, test.maxAttempts,
        test.passScoreRatio, test.isPublished,
      ],
    )
    id = Number(inserted.rows[0].id)
  } else {
    await client.query(
      `UPDATE practice_tests
          SET course_id = $2, lesson_id = $3, title = $4, subject = $5,
              test_type = $6, description = $7, time_limit_seconds = $8,
              max_attempts = $9, pass_score_ratio = $10, is_published = $11,
              updated_at = now()
        WHERE id = $1`,
      [
        id, courseId, lessonId, test.title, test.subject, test.testType,
        test.description, test.timeLimitSeconds, test.maxAttempts,
        test.passScoreRatio, test.isPublished,
      ],
    )
  }
  await recordImport(client, {
    sourceSystem,
    sourceEntity: 'practice_test',
    sourceId: test.sourceId,
    targetEntity: 'practice_tests',
    targetId: id,
    fingerprint: test.fingerprint,
    status: 'imported',
    details: { courseId, lessonId },
  })
  return id
}

async function upsertQuestion(client, sourceSystem, question, testId) {
  const previousId = await importedTargetId(client, sourceSystem, 'question', question.sourceId)
  let id = previousId
  if (id !== null) {
    const existing = await client.query('SELECT id FROM practice_questions WHERE id = $1 FOR UPDATE', [id])
    if (existing.rowCount === 0) id = null
  }
  if (id === null) {
    const inserted = await client.query(
      `INSERT INTO practice_questions (
         practice_test_id, question_text, options, correct_answer, explanation,
         section, topic, difficulty, image_url, position, is_active
       ) VALUES ($1, $2, $3::jsonb, $4, NULL, $5, $6, $7, NULL, $8, true)
       RETURNING id`,
      [
        testId, question.questionText, JSON.stringify(question.options),
        question.correctAnswer, question.section, question.topic,
        question.difficulty, question.position,
      ],
    )
    id = Number(inserted.rows[0].id)
  } else {
    await client.query(
      `UPDATE practice_questions
          SET practice_test_id = $2, question_text = $3, options = $4::jsonb,
              correct_answer = $5, explanation = NULL, section = $6, topic = $7,
              difficulty = $8, image_url = NULL, position = $9, is_active = true,
              updated_at = now()
        WHERE id = $1`,
      [
        id, testId, question.questionText, JSON.stringify(question.options),
        question.correctAnswer, question.section, question.topic,
        question.difficulty, question.position,
      ],
    )
  }
  await recordImport(client, {
    sourceSystem,
    sourceEntity: 'question',
    sourceId: question.sourceId,
    targetEntity: 'practice_questions',
    targetId: id,
    fingerprint: question.fingerprint,
    status: 'imported',
    details: { practiceTestId: testId, sourceTestId: question.sourceTestId },
  })
}

async function applyPlan(plan) {
  const config = loadConfig()
  connectDatabase(config)
  try {
    return await transaction(async client => {
      await requireMigration(client)
      const courseIds = new Map()
      for (const course of plan.courses) {
        courseIds.set(course.code, await upsertCourse(client, plan.sourceSystem, course))
      }

      const lessonIds = new Map()
      for (const lesson of plan.lessons) {
        const courseId = courseIds.get(lesson.courseCode)
        if (!courseId) fail(`missing target course for lesson ${lesson.sourceId}`)
        lessonIds.set(lesson.sourceId, await upsertLesson(client, plan.sourceSystem, lesson, courseId))
      }

      const testIds = new Map()
      for (const test of plan.tests) {
        const courseId = courseIds.get(test.courseCode)
        if (!courseId) fail(`missing target course for test ${test.sourceId}`)
        const lessonId = test.sourceLessonId == null ? null : lessonIds.get(test.sourceLessonId)
        if (test.sourceLessonId !== null && !lessonId) fail(`missing target lesson for test ${test.sourceId}`)
        testIds.set(test.sourceId, await upsertTest(client, plan.sourceSystem, test, courseId, lessonId ?? null))
      }

      for (const question of plan.questions) {
        const testId = testIds.get(question.sourceTestId)
        if (!testId) fail(`missing target test for question ${question.sourceId}`)
        await upsertQuestion(client, plan.sourceSystem, question, testId)
      }

      for (const deferred of plan.deferred) {
        await recordImport(client, {
          sourceSystem: plan.sourceSystem,
          sourceEntity: 'question',
          sourceId: deferred.sourceId,
          fingerprint: deferred.fingerprint,
          status: 'deferred',
          details: { reason: deferred.reason, sourceTestId: deferred.sourceTestId, subject: deferred.subject ?? null },
        })
      }

      const summary = importPlanSummary(plan)
      await client.query(
        `INSERT INTO audit_log (actor_user_id, action, target_type, target_id, metadata)
         VALUES (NULL, 'import_legacy_demo_content', 'migration', $1, $2::jsonb)`,
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
  const plan = await fetchLegacyDemoPlan()
  const summary = importPlanSummary(plan)
  if (!apply) {
    process.stdout.write(`${JSON.stringify({ status: 'dry-run', ...summary }, null, 2)}\n`)
    return
  }
  const result = await applyPlan(plan)
  process.stdout.write(`${JSON.stringify({ status: 'applied', ...result }, null, 2)}\n`)
}

main().catch(error => {
  // Source URLs and keys are deliberately absent from errors and output.
  console.error(error instanceof Error ? error.message : 'Legacy demo importer failed')
  process.exitCode = 1
})
