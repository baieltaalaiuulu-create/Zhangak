import assert from 'node:assert/strict'
import test from 'node:test'

import { parseArgs, planOrApply, readCredentials } from '../scripts/seed-demo-student.js'

test('command line parsing defaults to dry-run and rejects unknown flags', () => {
  assert.deepEqual(parseArgs([]), { apply: false })
  assert.deepEqual(parseArgs(['--apply']), { apply: true })
  assert.deepEqual(parseArgs(['--apply', '--dry-run']), { apply: false })
  assert.throws(() => parseArgs(['--force']), /unrecognized argument/)
})

test('credentials are read only from environment variables, never defaulted', () => {
  assert.throws(() => readCredentials({}), /required/)
  assert.throws(
    () => readCredentials({ ZHANGAK_DEMO_STUDENT_EMAIL: 'not-an-email', ZHANGAK_DEMO_STUDENT_PASSWORD: 'x'.repeat(20), ZHANGAK_DEMO_STUDENT_NAME: 'Demo' }),
    /invalid demo student email/,
  )
  assert.throws(
    () => readCredentials({ ZHANGAK_DEMO_STUDENT_EMAIL: 'demo.student@zhangak.test', ZHANGAK_DEMO_STUDENT_PASSWORD: 'short', ZHANGAK_DEMO_STUDENT_NAME: 'Demo' }),
    /at least 12 characters/,
  )
  assert.deepEqual(
    readCredentials({
      ZHANGAK_DEMO_STUDENT_EMAIL: '  Demo.Student@Zhangak.test  ',
      ZHANGAK_DEMO_STUDENT_PASSWORD: 'a-safe-long-password',
      ZHANGAK_DEMO_STUDENT_NAME: '  Demo Student  ',
    }),
    { email: 'demo.student@zhangak.test', password: 'a-safe-long-password', fullName: 'Demo Student' },
  )
})

const CREDENTIALS = {
  email: 'demo.student@zhangak.test',
  password: 'a-safe-long-password',
  fullName: 'Demo Student',
}

test('an existing staff or offline account is never reused as the demo student', async () => {
  let call = 0
  const client = {
    async query() {
      call += 1
      if (call === 1) return { rowCount: 1, rows: [{ id: 2 }] }
      return { rowCount: 1, rows: [{ id: 'staff-id', role: 'admin', student_type: null }] }
    },
  }
  await assert.rejects(() => planOrApply(client, CREDENTIALS, true), /non-online-student account/)
})

test('an existing enrollment on another current course blocks an unsafe second enrollment', async () => {
  let call = 0
  const client = {
    async query() {
      call += 1
      if (call === 1) return { rowCount: 1, rows: [{ id: 2 }] }
      if (call === 2) return { rowCount: 1, rows: [{ id: 'student-id', role: 'student', student_type: 'online' }] }
      return { rowCount: 1, rows: [{ id: 44, course_id: 8, status: 'active' }] }
    },
  }
  await assert.rejects(() => planOrApply(client, CREDENTIALS, true), /one-current-course rule/)
})
