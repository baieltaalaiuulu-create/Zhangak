import { query } from '../db.js'
import { GET } from '../http.js'

GET('/v1/health', ({ config }) => ({
  status: 200,
  body: { status: 'ok', releaseSha: config.releaseSha },
}))

GET('/v1/ready', async ({ config }) => {
  const result = await query('SELECT max(version) version FROM schema_migrations')
  return {
    status: 200,
    body: {
      status: 'ready',
      releaseSha: config.releaseSha,
      migration: result.rows[0]?.version ?? null,
    },
  }
})
