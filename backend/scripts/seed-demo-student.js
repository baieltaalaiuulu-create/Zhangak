/**
 * Idempotent bootstrap for one demo online-student account with an active
 * enrollment on the single active online course, so a tester can log in and
 * run the full Video -> Test -> Result -> Next lesson chain without an
 * operator touching SQL.
 *
 * Mirrors create-super-admin.js's safety rules: credentials come from
 * environment variables only, never from a flag, a default, or this file.
 * Re-running is a no-op once a compatible online-student account and its
 * target enrollment exist. It never resets a password, never treats an
 * existing staff/offline account as a demo student, and never duplicates an
 * enrollment.
 *
 *   ZHANGAK_DEMO_STUDENT_EMAIL=demo.student@zhangak.test \
 *   ZHANGAK_DEMO_STUDENT_PASSWORD=... \
 *   ZHANGAK_DEMO_STUDENT_NAME="Demo Student" \
 *   node backend/scripts/seed-demo-student.js --apply
 */
import process from 'node:process'

import { loadConfig } from '../src/config.js'
import { closeDatabase, connectDatabase, transaction } from '../src/db.js'
import { hashPassword } from '../src/security.js'

function fail(message) {
  throw new Error(`Demo student seed blocked: ${message}`)
}

export function parseArgs(argv) {
  let apply = false
  for (const arg of argv) {
    if (arg === '--apply') apply = true
    else if (arg === '--dry-run') apply = false
    else fail(`unrecognized argument: ${arg}`)
  }
  return { apply }
}

export function readCredentials(environment = process.env) {
  const email = environment.ZHANGAK_DEMO_STUDENT_EMAIL?.trim().toLowerCase()
  const password = environment.ZHANGAK_DEMO_STUDENT_PASSWORD
  const fullName = environment.ZHANGAK_DEMO_STUDENT_NAME?.trim()
  if (!email || !password || !fullName) {
    fail('ZHANGAK_DEMO_STUDENT_EMAIL, ZHANGAK_DEMO_STUDENT_PASSWORD and ZHANGAK_DEMO_STUDENT_NAME are required')
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('invalid demo student email')
  if (password.length < 12) fail('demo student password must be at least 12 characters')
  return { email, password, fullName }
}

async function findOnlineCourse(client) {
  const result = await client.query(
    `SELECT id FROM courses WHERE delivery_mode = 'online' AND is_active = true FOR UPDATE`,
  )
  if (result.rowCount === 0) fail('no active online course exists; create one in /admin/lessons first')
  if (result.rowCount > 1) fail('more than one active online course exists; this script refuses to guess which one to enroll into')
  return Number(result.rows[0].id)
}

async function ensureAccount(client, { email, password, fullName }) {
  const existing = await client.query(
    `SELECT u.id, p.role, p.student_type
       FROM users u
       LEFT JOIN profiles p ON p.user_id = u.id
      WHERE u.email = $1`,
    [email],
  )
  if (existing.rowCount === 1) {
    const account = existing.rows[0]
    if (account.role !== 'student' || account.student_type !== 'online') {
      fail(`email ${email} already belongs to a non-online-student account; refusing to reuse it`)
    }
    return { id: account.id, created: false }
  }
  const passwordHash = await hashPassword(password)
  const inserted = await client.query(
    'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id',
    [email, passwordHash],
  )
  const userId = inserted.rows[0].id
  await client.query(
    `INSERT INTO profiles (user_id, full_name, role, student_type, target_score)
     VALUES ($1, $2, 'student', 'online', 180)`,
    [userId, fullName],
  )
  await client.query(
    `INSERT INTO audit_log (actor_user_id, action, target_type, target_id, metadata)
     VALUES ($1, 'seed_demo_student', 'user', $1, '{"demo":true}'::jsonb)`,
    [userId],
  )
  return { id: userId, created: true }
}

async function ensureEnrollment(client, studentId, courseId) {
  const existing = await client.query(
    `SELECT id, course_id, status FROM course_enrollments
      WHERE student_id = $1
        AND status IN ('awaiting_payment', 'awaiting_confirmation', 'active', 'suspended')
      ORDER BY id ASC
      FOR UPDATE`,
    [studentId],
  )
  const target = existing.rows.find(row => Number(row.course_id) === courseId)
  if (target) {
    if (target.status !== 'active') {
      fail(`the target course enrollment already exists with status ${target.status}; activate it through the admin workflow`)
    }
    return { id: Number(target.id), created: false, status: target.status }
  }
  if (existing.rowCount > 0) {
    fail('the account already has a current enrollment on another course; refusing to violate the one-current-course rule')
  }
  const inserted = await client.query(
    `INSERT INTO course_enrollments (
       student_id, course_id, status, confirmed_at, activated_at,
       access_plan, access_started_at, access_expires_at
     ) VALUES ($1, $2, 'active', now(), now(), 'one_year', now(), now() + interval '12 months')
     RETURNING id`,
    [studentId, courseId],
  )
  const enrollmentId = Number(inserted.rows[0].id)
  await client.query(
    `INSERT INTO audit_log (actor_user_id, action, target_type, target_id, metadata)
     VALUES ($1, 'seed_demo_student_enrollment', 'course_enrollment', $2, '{"demo":true}'::jsonb)`,
    [studentId, String(enrollmentId)],
  )
  return { id: enrollmentId, created: true, status: 'active' }
}

export async function planOrApply(client, credentials, apply) {
  const courseId = await findOnlineCourse(client)
  if (!apply) {
    const existing = await client.query(
      `SELECT u.id, p.role, p.student_type
         FROM users u
         LEFT JOIN profiles p ON p.user_id = u.id
        WHERE u.email = $1`,
      [credentials.email],
    )
    const account = existing.rows[0] ?? null
    return {
      status: 'dry-run',
      accountExists: account !== null,
      accountCompatible: account === null || (account.role === 'student' && account.student_type === 'online'),
      courseId,
    }
  }
  const account = await ensureAccount(client, credentials)
  const enrollment = await ensureEnrollment(client, account.id, courseId)
  return {
    status: 'applied',
    studentId: account.id,
    accountCreated: account.created,
    enrollmentId: enrollment.id,
    enrollmentCreated: enrollment.created,
    enrollmentStatus: enrollment.status,
    courseId,
  }
}

async function main() {
  const { apply } = parseArgs(process.argv.slice(2))
  const credentials = readCredentials()
  const config = loadConfig()
  connectDatabase(config)
  try {
    const result = await transaction(client => planOrApply(client, credentials, apply))
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  } finally {
    await closeDatabase()
  }
}

if (process.argv[1] && process.argv[1].endsWith('seed-demo-student.js')) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : 'Demo student seed failed')
    process.exitCode = 1
  })
}
