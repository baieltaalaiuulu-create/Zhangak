import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const failures = []
const source = file => readFile(path.join(root, file), 'utf8')
const expect = (condition, message) => { if (!condition) failures.push(message) }

const files = {
  route: 'backend/src/routes/admin-learning.js',
  server: 'backend/src/server.js',
  client: 'lib/admin-learning-client.ts',
  list: 'app/admin/lessons/page.tsx',
  create: 'app/admin/lessons/new/page.tsx',
  courseModal: 'components/admin/lessons/CourseCreateModal.tsx',
  courseEditModal: 'components/admin/lessons/CourseEditModal.tsx',
  editModal: 'components/admin/lessons/LessonEditModal.tsx',
  questions: 'app/admin/lessons/[id]/questions/page.tsx',
  roadmap: 'app/admin/roadmap/page.tsx',
}

const contents = Object.fromEntries(await Promise.all(
  Object.entries(files).map(async ([key, file]) => [key, await source(file)]),
))

expect(contents.route.includes("GET('/v1/admin/courses'"), 'admin courses must list from the first-party API')
expect(contents.route.includes("POST('/v1/admin/courses'"), 'admin courses must be creatable through the first-party API')
expect(contents.route.includes("GET('/v1/admin/courses/:courseId/lessons'"), 'admin lessons must be scoped to a course')
expect(contents.route.includes("POST('/v1/admin/courses/:courseId/lessons'"), 'admin lessons must be created through the first-party API')
expect(contents.route.includes("PATCH('/v1/admin/lessons/:lessonId'"), 'admin lessons must be updated through the first-party API')
expect(contents.route.includes("GET('/v1/admin/courses/:courseId/roadmap'"), 'course roadmap must load through the first-party API')
expect(contents.route.includes("POST('/v1/admin/courses/:courseId/roadmap/units'"), 'roadmap units must be created through the first-party API')
expect(contents.route.includes("POST('/v1/admin/roadmap/units/:unitId/lessons'"), 'roadmap lesson placements must use the first-party API')
expect(contents.route.includes('CONTENT_MANAGER_ROLES'), 'curriculum changes must remain role-gated')
expect(contents.server.includes("import './routes/admin-learning.js'"), 'admin learning routes must be registered')

expect(contents.client.includes('zhangakApiRequest<unknown>') && contents.client.includes('/v1/admin/courses'), 'course reads must use the cookie-authenticated first-party BFF')
expect(contents.client.includes("/v1/admin/courses/${coursePath(courseId)}/lessons"), 'lesson reads and writes must stay course-scoped')
expect(contents.client.includes("/v1/admin/lessons/${lessonPath(lessonId)}"), 'lesson updates must use the first-party BFF')
expect(contents.client.includes('parseAdminLessonList') && contents.client.includes('lesson.courseId !== courseId'), 'client parser must enforce a course-scoped lesson list')

for (const [key, content] of Object.entries(contents)) {
  if (['route', 'server'].includes(key)) continue
  expect(!/supabase|admin-data|lessons-data|authenticated-fetch|\/api\/admin\//i.test(content), `${files[key]} must not depend on legacy Supabase admin code`)
}

expect(contents.list.includes('listAdminCourses') && contents.list.includes('listAdminLessons'), 'mounted lessons list must load own courses and lessons')
expect(contents.list.includes('CourseCreateModal') && contents.list.includes('CourseEditModal') && contents.list.includes('LessonEditModal'), 'mounted lessons list must support first-party course creation, course editing and lesson editing')
expect(!/deleteLesson|Trash2|DeleteConfirmModal|questionCount/i.test(contents.list), 'mounted lessons list must not claim unsupported deletion or question counts')
expect(contents.create.includes('createAdminLesson') && contents.create.includes('CourseCreateModal'), 'new lesson page must create course-scoped lessons without legacy data clients')
expect(contents.editModal.includes('updateAdminLesson') && contents.editModal.includes('isPublished'), 'lesson editor must update publication state through the first-party API')
expect(contents.courseEditModal.includes('updateAdminCourse') && contents.courseEditModal.includes('isActive'), 'course editor must update archival state through the first-party API')
// The lesson question entry point is a working editor now, not a migration
// notice. What matters is that it mounts the one shared workspace scoped to
// this lesson, so the answer-key boundary, the archive guard and the audit
// trail cannot drift between two implementations.
expect(contents.questions.includes('AdminAssessmentWorkspace'), 'lesson question editor must mount the shared assessment workspace')
expect(/lessonId=\{lessonId\}/.test(contents.questions), 'lesson question editor must open already scoped to its lesson')
expect(!contents.questions.includes('Редактор заданий переносится'), 'the migration notice must not outlive the working editor')
expect(!/QuestionImageUploader|fetchQuestionsForTest|ensurePracticeTestForLesson|correct_answer/i.test(contents.questions), 'lesson question editor must not invoke the legacy answer-key editor')

// The workspace itself is the security boundary the entry point relies on.
const questionWorkspace = await source('components/admin/AdminAssessmentWorkspace.tsx')
expect(questionWorkspace.includes('listAdminPracticeQuestions'), 'the workspace must read questions through the first-party client')
expect(questionWorkspace.includes('archiveAdminPracticeQuestion') && questionWorkspace.includes('restoreAdminPracticeQuestion'), 'deletion must be a reversible archive, with an explicit restore')
expect(!/fetch\s*\(|supabase|\/api\/admin\//i.test(questionWorkspace), 'the workspace must not bypass the first-party client')
expect(questionWorkspace.includes('QUESTION_PAGE_SIZE'), 'the question bank must be paged rather than loaded whole')
expect(/status: 'active'|status: 'archived'|AdminQuestionStatusFilter/.test(questionWorkspace), 'the catalogue must offer an active/archived filter')
expect(contents.roadmap.includes('getAdminCourseRoadmap') && contents.roadmap.includes('createAdminRoadmapUnit'), 'mounted roadmap editor must use the own-backend roadmap client')
expect(contents.roadmap.includes('placeAdminRoadmapLesson') && contents.roadmap.includes('removeAdminRoadmapLesson'), 'roadmap editor must safely place and remove lessons')

const pictograph = /\p{Extended_Pictographic}/u
for (const [key, content] of Object.entries(contents)) {
  if (key === 'route' || key === 'server' || key === 'client') continue
  expect(!pictograph.test(content), `${files[key]} contains an emoji instead of an icon`)
}

if (failures.length > 0) {
  console.error(`Admin learning journey check failed (${failures.length}):`)
  for (const failure of failures) console.error(`- ${failure}`)
  process.exitCode = 1
} else {
  console.log('Admin learning journey check passed (first-party courses, lessons and the shared lesson-scoped question editor).')
}
