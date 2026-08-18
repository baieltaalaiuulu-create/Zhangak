import { copyFile, mkdir, rm } from 'node:fs/promises'
import { dirname, isAbsolute, resolve } from 'node:path'
import process from 'node:process'

import { loadConfig } from '../src/config.js'
import { closeDatabase, connectDatabase, transaction } from '../src/db.js'
import { buildReviewedMaterialPlan, materialStorageKey, reviewedMaterialSummary } from '../src/reviewed-material-import.js'

const REQUIRED_MIGRATIONS = ['005_legacy_demo_import_ledger.sql', '008_private_material_storage.sql', '012_course_roadmaps.sql', '013_fix_private_storage_key_constraint.sql']

function fail(message) {
  throw new Error(`Reviewed material importer blocked: ${message}`)
}

function args(values) {
  if (values.length === 0 || (values.length === 1 && values[0] === '--dry-run')) return { apply: false }
  if (values.length === 2 && values[0] === '--apply' && values[1] === '--confirm-reviewed') return { apply: true }
  fail('usage: node scripts/import-reviewed-materials.mjs [--dry-run|--apply --confirm-reviewed]')
}

function roots() {
  const sourceRoot = process.env.ZHANGAK_SORTED_DATA_ROOT?.trim()
  const storageRoot = process.env.ZHANGAK_STORAGE_ROOT?.trim()
  if (!sourceRoot || !isAbsolute(sourceRoot)) fail('ZHANGAK_SORTED_DATA_ROOT must be an absolute path')
  if (!storageRoot || !isAbsolute(storageRoot)) fail('ZHANGAK_STORAGE_ROOT must be an absolute path')
  return { sourceRoot: resolve(sourceRoot), storageRoot: resolve(storageRoot) }
}

async function requireSchema(client) {
  const found = await client.query('SELECT version FROM schema_migrations WHERE version = ANY($1::text[])', [REQUIRED_MIGRATIONS])
  const applied = new Set(found.rows.map(row => row.version))
  for (const migration of REQUIRED_MIGRATIONS) if (!applied.has(migration)) fail(`${migration} is not applied`)
}

async function actor(client) {
  const found = await client.query(
    `SELECT u.id FROM users u JOIN profiles p ON p.user_id = u.id
      WHERE u.blocked = false AND p.role IN ('super_admin', 'admin')
      ORDER BY CASE p.role WHEN 'super_admin' THEN 0 ELSE 1 END, u.created_at LIMIT 1`,
  )
  if (!found.rows[0]) fail('an active admin is required to attest the reviewed import')
  return found.rows[0].id
}

async function ensureCurriculum(client, actorId) {
  const courses = await client.query(`SELECT id, code FROM courses WHERE code IN ('demo-ort-kyr', 'demo-ort-math') FOR UPDATE`)
  if (courses.rowCount !== 2) fail('expected online demo courses are missing')
  const courseIds = new Map(courses.rows.map(row => [row.code, Number(row.id)]))
  const kyrCourseId = courseIds.get('demo-ort-kyr')
  const existing = await client.query('SELECT id FROM lessons WHERE course_id = $1 AND lesson_number = 3 FOR UPDATE', [kyrCourseId])
  if (!existing.rows[0]) {
    await client.query(
      `INSERT INTO lessons (course_id, lesson_number, title, description, subject, section, topic, duration_minutes, is_published, created_by)
       VALUES ($1, 3, 'Кыргыз тили: грамматика', 'Морфология жана практикалык грамматика боюнча автордук материалдар.', 'kyr', 'grammar', 'practical-grammar', 45, true, $2)`,
      [kyrCourseId, actorId],
    )
  }
  const lessons = await client.query(
    `SELECT l.id, l.course_id, l.lesson_number, c.code FROM lessons l JOIN courses c ON c.id = l.course_id
      WHERE c.code IN ('demo-ort-kyr', 'demo-ort-math') AND l.lesson_number BETWEEN 1 AND 3 FOR UPDATE`,
  )
  const lessonIds = new Map(lessons.rows.map(row => [`${row.code}:${row.lesson_number}`, Number(row.id)]))
  for (const key of ['demo-ort-kyr:1', 'demo-ort-kyr:2', 'demo-ort-kyr:3', 'demo-ort-math:1', 'demo-ort-math:2', 'demo-ort-math:3']) {
    if (!lessonIds.has(key)) fail(`required lesson ${key} is missing`)
  }

  const units = [
    ['demo-ort-kyr', 1, 'Аналогиялар', 'Логикалык байланыштарды кадам сайын өздөштүр.', 'green', [1, 2]],
    ['demo-ort-kyr', 2, 'Кыргыз тили', 'Грамматика жана морфология боюнча материалдар.', 'violet', [3]],
    ['demo-ort-math', 1, 'Сандар жана алгебра', 'Сандар, бөлчөктөр, пропорциялар жана формулалар.', 'blue', [1, 2]],
    ['demo-ort-math', 2, 'Геометрия', 'Үч бурчтук жана төрт бурчтуктар боюнча практика.', 'red', [3]],
  ]
  for (const [code, number, title, description, accent, lessonNumbers] of units) {
    const courseId = courseIds.get(code)
    const inserted = await client.query(
      `INSERT INTO course_units (course_id, unit_number, title, description, accent_color, is_published, created_by)
       VALUES ($1, $2, $3, $4, $5, true, $6)
       ON CONFLICT (course_id, unit_number) DO UPDATE SET title = EXCLUDED.title, description = EXCLUDED.description,
         accent_color = EXCLUDED.accent_color, is_published = true
       RETURNING id`,
      [courseId, number, title, description, accent, actorId],
    )
    const unitId = Number(inserted.rows[0].id)
    let position = 1
    for (const lessonNumber of lessonNumbers) {
      const lessonId = lessonIds.get(`${code}:${lessonNumber}`)
      await client.query(
        `INSERT INTO course_unit_lessons (unit_id, course_id, lesson_id, position) VALUES ($1, $2, $3, $4)
         ON CONFLICT (course_id, lesson_id) DO UPDATE SET unit_id = EXCLUDED.unit_id, position = EXCLUDED.position`,
        [unitId, courseId, lessonId, position],
      )
      position += 1
    }
  }
  await client.query(
    `UPDATE practice_tests t SET course_id = $1, is_published = true
      FROM legacy_content_imports i
     WHERE i.source_system = 'sorted_data_docx_v1' AND i.source_entity = 'practice_test'
       AND i.status = 'imported' AND i.target_entity = 'practice_tests' AND i.target_id = t.id::text`,
    [kyrCourseId],
  )
  return { courseIds, lessonIds }
}

async function existing(client, plan, item) {
  const found = await client.query(
    `SELECT target_id, content_sha256, status FROM legacy_content_imports
      WHERE source_system = $1 AND source_entity = 'lesson_material' AND source_id = $2 FOR UPDATE`,
    [plan.sourceSystem, item.sourceId],
  )
  const row = found.rows[0]
  if (!row) return null
  if (row.status !== 'imported' || row.content_sha256 !== item.contentSha256 || !/^\d+$/u.test(String(row.target_id))) {
    fail(`immutable fingerprint changed for ${item.sourceId}`)
  }
  const target = await client.query('SELECT id FROM lesson_materials WHERE id = $1', [row.target_id])
  if (!target.rows[0]) fail(`ledger target ${row.target_id} is missing`)
  return Number(row.target_id)
}

async function nextPosition(client, lessonId) {
  const result = await client.query('SELECT COALESCE(MAX(position), 0) + 1 AS position FROM lesson_materials WHERE lesson_id = $1', [lessonId])
  return Number(result.rows[0].position)
}

async function apply(plan, storageRoot) {
  connectDatabase(loadConfig())
  const copied = []
  try {
    const result = await transaction(async client => {
      await requireSchema(client)
      const actorId = await actor(client)
      const { lessonIds } = await ensureCurriculum(client, actorId)
      let imported = 0
      let reused = 0
      for (const item of plan.materials) {
        if (await existing(client, plan, item)) { reused += 1; continue }
        const lessonId = lessonIds.get(`${item.courseCode}:${item.lessonNumber}`)
        const storageKey = materialStorageKey(lessonId)
        const destination = resolve(storageRoot, storageKey)
        await mkdir(dirname(destination), { recursive: true })
        await copyFile(item.sourcePath, destination)
        copied.push(destination)
        const position = await nextPosition(client, lessonId)
        const inserted = await client.query(
          `INSERT INTO lesson_materials (lesson_id, material_type, title, position, storage_key, mime_type, byte_size,
             is_published, created_by, scan_status, scanned_at, scanned_by, original_filename, content_sha256)
           VALUES ($1, 'document', $2, $3, $4, 'application/pdf', $5, true, $6, 'clean', now(), $6, $7, $8)
           RETURNING id`,
          [lessonId, item.title, position, storageKey, item.byteSize, actorId, item.sourceId.split('/').at(-1), item.contentSha256],
        )
        const materialId = Number(inserted.rows[0].id)
        await client.query(
          `INSERT INTO legacy_content_imports (source_system, source_entity, source_id, target_entity, target_id,
             content_sha256, status, details)
           VALUES ($1, 'lesson_material', $2, 'lesson_materials', $3, $4, 'imported', $5::jsonb)`,
          [plan.sourceSystem, item.sourceId, String(materialId), item.contentSha256, JSON.stringify({ lessonId, storageKey, reviewed: true })],
        )
        imported += 1
      }
      await client.query(
        `INSERT INTO audit_log (actor_user_id, action, target_type, target_id, metadata)
         VALUES ($1, 'import_reviewed_lesson_materials', 'content_import', $2, $3::jsonb)`,
        [actorId, plan.sourceSystem, JSON.stringify({ ...reviewedMaterialSummary(plan), imported, reused })],
      )
      return { imported, reused }
    })
    return result
  } catch (error) {
    await Promise.all(copied.map(path => rm(path, { force: true }).catch(() => {})))
    throw error
  } finally {
    await closeDatabase()
  }
}

async function main() {
  const options = args(process.argv.slice(2))
  const { sourceRoot, storageRoot } = roots()
  const plan = await buildReviewedMaterialPlan(sourceRoot)
  const summary = reviewedMaterialSummary(plan)
  if (!options.apply) {
    process.stdout.write(`${JSON.stringify({ status: 'dry-run', ...summary }, null, 2)}\n`)
    return
  }
  const result = await apply(plan, storageRoot)
  process.stdout.write(`${JSON.stringify({ status: 'applied', ...summary, ...result }, null, 2)}\n`)
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : 'Reviewed material import failed')
  process.exitCode = 1
})
