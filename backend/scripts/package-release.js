import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repoRoot = path.resolve(backendRoot, '..')
const output = path.join(backendRoot, 'dist', 'release')

function git(...args) {
  const result = spawnSync('git', args, { cwd: repoRoot, encoding: 'utf8' })
  if (result.status !== 0) throw new Error(result.stderr.trim() || `git ${args.join(' ')} failed`)
  return result.stdout.trim()
}

const trackedChanges = git('status', '--porcelain', '--untracked-files=no')
if (trackedChanges) throw new Error('Tracked worktree changes must be committed before packaging the API')
const gitSha = git('rev-parse', 'HEAD')
const requiredNode = (await readFile(path.join(repoRoot, '.node-version'), 'utf8')).trim()

await rm(output, { recursive: true, force: true })
await mkdir(output, { recursive: true })
// Keep the release self-checkable: `npm run check` scans the test tree too.
// Tests contain no production secrets and make the immutable artifact verifiable
// before the service is switched.
for (const entry of ['package.json', 'package-lock.json', 'src', 'migrations', 'test']) {
  await cp(path.join(backendRoot, entry), path.join(output, entry), { recursive: true })
}
await mkdir(path.join(output, 'scripts'), { recursive: true })
for (const script of [
  'migrate.js',
  'check-syntax.js',
  'create-super-admin.js',
  'supabase-migration-preflight.js',
  'import-supabase-demo-content.js',
]) {
  await cp(path.join(backendRoot, 'scripts', script), path.join(output, 'scripts', script))
}
await writeFile(path.join(output, 'release.json'), `${JSON.stringify({ gitSha, requiredNode }, null, 2)}\n`)
console.log(JSON.stringify({ output, gitSha, requiredNode }))
