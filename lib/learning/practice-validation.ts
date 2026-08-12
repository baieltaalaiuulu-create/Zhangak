import {
  PRACTICE_ANSWER_LETTERS,
  PRACTICE_CONTRACT_VERSION,
  type BeginPracticeRequest,
  type PracticeAnswerInput,
  type PracticeAnswerLetter,
  type PracticeAttemptResponse,
  type PracticeReviewItem,
  type PracticeSubmissionResponse,
  type PracticeValidationErrorCode,
  type PracticeValidationResult,
  type PublicPracticeQuestion,
  type SubmitPracticeRequest,
} from './practice-contract.ts'

export const MAX_PRACTICE_ANSWERS = 200
export const MAX_PRACTICE_ELAPSED_SECONDS = 24 * 60 * 60

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const SECTION_PATTERN = /^[a-z][a-z0-9_-]{0,63}$/
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/
const ANSWER_SET = new Set<string>(PRACTICE_ANSWER_LETTERS)

function invalid<T>(code: PracticeValidationErrorCode, field: string): PracticeValidationResult<T> {
  return { ok: false, code, field }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasExactKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  const allowedSet = new Set(allowed)
  return Object.keys(value).every(key => allowedSet.has(key))
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value)
}

function isAnswer(value: unknown): value is PracticeAnswerLetter {
  return typeof value === 'string' && ANSWER_SET.has(value)
}

function parseAnswerInput(value: unknown, index: number): PracticeValidationResult<PracticeAnswerInput> {
  if (!isRecord(value)) return invalid('invalid_answers', `answers.${index}`)
  if (!hasExactKeys(value, ['questionId', 'answer'])) {
    return invalid('unknown_field', `answers.${index}`)
  }
  if (!isPositiveInteger(value.questionId)) {
    return invalid('invalid_id', `answers.${index}.questionId`)
  }
  if (!isAnswer(value.answer)) {
    return invalid('invalid_answers', `answers.${index}.answer`)
  }
  return { ok: true, value: { questionId: value.questionId, answer: value.answer } }
}

export function parseBeginPracticeRequest(value: unknown): PracticeValidationResult<BeginPracticeRequest> {
  if (!isRecord(value)) return invalid('invalid_shape', 'request')
  if (value.mode === 'test') {
    if (!hasExactKeys(value, ['mode', 'testId', 'idempotencyKey'])) {
      return invalid('unknown_field', 'request')
    }
    if (!isPositiveInteger(value.testId)) return invalid('invalid_id', 'testId')
    if (!isUuid(value.idempotencyKey)) {
      return invalid('invalid_idempotency_key', 'idempotencyKey')
    }
    return {
      ok: true,
      value: { mode: 'test', testId: value.testId, idempotencyKey: value.idempotencyKey },
    }
  }

  if (value.mode === 'topic') {
    if (!hasExactKeys(value, ['mode', 'section', 'topic', 'idempotencyKey'])) {
      return invalid('unknown_field', 'request')
    }
    if (typeof value.section !== 'string' || !SECTION_PATTERN.test(value.section)) {
      return invalid('invalid_section', 'section')
    }
    if (typeof value.topic !== 'string' || value.topic.trim().length < 1 || value.topic.length > 200) {
      return invalid('invalid_topic', 'topic')
    }
    if (!isUuid(value.idempotencyKey)) {
      return invalid('invalid_idempotency_key', 'idempotencyKey')
    }
    return {
      ok: true,
      value: {
        mode: 'topic',
        section: value.section,
        topic: value.topic.trim(),
        idempotencyKey: value.idempotencyKey,
      },
    }
  }

  return invalid('invalid_mode', 'mode')
}

export function parseSubmitPracticeRequest(value: unknown): PracticeValidationResult<SubmitPracticeRequest> {
  if (!isRecord(value)) return invalid('invalid_shape', 'request')
  if (!hasExactKeys(value, ['attemptId', 'idempotencyKey', 'elapsedSeconds', 'answers'])) {
    return invalid('unknown_field', 'request')
  }
  if (!isUuid(value.attemptId)) return invalid('invalid_id', 'attemptId')
  if (!isUuid(value.idempotencyKey)) {
    return invalid('invalid_idempotency_key', 'idempotencyKey')
  }
  if (!isNonNegativeInteger(value.elapsedSeconds) || value.elapsedSeconds > MAX_PRACTICE_ELAPSED_SECONDS) {
    return invalid('invalid_elapsed_seconds', 'elapsedSeconds')
  }
  if (!Array.isArray(value.answers)) return invalid('invalid_answers', 'answers')
  if (value.answers.length > MAX_PRACTICE_ANSWERS) return invalid('too_many_answers', 'answers')

  const answers: PracticeAnswerInput[] = []
  const questionIds = new Set<number>()
  for (let index = 0; index < value.answers.length; index += 1) {
    const parsed = parseAnswerInput(value.answers[index], index)
    if (!parsed.ok) return parsed
    if (questionIds.has(parsed.value.questionId)) {
      return invalid('duplicate_question', `answers.${index}.questionId`)
    }
    questionIds.add(parsed.value.questionId)
    answers.push(parsed.value)
  }

  return {
    ok: true,
    value: {
      attemptId: value.attemptId,
      idempotencyKey: value.idempotencyKey,
      elapsedSeconds: value.elapsedSeconds,
      answers,
    },
  }
}

function parseOptions(value: unknown, field: string): PracticeValidationResult<Record<PracticeAnswerLetter, string>> {
  if (!isRecord(value) || !hasExactKeys(value, PRACTICE_ANSWER_LETTERS)) {
    return invalid('invalid_response', field)
  }
  const result = {} as Record<PracticeAnswerLetter, string>
  for (const letter of PRACTICE_ANSWER_LETTERS) {
    const text = value[letter]
    if (typeof text !== 'string' || text.length < 1 || text.length > 10_000) {
      return invalid('invalid_response', `${field}.${letter}`)
    }
    result[letter] = text
  }
  return { ok: true, value: result }
}

function parsePublicQuestion(value: unknown, index: number): PracticeValidationResult<PublicPracticeQuestion> {
  if (!isRecord(value)) return invalid('invalid_response', `questions.${index}`)
  const fields = ['id', 'text', 'options', 'imageUrl', 'order', 'section', 'topic', 'difficulty'] as const
  if (!hasExactKeys(value, fields)) return invalid('invalid_response', `questions.${index}`)
  if (!isPositiveInteger(value.id)) return invalid('invalid_response', `questions.${index}.id`)
  if (typeof value.text !== 'string' || value.text.length < 1 || value.text.length > 10_000) {
    return invalid('invalid_response', `questions.${index}.text`)
  }
  const options = parseOptions(value.options, `questions.${index}.options`)
  if (!options.ok) return options
  if (value.imageUrl !== null && (typeof value.imageUrl !== 'string' || value.imageUrl.length > 2_048)) {
    return invalid('invalid_response', `questions.${index}.imageUrl`)
  }
  if (!isNonNegativeInteger(value.order)) return invalid('invalid_response', `questions.${index}.order`)
  if (typeof value.section !== 'string' || !SECTION_PATTERN.test(value.section)) {
    return invalid('invalid_response', `questions.${index}.section`)
  }
  if (value.topic !== null && (typeof value.topic !== 'string' || value.topic.length > 200)) {
    return invalid('invalid_response', `questions.${index}.topic`)
  }
  if (!['easy', 'medium', 'hard'].includes(String(value.difficulty))) {
    return invalid('invalid_response', `questions.${index}.difficulty`)
  }
  return {
    ok: true,
    value: {
      id: value.id,
      text: value.text,
      options: options.value,
      imageUrl: value.imageUrl as string | null,
      order: value.order,
      section: value.section,
      topic: value.topic as string | null,
      difficulty: value.difficulty as PublicPracticeQuestion['difficulty'],
    },
  }
}

function parseReviewItem(value: unknown, index: number): PracticeValidationResult<PracticeReviewItem> {
  if (!isRecord(value)) return invalid('invalid_response', `review.${index}`)
  if (!hasExactKeys(value, ['questionId', 'selectedAnswer', 'correctAnswer', 'isCorrect'])) {
    return invalid('invalid_response', `review.${index}`)
  }
  if (!isPositiveInteger(value.questionId)) return invalid('invalid_response', `review.${index}.questionId`)
  if (value.selectedAnswer !== null && !isAnswer(value.selectedAnswer)) {
    return invalid('invalid_response', `review.${index}.selectedAnswer`)
  }
  if (!isAnswer(value.correctAnswer)) return invalid('invalid_response', `review.${index}.correctAnswer`)
  if (typeof value.isCorrect !== 'boolean') return invalid('invalid_response', `review.${index}.isCorrect`)
  return {
    ok: true,
    value: {
      questionId: value.questionId,
      selectedAnswer: value.selectedAnswer,
      correctAnswer: value.correctAnswer,
      isCorrect: value.isCorrect,
    },
  }
}

export function parsePracticeAttemptResponse(value: unknown): PracticeValidationResult<PracticeAttemptResponse> {
  if (!isRecord(value)) return invalid('invalid_response', 'response')
  const fields = [
    'contractVersion', 'attemptId', 'idempotencyKey', 'mode', 'title', 'testId', 'lessonId',
    'attemptNumber', 'maxAttempts', 'timeLimitSeconds', 'questions',
  ] as const
  if (!hasExactKeys(value, fields)) return invalid('invalid_response', 'response')
  if (value.contractVersion !== PRACTICE_CONTRACT_VERSION) return invalid('invalid_response', 'contractVersion')
  if (!isUuid(value.attemptId)) return invalid('invalid_response', 'attemptId')
  if (!isUuid(value.idempotencyKey)) return invalid('invalid_response', 'idempotencyKey')
  if (value.mode !== 'test' && value.mode !== 'topic') return invalid('invalid_response', 'mode')
  if (typeof value.title !== 'string' || value.title.length < 1 || value.title.length > 500) {
    return invalid('invalid_response', 'title')
  }
  if (value.testId !== null && !isPositiveInteger(value.testId)) return invalid('invalid_response', 'testId')
  if (value.lessonId !== null && (typeof value.lessonId !== 'string' || value.lessonId.length > 128)) {
    return invalid('invalid_response', 'lessonId')
  }
  if (!isPositiveInteger(value.attemptNumber)) return invalid('invalid_response', 'attemptNumber')
  if (value.maxAttempts !== null && !isPositiveInteger(value.maxAttempts)) {
    return invalid('invalid_response', 'maxAttempts')
  }
  if (value.timeLimitSeconds !== null && (!isPositiveInteger(value.timeLimitSeconds) || value.timeLimitSeconds > MAX_PRACTICE_ELAPSED_SECONDS)) {
    return invalid('invalid_response', 'timeLimitSeconds')
  }
  if (!Array.isArray(value.questions) || value.questions.length > MAX_PRACTICE_ANSWERS) {
    return invalid('invalid_response', 'questions')
  }

  const questions: PublicPracticeQuestion[] = []
  const ids = new Set<number>()
  for (let index = 0; index < value.questions.length; index += 1) {
    const parsed = parsePublicQuestion(value.questions[index], index)
    if (!parsed.ok) return parsed
    if (ids.has(parsed.value.id)) return invalid('invalid_response', `questions.${index}.id`)
    ids.add(parsed.value.id)
    questions.push(parsed.value)
  }

  return {
    ok: true,
    value: {
      contractVersion: PRACTICE_CONTRACT_VERSION,
      attemptId: value.attemptId,
      idempotencyKey: value.idempotencyKey,
      mode: value.mode,
      title: value.title,
      testId: value.testId,
      lessonId: value.lessonId as string | null,
      attemptNumber: value.attemptNumber,
      maxAttempts: value.maxAttempts,
      timeLimitSeconds: value.timeLimitSeconds,
      questions,
    },
  }
}

export function parsePracticeSubmissionResponse(value: unknown): PracticeValidationResult<PracticeSubmissionResponse> {
  if (!isRecord(value)) return invalid('invalid_response', 'response')
  const fields = [
    'contractVersion', 'attemptId', 'score', 'total', 'passed', 'attemptNumber',
    'elapsedSeconds', 'completedAt', 'review',
  ] as const
  if (!hasExactKeys(value, fields)) return invalid('invalid_response', 'response')
  if (value.contractVersion !== PRACTICE_CONTRACT_VERSION) return invalid('invalid_response', 'contractVersion')
  if (!isUuid(value.attemptId)) return invalid('invalid_response', 'attemptId')
  if (!isNonNegativeInteger(value.score)) return invalid('invalid_response', 'score')
  if (!isNonNegativeInteger(value.total) || value.score > value.total) return invalid('invalid_response', 'total')
  if (typeof value.passed !== 'boolean') return invalid('invalid_response', 'passed')
  if (!isPositiveInteger(value.attemptNumber)) return invalid('invalid_response', 'attemptNumber')
  if (!isNonNegativeInteger(value.elapsedSeconds) || value.elapsedSeconds > MAX_PRACTICE_ELAPSED_SECONDS) {
    return invalid('invalid_response', 'elapsedSeconds')
  }
  if (
    typeof value.completedAt !== 'string'
    || !ISO_DATE_PATTERN.test(value.completedAt)
    || !Number.isFinite(Date.parse(value.completedAt))
  ) {
    return invalid('invalid_response', 'completedAt')
  }
  if (!Array.isArray(value.review) || value.review.length !== value.total) {
    return invalid('invalid_response', 'review')
  }

  const review: PracticeReviewItem[] = []
  const ids = new Set<number>()
  let computedScore = 0
  for (let index = 0; index < value.review.length; index += 1) {
    const parsed = parseReviewItem(value.review[index], index)
    if (!parsed.ok) return parsed
    if (ids.has(parsed.value.questionId)) return invalid('invalid_response', `review.${index}.questionId`)
    ids.add(parsed.value.questionId)
    if (parsed.value.isCorrect) computedScore += 1
    review.push(parsed.value)
  }
  if (computedScore !== value.score) return invalid('invalid_response', 'score')

  return {
    ok: true,
    value: {
      contractVersion: PRACTICE_CONTRACT_VERSION,
      attemptId: value.attemptId,
      score: value.score,
      total: value.total,
      passed: value.passed,
      attemptNumber: value.attemptNumber,
      elapsedSeconds: value.elapsedSeconds,
      completedAt: value.completedAt,
      review,
    },
  }
}
