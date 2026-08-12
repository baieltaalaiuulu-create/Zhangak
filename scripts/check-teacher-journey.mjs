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
  const route = await source('app/api/teacher/route.ts')
  expect((route.match(/requireRoleAuth\(request, TEACHER_ROLES\)/g) ?? []).length === 3, 'every teacher handler must require the teacher role')
  expect(route.includes(".eq('teacher_id', teacherId)"), 'group ownership must be checked against the bearer teacher')
  expect(route.includes(".eq('course_id', courseId)"), 'lesson ownership must be checked against the owned group course')
  expect(route.includes(".from('group_students').select('student_id')"), 'write targets must be checked against group membership')
  expect(route.includes("membership.ids.has(entry.studentId)"), 'attendance and grade entries must reject students outside the group')
  expect(route.includes('readJsonObject(request, 64_000)') && route.includes('readJsonObject(request)'), 'teacher writes need bounded body parsing')
  expect(!route.includes('request.json()'), 'teacher API must not parse unbounded JSON')
  expect(route.includes(".upsert(rows, { onConflict: 'lesson_id,student_id' })"), 'attendance and grades must use one batch upsert')
  expect(route.includes('total_score: gradeTotal(entry.scores)'), 'grade totals must be server-derived')
  expect(route.includes("lessonOwnership.lesson.is_test !== true"), 'grades must be limited to control lessons')
  expect(!/error\?\.message|error instanceof Error|String\(error\)/.test(route), 'teacher API must not leak provider or database error messages')
  expect(!/searchParams\.get\(['"]teacherId/.test(route), 'teacher identity must never come from query parameters')

  const data = await source('lib/teacher-data.ts')
  expect(data.includes('authenticatedFetch(url'), 'teacher client writes must use authenticatedFetch')
  expect(data.includes("request<{ success: true }>('/api/teacher'"), 'teacher mutations must go through the protected teacher endpoint')
  expect(!data.includes("from '@/lib/supabase'"), 'teacher data client must not query Supabase tables directly')

  const page = await source('app/teacher/page.tsx')
  expect(page.includes('fetchTeacherGroups()') && page.includes('fetchTeacherWorkspace'), 'teacher page must load the protected workspace')
  expect(!page.includes('supabase.from'), 'teacher page must not read tables directly')

  const workspace = await source('components/teacher/TeacherWorkspace.tsx')
  for (const tab of ['lessons', 'attendance', 'grades', 'homework']) expect(workspace.includes(`id: '${tab}'`), `teacher workspace is missing ${tab}`)
  expect(workspace.includes('Отметить всех: был'), 'attendance needs a one-tap mark-all action')
  expect(workspace.includes('min-h-11') && workspace.includes('min-h-12'), 'teacher touch controls must remain at least 44px')
  expect(workspace.includes('будет видно всем группам этого курса'), 'course-scoped homework limitation must be visible')
  expect(!/\bany\b/.test(workspace), 'teacher workspace must stay typed without any')

  const proxy = await source('proxy.ts')
  expect(proxy.includes("'/api/teacher'"), 'teacher API must belong to the admin host')

  const scanFiles = [
    ...(await collect('components/teacher')),
    'app/teacher/page.tsx',
    'app/api/teacher/route.ts',
    'lib/teacher-contract.ts',
    'lib/teacher-data.ts',
  ]
  const pictograph = /\p{Extended_Pictographic}/u
  for (const file of scanFiles) expect(!pictograph.test(await source(file)), `${file} contains an emoji instead of an icon`)

  if (failures.length > 0) {
    console.error(`Teacher journey check failed (${failures.length}):`)
    for (const failure of failures) console.error(`- ${failure}`)
    process.exitCode = 1
    return
  }
  console.log(`Teacher journey check passed (${scanFiles.length} source files, owned groups, batch writes, mobile controls).`)
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
