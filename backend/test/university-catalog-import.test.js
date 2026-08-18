import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import test from 'node:test'

const exec = promisify(execFile)

test('curated university catalog dry-run is source-backed and starts unpublished', async () => {
  const { stdout } = await exec(process.execPath, ['scripts/import-university-catalog.mjs', '--dry-run'], { cwd: new URL('..', import.meta.url) })
  const result = JSON.parse(stdout)
  assert.deepEqual(result, {
    status: 'dry-run',
    sourceSystem: 'university_catalog_2025_2026',
    universities: 4,
    specialties: 6,
    published: false,
  })
})
