import assert from 'node:assert/strict'
import test from 'node:test'

import { PublicApplicationError } from '../../lib/public-applications.ts'

test('public application errors retain safe response metadata', () => {
  const error = new PublicApplicationError('Введите номер WhatsApp', 400, 'invalid_phone')
  assert.equal(error.name, 'PublicApplicationError')
  assert.equal(error.status, 400)
  assert.equal(error.code, 'invalid_phone')
})
