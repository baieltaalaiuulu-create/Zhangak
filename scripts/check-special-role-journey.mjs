import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const failures = []
const read = file => readFile(path.join(root, file), 'utf8')
const expect = (condition, message) => { if (!condition) failures.push(message) }

const pages = [
  ['app/manager/page.tsx', 'manager', 'admin'],
  ['app/director/page.tsx', 'director', 'admin'],
  ['app/finance/page.tsx', 'finance', 'admin'],
  ['app/math/admin/page.tsx', 'math_admin', 'admin'],
  ['app/math/student/page.tsx', 'math_student', 'platform'],
  ['app/math/parent/page.tsx', 'math_parent', 'platform'],
  ['app/admin/jr/page.tsx', 'admin_jr', 'admin'],
]

const [workspace, redirect, ...sources] = await Promise.all([
  read('components/workspaces/RoleMigrationWorkspace.tsx'),
  read('lib/auth-redirect.ts'),
  ...pages.map(([file]) => read(file)),
])

expect(workspace.includes('getCurrentZhangakUser') && workspace.includes('logoutZhangak'), 'special-role workspace must use first-party cookie auth')
expect(!/supabase/i.test(workspace), 'special-role workspace must not initialize Supabase')
expect(workspace.includes('window.location.replace(loginHref)'), 'missing special-role sessions must return to the correct first-party login')
expect(workspace.includes("user.role === expectedRole"), 'special-role workspace must verify the exact first-party role')
expect(workspace.includes('Раздел переносится без старой базы'), 'unmigrated special-role functions must be explicit')

for (const [index, [file, role, surface]] of pages.entries()) {
  const source = sources[index]
  expect(source.includes('RoleMigrationWorkspace'), `${file} must use the shared first-party workspace gate`)
  expect(source.includes(`expectedRole="${role}"`), `${file} must require the ${role} role`)
  expect(source.includes(`surface="${surface}"`), `${file} must use the correct workspace login surface`)
  expect(!/supabase|api\.anthropic\.com|@\/lib\/supabase/i.test(source), `${file} must not retain legacy data or direct AI calls`)
}

for (const role of ['manager', 'director', 'finance', 'math_admin', 'math_student', 'math_parent', 'admin_jr']) {
  expect(redirect.includes(`role === '${role}'`), `first-party role redirect must retain ${role}`)
}

const pictograph = /\p{Extended_Pictographic}/u
for (const [index, [file]] of pages.entries()) expect(!pictograph.test(sources[index]), `${file} contains an emoji instead of an icon`)
expect(!pictograph.test(workspace), 'special-role workspace contains an emoji instead of an icon')

if (failures.length > 0) {
  console.error(`Special-role journey check failed (${failures.length}):`)
  for (const failure of failures) console.error(`- ${failure}`)
  process.exitCode = 1
} else {
  console.log(`Special-role journey check passed (${pages.length} mounted pages, first-party auth, no legacy data calls).`)
}
