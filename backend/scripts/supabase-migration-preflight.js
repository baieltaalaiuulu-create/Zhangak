/**
 * Read-only, local preflight for a future Supabase -> Zhangak data migration.
 *
 * This script deliberately has no PostgreSQL, HTTP, Supabase CLI, shell, or
 * write-file dependency.  It validates a reviewed local snapshot, mapping
 * manifest, and checksum ledger, then stops before an importer could run.
 */
import { createHash } from 'node:crypto'
import { readFile, readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const migrationsDirectory = path.join(backendRoot, 'migrations')

export const EXIT = Object.freeze({
  OK: 0,
  USAGE: 64,
  INVALID_ARTIFACTS: 65,
  NO_EXECUTOR: 78,
})

const INVENTORY_FORMAT = 'zhangak.supabase-source-inventory/v1'
const MANIFEST_FORMAT = 'zhangak.supabase-mapping-manifest/v1'
const LEDGER_FORMAT = 'zhangak.supabase-checksum-ledger/v1'
const SHA256_PATTERN = /^[a-f0-9]{64}$/
const IDENTIFIER_PATTERN = /^[a-z_][a-z0-9_]*$/
const ARTIFACT_KEY_PATTERN = /^[a-z][a-z0-9._-]{1,127}$/
const SECRET_LIKE_VALUE = /(?:postgres(?:ql)?:\/\/|sb_(?:publishable|secret)_[a-z0-9_-]{12,}|eyJ[a-z0-9_-]{20,}\.[a-z0-9_-]{8,}\.)/i

class PreflightError extends Error {
  constructor(message, exitCode = EXIT.INVALID_ARTIFACTS) {
    super(message)
    this.exitCode = exitCode
  }
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function object(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new PreflightError(`${label} must be an object`)
  }
  return value
}

function string(value, label, { min = 1, max = 4_096 } = {}) {
  if (typeof value !== 'string' || value.length < min || value.length > max) {
    throw new PreflightError(`${label} must be a string between ${min} and ${max} characters`)
  }
  return value
}

function array(value, label) {
  if (!Array.isArray(value)) throw new PreflightError(`${label} must be an array`)
  return value
}

function identifier(value, label) {
  const result = string(value, label, { max: 63 })
  if (!IDENTIFIER_PATTERN.test(result)) throw new PreflightError(`${label} must be a lowercase SQL identifier`)
  return result
}

function checksum(value, label) {
  const result = string(value, label, { min: 64, max: 64 })
  if (!SHA256_PATTERN.test(result)) throw new PreflightError(`${label} must be a lowercase SHA-256 checksum`)
  return result
}

function nonNegativeInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) throw new PreflightError(`${label} must be a non-negative integer`)
  return value
}

function unique(values, label) {
  if (new Set(values).size !== values.length) throw new PreflightError(`${label} must not contain duplicates`)
}

function assertNoSecretLikeValues(value, label, trail = label) {
  if (typeof value === 'string') {
    if (SECRET_LIKE_VALUE.test(value)) {
      throw new PreflightError(`${trail} appears to contain a credential or token; keep secrets outside migration artifacts`)
    }
    return
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoSecretLikeValues(item, label, `${trail}[${index}]`))
    return
  }
  if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) assertNoSecretLikeValues(item, label, `${trail}.${key}`)
  }
}

function normalizedArtifactPath(value, label) {
  const source = string(value, label, { max: 1_024 }).replaceAll('\\', '/')
  const segments = source.split('/')
  if (source.startsWith('/') || segments.some(segment => !segment || segment === '.' || segment === '..')) {
    throw new PreflightError(`${label} must be a relative path without traversal`)
  }
  return segments
}

function sameFileSystemPath(parent, candidate) {
  const relative = path.relative(parent, candidate)
  return relative && !relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative)
}

async function readJson(file, label) {
  let raw
  try {
    raw = await readFile(file)
  } catch {
    throw new PreflightError(`${label} cannot be read`)
  }
  try {
    return { raw, value: JSON.parse(raw.toString('utf8')) }
  } catch {
    throw new PreflightError(`${label} must contain valid JSON`)
  }
}

function assertIsoTimestamp(value, label) {
  const parsed = Date.parse(string(value, label, { min: 20, max: 64 }))
  if (!Number.isFinite(parsed)) throw new PreflightError(`${label} must be an ISO-8601 timestamp`)
}

function tableKey(schema, table) {
  return `${schema}.${table}`
}

function validateInventory(inventory) {
  object(inventory, 'inventory')
  if (inventory.format !== INVENTORY_FORMAT) throw new PreflightError(`inventory.format must equal ${INVENTORY_FORMAT}`)
  if (inventory.status !== 'complete') {
    throw new PreflightError('inventory.status must be "complete" after an owner-approved, read-only source capture')
  }

  const project = object(inventory.project, 'inventory.project')
  if (project.kind !== 'supabase-postgres') throw new PreflightError('inventory.project.kind must be "supabase-postgres"')
  if (!/^[a-z0-9]{8,64}$/.test(string(project.projectRef, 'inventory.project.projectRef', { max: 64 }))) {
    throw new PreflightError('inventory.project.projectRef must be a Supabase project reference, not a URL')
  }

  const capture = object(inventory.capture, 'inventory.capture')
  if (capture.mode !== 'read-only') throw new PreflightError('inventory.capture.mode must be "read-only"')
  assertIsoTimestamp(capture.capturedAt, 'inventory.capture.capturedAt')
  checksum(capture.schemaSha256, 'inventory.capture.schemaSha256')
  string(capture.schemaDumpReference, 'inventory.capture.schemaDumpReference', { max: 512 })

  const tables = array(inventory.tables, 'inventory.tables')
  if (tables.length === 0) throw new PreflightError('inventory.tables must contain the captured source tables')
  const keys = []
  const tableByKey = new Map()
  for (const [index, source] of tables.entries()) {
    const row = object(source, `inventory.tables[${index}]`)
    const schema = identifier(row.schema, `inventory.tables[${index}].schema`)
    const name = identifier(row.name, `inventory.tables[${index}].name`)
    const key = tableKey(schema, name)
    keys.push(key)
    if (!['captured', 'excluded'].includes(row.captureStatus)) {
      throw new PreflightError(`inventory.tables[${index}].captureStatus must be "captured" or "excluded"`)
    }
    nonNegativeInteger(row.rowCount, `inventory.tables[${index}].rowCount`)
    if (row.captureStatus === 'excluded') {
      string(row.exclusionReason, `inventory.tables[${index}].exclusionReason`, { max: 1_000 })
      if (row.artifactKey != null) throw new PreflightError(`inventory.tables[${index}].artifactKey must be null for excluded tables`)
      tableByKey.set(key, { ...row, schema, name })
      continue
    }

    const primaryKey = array(row.primaryKey, `inventory.tables[${index}].primaryKey`)
      .map((column, columnIndex) => identifier(column, `inventory.tables[${index}].primaryKey[${columnIndex}]`))
    if (primaryKey.length === 0) throw new PreflightError(`inventory.tables[${index}].primaryKey must not be empty for captured tables`)
    unique(primaryKey, `inventory.tables[${index}].primaryKey`)

    const columns = array(row.columns, `inventory.tables[${index}].columns`)
    if (columns.length === 0) throw new PreflightError(`inventory.tables[${index}].columns must not be empty for captured tables`)
    const columnNames = columns.map((column, columnIndex) => {
      const details = object(column, `inventory.tables[${index}].columns[${columnIndex}]`)
      const columnName = identifier(details.name, `inventory.tables[${index}].columns[${columnIndex}].name`)
      string(details.dataType, `inventory.tables[${index}].columns[${columnIndex}].dataType`, { max: 160 })
      if (typeof details.nullable !== 'boolean') throw new PreflightError(`inventory.tables[${index}].columns[${columnIndex}].nullable must be boolean`)
      return columnName
    })
    unique(columnNames, `inventory.tables[${index}].columns`)
    for (const primaryKeyColumn of primaryKey) {
      if (!columnNames.includes(primaryKeyColumn)) throw new PreflightError(`inventory.tables[${index}].primaryKey references an unknown column`)
    }

    if (row.rowCount > 0 && !ARTIFACT_KEY_PATTERN.test(string(row.artifactKey, `inventory.tables[${index}].artifactKey`, { max: 128 }))) {
      throw new PreflightError(`inventory.tables[${index}].artifactKey is invalid`)
    }
    if (row.rowCount === 0 && row.artifactKey != null && !ARTIFACT_KEY_PATTERN.test(string(row.artifactKey, `inventory.tables[${index}].artifactKey`, { max: 128 }))) {
      throw new PreflightError(`inventory.tables[${index}].artifactKey is invalid`)
    }
    tableByKey.set(key, { ...row, schema, name, columnNames })
  }
  unique(keys, 'inventory.tables')
  return tableByKey
}

async function currentMigrationLock() {
  const files = (await readdir(migrationsDirectory))
    .filter(file => /^\d+_[a-z0-9_-]+\.sql$/i.test(file))
    .sort()
  return Promise.all(files.map(async file => ({
    file,
    sha256: sha256(await readFile(path.join(migrationsDirectory, file))),
  })))
}

async function currentTargetTables() {
  const lock = await currentMigrationLock()
  const tables = new Set()
  for (const migration of lock) {
    const sql = await readFile(path.join(migrationsDirectory, migration.file), 'utf8')
    for (const match of sql.matchAll(/^CREATE TABLE ([a-z_][a-z0-9_]*) \(/gmi)) tables.add(match[1])
  }
  return tables
}

function validateMigrationLock(manifestLock, actualLock) {
  const lock = array(manifestLock, 'manifest.targetSchema.migrations')
  if (lock.length !== actualLock.length) throw new PreflightError('manifest target migration lock does not match the current Zhangak schema')
  for (const [index, actual] of actualLock.entries()) {
    const recorded = object(lock[index], `manifest.targetSchema.migrations[${index}]`)
    if (recorded.file !== actual.file || checksum(recorded.sha256, `manifest.targetSchema.migrations[${index}].sha256`) !== actual.sha256) {
      throw new PreflightError(`manifest target migration lock changed at ${actual.file}`)
    }
  }
}

function assertAcyclicDependencies(mappings) {
  const state = new Map()
  const byId = new Map(mappings.map(mapping => [mapping.id, mapping]))
  function visit(id, trail = []) {
    const current = state.get(id)
    if (current === 'done') return
    if (current === 'visiting') throw new PreflightError(`manifest.mapping dependency cycle: ${[...trail, id].join(' -> ')}`)
    state.set(id, 'visiting')
    for (const dependency of byId.get(id).dependencies) visit(dependency, [...trail, id])
    state.set(id, 'done')
  }
  for (const mapping of mappings) visit(mapping.id)
}

async function validateManifest(manifest, inventoryHash, sourceTables) {
  object(manifest, 'manifest')
  if (manifest.format !== MANIFEST_FORMAT) throw new PreflightError(`manifest.format must equal ${MANIFEST_FORMAT}`)
  if (manifest.status !== 'ready') {
    throw new PreflightError('manifest.status must be "ready"; templates and review-blocked mappings cannot be applied')
  }
  if (checksum(manifest.inventorySha256, 'manifest.inventorySha256') !== inventoryHash) {
    throw new PreflightError('manifest.inventorySha256 does not lock the supplied inventory')
  }
  const targetSchema = object(manifest.targetSchema, 'manifest.targetSchema')
  validateMigrationLock(targetSchema.migrations, await currentMigrationLock())
  const targetTables = await currentTargetTables()

  const mappings = array(manifest.mappings, 'manifest.mappings')
  if (mappings.length === 0) throw new PreflightError('manifest.mappings must not be empty')
  const identifiers = []
  const parsed = []
  for (const [index, rawMapping] of mappings.entries()) {
    const mapping = object(rawMapping, `manifest.mappings[${index}]`)
    const id = string(mapping.id, `manifest.mappings[${index}].id`, { max: 80 })
    if (!/^[a-z][a-z0-9_-]*$/.test(id)) throw new PreflightError(`manifest.mappings[${index}].id is invalid`)
    identifiers.push(id)
    if (mapping.status !== 'ready') throw new PreflightError(`manifest.mappings[${index}].status must be "ready"`)
    const source = object(mapping.source, `manifest.mappings[${index}].source`)
    const sourceSchema = identifier(source.schema, `manifest.mappings[${index}].source.schema`)
    const sourceTable = identifier(source.table, `manifest.mappings[${index}].source.table`)
    const sourceKey = tableKey(sourceSchema, sourceTable)
    const sourceInventory = sourceTables.get(sourceKey)
    if (!sourceInventory || sourceInventory.captureStatus !== 'captured') {
      throw new PreflightError(`manifest.mappings[${index}] references a source table that is not captured: ${sourceKey}`)
    }
    const requiredColumns = array(source.requiredColumns, `manifest.mappings[${index}].source.requiredColumns`)
      .map((column, columnIndex) => identifier(column, `manifest.mappings[${index}].source.requiredColumns[${columnIndex}]`))
    if (requiredColumns.length === 0) throw new PreflightError(`manifest.mappings[${index}].source.requiredColumns must not be empty`)
    unique(requiredColumns, `manifest.mappings[${index}].source.requiredColumns`)
    for (const column of requiredColumns) {
      if (!sourceInventory.columnNames.includes(column)) {
        throw new PreflightError(`manifest.mappings[${index}] requires an unavailable source column: ${sourceKey}.${column}`)
      }
    }

    const target = object(mapping.target, `manifest.mappings[${index}].target`)
    const tables = array(target.tables, `manifest.mappings[${index}].target.tables`)
      .map((table, tableIndex) => identifier(table, `manifest.mappings[${index}].target.tables[${tableIndex}]`))
    if (tables.length === 0) throw new PreflightError(`manifest.mappings[${index}].target.tables must not be empty`)
    unique(tables, `manifest.mappings[${index}].target.tables`)
    for (const table of tables) {
      if (!targetTables.has(table)) throw new PreflightError(`manifest.mappings[${index}] targets an unavailable Zhangak table: ${table}`)
    }
    const fieldMappings = object(target.fieldMappings, `manifest.mappings[${index}].target.fieldMappings`)
    if (Object.keys(fieldMappings).length === 0) throw new PreflightError(`manifest.mappings[${index}].target.fieldMappings must not be empty`)
    for (const [targetColumn, sourceExpression] of Object.entries(fieldMappings)) {
      identifier(targetColumn, `manifest.mappings[${index}].target.fieldMappings key`)
      string(sourceExpression, `manifest.mappings[${index}].target.fieldMappings.${targetColumn}`, { max: 500 })
    }
    if (target.identityStrategy !== 'new-target-id-with-staging-map' && target.identityStrategy !== 'preserve-verified-uuid') {
      throw new PreflightError(`manifest.mappings[${index}].target.identityStrategy is not an approved strategy`)
    }

    const dependencies = array(mapping.dependencies, `manifest.mappings[${index}].dependencies`)
      .map((dependency, dependencyIndex) => string(dependency, `manifest.mappings[${index}].dependencies[${dependencyIndex}]`, { max: 80 }))
    unique(dependencies, `manifest.mappings[${index}].dependencies`)
    string(mapping.reviewNote, `manifest.mappings[${index}].reviewNote`, { max: 2_000 })
    parsed.push({ id, dependencies, sourceKey, sourceInventory })
  }
  unique(identifiers, 'manifest.mappings')
  const allIds = new Set(identifiers)
  for (const mapping of parsed) {
    for (const dependency of mapping.dependencies) {
      if (!allIds.has(dependency)) throw new PreflightError(`manifest mapping ${mapping.id} has an unknown dependency: ${dependency}`)
    }
  }
  assertAcyclicDependencies(parsed)
  return parsed
}

async function validateLedger(ledger, inventoryHash, inventory, ledgerDirectory) {
  object(ledger, 'ledger')
  if (ledger.format !== LEDGER_FORMAT) throw new PreflightError(`ledger.format must equal ${LEDGER_FORMAT}`)
  if (checksum(ledger.inventorySha256, 'ledger.inventorySha256') !== inventoryHash) {
    throw new PreflightError('ledger.inventorySha256 does not lock the supplied inventory')
  }
  if (checksum(ledger.sourceSchemaSha256, 'ledger.sourceSchemaSha256') !== inventory.capture.schemaSha256) {
    throw new PreflightError('ledger.sourceSchemaSha256 does not match inventory.capture.schemaSha256')
  }

  const artifacts = array(ledger.artifacts, 'ledger.artifacts')
  const keys = []
  const artifactByKey = new Map()
  for (const [index, rawArtifact] of artifacts.entries()) {
    const artifact = object(rawArtifact, `ledger.artifacts[${index}]`)
    const key = string(artifact.key, `ledger.artifacts[${index}].key`, { max: 128 })
    if (!ARTIFACT_KEY_PATTERN.test(key)) throw new PreflightError(`ledger.artifacts[${index}].key is invalid`)
    keys.push(key)
    const segments = normalizedArtifactPath(artifact.path, `ledger.artifacts[${index}].path`)
    if (!['ndjson', 'csv'].includes(artifact.format)) throw new PreflightError(`ledger.artifacts[${index}].format must be "ndjson" or "csv"`)
    const bytes = nonNegativeInteger(artifact.bytes, `ledger.artifacts[${index}].bytes`)
    nonNegativeInteger(artifact.rowCount, `ledger.artifacts[${index}].rowCount`)
    const expectedChecksum = checksum(artifact.sha256, `ledger.artifacts[${index}].sha256`)
    const file = path.resolve(ledgerDirectory, ...segments)
    if (!sameFileSystemPath(ledgerDirectory, file)) throw new PreflightError(`ledger.artifacts[${index}].path escapes the ledger directory`)
    let details
    let content
    try {
      [details, content] = await Promise.all([stat(file), readFile(file)])
    } catch {
      throw new PreflightError(`ledger artifact cannot be read: ${key}`)
    }
    if (!details.isFile() || details.size !== bytes) throw new PreflightError(`ledger artifact byte count does not match: ${key}`)
    if (sha256(content) !== expectedChecksum) throw new PreflightError(`ledger artifact checksum does not match: ${key}`)
    artifactByKey.set(key, { ...artifact, key })
  }
  unique(keys, 'ledger.artifacts')
  for (const source of inventory.tables) {
    if (source.captureStatus === 'captured' && source.rowCount > 0 && !artifactByKey.has(source.artifactKey)) {
      throw new PreflightError(`captured non-empty source table is missing a ledger artifact: ${source.schema}.${source.name}`)
    }
  }
  return artifactByKey
}

function sourceAndTargetDatabases(environment) {
  const sourceValue = environment.SUPABASE_SOURCE_DATABASE_URL?.trim()
  const targetValue = environment.ZHANGAK_TARGET_DATABASE_URL?.trim()
  if (!sourceValue) {
    throw new PreflightError('SUPABASE_SOURCE_DATABASE_URL must be explicitly supplied through the environment', EXIT.USAGE)
  }
  if (!targetValue) {
    throw new PreflightError('ZHANGAK_TARGET_DATABASE_URL must be explicitly supplied through the environment', EXIT.USAGE)
  }
  let source
  let target
  try {
    source = new URL(sourceValue)
    target = new URL(targetValue)
  } catch {
    throw new PreflightError('source and target environment values must be PostgreSQL URLs', EXIT.USAGE)
  }
  for (const [label, url] of [['source', source], ['target', target]]) {
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname) {
      throw new PreflightError(`${label} environment value must be a PostgreSQL URL with a host`, EXIT.USAGE)
    }
  }
  if (!/(^|\.)supabase\.(co|com)$/i.test(source.hostname)) {
    throw new PreflightError('SUPABASE_SOURCE_DATABASE_URL must point to a Supabase database host', EXIT.USAGE)
  }
  if (/(^|\.)supabase\.(co|com)$/i.test(target.hostname)) {
    throw new PreflightError('ZHANGAK_TARGET_DATABASE_URL must not point to Supabase', EXIT.USAGE)
  }
  const sameLocation = source.hostname === target.hostname
    && source.port === target.port
    && source.pathname === target.pathname
    && source.username === target.username
  if (sameLocation) throw new PreflightError('source and target must be distinct database locations', EXIT.USAGE)
  return { source, target }
}

function assertSourceMatchesInventory(source, projectRef) {
  const expectedHosts = new Set([
    `db.${projectRef}.supabase.co`,
    `db.${projectRef}.supabase.com`,
  ])
  if (!expectedHosts.has(source.hostname.toLowerCase())) {
    throw new PreflightError('SUPABASE_SOURCE_DATABASE_URL must use the direct database host for inventory.project.projectRef', EXIT.USAGE)
  }
}

export function parseArgs(argv) {
  const result = { apply: false, inventory: null, manifest: null, ledger: null, help: false }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--apply') {
      if (result.apply) throw new PreflightError('--apply may be supplied only once', EXIT.USAGE)
      result.apply = true
      continue
    }
    if (argument === '--help' || argument === '-h') {
      result.help = true
      continue
    }
    if (!['--inventory', '--manifest', '--ledger'].includes(argument)) {
      throw new PreflightError(`unknown argument: ${argument}`, EXIT.USAGE)
    }
    const value = argv[index + 1]
    if (!value || value.startsWith('--')) throw new PreflightError(`${argument} requires a file path`, EXIT.USAGE)
    const key = argument.slice(2)
    if (result[key]) throw new PreflightError(`${argument} may be supplied only once`, EXIT.USAGE)
    result[key] = value
    index += 1
  }
  return result
}

function usage() {
  return [
    'Usage:',
    '  SUPABASE_SOURCE_DATABASE_URL=… ZHANGAK_TARGET_DATABASE_URL=… node scripts/supabase-migration-preflight.js --apply --inventory <source-inventory.json> --manifest <mapping-manifest.json> --ledger <checksum-ledger.json>',
    '',
    'This is a read-only local preflight. It never opens a database or network connection and deliberately has no importer.',
  ].join('\n')
}

export async function inspectPreflight(options) {
  const inventoryPath = path.resolve(options.inventory)
  const manifestPath = path.resolve(options.manifest)
  const ledgerPath = path.resolve(options.ledger)
  const [inventoryDocument, manifestDocument, ledgerDocument] = await Promise.all([
    readJson(inventoryPath, 'inventory'),
    readJson(manifestPath, 'manifest'),
    readJson(ledgerPath, 'ledger'),
  ])
  const inventoryHash = sha256(inventoryDocument.raw)
  assertNoSecretLikeValues(inventoryDocument.value, 'inventory')
  assertNoSecretLikeValues(manifestDocument.value, 'manifest')
  assertNoSecretLikeValues(ledgerDocument.value, 'ledger')
  const sourceTables = validateInventory(inventoryDocument.value)
  const mappings = await validateManifest(manifestDocument.value, inventoryHash, sourceTables)
  const artifacts = await validateLedger(ledgerDocument.value, inventoryHash, inventoryDocument.value, path.dirname(ledgerPath))
  for (const mapping of mappings) {
    if (mapping.sourceInventory.rowCount > 0 && !artifacts.has(mapping.sourceInventory.artifactKey)) {
      throw new PreflightError(`ready mapping ${mapping.id} has no verified source artifact`)
    }
  }
  return {
    inventorySha256: inventoryHash,
    projectRef: inventoryDocument.value.project.projectRef,
    sourceTables: sourceTables.size,
    mappings: mappings.length,
    artifacts: artifacts.size,
  }
}

export async function main(argv = process.argv.slice(2), environment = process.env, output = process.stdout, errorOutput = process.stderr) {
  let options
  try {
    options = parseArgs(argv)
    if (options.help) {
      output.write(`${usage()}\n`)
      return EXIT.OK
    }
    if (!options.apply) {
      throw new PreflightError('refusing to continue without explicit --apply; no database connection was opened', EXIT.USAGE)
    }
    for (const key of ['inventory', 'manifest', 'ledger']) {
      if (!options[key]) throw new PreflightError(`--${key} is required`, EXIT.USAGE)
    }
    const databases = sourceAndTargetDatabases(environment)
    const report = await inspectPreflight(options)
    assertSourceMatchesInventory(databases.source, report.projectRef)
    output.write(`${JSON.stringify({
      status: 'preflight-complete-executor-unavailable',
      sourceTables: report.sourceTables,
      mappings: report.mappings,
      artifacts: report.artifacts,
      inventorySha256: report.inventorySha256,
    }, null, 2)}\n`)
    errorOutput.write('Preflight validated local artifacts only. No database or network connection was opened; this toolkit intentionally contains no importer.\n')
    return EXIT.NO_EXECUTOR
  } catch (error) {
    const safeError = error instanceof PreflightError
      ? error
      : new PreflightError('unexpected local preflight error')
    errorOutput.write(`Migration preflight blocked: ${safeError.message}\n`)
    return safeError.exitCode
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main()
}
