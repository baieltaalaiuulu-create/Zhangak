import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const failures = []
const source = file => readFile(path.join(root, file), 'utf8')
const expect = (condition, message) => { if (!condition) failures.push(message) }

const files = {
  route: 'backend/src/routes/admin-dashboard.js',
  server: 'backend/src/server.js',
  client: 'lib/admin-dashboard-client.ts',
  page: 'app/admin/page.tsx',
}
const contents = Object.fromEntries(await Promise.all(
  Object.entries(files).map(async ([key, file]) => [key, await source(file)]),
))

expect(contents.route.includes("GET('/v1/admin/dashboard'"), 'admin overview must use a first-party GET route')
expect(contents.route.includes('requireDashboardAdmin(await requireAuth(config, req))'), 'admin overview must require the own authenticated admin session')
expect(contents.route.includes("FULL_ADMIN_ROLES = ['admin', 'super_admin']"), 'admin overview must be limited to admin and super_admin')
expect(contents.server.includes("import './routes/admin-dashboard.js'"), 'admin overview route must be registered')
for (const table of ['users', 'profiles', 'lessons', 'practice_attempts', 'audit_log']) {
  expect(new RegExp(`\\b${table}\\b`).test(contents.route), `admin overview must query owned ${table} data`)
}
expect(contents.route.includes('dailyActiveStudents: false') && contents.route.includes('payments: false'), 'unmigrated metrics must remain explicitly unavailable')
for (const forbidden of [/supabase/i, /correct_answer/i, /\bPOST\('/, /\bPATCH\('/, /\bDELETE\('/]) {
  expect(!forbidden.test(contents.route), `admin overview route must not contain ${forbidden}`)
}

expect(contents.client.includes("zhangakApiRequest<unknown>('/v1/admin/dashboard')"), 'admin browser client must use the cookie-authenticated BFF')
expect(contents.client.includes('parseAdminDashboard'), 'admin browser client must validate the response before rendering')
expect(contents.client.includes('dailyActiveStudents !== false') && contents.client.includes('payments !== false'), 'client parser must reject fabricated availability flags')
expect(!/supabase|admin-data|authenticated-fetch|\/api\/admin\//i.test(contents.client), 'admin dashboard client must not use retired admin data paths')

expect(contents.page.includes('getAdminDashboard') && contents.page.includes('AdminTopbar'), 'mounted overview must load the first-party dashboard and preserve navigation')
expect(contents.page.includes('dashboard.availability.dailyActiveStudents'), 'mounted overview must communicate unavailable metrics')
expect(!/supabase|admin-data|fetchDashboardStats|fetchRecentActivity|authenticated-fetch|\/api\/admin\//i.test(contents.page), 'mounted overview must not use legacy admin data')
expect(!/activeToday|activeYesterday|total_score/i.test(contents.page), 'mounted overview must not claim legacy-only activity or score fields')
expect(!/\p{Extended_Pictographic}/u.test(contents.page), 'mounted overview must use icons rather than emoji')

if (failures.length > 0) {
  console.error(`Admin dashboard journey check failed (${failures.length}):`)
  for (const failure of failures) console.error(`- ${failure}`)
  process.exitCode = 1
} else {
  console.log('Admin dashboard journey check passed (owned metrics, safe activity feed, explicit unavailable domains).')
}
