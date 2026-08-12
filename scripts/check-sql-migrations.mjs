import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(scriptDirectory, '..')
const migrationsDirectory = path.join(projectRoot, 'supabase', 'migrations')
const migrationName = /^\d{8,14}_[a-z0-9_]+\.sql$/
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
  const failures = []

  for (const file of files) {
    if (!migrationName.test(file.name)) {
      failures.push(`${file.name}: expected <UTC timestamp>_<snake_case>.sql`)
    }

    const source = await readFile(path.join(migrationsDirectory, file.name), 'utf8')
    if (!source.trim()) failures.push(`${file.name}: migration is empty`)
    if (source.includes('\0')) failures.push(`${file.name}: contains a NUL byte`)
    for (const marker of proseMarkers) {
      if (marker.test(source)) {
        failures.push(`${file.name}: contains a non-SQL/AI transcript marker (${marker})`)
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
