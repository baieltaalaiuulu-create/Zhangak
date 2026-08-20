import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

test('student monitoring is admin-only and exposes aggregate learning signals without answers', async () => {
  const [route, server, migration] = await Promise.all([
    readFile(path.join(backendRoot, 'src', 'routes', 'admin-student-monitoring.js'), 'utf8'),
    readFile(path.join(backendRoot, 'src', 'server.js'), 'utf8'),
    readFile(path.join(backendRoot, 'migrations', '021_online_access_terms.sql'), 'utf8'),
  ])
  assert.match(server, /import '\.\/routes\/admin-student-monitoring\.js'/)
  assert.match(route, /ADMIN_ROLES = \['admin', 'super_admin'\]/)
  assert.match(route, /GET\('\/v1\/admin\/student-monitoring'/)
  assert.match(route, /visits_30d/)
  assert.match(route, /lessons_completed/)
  assert.match(route, /trainer_mastered/)
  assert.doesNotMatch(route, /correct_answer|selected_answer|question_text/)
  assert.match(migration, /CREATE VIEW active_course_enrollments/)
  assert.match(migration, /one_month.*three_months.*one_year/s)
})

