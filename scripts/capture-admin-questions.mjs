import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

import { chromium } from '@playwright/test'

/**
 * Screenshot harness for the admin question workspace and the student lesson
 * search, at the three viewports the finish context requires.
 *
 * Diagnostic tool, not a test. The first-party API is stubbed so the shots are
 * reproducible and contain no real student data; the pages, components and CSS
 * are the real production build.
 *
 *   node scripts/capture-admin-questions.mjs --out artifacts/finish-after
 */

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const arg = (name, fallback) => {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : fallback
}
const baseUrl = arg('--base', 'http://127.0.0.1:3311')
const outDir = path.resolve(arg('--out', path.join(projectRoot, 'artifacts', 'finish-screens')))

const VIEWPORTS = [
  { name: '390x844', width: 390, height: 844 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '1440x900', width: 1440, height: 900 },
]

const ADMIN = {
  id: '00000000-0000-4000-8000-0000000000a1', email: 'demo.admin@zhangak.test', fullName: 'Демо Админ',
  role: 'admin', studentType: null, phone: null, targetScore: null, avatarUrl: null,
  profileColor: 'blue', dailyStudyGoalMinutes: 30, communityVisibility: true,
}
const STUDENT = { ...ADMIN, id: '00000000-0000-4000-8000-0000000000d1', role: 'student', studentType: 'online', targetScore: 180, fullName: 'Демо Ученик' }

const COURSE = { id: 1, name: 'ОРТ: онлайн-подготовка', code: 'ort-online', level: null, subject: 'ort', description: null, coverImageUrl: null, deliveryMode: 'online', isActive: true, lessonCount: 18, createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z' }
const TEST = { id: 1, courseId: 1, lessonId: null, title: 'Банк вопросов: математика', subject: 'math', testType: 'bank', description: null, timeLimitSeconds: null, maxAttempts: null, passScoreRatio: 0.7, isPublished: false, availableFrom: null, availableUntil: null, questionCount: 200, activeQuestionCount: 172, createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z' }

function question(index) {
  const active = index % 7 !== 0
  return {
    id: index, practiceTestId: 1,
    questionText: `Вопрос номер ${index}. Найдите значение выражения и выберите правильный вариант ответа.`,
    options: { a: `Вариант A ${index}`, b: `Вариант B ${index}`, c: `Вариант C ${index}`, d: `Вариант D ${index}` },
    correctAnswer: 'b', explanation: `Пояснение ${index}`,
    section: index % 2 === 0 ? 'algebra' : 'geometry',
    topic: index % 10 === 0 ? 'Дроби' : `Тема ${index}`,
    difficulty: ['easy', 'medium', 'hard'][index % 3],
    imageUrl: null, position: index, isActive: active,
    createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z',
  }
}

const LESSONS = Array.from({ length: 9 }, (_, i) => ({
  id: i + 1, courseId: 1, lessonNumber: i + 1, title: `Математика: урок ${i + 1}`,
  description: 'Описание урока', subject: 'math', section: 'Числа', topic: `Тема ${i + 1}`,
  lessonDate: null, durationMinutes: 20, contentUrl: null, video: null, isTest: false,
  completionMode: 'self', isLocked: i > 2, completionPercent: i === 0 ? 100 : 0,
  completedAt: i === 0 ? '2026-08-20T08:00:00.000Z' : null, lastViewedAt: null,
}))

const json = (route, body, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })

async function stub(page, user) {
  await page.route('**/v1/**', route => json(route, { items: [], total: 0, limit: 25, offset: 0 }))
  await page.route('**/v1/auth/me', route => json(route, { user }))
  await page.route('**/v1/auth/refresh', route => json(route, { user }))
  await page.route('**/v1/admin/courses**', route => json(route, { items: [COURSE], total: 1, limit: 100, offset: 0 }))
  await page.route('**/v1/admin/courses/*/lessons**', route => json(route, { items: [], total: 0, limit: 100, offset: 0 }))
  await page.route('**/v1/admin/courses/*/practice-tests**', route => json(route, { items: [TEST], total: 1, limit: 100, offset: 0 }))
  await page.route('**/v1/admin/practice-tests/1/questions**', route => {
    const url = new URL(route.request().url())
    const status = url.searchParams.get('status') ?? 'all'
    const offset = Number(url.searchParams.get('offset') ?? 0)
    const limit = Number(url.searchParams.get('limit') ?? 25)
    const all = Array.from({ length: 200 }, (_, i) => question(i + 1))
      .filter(item => status === 'all' || (status === 'active') === item.isActive)
    return json(route, { practiceTestId: 1, items: all.slice(offset, offset + limit), total: all.length, limit, offset, nextAvailablePosition: null })
  })
  await page.route('**/v1/platform/lessons**', route => json(route, { items: LESSONS }))
}

async function main() {
  await mkdir(outDir, { recursive: true })
  const browser = await chromium.launch()
  for (const viewport of VIEWPORTS) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } })
    const dir = path.join(outDir, viewport.name)
    await mkdir(dir, { recursive: true })

    const admin = await context.newPage()
    await stub(admin, ADMIN)
    await admin.goto(`${baseUrl}/admin/questions`, { waitUntil: 'domcontentloaded' })
    await admin.waitForTimeout(1500)
    await admin.screenshot({ path: path.join(dir, 'admin-questions.png'), fullPage: true })
    await admin.close()

    const student = await context.newPage()
    await stub(student, STUDENT)
    await student.goto(`${baseUrl}/student/online/lessons?q=${encodeURIComponent('урок 3')}`, { waitUntil: 'domcontentloaded' })
    await student.waitForTimeout(1200)
    await student.screenshot({ path: path.join(dir, 'student-lesson-search.png'), fullPage: true })
    await student.close()

    await context.close()
    console.log(`captured ${viewport.name}`)
  }
  await browser.close()
  console.log(`Screenshots: ${outDir}`)
}

await main()
