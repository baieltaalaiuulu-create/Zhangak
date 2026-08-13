import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  parseGroupCreateBody,
  parseGroupPatchBody,
  parseStudentAssignmentBody,
  parseTeacherAssignmentBody,
} from '../src/routes/admin-groups.js'
import { HttpError } from '../src/http.js'

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const TEACHER_ID = '11111111-1111-4111-8111-111111111111'
const STUDENT_ID = '22222222-2222-4222-8222-222222222222'

function invalid(parser, body, code) {
  assert.throws(
    () => parser(body),
    error => error instanceof HttpError && error.status === 400 && error.code === code,
  )
}

test('group creation accepts only a bounded first-party learning shape', () => {
  assert.deepEqual(parseGroupCreateBody({
    courseId: 12,
    name: '  ОРТ-11 / вечер  ',
    deliveryMode: 'hybrid',
    capacity: 18,
    startsOn: '2026-09-01',
    endsOn: '2027-05-20',
    isActive: false,
  }), {
    courseId: 12,
    name: 'ОРТ-11 / вечер',
    deliveryMode: 'hybrid',
    capacity: 18,
    startsOn: '2026-09-01',
    endsOn: '2027-05-20',
    isActive: false,
  })
  assert.deepEqual(parseGroupCreateBody({ courseId: 1, name: 'Новая группа' }), {
    courseId: 1,
    name: 'Новая группа',
    deliveryMode: 'offline',
    capacity: null,
    startsOn: null,
    endsOn: null,
    isActive: true,
  })
})

test('group patch cannot mutate its course, teacher, or invalid capacity/date window', () => {
  assert.deepEqual(parseGroupPatchBody({ capacity: null, startsOn: null, isActive: true }), {
    capacity: null,
    startsOn: null,
    isActive: true,
  })
  invalid(parseGroupCreateBody, { courseId: '1', name: 'Группа' }, 'invalid_course_id')
  invalid(parseGroupCreateBody, { courseId: 1, name: 'Группа', teacherId: TEACHER_ID }, 'invalid_group')
  invalid(parseGroupCreateBody, { courseId: 1, name: 'Группа', capacity: 0 }, 'invalid_group_capacity')
  invalid(parseGroupCreateBody, { courseId: 1, name: 'Группа', startsOn: '2026-02-29' }, 'invalid_group_starts_on')
  invalid(parseGroupCreateBody, { courseId: 1, name: 'Группа', startsOn: '2026-09-02', endsOn: '2026-09-01' }, 'invalid_group_dates')
  invalid(parseGroupPatchBody, {}, 'invalid_group_patch')
  invalid(parseGroupPatchBody, { courseId: 3 }, 'invalid_group')
  invalid(parseGroupPatchBody, { teacherId: TEACHER_ID }, 'invalid_group')
  invalid(parseGroupPatchBody, { deliveryMode: 'remote' }, 'invalid_group_delivery_mode')
})

test('teacher and student assignment bodies fail closed and allow an explicit teacher removal', () => {
  assert.deepEqual(parseTeacherAssignmentBody({ teacherId: TEACHER_ID }), { teacherId: TEACHER_ID })
  assert.deepEqual(parseTeacherAssignmentBody({ teacherId: null }), { teacherId: null })
  assert.deepEqual(parseStudentAssignmentBody({ studentId: STUDENT_ID }), { studentId: STUDENT_ID })
  invalid(parseTeacherAssignmentBody, {}, 'invalid_group_teacher')
  invalid(parseTeacherAssignmentBody, { teacherId: 'not-a-uuid' }, 'invalid_teacher_id')
  invalid(parseTeacherAssignmentBody, { teacherId: TEACHER_ID, actorId: STUDENT_ID }, 'invalid_group_teacher')
  invalid(parseStudentAssignmentBody, { studentId: TEACHER_ID, leftAt: 'forged' }, 'invalid_group_student')
})

test('group routes are first-party, senior-role gated, audited, and retain membership history', async () => {
  const [route, server, migration] = await Promise.all([
    readFile(path.join(backendRoot, 'src', 'routes', 'admin-groups.js'), 'utf8'),
    readFile(path.join(backendRoot, 'src', 'server.js'), 'utf8'),
    readFile(path.join(backendRoot, 'migrations', '002_learning_core.sql'), 'utf8'),
  ])
  assert.match(server, /import '\.\/routes\/admin-groups\.js'/)
  assert.match(route, /GROUP_MANAGER_ROLES = \['admin', 'super_admin'\]/)
  assert.match(route, /requireRole\(await requireAuth\(config, req\), GROUP_MANAGER_ROLES\)/)
  assert.match(route, /GET\('\/v1\/admin\/groups'/)
  assert.match(route, /POST\('\/v1\/admin\/groups'/)
  assert.match(route, /PATCH\('\/v1\/admin\/groups\/:groupId'/)
  assert.match(route, /GET\('\/v1\/admin\/groups\/:groupId\/members'/)
  assert.match(route, /PATCH\('\/v1\/admin\/groups\/:groupId\/teacher'/)
  assert.match(route, /POST\('\/v1\/admin\/groups\/:groupId\/students'/)
  assert.match(route, /DELETE\('\/v1\/admin\/groups\/:groupId\/students\/:studentId'/)
  assert.match(route, /GET\('\/v1\/admin\/group-assignees'/)
  assert.match(route, /function routePositiveId\(value, field\)/)
  assert.match(route, /routePositiveId\(params\.groupId, 'group_id'\)/)
  assert.match(route, /return routePositiveId\(value, code\)/)
  assert.match(route, /INSERT INTO audit_log/)
  assert.match(route, /FOR UPDATE/)
  assert.match(route, /group_capacity_reached/)
  assert.match(route, /group_delivery_mode_membership_conflict/)
  assert.match(route, /UPDATE group_students SET left_at = now\(\)/)
  assert.match(route, /Course membership is immutable after creation/)
  assert.doesNotMatch(route, /supabase/i)
  assert.ok(migration.includes('CREATE TABLE groups ('))
  assert.ok(migration.includes('CREATE TABLE group_students ('))
  assert.match(migration, /group_students_current_unique/)
})
