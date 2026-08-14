import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { publicAdminAuditRow } from '../src/routes/admin-access.js'
import { HttpError } from '../src/http.js'

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

test('super-admin audit projection exposes accountability data without metadata or target identifiers', () => {
  assert.deepEqual(publicAdminAuditRow({
    id: '12',
    action: 'change_user_role',
    target_type: 'user',
    actor_full_name: 'Айжан Админова',
    actor_role: 'super_admin',
    created_at: '2026-08-14T08:00:00.000Z',
  }), {
    id: 12,
    action: 'change_user_role',
    targetType: 'user',
    actorName: 'Айжан Админова',
    actorRole: 'super_admin',
    createdAt: '2026-08-14T08:00:00.000Z',
  })
  assert.deepEqual(publicAdminAuditRow({
    id: 13,
    action: 'delete_user',
    target_type: 'user',
    actor_full_name: null,
    actor_role: null,
    created_at: '2026-08-14T09:00:00.000Z',
  }).actorName, null)
})

test('audit projection fails closed for malformed actor data', () => {
  assert.throws(
    () => publicAdminAuditRow({
      id: 12,
      action: 'create_user',
      target_type: 'user',
      actor_full_name: 'Некорректная роль',
      actor_role: 'student_admin',
      created_at: '2026-08-14T08:00:00.000Z',
    }),
    error => error instanceof HttpError && error.status === 500 && error.code === 'invalid_admin_audit',
  )
})

test('role administration is super-admin-only, revokes sessions, and keeps group links valid', async () => {
  const [usersRoute, accessRoute, server] = await Promise.all([
    readFile(path.join(backendRoot, 'src', 'routes', 'admin-users.js'), 'utf8'),
    readFile(path.join(backendRoot, 'src', 'routes', 'admin-access.js'), 'utf8'),
    readFile(path.join(backendRoot, 'src', 'server.js'), 'utf8'),
  ])
  assert.match(usersRoute, /PATCH\('\/v1\/admin\/users\/:id\/role'/)
  assert.match(usersRoute, /requireSuperAdmin\(await requireAuth\(config, req\)\)/)
  assert.match(usersRoute, /canChangeAccountRole\(currentActor\.role, target\.role, nextRole\)/)
  assert.match(usersRoute, /active_student_group_memberships/)
  assert.match(usersRoute, /teacher_group_assignments/)
  assert.match(usersRoute, /session_version = session_version \+ 1/)
  assert.match(usersRoute, /UPDATE auth_sessions SET revoked_at/)
  assert.match(usersRoute, /'change_user_role'/)

  assert.match(accessRoute, /GET\('\/v1\/admin\/audit'/)
  assert.match(accessRoute, /requireSuperAdmin\(await requireAuth\(config, req\)\)/)
  assert.doesNotMatch(accessRoute, /a\.metadata/)
  assert.doesNotMatch(accessRoute, /a\.target_id/)
  assert.match(server, /import '\.\/routes\/admin-access\.js'/)
})
