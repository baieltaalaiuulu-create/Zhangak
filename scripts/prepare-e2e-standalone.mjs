// Populate the standalone runtime exactly as Next expects for browser e2e
// tests. This intentionally does not stamp a release manifest or permit a
// production deployment; that remains package-standalone.mjs.
import { access, cp, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const standalone = path.join(root, '.next', 'standalone')

async function copyRequired(source, destination) {
  await access(source)
  await mkdir(path.dirname(destination), { recursive: true })
  await cp(source, destination, { recursive: true, force: true })
}

await access(path.join(standalone, 'server.js'))
await copyRequired(path.join(root, 'public'), path.join(standalone, 'public'))
await copyRequired(path.join(root, '.next', 'static'), path.join(standalone, '.next', 'static'))
