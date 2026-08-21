import { access, readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const failures = []

const removedPaths = [
  'app/student/online/ai/page.tsx',
  'app/admin/knowledge-base/page.tsx',
  'components/student/mobile/MobileAIHelp.tsx',
  'components/student/ai/AITypingIndicator.tsx',
  'lib/ai-gateway.ts',
  'lib/ai-quick-ask.ts',
  'mobile/app/(student)/ai.tsx',
  'backend/src/ai.js',
  'backend/src/routes/platform-ai.js',
]

const forbidden = [
  'ai-gateway', 'ai-quick-ask',
  'AI_ENABLED', 'AI_PROVIDER', 'AI_FALLBACK_PROVIDER', 'DEEPSEEK_',
  'OPENAI_API_KEY', 'GROQ_API_KEY', 'GEMINI_API_KEY', 'OLLAMA_',
  'AI-коуч', 'AI-наставник',
]

async function exists(relativePath) {
  try { await access(path.join(root, relativePath)); return true } catch { return false }
}

async function collect(relativePath) {
  if (!(await exists(relativePath))) return []
  const entries = await readdir(path.join(root, relativePath), { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const child = path.join(relativePath, entry.name)
    if (entry.isDirectory()) files.push(...await collect(child))
    else if (entry.isFile() && /\.(?:[cm]?[jt]sx?|json|mjs|md|env)$/i.test(entry.name)) files.push(child)
  }
  return files
}

async function main() {
  for (const relativePath of removedPaths) if (await exists(relativePath)) failures.push(`${relativePath} must stay removed`)

  const roots = ['app', 'components', 'lib', 'mobile/app', 'mobile/components', 'mobile/lib', 'backend/src', 'backend/test', 'deploy']
  const files = ['.env.example', 'package.json', 'proxy.ts', ...await Promise.all(roots.map(collect)).then(groups => groups.flat())]
  for (const relativePath of files) {
    const content = await readFile(path.join(root, relativePath), 'utf8')
    for (const token of forbidden) if (content.includes(token)) failures.push(`${relativePath} still contains ${token}`)
  }

  if (failures.length > 0) {
    console.error(`No-product-AI check failed (${failures.length}):`)
    for (const failure of failures) console.error(`- ${failure}`)
    process.exitCode = 1
    return
  }
  console.log(`No-product-AI check passed (${files.length} scanned files).`)
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
