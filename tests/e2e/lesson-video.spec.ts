import { expect, test, type Page, type Route } from '@playwright/test'

/**
 * Rendered acceptance coverage for the lesson video player (F6).
 *
 * What is real here: the production Next.js build, the real React components,
 * real layout measurement, real keyboard and focus behaviour, and the real
 * network requests the browser would make.
 *
 * What is stubbed: the first-party `/v1` API and the YouTube origins. Server
 * authorization is proven separately against PostgreSQL in
 * backend/test/lesson-video-integration.test.js — this file must not be read
 * as evidence that the server enforces anything.
 */

const LESSON_ID = 12
const VIDEO_ID = 'dQw4w9WgXcQ'
const LESSON_PATH = `/student/online/lessons/${LESSON_ID}`

const SESSION_USER = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'student@test.invalid',
  fullName: 'Тестовый Ученик',
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
    title: 'Аналогиялар жана логикалык байланыштар',
    description: 'Разбор темы.',
    subject: 'kyr',
    section: null,
    topic: null,
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

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
}

/**
 * Faithful stand-in for the YouTube IFrame API. It must actually define
 * `window.YT` and inject an iframe carrying width/height ATTRIBUTES, the way
 * the real API does. The earlier stub only fired the ready callback, so the
 * player never mounted and these assertions were weaker than they looked.
 */
const YT_API_STUB = `
window.YT = {
  PlayerState: { ENDED: 0, PLAYING: 1 },
  Player: function (element, options) {
    var frame = document.createElement('iframe')
    frame.setAttribute('width', String(options.width === undefined ? 640 : options.width))
    frame.setAttribute('height', String(options.height === undefined ? 390 : options.height))
    var params = 'enablejsapi=1&playsinline=1&rel=0&origin=' + encodeURIComponent(location.origin)
    frame.setAttribute('src', (options.host || 'https://www.youtube.com') + '/embed/' + options.videoId + '?' + params)
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

/** Records every request the page attempts against a YouTube origin. */
function trackYoutube(page: Page): string[] {
  const seen: string[] = []
  page.on('request', request => {
    const url = request.url()
    if (/youtube\.com|youtu\.be|youtube-nocookie\.com|ytimg\.com/.test(url)) seen.push(url)
  })
  return seen
}

async function stubPlatform(page: Page, options: { videoStatus?: number } = {}) {
  // Playwright matches the most recently registered route first, so these are
  // ordered broadest to most specific on purpose.
  await page.route('**/v1/platform/**', route => json(route, { items: [] }))
  await page.route('**/v1/platform/lessons**', route => json(route, { items: [lessonPayload()] }))
  await page.route(`**/v1/platform/lessons/${LESSON_ID}`, route => json(route, { lesson: lessonPayload() }))
  await page.route(`**/v1/platform/lessons/${LESSON_ID}/materials`, route => json(route, { items: [] }))
  await page.route(`**/v1/platform/lessons/${LESSON_ID}/video`, route => (
    options.videoStatus && options.videoStatus !== 200
      ? json(route, { error: 'unauthorized' }, options.videoStatus)
      : json(route, { video: { videoId: VIDEO_ID, title: 'Аналогиялар', embedHost: 'https://www.youtube-nocookie.com' } })
  ))
  await page.route('**/v1/platform/video-events', route => json(route, { recorded: true, awardedXp: 0 }, 202))
  await page.route('**/v1/auth/me', route => json(route, { user: SESSION_USER }))
  await page.route('**/v1/auth/refresh', route => json(route, { user: SESSION_USER }))
  // Keep the iframe local so the suite never depends on the public internet.
  await page.route('https://www.youtube-nocookie.com/**', route =>
    route.fulfill({ status: 200, contentType: 'text/html', body: '<html><body>stub player</body></html>' }))
  await page.route('https://www.youtube.com/**', route =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body: YT_API_STUB }))
}

const WIDTHS = [320, 360, 390, 430, 768, 1280]

test.describe('lesson video player', () => {
  for (const width of WIDTHS) {
    test(`renders without horizontal overflow at ${width}px`, async ({ page }) => {
      await stubPlatform(page)
      await page.setViewportSize({ width, height: 900 })
      await page.goto(LESSON_PATH)

      const play = page.getByRole('button', { name: /Смотреть видео/ })
      await expect(play).toBeVisible()

      // The decisive layout assertion: the document must not scroll sideways.
      const overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }))
      expect(overflow.scrollWidth, `page must not overflow at ${width}px`).toBeLessThanOrEqual(overflow.clientWidth)

      // 16:9 is the contract at every width. YouTube's recommended 200x200
      // player area cannot coexist with it below 356px (a 16:9 box only
      // reaches 200px tall once it is 356px wide), and a stretched video is a
      // worse outcome than a short one.
      const box = await play.boundingBox()
      expect(box).not.toBeNull()
      expect(box!.width / box!.height).toBeCloseTo(16 / 9, 1)
      expect(box!.width).toBeLessThanOrEqual(width)
    })
  }

  test('sends nothing to YouTube before the student presses play', async ({ page }) => {
    await stubPlatform(page)
    const youtube = trackYoutube(page)
    await page.setViewportSize({ width: 390, height: 900 })
    await page.goto(LESSON_PATH)
    await expect(page.getByRole('button', { name: /Смотреть видео/ })).toBeVisible()
    await page.waitForTimeout(500)
    expect(youtube, 'no third-party request may precede the click').toEqual([])
  })

  test('play is reachable by keyboard and shows a visible focus ring', async ({ page }) => {
    await stubPlatform(page)
    await page.setViewportSize({ width: 390, height: 900 })
    await page.goto(LESSON_PATH)
    const play = page.getByRole('button', { name: /Смотреть видео/ })
    await expect(play).toBeVisible()

    await play.focus()
    await expect(play).toBeFocused()

    const outline = await play.evaluate(element => {
      const style = getComputedStyle(element)
      return { width: style.outlineWidth, style: style.outlineStyle }
    })
    expect(outline.style, 'focus must be visible, not suppressed').not.toBe('none')
    expect(parseFloat(outline.width)).toBeGreaterThan(0)
  })

  test('Enter activates play and the embed loads from the nocookie host', async ({ page }) => {
    await stubPlatform(page)
    const youtube = trackYoutube(page)
    await page.setViewportSize({ width: 390, height: 900 })
    await page.goto(LESSON_PATH)

    const play = page.getByRole('button', { name: /Смотреть видео/ })
    await play.focus()
    await page.keyboard.press('Enter')

    const frame = page.locator('iframe')
    await expect(frame).toHaveCount(1, { timeout: 20_000 })
    const src = await frame.getAttribute('src')
    expect(src, 'the embed must use the privacy-enhanced host').toContain('youtube-nocookie.com')
    expect(src).toContain(VIDEO_ID)
    expect(src).toContain('enablejsapi=1')
    expect(src).toContain('playsinline=1')
    expect(src).toContain('rel=0')
    expect(src).toContain(`origin=${encodeURIComponent('http://127.0.0.1:3311')}`)
    for (const deprecated of ['modestbranding', 'showinfo', 'autohide']) {
      expect(src, `${deprecated} is deprecated`).not.toContain(deprecated)
    }
    await expect(frame).toHaveAttribute('title', /.+/)
    expect(youtube.length, 'YouTube is contacted only after the click').toBeGreaterThan(0)
  })

  test('Space also activates play', async ({ page }) => {
    await stubPlatform(page)
    await page.setViewportSize({ width: 390, height: 900 })
    await page.goto(LESSON_PATH)
    const play = page.getByRole('button', { name: /Смотреть видео/ })
    await play.focus()
    await page.keyboard.press('Space')
    await expect(page.locator('iframe')).toHaveCount(1, { timeout: 20_000 })
  })

  test('a revoked session yields an honest retry state, never a player', async ({ page }) => {
    // 401 from the scoped video session is what a logged-out or revoked
    // student receives. No video id may appear anywhere in the page.
    await stubPlatform(page, { videoStatus: 401 })
    await page.setViewportSize({ width: 390, height: 900 })
    await page.goto(LESSON_PATH)

    await page.getByRole('button', { name: /Смотреть видео/ }).click()
    await expect(
      page.getByRole('alert').filter({ hasText: 'Видео сейчас не открывается' }),
    ).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('button', { name: /Попробовать снова/ })).toBeVisible()
    await expect(page.locator('iframe')).toHaveCount(0)
    expect(await page.content()).not.toContain(VIDEO_ID)
  })

  test('a lesson with no video shows no player and no watch link', async ({ page }) => {
    await stubPlatform(page)
    await page.route(`**/v1/platform/lessons/${LESSON_ID}`, route =>
      json(route, { lesson: lessonPayload({ video: null, contentUrl: null }) }))
    await page.setViewportSize({ width: 390, height: 900 })
    await page.goto(LESSON_PATH)

    await expect(page.getByRole('button', { name: /Смотреть видео/ })).toHaveCount(0)
    await expect(page.locator('iframe')).toHaveCount(0)
    // Read through the settled DOM rather than page.content(), which can race
    // with client navigation and fail for reasons unrelated to the assertion.
    const html = await page.locator('body').innerHTML()
    expect(html).not.toContain('youtube.com/watch')
    expect(html).not.toContain('youtu.be/')
  })

  test('the page never offers its own link out to YouTube', async ({ page }) => {
    await stubPlatform(page)
    await page.setViewportSize({ width: 390, height: 900 })
    await page.goto(LESSON_PATH)
    const outbound = page.locator('a[href*="youtube.com"], a[href*="youtu.be"]')
    await expect(outbound).toHaveCount(0)
  })
})
