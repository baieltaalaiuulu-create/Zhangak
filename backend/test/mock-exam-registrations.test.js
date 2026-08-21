import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

test('mock exam registration is published-event, capacity and enrollment scoped', async () => {
  const [source, migration] = await Promise.all([
    readFile(path.join(backendRoot, 'src', 'routes', 'platform-mock-exams.js'), 'utf8'),
    readFile(path.join(backendRoot, 'migrations', '026_mock_exam_registrations.sql'), 'utf8'),
  ])
  assert.match(source, /GET\('\/v1\/platform\/mock-exams\/upcoming'/)
  assert.match(source, /POST\('\/v1\/platform\/mock-exams\/:sessionId\/register'/)
  assert.match(source, /active_course_enrollments/)
  assert.match(source, /c\.delivery_mode = 'online'/)
  assert.match(source, /FOR UPDATE/)
  assert.match(source, /mock_exam_capacity_reached/)
  assert.match(migration, /UNIQUE \(mock_exam_session_id, student_id\)/)
  assert.match(source, /INSERT INTO audit_log/)
})

test('mock exam schedule is admin-only, audited and stores an explicit registration window', async () => {
  const [migration, route, server] = await Promise.all([
    readFile(path.join(backendRoot, 'migrations', '026_mock_exam_registrations.sql'), 'utf8'),
    readFile(path.join(backendRoot, 'src', 'routes', 'admin-mock-exams.js'), 'utf8'),
    readFile(path.join(backendRoot, 'src', 'server.js'), 'utf8'),
  ])
  assert.match(migration, /CREATE TABLE mock_exam_sessions/)
  assert.match(migration, /registration_closes_at <= starts_at/)
  assert.match(migration, /CREATE TABLE mock_exam_registrations/)
  assert.match(route, /MANAGER_ROLES = \['admin', 'super_admin'\]/)
  assert.match(route, /GET\('\/v1\/admin\/mock-exams'/)
  assert.match(route, /POST\('\/v1\/admin\/mock-exams'/)
  assert.match(route, /PATCH\('\/v1\/admin\/mock-exams\/:sessionId'/)
  assert.match(route, /INSERT INTO audit_log/)
  assert.match(server, /import '\.\/routes\/platform-mock-exams\.js'/)
  assert.match(server, /import '\.\/routes\/admin-mock-exams\.js'/)
  assert.doesNotMatch(route, /supabase/i)
})
