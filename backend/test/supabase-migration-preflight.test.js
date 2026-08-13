import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const script = path.join(backendRoot, 'scripts', 'supabase-migration-preflight.js')
const sourceUrl = 'postgresql://migration_source:source_only@db.exampleprojectref12345.supabase.co:5432/postgres'
const targetUrl = 'postgresql://migration_target:target_only@postgres.internal:5432/zhangak'

function hash(value) {
  return createHash('sha256').update(value).digest('hex')
}

function run(args, environment = {}) {
  return spawnSync(process.execPath, [script, ...args], {
    encoding: 'utf8',
    env: {
      PATH: process.env.PATH,
      SystemRoot: process.env.SystemRoot,
      ...environment,
    },
  })
}

async function targetMigrationLock() {
  const directory = path.join(backendRoot, 'migrations')
  const files = (await readdir(directory)).filter(file => /^\d+_[a-z0-9_-]+\.sql$/i.test(file)).sort()
  return Promise.all(files.map(async file => ({
    file,
    sha256: hash(await readFile(path.join(directory, file))),
  })))
}

async function createReadyCapture() {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'zhangak-supabase-preflight-'))
  const exportsDirectory = path.join(directory, 'exports')
  const artifact = Buffer.from('{"id":1,"name":"Course"}\n', 'utf8')
  const artifactPath = path.join(exportsDirectory, 'public-courses.ndjson')
  await mkdir(exportsDirectory)
  await writeFile(artifactPath, artifact, { flag: 'wx' })

  const inventory = {
    format: 'zhangak.supabase-source-inventory/v1',
    status: 'complete',
    project: { kind: 'supabase-postgres', projectRef: 'exampleprojectref12345' },
    capture: {
      mode: 'read-only',
      capturedAt: '2026-08-13T00:00:00.000Z',
      schemaSha256: 'a'.repeat(64),
      schemaDumpReference: 'outside-git/encrypted/schema.sql',
    },
    tables: [{
      schema: 'public',
      name: 'courses',
      captureStatus: 'captured',
      rowCount: 1,
      primaryKey: ['id'],
      columns: [
        { name: 'id', dataType: 'bigint', nullable: false },
        { name: 'name', dataType: 'text', nullable: false },
      ],
      artifactKey: 'courses-export',
    }],
  }
  const inventoryPath = path.join(directory, 'source-inventory.json')
  const inventoryRaw = `${JSON.stringify(inventory, null, 2)}\n`
  await writeFile(inventoryPath, inventoryRaw, { flag: 'wx' })
  const inventoryHash = hash(Buffer.from(inventoryRaw))

  const manifest = {
    format: 'zhangak.supabase-mapping-manifest/v1',
    status: 'ready',
    inventorySha256: inventoryHash,
    targetSchema: {
      migrations: await targetMigrationLock(),
    },
    mappings: [{
      id: 'courses',
      status: 'ready',
      source: { schema: 'public', table: 'courses', requiredColumns: ['id', 'name'] },
      target: {
        tables: ['courses'],
        fieldMappings: { name: 'name', code: 'lower(code) or null' },
        identityStrategy: 'new-target-id-with-staging-map',
      },
      dependencies: [],
      reviewNote: 'Fixture only: no importer is available.',
    }],
  }
  const manifestPath = path.join(directory, 'mapping-manifest.json')
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' })

  const ledger = {
    format: 'zhangak.supabase-checksum-ledger/v1',
    inventorySha256: inventoryHash,
    sourceSchemaSha256: inventory.capture.schemaSha256,
    artifacts: [{
      key: 'courses-export',
      path: 'exports/public-courses.ndjson',
      format: 'ndjson',
      bytes: artifact.length,
      rowCount: 1,
      sha256: hash(artifact),
    }],
  }
  const ledgerPath = path.join(directory, 'checksum-ledger.json')
  await writeFile(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`, { flag: 'wx' })
  return { inventoryPath, manifestPath, ledgerPath, inventoryRaw }
}

test('migration preflight refuses without explicit --apply before touching artifacts', () => {
  const result = run([])
  assert.equal(result.status, 64)
  assert.match(result.stderr, /without explicit --apply/)
  assert.doesNotMatch(result.stderr, /postgresql:\/\//i)
})

test('migration preflight refuses when one explicit database variable is absent', () => {
  const result = run(['--apply', '--inventory', 'missing.json', '--manifest', 'missing.json', '--ledger', 'missing.json'], {
    SUPABASE_SOURCE_DATABASE_URL: sourceUrl,
  })
  assert.equal(result.status, 64)
  assert.match(result.stderr, /ZHANGAK_TARGET_DATABASE_URL/)
  assert.doesNotMatch(result.stderr, /source_only|migration_source/)
})

test('migration preflight verifies a complete local lock and still has no executor', async () => {
  const capture = await createReadyCapture()
  const before = await readFile(capture.inventoryPath, 'utf8')
  const result = run([
    '--apply',
    '--inventory', capture.inventoryPath,
    '--manifest', capture.manifestPath,
    '--ledger', capture.ledgerPath,
  ], {
    SUPABASE_SOURCE_DATABASE_URL: sourceUrl,
    ZHANGAK_TARGET_DATABASE_URL: targetUrl,
  })
  assert.equal(result.status, 78)
  assert.match(result.stdout, /preflight-complete-executor-unavailable/)
  assert.match(result.stderr, /No database or network connection was opened/)
  assert.doesNotMatch(`${result.stdout}\n${result.stderr}`, /source_only|target_only|migration_source|migration_target/)
  assert.equal(await readFile(capture.inventoryPath, 'utf8'), before)
})

test('migration preflight binds the direct Supabase source host to the captured project', async () => {
  const capture = await createReadyCapture()
  const result = run([
    '--apply',
    '--inventory', capture.inventoryPath,
    '--manifest', capture.manifestPath,
    '--ledger', capture.ledgerPath,
  ], {
    SUPABASE_SOURCE_DATABASE_URL: 'postgresql://migration_source:source_only@db.anotherproject.supabase.co:5432/postgres',
    ZHANGAK_TARGET_DATABASE_URL: targetUrl,
  })
  assert.equal(result.status, 64)
  assert.match(result.stderr, /must use the direct database host/)
  assert.doesNotMatch(result.stderr, /anotherproject|source_only/)
})

test('migration preflight source never imports a database or network client', async () => {
  const source = await readFile(script, 'utf8')
  for (const forbidden of [/from ['"]pg['"]/, /connectDatabase/, /\bfetch\s*\(/, /node:child_process/, /writeFile/]) {
    assert.doesNotMatch(source, forbidden)
  }
})
