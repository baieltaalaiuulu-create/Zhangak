import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(scriptDirectory, '..')
const failures = []

async function source(relativePath) {
  return readFile(path.join(projectRoot, relativePath), 'utf8')
}

function expect(condition, message) {
  if (!condition) failures.push(message)
}

async function collectSourceFiles(relativePath) {
  const absolutePath = path.join(projectRoot, relativePath)
  const entries = await readdir(absolutePath, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const child = path.join(relativePath, entry.name)
    if (entry.isDirectory()) files.push(...await collectSourceFiles(child))
    else if (entry.isFile() && /\.(?:ts|tsx)$/.test(entry.name)) files.push(child)
  }
  return files
}

async function main() {
  const bottomNav = await source('components/student/BottomNav.tsx')
  const navHrefs = [...bottomNav.matchAll(/href: '([^']+)'/g)].map(match => match[1])
  expect(
    JSON.stringify(navHrefs) === JSON.stringify([
      '/student/online',
      '/student/online/lessons',
      '/student/online/practice',
      '/student/online/mock',
      '/student/online/ai',
    ]),
    'mobile navigation must keep exactly Home, Lessons, Practice, ORT and AI in that order',
  )
  expect(bottomNav.includes('aria-label="Основная навигация"'), 'mobile navigation needs an accessible label')
  expect(bottomNav.includes("aria-current={isActive ? 'page' : undefined}"), 'active mobile destination needs aria-current="page"')
  expect(bottomNav.includes('min-h-16'), 'mobile navigation targets must remain at least 64px high')
  expect(bottomNav.includes('env(safe-area-inset-bottom)'), 'mobile navigation must respect the device safe area')

  const layout = await source('components/student/StudentLayout.tsx')
  const aiBranchStart = layout.indexOf('if (isAiPage)')
  const aiBranch = layout.slice(aiBranchStart, layout.indexOf('\n  return (', aiBranchStart))
  expect(aiBranch.includes('<BottomNav />'), 'AI must retain the five-item mobile navigation')
  expect(layout.includes('isImmersivePage'), 'exam and daily question flows must remain intentionally immersive')

  const dashboard = await source('app/student/online/page.tsx')
  const mobileDashboard = dashboard.slice(
    dashboard.indexOf('MOBILE (< 768px)'),
    dashboard.indexOf('DESKTOP (>= 768px)'),
  )
  for (const forbidden of [
    'AnnouncementBanner',
    'MobileDailyChallengeCard',
    'MobileLeaderboardCard',
    'MobileStatsGrid',
    'AIMentorRecommendationCard',
    'ActivityHeatmap',
    'RecentAchievementsCard',
  ]) {
    expect(!mobileDashboard.includes(forbidden), `mobile home must not render secondary block ${forbidden}`)
  }
  expect(mobileDashboard.includes('<MobileHero'), 'mobile home needs one primary continue action')
  expect(mobileDashboard.includes('<MobileTodayChecklist'), 'mobile home needs the three-item daily plan')
  expect(mobileDashboard.includes('challengeHref="/student/online/practice/daily"'), 'daily task must retain its canonical route')
  expect(
    mobileDashboard.includes('challengeAvailable={false}') || mobileDashboard.includes('challengeAvailable'),
    'daily task must explicitly declare whether its first-party flow is available',
  )

  const hero = await source('components/student/mobile/MobileHero.tsx')
  expect(hero.includes('href={`/student/online/lessons/${heroLesson.id}`}'), 'continue CTA must open the exact next lesson')
  expect(hero.includes('min-h-14'), 'primary lesson CTA must keep a large touch target')
  expect(hero.includes('role="progressbar"'), 'score-to-goal progress needs progressbar semantics')

  const mobileAiHelp = await source('components/student/mobile/MobileAIHelp.tsx')
  expect(mobileAiHelp.includes('AI-помощник обновляется'), 'mobile lesson AI entry must explicitly state its first-party migration status')
  expect(mobileAiHelp.includes('href="/student/online/practice"'), 'mobile lesson AI entry needs a working practice destination')
  expect(!mobileAiHelp.includes('askAIMentor'), 'mobile lesson AI entry must not dispatch into the retired AI drawer')
  expect(!mobileAiHelp.includes('useState'), 'mobile lesson AI entry must not expose dead expandable controls')

  const firstPartyStudentFiles = [
    'components/student/StudentLayout.tsx',
    'app/student/online/page.tsx',
    'app/student/online/universities/page.tsx',
    'components/student/mobile/MobileHero.tsx',
  ]
  for (const file of firstPartyStudentFiles) {
    const content = await source(file)
    expect(!content.includes("@/lib/student-data"), `${file} must not import the legacy Supabase student reader`)
    expect(!content.includes("@/lib/lessons-data"), `${file} must not import the legacy Supabase lesson reader`)
  }

  const checklist = await source('components/student/mobile/MobileTodayChecklist.tsx')
  for (const label of ['Урок', 'Тренажёр', 'Задание дня']) {
    expect(checklist.includes(`label: '${label}'`), `daily plan is missing ${label}`)
  }
  expect(checklist.includes('min-h-14'), 'daily plan rows must keep large touch targets')
  expect(checklist.includes('challengeAvailable') && checklist.includes('Скоро'), 'unmigrated daily tasks must be disabled instead of linking into a legacy flow')

  const aiPage = await source('app/student/online/ai/page.tsx')
  expect(aiPage.includes('AI-коуч готовится'), 'AI route must give students an explicit safe migration state')
  expect(aiPage.includes('useStudentSession'), 'AI route must stay inside the first-party student session')
  expect(!aiPage.includes("from '@/lib/supabase'"), 'AI route must not query retired Supabase data')
  expect(!aiPage.includes('streamMentorMessage'), 'AI route must not send a student context through the retired chat flow')
  expect(aiPage.includes('href="/student/online/lessons"'), 'AI migration state needs a safe lessons destination')
  expect(aiPage.includes('href="/student/online/practice"'), 'AI migration state needs a safe practice destination')
  expect(aiPage.includes('100dvh-64px-env(safe-area-inset-bottom)'), 'AI viewport must leave room for mobile navigation')

  const leaderboardPage = await source('app/student/online/leaderboard/page.tsx')
  expect(leaderboardPage.includes('честный рейтинг готовится'), 'leaderboard must give students an explicit safe migration state')
  expect(leaderboardPage.includes('useStudentSession'), 'leaderboard must stay inside the first-party student session')
  expect(!leaderboardPage.includes("from '@/lib/supabase'"), 'leaderboard must not query retired Supabase data')
  expect(!leaderboardPage.includes('fetchLeaderboardEntries'), 'leaderboard must not call the retired browser ranking client')
  expect(leaderboardPage.includes('href="/student/online/practice"'), 'leaderboard migration state needs a safe practice destination')

  const scanRoots = [
    'app/student/online/lessons',
    'app/student/online/practice',
    'app/student/online/mock',
    'app/student/online/ai',
    'components/student/mobile',
    'components/student/practice',
    'components/student/ai-chat',
  ]
  const standaloneFiles = [
    'app/student/online/page.tsx',
    'components/student/BottomNav.tsx',
    'components/student/StudentLayout.tsx',
    'components/student/StudentTopbar.tsx',
  ]
  const scannedFiles = [...standaloneFiles]
  for (const root of scanRoots) scannedFiles.push(...await collectSourceFiles(root))

  const pictographPattern = /\p{Extended_Pictographic}/u
  for (const file of scannedFiles) {
    expect(!pictographPattern.test(await source(file)), `${file} still contains an emoji/pictograph; use the icon library`)
  }

  if (failures.length > 0) {
    console.error(`Student mobile UX check failed (${failures.length}):`)
    for (const failure of failures) console.error(`- ${failure}`)
    process.exitCode = 1
    return
  }

  console.log(`Student mobile UX check passed (${scannedFiles.length} source files, five destinations, three daily tasks, safe AI and ranking migration states).`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
