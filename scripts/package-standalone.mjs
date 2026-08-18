import { execFileSync, spawnSync } from 'node:child_process'
import {
  access,
  cp,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(scriptDirectory, '..')
const nextDirectory = path.join(projectRoot, '.next')
const standaloneDirectory = path.join(nextDirectory, 'standalone')
const allowDirtyRelease = process.env.ALLOW_DIRTY_RELEASE === '1'
const shaPattern = /^[0-9a-f]{7,64}$/i

function fail(message) {
  throw new Error(`Standalone packaging failed: ${message}`)
}

function runGit(args) {
  return execFileSync('git', args, {
    cwd: projectRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
}

function getGitSha() {
  const configuredSha = process.env.ZHANGAK_RELEASE_SHA?.trim()
  const sha = configuredSha || runGit(['rev-parse', 'HEAD'])

  if (!shaPattern.test(sha)) {
    fail('ZHANGAK_RELEASE_SHA or git rev-parse HEAD did not produce a valid commit SHA')
  }

  return sha.toLowerCase()
}

function assertCleanSource() {
  if (allowDirtyRelease) return

  const trackedChanges = spawnSync(
    'git',
    ['status', '--porcelain=v1', '--untracked-files=normal'],
    {
      cwd: projectRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )

  if (trackedChanges.status !== 0) {
    fail('git status could not verify the source tree')
  }

  if (trackedChanges.stdout.trim()) {
    fail('the Git worktree is not clean; commit the exact source before creating a release')
  }
}

async function assertReadable(target, label) {
  try {
    await access(target)
  } catch {
    fail(`${label} is missing: ${path.relative(projectRoot, target)}`)
  }
}

function assertDestinationIsGenerated(target) {
  const relative = path.relative(standaloneDirectory, target)
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    fail(`refusing to replace an unsafe destination: ${target}`)
  }
}

async function replaceDirectory(source, destination) {
  assertDestinationIsGenerated(destination)
  await rm(destination, { force: true, recursive: true })
  await mkdir(path.dirname(destination), { recursive: true })
  await cp(source, destination, {
    dereference: false,
    force: true,
    preserveTimestamps: true,
    recursive: true,
  })
}

async function assertNoRootSecrets() {
  const entries = await readdir(standaloneDirectory, { withFileTypes: true })
  const forbidden = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter(
      (name) =>
        /^\.env(?:\.|$)/i.test(name) ||
        /\.(?:key|pem|p12|pfx)$/i.test(name) ||
        /^(?:credentials|service-account)\.json$/i.test(name),
    )

  if (forbidden.length > 0) {
    fail(`possible secret files found in standalone root: ${forbidden.join(', ')}`)
  }
}

async function main() {
  assertCleanSource()

  const serverFile = path.join(standaloneDirectory, 'server.js')
  const publicDirectory = path.join(projectRoot, 'public')
  const staticDirectory = path.join(nextDirectory, 'static')
  const buildIdFile = path.join(nextDirectory, 'BUILD_ID')

  await Promise.all([
    assertReadable(serverFile, 'standalone server'),
    assertReadable(publicDirectory, 'public directory'),
    assertReadable(staticDirectory, 'Next.js static directory'),
    assertReadable(buildIdFile, 'Next.js build ID'),
  ])

  await assertNoRootSecrets()
  await replaceDirectory(publicDirectory, path.join(standaloneDirectory, 'public'))
  await replaceDirectory(staticDirectory, path.join(standaloneDirectory, '.next', 'static'))

  const gitSha = getGitSha()
  const serviceWorkerPath = path.join(standaloneDirectory, 'public', 'sw.js')
  try {
    const serviceWorker = await readFile(serviceWorkerPath, 'utf8')
    const placeholder = '__ZHANGAK_RELEASE_SHA__'
    if (!serviceWorker.includes(placeholder)) {
      fail('public/sw.js does not contain the release SHA placeholder')
    }
    await writeFile(serviceWorkerPath, serviceWorker.replaceAll(placeholder, gitSha), 'utf8')
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Standalone packaging failed:')) throw error
    fail('could not stamp public/sw.js with the release SHA')
  }

  const manifest = {
    gitSha,
    deploymentId: gitSha,
    buildId: (await readFile(buildIdFile, 'utf8')).trim(),
    node: process.version,
  }

  if (!manifest.buildId) fail('Next.js BUILD_ID is empty')

  const manifestPath = path.join(standaloneDirectory, 'release.json')
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, {
    encoding: 'utf8',
    mode: 0o644,
  })

  process.stdout.write(`${JSON.stringify({ artifact: standaloneDirectory, ...manifest })}\n`)
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})
