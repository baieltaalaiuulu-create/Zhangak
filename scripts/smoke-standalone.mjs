import { spawn } from 'node:child_process'
import { access, readFile } from 'node:fs/promises'
import http from 'node:http'
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

async function fetchAsHost(port, host, pathname) {
  return new Promise((resolve, reject) => {
    const request = http.request({
      hostname: '127.0.0.1',
      port,
      path: pathname,
      method: 'GET',
      headers: { Host: host },
      timeout: 5_000,
    }, (response) => {
      const chunks = []
      response.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
      response.on('end', () => {
        const headers = new Headers()
        for (const [name, value] of Object.entries(response.headers)) {
          if (Array.isArray(value)) value.forEach((item) => headers.append(name, item))
          else if (value !== undefined) headers.set(name, value)
        }
        const body = Buffer.concat(chunks).toString('utf8')
        resolve({
          status: response.statusCode ?? 0,
          headers,
          text: async () => body,
        })
      })
    })
    request.once('timeout', () => request.destroy(new Error(`${host}${pathname}: timed out`)))
    request.once('error', reject)
    request.end()
  })
}

async function assertDomainRouting(port) {
  const cases = [
    { host: 'zhangak.com', pathname: '/', status: 200, includes: 'https://platform.zhangak.com/login', excludes: 'landing-login-email' },
    { host: 'zhangak.com', pathname: '/math', status: 200, includes: 'https://platform.zhangak.com/login', excludes: 'type="password"' },
    { host: 'zhangak.com', pathname: '/student/online', status: 308, location: 'https://platform.zhangak.com/student/online' },
    { host: 'platform.zhangak.com', pathname: '/student/online', status: 200, noindex: true },
    { host: 'platform.zhangak.com', pathname: '/student', status: 308, location: 'https://offline.zhangak.com/student', noindex: true },
    { host: 'offline.zhangak.com', pathname: '/', status: 308, location: 'https://offline.zhangak.com/login', noindex: true },
    { host: 'offline.zhangak.com', pathname: '/student', status: 200, noindex: true },
    { host: 'offline.zhangak.com', pathname: '/teacher', status: 200, noindex: true },
    { host: 'platform.zhangak.com', pathname: '/admin', status: 308, location: 'https://admin.zhangak.com/admin', noindex: true },
    { host: 'admin.zhangak.com', pathname: '/', status: 308, location: 'https://admin.zhangak.com/login', noindex: true },
    { host: 'admin.zhangak.com', pathname: '/admin', status: 200, noindex: true },
    { host: 'platform.zhangak.com', pathname: '/platform.webmanifest', status: 200, noindex: true },
  ]

  for (const expected of cases) {
    const response = await fetchAsHost(port, expected.host, expected.pathname)
    if (response.status !== expected.status) {
      throw new Error(`${expected.host}${expected.pathname}: expected ${expected.status}, got ${response.status}`)
    }
    if (expected.location && response.headers.get('location') !== expected.location) {
      throw new Error(`${expected.host}${expected.pathname}: unexpected redirect ${response.headers.get('location')}`)
    }
    const body = await response.text()
    if (expected.includes && !body.includes(expected.includes)) {
      throw new Error(`${expected.host}${expected.pathname}: expected content is missing`)
    }
    if (expected.excludes && body.includes(expected.excludes)) {
      throw new Error(`${expected.host}${expected.pathname}: public page still contains an inline login form`)
    }
    const robots = response.headers.get('x-robots-tag') ?? ''
    if (expected.noindex && !robots.includes('noindex')) {
      throw new Error(`${expected.host}${expected.pathname}: missing noindex header`)
    }
  }

  for (const host of ['platform.zhangak.com', 'offline.zhangak.com', 'admin.zhangak.com']) {
    const response = await fetchAsHost(port, host, '/robots.txt')
    const body = await response.text()
    if (response.status !== 200 || !body.includes('Disallow: /')) {
      throw new Error(`${host}/robots.txt does not disallow indexing`)
    }
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

      let healthyRelease = null
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
          healthyRelease = body.releaseSha
        }
      } catch {
        // Startup races and refused connections are expected while the server boots.
      }

      if (healthyRelease) {
        await assertDomainRouting(port)
        process.stdout.write(
          `${JSON.stringify({ status: 'ok', releaseSha: healthyRelease, port, domainRouting: 'ok' })}\n`,
        )
        return
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
