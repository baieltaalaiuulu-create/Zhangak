import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createAdminCoursePracticeTest,
  createAdminLessonPracticeTest,
  createAdminPracticeQuestion,
  getAdminPracticeTest,
  listAdminCoursePracticeTests,
  listAdminLessonPracticeTests,
  listAdminPracticeQuestions,
  parseAdminPracticeQuestion,
  parseAdminPracticeQuestionList,
  parseAdminPracticeTestList,
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
  assert.deepEqual(parseAdminPracticeQuestionList({ practiceTestId: 18, items: [QUESTION], total: 1, limit: 50, offset: 0 }), {
    practiceTestId: 18, items: [QUESTION], total: 1, limit: 50, offset: 0,
  })
  assert.throws(
    () => parseAdminPracticeQuestion({ ...QUESTION, options: { a: '1', b: '2', c: '3', extra: '4' } }),
    /варианты вопроса/,
  )
  assert.throws(
    () => parseAdminPracticeQuestion({ ...QUESTION, correctAnswer: 'A' }),
    /правильный ответ/,
  )
  assert.throws(
    () => parseAdminPracticeQuestionList({ practiceTestId: 18, items: [{ ...QUESTION, practiceTestId: 19 }], total: 1, limit: 50, offset: 0 }),
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
    if (path === '/v1/admin/practice-tests/18/questions?limit=50') return json({ practiceTestId: 18, items: [QUESTION], total: 1, limit: 50, offset: 0 })
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
