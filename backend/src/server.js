import { createServer } from 'node:http'

import { loadConfig } from './config.js'
import { closeDatabase, connectDatabase, query } from './db.js'
import { createHandler } from './http.js'

import './routes/health.js'
import './routes/auth.js'
import './routes/admin-users.js'
import './routes/admin-learning.js'
import './routes/admin-groups.js'
import './routes/admin-assessments.js'
import './routes/admin-dashboard.js'
import './routes/platform-learning.js'
import './routes/platform-teacher.js'
import './routes/platform-offline.js'
import './routes/platform-universities.js'
import './routes/platform-profile.js'

const config = loadConfig()
connectDatabase(config)
await query('SELECT 1')

const server = createServer(createHandler(config))
server.requestTimeout = 30_000
server.headersTimeout = 15_000
server.keepAliveTimeout = 5_000
server.maxRequestsPerSocket = 1_000

server.listen(config.port, config.host, () => {
  console.log(JSON.stringify({ event: 'api_started', host: config.host, port: config.port, releaseSha: config.releaseSha }))
})

let stopping = false
async function shutdown(signal) {
  if (stopping) return
  stopping = true
  console.log(JSON.stringify({ event: 'api_stopping', signal }))
  const forced = setTimeout(() => process.exit(1), 15_000)
  forced.unref()
  server.close(async error => {
    await closeDatabase().catch(dbError => console.error('Database shutdown failed', dbError))
    if (error) console.error('HTTP shutdown failed', error)
    clearTimeout(forced)
    process.exit(error ? 1 : 0)
  })
  server.closeIdleConnections()
}

process.on('SIGTERM', () => void shutdown('SIGTERM'))
process.on('SIGINT', () => void shutdown('SIGINT'))
process.on('uncaughtException', error => {
  console.error('Uncaught exception', error)
  void shutdown('uncaughtException')
})
process.on('unhandledRejection', error => {
  console.error('Unhandled rejection', error)
  void shutdown('unhandledRejection')
})
