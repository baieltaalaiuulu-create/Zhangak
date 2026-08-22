import { expect, test, type Page, type Route } from '@playwright/test'

/**
 * Admin question management: catalogue, archive and restore.
 *
 * The production build and the real components run here; the first-party API
 * is intercepted so the run is deterministic and carries no student data.
 * Server authorization is proven separately — this file must not be read as
 * evidence that the API enforces anything.
 */

const ADMIN = {
  id: '00000000-0000-4000-8000-0000000000a1', email: 'demo.admin@zhangak.test', fullName: 'Демо Админ',
  role: 'admin', studentType: null, phone: null, targetScore: null, avatarUrl: null,
  profileColor: 'blue', dailyStudyGoalMinutes: 30, communityVisibility: true,
}

const COURSE = {
  id: 1, name: 'ОРТ: онлайн-подготовка', code: 'ort-online', level: null, subject: 'ort',
  description: null, coverImageUrl: null, deliveryMode: 'online', isActive: true, lessonCount: 18,
  createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z',
}

const TEST_ROW = {
  id: 1, courseId: 1, lessonId: null, title: 'Банк вопросов: математика', subject: 'math',
  testType: 'bank', description: null, timeLimitSeconds: null, maxAttempts: null, passScoreRatio: 0.7,
  isPublished: false, availableFrom: null, availableUntil: null, questionCount: 200, activeQuestionCount: 172,
  createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z',
}

function question(index: number, activeOverride?: boolean) {
  return {
    id: index, practiceTestId: 1,
    questionText: `Вопрос номер ${index}. Найдите значение выражения.`,
    options: { a: `A${index}`, b: `B${index}`, c: `C${index}`, d: `D${index}` },
    correctAnswer: 'b', explanation: `Пояснение ${index}`,
    section: index % 2 === 0 ? 'algebra' : 'geometry',
    topic: index % 10 === 0 ? 'Дроби' : `Тема ${index}`,
    difficulty: (['easy', 'medium', 'hard'] as const)[index % 3],
    imageUrl: null, position: index,
    isActive: activeOverride ?? index % 7 !== 0,
    createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z',
  }
}

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })

interface Recorded { url: string, method: string, body: unknown }

async function stubAdmin(page: Page, recorded: Recorded[]) {
  const archived = new Set<number>()

  await page.route('**/v1/**', route => json(route, { items: [], total: 0, limit: 25, offset: 0 }))
  await page.route('**/v1/auth/me', route => json(route, { user: ADMIN }))
  await page.route('**/v1/auth/refresh', route => json(route, { user: ADMIN }))
  await page.route('**/v1/admin/courses**', route => json(route, { items: [COURSE], total: 1, limit: 100, offset: 0 }))
  await page.route('**/v1/admin/courses/*/lessons**', route => json(route, { items: [], total: 0, limit: 100, offset: 0 }))
  await page.route('**/v1/admin/courses/*/practice-tests**', route => json(route, { items: [TEST_ROW], total: 1, limit: 100, offset: 0 }))

  await page.route('**/v1/admin/practice-questions/*', async route => {
    const body = route.request().postDataJSON()
    recorded.push({ url: route.request().url(), method: route.request().method(), body })
    const id = Number(route.request().url().split('/').pop())
    if (body?.isActive === false) archived.add(id)
    if (body?.isActive === true) archived.delete(id)
    return json(route, { question: question(id, body?.isActive ?? true) })
  })

  await page.route('**/v1/admin/practice-tests/1/questions**', route => {
    const url = new URL(route.request().url())
    recorded.push({ url: url.pathname + url.search, method: route.request().method(), body: null })
    const status = url.searchParams.get('status') ?? 'all'
    const offset = Number(url.searchParams.get('offset') ?? 0)
    const limit = Number(url.searchParams.get('limit') ?? 25)
    const search = url.searchParams.get('q')
    const all = Array.from({ length: 200 }, (_, i) => {
      const item = question(i + 1)
      return archived.has(item.id) ? { ...item, isActive: false } : item
    })
      .filter(item => status === 'all' || (status === 'active') === item.isActive)
      .filter(item => !search || item.questionText.toLowerCase().includes(search.toLowerCase()) || (item.topic ?? '').toLowerCase().includes(search.toLowerCase()))
    // All 200 slots are seeded, active or archived, so the bank is full: the
    // real server would report no free position either.
    return json(route, { practiceTestId: 1, items: all.slice(offset, offset + limit), total: all.length, limit, offset, nextAvailablePosition: null })
  })
}

async function openWorkspace(page: Page) {
  await page.goto('/admin/questions', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('Показаны 1–25 из 200')).toBeVisible({ timeout: 20_000 })
}

test.describe('admin question catalogue', () => {
  test('pages a 200-question bank instead of loading it whole', async ({ page }) => {
    const recorded: Recorded[] = []
    await stubAdmin(page, recorded)
    await page.setViewportSize({ width: 1440, height: 900 })
    await openWorkspace(page)

    // The regression this replaces: the UI showed 200/200 but rendered only
    // the first page with no way to reach the rest.
    await expect(page.getByRole('button', { name: 'Далее' })).toBeEnabled()
    await expect(page.getByRole('button', { name: 'Назад' })).toBeDisabled()

    await page.getByRole('button', { name: 'Далее' }).click()
    await expect(page.getByText('Показаны 26–50 из 200')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Назад' })).toBeEnabled()

    // The label moves with the offset, so the fetch is polled for rather than
    // assumed to have already happened.
    await expect
      .poll(() => recorded.filter(call => call.url.includes('/questions?')).map(call => call.url), { timeout: 10_000 })
      .toEqual(expect.arrayContaining([expect.stringContaining('offset=25')]))
    const listCalls = recorded.filter(call => call.url.includes('/questions?'))
    expect(listCalls.every(call => call.url.includes('limit=25')), 'the bank must be requested one page at a time').toBe(true)
  })

  test('search and status are resolved on the server, not in the browser', async ({ page }) => {
    const recorded: Recorded[] = []
    await stubAdmin(page, recorded)
    await page.setViewportSize({ width: 1440, height: 900 })
    await openWorkspace(page)

    await page.getByLabel('Статус').selectOption('archived')
    await expect(page.getByText(/Показаны 1–\d+ из 28/)).toBeVisible({ timeout: 10_000 })
    expect(recorded.some(call => call.url.includes('status=archived'))).toBe(true)

    await page.getByPlaceholder('Текст вопроса или тема').fill('дроби')
    await expect.poll(() => recorded.some(call => call.url.includes('q=')), { timeout: 10_000 }).toBe(true)
  })

  test('archiving asks for confirmation and never issues a DELETE', async ({ page }) => {
    const recorded: Recorded[] = []
    await stubAdmin(page, recorded)
    await page.setViewportSize({ width: 390, height: 844 })
    await openWorkspace(page)

    await page.getByRole('button', { name: 'Архивировать вопрос 1', exact: true }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    // The wording must describe what actually happens: nothing is deleted.
    await expect(dialog).toContainText('сохранится в базе')
    await expect(dialog).toContainText('Восстановить')

    // Escape cancels without mutating anything.
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    expect(recorded.some(call => call.method === 'PATCH')).toBe(false)

    await page.getByRole('button', { name: 'Архивировать вопрос 1', exact: true }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Архивировать' }).click()
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 10_000 })

    const mutations = recorded.filter(call => call.method !== 'GET')
    expect(mutations.length).toBe(1)
    expect(mutations[0].method).toBe('PATCH')
    expect(mutations[0].body).toEqual({ isActive: false })
    expect(mutations.some(call => call.method === 'DELETE'), 'archiving must never be a destructive delete').toBe(false)
  })

  test('an archived question can be restored again', async ({ page }) => {
    const recorded: Recorded[] = []
    await stubAdmin(page, recorded)
    await page.setViewportSize({ width: 1440, height: 900 })
    await openWorkspace(page)

    // Question 7 is seeded archived, so its row offers restore rather than archive.
    const restore = page.getByRole('button', { name: 'Восстановить вопрос 7', exact: true })
    await expect(restore).toBeVisible()
    await restore.click()

    await expect.poll(() => recorded.filter(call => call.method === 'PATCH').length, { timeout: 10_000 }).toBeGreaterThan(0)
    const patch = recorded.find(call => call.method === 'PATCH')!
    expect(patch.body).toEqual({ isActive: true })
  })

  test('the catalogue controls stay usable at 390px without overflow', async ({ page }) => {
    const recorded: Recorded[] = []
    await stubAdmin(page, recorded)
    await page.setViewportSize({ width: 390, height: 844 })
    await openWorkspace(page)

    const overflow = await page.evaluate(() => {
      const clipped = [document.documentElement, document.body] as HTMLElement[]
      const previous = clipped.map(el => el.style.overflowX)
      clipped.forEach(el => { el.style.overflowX = 'visible' })
      const scrollWidth = document.documentElement.scrollWidth
      clipped.forEach((el, i) => { el.style.overflowX = previous[i] })
      return { scrollWidth, clientWidth: document.documentElement.clientWidth }
    })
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth)

    for (const name of ['Архивировать вопрос 1', 'Редактировать вопрос 1']) {
      const box = await page.getByRole('button', { name, exact: true }).boundingBox()
      expect(box, name).not.toBeNull()
      expect(box!.height, `${name} must be a 44px touch target`).toBeGreaterThanOrEqual(44)
      expect(box!.width).toBeGreaterThanOrEqual(44)
    }
  })

  test('the lesson-scoped editor resolves its own course context instead of getting stuck disabled', async ({ page }) => {
    const recorded: Recorded[] = []
    await stubAdmin(page, recorded)
    const LESSON = {
      id: 42, courseId: COURSE.id, lessonNumber: 3, title: 'Квадратные уравнения',
      description: null, subject: 'math', section: null, topic: null, lessonDate: null,
      durationMinutes: 30, contentUrl: null, isTest: false, isPublished: true,
      createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z',
    }
    // These take priority over stubAdmin's routes because Playwright matches
    // the most recently registered handler first.
    await page.route('**/v1/admin/lessons/42', route => json(route, { lesson: LESSON }))
    await page.route('**/v1/admin/courses/1', route => json(route, { course: COURSE }))
    await page.route('**/v1/admin/lessons/42/practice-tests**', route => json(route, { items: [{ ...TEST_ROW, lessonId: 42 }], total: 1, limit: 100, offset: 0 }))
    await page.setViewportSize({ width: 1440, height: 900 })

    await page.goto('/admin/lessons/42/questions', { waitUntil: 'domcontentloaded' })

    // The regression this replaces: a generic course-picker effect fired on
    // the same initial render, cleared the lesson-scoped test list the
    // moment it started loading, and left the header on "Весь курс" with
    // both create buttons permanently disabled.
    await expect(page.getByRole('heading', { name: 'Тесты · Урок 3' })).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('button', { name: 'Новый тест' })).toBeEnabled()
    await expect(page.getByText('Показаны 1–25 из 200')).toBeVisible({ timeout: 20_000 })
  })

  test('a stale position conflict on create surfaces the current free slot without losing form input', async ({ page }) => {
    const recorded: Recorded[] = []
    await stubAdmin(page, recorded)
    const smallBank = Array.from({ length: 5 }, (_, i) => question(i + 1))
    let createAttempts = 0
    let conflictOccurred = false
    // A five-question test overrides the 200-question stub from stubAdmin so
    // the free slot (6) is obvious. Once the create request conflicts, every
    // subsequent read reports 7: another admin took position 6 between page
    // load and submit. Keying the transition to the mutation rather than a
    // GET count keeps the scenario deterministic when React refetches.
    await page.route('**/v1/admin/practice-tests/1/questions**', route => {
      const request = route.request()
      if (request.method() === 'GET') {
        const nextAvailablePosition = conflictOccurred ? 7 : 6
        return json(route, { practiceTestId: 1, items: smallBank, total: smallBank.length, limit: 25, offset: 0, nextAvailablePosition })
      }
      if (request.method() === 'POST') {
        createAttempts += 1
        const body = request.postDataJSON()
        recorded.push({ url: request.url(), method: 'POST', body })
        if (createAttempts === 1) {
          conflictOccurred = true
          return route.fulfill({
            status: 409,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Этот номер вопроса уже используется', code: 'practice_question_position_conflict' }),
          })
        }
        return json(route, { question: { ...question(7), questionText: body.questionText } }, 201)
      }
      return route.fallback()
    })

    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/admin/questions', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText(`Показаны 1–${smallBank.length} из ${smallBank.length}`)).toBeVisible({ timeout: 20_000 })

    await page.getByRole('button', { name: 'Вопрос', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByLabel('Порядок *')).toHaveValue('6')

    await dialog.getByPlaceholder('Сформулируйте задание').fill('Новый вопрос про дискриминант')
    await dialog.getByPlaceholder('Вариант A').fill('Один')
    await dialog.getByPlaceholder('Вариант B').fill('Два')
    await dialog.getByPlaceholder('Вариант C').fill('Три')
    await dialog.getByPlaceholder('Вариант D').fill('Четыре')
    await dialog.getByLabel('Правильный вариант A').check()
    await dialog.getByRole('button', { name: 'Добавить вопрос' }).click()

    // The conflict is resolved with the actual current free slot, and the
    // operator's typed question survives the failed save instead of being
    // silently discarded.
    await expect(dialog).toContainText('Свободна позиция 7')
    await expect(dialog.getByLabel('Порядок *')).toHaveValue('7')
    await expect(dialog.getByPlaceholder('Сформулируйте задание')).toHaveValue('Новый вопрос про дискриминант')
    expect(createAttempts).toBe(1)
  })
})
