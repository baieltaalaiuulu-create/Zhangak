import { createHash, randomUUID } from 'node:crypto'
import { readdir, readFile, realpath, stat } from 'node:fs/promises'
import { basename, extname, relative, resolve, sep } from 'node:path'

const SOURCE_SYSTEM = 'sorted_data_reviewed_pdfs_v1'
const ALLOWED_DIRECTORIES = [
  '01_mathematics/level_b1_b2_modules',
  '01_mathematics/topic_modules',
  '02_kyrgyz_language/grammar_and_morphology',
  '03_analogies/logical_connections',
]

const EXPECTED_PDF_COUNT = 34
const MAX_PDF_BYTES = 200 * 1024 * 1024

function fail(message) {
  throw new Error(`Reviewed material importer blocked: ${message}`)
}

function normalizedRelative(value) {
  return value.split(sep).join('/')
}

function titleFromFilename(filename) {
  return basename(filename, extname(filename))
    .replace(/[_]+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim()
}

function lessonTarget(relativePath) {
  if (relativePath.startsWith('02_kyrgyz_language/')) return { courseCode: 'demo-ort-kyr', lessonNumber: 3 }
  if (relativePath.startsWith('03_analogies/')) {
    return /2022|Настоящие|ЦООМО/iu.test(relativePath)
      ? { courseCode: 'demo-ort-kyr', lessonNumber: 1 }
      : { courseCode: 'demo-ort-kyr', lessonNumber: 2 }
  }
  if (/ТРЕУГОЛЬНИК|ПИФАГОР|ПЛОЩАДЬ|ПРЯМОУГОЛЬНИК|КВАДРАТ|ПАРАЛЛЕЛОГРАММ|ТРАПЕЦИЯ/iu.test(relativePath)) {
    return { courseCode: 'demo-ort-math', lessonNumber: 3 }
  }
  if (/Декартова|Формулы|Степень/iu.test(relativePath)) return { courseCode: 'demo-ort-math', lessonNumber: 2 }
  return { courseCode: 'demo-ort-math', lessonNumber: 1 }
}

async function filesIn(directory) {
  const items = await readdir(directory, { withFileTypes: true })
  const files = []
  for (const item of items) {
    const path = resolve(directory, item.name)
    if (item.isDirectory()) files.push(...await filesIn(path))
    else if (item.isFile() && extname(item.name).toLowerCase() === '.pdf') files.push(path)
  }
  return files
}

async function approvedPath(root, directory, file) {
  const approvedDirectory = await realpath(resolve(root, directory))
  const actual = await realpath(file)
  const inside = relative(approvedDirectory, actual)
  if (!inside || inside === '..' || inside.startsWith(`..${sep}`)) fail(`path escapes allowlist: ${file}`)
  if (normalizedRelative(actual).includes('/06_chat_exports_and_history/')) fail('chat exports are forbidden')
  return actual
}

export async function buildReviewedMaterialPlan(sourceRoot) {
  if (!sourceRoot || !resolve(sourceRoot)) fail('source root is required')
  const root = await realpath(resolve(sourceRoot))
  const paths = []
  for (const directory of ALLOWED_DIRECTORIES) {
    for (const file of await filesIn(resolve(root, directory))) paths.push(await approvedPath(root, directory, file))
  }
  paths.sort((left, right) => left.localeCompare(right, 'ru'))
  if (paths.length !== EXPECTED_PDF_COUNT) fail(`allowlist contains ${paths.length} PDFs; expected ${EXPECTED_PDF_COUNT}`)

  const materials = []
  for (const path of paths) {
    const metadata = await stat(path)
    if (metadata.size < 5 || metadata.size > MAX_PDF_BYTES) fail(`invalid PDF size: ${path}`)
    const bytes = await readFile(path)
    if (bytes.subarray(0, 5).toString('ascii') !== '%PDF-') fail(`invalid PDF signature: ${path}`)
    const relativePath = normalizedRelative(relative(root, path))
    materials.push({
      sourceId: relativePath,
      sourcePath: path,
      title: titleFromFilename(path),
      byteSize: metadata.size,
      contentSha256: createHash('sha256').update(bytes).digest('hex'),
      ...lessonTarget(relativePath),
    })
  }
  return { sourceSystem: SOURCE_SYSTEM, materials }
}

export function reviewedMaterialSummary(plan) {
  return {
    sourceSystem: plan.sourceSystem,
    materialCount: plan.materials.length,
    totalBytes: plan.materials.reduce((total, item) => total + item.byteSize, 0),
    courses: [...new Set(plan.materials.map(item => item.courseCode))].sort(),
  }
}

export function materialStorageKey(lessonId) {
  if (!Number.isSafeInteger(lessonId) || lessonId < 1) fail('invalid lesson id')
  return `lesson/${lessonId}/${randomUUID().replaceAll('-', '')}`
}

export const REVIEWED_MATERIAL_IMPORT = Object.freeze({
  sourceSystem: SOURCE_SYSTEM,
  expectedPdfCount: EXPECTED_PDF_COUNT,
  allowedDirectories: [...ALLOWED_DIRECTORIES],
})
