import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  parseCourseCreateBody,
  parseCoursePatchBody,
  parseLessonCreateBody,
  parseLessonPatchBody,
  parseMaterialTextBody,
  parseRoadmapPlacementBody,
  parseRoadmapUnitCreateBody,
  parseRoadmapUnitPatchBody,
} from '../src/routes/admin-learning.js'
import { HttpError } from '../src/http.js'

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function invalid(parser, body, code) {
  assert.throws(
    () => parser(body),
    error => error instanceof HttpError && error.status === 400 && error.code === code,
  )
}

test('course administration accepts a bounded, normalized content shape', () => {
  assert.deepEqual(parseCourseCreateBody({
    name: '  Подготовка к ОРТ  ',
    code: ' ORT_2026 ',
    level: '11 класс',
    subject: 'Математика',
    description: 'Базовый курс.',
    coverImageUrl: 'https://cdn.zhangak.com/courses/ort.webp',
    deliveryMode: 'offline',
    isActive: false,
  }), {
    name: 'Подготовка к ОРТ',
    code: 'ort_2026',
    level: '11 класс',
    subject: 'Математика',
    description: 'Базовый курс.',
    coverImageUrl: 'https://cdn.zhangak.com/courses/ort.webp',
    deliveryMode: 'offline',
    isActive: false,
  })
  assert.deepEqual(parseCoursePatchBody({ code: null, deliveryMode: 'online', isActive: true }), { code: null, deliveryMode: 'online', isActive: true })
})

test('course administration fails closed for injected ownership and unsafe links', () => {
  invalid(parseCourseCreateBody, { name: 'Курс', createdBy: 'forged' }, 'invalid_course')
  invalid(parseCourseCreateBody, { name: 'Курс', code: 'bad code' }, 'invalid_course_code')
  invalid(parseCourseCreateBody, { name: 'Курс', coverImageUrl: 'javascript:alert(1)' }, 'invalid_course_cover_image_url')
  invalid(parseCourseCreateBody, { name: 'Курс', deliveryMode: 'hybrid' }, 'invalid_course_delivery_mode')
  invalid(parseCoursePatchBody, {}, 'invalid_course_patch')
  invalid(parseCoursePatchBody, { groupId: 2 }, 'invalid_course')
  invalid(parseCoursePatchBody, { isActive: 'true' }, 'invalid_course_active')
})

test('lesson administration accepts only curriculum fields and can explicitly clear optional data', () => {
  assert.deepEqual(parseLessonCreateBody({
    lessonNumber: 4,
    title: '  Линейные уравнения ',
    section: 'algebra',
    lessonDate: '2026-09-01',
    durationMinutes: 45,
    contentUrl: 'https://video.zhangak.com/lessons/4',
    isTest: true,
    isPublished: false,
  }), {
    lessonNumber: 4,
    title: 'Линейные уравнения',
    description: null,
    subject: null,
    section: 'algebra',
    topic: null,
    lessonDate: '2026-09-01',
    durationMinutes: 45,
    contentUrl: 'https://video.zhangak.com/lessons/4',
    isTest: true,
    isPublished: false,
  })
  assert.deepEqual(parseLessonPatchBody({ contentUrl: null, lessonDate: null, isPublished: true }), {
    contentUrl: null,
    lessonDate: null,
    isPublished: true,
  })
})

test('lesson administration rejects cross-course mutation, invalid dates, and unbounded fields', () => {
  invalid(parseLessonCreateBody, { lessonNumber: 1, title: 'Урок', courseId: 99 }, 'invalid_lesson')
  invalid(parseLessonCreateBody, { lessonNumber: 1, title: 'Урок', lessonDate: '2026-02-29' }, 'invalid_lesson_date')
  invalid(parseLessonCreateBody, { lessonNumber: 1, title: 'Урок', durationMinutes: 0 }, 'invalid_lesson_duration')
  invalid(parseLessonCreateBody, { lessonNumber: 1, title: 'Урок', contentUrl: 'http://example.test/lesson' }, 'invalid_lesson_content_url')
  invalid(parseLessonPatchBody, {}, 'invalid_lesson_patch')
  invalid(parseLessonPatchBody, { createdBy: 'forged' }, 'invalid_lesson')
})

test('lesson materials accept only rich text or YouTube metadata before file upload', () => {
  assert.deepEqual(parseMaterialTextBody({
    materialType: 'video', title: 'Разбор', position: 2,
    externalUrl: 'https://www.youtube.com/watch?v=abc12345678', isPublished: true,
  }), {
    materialType: 'video', title: 'Разбор', position: 2, bodyMarkdown: null,
    externalUrl: 'https://www.youtube.com/watch?v=abc12345678', isPublished: true,
  })
  invalid(parseMaterialTextBody, { materialType: 'document', title: 'PDF', position: 1 }, 'invalid_material_type')
  invalid(parseMaterialTextBody, { materialType: 'video', title: 'Видео', position: 1, externalUrl: 'https://example.com/x' }, 'invalid_material_video_url')
  invalid(parseMaterialTextBody, { materialType: 'rich_text', title: 'Текст', position: 0, bodyMarkdown: 'x' }, 'invalid_material_position')
})

test('roadmap administration accepts only bounded unit and placement data', () => {
  assert.deepEqual(parseRoadmapUnitCreateBody({ unitNumber: 2, title: '  Алгебра  ', accentColor: 'violet', isPublished: true }), {
    unitNumber: 2, title: 'Алгебра', description: null, accentColor: 'violet', isPublished: true,
  })
  assert.deepEqual(parseRoadmapUnitPatchBody({ description: null, accentColor: 'green' }), { description: null, accentColor: 'green' })
  assert.deepEqual(parseRoadmapPlacementBody({ lessonId: 14, position: 3 }), { lessonId: 14, position: 3 })
  invalid(parseRoadmapUnitCreateBody, { unitNumber: 1, title: 'Раздел', accentColor: 'url(javascript:)' }, 'invalid_roadmap_accent_color')
  invalid(parseRoadmapUnitPatchBody, { courseId: 99 }, 'invalid_roadmap_unit')
  invalid(parseRoadmapPlacementBody, { lessonId: 2, position: 0 }, 'invalid_roadmap_position')
  invalid(parseRoadmapPlacementBody, { lessonId: 2, position: 1, score: 100 }, 'invalid_roadmap_placement')
})

test('admin learning routes are first-party, role-gated, and audited', async () => {
  const [route, server] = await Promise.all([
    readFile(path.join(backendRoot, 'src', 'routes', 'admin-learning.js'), 'utf8'),
    readFile(path.join(backendRoot, 'src', 'server.js'), 'utf8'),
  ])
  assert.match(server, /import '\.\/routes\/admin-learning\.js'/)
  assert.match(route, /CONTENT_MANAGER_ROLES = \['admin', 'super_admin'\]/)
  assert.match(route, /GET\('\/v1\/admin\/courses'/)
  assert.match(route, /POST\('\/v1\/admin\/courses'/)
  assert.match(route, /PATCH\('\/v1\/admin\/courses\/:courseId'/)
  assert.match(route, /GET\('\/v1\/admin\/courses\/:courseId\/lessons'/)
  assert.match(route, /POST\('\/v1\/admin\/courses\/:courseId\/lessons'/)
  assert.match(route, /PATCH\('\/v1\/admin\/lessons\/:lessonId'/)
  assert.match(route, /POST\('\/v1\/admin\/lessons\/:lessonId\/materials\/upload'/)
  assert.match(route, /POST\('\/v1\/admin\/materials\/:materialId\/review'/)
  assert.match(route, /GET\('\/v1\/admin\/courses\/:courseId\/roadmap'/)
  assert.match(route, /POST\('\/v1\/admin\/courses\/:courseId\/roadmap\/units'/)
  assert.match(route, /PATCH\('\/v1\/admin\/roadmap\/units\/:unitId'/)
  assert.match(route, /POST\('\/v1\/admin\/roadmap\/units\/:unitId\/lessons'/)
  assert.match(route, /DELETE\('\/v1\/admin\/roadmap\/units\/:unitId\/lessons\/:lessonId'/)
  assert.match(route, /scan_status/)
  assert.match(route, /INSERT INTO audit_log/)
  assert.match(route, /created_by/)
  assert.doesNotMatch(route, /supabase/i)
  assert.match(route, /DELETE\('\/v1\/admin\/roadmap\/units\/:unitId\/lessons\/:lessonId'/)
})
