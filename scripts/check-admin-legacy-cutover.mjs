import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const failures = []
const read = file => readFile(path.join(root, file), 'utf8')
const expect = (condition, message) => { if (!condition) failures.push(message) }
const pictograph = /\p{Extended_Pictographic}/u

const migrationPages = [
  'app/admin/mock/[id]/questions/page.tsx',
  'app/admin/daily-challenge/[id]/page.tsx',
  'app/admin/prizes/page.tsx',
  'app/admin/knowledge-base/page.tsx',
  'app/admin/universities/page.tsx',
  'app/admin/universities/[id]/specialties/page.tsx',
  'app/admin/archive/page.tsx',
  'app/admin/archive/[id]/page.tsx',
  'app/admin/analytics/page.tsx',
  'app/admin/announcements/page.tsx',
]

const assessmentPages = [
  'app/admin/practice/page.tsx',
  'app/admin/questions/page.tsx',
  'app/admin/mock/page.tsx',
]

const [notice, sidebar, workspace, client, ...pages] = await Promise.all([
  read('components/admin/AdminMigrationNotice.tsx'),
  read('components/admin/AdminSidebar.tsx'),
  read('components/admin/AdminAssessmentWorkspace.tsx'),
  read('lib/admin-assessments-client.ts'),
  ...migrationPages.map(read),
])

expect(notice.includes('getCurrentZhangakUser'), 'migration notice must check the first-party session itself')
expect(notice.includes("new Set(['admin', 'super_admin'])"), 'migration notice must allow only full administrator roles')
expect(notice.includes("window.location.replace('/login')"), 'missing session must return to the first-party login')
expect(notice.includes('Старая база для этого раздела отключена'), 'migration notice must make the safe unavailable state explicit')
expect(!/supabase|authenticatedFetch|\/api\/admin\//i.test(notice), 'migration notice must not call the retired admin data path')

expect(sidebar.includes("availability: 'migration'"), 'sidebar must classify remaining migrated sections explicitly')
expect(sidebar.includes('Перенос на наш backend'), 'sidebar must present migrated sections as a roadmap group')
expect(sidebar.includes('Скоро'), 'sidebar must label migrated links as unavailable workspaces')
expect(sidebar.includes('aria-label={isMigrating'), 'sidebar must expose migration status to assistive technology')
for (const route of ['/admin/practice', '/admin/questions', '/admin/mock']) {
  expect(new RegExp(`href: '${route.replaceAll('/', '\\/')}'.*availability: 'ready'`).test(sidebar), `${route} must be shown as a working own-backend section`)
}
expect(/href: '\/admin\/daily-challenge'.*availability: 'ready'/.test(sidebar), '/admin/daily-challenge must be shown as a working own-backend section')

for (const file of assessmentPages) {
  const page = await read(file)
  expect(page.includes('AdminAssessmentWorkspace'), `${file} must mount the first-party assessment workspace`)
  expect(!/supabase|admin-data|authenticatedFetch|\/api\/admin\//i.test(page), `${file} must not depend on legacy admin data`)
}
expect(workspace.includes('listAdminCoursePracticeTests') && workspace.includes('listAdminLessonPracticeTests'), 'assessment workspace must select course- and lesson-scoped first-party tests')
expect(workspace.includes('createAdminPracticeQuestion') && workspace.includes('updateAdminPracticeQuestion'), 'assessment workspace must create and edit questions through the own backend')
expect(workspace.includes('ключ ответа виден только администраторам'), 'assessment workspace must make the admin-only key boundary explicit')
expect(!/supabase|admin-data|authenticatedFetch|\/api\/admin\//i.test(workspace), 'assessment workspace must not invoke retired admin data paths')
expect(client.includes("/v1/admin/practice-tests/") && client.includes('correctAnswer'), 'admin assessment client must use the own admin-only answer-key projection')
expect(!/supabase|authenticatedFetch|\/api\/admin\//i.test(client), 'admin assessment client must stay on the cookie-authenticated BFF')

const daily = await read('app/admin/daily-challenge/page.tsx')
expect(daily.includes('createAdminDailyChallenge') && daily.includes('publishAdminDailyChallenge'), 'daily challenge editor must create drafts and publish only through the own backend')
expect(daily.includes('listAdminPracticeQuestions') && daily.includes('chosen.length !== 15'), 'daily challenge editor must select exactly fifteen first-party questions')
expect(!/supabase|authenticatedFetch|\/api\/admin\//i.test(daily), 'daily challenge editor must not invoke retired admin data paths')
expect(!pictograph.test(daily), 'daily challenge editor contains an emoji instead of an icon')

for (const [index, page] of pages.entries()) {
  const file = migrationPages[index]
  expect(page.includes('AdminMigrationNotice'), `${file} must mount the shared first-party migration notice`)
  expect(!/supabase|authenticatedFetch|\/api\/admin\/|\bfetch\s*\(/i.test(page), `${file} must not read or mutate retired admin data`)
  expect(!pictograph.test(page), `${file} contains an emoji instead of an icon`)
}
expect(!pictograph.test(notice), 'AdminMigrationNotice contains an emoji instead of an icon')
expect(!pictograph.test(workspace), 'AdminAssessmentWorkspace contains an emoji instead of an icon')

if (failures.length > 0) {
  console.error(`Admin legacy cutover check failed (${failures.length}):`)
  for (const failure of failures) console.error(`- ${failure}`)
  process.exitCode = 1
} else {
  console.log(`Admin legacy cutover check passed (${migrationPages.length} mounted routes safely use first-party role-aware migration notices).`)
}
