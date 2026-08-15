import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { buildManifest, classifyMaterial, writeManifest } from '../scripts/build-sorted-data-manifest.js'

test('sorted-data classification blocks raw chat archives and preserves review boundaries', () => {
  assert.deepEqual(classifyMaterial('06_chat_exports_and_history/messages.html'), {
    sourceArea: '06_chat_exports_and_history',
    subject: 'unclassified',
    importLane: 'blocked',
    target: 'do_not_import',
    format: { kind: 'other', mimeType: null },
    flags: ['do_not_send_to_ai', 'privacy_review_required', 'raw_chat_archive', 'rights_review_required', 'unsupported_format'],
  })
  assert.equal(classifyMaterial('01_mathematics/topic/answer_sheet.pdf').subject, 'math')
  assert.ok(classifyMaterial('01_mathematics/topic/answer_sheet.pdf').flags.includes('potential_answer_key'))
  assert.ok(classifyMaterial('03_analogies/types.pdf').flags.includes('subject_mapping_required'))
})

test('manifest is deterministic, excludes itself, and refuses an accidental overwrite', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'zhangak-sorted-data-'))
  const math = path.join(root, '01_mathematics')
  const chat = path.join(root, '06_chat_exports_and_history')
  const docs = path.join(root, '00_documentation_and_indexes')
  await Promise.all([mkdir(math), mkdir(chat), mkdir(docs)])
  await writeFile(path.join(math, 'lesson.pdf'), '%PDF-1.7\n')
  await writeFile(path.join(chat, 'messages.html'), '<html>private archive</html>')

  const output = path.join(docs, 'CONTENT_MANIFEST.json')
  const first = await writeManifest({ inputDirectory: root, outputPath: output })
  assert.equal(first.summary.files, 2)
  assert.equal(first.summary.byImportLane.blocked, 1)
  assert.equal(first.summary.byImportLane.review_required, 1)
  assert.equal(first.files.find(file => file.path.endsWith('messages.html')).target, 'do_not_import')

  const written = JSON.parse(await readFile(output, 'utf8'))
  assert.equal(written.datasetSha256, first.datasetSha256)
  await assert.rejects(() => writeManifest({ inputDirectory: root, outputPath: output }), { code: 'EEXIST' })

  const rebuilt = await buildManifest(root, output)
  assert.equal(rebuilt.datasetSha256, first.datasetSha256)
  assert.equal(rebuilt.summary.files, 2)
})

test('manifest output may not escape the raw archive', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'zhangak-sorted-data-'))
  await writeFile(path.join(root, 'example.pdf'), '%PDF-1.7\n')
  await assert.rejects(
    () => buildManifest(root, path.join(path.dirname(root), 'outside-manifest.json')),
    /must stay inside the supplied input directory/,
  )
})
