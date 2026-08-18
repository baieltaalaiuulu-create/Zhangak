import assert from 'node:assert/strict'
import test from 'node:test'

import {
  completePlatformLesson,
  completedPlatformLessonIds,
  computePlatformLessonStatuses,
  parsePlatformLessonDetail,
  parsePlatformLessons,
  platformLessonCompletionStreak,
} from '../../lib/platform-lessons.ts'

const LESSON = {
  id: 12,
  courseId: 4,
  lessonNumber: 2,
  title: 'Дроби',
  description: 'Сложение дробей',
  subject: 'math',
  section: 'algebra',
  topic: 'fractions',
  lessonDate: '2026-08-13',
  durationMinutes: 35,
  contentUrl: 'https://www.youtube.com/watch?v=abcdefghijk',
  isTest: false,
  completionMode: 'self',
  isLocked: false,
  completionPercent: 100,
  completedAt: '2026-08-13T08:00:00.000Z',
  lastViewedAt: '2026-08-13T08:00:00.000Z',
}

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

test('lesson parser maps the first-party DTO without accepting legacy row names', () => {
  const lesson = parsePlatformLessonDetail({ lesson: LESSON })
  assert.equal(lesson.id, '12')
  assert.equal(lesson.apiId, 12)
  assert.equal(lesson.order_number, 2)
  assert.equal(lesson.video_url, LESSON.contentUrl)
  assert.equal(lesson.subject, 'math')
  assert.equal(lesson.completionMode, 'self')
  assert.equal(lesson.isLocked, false)

  assert.throws(
    () => parsePlatformLessonDetail({ lesson: { ...LESSON, id: undefined, lesson_number: 2 } }),
    /id урока/,
  )
})

test('lesson list parser accepts an honest empty catalog and rejects unsafe material URLs', () => {
  assert.deepEqual(parsePlatformLessons({ items: [] }), [])
  assert.throws(
    () => parsePlatformLessons({ items: [{ ...LESSON, contentUrl: 'javascript:alert(1)' }] }),
    /ссылка на материал/,
  )
  assert.throws(
    () => parsePlatformLessons({ items: [{ ...LESSON, completionPercent: 101 }] }),
    /прогресс урока/,
  )
  assert.throws(
    () => parsePlatformLessons({ items: [{ ...LESSON, completionMode: 'browser-score' }] }),
    /способ завершения урока/,
  )
})

test('status and streak use only authoritative backend lock and progress fields', () => {
  const lessons = parsePlatformLessons({
    items: [
      LESSON,
      { ...LESSON, id: 13, lessonNumber: 3, title: 'Проценты', completionPercent: 25, completedAt: null, isLocked: false },
      { ...LESSON, id: 14, lessonNumber: 4, title: 'Уравнения', completionPercent: 0, completedAt: null, isLocked: true },
      { ...LESSON, id: 15, lessonNumber: 1, title: 'Сүйлөм', subject: 'kyr', completionPercent: 0, completedAt: null, isLocked: false },
      { ...LESSON, id: 16, courseId: 5, lessonNumber: 1, title: 'Геометрия', completionPercent: 0, completedAt: null, isLocked: false },
    ],
  })

  const completed = completedPlatformLessonIds(lessons)
  assert.deepEqual([...completed], ['12'])
  assert.deepEqual(computePlatformLessonStatuses(lessons, completed), {
    '12': 'done',
    '13': 'current',
    '14': 'locked',
    '15': 'current',
    '16': 'current',
  })
  assert.equal(platformLessonCompletionStreak(lessons, new Date('2026-08-13T12:00:00.000Z')), 1)
})

test('self-paced completion sends no progress authority outside the first-party BFF', async () => {
  const restoreWindow = installBrowserWindow()
  const originalFetch = globalThis.fetch
  const calls: { input: string; init?: RequestInit }[] = []
  globalThis.fetch = async (input, init) => {
    calls.push({ input: String(input), init })
    return json({ lesson: LESSON })
  }

  try {
    assert.equal((await completePlatformLesson('12')).completedAt, LESSON.completedAt)
    assert.deepEqual(calls.map(call => call.input), ['/v1/platform/lessons/12/complete'])
    assert.equal(calls[0].init?.method, 'POST')
    assert.equal(calls[0].init?.credentials, 'include')
    assert.deepEqual(JSON.parse(String(calls[0].init?.body)), {})
  } finally {
    globalThis.fetch = originalFetch
    restoreWindow()
  }
})
