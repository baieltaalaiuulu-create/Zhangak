import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { HttpError } from '../src/http.js'
import { publicTeacherGroup, requireTeacher } from '../src/routes/platform-teacher.js'

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

test('teacher public DTO contains counts and course metadata, never roster or teaching records', () => {
  const group = publicTeacherGroup({
    id: '12', name: 'ОРТ-11 А', course_id: '3', course_name: 'Подготовка к ОРТ',
    course_level: '11 класс', course_subject: 'Математика', delivery_mode: 'hybrid',
    starts_on: '2026-09-01', ends_on: null, active_student_count: '18', published_lesson_count: '6',
  })
  assert.deepEqual(group, {
    id: 12,
    name: 'ОРТ-11 А',
    course: { id: 3, name: 'Подготовка к ОРТ', level: '11 класс', subject: 'Математика' },
    deliveryMode: 'hybrid',
    startsOn: '2026-09-01',
    endsOn: null,
    activeStudentCount: 18,
    publishedLessonCount: 6,
  })
  assert.equal(Object.hasOwn(group, 'students'), false)
  assert.equal(Object.hasOwn(group, 'attendance'), false)
  assert.equal(Object.hasOwn(group, 'grades'), false)
  assert.equal(Object.hasOwn(group, 'homework'), false)
  assert.throws(
    () => publicTeacherGroup({
      id: 12, name: 'ОРТ-11 А', course_id: 3, course_name: 'Подготовка к ОРТ',
      delivery_mode: 'remote', active_student_count: 0, published_lesson_count: 0,
    }),
    error => error instanceof HttpError && error.code === 'invalid_teacher_dashboard',
  )
})

test('teacher role is enforced before the dashboard query', () => {
  assert.deepEqual(requireTeacher({ role: 'teacher', id: 'teacher-1' }), { role: 'teacher', id: 'teacher-1' })
  assert.throws(
    () => requireTeacher({ role: 'student', id: 'student-1' }),
    error => error instanceof HttpError && error.status === 403 && error.code === 'teacher_required',
  )
})

test('teacher dashboard query is ownership-scoped and remains count-only', async () => {
  const source = await readFile(path.join(backendRoot, 'src', 'routes', 'platform-teacher.js'), 'utf8')
  assert.match(source, /GET\('\/v1\/platform\/teacher-dashboard'/)
  assert.match(source, /requireTeacher\(await requireAuth\(config, req\)\)/)
  assert.match(source, /WHERE g\.teacher_id = \$1 AND g\.is_active = true/)
  assert.match(source, /JOIN courses c ON c\.id = g\.course_id AND c\.is_active = true/)
  assert.match(source, /SELECT count\(\*\)::int\s+FROM group_students gs/)
  assert.match(source, /member_profile\.role IN \('student', 'math_student'\)/)
  assert.match(source, /SELECT count\(\*\)::int\s+FROM lessons l/)
  for (const forbidden of [/\bFROM attendance\b/i, /\bFROM homeworks?\b/i, /\bFROM practice_attempts?\b/i, /\bcorrect_answer\b/i, /full_name\s+AS\s+student/i]) {
    assert.equal(forbidden.test(source), false, `teacher dashboard must not project ${forbidden}`)
  }
})
