import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const migration = await readFile(path.join(backendRoot, 'migrations', '002_learning_core.sql'), 'utf8')

test('learning migration defines the first-party core domain', () => {
  for (const table of [
    'courses',
    'groups',
    'group_students',
    'lessons',
    'lesson_progress',
    'practice_tests',
    'practice_questions',
    'practice_attempts',
    'practice_attempt_items',
  ]) {
    assert.match(migration, new RegExp(`CREATE TABLE ${table} \\(`))
  }
  assert.match(migration, /CREATE VIEW practice_results AS/)
})

test('learning migration keeps correct answers behind a server-side attempt boundary', () => {
  assert.match(migration, /correct_answer text NOT NULL/)
  assert.match(migration, /image_url text/)
  assert.match(migration, /elapsed_seconds integer/)
  assert.match(migration, /CREATE OR REPLACE FUNCTION learning_validate_attempt_item\(\)/)
  assert.match(migration, /Practice attempt snapshots are immutable/)
  assert.match(migration, /Question does not belong to the attempt test/)
  assert.match(migration, /Practice attempt item must match its question snapshot/)
  assert.match(migration, /Every attempt item must be scored before submission/)
})

test('learning migration makes duplicate begins and double scoring detectable', () => {
  assert.match(migration, /practice_attempts_begin_idempotency_unique UNIQUE \(student_id, begin_idempotency_key\)/)
  assert.match(migration, /practice_attempts_submit_idempotency_unique UNIQUE \(student_id, submit_idempotency_key\)/)
  assert.match(migration, /practice_attempts_one_open_attempt/)
  assert.match(migration, /practice_attempts_student_test_number_unique UNIQUE \(student_id, practice_test_id, attempt_number\)/)
})

test('learning migration snapshots curriculum context instead of joining mutable tests for results', () => {
  assert.match(migration, /course_id bigint REFERENCES courses\(id\) ON DELETE RESTRICT/)
  assert.match(migration, /FOREIGN KEY \(lesson_id, course_id\) REFERENCES lessons\(id, course_id\) ON DELETE RESTRICT/)
  assert.match(migration, /a\.course_id,/)
  assert.match(migration, /a\.lesson_id,/)
  assert.match(migration, /FROM practice_attempts AS a\s+WHERE a\.status = 'submitted';/)
})
