import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  parseApplicationPatchBody,
  parsePaymentConfirmationBody,
  parsePublicApplicationBody,
} from '../src/routes/public-applications.js'
import { HttpError } from '../src/http.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const STUDENT_ID = '22222222-2222-4222-8222-222222222222'

test('public application intake accepts exactly contact and course fields', () => {
  assert.deepEqual(parsePublicApplicationBody({ name: '  Айдана  Эсенова ', phone: '+996 (555) 123-456', city: ' Бишкек ', courseId: 7 }), {
    name: 'Айдана Эсенова', phone: '+996555123456', city: 'Бишкек', courseId: 7,
  })
  assert.throws(() => parsePublicApplicationBody({ name: 'A', phone: '555', city: 'Бишкек', courseId: 7 }), error => error instanceof HttpError && error.code === 'invalid_application_name')
  assert.throws(() => parsePublicApplicationBody({ name: 'Айдана', phone: '+996555123456', city: 'Бишкек', courseId: 7, paid: true }), error => error instanceof HttpError && error.code === 'invalid_application')
  assert.deepEqual(parseApplicationPatchBody({ status: 'awaiting_confirmation', note: 'Оплата ожидает сверки' }), { status: 'awaiting_confirmation', note: 'Оплата ожидает сверки', assignedTo: null, hasAssignedTo: false })
  assert.deepEqual(parsePaymentConfirmationBody({ studentId: STUDENT_ID }), { studentId: STUDENT_ID, accessPlan: 'one_month' })
  assert.deepEqual(parsePaymentConfirmationBody({ studentId: STUDENT_ID, accessPlan: 'one_year' }), { studentId: STUDENT_ID, accessPlan: 'one_year' })
})

test('application route separates public intake, staff queue and payment activation', async () => {
  const [route, migration, server] = await Promise.all([
    readFile(path.join(root, 'src/routes/public-applications.js'), 'utf8'),
    readFile(path.join(root, 'migrations/010_public_applications.sql'), 'utf8'),
    readFile(path.join(root, 'src/server.js'), 'utf8'),
  ])
  assert.match(server, /import '\.\/routes\/public-applications\.js'/)
  assert.match(route, /POST\('\/v1\/public\/applications'/)
  assert.match(route, /GET\('\/v1\/admin\/applications'/)
  assert.match(route, /confirm-payment/)
  assert.match(route, /PAYMENT_CONFIRMER_ROLES = \['admin', 'super_admin'\]/)
  assert.match(route, /INSERT INTO course_enrollments/)
  assert.match(route, /FOR UPDATE/)
  assert.match(route, /application_rate_limited/)
  assert.match(migration, /CREATE TABLE public_applications/)
  assert.match(migration, /CREATE TABLE public_application_events/)
  assert.match(migration, /payment_confirmed_by/)
  assert.doesNotMatch(route, /supabase/i)
})
