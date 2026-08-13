import { createHash } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadConfig } from '../src/config.js'
import { closeDatabase, connectDatabase, transaction } from '../src/db.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const config = loadConfig()
connectDatabase(config)

try {
  await transaction(async client => {
    await client.query('SELECT pg_advisory_xact_lock($1)', [1_641_991_337])
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version text PRIMARY KEY,
        checksum text NOT NULL,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `)

    const files = (await readdir(path.join(root, 'migrations')))
      .filter(name => /^\d+_[a-z0-9_-]+\.sql$/i.test(name))
      .sort()

    for (const file of files) {
      const sql = await readFile(path.join(root, 'migrations', file), 'utf8')
      const checksum = createHash('sha256').update(sql).digest('hex')
      const existing = await client.query('SELECT checksum FROM schema_migrations WHERE version = $1', [file])
      if (existing.rowCount > 0) {
        if (existing.rows[0].checksum !== checksum) throw new Error(`Applied migration changed: ${file}`)
        continue
      }
      await client.query(sql)
      await client.query('INSERT INTO schema_migrations (version, checksum) VALUES ($1, $2)', [file, checksum])
      console.log(`Applied ${file}`)
    }
  })
} finally {
  await closeDatabase()
}
