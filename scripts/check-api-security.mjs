import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const failures = []
const publicRoutes = new Set(['app/api/health/route.ts'])

const protectedRoutes = {
  'app/api/admin/analytics-insights/route.ts': roleGuard('FULL_ADMIN_ROLES'),
  'app/api/admin/announcements/route.ts': adminGuard(),
  'app/api/admin/daily-challenge/generate/route.ts': adminGuard(),
  'app/api/admin/daily-challenge/questions/route.ts': adminGuard(),
  'app/api/admin/daily-challenge/route.ts': adminGuard(),
  'app/api/admin/ensure-practice-test/route.ts': adminGuard(),
  'app/api/admin/group-students/route.ts': adminGuard(),
  'app/api/admin/knowledge-base/route.ts': adminGuard(),
  'app/api/admin/lessons/route.ts': adminGuard('requireContentAdminApi'),
  'app/api/admin/practice-tests/route.ts': adminGuard('requireContentAdminApi'),
  'app/api/admin/prizes/route.ts': adminGuard(),
  'app/api/admin/questions/route.ts': adminGuard('requireContentAdminApi'),
  'app/api/admin/reset-password/route.ts': roleGuard('ACCOUNT_MANAGER_ROLES'),
  'app/api/admin/settings/route.ts': adminGuard(),
  'app/api/admin/universities/route.ts': adminGuard(),
  'app/api/admin/university-specialties/route.ts': adminGuard(),
  'app/api/ai-mentor/route.ts': bearerGuard(),
  'app/api/block-user/route.ts': roleGuard('ACCOUNT_MANAGER_ROLES'),
  'app/api/create-user/route.ts': roleGuard('ACCOUNT_CREATOR_ROLES'),
  'app/api/delete-own-account/route.ts': ownAccountGuard(),
  'app/api/delete-user/route.ts': roleGuard('ACCOUNT_MANAGER_ROLES'),
  'app/api/list-users/route.ts': roleGuard('ACCOUNT_MANAGER_ROLES'),
  'app/api/practice/route.ts': bearerGuard(),
  'app/api/teacher/route.ts': roleGuard('TEACHER_ROLES'),
}

function adminGuard(helper = 'requireAdminApi') {
  return {
    description: `${helper}(request) followed by an early rejection return`,
    assert(body) {
      const call = body.match(new RegExp(`(?:const|let)\\s+(\\w+)\\s*=\\s*await\\s+${helper}\\s*\\(\\s*\\w+\\s*\\)`))
      if (!call) return false
      return new RegExp(`if\\s*\\(\\s*${call[1]}\\s*\\)\\s*return\\s+${call[1]}`).test(body)
    },
  }
}

function roleGuard(roleConstant) {
  return {
    description: `requireRoleAuth(request, ${roleConstant}) followed by an early rejection return`,
    assert(body) {
      const call = body.match(new RegExp(`(?:const|let)\\s+(\\w+)\\s*=\\s*await\\s+requireRoleAuth\\s*\\(\\s*\\w+\\s*,\\s*${roleConstant}\\s*\\)`))
      if (!call) return false
      return new RegExp(`if\\s*\\(\\s*!${call[1]}\\.authorized\\s*\\)\\s*return\\s+${call[1]}\\.response`).test(body)
    },
  }
}

function bearerGuard(roleConstant) {
  return {
    description: roleConstant
      ? `requireBearerAuth(request, ${roleConstant}) followed by an early rejection return`
      : 'requireBearerAuth(request) followed by an early rejection return',
    assert(body) {
      const role = roleConstant ? `\\s*,\\s*${roleConstant}` : ''
      const call = body.match(new RegExp(`(?:const|let)\\s+(\\w+)\\s*=\\s*await\\s+requireBearerAuth\\s*\\(\\s*\\w+${role}\\s*\\)`))
      if (!call) return false
      return new RegExp(`if\\s*\\(\\s*!${call[1]}\\.authorized\\s*\\)\\s*return\\s+${call[1]}\\.response`).test(body)
    },
  }
}

function ownAccountGuard() {
  return {
    description: 'an Authorization bearer token verified with auth.getUser before deletion',
    assert(body) {
      const header = body.search(/headers\.get\(\s*['"]authorization['"]\s*\)/i)
      const tokenCheck = body.search(/if\s*\(\s*!token\s*\)\s*return[\s\S]{0,180}status:\s*401/)
      const verification = body.search(/\.auth\.getUser\(\s*token\s*\)/)
      const deletion = firstIndex(body, [/\.auth\.admin\.deleteUser\s*\(/, /\.from\(\s*['"][^'"]+['"]\s*\)\.delete\s*\(/])
      return header >= 0 && tokenCheck > header && verification > tokenCheck && deletion > verification
    },
  }
}

function firstIndex(source, patterns) {
  const indexes = patterns.map(pattern => source.search(pattern)).filter(index => index >= 0)
  return indexes.length === 0 ? Number.POSITIVE_INFINITY : Math.min(...indexes)
}

function extractHandlers(source, file) {
  const handlers = []
  const declaration = /export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)\s*\([^)]*\)[^{]*\{/g
  for (const match of source.matchAll(declaration)) {
    const openBrace = match.index + match[0].lastIndexOf('{')
    const closeBrace = findMatchingBrace(source, openBrace)
    if (closeBrace < 0) {
      failures.push(`${file}: could not parse the ${match[1]} handler body`)
      continue
    }
    handlers.push({ method: match[1], body: source.slice(openBrace + 1, closeBrace) })
  }
  return handlers
}

function findMatchingBrace(source, openBrace) {
  let depth = 0
  let quote = null
  let escaped = false
  let lineComment = false
  let blockComment = false

  for (let index = openBrace; index < source.length; index += 1) {
    const char = source[index]
    const next = source[index + 1]

    if (lineComment) {
      if (char === '\n') lineComment = false
      continue
    }
    if (blockComment) {
      if (char === '*' && next === '/') {
        blockComment = false
        index += 1
      }
      continue
    }
    if (quote) {
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === quote) quote = null
      continue
    }
    if (char === '/' && next === '/') {
      lineComment = true
      index += 1
      continue
    }
    if (char === '/' && next === '*') {
      blockComment = true
      index += 1
      continue
    }
    if (char === "'" || char === '"' || char === '`') {
      quote = char
      continue
    }
    if (char === '{') depth += 1
    if (char === '}') {
      depth -= 1
      if (depth === 0) return index
    }
  }
  return -1
}

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

async function checkServerRoutes() {
  const actualRoutes = (await walk(path.join(repoRoot, 'app', 'api')))
    .filter(file => file.endsWith(`${path.sep}route.ts`))
    .map(relative)
    .sort()
  const classifiedRoutes = Object.keys(protectedRoutes).sort()

  for (const file of actualRoutes.filter(file => !protectedRoutes[file] && !publicRoutes.has(file))) {
    failures.push(`${file}: API route is not classified in scripts/check-api-security.mjs`)
  }
  for (const file of classifiedRoutes.filter(file => !actualRoutes.includes(file))) {
    failures.push(`${file}: protected route manifest entry points to a missing file`)
  }

  for (const [file, guard] of Object.entries(protectedRoutes)) {
    let source
    try {
      source = await readFile(path.join(repoRoot, file), 'utf8')
    } catch {
      continue
    }
    const handlers = extractHandlers(source, file)
    if (handlers.length === 0) {
      failures.push(`${file}: no exported HTTP handlers found`)
      continue
    }
    for (const handler of handlers) {
      if (!guard.assert(handler.body)) {
        failures.push(`${file} ${handler.method}: expected ${guard.description}`)
      }
    }
  }
}

async function checkProtectedClientCalls() {
  const protectedPaths = new Set(
    Object.keys(protectedRoutes).map(file => `/${file.replace(/^app\//, '').replace(/\/route\.ts$/, '')}`),
  )
  const roots = ['app', 'components', 'lib']
  const sourceFiles = (
    await Promise.all(roots.map(root => walk(path.join(repoRoot, root))))
  ).flat().filter(file => /\.(?:ts|tsx|js|jsx|mjs)$/.test(file))
  const callPattern = /\b(authenticatedFetch|fetch)\s*\(\s*(['"`])(\/api\/[^'"`\s?#]+)(?:[?#][^'"`]*)?\2/g

  for (const filePath of sourceFiles) {
    const source = await readFile(filePath, 'utf8')
    const file = relative(filePath)
    for (const match of source.matchAll(callPattern)) {
      const [, caller, , apiPath] = match
      if (!protectedPaths.has(apiPath)) continue
      if (caller === 'authenticatedFetch') continue

      if (apiPath === '/api/delete-own-account') {
        const surroundingSource = source.slice(Math.max(0, match.index - 500), match.index + match[0].length + 500)
        if (/Authorization\s*:\s*`Bearer\s+\$\{session\.access_token\}`/.test(surroundingSource)) continue
      }
      failures.push(`${file}: protected ${apiPath} call must use authenticatedFetch`)
    }
  }
}

function resolveRoleArray(source, name, seen = new Set()) {
  if (seen.has(name)) throw new Error(`cyclic role array ${name}`)
  const match = source.match(new RegExp(`export\\s+const\\s+${name}\\s*=\\s*\\[([\\s\\S]*?)\\]\\s*as const`))
  if (!match) throw new Error(`missing exported ${name} array`)
  const roles = []
  const tokenPattern = /\.\.\.(\w+)|['"]([^'"]+)['"]/g
  for (const token of match[1].matchAll(tokenPattern)) {
    if (token[1]) roles.push(...resolveRoleArray(source, token[1], new Set([...seen, name])))
    else roles.push(token[2])
  }
  return roles
}

function assertArray(label, actual, expected) {
  if (actual.length !== expected.length || actual.some((value, index) => value !== expected[index])) {
    failures.push(`lib/api-auth.ts: ${label} must be [${expected.join(', ')}], got [${actual.join(', ')}]`)
  }
}

function extractPurePermissionFunction(source, name) {
  const match = source.match(new RegExp(`export\\s+function\\s+${name}\\s*\\([^)]*\\)\\s*:\\s*boolean\\s*\\{`))
  if (!match) throw new Error(`missing ${name}`)
  const openBrace = match.index + match[0].lastIndexOf('{')
  const closeBrace = findMatchingBrace(source, openBrace)
  if (closeBrace < 0) throw new Error(`could not parse ${name}`)
  return new Function('actor', 'target', source.slice(openBrace + 1, closeBrace))
}

async function checkRoleMatrix() {
  const file = path.join(repoRoot, 'lib', 'api-auth.ts')
  const source = await readFile(file, 'utf8')
  const roles = [
    'student', 'teacher', 'manager', 'director', 'finance', 'admin_jr',
    'admin', 'super_admin', 'math_student', 'math_parent', 'math_admin',
  ]

  try {
    assertArray('ACCOUNT_ROLES', resolveRoleArray(source, 'ACCOUNT_ROLES'), roles)
    assertArray('FULL_ADMIN_ROLES', resolveRoleArray(source, 'FULL_ADMIN_ROLES'), ['super_admin', 'admin'])
    assertArray('CONTENT_ADMIN_ROLES', resolveRoleArray(source, 'CONTENT_ADMIN_ROLES'), ['super_admin', 'admin', 'admin_jr'])
    assertArray('ACCOUNT_CREATOR_ROLES', resolveRoleArray(source, 'ACCOUNT_CREATOR_ROLES'), ['super_admin', 'admin', 'admin_jr', 'math_admin'])
    assertArray('ACCOUNT_MANAGER_ROLES', resolveRoleArray(source, 'ACCOUNT_MANAGER_ROLES'), ['super_admin', 'admin', 'math_admin'])
    assertArray('STUDENT_ROLES', resolveRoleArray(source, 'STUDENT_ROLES'), ['student'])
    assertArray('TEACHER_ROLES', resolveRoleArray(source, 'TEACHER_ROLES'), ['teacher'])

    const canCreate = extractPurePermissionFunction(source, 'canCreateAccount')
    const canManage = extractPurePermissionFunction(source, 'canManageAccount')
    for (const actor of roles) {
      for (const target of roles) {
        const expectedCreate = actor === 'super_admin'
          || ((actor === 'admin' || actor === 'admin_jr') && target === 'student')
          || (actor === 'math_admin' && (target === 'math_student' || target === 'math_parent'))
        const expectedManage = (actor === 'super_admin' && target !== 'super_admin')
          || (actor === 'admin' && target === 'student')
          || (actor === 'math_admin' && (target === 'math_student' || target === 'math_parent'))
        if (canCreate(actor, target) !== expectedCreate) {
          failures.push(`lib/api-auth.ts: canCreateAccount(${actor}, ${target}) must be ${expectedCreate}`)
        }
        if (canManage(actor, target) !== expectedManage) {
          failures.push(`lib/api-auth.ts: canManageAccount(${actor}, ${target}) must be ${expectedManage}`)
        }
      }
    }
  } catch (error) {
    failures.push(`lib/api-auth.ts: ${error instanceof Error ? error.message : String(error)}`)
  }
}

async function checkSelfManagementRejection() {
  const files = [
    'app/api/block-user/route.ts',
    'app/api/delete-user/route.ts',
    'app/api/admin/reset-password/route.ts',
  ]
  for (const file of files) {
    const source = await readFile(path.join(repoRoot, file), 'utf8')
    const selfCheck = source.search(/if\s*\(\s*id\s*===\s*auth\.user\.id\s*\)\s*return/)
    const authorization = source.search(/authorizeAccountManagement\s*\(/)
    if (selfCheck < 0 || selfCheck > authorization) {
      failures.push(`${file}: must reject id === auth.user.id before target authorization/mutation`)
    }
  }
}

async function checkAuthenticatedFetchOriginGuard() {
  const file = 'lib/authenticated-fetch.ts'
  const source = await readFile(path.join(repoRoot, file), 'utf8')
  const urlConstruction = source.search(/new URL\(\s*rawUrl\s*,\s*window\.location\.origin\s*\)/)
  const originCheck = source.search(/requestedUrl\.origin\s*!==\s*window\.location\.origin/)
  const rejection = source.search(/throw new Error\(\s*['"]authenticatedFetch supports same-origin requests only['"]\s*\)/)
  const tokenRead = source.search(/supabase\.auth\.getSession\s*\(/)
  const networkCall = source.search(/return\s+fetch\s*\(/)
  if (!(urlConstruction >= 0 && originCheck > urlConstruction && rejection > originCheck && tokenRead > rejection && networkCall > tokenRead)) {
    failures.push(`${file}: same-origin validation must reject before reading or forwarding the access token`)
  }
}

async function checkAiMentorTrustBoundary() {
  const routeFile = 'app/api/ai-mentor/route.ts'
  const route = await readFile(path.join(repoRoot, routeFile), 'utf8')
  const serverContext = route.search(/buildStudentContext\(\s*auth\.client\s*,\s*auth\.user\.id\s*\)/)
  const bodyLimit = route.search(/rawBody\.length\s*>\s*MAX_BODY_LENGTH/)
  const rateLimit = route.search(/consumeRateLimit\(\s*auth\.user\.id\s*\)/)
  const gateway = route.search(/createAIGateway\s*\(/)
  if (serverContext < 0 || bodyLimit < 0 || rateLimit < 0 || gateway < 0 || rateLimit > gateway || serverContext > gateway) {
    failures.push(`${routeFile}: AI must rate-limit and derive student context from the bearer user before calling the provider`)
  }
  if (/const\s*\{[^}]*studentContext[^}]*\}\s*=\s*(?:body|input)/s.test(route)) {
    failures.push(`${routeFile}: AI must not trust studentContext from the request body`)
  }

  const clientFile = 'lib/ai-mentor-data.ts'
  const client = await readFile(path.join(repoRoot, clientFile), 'utf8')
  if (/JSON\.stringify\(\s*\{[^}]*studentContext/s.test(client)) {
    failures.push(`${clientFile}: do not send caller-derived studentContext to the AI API`)
  }
}

await checkServerRoutes()
await checkProtectedClientCalls()
await checkRoleMatrix()
await checkSelfManagementRejection()
await checkAuthenticatedFetchOriginGuard()
await checkAiMentorTrustBoundary()

if (failures.length > 0) {
  console.error(`API security regression check failed (${failures.length}):`)
  for (const failure of failures) console.error(`- ${failure}`)
  process.exitCode = 1
} else {
  console.log(`API security regression check passed (${Object.keys(protectedRoutes).length} protected routes).`)
}
