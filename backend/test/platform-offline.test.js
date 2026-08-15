import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { HttpError } from '../src/http.js'
import {
  emptyOfflineDashboard,
  publicOfflineGroup,
  publicOfflineLesson,
  requireOfflineStudent,
} from '../src/routes/platform-offline.js'

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const student = {
  id: 'student-1',
  role: 'student',
  student_type: 'offline',
  full_name: 'Алия Тестова',
  target_score: 200,
}

test('offline dashboard returns only data represented by the owned learning schema', () => {
  assert.deepEqual(emptyOfflineDashboard(student), {
    profile: { id: 'student-1', fullName: 'Алия Тестова', studentType: 'offline', targetScore: 200 },
    group: null,
    lessons: [],
    homework: [],
    grades: [],
    progress: { latestOrtScore: null, targetScore: 200 },
    availability: { exactSchedule: false, materials: false },
  })
  assert.deepEqual(publicOfflineGroup({
    group_id: '7', group_name: 'ОРТ-11 А', course_name: 'Подготовка к ОРТ', teacher_name: 'Айбек У.',
  }), {
    id: 7, name: 'ОРТ-11 А', courseName: 'Подготовка к ОРТ', teacherName: 'Айбек У.',
  })
  assert.deepEqual(publicOfflineLesson({
    id: '3', lesson_number: '4', title: 'Квадратные уравнения', topic: 'Дискриминант',
    lesson_date: '2026-09-10', duration_minutes: '90', is_test: false,
  }), {
    id: 3,
    lessonNumber: 4,
    title: 'Квадратные уравнения',
    startsAt: '2026-09-10',
    durationMinutes: 90,
    isTest: false,
    attendance: 'pending',
    topics: ['Дискриминант'],
  })
})

test('offline dashboard denies non-students and accounts without the offline learning type', () => {
  for (const candidate of [
    { ...student, role: 'teacher' },
    { ...student, student_type: 'online' },
    { ...student, student_type: null },
  ]) {
    assert.throws(
      () => requireOfflineStudent(candidate),
      error => error instanceof HttpError && error.status === 403 && error.code === 'offline_student_required',
    )
  }
})

test('offline route is bearer-scoped, read-only, and does not revive unmigrated legacy domains', async () => {
  const source = await readFile(path.join(backendRoot, 'src', 'routes', 'platform-offline.js'), 'utf8')
  assert.match(source, /GET\('\/v1\/platform\/offline-dashboard'/)
  assert.match(source, /requireOfflineStudent\(await requireAuth\(config, req\)\)/)
  assert.match(source, /WHERE gs\.student_id = \$1/)
  assert.match(source, /gs\.left_at IS NULL/)
  assert.match(source, /g\.delivery_mode = 'offline'/)
  assert.match(source, /c\.delivery_mode = 'offline'/)
  assert.match(source, /is_published = true/)
  assert.match(source, /attendance: 'pending'/)
  assert.match(source, /homework: \[\]/)
  assert.match(source, /grades: \[\]/)
  for (const forbidden of [/\bFROM attendance\b/i, /\bFROM homework/i, /\bFROM test_results\b/i, /\bFROM practice_results\b/i, /\bcorrect_answer\b/i, /\bPOST\('/, /\bPATCH\('/, /\bDELETE\('/, /supabase/i]) {
    assert.equal(forbidden.test(source), false, `offline route must not contain ${forbidden}`)
  }
})
