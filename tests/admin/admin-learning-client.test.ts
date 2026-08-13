import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createAdminCourse,
  createAdminLesson,
  listAdminCourses,
  listAdminLessons,
  parseAdminCourseList,
  parseAdminLessonList,
  updateAdminCourse,
  updateAdminLesson,
} from '../../lib/admin-learning-client.ts'

const COURSE = {
  id: 4,
  name: 'Подготовка к ОРТ',
  code: 'ort-11',
  level: '11 класс',
  subject: 'Математика',
  description: 'Базовая программа',
  coverImageUrl: null,
  isActive: true,
  lessonCount: 1,
  createdAt: '2026-08-13T08:00:00.000Z',
  updatedAt: '2026-08-13T08:00:00.000Z',
}

const LESSON = {
  id: 9,
  courseId: 4,
  lessonNumber: 1,
  title: 'Квадратные уравнения',
  description: 'Дискриминант и корни',
  subject: 'Математика',
  section: 'Алгебра',
  topic: 'Квадратные уравнения',
  lessonDate: '2026-09-01',
  durationMinutes: 40,
  contentUrl: 'https://example.org/lesson-1',
  isTest: false,
  isPublished: false,
  createdAt: '2026-08-13T08:00:00.000Z',
  updatedAt: '2026-08-13T08:00:00.000Z',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function installBrowserWindow(): () => void {
  const existing = Object.getOwnPropertyDescriptor(globalThis, 'window')
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {} })
  return () => {
    if (existing) Object.defineProperty(globalThis, 'window', existing)
    else delete (globalThis as { window?: unknown }).window
  }
}

test('admin learning parsers accept only course-scoped first-party DTOs', () => {
  assert.deepEqual(parseAdminCourseList({ items: [COURSE], total: 1, limit: 100, offset: 0 }), {
    items: [COURSE], total: 1, limit: 100, offset: 0,
  })
  assert.deepEqual(parseAdminLessonList({ courseId: 4, items: [LESSON], total: 1, limit: 100, offset: 0 }), {
    courseId: 4, items: [LESSON], total: 1, limit: 100, offset: 0,
  })
  assert.throws(
    () => parseAdminLessonList({ courseId: 4, items: [{ ...LESSON, contentUrl: 'javascript:alert(1)' }], total: 1, limit: 100, offset: 0 }),
    /ссылка на материал/,
  )
  assert.throws(
    () => parseAdminLessonList({ courseId: 4, items: [{ ...LESSON, courseId: 5 }], total: 1, limit: 100, offset: 0 }),
    /курс урока не совпадает/,
  )
})

test('admin learning operations stay inside the cookie-authenticated BFF namespace', async () => {
  const restoreWindow = installBrowserWindow()
  const originalFetch = globalThis.fetch
  const calls: { input: string; init?: RequestInit }[] = []
  globalThis.fetch = async (input, init) => {
    const path = String(input)
    calls.push({ input: path, init })
    if (path === '/v1/admin/courses?limit=25') return json({ items: [COURSE], total: 1, limit: 25, offset: 0 })
    if (path === '/v1/admin/courses/4/lessons?limit=50') return json({ courseId: 4, items: [LESSON], total: 1, limit: 50, offset: 0 })
    if (path === '/v1/admin/courses' && init?.method === 'POST') return json({ course: COURSE }, 201)
    if (path === '/v1/admin/courses/4' && init?.method === 'PATCH') return json({ course: COURSE })
    if (path === '/v1/admin/courses/4/lessons' && init?.method === 'POST') return json({ lesson: LESSON }, 201)
    if (path === '/v1/admin/lessons/9' && init?.method === 'PATCH') return json({ lesson: LESSON })
    throw new Error(`Unexpected request ${path}`)
  }

  try {
    await listAdminCourses({ limit: 25 })
    await listAdminLessons(4, { limit: 50 })
    await createAdminCourse({ name: COURSE.name, code: COURSE.code, isActive: true })
    await updateAdminCourse(4, { isActive: false })
    await createAdminLesson(4, { lessonNumber: 1, title: LESSON.title, isPublished: false })
    await updateAdminLesson(9, { isPublished: true })

    assert.deepEqual(calls.map(call => call.input), [
      '/v1/admin/courses?limit=25',
      '/v1/admin/courses/4/lessons?limit=50',
      '/v1/admin/courses',
      '/v1/admin/courses/4',
      '/v1/admin/courses/4/lessons',
      '/v1/admin/lessons/9',
    ])
    assert.deepEqual(calls.map(call => call.init?.method ?? 'GET'), ['GET', 'GET', 'POST', 'PATCH', 'POST', 'PATCH'])
    assert.ok(calls.every(call => call.init?.credentials === 'include'))
    assert.deepEqual(JSON.parse(String(calls[4].init?.body)), { lessonNumber: 1, title: LESSON.title, isPublished: false })
  } finally {
    globalThis.fetch = originalFetch
    restoreWindow()
  }
})
