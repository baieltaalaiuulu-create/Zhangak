import { readFile, readdir } from 'node:fs/promises'
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

async function collect(directory) {
  const files = []
  for (const entry of await readdir(path.join(root, directory), { withFileTypes: true })) {
    const child = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await collect(child))
    else if (entry.isFile() && /\.(?:ts|tsx)$/.test(entry.name)) files.push(child)
  }
  return files
}

async function main() {
  const route = await source('app/api/offline-student/route.ts')
  expect(route.includes('requireRoleAuth(request, STUDENT_ROLES)'), 'offline API must require the student role')
  expect(route.includes("value === 'offline' || value === 'both'"), 'offline API must allow only offline/both student types')
  expect(!/searchParams|get\(['"]studentId/.test(route), 'offline API must never accept a caller-selected student id')
  expect((route.match(/auth\.user\.id/g) ?? []).length >= 6, 'offline API reads must stay scoped to the bearer user')
  expect(route.includes(".from('group_students')") && route.includes(".eq('student_id', auth.user.id)"), 'group membership must come from the bearer user')
  expect(route.includes(".from('attendance')") && route.includes(".from('test_results')"), 'attendance and grades must be server-read')
  expect(route.includes(".from('practice_results')") && route.includes(".eq('test_type', 'mock')"), 'ORT progress must use a real mock result')
  expect(route.includes("materials: false"), 'unknown material storage must fail closed')
  expect(!/export async function (?:POST|PUT|PATCH|DELETE)/.test(route), 'student offline API must remain read-only')

  const client = await source('lib/offline-student-data.ts')
  expect(client.includes("authenticatedFetch('/api/offline-student'"), 'offline client must use authenticatedFetch')
  expect(!client.includes("from '@/lib/supabase'"), 'offline data client must not query tables directly')

  const page = await source('app/student/page.tsx')
  expect(page.includes('fetchOfflineStudentDashboard()'), '/student must load the real offline dashboard')
  expect(page.includes("requestError.status === 403") && page.includes("router.replace('/student/online')"), 'online-only users must leave the offline cabinet')

  const cabinet = await source('components/offline-student/OfflineStudentCabinet.tsx')
  for (const section of ['home', 'schedule', 'attendance', 'materials', 'practice', 'progress', 'homework']) {
    expect(cabinet.includes(`id: '${section}'`), `offline cabinet is missing ${section}`)
  }
  expect(cabinet.includes('Math.abs(distance) >= 70'), 'mobile swipe must have an intentional threshold')
  expect(cabinet.includes("dashboard.profile.studentType === 'both'"), 'online practice must be limited to both-type students')
  expect(cabinet.includes('Мы не показываем выдуманное расписание'), 'unknown schedule must be explicit')
  expect(!/<(?:form|input|textarea|select)\b/.test(cabinet), 'offline student cabinet must not expose editing forms')

  const redirect = await source('lib/auth-redirect.ts')
  expect(redirect.includes("role === 'student' && studentType === 'online'"), 'online routing must stay explicit')
  expect(redirect.includes("else if (role === 'student') router.replace('/student')"), 'offline/both users must land in /student')

  const proxy = await source('proxy.ts')
  expect(proxy.includes("'/api/offline-student'"), 'offline API must belong to the platform host')

  const scanFiles = [
    ...(await collect('components/offline-student')),
    'app/student/page.tsx',
    'app/api/offline-student/route.ts',
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
  console.log(`Offline student journey check passed (${scanFiles.length} source files, bearer-scoped read-only data, seven mobile sections).`)
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
