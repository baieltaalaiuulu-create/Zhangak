import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const failures = []

async function source(relativePath) {
  return readFile(path.join(root, relativePath), 'utf8')
}

function expect(condition, message) {
  if (!condition) failures.push(message)
}

async function collect(relativePath) {
  const entries = await readdir(path.join(root, relativePath), { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const child = path.join(relativePath, entry.name)
    if (entry.isDirectory()) files.push(...await collect(child))
    else if (entry.isFile() && /\.(?:ts|tsx)$/.test(entry.name)) files.push(child)
  }
  return files
}

async function main() {
  const catalog = await source('app/student/online/universities/page.tsx')
  expect(catalog.includes('const studentScore = latestScore'), 'catalog must use only the latest real mock score')
  expect(!catalog.includes('latestScore ?? targetScore'), 'target score must never impersonate a current ORT result')
  expect(catalog.includes('next.size < 3'), 'comparison selection must remain capped at three universities')
  expect(catalog.includes('comparisonList.length >= 2'), 'comparison table needs at least two selected universities')
  expect(catalog.includes('rankAdmissionMatches(universities, studentScore, 3)'), 'recommendations must be ranked by the matching contract')

  const matching = await source('lib/university-matching.ts')
  expect(matching.includes("level: 'unknown'"), 'matching must support unknown score or threshold data')
  expect(matching.includes('studentScore == null'), 'matching must reject missing student scores')
  expect(matching.includes('minScore == null'), 'matching must reject missing admission thresholds')
  expect(matching.includes('Не придумывай проходные баллы, стоимость или сроки'), 'AI admission prompt must forbid fabricated facts')

  const universityData = await source('lib/universities-data.ts')
  expect(universityData.includes('favoritesKey(studentId)'), 'favorites must be scoped to the signed-in student')
  expect(universityData.includes(".eq('is_active', true).maybeSingle()"), 'university details must hide inactive records')
  expect(!universityData.includes('середина июня'), 'generic admission copy must not invent an unverified date range')
  expect(universityData.includes('Точные сроки приёма пока не загружены'), 'missing deadlines need an explicit unknown state')

  const aiPage = await source('app/student/online/ai/page.tsx')
  expect(aiPage.includes("searchParams.get('prompt')"), 'AI coach must accept the admission-plan handoff')
  expect(aiPage.includes("initialPrompt ? 'plan' : undefined"), 'admission handoff must request a plan response')

  const detail = await source('app/student/online/universities/[id]/page.tsx')
  expect(!detail.includes("key: 'reviews'"), 'unimplemented reviews must not appear as a dead tab')
  expect(detail.includes('officialWebsite={university.website}'), 'deadline guidance must link to the official university site')

  const adminData = await source('lib/admin-universities-data.ts')
  expect(!adminData.includes("from '@/lib/supabase'"), 'admin university reads must not use the anonymous browser client')
  expect(adminData.includes("authenticatedFetch('/api/admin/universities')"), 'admin university reads must use the protected API')

  for (const route of [
    'app/api/admin/universities/route.ts',
    'app/api/admin/university-specialties/route.ts',
  ]) {
    const routeSource = await source(route)
    expect(routeSource.includes('export async function GET'), `${route} needs a protected GET handler`)
    const getHandler = routeSource.slice(routeSource.indexOf('export async function GET'), routeSource.indexOf('export async function POST'))
    expect(getHandler.includes('requireAdminApi(req)'), `${route} GET must authenticate before reading`)
    expect(routeSource.includes('readJsonObject(req)'), `${route} writes need bounded JSON parsing`)
    expect(!routeSource.includes('req.json()'), `${route} must not accept an unbounded JSON body`)
  }

  const scanFiles = [
    ...(await collect('app/student/online/universities')),
    ...(await collect('app/admin/universities')),
    ...(await collect('components/student/universities')),
    'components/student/StudentSidebar.tsx',
    'lib/universities-data.ts',
    'lib/university-matching.ts',
  ]
  const pictograph = /\p{Extended_Pictographic}/u
  for (const file of scanFiles) {
    expect(!pictograph.test(await source(file)), `${file} contains an emoji/pictograph instead of an icon`)
  }

  if (failures.length > 0) {
    console.error(`University journey check failed (${failures.length}):`)
    for (const failure of failures) console.error(`- ${failure}`)
    process.exitCode = 1
    return
  }

  console.log(`University journey check passed (${scanFiles.length} source files, honest scoring, scoped favorites, protected admin reads).`)
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
