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
      '/student/online/trainer',
      '/student/online/roadmap',
      '/student/online/quests',
      '/student/online/profile',
    ]),
    'mobile navigation must keep Home, Trainer, Roadmap, Quests and Profile in that order',
  )
  expect(bottomNav.includes('aria-label="Основная навигация"'), 'mobile navigation needs an accessible label')
  expect(bottomNav.includes("aria-current={isActive ? 'page' : undefined}"), 'active mobile destination needs aria-current="page"')
  expect(bottomNav.includes('h-14') && bottomNav.includes("height: 'calc(64px + env(safe-area-inset-bottom))'"), 'mobile navigation targets and safe-area bar must retain their approved heights')
  expect(bottomNav.includes('env(safe-area-inset-bottom)'), 'mobile navigation must respect the device safe area')

  const layout = await source('components/student/StudentLayout.tsx')
  expect(!layout.includes('AI_PAGE_ROUTE') && !layout.includes('isAiPage'), 'student shell must not retain a product AI route')
  expect(layout.includes('isImmersivePage'), 'exam and daily question flows must remain intentionally immersive')

  const dashboard = await source('app/student/online/page.tsx')
  const mobileDashboard = dashboard.slice(
    dashboard.indexOf('MOBILE (< 768px)'),
    dashboard.indexOf('DESKTOP (>= 768px)'),
  )
  for (const forbidden of ['AnnouncementBanner', 'MobileDailyChallengeCard', 'MobileLeaderboardCard', 'MobileStatsGrid', 'AIMentorRecommendationCard', 'ActivityHeatmap', 'RecentAchievementsCard']) {
    expect(!mobileDashboard.includes(forbidden), `mobile home must not render secondary block ${forbidden}`)
  }
  expect(mobileDashboard.includes('Открыть Roadmap'), 'mobile home needs one dominant Roadmap action')
  expect(mobileDashboard.includes('href="/student/online/roadmap"'), 'mobile home must link directly to the course map')
  expect(mobileDashboard.includes('href="/student/online/trainer"') && mobileDashboard.includes('Выбери раздел и сложность'), 'mobile home needs an honest trainer explanation')
  expect(mobileDashboard.includes('min-h-14'), 'primary Roadmap action must keep a large touch target')

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

  const leaderboardPage = await source('app/student/online/leaderboard/page.tsx')
  expect(leaderboardPage.includes('useStudentSession'), 'leaderboard must stay inside the first-party student session')
  expect(!leaderboardPage.includes("from '@/lib/supabase'"), 'leaderboard must not query retired Supabase data')
  expect(!leaderboardPage.includes('fetchLeaderboardEntries'), 'leaderboard must not call the retired browser ranking client')
  expect(leaderboardPage.includes('getOverallLeaderboard'), 'leaderboard must load the first-party ranking projection')
  expect(leaderboardPage.includes('подтверждённому XP') && leaderboardPage.includes('Сброс тренажёра не уменьшает'), 'leaderboard must explain authoritative XP semantics')

  const roadmapPage = await source('app/student/online/roadmap/page.tsx')
  expect(roadmapPage.includes('min-h-screen bg-white pb-28'), 'roadmap must keep a white surface through the fixed mobile navigation safe area')
  expect(roadmapPage.includes("lesson.subject === subject"), 'roadmap must isolate the chosen subject before rendering a learning path')
  expect(roadmapPage.includes('Математика') && roadmapPage.includes('Кыргызский язык'), 'roadmap must offer separate Mathematics and Kyrgyz language directions')

  const scanRoots = [
    'app/student/online/lessons',
    'app/student/online/practice',
    'app/student/online/mock',
    'app/student/online/roadmap',
    'components/student/mobile',
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

  console.log(`Student mobile UX check passed (${scannedFiles.length} source files, five destinations, three daily tasks and first-party ranking).`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
