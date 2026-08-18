import { access, readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const failures = []
const sourceRoots = ['app', 'components', 'lib']
const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs'])
const forbiddenImport = /(?:from\s*['"][^'"]*(?:@supabase|supabase)[^'"]*['"]|require\s*\(\s*['"][^'"]*(?:@supabase|supabase)[^'"]*['"]|import\s*\(\s*['"][^'"]*(?:@supabase|supabase)[^'"]*['"])/i

function relative(file) {
  return path.relative(root, file).replaceAll(path.sep, '/')
}

async function exists(file) {
  try {
    await access(path.join(root, file))
    return true
  } catch {
    return false
  }
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const target = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await walk(target))
    else if (entry.isFile() && sourceExtensions.has(path.extname(entry.name))) files.push(target)
  }
  return files
}

function expect(condition, message) {
  if (!condition) failures.push(message)
}

async function checkSourceImports() {
  const files = (await Promise.all(sourceRoots.map(directory => walk(path.join(root, directory))))).flat()
  for (const file of files) {
    const source = await readFile(file, 'utf8')
    expect(!forbiddenImport.test(source), `${relative(file)}: web source must not import the retired Supabase SDK`)
  }
  expect(!await exists('lib/supabase.ts'), 'lib/supabase.ts: retired browser data client must remain deleted')
  expect(!await exists('lib/api-auth.ts'), 'lib/api-auth.ts: retired bearer authorization helper must remain deleted')
  expect(!await exists('lib/practice-data.ts'), 'lib/practice-data.ts: retired browser-scored practice reader must remain deleted')
  return files.length
}

async function checkConfiguration() {
  const [manifest, lock, localExample, deployExample, ci, worker] = await Promise.all([
    readFile(path.join(root, 'package.json'), 'utf8'),
    readFile(path.join(root, 'package-lock.json'), 'utf8'),
    readFile(path.join(root, '.env.example'), 'utf8'),
    readFile(path.join(root, 'deploy/zhangak.env.example'), 'utf8'),
    readFile(path.join(root, '.github/workflows/ci.yml'), 'utf8'),
    readFile(path.join(root, 'public/sw.js'), 'utf8'),
  ])
  expect(!/@supabase\//i.test(manifest), 'package.json: retired Supabase dependencies must not return')
  expect(!/@supabase\//i.test(lock), 'package-lock.json: retired Supabase dependency tree must not return')
  for (const [file, source] of [
    ['.env.example', localExample],
    ['deploy/zhangak.env.example', deployExample],
    ['.github/workflows/ci.yml', ci],
  ]) {
    expect(!/NEXT_PUBLIC_SUPABASE|SUPABASE_/i.test(source), `${file}: Supabase runtime variables must remain absent`)
  }
  expect(!/supabase/i.test(worker), 'public/sw.js: cache rules must reference only first-party API routes')
}

const sourceFileCount = await checkSourceImports()
await checkConfiguration()

if (failures.length > 0) {
  console.error(`First-party web data-plane check failed (${failures.length}):`)
  for (const failure of failures) console.error(`- ${failure}`)
  process.exitCode = 1
} else {
  console.log(`First-party web data-plane check passed (${sourceFileCount} source files, no SDK or runtime configuration).`)
}
