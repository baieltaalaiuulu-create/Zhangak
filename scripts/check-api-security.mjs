import { access, readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const failures = []

// The old `/api/*` handlers authenticated against Supabase. Product traffic
// now goes through the cookie-authenticated `/v1/*` BFF, so health is the
// only App Router API endpoint that may remain in this namespace.
const allowedAppApiRoutes = new Set(['app/api/health/route.ts'])
const retiredRouteFiles = [
  'app/api/admin/analytics-insights/route.ts',
  'app/api/admin/announcements/route.ts',
  'app/api/admin/daily-challenge/generate/route.ts',
  'app/api/admin/daily-challenge/questions/route.ts',
  'app/api/admin/daily-challenge/route.ts',
  'app/api/admin/ensure-practice-test/route.ts',
  'app/api/admin/group-students/route.ts',
  'app/api/admin/knowledge-base/route.ts',
  'app/api/admin/lessons/route.ts',
  'app/api/admin/practice-tests/route.ts',
  'app/api/admin/prizes/route.ts',
  'app/api/admin/questions/route.ts',
  'app/api/admin/reset-password/route.ts',
  'app/api/admin/settings/route.ts',
  'app/api/admin/universities/route.ts',
  'app/api/admin/university-specialties/route.ts',
  'app/api/ai-mentor/route.ts',
  'app/api/block-user/route.ts',
  'app/api/create-user/route.ts',
  'app/api/delete-own-account/route.ts',
  'app/api/delete-user/route.ts',
  'app/api/list-users/route.ts',
  'app/api/practice/route.ts',
  'app/api/teacher/route.ts',
]
const retiredPrefixes = [
  '/api/admin',
  '/api/block-user',
  '/api/create-user',
  '/api/delete-user',
  '/api/list-users',
  '/api/delete-own-account',
  '/api/ai-mentor',
  '/api/practice',
  '/api/teacher',
]

async function walk(directory) {
  const result = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name)
    if (entry.isDirectory()) result.push(...await walk(fullPath))
    else result.push(fullPath)
  }
  return result
}

function relative(file) {
  return path.relative(repoRoot, file).replaceAll(path.sep, '/')
}

async function exists(file) {
  try {
    await access(path.join(repoRoot, file))
    return true
  } catch {
    return false
  }
}

function expect(condition, message) {
  if (!condition) failures.push(message)
}

async function checkAppApiRetirement() {
  const apiRoot = path.join(repoRoot, 'app', 'api')
  const files = await walk(apiRoot)
  const routeFiles = files
    .filter(file => /(?:^|[\\/])route\.(?:ts|tsx|js|jsx)$/.test(file))
    .map(relative)
    .sort()

  const unexpected = routeFiles.filter(file => !allowedAppApiRoutes.has(file))
  if (unexpected.length > 0) {
    failures.push(`app/api must contain only the health route; found ${unexpected.join(', ')}`)
  }
  for (const route of allowedAppApiRoutes) {
    expect(routeFiles.includes(route), `${route}: shared health endpoint is missing`)
  }
  for (const route of retiredRouteFiles) {
    expect(!await exists(route), `${route}: retired Supabase handler must remain deleted`)
  }

  for (const file of files.filter(file => /\.(?:ts|tsx|js|jsx)$/.test(file))) {
    const source = await readFile(file, 'utf8')
    expect(!/@supabase|supabase(?:[-./]|\b)/i.test(source), `${relative(file)}: App Router API must not depend on Supabase`)
  }
}

async function checkRetiredApiProxyContract() {
  const proxy = await readFile(path.join(repoRoot, 'proxy.ts'), 'utf8')
  expect(proxy.includes("'retired-api'"), 'proxy.ts must classify retired legacy APIs explicitly')
  expect(proxy.includes('RETIRED_LEGACY_API_PREFIXES'), 'proxy.ts must keep the retired API deny-list')
  expect(!proxy.includes('ADMIN_API_PREFIXES') && !proxy.includes('PLATFORM_API_PREFIXES'), 'proxy.ts must not route retired APIs to a workspace')
  for (const prefix of retiredPrefixes) {
    expect(proxy.includes(`'${prefix}'`), `proxy.ts must deny ${prefix}`)
  }
  expect(
    /if\s*\(\s*requiredSurface\s*===\s*'retired-api'\s*\)\s*return\s+wrongApiSurface\(surface\)/.test(proxy),
    'retired APIs must return a direct 404 on every owned host',
  )
}

async function checkFirstPartyBffBoundary() {
  const [authProxy, apiProxy] = await Promise.all([
    readFile(path.join(repoRoot, 'app/v1/auth/[action]/route.ts'), 'utf8'),
    readFile(path.join(repoRoot, 'app/v1/[...path]/route.ts'), 'utf8'),
  ])
  expect(!/supabase/i.test(`${authProxy}\n${apiProxy}`), '/v1 BFF routes must not import or call Supabase')
  expect(apiProxy.includes("new Set(['platform', 'admin'])"), '/v1 BFF must expose only first-party platform and admin namespaces')
}

await checkAppApiRetirement()
await checkRetiredApiProxyContract()
await checkFirstPartyBffBoundary()

if (failures.length > 0) {
  console.error(`API security regression check failed (${failures.length}):`)
  for (const failure of failures) console.error(`- ${failure}`)
  process.exitCode = 1
} else {
  console.log(`API security regression check passed (${allowedAppApiRoutes.size} App Router health route, ${retiredRouteFiles.length} retired Supabase routes).`)
}
