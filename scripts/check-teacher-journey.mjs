import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const failures = []

async function source(file) { return readFile(path.join(root, file), 'utf8') }
function expect(condition, message) { if (!condition) failures.push(message) }

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
  const [route, classroomRoute, server, page, workspace, client, classroomClient, proxy] = await Promise.all([
    source('backend/src/routes/platform-teacher.js'),
    source('backend/src/routes/platform-offline-classroom.js'),
    source('backend/src/server.js'),
    source('app/teacher/page.tsx'),
    source('components/teacher/TeacherWorkspace.tsx'),
    source('lib/platform-teacher.ts'),
    source('lib/offline-classroom.ts'),
    source('proxy.ts'),
  ])

  expect(route.includes("GET('/v1/platform/teacher-dashboard'"), 'teacher dashboard must live on the first-party platform API')
  expect(route.includes('requireTeacher(await requireAuth(config, req))'), 'teacher dashboard must require the first-party teacher session')
  expect(route.includes('WHERE g.teacher_id = $1 AND g.is_active = true'), 'teacher groups must be scoped to the signed-in teacher and active only')
  expect(route.includes('JOIN courses c ON c.id = g.course_id AND c.is_active = true'), 'teacher dashboard must exclude archived courses')
  expect(route.includes('active_student_count') && route.includes('published_lesson_count'), 'teacher dashboard must expose only authoritative counts')
  expect(route.includes("member_profile.role IN ('student', 'math_student')"), 'teacher student count must exclude non-student accounts')
  for (const forbidden of [/\bFROM attendance\b/i, /\bFROM homeworks?\b/i, /\bFROM practice_attempts?\b/i, /\bcorrect_answer\b/i]) {
    expect(!forbidden.test(route), `teacher dashboard must not project ${forbidden}`)
  }
  expect(server.includes("import './routes/platform-teacher.js'"), 'teacher dashboard route must be registered')

  expect(page.includes('getPlatformTeacherDashboard') && page.includes('TeacherWorkspace'), 'teacher page must load the first-party dashboard')
  expect(page.includes("'/login'"), 'expired teacher sessions must offer the first-party login')
  expect(!/teacher-data|teacher-contract|\/api\/teacher|supabase/i.test(page), 'mounted teacher page must not depend on the retired teacher API or Supabase')
  expect(workspace.includes('activeStudentCount') && workspace.includes('publishedLessonCount'), 'teacher UI must render server-authoritative counts')
  expect(workspace.includes('OfflineTeacherJournal'), 'teacher UI must expose the owned offline classroom journal')
  expect(!/teacher-data|teacher-contract|saveTeacher|createTeacherHomework|supabase/i.test(workspace), 'mounted teacher workspace must not call legacy teacher or Supabase code')
  expect(client.includes("zhangakApiRequest<unknown>('/v1/platform/teacher-dashboard')"), 'teacher browser client must use the same-origin first-party BFF')
  expect(classroomClient.includes("/v1/platform/offline/teacher/groups/${groupId}") && classroomClient.includes('zhangakApiJson'), 'teacher journal client must use the first-party offline BFF only')
  expect(classroomRoute.includes("GET('/v1/platform/offline/teacher/groups/:groupId'"), 'teacher classroom projection must live on the offline API')
  expect(classroomRoute.includes("actor.role === 'teacher' && group.teacher_id !== actor.id"), 'teacher classroom access must stay group-owner scoped')
  expect(classroomRoute.includes("POST('/v1/platform/offline/groups/:groupId/sessions'"), 'teacher classroom must audit first-party session writes')
  expect(proxy.includes("pathname === '/v1/platform/teacher-dashboard'"), 'teacher BFF must remain on the offline host')

  const scanFiles = [
    ...(await collect('components/teacher')),
    'app/teacher/page.tsx',
    'lib/platform-teacher.ts',
  ]
  const pictograph = /\p{Extended_Pictographic}/u
  for (const file of scanFiles) expect(!pictograph.test(await source(file)), `${file} contains an emoji instead of an icon`)

  if (failures.length > 0) {
    console.error(`Teacher journey check failed (${failures.length}):`)
    for (const failure of failures) console.error(`- ${failure}`)
    process.exitCode = 1
    return
  }
  console.log(`Teacher journey check passed (${scanFiles.length} mounted files, first-party session and offline classroom journal).`)
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
