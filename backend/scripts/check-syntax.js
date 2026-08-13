import { readdir } from 'node:fs/promises'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

async function collect(directory) {
  const files = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const child = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await collect(child))
    else if (entry.isFile() && entry.name.endsWith('.js')) files.push(child)
  }
  return files
}

const files = [
  ...(await collect(path.join(root, 'src'))),
  ...(await collect(path.join(root, 'scripts'))),
  ...(await collect(path.join(root, 'test'))),
].filter(file => !file.endsWith(`${path.sep}check-syntax.js`))

for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' })
  if (result.status !== 0) process.exit(result.status ?? 1)
}
console.log(`Syntax check passed (${files.length} files).`)
