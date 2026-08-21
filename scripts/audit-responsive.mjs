import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

import { chromium } from '@playwright/test'

/**
 * Responsive audit harness.
 *
 * Diagnostic tool, not a test: it visits every active student surface at every
 * required viewport, measures real overflow, names the offending DOM nodes and
 * the CSS that produced them, and writes full-page screenshots.
 *
 * The YouTube IFrame API is replaced by a faithful local stand-in that creates
 * the iframe exactly the way the real API does — including its default
 * `width="640" height="390"` attributes — so the audit reproduces production
 * layout without depending on the public internet.
 *
 *   node scripts/audit-responsive.mjs [--out <dir>] [--base http://127.0.0.1:3311]
 */

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function arg(name, fallback) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : fallback
}

const baseUrl = arg('--base', 'http://127.0.0.1:3311')
const outDir = path.resolve(arg('--out', path.join(projectRoot, 'artifacts', 'responsive-audit')))

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

const LESSON_ID = 12
const VIDEO_ID = 'dQw4w9WgXcQ'

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

// Deliberately long Kyrgyz/Russian strings: long words are a documented
// overflow cause and must be part of the audit, not an afterthought.
const LONG_TITLE = 'Аналогиялар жана логикалык байланыштарды системалуу түшүндүрүү сабагы'

function lessonPayload(overrides = {}) {
  return {
    id: LESSON_ID,
    courseId: 4,
    lessonNumber: 1,
    title: LONG_TITLE,
    description: 'Бул сабакта аналогияларды кадам сайын талдайбыз жана практикалык мисалдарды чогуу чечебиз.',
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

const json = (route, body, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })

/**
 * A stand-in for https://www.youtube.com/iframe_api.
 *
 * It reproduces the part that matters for layout: the real API replaces the
 * target element with an iframe that carries width/height ATTRIBUTES, which
 * default to 640x390 when the caller passes none.
 */
const YT_API_STUB = `
window.YT = {
  PlayerState: { ENDED: 0, PLAYING: 1 },
  Player: function (element, options) {
    var frame = document.createElement('iframe')
    var width = options.width === undefined ? 640 : options.width
    var height = options.height === undefined ? 390 : options.height
    frame.setAttribute('width', String(width))
    frame.setAttribute('height', String(height))
    frame.setAttribute('src', (options.host || 'https://www.youtube.com') + '/embed/' + options.videoId)
    frame.setAttribute('frameborder', '0')
    element.parentNode.replaceChild(frame, element)
    this.getIframe = function () { return frame }
    this.destroy = function () { if (frame.parentNode) frame.parentNode.removeChild(frame) }
    this.getCurrentTime = function () { return 0 }
    var self = this
    if (options.events && options.events.onReady) {
      setTimeout(function () { options.events.onReady({ target: self }) }, 0)
    }
  },
}
if (window.onYouTubeIframeAPIReady) window.onYouTubeIframeAPIReady()
`

async function stubApi(page, options = {}) {
  await page.route('**/v1/platform/**', route => json(route, { items: [] }))
  await page.route('**/v1/platform/lessons**', route => json(route, { items: [lessonPayload()] }))
  await page.route(`**/v1/platform/lessons/${LESSON_ID}`, route => json(route, { lesson: lessonPayload() }))
  await page.route(`**/v1/platform/lessons/${LESSON_ID}/materials`, route => json(route, { items: [] }))
  await page.route(`**/v1/platform/lessons/${LESSON_ID}/video`, route => (
    options.videoStatus && options.videoStatus !== 200
      ? json(route, { error: 'unauthorized' }, options.videoStatus)
      : json(route, { video: { videoId: VIDEO_ID, title: LONG_TITLE, embedHost: 'https://www.youtube-nocookie.com' } })
  ))
  await page.route('**/v1/platform/video-events', route => json(route, { recorded: true, awardedXp: 0 }, 202))
  await page.route('**/v1/auth/me', route => json(route, { user: SESSION_USER }))
  await page.route('**/v1/auth/refresh', route => json(route, { user: SESSION_USER }))
  await page.route('https://www.youtube.com/iframe_api', route =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body: YT_API_STUB }))
  await page.route('https://www.youtube-nocookie.com/**', route =>
    route.fulfill({ status: 200, contentType: 'text/html', body: '<html><body style="margin:0;background:#000"></body></html>' }))
  await page.route('https://www.youtube.com/**', route =>
    route.fulfill({ status: 200, contentType: 'text/html', body: '<html><body></body></html>' }))
}

/**
 * Names every element that is wider than the viewport, together with the CSS
 * that made it so. Reporting "the page overflows" without the node and the
 * property is not actionable.
 */
const OVERFLOW_PROBE = `(() => {
  // The app sets \`overflow-x: clip\` on html/body and .student-visual. That
  // makes scrollWidth equal clientWidth even when content genuinely runs off
  // the side, so measuring it directly reports a comfortable lie. The clip is
  // lifted, the true width recorded, then restored.
  const clipped = [document.documentElement, document.body, ...document.querySelectorAll('.student-visual, [class*="overflow-x-hidden"]')]
  const previous = clipped.map(el => el.style.overflowX)
  clipped.forEach(el => { el.style.overflowX = 'visible' })
  const trueScrollWidth = document.documentElement.scrollWidth
  clipped.forEach((el, i) => { el.style.overflowX = previous[i] })

  const docWidth = document.documentElement.clientWidth
  const offenders = []
  for (const el of document.querySelectorAll('*')) {
    const rect = el.getBoundingClientRect()
    if (rect.width === 0 && rect.height === 0) continue
    const overhang = Math.round(rect.right - docWidth)
    const tooWide = Math.round(rect.width - docWidth)
    if (overhang <= 1 && tooWide <= 1) continue
    const style = getComputedStyle(el)
    offenders.push({
      tag: el.tagName.toLowerCase(),
      id: el.id || null,
      className: typeof el.className === 'string' ? el.className.slice(0, 160) : null,
      attrWidth: el.getAttribute('width'),
      attrHeight: el.getAttribute('height'),
      rectWidth: Math.round(rect.width),
      rectRight: Math.round(rect.right),
      overhangPx: overhang,
      widerThanViewportPx: tooWide,
      css: {
        width: style.width,
        minWidth: style.minWidth,
        maxWidth: style.maxWidth,
        position: style.position,
        display: style.display,
        aspectRatio: style.aspectRatio,
        minHeight: style.minHeight,
        overflowX: style.overflowX,
        whiteSpace: style.whiteSpace,
        flexShrink: style.flexShrink,
      },
      text: (el.textContent || '').trim().slice(0, 60),
    })
  }
  // Deepest-first: an overflowing child explains its parents.
  offenders.sort((a, b) => b.overhangPx - a.overhangPx)
  return {
    scrollWidth: trueScrollWidth,
    clippedScrollWidth: document.documentElement.scrollWidth,
    clientWidth: docWidth,
    offenders: offenders.slice(0, 12),
  }
})()`

/** Touch targets below the 44x44 minimum. */
const TOUCH_PROBE = `(() => {
  const small = []
  for (const el of document.querySelectorAll('button, a[href], [role="button"], input, select')) {
    const rect = el.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) continue
    if (rect.width >= 44 && rect.height >= 44) continue
    small.push({
      tag: el.tagName.toLowerCase(),
      className: typeof el.className === 'string' ? el.className.slice(0, 100) : null,
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      label: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 40),
    })
  }
  return small.slice(0, 10)
})()`

const SURFACES = [
  { key: 'login', path: '/login', auth: false },
  { key: 'onboarding', path: '/onboarding', auth: false },
  { key: 'offline-login', path: '/offline', auth: false },
  { key: 'dashboard', path: '/student/online' },
  { key: 'roadmap', path: '/student/online/roadmap' },
  { key: 'lessons', path: '/student/online/lessons' },
  { key: 'lesson-detail', path: `/student/online/lessons/${LESSON_ID}` },
  { key: 'lesson-video-open', path: `/student/online/lessons/${LESSON_ID}`, openVideo: true },
  { key: 'lesson-video-error', path: `/student/online/lessons/${LESSON_ID}`, openVideo: true, videoStatus: 401 },
  { key: 'practice', path: '/student/online/practice' },
  { key: 'trainer', path: '/student/online/trainer' },
  { key: 'mock', path: '/student/online/mock' },
  { key: 'profile', path: '/student/online/profile' },
  { key: 'settings', path: '/student/online/settings' },
  { key: 'universities', path: '/student/online/universities' },
  { key: 'leaderboard', path: '/student/online/leaderboard' },
]

async function main() {
  await mkdir(outDir, { recursive: true })
  const browser = await chromium.launch()
  const findings = []

  for (const viewport of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: 1,
    })
    for (const surface of SURFACES) {
      const page = await context.newPage()
      await stubApi(page, { videoStatus: surface.videoStatus })
      try {
        await page.goto(`${baseUrl}${surface.path}`, { waitUntil: 'domcontentloaded', timeout: 30_000 })
        await page.waitForTimeout(700)

        if (surface.openVideo) {
          const play = page.getByRole('button', { name: /Смотреть видео/ })
          if (await play.count()) {
            await play.first().click()
            await page.waitForTimeout(1200)
          }
        }

        const overflow = await page.evaluate(OVERFLOW_PROBE)
        const touch = await page.evaluate(TOUCH_PROBE)
        const overflows = overflow.scrollWidth > overflow.clientWidth

        findings.push({
          viewport: viewport.name,
          surface: surface.key,
          path: surface.path,
          scrollWidth: overflow.scrollWidth,
          clientWidth: overflow.clientWidth,
          overflowPx: overflow.scrollWidth - overflow.clientWidth,
          overflows,
          offenders: overflow.offenders,
          smallTouchTargets: touch,
        })

        if (overflows || surface.openVideo) {
          const dir = path.join(outDir, viewport.name)
          await mkdir(dir, { recursive: true })
          await page.screenshot({ path: path.join(dir, `${surface.key}.png`), fullPage: true })
        }
      } catch (error) {
        findings.push({ viewport: viewport.name, surface: surface.key, error: String(error).split('\n')[0] })
      } finally {
        await page.close()
      }
    }
    await context.close()
  }

  await browser.close()
  await writeFile(path.join(outDir, 'findings.json'), JSON.stringify(findings, null, 2), 'utf8')

  const broken = findings.filter(f => f.overflows)
  console.log(`\nSurfaces audited: ${findings.length}`)
  console.log(`Horizontal overflow: ${broken.length}`)
  for (const f of broken) {
    console.log(`\n  ${f.viewport}  ${f.surface}  +${f.overflowPx}px (${f.scrollWidth} > ${f.clientWidth})`)
    for (const o of f.offenders.slice(0, 3)) {
      console.log(`     <${o.tag}> w=${o.rectWidth} overhang=${o.overhangPx}px attrW=${o.attrWidth ?? '-'} css.width=${o.css.width} minW=${o.css.minWidth} ar=${o.css.aspectRatio}`)
      if (o.className) console.log(`        class="${o.className}"`)
    }
  }
  const smalls = findings.filter(f => (f.smallTouchTargets ?? []).length > 0)
  console.log(`\nSurfaces with sub-44px touch targets: ${smalls.length}`)
  console.log(`\nArtifacts: ${outDir}`)
  process.exitCode = 0
}

await main()
