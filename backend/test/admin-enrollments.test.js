import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { parseEnrollmentCreateBody, parseEnrollmentPatchBody } from '../src/routes/admin-enrollments.js'
import { HttpError } from '../src/http.js'

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const STUDENT_ID = '22222222-2222-4222-8222-222222222222'

function invalid(parser, body, code) {
  assert.throws(() => parser(body), error => error instanceof HttpError && error.status === 400 && error.code === code)
}

test('manual enrolment accepts only a student, a course and an explicit lifecycle status', () => {
  assert.deepEqual(parseEnrollmentCreateBody({ studentId: STUDENT_ID, courseId: 4 }), {
    studentId: STUDENT_ID, courseId: 4, status: 'awaiting_payment',
  })
  assert.deepEqual(parseEnrollmentCreateBody({ studentId: STUDENT_ID, courseId: 4, status: 'active' }), {
    studentId: STUDENT_ID, courseId: 4, status: 'active',
  })
  assert.deepEqual(parseEnrollmentPatchBody({ status: 'awaiting_confirmation' }), { status: 'awaiting_confirmation' })
  invalid(parseEnrollmentCreateBody, { studentId: STUDENT_ID, courseId: 4, paid: true }, 'invalid_enrollment')
  invalid(parseEnrollmentCreateBody, { studentId: STUDENT_ID, courseId: 4, status: 'approved' }, 'invalid_enrollment_status')
  invalid(parseEnrollmentPatchBody, { status: 'active', studentId: STUDENT_ID }, 'invalid_enrollment')
})

test('enrolment routes are first-party, audited and protect the one-current-course rule', async () => {
  const [route, server, migration] = await Promise.all([
    readFile(path.join(backendRoot, 'src', 'routes', 'admin-enrollments.js'), 'utf8'),
    readFile(path.join(backendRoot, 'src', 'server.js'), 'utf8'),
    readFile(path.join(backendRoot, 'migrations', '006_course_delivery_enrollments_and_materials.sql'), 'utf8'),
  ])
  assert.match(server, /import '\.\/routes\/admin-enrollments\.js'/)
  assert.match(route, /ENROLLMENT_MANAGER_ROLES = \['manager', 'admin', 'super_admin'\]/)
  assert.match(route, /GET\('\/v1\/admin\/enrollments'/)
  assert.match(route, /POST\('\/v1\/admin\/enrollments'/)
  assert.match(route, /PATCH\('\/v1\/admin\/enrollments\/:enrollmentId'/)
  assert.match(route, /requireStudentMatchesCourse/)
  assert.match(route, /FOR UPDATE/)
  assert.match(route, /INSERT INTO audit_log/)
  assert.match(route, /current_enrollment_exists/)
  assert.match(migration, /course_enrollments_one_current_course/)
  assert.doesNotMatch(route, /supabase/i)
})
