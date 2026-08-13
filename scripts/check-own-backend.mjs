import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const failures = []
const read = file => readFile(path.join(root, file), 'utf8')
const expect = (condition, message) => { if (!condition) failures.push(message) }

async function walk(directory) {
  const files = []
  for (const entry of await readdir(path.join(root, directory), { withFileTypes: true })) {
    const child = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await walk(child))
    else files.push(child.replaceAll('\\', '/'))
  }
  return files
}

const files = (await walk('backend')).filter(file =>
  /\.(?:js|sql|json)$/.test(file)
  && !file.includes('/node_modules/')
  && !file.includes('/dist/'),
)
const combined = (await Promise.all(files.map(read))).join('\n')
expect(!/@supabase|supabase-js|supabase\.co/i.test(combined), 'first-party backend must not depend on Supabase')
expect(!/admin123|student123/.test(combined), 'backend must not contain default account credentials')

const config = await read('backend/src/config.js')
expect(config.includes("host: process.env.HOST?.trim() || '127.0.0.1'"), 'API must bind to localhost by default')
expect(config.includes('JWT_SECRET must be at least'), 'JWT secret length must fail closed')
expect(config.includes('Production origins must use HTTPS'), 'production origins must require HTTPS')

const migration = await read('backend/scripts/migrate.js')
expect(migration.includes('pg_advisory_xact_lock'), 'migrations must be serialized')
expect(migration.includes('Applied migration changed'), 'changed applied migrations must be rejected')

const auth = await read('backend/src/auth.js')
expect(auth.includes('user.session_version !== claims.sv'), 'protected requests must enforce current session version')
expect(auth.includes('s.revoked_at IS NULL') && auth.includes('s.expires_at > now()'), 'protected requests must check live session state')
expect(auth.includes('if (req.headers.origin) return {}'), 'browser responses must not expose session tokens to JavaScript')

const authRoutes = await read('backend/src/routes/auth.js')
expect(authRoutes.includes('LOGIN_MAX_FAILURES'), 'login must be rate limited')
expect(authRoutes.includes("POST('/v1/auth/refresh'"), 'refresh rotation endpoint is required')
expect(authRoutes.includes("GET('/v1/auth/me'"), 'current-account endpoint is required')

const server = await read('backend/src/server.js')
expect(server.includes("import './routes/health.js'"), 'health routes must be registered')
expect(server.includes("import './routes/admin-users.js'"), 'first-party account administration routes must be registered')
expect(server.includes('server.requestTimeout = 30_000'), 'HTTP request timeout must be bounded')
expect(server.includes("process.on('SIGTERM'"), 'API must shut down gracefully')

const bootstrap = await read('backend/scripts/create-super-admin.js')
expect(bootstrap.includes('[userId, userId]'), 'bootstrap audit parameters must keep uuid and text inference separate')

const adminUsers = await read('backend/src/routes/admin-users.js')
expect(adminUsers.includes('ACCOUNT_CREATOR_ROLES') && adminUsers.includes('ACCOUNT_MANAGER_ROLES'), 'account routes must separate create and manage roles')
expect(adminUsers.includes('session_version = session_version + 1'), 'account security changes must revoke access tokens')
expect(adminUsers.includes("await audit(client, currentActor, 'delete_user'"), 'privileged account deletion must be audited')

if (failures.length > 0) {
  console.error(`Own backend check failed (${failures.length}):`)
  for (const failure of failures) console.error(`- ${failure}`)
  process.exitCode = 1
} else {
  console.log(`Own backend check passed (${files.length} backend files, PostgreSQL, rotating auth, no Supabase).`)
}
