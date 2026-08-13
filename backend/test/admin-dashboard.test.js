import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  publicDashboardAttempt,
  publicDashboardAudit,
  publicDashboardMetrics,
  requireDashboardAdmin,
} from '../src/routes/admin-dashboard.js'
import { HttpError } from '../src/http.js'

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ATTEMPT_ID = '018f6586-fca4-7d5c-8f94-cb524f5c4be8'

test('admin dashboard exposes only validated count metrics and safe summary rows', () => {
  assert.deepEqual(publicDashboardMetrics({
    total_students: '12', new_students_last_7_days: 3, lesson_count: '8', new_lessons_last_7_days: 1,
    submitted_attempt_count: '21', submitted_attempt_count_today: 2,
  }), {
    totalStudents: 12,
    newStudentsLast7Days: 3,
    lessonCount: 8,
    newLessonsLast7Days: 1,
    submittedAttemptCount: 21,
    submittedAttemptCountToday: 2,
  })
  assert.deepEqual(publicDashboardAttempt({
    id: ATTEMPT_ID,
    student_name: 'Айбек Нурланов',
    test_title: 'Математика: диагностический тест',
    test_type: 'diagnostic',
    score_percent: 75,
    submitted_at: '2026-08-13T08:00:00.000Z',
  }), {
    id: ATTEMPT_ID,
    studentName: 'Айбек Нурланов',
    testTitle: 'Математика: диагностический тест',
    testType: 'diagnostic',
    scorePercent: 75,
    completedAt: '2026-08-13T08:00:00.000Z',
  })
  assert.deepEqual(publicDashboardAudit({
    id: '7', action: 'create_course', target_type: 'course', created_at: '2026-08-13T08:00:00.000Z',
  }), {
    id: 7,
    action: 'create_course',
    targetType: 'course',
    createdAt: '2026-08-13T08:00:00.000Z',
  })
})

test('admin dashboard fails closed for unsupported roles and malformed summary data', () => {
  assert.deepEqual(requireDashboardAdmin({ id: 'admin-1', role: 'admin' }), { id: 'admin-1', role: 'admin' })
  assert.deepEqual(requireDashboardAdmin({ id: 'root-1', role: 'super_admin' }), { id: 'root-1', role: 'super_admin' })
  assert.throws(
    () => requireDashboardAdmin({ id: 'student-1', role: 'student' }),
    error => error instanceof HttpError && error.status === 403 && error.code === 'forbidden',
  )
  assert.throws(
    () => publicDashboardMetrics({ total_students: -1 }),
    error => error instanceof HttpError && error.code === 'invalid_admin_dashboard',
  )
  assert.throws(
    () => publicDashboardAttempt({
      id: ATTEMPT_ID, student_name: 'Айбек', test_title: 'Тест', test_type: 'practice', score_percent: 101,
      submitted_at: '2026-08-13T08:00:00.000Z',
    }),
    error => error instanceof HttpError && error.code === 'invalid_admin_dashboard',
  )
  assert.throws(
    () => publicDashboardAudit({ id: 1, action: 'create_course', target_type: 'user', created_at: '2026-08-13T08:00:00.000Z' }),
    error => error instanceof HttpError && error.code === 'invalid_admin_dashboard',
  )
})

test('admin dashboard remains a first-party read-only route without answer keys', async () => {
  const [route, server] = await Promise.all([
    readFile(path.join(backendRoot, 'src', 'routes', 'admin-dashboard.js'), 'utf8'),
    readFile(path.join(backendRoot, 'src', 'server.js'), 'utf8'),
  ])
  assert.match(server, /import '\.\/routes\/admin-dashboard\.js'/)
  assert.match(route, /GET\('\/v1\/admin\/dashboard'/)
  assert.match(route, /requireDashboardAdmin\(await requireAuth\(config, req\)\)/)
  assert.match(route, /FULL_ADMIN_ROLES = \['admin', 'super_admin'\]/)
  for (const table of ['users', 'profiles', 'lessons', 'practice_attempts', 'audit_log']) {
    assert.match(route, new RegExp(`\\b${table}\\b`), `dashboard must read owned ${table}`)
  }
  for (const forbidden of [/supabase/i, /correct_answer/i, /\bPOST\('/, /\bPATCH\('/, /\bDELETE\('/]) {
    assert.doesNotMatch(route, forbidden)
  }
})
