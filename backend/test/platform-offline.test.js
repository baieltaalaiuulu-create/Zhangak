import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { HttpError } from '../src/http.js'
import {
  emptyOfflineDashboard,
  publicOfflineGrade,
  publicOfflineGroup,
  publicOfflineHomework,
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
  assert.deepEqual(publicOfflineHomework({
    id: '5', lesson_id: '3', lesson_title: 'Квадратные уравнения', title: 'Решить №1–10', body: 'Покажите ход решения', due_at: '2026-09-12T08:00:00.000Z', submission_status: 'submitted',
  }), {
    id: 5, lessonId: 3, lessonTitle: 'Квадратные уравнения', title: 'Решить №1–10', description: 'Покажите ход решения', dueAt: '2026-09-12T08:00:00.000Z', completed: true,
  })
  assert.deepEqual(publicOfflineGrade({ id: '8', class_session_id: '3', homework_id: null, title: 'Контрольная', score: '90' }), {
    lessonId: 3, lessonTitle: 'Контрольная', math: null, analogy: null, reading: null, grammar: null, total: 90,
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

test('offline dashboard is bearer-scoped and reads only owned classroom records', async () => {
  const source = await readFile(path.join(backendRoot, 'src', 'routes', 'platform-offline.js'), 'utf8')
  assert.match(source, /GET\('\/v1\/platform\/offline-dashboard'/)
  assert.match(source, /requireOfflineStudent\(await requireAuth\(config, req\)\)/)
  assert.match(source, /WHERE gs\.student_id = \$1/)
  assert.match(source, /gs\.left_at IS NULL/)
  assert.match(source, /g\.delivery_mode = 'offline'/)
  assert.match(source, /c\.delivery_mode = 'offline'/)
  assert.match(source, /is_published = true/)
  assert.match(source, /offline_class_sessions/)
  assert.match(source, /offline_attendance_records/)
  assert.match(source, /offline_homework/)
  assert.match(source, /offline_grades/)
  for (const forbidden of [/\bFROM attendance\b/i, /\bFROM test_results\b/i, /\bFROM practice_results\b/i, /\bcorrect_answer\b/i, /\bPOST\('/, /\bPATCH\('/, /\bDELETE\('/, /supabase/i]) {
    assert.equal(forbidden.test(source), false, `offline route must not contain ${forbidden}`)
  }
})
