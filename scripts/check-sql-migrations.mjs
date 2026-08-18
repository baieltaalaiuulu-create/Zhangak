import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(scriptDirectory, '..')
// The executable source of truth is the first-party backend migrator. Old
// Supabase SQL is deliberately quarantined and must never make this check pass.
const migrationsDirectory = path.join(projectRoot, 'backend', 'migrations')
const migrationName = /^(\d+)_[a-z0-9_-]+\.sql$/i
const proseMarkers = [
  /^===/m,
  /^#/m,
  /^\[FILE:/m,
  /\bAI CTO\b/i,
  /\bFrontend Developer\b/i,
  /```/,
]

async function main() {
  const entries = await readdir(migrationsDirectory, { withFileTypes: true })
  const files = entries.filter(entry => entry.isFile() && entry.name.endsWith('.sql'))
    .map(entry => entry.name)
    .sort()
  const failures = []
  const seenVersions = new Set()

  if (files.length === 0) {
    failures.push('no executable backend migrations found')
  }

  for (const file of files) {
    const match = migrationName.exec(file)
    if (!match) {
      failures.push(`${file}: expected <numeric_version>_<snake_case>.sql`)
      continue
    }
    if (seenVersions.has(match[1])) {
      failures.push(`${file}: duplicate migration version ${match[1]}`)
    }
    seenVersions.add(match[1])

    const source = await readFile(path.join(migrationsDirectory, file), 'utf8')
    if (!source.trim()) failures.push(`${file}: migration is empty`)
    if (source.includes('\0')) failures.push(`${file}: contains a NUL byte`)
    for (const marker of proseMarkers) {
      if (marker.test(source)) {
        failures.push(`${file}: contains a non-SQL/AI transcript marker (${marker})`)
      }
    }
  }

  if (failures.length > 0) {
    console.error(`SQL migration check failed (${failures.length}):`)
    for (const failure of failures) console.error(`- ${failure}`)
    console.error('Quarantine untrusted files; never repair a corrupted migration in place.')
    process.exitCode = 1
    return
  }

  console.log(`SQL migration check passed (${files.length} executable migrations).`)
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
