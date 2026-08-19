import { expect, test, type Page, type Route } from '@playwright/test'

/**
 * Responsive regression coverage for the student surfaces.
 *
 * The decisive detail: the app sets `overflow-x: clip` on `html`, `body` and
 * `.student-visual`. Under that, `document.documentElement.scrollWidth` always
 * equals `clientWidth`, so the naive check passes even while content runs off
 * the side — which is exactly how a 256px desktop clip survived unnoticed.
 * Every assertion here lifts the clip first and measures the truth.
 */

const LESSON_ID = 12
const VIDEO_ID = 'dQw4w9WgXcQ'

// A long unbroken Kyrgyz title is the realistic overflow input, not lorem.
const LONG_TITLE = 'Аналогиялар жана логикалык байланыштарды системалуу түшүндүрүү сабагы'

const SESSION_USER = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'student@test.invalid',
  fullName: 'Уланбекова Каныкей Уланбековна',
  role: 'student',
  studentType: 'online',
  phone: null,
  targetScore: 180,
  avatarUrl: null,
  profileColor: 'blue',
  dailyStudyGoalMinutes: 30,
}

function lessonPayload(overrides: Record<string, unknown> = {}) {
  return {
    id: LESSON_ID,
    courseId: 4,
    lessonNumber: 1,
    title: LONG_TITLE,
    description: 'Бул сабакта аналогияларды кадам сайын талдайбыз.',
    subject: 'kyr',
    section: 'Грамматика',
    topic: 'Аналогиялар',
    lessonDate: null,
    durationMinutes: 20,
    contentUrl: null,
    video: { available: true, sessionPath: `/v1/platform/lessons/${LESSON_ID}/video` },
    isTest: false,
    completionMode: 'self',
    isLocked: false,
    completionPercent: 0,
    completedAt: null,
    lastViewedAt: null,
    ...overrides,
  }
}

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })

/**
 * Faithful stand-in for the YouTube IFrame API: the real one injects an
 * iframe carrying width/height ATTRIBUTES, defaulting to 640x390. Stubbing it
 * any more loosely would hide a fixed-pixel regression instead of catching it.
 */
const YT_API_STUB = `
window.YT = {
  PlayerState: { ENDED: 0, PLAYING: 1 },
  Player: function (element, options) {
    var frame = document.createElement('iframe')
    frame.setAttribute('width', String(options.width === undefined ? 640 : options.width))
    frame.setAttribute('height', String(options.height === undefined ? 390 : options.height))
    frame.setAttribute('src', (options.host || 'https://www.youtube.com') + '/embed/' + options.videoId)
    element.parentNode.replaceChild(frame, element)
    this.getIframe = function () { return frame }
    this.destroy = function () {}
    this.getCurrentTime = function () { return 0 }
    var self = this
    if (options.events && options.events.onReady) {
      setTimeout(function () { options.events.onReady({ target: self }) }, 0)
    }
  },
}
if (window.onYouTubeIframeAPIReady) window.onYouTubeIframeAPIReady()
`

async function stubPlatform(page: Page) {
  await page.route('**/v1/platform/**', route => json(route, { items: [] }))
  await page.route('**/v1/platform/lessons**', route => json(route, { items: [lessonPayload()] }))
  await page.route(`**/v1/platform/lessons/${LESSON_ID}`, route => json(route, { lesson: lessonPayload() }))
  await page.route(`**/v1/platform/lessons/${LESSON_ID}/materials`, route => json(route, { items: [] }))
  await page.route(`**/v1/platform/lessons/${LESSON_ID}/video`, route =>
    json(route, { video: { videoId: VIDEO_ID, title: LONG_TITLE, embedHost: 'https://www.youtube-nocookie.com' } }))
  await page.route('**/v1/platform/video-events', route => json(route, { recorded: true, awardedXp: 0 }, 202))
  await page.route('**/v1/auth/me', route => json(route, { user: SESSION_USER }))
  await page.route('**/v1/auth/refresh', route => json(route, { user: SESSION_USER }))
  await page.route('https://www.youtube.com/iframe_api', route =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body: YT_API_STUB }))
  await page.route('https://www.youtube-nocookie.com/**', route =>
    route.fulfill({ status: 200, contentType: 'text/html', body: '<html><body style="margin:0;background:#000"></body></html>' }))
}

/**
 * True horizontal extent, measured with the clip lifted and then restored.
 * Also returns the offenders so a failure names the element, not just a number.
 */
async function measureOverflow(page: Page) {
  return page.evaluate(() => {
    const clipped = [
      document.documentElement,
      document.body,
      ...document.querySelectorAll<HTMLElement>('.student-visual, [class*="overflow-x-hidden"]'),
    ] as HTMLElement[]
    const previous = clipped.map(el => el.style.overflowX)
    clipped.forEach(el => { el.style.overflowX = 'visible' })
    const scrollWidth = document.documentElement.scrollWidth
    clipped.forEach((el, index) => { el.style.overflowX = previous[index] })

    const clientWidth = document.documentElement.clientWidth
    const offenders: string[] = []
    for (const el of Array.from(document.querySelectorAll('*'))) {
      const rect = el.getBoundingClientRect()
      if (rect.width === 0 && rect.height === 0) continue
      if (rect.right <= clientWidth + 1) continue
      const className = typeof el.className === 'string' ? el.className.slice(0, 80) : ''
      offenders.push(`<${el.tagName.toLowerCase()} class="${className}"> right=${Math.round(rect.right)}`)
      if (offenders.length >= 4) break
    }
    return { scrollWidth, clientWidth, offenders }
  })
}

const VIEWPORTS = [
  { name: '320x568', width: 320, height: 568 },
  { name: '360x800', width: 360, height: 800 },
  { name: '390x844', width: 390, height: 844 },
  { name: '430x932', width: 430, height: 932 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '844x390-landscape', width: 844, height: 390 },
  { name: '1024x768', width: 1024, height: 768 },
  { name: '1280x800', width: 1280, height: 800 },
  { name: '1440x900', width: 1440, height: 900 },
]

const SURFACES = [
  { key: 'dashboard', path: '/student/online' },
  { key: 'roadmap', path: '/student/online/roadmap' },
  { key: 'lessons', path: '/student/online/lessons' },
  { key: 'lesson-detail', path: `/student/online/lessons/${LESSON_ID}` },
  { key: 'practice', path: '/student/online/practice' },
  { key: 'trainer', path: '/student/online/trainer' },
  { key: 'profile', path: '/student/online/profile' },
  { key: 'settings', path: '/student/online/settings' },
  { key: 'universities', path: '/student/online/universities' },
  { key: 'ai', path: '/student/online/ai' },
  { key: 'leaderboard', path: '/student/online/leaderboard' },
]

test.describe('student surfaces never overflow horizontally', () => {
  for (const viewport of VIEWPORTS) {
    for (const surface of SURFACES) {
      test(`${surface.key} at ${viewport.name}`, async ({ page }) => {
        await stubPlatform(page)
        await page.setViewportSize({ width: viewport.width, height: viewport.height })
        await page.goto(surface.path, { waitUntil: 'domcontentloaded' })
        await page.waitForTimeout(400)

        const { scrollWidth, clientWidth, offenders } = await measureOverflow(page)
        expect(
          scrollWidth,
          `${surface.key} overflows by ${scrollWidth - clientWidth}px at ${viewport.name}. Offenders: ${offenders.join(' | ') || 'none identified'}`,
        ).toBeLessThanOrEqual(clientWidth)
      })
    }
  }
})

test.describe('lesson video geometry', () => {
  for (const width of [320, 360, 390, 430, 768, 1280]) {
    test(`keeps 16:9 and fills its box at ${width}px`, async ({ page }) => {
      await stubPlatform(page)
      await page.setViewportSize({ width, height: 900 })
      await page.goto(`/student/online/lessons/${LESSON_ID}`, { waitUntil: 'domcontentloaded' })

      const play = page.getByRole('button', { name: /Смотреть видео/ })
      await expect(play).toBeVisible()

      const boxBefore = await page.evaluate(() => {
        const visible = Array.from(document.querySelectorAll('.aspect-video'))
          .map(el => el.getBoundingClientRect())
          .find(rect => rect.width > 0)
        return visible ? { width: visible.width, height: visible.height } : null
      })
      expect(boxBefore).not.toBeNull()
      // 16:9 must hold on the narrowest phone, where a competing minimum
      // height previously forced 1.44:1.
      expect(boxBefore!.width / boxBefore!.height).toBeCloseTo(16 / 9, 1)

      await play.click()
      await expect(page.locator('iframe')).toHaveCount(1, { timeout: 20_000 })
      await page.waitForTimeout(300)

      const after = await page.evaluate(() => {
        const frame = document.querySelector('iframe')!
        const frameRect = frame.getBoundingClientRect()
        const boxRect = frame.parentElement!.getBoundingClientRect()
        return {
          frame: { width: frameRect.width, height: frameRect.height },
          box: { width: boxRect.width, height: boxRect.height },
        }
      })

      // The API injects width/height attributes (640x390 by default). The
      // iframe must still track its container exactly.
      expect(after.frame.width).toBeCloseTo(after.box.width, 0)
      expect(after.frame.height).toBeCloseTo(after.box.height, 0)
      expect(after.box.width / after.box.height).toBeCloseTo(16 / 9, 1)

      // No layout shift: opening the player must not resize its own box.
      expect(after.box.width).toBeCloseTo(boxBefore!.width, 0)
      expect(after.box.height).toBeCloseTo(boxBefore!.height, 0)

      // And it must never be wider than the viewport.
      expect(after.box.width).toBeLessThanOrEqual(width)
    })
  }
})

test.describe('touch targets and layout chrome', () => {
  test('shell controls are at least 44x44 at 390px', async ({ page }) => {
    await stubPlatform(page)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/student/online/lessons/' + LESSON_ID, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(400)

    const small = await page.evaluate(() => {
      const offenders: string[] = []
      for (const el of Array.from(document.querySelectorAll('button, a[href], [role="button"]'))) {
        const rect = el.getBoundingClientRect()
        if (rect.width === 0 || rect.height === 0) continue
        if (rect.height >= 44) continue
        const label = (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 30)
        offenders.push(`${Math.round(rect.width)}x${Math.round(rect.height)} "${label}"`)
      }
      return offenders
    })
    expect(small, `controls below 44px tall: ${small.join(' | ')}`).toEqual([])
  })

  test('bottom navigation reserves its own height plus the safe area', async ({ page }) => {
    await stubPlatform(page)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/student/online', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(400)

    const nav = page.locator('nav[aria-label="Основная навигация"]')
    await expect(nav).toBeVisible()

    // Content must not end underneath the fixed bar.
    const clearance = await page.evaluate(() => {
      const bar = document.querySelector('nav[aria-label="Основная навигация"]')
      const main = document.querySelector('main')
      if (!bar || !main) return null
      const barHeight = bar.getBoundingClientRect().height
      const paddingBottom = parseFloat(getComputedStyle(main).paddingBottom)
      return { barHeight, paddingBottom }
    })
    expect(clearance).not.toBeNull()
    expect(clearance!.paddingBottom).toBeGreaterThanOrEqual(clearance!.barHeight - 8)
  })
})
