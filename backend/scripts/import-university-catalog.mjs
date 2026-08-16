/**
 * Curated, source-backed university catalog importer. It is dry-run by
 * default and deliberately leaves volatile admission scores and fees null
 * unless the reviewed JSON contains a source-specific value.
 */
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import process from 'node:process'

import { loadConfig } from '../src/config.js'
import { closeDatabase, connectDatabase, transaction } from '../src/db.js'

const DATA_PATH = resolve(import.meta.dirname, '../data/university-catalog-2025-2026.json')
const SOURCE_SYSTEM = 'university_catalog_2025_2026'
const LEDGER_MIGRATION = '005_legacy_demo_import_ledger.sql'

function fail(message) { throw new Error(`University catalog importer blocked: ${message}`) }
function digest(value) { return createHash('sha256').update(value).digest('hex') }

function parseArgs(args) {
  if (args.length === 0 || (args.length === 1 && args[0] === '--dry-run')) return { apply: false }
  if (args.length === 1 && args[0] === '--apply') return { apply: true }
  fail('usage: node scripts/import-university-catalog.mjs [--dry-run|--apply]')
}

function record(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`invalid ${name}`)
  return value
}

function text(value, name, max) {
  if (typeof value !== 'string' || value.trim().length === 0 || value.trim().length > max) fail(`invalid ${name}`)
  return value.trim()
}

function url(value, name) {
  const parsed = new URL(text(value, name, 2048))
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) fail(`invalid ${name}`)
  return parsed.toString()
}

function parseCatalog(raw) {
  const catalog = record(raw, 'catalog')
  if (catalog.catalogPeriod !== '2025-2026' || !Array.isArray(catalog.universities) || catalog.universities.length === 0) fail('catalog period or universities are invalid')
  return catalog.universities.map(value => {
    const university = record(value, 'university')
    const sourceId = text(university.sourceId, 'sourceId', 120)
    if (!Array.isArray(university.sources) || university.sources.length === 0) fail(`university ${sourceId} has no official sources`)
    const specialties = Array.isArray(university.specialties) ? university.specialties.map(item => {
      const specialty = record(item, 'specialty')
      return {
        name: text(specialty.name, 'specialty name', 300),
        faculty: text(specialty.faculty, 'specialty faculty', 300),
        language: text(specialty.language, 'specialty language', 80),
        form: text(specialty.form, 'specialty form', 80),
        type: text(specialty.type, 'specialty type', 80),
      }
    }) : []
    if (specialties.length === 0) fail(`university ${sourceId} has no specialties`)
    return {
      sourceId,
      name: text(university.name, 'university name', 300),
      city: text(university.city, 'city', 120),
      type: university.type === 'government' || university.type === 'private' ? university.type : fail('university type'),
      description: text(university.description, 'description', 20000),
      websiteUrl: url(university.websiteUrl, 'websiteUrl'),
      languages: university.languages.map(item => text(item, 'language', 80)),
      sources: university.sources.map(item => url(item, 'source URL')),
      specialties,
    }
  })
}

async function loadPlan() {
  const raw = await readFile(DATA_PATH, 'utf8')
  const universities = parseCatalog(JSON.parse(raw))
  return { universities, fingerprint: digest(raw) }
}

function summary(plan) {
  return { sourceSystem: SOURCE_SYSTEM, universities: plan.universities.length, specialties: plan.universities.reduce((total, item) => total + item.specialties.length, 0), published: false }
}

async function requireLedger(client) {
  const result = await client.query('SELECT 1 FROM schema_migrations WHERE version = $1', [LEDGER_MIGRATION])
  if (result.rowCount !== 1) fail(`${LEDGER_MIGRATION} has not been applied to the target database`)
}

async function importUniversity(client, university, planFingerprint) {
  const fingerprint = digest(JSON.stringify({ planFingerprint, university }))
  const existing = await client.query(
    `SELECT target_id, content_sha256 FROM legacy_content_imports
      WHERE source_system = $1 AND source_entity = 'university' AND source_id = $2 FOR UPDATE`,
    [SOURCE_SYSTEM, university.sourceId],
  )
  let id = existing.rows[0]?.target_id ?? null
  if (existing.rowCount === 1 && existing.rows[0].content_sha256 !== fingerprint) fail(`immutable catalog source changed: ${university.sourceId}`)
  if (id) {
    const found = await client.query('SELECT id FROM universities WHERE id = $1 FOR UPDATE', [id])
    if (found.rowCount !== 1) fail(`catalog target missing: ${university.sourceId}`)
    return id
  }
  const inserted = await client.query(
    `INSERT INTO universities (name, city, type, description, website_url, languages, is_active, dormitory, budget_places)
     VALUES ($1, $2, $3, $4, $5, $6::text[], false, false, false) RETURNING id`,
    [university.name, university.city, university.type, university.description, university.websiteUrl, university.languages],
  )
  id = inserted.rows[0].id
  for (const specialty of university.specialties) {
    await client.query(
      `INSERT INTO university_specialties (university_id, name, faculty, min_score, tuition, language, form, type, is_active)
       VALUES ($1, $2, $3, NULL, NULL, $4, $5, $6, false)`,
      [id, specialty.name, specialty.faculty, specialty.language, specialty.form, specialty.type],
    )
  }
  await client.query(
    `INSERT INTO legacy_content_imports (source_system, source_entity, source_id, target_entity, target_id, content_sha256, status, details)
     VALUES ($1, 'university', $2, 'universities', $3, $4, 'imported', $5::jsonb)`,
    [SOURCE_SYSTEM, university.sourceId, String(id), fingerprint, JSON.stringify({ sources: university.sources, published: false })],
  )
  return id
}

async function applyPlan(plan) {
  connectDatabase(loadConfig())
  try {
    return await transaction(async client => {
      await requireLedger(client)
      for (const university of plan.universities) await importUniversity(client, university, plan.fingerprint)
      const result = summary(plan)
      await client.query(
        `INSERT INTO audit_log (actor_user_id, action, target_type, target_id, metadata)
         VALUES (NULL, 'import_university_catalog', 'university_catalog', $1, $2::jsonb)`,
        [SOURCE_SYSTEM, JSON.stringify(result)],
      )
      return result
    })
  } finally {
    await closeDatabase()
  }
}

const { apply } = parseArgs(process.argv.slice(2))
const plan = await loadPlan()
if (!apply) process.stdout.write(`${JSON.stringify({ status: 'dry-run', ...summary(plan) }, null, 2)}\n`)
else process.stdout.write(`${JSON.stringify({ status: 'applied', ...await applyPlan(plan) }, null, 2)}\n`)
