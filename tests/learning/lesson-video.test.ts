import assert from 'node:assert/strict'
import test from 'node:test'

import {
  YOUTUBE_EMBED_HOST,
  YOUTUBE_IFRAME_API_URL,
  parseLessonVideoConfig,
  parseLessonVideoHandle,
  requestLessonVideo,
  reportLessonVideoEvent,
  youtubePlayerVars,
} from '../../lib/lesson-video.ts'
import { parsePlatformLessonDetail } from '../../lib/platform-lessons.ts'

const VIDEO_ID = 'dQw4w9WgXcQ'
const LESSON_SESSION = '/v1/platform/lessons/12/video'

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function installBrowserWindow(): () => void {
  const existing = Object.getOwnPropertyDescriptor(globalThis, 'window')
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {} })
  return () => {
    if (existing) Object.defineProperty(globalThis, 'window', existing)
    else delete (globalThis as { window?: unknown }).window
  }
}

// --- Acceptance test 5: the embed config is the supported, current one ----

test('the player uses the privacy-enhanced host and no deprecated parameter', () => {
  assert.equal(YOUTUBE_EMBED_HOST, 'https://www.youtube-nocookie.com')
  // The IFrame API itself is only served from the documented origin; the
  // `host` option is what routes the embed to the nocookie domain.
  assert.equal(YOUTUBE_IFRAME_API_URL, 'https://www.youtube.com/iframe_api')

  const vars = youtubePlayerVars('https://platform.zhangak.com')
  assert.equal(vars.enablejsapi, 1)
  assert.equal(vars.playsinline, 1)
  assert.equal(vars.rel, 0)
  assert.equal(vars.origin, 'https://platform.zhangak.com')
  for (const deprecated of ['modestbranding', 'showinfo', 'autohide']) {
    assert.ok(!Object.hasOwn(vars, deprecated), `${deprecated} is deprecated and must not be sent`)
  }
})

test('a downgraded embed host is rejected instead of silently accepted', () => {
  assert.throws(
    () => parseLessonVideoConfig({ video: { videoId: VIDEO_ID, title: 'Урок', embedHost: 'https://www.youtube.com' } }),
    /источник видео/,
  )
})

// --- Acceptance test 4 on the client side --------------------------------

test('a lesson payload is accepted only as a session handle, never as a URL', () => {
  const handle = parseLessonVideoHandle({ available: true, sessionPath: LESSON_SESSION }, 'lesson')
  assert.deepEqual(handle, { sessionPath: LESSON_SESSION })
  assert.equal(parseLessonVideoHandle(null, 'lesson'), null)
  assert.equal(parseLessonVideoHandle({ available: false }, 'lesson'), null)

  const rejected = [
    { available: true, sessionPath: 'https://www.youtube.com/watch?v=' + VIDEO_ID },
    { available: true, sessionPath: '/v1/platform/materials/12/video' },
    { available: true, sessionPath: '/v1/platform/lessons/12/content' },
    { available: true, sessionPath: '//evil.example/v1/platform/lessons/12/video' },
    { available: true },
  ]
  for (const value of rejected) {
    assert.throws(() => parseLessonVideoHandle(value, 'lesson'), Error, `should reject ${JSON.stringify(value)}`)
  }
  // A material handle must not be usable where a lesson handle is expected.
  assert.throws(() => parseLessonVideoHandle({ available: true, sessionPath: LESSON_SESSION }, 'material'), Error)
})

test('a lesson detail carrying a raw watch URL in `video` is refused', () => {
  const base = {
    id: 12, courseId: 4, lessonNumber: 2, title: 'Дроби', description: null, subject: 'math',
    section: null, topic: null, lessonDate: null, durationMinutes: null, contentUrl: null,
    isTest: false, completionMode: 'self', isLocked: false, completionPercent: 0,
    completedAt: null, lastViewedAt: null,
  }
  const good = parsePlatformLessonDetail({ lesson: { ...base, video: { available: true, sessionPath: LESSON_SESSION } } })
  assert.deepEqual(good.video, { sessionPath: LESSON_SESSION })

  assert.throws(
    () => parsePlatformLessonDetail({ lesson: { ...base, video: { available: true, sessionPath: `https://youtu.be/${VIDEO_ID}` } } }),
    /путь видео/,
  )
})

// --- Acceptance test 9: a revoked session yields no player config --------

test('the config is fetched by POST from the session path and needs a live session', async () => {
  const restoreWindow = installBrowserWindow()
  const originalFetch = globalThis.fetch
  const calls: Array<{ path: string, method: string | undefined }> = []
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ path: String(input), method: init?.method })
    return json({ video: { videoId: VIDEO_ID, title: 'Дроби', embedHost: YOUTUBE_EMBED_HOST } })
  }) as typeof fetch
  try {
    const config = await requestLessonVideo({ sessionPath: LESSON_SESSION })
    assert.deepEqual(config, { videoId: VIDEO_ID, title: 'Дроби', embedHost: YOUTUBE_EMBED_HOST })
    assert.deepEqual(calls, [{ path: LESSON_SESSION, method: 'POST' }])
  } finally {
    globalThis.fetch = originalFetch
    restoreWindow()
  }
})

test('a signed-out or revoked session gets an error, never a fallback video id', async () => {
  const restoreWindow = installBrowserWindow()
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async () => json({ error: 'unauthorized' }, 401)) as typeof fetch
  try {
    await assert.rejects(requestLessonVideo({ sessionPath: LESSON_SESSION }))
  } finally {
    globalThis.fetch = originalFetch
    restoreWindow()
  }
})

// --- Acceptance test 8 on the client side --------------------------------

test('a playback report sends no reward field and returns nothing usable', async () => {
  const restoreWindow = installBrowserWindow()
  const originalFetch = globalThis.fetch
  let sent: Record<string, unknown> = {}
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    sent = JSON.parse(String(init?.body))
    return json({ recorded: true, awardedXp: 0 }, 202)
  }) as typeof fetch
  try {
    const result = await reportLessonVideoEvent({ lessonId: 12, materialId: null, event: 'ended', positionSeconds: 610.7 })
    // No value is returned, so no caller can mistake this for a grade.
    assert.equal(result, undefined)
    assert.deepEqual(Object.keys(sent).sort(), ['event', 'lessonId', 'materialId', 'positionSeconds'])
    assert.equal(sent.positionSeconds, 610)
    for (const forbidden of ['studentId', 'xp', 'stars', 'completed', 'score']) {
      assert.ok(!Object.hasOwn(sent, forbidden), `a playback report must not send ${forbidden}`)
    }
  } finally {
    globalThis.fetch = originalFetch
    restoreWindow()
  }
})

test('a reported position is clamped to the server-accepted range', async () => {
  const restoreWindow = installBrowserWindow()
  const originalFetch = globalThis.fetch
  const positions: unknown[] = []
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    positions.push(JSON.parse(String(init?.body)).positionSeconds)
    return json({ recorded: true, awardedXp: 0 }, 202)
  }) as typeof fetch
  try {
    await reportLessonVideoEvent({ lessonId: 12, materialId: null, event: 'started', positionSeconds: -5 })
    await reportLessonVideoEvent({ lessonId: 12, materialId: null, event: 'ended', positionSeconds: 999_999 })
    assert.deepEqual(positions, [0, 86_400])
  } finally {
    globalThis.fetch = originalFetch
    restoreWindow()
  }
})
