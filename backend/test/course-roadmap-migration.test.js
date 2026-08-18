import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

test('course roadmap migration protects ordering and same-course lesson placement', async () => {
  const source = await readFile(path.join(backendRoot, 'migrations', '012_course_roadmaps.sql'), 'utf8')
  assert.match(source, /CREATE TABLE course_units/)
  assert.match(source, /UNIQUE \(course_id, unit_number\)/)
  assert.match(source, /accent_color IN \('green', 'blue', 'violet', 'red'\)/)
  assert.match(source, /CREATE TABLE course_unit_lessons/)
  assert.match(source, /UNIQUE \(unit_id, position\)/)
  assert.match(source, /UNIQUE \(course_id, lesson_id\)/)
  assert.match(source, /FOREIGN KEY \(unit_id, course_id\)[\s\S]*REFERENCES course_units\(id, course_id\)/)
  assert.match(source, /FOREIGN KEY \(lesson_id, course_id\)[\s\S]*REFERENCES lessons\(id, course_id\)/)
})
