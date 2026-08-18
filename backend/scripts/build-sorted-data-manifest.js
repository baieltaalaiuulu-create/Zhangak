/**
 * Creates a local, review-only inventory for an owner-provided sorted_data
 * archive. It never connects to PostgreSQL, uploads a file, extracts document
 * text, or creates lessons/questions. The resulting manifest is intentionally
 * safe to use as the input to a later human-reviewed importer.
 */
import { createHash } from 'node:crypto'
import { open, readdir, realpath, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const FORMAT = 'zhangak.sorted-data-manifest/v1'
const ANSWER_HINT = /(?:answer|answers|ответ|ответы|жооб|key|ключ)/iu

const EXTENSIONS = Object.freeze({
  '.pdf': { kind: 'document', mimeType: 'application/pdf' },
  '.docx': { kind: 'office_document', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
  '.pptx': { kind: 'presentation', mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' },
  '.ppt': { kind: 'presentation', mimeType: 'application/vnd.ms-powerpoint' },
  '.jpg': { kind: 'image', mimeType: 'image/jpeg' },
  '.jpeg': { kind: 'image', mimeType: 'image/jpeg' },
  '.png': { kind: 'image', mimeType: 'image/png' },
  '.webp': { kind: 'image', mimeType: 'image/webp' },
})

function fail(message) {
  const error = new Error(message)
  error.code = 'CONTENT_MANIFEST_ERROR'
  throw error
}

function normalizedRelative(root, target) {
  const relative = path.relative(root, target).replaceAll('\\', '/')
  if (!relative || relative === '.' || relative.startsWith('../') || path.isAbsolute(relative)) {
    fail('A manifest path must stay inside the supplied input directory')
  }
  return relative
}

function sourceArea(relativePath) {
  return relativePath.split('/')[0] ?? ''
}

export function classifyMaterial(relativePath) {
  const area = sourceArea(relativePath)
  const extension = path.extname(relativePath).toLowerCase()
  const format = EXTENSIONS[extension] ?? { kind: 'other', mimeType: null }
  const flags = ['rights_review_required']
  let subject = 'unclassified'
  let importLane = 'review_required'
  let target = 'manual_classification'

  if (area === '01_mathematics') {
    subject = 'math'
    target = format.kind === 'image' ? 'lesson_material_image' : 'lesson_material_or_question_source'
  } else if (area === '02_kyrgyz_language') {
    subject = 'kyr'
    target = format.kind === 'image' ? 'lesson_material_image' : 'lesson_material_or_question_source'
  } else if (area === '03_analogies') {
    flags.push('subject_mapping_required')
    target = 'question_source_after_subject_mapping'
  } else if (area === '04_jrt_tsoomo_full_tests' || area === '05_tasks_and_practice') {
    flags.push('question_extraction_required')
    target = 'practice_question_source'
  } else if (area === '06_chat_exports_and_history') {
    flags.push('privacy_review_required', 'raw_chat_archive', 'do_not_send_to_ai')
    importLane = 'blocked'
    target = 'do_not_import'
  } else if (area === '07_photo_archives') {
    flags.push('rights_and_context_review_required')
    target = 'lesson_or_question_image_after_review'
  } else if (area === '00_documentation_and_indexes') {
    flags.push('metadata_only')
    importLane = 'blocked'
    target = 'do_not_import'
  } else {
    flags.push('unknown_source_area')
  }

  if (ANSWER_HINT.test(relativePath)) flags.push('potential_answer_key')
  if (relativePath.endsWith('PROJECT_ALIGNMENT_GUIDE.md')) flags.push('historical_architecture_reference')
  if (format.kind === 'other') flags.push('unsupported_format')

  return {
    sourceArea: area || 'unclassified',
    subject,
    importLane,
    target,
    format,
    flags: [...new Set(flags)].sort(),
  }
}

async function sha256File(filePath) {
  const handle = await open(filePath, 'r')
  const hash = createHash('sha256')
  const buffer = Buffer.allocUnsafe(256 * 1024)
  try {
    let position = 0
    while (true) {
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, position)
      if (bytesRead === 0) break
      hash.update(buffer.subarray(0, bytesRead))
      position += bytesRead
    }
  } finally {
    await handle.close()
  }
  return hash.digest('hex')
}

async function listFiles(root, excludedPath) {
  const files = []
  async function walk(directory) {
    const entries = await readdir(directory, { withFileTypes: true })
    for (const entry of entries) {
      const absolute = path.join(directory, entry.name)
      if (absolute === excludedPath) continue
      if (entry.isSymbolicLink()) fail(`Symlinks are not allowed in a content archive: ${normalizedRelative(root, absolute)}`)
      if (entry.isDirectory()) await walk(absolute)
      else if (entry.isFile()) files.push(absolute)
    }
  }
  await walk(root)
  return files.sort((a, b) => a.localeCompare(b, 'en'))
}

function totals(records) {
  const bySourceArea = {}
  const byImportLane = {}
  const byExtension = {}
  let bytes = 0
  for (const record of records) {
    bytes += record.bytes
    bySourceArea[record.sourceArea] = (bySourceArea[record.sourceArea] ?? 0) + 1
    byImportLane[record.importLane] = (byImportLane[record.importLane] ?? 0) + 1
    byExtension[record.extension || '[none]'] = (byExtension[record.extension || '[none]'] ?? 0) + 1
  }
  return { files: records.length, bytes, bySourceArea, byImportLane, byExtension }
}

export async function buildManifest(inputDirectory, outputPath) {
  const input = await realpath(inputDirectory)
  const inputStats = await stat(input)
  if (!inputStats.isDirectory()) fail('--input must be a directory')

  const output = path.resolve(outputPath)
  normalizedRelative(input, output)
  const files = await listFiles(input, output)
  const records = []
  for (const filePath of files) {
    const relativePath = normalizedRelative(input, filePath)
    const details = await stat(filePath)
    const classification = classifyMaterial(relativePath)
    records.push({
      path: relativePath,
      bytes: details.size,
      extension: path.extname(relativePath).toLowerCase(),
      sha256: await sha256File(filePath),
      ...classification,
    })
  }

  const datasetSha256 = createHash('sha256')
    .update(records.map(record => `${record.path}\0${record.bytes}\0${record.sha256}`).join('\n'))
    .digest('hex')

  return {
    format: FORMAT,
    policy: {
      database: 'own_postgresql_only',
      directImport: 'forbidden',
      publication: 'human_review_required',
      rawChatArchives: 'blocked',
    },
    datasetSha256,
    summary: totals(records),
    files: records,
  }
}

export async function writeManifest({ inputDirectory, outputPath, overwrite = false }) {
  const input = await realpath(inputDirectory)
  const output = path.resolve(outputPath)
  normalizedRelative(input, output)
  const parent = path.dirname(output)
  const parentStats = await stat(parent).catch(() => null)
  if (!parentStats?.isDirectory()) fail('The manifest output directory must already exist')

  const manifest = await buildManifest(input, output)
  const serialized = `${JSON.stringify(manifest, null, 2)}\n`
  await writeFile(output, serialized, { encoding: 'utf8', flag: overwrite ? 'w' : 'wx' })
  return manifest
}

function usage() {
  return [
    'Usage:',
    '  node backend/scripts/build-sorted-data-manifest.js --input sorted_data --output sorted_data/00_documentation_and_indexes/CONTENT_MANIFEST.json',
    '',
    'The output must be inside --input. Existing output is refused unless --overwrite is supplied.',
  ].join('\n')
}

function cliOptions(argumentsList) {
  const options = { inputDirectory: null, outputPath: null, overwrite: false }
  for (let index = 0; index < argumentsList.length; index += 1) {
    const value = argumentsList[index]
    if (value === '--input') options.inputDirectory = argumentsList[++index] ?? null
    else if (value === '--output') options.outputPath = argumentsList[++index] ?? null
    else if (value === '--overwrite') options.overwrite = true
    else if (value === '--help' || value === '-h') return null
    else fail(`Unknown argument: ${value}`)
  }
  if (!options.inputDirectory || !options.outputPath) fail('--input and --output are required')
  return options
}

async function main() {
  try {
    const options = cliOptions(process.argv.slice(2))
    if (!options) {
      console.log(usage())
      return
    }
    const manifest = await writeManifest(options)
    console.log(`Created ${FORMAT}: ${manifest.summary.files} files, ${manifest.summary.bytes} bytes, SHA-256 ${manifest.datasetSha256}`)
  } catch (error) {
    console.error(`Content manifest was not created: ${error.message}`)
    console.error(usage())
    process.exitCode = 64
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  void main()
}
