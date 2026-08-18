import assert from 'node:assert/strict'
import test from 'node:test'

import {
  canChangeAccountRole,
  canCreateAccount,
  canManageAccount,
  isSuperAdmin,
  visibleAccountRoles,
} from '../src/authorization.js'

test('account creation follows the exact role hierarchy', () => {
  assert.equal(canCreateAccount('super_admin', 'admin'), true)
  assert.equal(canCreateAccount('super_admin', 'teacher'), true)
  assert.equal(canCreateAccount('super_admin', 'super_admin'), false)
  assert.equal(canCreateAccount('admin', 'student'), true)
  assert.equal(canCreateAccount('admin', 'admin'), false)
  assert.equal(canCreateAccount('admin_jr', 'student'), true)
  assert.equal(canCreateAccount('admin_jr', 'super_admin'), false)
  assert.equal(canCreateAccount('math_admin', 'math_student'), true)
  assert.equal(canCreateAccount('math_admin', 'student'), false)
})

test('only super-admins can reassign non-peer account roles', () => {
  assert.equal(isSuperAdmin('super_admin'), true)
  assert.equal(isSuperAdmin('admin'), false)
  assert.equal(canChangeAccountRole('super_admin', 'teacher', 'admin'), true)
  assert.equal(canChangeAccountRole('super_admin', 'student', 'super_admin'), false)
  assert.equal(canChangeAccountRole('super_admin', 'super_admin', 'student'), false)
  assert.equal(canChangeAccountRole('admin', 'student', 'teacher'), false)
})

test('account management forbids self-equivalent privilege escalation', () => {
  assert.equal(canManageAccount('super_admin', 'admin'), true)
  assert.equal(canManageAccount('super_admin', 'super_admin'), false)
  assert.equal(canManageAccount('admin', 'student'), true)
  assert.equal(canManageAccount('admin', 'admin_jr'), false)
  assert.equal(canManageAccount('admin_jr', 'student'), false)
  assert.equal(canManageAccount('math_admin', 'math_parent'), true)
})

test('list visibility matches management capability', () => {
  assert.equal(visibleAccountRoles('super_admin'), null)
  assert.deepEqual(visibleAccountRoles('admin'), ['student'])
  assert.deepEqual(visibleAccountRoles('math_admin'), ['math_student', 'math_parent'])
  assert.deepEqual(visibleAccountRoles('admin_jr'), [])
})
