import { spawn } from 'node:child_process'
import { access, readFile } from 'node:fs/promises'
import net from 'node:net'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(scriptDirectory, '..')
const standaloneDirectory = path.resolve(
  projectRoot,
  process.argv[2] ?? path.join('.next', 'standalone'),
)
const timeoutMs = Number.parseInt(process.env.SMOKE_TIMEOUT_MS ?? '30000', 10)
const shaPattern = /^[0-9a-f]{7,64}$/i

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

async function getFreePort() {
  const server = net.createServer()

  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })

  const address = server.address()
  const port = typeof address === 'object' && address ? address.port : null
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))

  if (!port) throw new Error('Could not allocate a local smoke-test port')
  return port
}

async function stopChild(child, exitPromise) {
  if (child.exitCode !== null || child.signalCode !== null) return

  child.kill('SIGTERM')
  await Promise.race([exitPromise, delay(5_000)])

  if (child.exitCode === null && child.signalCode === null) {
    child.kill('SIGKILL')
    await exitPromise
  }
}

async function main() {
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1_000) {
    throw new Error('SMOKE_TIMEOUT_MS must be an integer of at least 1000')
  }

  const serverFile = path.join(standaloneDirectory, 'server.js')
  const manifestFile = path.join(standaloneDirectory, 'release.json')
  await Promise.all([access(serverFile), access(manifestFile)])

  const manifest = JSON.parse(await readFile(manifestFile, 'utf8'))
  if (!shaPattern.test(manifest.gitSha ?? '')) {
    throw new Error('release.json does not contain a valid gitSha')
  }

  const port = await getFreePort()
  const child = spawn(process.execPath, ['server.js'], {
    cwd: standaloneDirectory,
    env: {
      ...process.env,
      HOSTNAME: '127.0.0.1',
      NODE_ENV: 'production',
      PORT: String(port),
      ZHANGAK_RELEASE_SHA: manifest.gitSha,
    },
    stdio: 'ignore',
    windowsHide: true,
  })

  let spawnError = null
  child.once('error', (error) => {
    spawnError = error
  })
  const exitPromise = new Promise((resolve) => child.once('exit', resolve))
  const deadline = Date.now() + timeoutMs

  try {
    while (Date.now() < deadline) {
      if (spawnError) throw spawnError
      if (child.exitCode !== null) {
        throw new Error(`Standalone server exited early with code ${child.exitCode}`)
      }

      try {
        const response = await fetch(`http://127.0.0.1:${port}/api/health`, {
          cache: 'no-store',
          signal: AbortSignal.timeout(2_000),
        })
        const body = await response.json()

        if (
          response.ok &&
          body.status === 'ok' &&
          body.releaseSha === manifest.gitSha.toLowerCase()
        ) {
          process.stdout.write(
            `${JSON.stringify({ status: 'ok', releaseSha: body.releaseSha, port })}\n`,
          )
          return
        }
      } catch {
        // Startup races and refused connections are expected while the server boots.
      }

      await delay(250)
    }

    throw new Error(`Health check did not pass within ${timeoutMs}ms`)
  } finally {
    await stopChild(child, exitPromise)
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})
