import pg from 'pg'

const { Pool } = pg

let pool

export function connectDatabase(config) {
  if (pool) return pool
  pool = new Pool({
    connectionString: config.databaseUrl,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    application_name: 'zhangak-api',
    ssl: config.databaseSsl ? { rejectUnauthorized: true } : false,
  })
  pool.on('error', error => console.error('PostgreSQL pool error', error))
  return pool
}

export function database() {
  if (!pool) throw new Error('Database is not connected')
  return pool
}

export async function query(text, values = []) {
  return database().query(text, values)
}

export async function transaction(operation) {
  const client = await database().connect()
  try {
    await client.query('BEGIN')
    const result = await operation(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    client.release()
  }
}

export async function closeDatabase() {
  if (!pool) return
  const current = pool
  pool = undefined
  await current.end()
}
