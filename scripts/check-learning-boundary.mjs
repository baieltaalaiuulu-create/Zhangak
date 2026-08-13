import { access, readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const failures = []
const notes = []

const legacyFile = 'lib/practice-data.ts'
const legacyBaselines = {
  // Counts executable TypeScript references, not comments. Lower these values
  // as the legacy browser flow is retired so a removed trust-boundary cannot
  // silently return.
  answerKeyReferences: 7,
  directResultMutations: 1,
}

const v2Files = [
  'lib/learning/practice-contract.ts',
  'lib/learning/practice-validation.ts',
  'lib/learning/practice-reference.ts',
]
const retiredRouteFile = 'app/api/practice/route.ts'
const firstPartyPracticePage = 'app/student/online/practice/page.tsx'
const firstPartyPracticeRoute = 'backend/src/routes/platform-learning.js'

const answerKeyNames = new Set(['correctanswer', 'answerkey'])
const forbiddenRequestNames = new Set([
  'studentid',
  'userid',
  'score',
  'totalscore',
  'rawscore',
  'correctanswer',
  'answerkey',
  'attemptnumber',
  'completedat',
  'lessonid',
  'testtype',
  'passed',
  'xpearned',
])
const mutationMethods = new Set(['insert', 'upsert', 'update', 'delete'])

function fullPath(file) {
  return path.join(repoRoot, ...file.split('/'))
}

async function exists(file) {
  try {
    await access(fullPath(file))
    return true
  } catch {
    return false
  }
}

function sourceFile(file, source) {
  return ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
}

function normalizedName(value) {
  return value.replaceAll('_', '').replaceAll('-', '').toLowerCase()
}

function nodeName(node) {
  if (!node) return null
  if (ts.isIdentifier(node) || ts.isStringLiteral(node) || ts.isNumericLiteral(node)) return node.text
  return null
}

function visit(root, callback) {
  const walk = node => {
    callback(node)
    ts.forEachChild(node, walk)
  }
  walk(root)
}

function countAnswerKeyReferences(ast) {
  let count = 0
  visit(ast, node => {
    if (ts.isIdentifier(node) && answerKeyNames.has(normalizedName(node.text))) count += 1
    if (ts.isStringLiteralLike(node)) {
      count += node.text.match(/\b(?:correct_answer|correctAnswer|answer_key|answerKey)\b/g)?.length ?? 0
    }
  })
  return count
}

function countDirectResultMutations(ast) {
  let count = 0
  visit(ast, node => {
    if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) return
    if (!mutationMethods.has(node.expression.name.text)) return
    const receiver = node.expression.expression.getText(ast)
    if (/\.from\(\s*(['"])practice_results\1\s*\)/.test(receiver)) count += 1
  })
  return count
}

function declarationMembers(node) {
  if (ts.isInterfaceDeclaration(node)) return node.members
  if (ts.isTypeAliasDeclaration(node) && ts.isTypeLiteralNode(node.type)) return node.type.members
  return null
}

function isExported(node) {
  return node.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword) ?? false
}

function isRequestDto(name) {
  if (/(?:response|result|output)$/i.test(name)) return false
  return /(?:request|input|body|params|submission)$/i.test(name)
    || /(?:begin|start|submit)(?:request|input|body|params)?$/i.test(name)
}

function checkContract(file, source) {
  const ast = sourceFile(file, source)
  let exportedQuestionDtoCount = 0
  let exportedRequestDtoCount = 0
  const postFinalizationDtos = new Set(['PracticeReviewItem', 'PracticeSubmissionResponse'])

  for (const statement of ast.statements) {
    const members = declarationMembers(statement)
    if (!members || !statement.name || !isExported(statement)) continue
    const declarationName = statement.name.text

    if (/question/i.test(declarationName)) exportedQuestionDtoCount += 1
    if (!postFinalizationDtos.has(declarationName)) {
      for (const member of members) {
        const rawProperty = nodeName(member.name) ?? ''
        if (answerKeyNames.has(normalizedName(rawProperty))) {
          failures.push(`${file}: pre-submission DTO ${declarationName} exposes ${rawProperty}`)
        }
      }
    }

    if (isRequestDto(declarationName)) {
      exportedRequestDtoCount += 1
      for (const member of members) {
        const rawProperty = nodeName(member.name) ?? ''
        const property = normalizedName(rawProperty)
        if (forbiddenRequestNames.has(property) || property.endsWith('score')) {
          failures.push(`${file}: client request DTO ${declarationName} must not accept ${rawProperty}`)
        }
      }
    }
  }

  if (exportedQuestionDtoCount === 0) {
    failures.push(`${file}: expected an exported safe question DTO`)
  }
  if (exportedRequestDtoCount === 0) {
    failures.push(`${file}: expected an exported begin or submission request DTO`)
  }
}

function hasEveryAnswerLetter(source) {
  return ['a', 'b', 'c', 'd'].every(letter => new RegExp(`['"]${letter}['"]`, 'i').test(source))
}

function checkValidation(file, source) {
  const hasAnswerLimit = /MAX_[A-Z0-9_]*ANSWERS?[A-Z0-9_]*\s*=\s*[\d_]+/.test(source)
    && /(?:Object\.(?:keys|entries)\s*\(|\.length\s*>\s*MAX_[A-Z0-9_]*ANSWERS?)/.test(source)
  if (!hasAnswerLimit) failures.push(`${file}: submission parser must bound the number of answers`)

  const hasRuntimeAnswerAllowlist = /new Set\s*(?:<[^>]+>)?\s*\(/.test(source)
    && (hasEveryAnswerLetter(source) || /new Set\s*(?:<[^>]+>)?\s*\(\s*PRACTICE_ANSWER_LETTERS\s*\)/.test(source))
  if (!hasRuntimeAnswerAllowlist) failures.push(`${file}: answers must have a runtime A-D allowlist`)

  const hasStrictKeyCheck = /Object\.keys\s*\(/.test(source)
    && (/ALLOWED_[A-Z0-9_]*KEYS/.test(source) || /hasExactKeys\s*\(/.test(source))
  if (!hasStrictKeyCheck) failures.push(`${file}: request objects must reject unknown top-level keys`)

  if (!/Number\.is(?:Safe)?Integer\s*\(/.test(source)) {
    failures.push(`${file}: numeric identifiers must be checked with Number.isInteger or Number.isSafeInteger`)
  }
}

function checkReference(file, source) {
  if (!/\b(?:active|isActive|is_active)\b/.test(source)) {
    failures.push(`${file}: reference flow must reject inactive tests`)
  }
  if (!/\b(?:maxAttempts|max_attempts)\b/.test(source)
    || !/\b(?:attemptsUsed|attemptCount|attempt_count|usedAttempts|finalizedAttempts)\b/.test(source)
    || !/>=/.test(source)) {
    failures.push(`${file}: reference flow must enforce max attempts before grading`)
  }
  if (!/\b(?:answers|submittedAnswers)\b/.test(source) || !/\b(?:correctAnswer|correct_answer|answerKey|answer_key)\b/.test(source)) {
    failures.push(`${file}: reference score must compare submitted answers with trusted answer keys`)
  }
  if (!/\b(?:atomic|transaction|rpc|reservation|lock)\b/i.test(source)) {
    failures.push(`${file}: max-attempt enforcement must document an atomic RPC/transaction boundary`)
  }
}

function handlerMap(file, source) {
  const ast = sourceFile(file, source)
  const handlers = new Map()
  for (const statement of ast.statements) {
    if (!ts.isFunctionDeclaration(statement) || !statement.name || !statement.body || !isExported(statement)) continue
    if (statement.name.text === 'GET' || statement.name.text === 'POST') {
      handlers.set(statement.name.text, statement.body.getText(ast))
    }
  }
  return handlers
}

function checkBearerGuard(file, method, body) {
  const call = body.match(/(?:const|let)\s+(\w+)\s*=\s*await\s+requireBearerAuth\s*\(\s*\w+\s*\)/)
  if (!call || !new RegExp(`if\\s*\\(\\s*!${call?.[1] ?? 'auth'}\\.authorized\\s*\\)\\s*return\\s+${call?.[1] ?? 'auth'}\\.response`).test(body)) {
    failures.push(`${file} ${method}: requireBearerAuth must reject before any practice operation`)
    return null
  }
  return call[1]
}

function checkRoute(file, source, validationSource) {
  const ast = sourceFile(file, source)
  const handlers = handlerMap(file, source)
  for (const method of ['GET', 'POST']) {
    if (!handlers.has(method)) failures.push(`${file}: expected an exported ${method} handler`)
  }

  if (/\.from\s*\(/.test(source)) {
    failures.push(`${file}: V2 practice route must use RPCs, not direct PostgREST table queries`)
  }
  if (countAnswerKeyReferences(sourceFile(file, source)) > 0) {
    failures.push(`${file}: route source must never materialize or serialize an answer key`)
  }

  const featureEnv = source.match(/process\.env\.([A-Z0-9_]*PRACTICE[A-Z0-9_]*)/)
  if (!featureEnv) failures.push(`${file}: V2 route must be controlled by a PRACTICE feature flag`)
  const featureGateNames = new Set()
  if (featureEnv) {
    for (const statement of ast.statements) {
      if (ts.isFunctionDeclaration(statement) && statement.name && statement.getText(ast).includes(`process.env.${featureEnv[1]}`)) {
        featureGateNames.add(statement.name.text)
      }
      if (!ts.isVariableStatement(statement)) continue
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name) && declaration.initializer?.getText(ast).includes(`process.env.${featureEnv[1]}`)) {
          featureGateNames.add(declaration.name.text)
        }
      }
    }
  }

  for (const [method, body] of handlers) {
    const authName = checkBearerGuard(file, method, body)
    const rpcCalls = [...body.matchAll(/\.rpc\s*\(\s*(['"])([^'"]+)\1/g)]
    const expectedRpc = method === 'GET' ? 'begin_practice_attempt_v2' : 'submit_practice_attempt_v2'
    if (rpcCalls.length !== 1 || rpcCalls[0]?.[2] !== expectedRpc) {
      failures.push(`${file} ${method}: expected exactly one ${expectedRpc} RPC call`)
    }
    const rpcIndex = body.search(/\.rpc\s*\(/)
    const gatePattern = [...featureGateNames].map(name => `\\b${name}\\s*(?:\\(|\\b)`).join('|')
    const gateIndex = gatePattern ? body.search(new RegExp(gatePattern)) : -1
    if (featureEnv && (gateIndex < 0 || (rpcIndex >= 0 && gateIndex > rpcIndex))) {
      failures.push(`${file} ${method}: feature flag must be checked inside the handler`)
    }
    if (authName && !new RegExp(`\\b${authName}\\.client\\.rpc\\s*\\(`).test(body)) {
      failures.push(`${file} ${method}: RPC must use the authenticated client so the database derives auth.uid()`)
    }
    const rateLimitIndex = authName
      ? body.search(new RegExp(`consumeRateLimit\\s*\\(\\s*${authName}\\.user\\.id\\s*\\)`))
      : -1
    if (rateLimitIndex < 0 || (rpcIndex >= 0 && rateLimitIndex > rpcIndex)) {
      failures.push(`${file} ${method}: auth.user.id rate limit must run before the RPC`)
    }

    for (const rawName of forbiddenRequestNames) {
      const aliases = rawName === 'studentid' ? '(?:studentId|student_id)' : rawName
      const untrustedAccess = new RegExp(`\\b(?:body|input|payload|submission|parsed)\\s*\\.\\s*${aliases}\\b`, 'i')
      if (untrustedAccess.test(body)) {
        failures.push(`${file} ${method}: must not trust client-provided ${rawName}`)
      }
    }
  }

  const post = handlers.get('POST') ?? ''
  const routeLimitIndex = post.search(/(?:\.length|\.byteLength)\s*>\s*MAX_[A-Z0-9_]*BODY/)
  const routeParseIndex = post.search(/JSON\.parse\s*\(/)
  const validationLimitIndex = validationSource.search(/(?:\.length|\.byteLength)\s*>\s*MAX_[A-Z0-9_]*BODY/)
  const validationParseIndex = validationSource.search(/JSON\.parse\s*\(/)
  const routeHasOrderedBodyLimit = routeLimitIndex >= 0 && routeParseIndex > routeLimitIndex
  const validationHasOrderedBodyLimit = validationLimitIndex >= 0 && validationParseIndex > validationLimitIndex
  if (!routeHasOrderedBodyLimit && !validationHasOrderedBodyLimit) {
    failures.push(`${file} POST: raw request size must be bounded before JSON parsing`)
  }
  if (/\b\w+\.json\s*\(/.test(post)) {
    failures.push(`${file} POST: req.json() bypasses the raw request-size bound; read text then parse JSON`)
  }
}

async function checkLegacyDebt() {
  const source = await readFile(fullPath(legacyFile), 'utf8')
  const ast = sourceFile(legacyFile, source)
  const answerKeyReferences = countAnswerKeyReferences(ast)
  const directResultMutations = countDirectResultMutations(ast)

  if (answerKeyReferences > legacyBaselines.answerKeyReferences) {
    failures.push(`${legacyFile}: answer-key references increased from baseline ${legacyBaselines.answerKeyReferences} to ${answerKeyReferences}`)
  }
  if (directResultMutations > legacyBaselines.directResultMutations) {
    failures.push(`${legacyFile}: direct practice_results mutations increased from baseline ${legacyBaselines.directResultMutations} to ${directResultMutations}`)
  }
  notes.push(`legacy debt: ${answerKeyReferences}/${legacyBaselines.answerKeyReferences} answer-key references, ${directResultMutations}/${legacyBaselines.directResultMutations} direct result mutations`)
  if (answerKeyReferences < legacyBaselines.answerKeyReferences || directResultMutations < legacyBaselines.directResultMutations) {
    notes.push('legacy debt decreased; lower the baselines in this checker to lock in the improvement')
  }
}

async function checkV2Boundary() {
  const presence = new Map(await Promise.all(v2Files.map(async file => [file, await exists(file)])))
  const presentCount = [...presence.values()].filter(Boolean).length
  if (presentCount === 0) {
    notes.push('V2 contract is not present yet; optional route checks are inactive')
  } else {
    for (const [file, isPresent] of presence) {
      if (!isPresent) failures.push(`${file}: V2 boundary started but this required file is missing`)
    }
  }

  const sources = new Map()
  for (const [file, isPresent] of presence) {
    if (isPresent) sources.set(file, await readFile(fullPath(file), 'utf8'))
  }

  const contract = sources.get(v2Files[0])
  const validation = sources.get(v2Files[1])
  const reference = sources.get(v2Files[2])
  if (contract) checkContract(v2Files[0], contract)
  if (validation) checkValidation(v2Files[1], validation)
  if (reference) checkReference(v2Files[2], reference)

  for (const [file, source] of sources) {
    const mutations = countDirectResultMutations(sourceFile(file, source))
    if (mutations > 0) failures.push(`${file}: V2 boundary must not mutate practice_results directly`)
  }

  if (await exists(retiredRouteFile)) {
    failures.push(`${retiredRouteFile}: retired Supabase-backed practice route must remain deleted`)
    return
  }

  const [page, route] = await Promise.all([
    readFile(fullPath(firstPartyPracticePage), 'utf8'),
    readFile(fullPath(firstPartyPracticeRoute), 'utf8'),
  ])
  if (!page.includes("zhangakApiRequest<unknown>('/v1/platform/practice-tests')")
    || !page.includes("zhangakApiJson<unknown>('/v1/platform/practice-attempts', 'POST'")) {
    failures.push(`${firstPartyPracticePage}: mounted practice must use the first-party attempt API`)
  }
  if (/['"`]\/api\/practice|from\s+['"][^'"]*supabase|authenticatedFetch\s*\(/i.test(page)) {
    failures.push(`${firstPartyPracticePage}: mounted practice must not call the retired Supabase route`)
  }
  if (!route.includes("GET('/v1/platform/practice-tests'")
    || !route.includes("POST('/v1/platform/practice-attempts'")) {
    failures.push(`${firstPartyPracticeRoute}: first-party catalog and attempt routes are required after retirement`)
  }
  if (/supabase/i.test(route)) {
    failures.push(`${firstPartyPracticeRoute}: first-party practice route must not depend on Supabase`)
  }
  notes.push('retired /api/practice handler is absent; mounted practice uses the first-party server-scored attempt flow')
}

await checkLegacyDebt()
await checkV2Boundary()

if (failures.length > 0) {
  console.error(`Learning trust-boundary regression check failed (${failures.length}):`)
  for (const failure of failures) console.error(`- ${failure}`)
  for (const note of notes) console.error(`- ${note}`)
  process.exitCode = 1
} else {
  console.log('Learning trust-boundary regression check passed.')
  for (const note of notes) console.log(`- ${note}`)
}
