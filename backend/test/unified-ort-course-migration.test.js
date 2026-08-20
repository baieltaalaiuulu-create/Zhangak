import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

test('online ORT consolidation keeps subject detail on lessons and preserves related records', async () => {
  const sql = await readFile(path.join(backendRoot, 'migrations', '020_unify_online_ort_course.sql'), 'utf8')
  assert.match(sql, /code = 'demo-ort-2026'/u)
  assert.match(sql, /subject = 'ort'/u)
  assert.match(sql, /UPDATE lessons SET course_id = target_course_id/u)
  assert.match(sql, /UPDATE practice_tests SET course_id = target_course_id/u)
  assert.match(sql, /UPDATE practice_attempts SET course_id = target_course_id/u)
  assert.match(sql, /UPDATE course_enrollments SET course_id = target_course_id/u)
  assert.match(sql, /UPDATE student_xp_awards SET course_id = target_course_id/u)
  assert.match(sql, /row_number\(\) OVER \(ORDER BY lesson_number, id\)/u)
  assert.match(sql, /RAISE EXCEPTION 'Cannot consolidate ORT courses: a learner has enrolments in both source courses'/u)
  assert.doesNotMatch(sql, /UPDATE lessons\s+SET subject/u)
})
