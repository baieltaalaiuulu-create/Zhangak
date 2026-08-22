import assert from 'node:assert/strict'
import test from 'node:test'

import {
  archiveAdminPracticeQuestion,
  createAdminCoursePracticeTest,
  createAdminLessonPracticeTest,
  createAdminPracticeQuestion,
  getAdminPracticeTest,
  listAllAdminPracticeQuestions,
  listAdminCoursePracticeTests,
  listAdminLessonPracticeTests,
  listAdminPracticeQuestions,
  parseAdminPracticeQuestion,
  parseAdminPracticeQuestionList,
  parseAdminPracticeTestList,
  restoreAdminPracticeQuestion,
  updateAdminPracticeQuestion,
  updateAdminPracticeTest,
} from '../../lib/admin-assessments-client.ts'

const TEST = {
  id: 18,
  courseId: 4,
  lessonId: null,
  title: 'Квадратные уравнения',
  subject: 'Математика',
  testType: 'practice',
  description: 'Проверяем дискриминант',
  timeLimitSeconds: 1_200,
  maxAttempts: 3,
  passScoreRatio: 0.7,
  isPublished: false,
  availableFrom: null,
  availableUntil: null,
  questionCount: 1,
  activeQuestionCount: 1,
  createdAt: '2026-08-13T08:00:00.000Z',
  updatedAt: '2026-08-13T08:00:00.000Z',
}

const QUESTION = {
  id: 51,
  practiceTestId: 18,
  questionText: 'Чему равен дискриминант x² − 3x + 2?',
  options: { a: '1', b: '2', c: '3', d: '4' },
  correctAnswer: 'a',
  explanation: 'D = b² − 4ac = 1.',
  section: 'algebra',
  topic: 'Квадратные уравнения',
  difficulty: 'medium',
  imageUrl: null,
  position: 1,
  isActive: true,
  createdAt: '2026-08-13T08:00:00.000Z',
  updatedAt: '2026-08-13T08:00:00.000Z',
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

test('admin assessment parsers accept only strict admin-only test and question DTOs', () => {
  assert.deepEqual(parseAdminPracticeTestList({ items: [TEST], total: 1, limit: 50, offset: 0 }), {
    items: [TEST], total: 1, limit: 50, offset: 0,
  })
  assert.deepEqual(parseAdminPracticeQuestionList({ practiceTestId: 18, items: [QUESTION], total: 1, limit: 50, offset: 0, nextAvailablePosition: 2 }), {
    practiceTestId: 18, items: [QUESTION], total: 1, limit: 50, offset: 0, nextAvailablePosition: 2,
  })
  // A full test (all 200 slots taken) reports no free position rather than a
  // number the caller would have to treat as magic.
  assert.deepEqual(parseAdminPracticeQuestionList({ practiceTestId: 18, items: [QUESTION], total: 1, limit: 50, offset: 0, nextAvailablePosition: null }).nextAvailablePosition, null)
  assert.throws(
    () => parseAdminPracticeQuestionList({ practiceTestId: 18, items: [QUESTION], total: 1, limit: 50, offset: 0, nextAvailablePosition: 0 }),
    /свободная позиция вопроса/,
  )
  assert.throws(
    () => parseAdminPracticeQuestion({ ...QUESTION, options: { a: '1', b: '2', c: '3', extra: '4' } }),
    /варианты вопроса/,
  )
  assert.throws(
    () => parseAdminPracticeQuestion({ ...QUESTION, correctAnswer: 'A' }),
    /правильный ответ/,
  )
  assert.throws(
    () => parseAdminPracticeQuestionList({ practiceTestId: 18, items: [{ ...QUESTION, practiceTestId: 19 }], total: 1, limit: 50, offset: 0, nextAvailablePosition: 2 }),
    /не совпадает со списком/,
  )
})

test('assessment editor operations stay inside first-party admin BFF routes', async () => {
  const restoreWindow = installBrowserWindow()
  const originalFetch = globalThis.fetch
  const calls: { input: string; init?: RequestInit }[] = []
  globalThis.fetch = async (input, init) => {
    const path = String(input)
    calls.push({ input: path, init })
    if (path === '/v1/admin/courses/4/practice-tests?limit=50') return json({ items: [TEST], total: 1, limit: 50, offset: 0 })
    if (path === '/v1/admin/lessons/9/practice-tests?limit=50') return json({ items: [{ ...TEST, lessonId: 9 }], total: 1, limit: 50, offset: 0 })
    if (path === '/v1/admin/practice-tests/18' && !init?.method) return json({ practiceTest: TEST })
    if (path === '/v1/admin/practice-tests/18/questions?limit=50') return json({ practiceTestId: 18, items: [QUESTION], total: 1, limit: 50, offset: 0, nextAvailablePosition: 2 })
    if (path === '/v1/admin/courses/4/practice-tests' && init?.method === 'POST') return json({ practiceTest: TEST }, 201)
    if (path === '/v1/admin/lessons/9/practice-tests' && init?.method === 'POST') return json({ practiceTest: { ...TEST, lessonId: 9 } }, 201)
    if (path === '/v1/admin/practice-tests/18' && init?.method === 'PATCH') return json({ practiceTest: TEST })
    if (path === '/v1/admin/practice-tests/18/questions' && init?.method === 'POST') return json({ question: QUESTION }, 201)
    if (path === '/v1/admin/practice-questions/51' && init?.method === 'PATCH') return json({ question: QUESTION })
    throw new Error(`Unexpected request ${path}`)
  }

  try {
    await listAdminCoursePracticeTests(4, { limit: 50 })
    await listAdminLessonPracticeTests(9, { limit: 50 })
    await getAdminPracticeTest(18)
    await listAdminPracticeQuestions(18, { limit: 50 })
    await createAdminCoursePracticeTest(4, { title: TEST.title, subject: TEST.subject, isPublished: false })
    await createAdminLessonPracticeTest(9, { title: TEST.title, subject: TEST.subject, testType: 'mock' })
    await updateAdminPracticeTest(18, { isPublished: true })
    await createAdminPracticeQuestion(18, {
      questionText: QUESTION.questionText,
      options: QUESTION.options,
      correctAnswer: 'a',
      position: 1,
    })
    await updateAdminPracticeQuestion(51, { isActive: false })

    assert.deepEqual(calls.map(call => call.input), [
      '/v1/admin/courses/4/practice-tests?limit=50',
      '/v1/admin/lessons/9/practice-tests?limit=50',
      '/v1/admin/practice-tests/18',
      '/v1/admin/practice-tests/18/questions?limit=50',
      '/v1/admin/courses/4/practice-tests',
      '/v1/admin/lessons/9/practice-tests',
      '/v1/admin/practice-tests/18',
      '/v1/admin/practice-tests/18/questions',
      '/v1/admin/practice-questions/51',
    ])
    assert.deepEqual(calls.map(call => call.init?.method ?? 'GET'), ['GET', 'GET', 'GET', 'GET', 'POST', 'POST', 'PATCH', 'POST', 'PATCH'])
    assert.ok(calls.every(call => call.init?.credentials === 'include'))
    assert.deepEqual(JSON.parse(String(calls[7].init?.body)), {
      questionText: QUESTION.questionText,
      options: QUESTION.options,
      correctAnswer: 'a',
      position: 1,
    })
  } finally {
    globalThis.fetch = originalFetch
    restoreWindow()
  }
})

test('the question catalogue sends only the filters the operator actually set', async () => {
  const restoreWindow = installBrowserWindow()
  const originalFetch = globalThis.fetch
  const requested: string[] = []
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    requested.push(String(input))
    return json({ practiceTestId: 18, items: [QUESTION], total: 1, limit: 25, offset: 0, nextAvailablePosition: 2 })
  }) as typeof fetch
  try {
    await listAdminPracticeQuestions(18, { limit: 25, offset: 50 })
    await listAdminPracticeQuestions(18, { limit: 25, search: '  дроби  ', status: 'archived', section: ' algebra ', difficulty: 'hard' })
    // Blank input must not become a filter: an empty search box means
    // "everything", not "match the empty string".
    await listAdminPracticeQuestions(18, { limit: 25, search: '   ', status: 'all', section: '' })

    assert.equal(requested[0], '/v1/admin/practice-tests/18/questions?limit=25&offset=50')
    assert.equal(requested[1], '/v1/admin/practice-tests/18/questions?limit=25&q=%D0%B4%D1%80%D0%BE%D0%B1%D0%B8&status=archived&section=algebra&difficulty=hard')
    assert.equal(requested[2], '/v1/admin/practice-tests/18/questions?limit=25')
  } finally {
    globalThis.fetch = originalFetch
    restoreWindow()
  }
})

test('a complete question bank is fetched in API-safe 100-row pages', async () => {
  const restoreWindow = installBrowserWindow()
  const originalFetch = globalThis.fetch
  const requested: string[] = []
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const path = String(input)
    requested.push(path)
    const url = new URL(path, 'https://admin.zhangak.test')
    const offset = Number(url.searchParams.get('offset') ?? 0)
    const count = offset === 0 ? 100 : 50
    const items = Array.from({ length: count }, (_, index) => ({
      ...QUESTION,
      id: offset + index + 1,
      position: offset + index + 1,
    }))
    return json({ practiceTestId: 18, items, total: 150, limit: 100, offset, nextAvailablePosition: 151 })
  }) as typeof fetch
  try {
    const result = await listAllAdminPracticeQuestions(18, { status: 'active' })
    assert.equal(result.length, 150)
    assert.deepEqual(requested, [
      '/v1/admin/practice-tests/18/questions?limit=100&offset=0&status=active',
      '/v1/admin/practice-tests/18/questions?limit=100&offset=100&status=active',
    ])
    assert.ok(requested.every(path => !path.includes('limit=200')))
  } finally {
    globalThis.fetch = originalFetch
    restoreWindow()
  }
})

test('archive and restore go through PATCH isActive, never an HTTP DELETE', async () => {
  const restoreWindow = installBrowserWindow()
  const originalFetch = globalThis.fetch
  const calls: Array<{ path: string; method?: string; body: unknown }> = []
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ path: String(input), method: init?.method, body: init?.body ? JSON.parse(String(init.body)) : null })
    return json({ question: { ...QUESTION, isActive: false } })
  }) as typeof fetch
  try {
    await archiveAdminPracticeQuestion(51)
    await restoreAdminPracticeQuestion(51)
    assert.deepEqual(calls.map(call => call.method), ['PATCH', 'PATCH'])
    assert.deepEqual(calls.map(call => call.path), [
      '/v1/admin/practice-questions/51',
      '/v1/admin/practice-questions/51',
    ])
    // Only the activity flag is sent, so the audit trail can classify the
    // change as an archive or a restore rather than a generic edit.
    assert.deepEqual(calls[0].body, { isActive: false })
    assert.deepEqual(calls[1].body, { isActive: true })
    assert.ok(!calls.some(call => call.method === 'DELETE'), 'the client must never issue a destructive DELETE')
  } finally {
    globalThis.fetch = originalFetch
    restoreWindow()
  }
})
