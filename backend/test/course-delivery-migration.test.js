import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const migration = await readFile(path.join(backendRoot, 'migrations', '006_course_delivery_enrollments_and_materials.sql'), 'utf8')
const privateStorageMigration = await readFile(path.join(backendRoot, 'migrations', '008_private_material_storage.sql'), 'utf8')

test('course delivery migration removes hybrid access and makes one current enrolment enforceable', () => {
  assert.match(migration, /student_type IS NULL OR student_type IN \('online', 'offline'\)/)
  assert.match(migration, /groups_delivery_mode CHECK \(delivery_mode = 'offline'\)/)
  assert.match(migration, /delivery_mode IN \('online', 'offline'\)/)
  assert.match(migration, /CREATE TABLE course_enrollments \(/)
  assert.match(migration, /course_enrollments_one_current_course/)
  assert.match(migration, /'awaiting_payment', 'awaiting_confirmation', 'active', 'suspended'/)
})

test('private material storage requires an audited review before a binary file is available', () => {
  assert.match(privateStorageMigration, /scan_status IN \('pending', 'clean', 'rejected'\)/)
  assert.match(privateStorageMigration, /scan_status = 'pending' AND scanned_at IS NULL AND scanned_by IS NULL/)
  assert.match(privateStorageMigration, /content_sha256/)
  assert.match(privateStorageMigration, /lesson_materials_storage_key_unique/)
})

test('lesson material metadata keeps private files private and applies the approved file limits', () => {
  assert.match(migration, /CREATE TABLE lesson_materials \(/)
  assert.match(migration, /storage_key text/)
  assert.match(migration, /mime_type = 'application\/pdf' AND byte_size BETWEEN 1 AND 209715200/)
  assert.match(migration, /mime_type ~ '\^image\/' AND byte_size BETWEEN 1 AND 31457280/)
  assert.match(migration, /youtube/)
  assert.match(migration, /youtu/)
  assert.match(migration, /lesson_materials_lesson_published_position/)
})
