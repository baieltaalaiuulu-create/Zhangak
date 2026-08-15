import assert from 'node:assert/strict'
import test from 'node:test'

import { HttpError } from '../src/http.js'
import { inspectMaterial, safeFilename } from '../src/storage.js'

test('private material inspection trusts binary signatures, not a browser MIME claim', () => {
  assert.deepEqual(inspectMaterial(Buffer.from('%PDF-1.7\n')), { materialType: 'document', mimeType: 'application/pdf' })
  assert.deepEqual(inspectMaterial(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), { materialType: 'image', mimeType: 'image/png' })
  assert.throws(() => inspectMaterial(Buffer.from('not a file')), error => error instanceof HttpError && error.status === 415)
})

test('private storage normalizes a user-provided filename without accepting paths', () => {
  assert.equal(safeFilename('../../exam.pdf'), 'exam.pdf')
  assert.equal(safeFilename('image<1>.png'), 'image_1_.png')
  assert.throws(() => safeFilename(''), error => error instanceof HttpError && error.code === 'invalid_material_filename')
})
