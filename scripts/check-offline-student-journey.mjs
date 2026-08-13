import { access, readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const failures = []

async function source(file) {
  return readFile(path.join(root, file), 'utf8')
}

function expect(condition, message) {
  if (!condition) failures.push(message)
}

async function exists(file) {
  try {
    await access(path.join(root, file))
    return true
  } catch {
    return false
  }
}

async function collect(directory) {
  const files = []
  for (const entry of await readdir(path.join(root, directory), { withFileTypes: true })) {
    const child = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await collect(child))
    else if (entry.isFile() && /\.(?:ts|tsx|js)$/.test(entry.name)) files.push(child)
  }
  return files
}

async function main() {
  const route = await source('backend/src/routes/platform-offline.js')
  expect(route.includes("GET('/v1/platform/offline-dashboard'"), 'offline dashboard must be served by the first-party API')
  expect(route.includes('requireOfflineStudent(await requireAuth(config, req))'), 'offline API must require the first-party session and offline student type')
  expect(route.includes("user.role !== 'student'"), 'offline API must limit access to student accounts')
  expect(route.includes("new Set(['offline', 'both'])"), 'offline API must allow only offline/both student types')
  expect(route.includes('WHERE gs.student_id = $1') && route.includes('[student.id]'), 'offline group lookup must stay scoped to the session user')
  expect(route.includes('gs.left_at IS NULL'), 'offline dashboard must exclude historic memberships')
  expect(route.includes("g.delivery_mode IN ('offline', 'hybrid')"), 'offline dashboard must not present an online-only group as offline')
  expect(route.includes('is_published = true'), 'offline dashboard must expose only published lessons')
  expect(route.includes("attendance: 'pending'"), 'offline dashboard must fail closed while attendance has no owned schema')
  expect(route.includes('homework: []') && route.includes('grades: []') && route.includes('latestOrtScore: null'), 'unmigrated offline records must remain explicitly unavailable')
  expect(route.includes('exactSchedule: false') && route.includes('materials: false'), 'unknown schedule and material storage must fail closed')
  expect(!/\b(?:POST|PATCH|DELETE)\s*\('/.test(route), 'offline dashboard must remain read-only')
  for (const forbidden of [/\bFROM attendance\b/i, /\bFROM homework/i, /\bFROM test_results\b/i, /\bFROM practice_results\b/i, /\bcorrect_answer\b/i, /supabase/i]) {
    expect(!forbidden.test(route), `offline first-party route must not use ${forbidden}`)
  }

  const client = await source('lib/offline-student-data.ts')
  expect(client.includes("zhangakApiRequest<unknown>('/v1/platform/offline-dashboard')"), 'offline client must use the first-party BFF')
  expect(client.includes('getCurrentZhangakUser()'), 'offline client must refresh an expired first-party session once')
  expect(client.includes("value !== 'pending'"), 'offline client must reject unowned attendance values')
  expect(client.includes('source.homework.length !== 0 || source.grades.length !== 0'), 'offline client must reject unmigrated homework and grades')
  expect(!/supabase|authenticatedFetch/i.test(client), 'offline data client must not use Supabase or bearer-token helpers')

  const page = await source('app/student/page.tsx')
  expect(page.includes('fetchOfflineStudentDashboard()'), '/student must load the first-party offline dashboard')
  expect(page.includes("requestError.status === 403") && page.includes("router.replace('/student/online')"), 'online-only users must leave the offline cabinet')

  const cabinet = await source('components/offline-student/OfflineStudentCabinet.tsx')
  for (const section of ['home', 'schedule', 'attendance', 'materials', 'practice', 'progress', 'homework']) {
    expect(cabinet.includes(`id: '${section}'`), `offline cabinet is missing ${section}`)
  }
  expect(cabinet.includes('Math.abs(distance) >= 70'), 'mobile swipe must have an intentional threshold')
  expect(cabinet.includes("dashboard.profile.studentType === 'both'"), 'online practice must be limited to both-type students')
  expect(cabinet.includes('Мы не показываем выдуманное расписание'), 'unknown schedule must be explicit')
  expect(cabinet.includes('logoutZhangak'), 'offline logout must use first-party auth')
  expect(!/supabase|practice\/daily/i.test(cabinet), 'offline cabinet must not retain Supabase logout or the retired daily route')
  expect(!/<(?:form|input|textarea|select)\b/.test(cabinet), 'offline student cabinet must not expose editing forms')

  const redirect = await source('lib/auth-redirect.ts')
  expect(redirect.includes("role === 'student' && studentType === 'online'"), 'online routing must stay explicit')
  expect(redirect.includes("else if (role === 'student') router.replace('/student')"), 'offline/both users must land in /student')

  const proxy = await source('proxy.ts')
  expect(proxy.includes("matchesPrefix(pathname, '/v1/platform')"), 'first-party offline API must belong to the platform host')
  expect(!proxy.includes("'/api/offline-student'"), 'retired Supabase offline API must not be routed')
  expect(!await exists('app/api/offline-student/route.ts'), 'retired Supabase offline route must be removed')

  const scanFiles = [
    ...(await collect('components/offline-student')),
    'app/student/page.tsx',
    'backend/src/routes/platform-offline.js',
    'app/offline/page.tsx',
    'lib/offline-student-contract.ts',
    'lib/offline-student-data.ts',
  ]
  const pictograph = /\p{Extended_Pictographic}/u
  for (const file of scanFiles) expect(!pictograph.test(await source(file)), `${file} contains an emoji instead of an icon`)

  if (failures.length > 0) {
    console.error(`Offline student journey check failed (${failures.length}):`)
    for (const failure of failures) console.error(`- ${failure}`)
    process.exitCode = 1
    return
  }
  console.log(`Offline student journey check passed (${scanFiles.length} source files, first-party read-only projection, no legacy offline API).`)
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
