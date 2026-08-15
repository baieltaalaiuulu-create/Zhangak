import { createHash } from 'node:crypto'

const SOURCE_PROJECT_HOST = 'olqikkvjeutdgewmhnub.supabase.co'
const SOURCE_SYSTEM = 'supabase-demo-v1'
const MAX_SOURCE_ROWS = 5_000
const MAX_TEXT_LENGTH = 10_000
const SUBJECTS = Object.freeze({
  math: {
    code: 'demo-ort-math',
    name: 'Демо: ОРТ Математика',
    description: 'Импортированный демонстрационный контент из прежней учебной базы.',
  },
  kyr: {
    code: 'demo-ort-kyr',
    name: 'Демо: Кыргыз тили',
    description: 'Импортированный демонстрационный контент из прежней учебной базы.',
  },
})
const ANSWERS = new Set(['a', 'b', 'c', 'd'])
const DIFFICULTIES = new Set(['easy', 'medium', 'hard'])

function fail(message) {
  throw new Error(`Legacy demo import blocked: ${message}`)
}

function requiredText(value, field, max = MAX_TEXT_LENGTH) {
  if (typeof value !== 'string') fail(`${field} must be text`)
  const normalized = value.trim()
  if (!normalized || normalized.length > max) fail(`${field} has an invalid length`)
  return normalized
}

function nullableText(value, field, max = MAX_TEXT_LENGTH) {
  if (value == null || value === '') return null
  return requiredText(value, field, max)
}

function uuid(value, field) {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    fail(`${field} must be a UUID`)
  }
  return value.toLowerCase()
}

function positiveInteger(value, field) {
  if (!Number.isSafeInteger(value) || value < 1) fail(`${field} must be a positive integer`)
  return value
}

function httpsUrl(value, field) {
  const raw = requiredText(value, field, 2_048)
  let parsed
  try {
    parsed = new URL(raw)
  } catch {
    fail(`${field} must be a URL`)
  }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) fail(`${field} must be a safe HTTPS URL`)
  return parsed.toString()
}

function sourceId(value, field) {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (Number.isSafeInteger(value) && value > 0) return String(value)
  fail(`${field} must be a source identifier`)
}

function digest(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

function sourceSubject(value, field) {
  if (typeof value !== 'string' || !Object.hasOwn(SUBJECTS, value)) {
    fail(`${field} must be one of the importable subjects`)
  }
  return value
}

function normalizedSection(value) {
  if (typeof value !== 'string') return 'general'
  const section = value.trim().toLowerCase()
  return /^[a-z][a-z0-9_-]{0,63}$/.test(section) ? section : 'general'
}

function normalizedDifficulty(value) {
  const difficulty = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return DIFFICULTIES.has(difficulty) ? difficulty : 'medium'
}

function normalizedOptions(row) {
  return Object.fromEntries(['a', 'b', 'c', 'd'].map(letter => [
    letter,
    requiredText(row[`option_${letter}`], `question.${letter}`),
  ]))
}

function normalizedAnswer(value) {
  const answer = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (!ANSWERS.has(answer)) fail('question.correct_answer must be a, b, c, or d')
  return answer
}

function sortedRows(rows, compare) {
  return [...rows].sort(compare)
}

function assertSourceRows(rows, label) {
  if (!Array.isArray(rows) || rows.length > MAX_SOURCE_ROWS) fail(`${label} has an unsafe row count`)
  return rows
}

function courseForSubject(subject) {
  return { subject, ...SUBJECTS[subject] }
}

function deferredQuestion({ sourceId: id, sourceTestId, subject = null, reason }) {
  return {
    sourceId: id,
    sourceTestId,
    subject,
    reason,
    fingerprint: digest({ sourceId: id, sourceTestId, subject, reason }),
  }
}

/**
 * Converts the small, known legacy demo slice into a first-party import plan.
 * Image-only questions are intentionally deferred: retaining their Supabase
 * storage URLs would reintroduce the retired data dependency.
 */
export function buildLegacyDemoPlan({ practiceLessons, practiceTests, questions }) {
  const sourceLessons = assertSourceRows(practiceLessons, 'practice_lessons')
  const sourceTests = assertSourceRows(practiceTests, 'practice_tests')
  const sourceQuestions = assertSourceRows(questions, 'questions')

  const lessons = []
  const lessonBySourceId = new Map()
  const subjectOrders = new Map()
  for (const row of sortedRows(sourceLessons, (left, right) => (
    String(left.subject).localeCompare(String(right.subject)) || Number(left.order_number) - Number(right.order_number)
  ))) {
    const id = uuid(row.id, 'practice_lesson.id')
    const subject = sourceSubject(row.subject, 'practice_lesson.subject')
    const requestedOrder = positiveInteger(row.order_number, 'practice_lesson.order_number')
    const previousOrder = subjectOrders.get(subject) ?? 0
    if (requestedOrder <= previousOrder) fail('practice_lessons must have a unique increasing order per subject')
    subjectOrders.set(subject, requestedOrder)
    const lesson = {
      sourceId: id,
      subject,
      courseCode: SUBJECTS[subject].code,
      lessonNumber: requestedOrder,
      title: requiredText(row.title, 'practice_lesson.title', 300),
      description: nullableText(row.description, 'practice_lesson.description', 50_000),
      contentUrl: httpsUrl(row.video_url, 'practice_lesson.video_url'),
    }
    lesson.fingerprint = digest(lesson)
    lessons.push(lesson)
    lessonBySourceId.set(id, lesson)
  }

  const testBySourceId = new Map()
  for (const row of sourceTests) {
    const id = sourceId(row.id, 'practice_test.id')
    if (testBySourceId.has(id)) fail('practice_tests contains duplicate source IDs')
    testBySourceId.set(id, row)
  }

  const questionsByTestId = new Map()
  const deferred = []
  for (const row of sortedRows(sourceQuestions, (left, right) => (
    Number(left.practice_test_id) - Number(right.practice_test_id) || Number(left.order_num) - Number(right.order_num)
  ))) {
    const id = sourceId(row.id, 'question.id')
    const testId = sourceId(row.practice_test_id, 'question.practice_test_id')
    const test = testBySourceId.get(testId)
    if (!test) {
      deferred.push(deferredQuestion({ sourceId: id, sourceTestId: testId, reason: 'source_test_missing' }))
      continue
    }
    let subject
    try {
      subject = sourceSubject(test.subject, 'practice_test.subject')
    } catch {
      deferred.push(deferredQuestion({ sourceId: id, sourceTestId: testId, reason: 'unsupported_subject' }))
      continue
    }
    if (row.image_url) {
      deferred.push(deferredQuestion({ sourceId: id, sourceTestId: testId, subject, reason: 'private_image_migration_required' }))
      continue
    }
    const questionText = nullableText(row.question_text, 'question.question_text')
    if (!questionText) {
      deferred.push(deferredQuestion({ sourceId: id, sourceTestId: testId, subject, reason: 'question_text_missing' }))
      continue
    }
    const question = {
      sourceId: id,
      sourceTestId: testId,
      subject,
      questionText,
      options: normalizedOptions(row),
      correctAnswer: normalizedAnswer(row.correct_answer),
      section: normalizedSection(row.section),
      topic: nullableText(row.topic, 'question.topic', 200),
      difficulty: normalizedDifficulty(row.difficulty),
      position: positiveInteger(row.order_num, 'question.order_num'),
    }
    question.fingerprint = digest(question)
    const list = questionsByTestId.get(testId) ?? []
    if (list.some(item => item.position === question.position)) fail('questions have duplicate positions within one test')
    list.push(question)
    questionsByTestId.set(testId, list)
  }

  const tests = []
  const importedTestIds = new Set()
  for (const [sourceTestId, testQuestions] of questionsByTestId.entries()) {
    const row = testBySourceId.get(sourceTestId)
    const subject = sourceSubject(row.subject, 'practice_test.subject')
    const sourceLessonId = row.lesson_id == null ? null : uuid(row.lesson_id, 'practice_test.lesson_id')
    const lesson = sourceLessonId == null ? null : lessonBySourceId.get(sourceLessonId)
    if (sourceLessonId && !lesson) {
      for (const question of testQuestions) {
        deferred.push(deferredQuestion({ sourceId: question.sourceId, sourceTestId, subject, reason: 'source_lesson_missing' }))
      }
      continue
    }
    if (lesson && lesson.subject !== subject) fail('practice_test lesson subject does not match test subject')
    const type = ['practice', 'mock', 'bank', 'diagnostic'].includes(row.type) ? row.type : 'practice'
    const test = {
      sourceId: sourceTestId,
      subject,
      courseCode: SUBJECTS[subject].code,
      sourceLessonId,
      title: requiredText(row.title, 'practice_test.title', 500),
      testType: type,
      description: null,
      timeLimitSeconds: Number.isSafeInteger(row.time_limit_minutes) && row.time_limit_minutes > 0
        ? Math.min(row.time_limit_minutes * 60, 86_400)
        : null,
      // The approved product rule is unlimited repeat attempts. Historical
      // caps are not copied into the new trusted scoring flow.
      maxAttempts: null,
      passScoreRatio: 0.5,
      isPublished: true,
    }
    test.fingerprint = digest(test)
    tests.push(test)
    importedTestIds.add(sourceTestId)
  }

  const importableSubjects = [...new Set(lessons.map(lesson => lesson.subject))]
  const courses = importableSubjects.sort().map(courseForSubject).map(course => ({
    ...course,
    fingerprint: digest(course),
  }))

  return {
    sourceSystem: SOURCE_SYSTEM,
    courses,
    lessons,
    tests: sortedRows(tests, (left, right) => Number(left.sourceId) - Number(right.sourceId)),
    questions: sortedRows([...questionsByTestId.entries()]
      .filter(([sourceTestId]) => importedTestIds.has(sourceTestId))
      .flatMap(([, entries]) => entries), (left, right) => (
      Number(left.sourceTestId) - Number(right.sourceTestId) || left.position - right.position
    )),
    deferred: sortedRows(deferred, (left, right) => left.sourceId.localeCompare(right.sourceId)),
  }
}

export function sourceImportConfig(environment = process.env) {
  const rawUrl = environment.LEGACY_SOURCE_SUPABASE_URL?.trim()
  const key = environment.LEGACY_SOURCE_SUPABASE_SECRET_KEY?.trim()
  if (!rawUrl || !key) fail('LEGACY_SOURCE_SUPABASE_URL and LEGACY_SOURCE_SUPABASE_SECRET_KEY are required')
  let url
  try {
    url = new URL(rawUrl)
  } catch {
    fail('legacy source URL is invalid')
  }
  if (url.protocol !== 'https:' || url.hostname.toLowerCase() !== SOURCE_PROJECT_HOST || url.pathname !== '/' || url.search || url.hash) {
    fail('legacy source URL does not identify the approved source project')
  }
  if (key.length < 24) fail('legacy source key is invalid')
  return { url: url.toString().replace(/\/$/, ''), key }
}

async function fetchRows(fetchImpl, config, path) {
  const response = await fetchImpl(`${config.url}/rest/v1/${path}`, {
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      Accept: 'application/json',
    },
  })
  if (!response.ok) fail(`source read failed with HTTP ${response.status}`)
  const body = await response.json()
  if (!Array.isArray(body)) fail('source response must be an array')
  return body
}

export async function fetchLegacyDemoPlan({ fetchImpl = fetch, environment = process.env } = {}) {
  const config = sourceImportConfig(environment)
  const [practiceLessons, practiceTests, questions] = await Promise.all([
    fetchRows(fetchImpl, config, 'practice_lessons?select=id,subject,title,description,video_url,order_number&order=subject.asc,order_number.asc'),
    fetchRows(fetchImpl, config, 'practice_tests?select=id,title,subject,type,time_limit_minutes,lesson_id'),
    fetchRows(fetchImpl, config, 'questions?select=id,practice_test_id,question_text,option_a,option_b,option_c,option_d,correct_answer,image_url,order_num,section,difficulty,topic&order=practice_test_id.asc,order_num.asc'),
  ])
  return buildLegacyDemoPlan({ practiceLessons, practiceTests, questions })
}

export function importPlanSummary(plan) {
  return {
    sourceSystem: plan.sourceSystem,
    courses: plan.courses.length,
    lessons: plan.lessons.length,
    tests: plan.tests.length,
    questions: plan.questions.length,
    deferred: plan.deferred.length,
  }
}
