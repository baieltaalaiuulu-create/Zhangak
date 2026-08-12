import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(scriptDirectory, '..')
const baselinePath = path.join(scriptDirectory, 'emoji-baseline.json')
const textExtensions = new Set([
  '.cjs', '.css', '.html', '.js', '.jsx', '.json', '.md', '.mjs', '.scss',
  '.svg', '.ts', '.tsx', '.txt', '.webmanifest', '.xml',
])
const pictographPattern = /\p{Extended_Pictographic}/gu

async function walk(directory) {
  const files = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await walk(target))
    else if (entry.isFile() && textExtensions.has(path.extname(entry.name).toLowerCase())) files.push(target)
  }
  return files
}

function relative(file) {
  return path.relative(projectRoot, file).replaceAll(path.sep, '/')
}

async function main() {
  const baseline = JSON.parse(await readFile(baselinePath, 'utf8'))
  if (baseline.version !== 1 || !Array.isArray(baseline.roots) || typeof baseline.files !== 'object') {
    throw new Error('scripts/emoji-baseline.json has an unsupported format')
  }

  const baselineTotal = Object.values(baseline.files).reduce((sum, count) => sum + count, 0)
  if (baselineTotal !== baseline.total) {
    throw new Error(`Emoji baseline total is inconsistent: expected ${baseline.total}, found ${baselineTotal}`)
  }

  const files = (await Promise.all(
    baseline.roots.map((root) => walk(path.join(projectRoot, root))),
  )).flat()
  const actual = new Map()

  for (const file of files) {
    const source = await readFile(file, 'utf8')
    const count = [...source.matchAll(pictographPattern)].length
    if (count > 0) actual.set(relative(file), count)
  }

  const failures = []
  const actualTotal = [...actual.values()].reduce((sum, count) => sum + count, 0)
  if (actualTotal > baseline.total) {
    failures.push(`total pictographs increased from ${baseline.total} to ${actualTotal}`)
  }

  for (const [file, count] of [...actual.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const allowed = baseline.files[file] ?? 0
    if (count > allowed) failures.push(`${file}: ${count} found, baseline allows ${allowed}`)
  }

  if (failures.length > 0) {
    console.error(`Emoji regression check failed (${failures.length}):`)
    for (const failure of failures) console.error(`- ${failure}`)
    console.error('Replace new pictographs with the project icon library; do not raise the baseline.')
    process.exitCode = 1
    return
  }

  const removed = baseline.total - actualTotal
  console.log(
    `Emoji regression check passed (${actualTotal}/${baseline.total} pictographs; ${removed} removed from debt).`,
  )
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
