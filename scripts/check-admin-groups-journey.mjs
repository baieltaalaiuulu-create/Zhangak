import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const failures = []
const read = file => readFile(path.join(root, file), 'utf8')
const expect = (condition, message) => { if (!condition) failures.push(message) }

const files = {
  route: 'backend/src/routes/admin-groups.js',
  server: 'backend/src/server.js',
  client: 'lib/admin-groups-client.ts',
  page: 'app/admin/groups/page.tsx',
  sidebar: 'components/admin/AdminSidebar.tsx',
  students: 'app/admin/students/page.tsx',
}

const contents = Object.fromEntries(await Promise.all(
  Object.entries(files).map(async ([key, file]) => [key, await read(file)]),
))

expect(contents.server.includes("import './routes/admin-groups.js'"), 'group administration routes must be registered in the own API server')
expect(contents.route.includes("GET('/v1/admin/groups'") && contents.route.includes("POST('/v1/admin/groups'"), 'groups must have first-party list and create routes')
expect(contents.route.includes("PATCH('/v1/admin/groups/:groupId'"), 'groups must support bounded own-backend updates')
expect(contents.route.includes("PATCH('/v1/admin/groups/:groupId/teacher'"), 'teacher assignment must be own-backend scoped')
expect(contents.route.includes("POST('/v1/admin/groups/:groupId/students'") && contents.route.includes("DELETE('/v1/admin/groups/:groupId/students/:studentId'"), 'student membership must have explicit first-party assign/remove routes')
expect(contents.route.includes("GET('/v1/admin/group-assignees'"), 'group UI needs a bounded own-backend assignee directory')
expect(contents.route.includes('GROUP_MANAGER_ROLES') && contents.route.includes("['admin', 'super_admin']"), 'group writes must remain limited to senior admins')
expect(contents.route.includes('INSERT INTO audit_log'), 'all group mutations must be audited')
expect(contents.route.includes('group_capacity_reached') && contents.route.includes('student_delivery_mode_conflict'), 'membership must enforce capacity and delivery-mode compatibility')
expect(contents.route.includes('UPDATE group_students SET left_at = now()'), 'student removal must retain membership history rather than deleting it')
expect(!/supabase|\/api\/admin\//i.test(contents.route), 'group API must not use the retired Supabase plane')

expect(contents.client.includes('zhangakApiRequest<unknown>') && contents.client.includes('/v1/admin/groups'), 'group client must use the cookie-authenticated own BFF')
expect(contents.client.includes('parseAdminGroupMemberList') && contents.client.includes('parseAdminGroupAssigneeList'), 'group client must validate member and assignee DTOs before rendering')
expect(!/supabase|authenticatedFetch|\/api\/admin\//i.test(contents.client), 'group client must not invoke legacy API clients')

expect(contents.page.includes('createAdminGroup') && contents.page.includes('updateAdminGroup'), 'mounted groups page must create and update through the own backend')
expect(contents.page.includes('setAdminGroupTeacher') && contents.page.includes('addAdminGroupStudent') && contents.page.includes('removeAdminGroupStudent'), 'mounted groups page must manage teachers and students through the own backend')
expect(contents.page.includes('listAdminCourses'), 'new groups must be tied to real own-backend courses')
expect(contents.page.includes('Тип обучения ученика несовместим') || contents.page.includes('совместимым форматом обучения'), 'UI must make delivery-mode requirements understandable')
expect(!/supabase|admin-data|authenticatedFetch|\/api\/admin\//i.test(contents.page), 'mounted groups page must not read retired admin data')

expect(/href: '\/admin\/groups', label: 'Группы', icon: Users, availability: 'ready'/.test(contents.sidebar), 'sidebar must expose groups as a ready own-backend workspace')
expect(contents.students.includes('Курсы и учебные группы уже работают через собственную базу Zhangak'), 'student account UI must not claim groups are still unmigrated')

const pictograph = /\p{Extended_Pictographic}/u
for (const [key, content] of Object.entries(contents)) {
  if (key === 'route' || key === 'server' || key === 'client') continue
  expect(!pictograph.test(content), `${files[key]} contains an emoji instead of an icon`)
}

if (failures.length > 0) {
  console.error(`Admin groups journey check failed (${failures.length}):`)
  for (const failure of failures) console.error(`- ${failure}`)
  process.exitCode = 1
} else {
  console.log('Admin groups journey check passed (first-party groups, teacher assignment, and retained student memberships).')
}
