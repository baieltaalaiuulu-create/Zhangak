import { access, readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(scriptDirectory, '..')
const staticDirectory = path.join(projectRoot, '.next', 'static')
const canary = process.env.PRIVATE_SECRET_CANARY?.trim() ?? ''
const requireCanary = process.env.REQUIRE_PRIVATE_SECRET_CANARY === '1'

const knownServerSecretNames = [
  'DATABASE_URL',
  'OPENAI_API_KEY',
  'GROQ_API_KEY',
  'GEMINI_API_KEY',
  'ANTHROPIC_API_KEY',
  'DEEPSEEK_API_KEY',
  'STRIPE_SECRET_KEY',
  'AWS_SECRET_ACCESS_KEY',
  'PRIVATE_SECRET_CANARY',
]

async function walk(directory) {
  const files = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await walk(target))
    else if (entry.isFile()) files.push(target)
  }
  return files
}

function relative(file) {
  return path.relative(projectRoot, file).replaceAll(path.sep, '/')
}

async function main() {
  try {
    await access(staticDirectory)
  } catch {
    throw new Error('Missing .next/static; run the production build before checking client secrets')
  }

  if (requireCanary && !canary) {
    throw new Error('PRIVATE_SECRET_CANARY is required when REQUIRE_PRIVATE_SECRET_CANARY=1')
  }
  if (canary && canary.length < 16) {
    throw new Error('PRIVATE_SECRET_CANARY must contain at least 16 characters')
  }

  const failures = []
  const files = await walk(staticDirectory)

  for (const file of files) {
    const source = await readFile(file, 'utf8')
    const upperSource = source.toUpperCase()
    const matches = knownServerSecretNames.filter((name) => upperSource.includes(name))

    if (canary && source.includes(canary)) matches.push('PRIVATE_SECRET_CANARY_VALUE')
    if (matches.length > 0) {
      failures.push(`${relative(file)}: ${[...new Set(matches)].join(', ')}`)
    }
  }

  if (failures.length > 0) {
    console.error(`Client secret scan failed (${failures.length} files):`)
    for (const failure of failures) console.error(`- ${failure}`)
    process.exitCode = 1
    return
  }

  console.log(
    `Client secret scan passed (${files.length} static files, ${knownServerSecretNames.length} server-only names${canary ? ', canary enabled' : ''}).`,
  )
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
