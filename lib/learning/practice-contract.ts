/**
 * Versioned trust-boundary contract for practice attempts.
 *
 * Student clients send only intent and selected answers. Identity, attempt
 * number, score, pass state, and timestamps are always authored by the
 * authenticated database transaction.
 */

export const PRACTICE_CONTRACT_VERSION = 2 as const
export const PRACTICE_ANSWER_LETTERS = ['a', 'b', 'c', 'd'] as const

export type PracticeAnswerLetter = (typeof PRACTICE_ANSWER_LETTERS)[number]
export type PracticeMode = 'test' | 'topic'

export interface BeginTestPracticeRequest {
  mode: 'test'
  testId: number
  idempotencyKey: string
}

export interface BeginTopicPracticeRequest {
  mode: 'topic'
  section: string
  topic: string
  idempotencyKey: string
}

export type BeginPracticeRequest = BeginTestPracticeRequest | BeginTopicPracticeRequest

export interface PracticeAnswerInput {
  questionId: number
  answer: PracticeAnswerLetter
}

export interface SubmitPracticeRequest {
  attemptId: string
  idempotencyKey: string
  elapsedSeconds: number
  answers: PracticeAnswerInput[]
}

/** Safe question projection returned before final submission. */
export interface PublicPracticeQuestion {
  id: number
  text: string
  options: Record<PracticeAnswerLetter, string>
  imageUrl: string | null
  order: number
  section: string
  topic: string | null
  difficulty: 'easy' | 'medium' | 'hard'
}

export interface PracticeAttemptResponse {
  contractVersion: typeof PRACTICE_CONTRACT_VERSION
  attemptId: string
  idempotencyKey: string
  mode: PracticeMode
  title: string
  testId: number | null
  lessonId: string | null
  attemptNumber: number
  maxAttempts: number | null
  timeLimitSeconds: number | null
  questions: PublicPracticeQuestion[]
}

/** Review data is released only after the attempt has been finalized. */
export interface PracticeReviewItem {
  questionId: number
  selectedAnswer: PracticeAnswerLetter | null
  correctAnswer: PracticeAnswerLetter
  isCorrect: boolean
}

export interface PracticeSubmissionResponse {
  contractVersion: typeof PRACTICE_CONTRACT_VERSION
  attemptId: string
  score: number
  total: number
  passed: boolean
  attemptNumber: number
  elapsedSeconds: number
  completedAt: string
  review: PracticeReviewItem[]
}

export type PracticeValidationErrorCode =
  | 'invalid_shape'
  | 'unknown_field'
  | 'invalid_mode'
  | 'invalid_id'
  | 'invalid_idempotency_key'
  | 'invalid_section'
  | 'invalid_topic'
  | 'invalid_elapsed_seconds'
  | 'invalid_answers'
  | 'duplicate_question'
  | 'too_many_answers'
  | 'invalid_response'

export type PracticeValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; code: PracticeValidationErrorCode; field: string }
