import {
  PRACTICE_ANSWER_LETTERS,
  type PracticeAnswerInput,
  type PracticeAnswerLetter,
  type PracticeReviewItem,
} from './practice-contract.ts'

const ANSWER_SET = new Set<string>(PRACTICE_ANSWER_LETTERS)

/*
 * This module is an executable reference for database tests. It has no data
 * access of its own; the production guarantee must still come from the one
 * locked transaction documented in docs/database/practice-submission.md.
 */

/*
 * Keep the public interfaces small so test fixtures cannot accidentally grow
 * into a second, non-atomic persistence implementation.
 */

export interface PrivateAssignedQuestion {
  questionId: number
  answerKey: PracticeAnswerLetter
}

export interface GradePracticeResult {
  score: number
  total: number
  review: PracticeReviewItem[]
}

export interface AttemptAvailability {
  active: boolean
  scheduledAt: Date | null
  maxAttempts: number | null
  finalizedAttempts: number
}

export type AttemptAvailabilityResult =
  | { allowed: true; attemptNumber: number }
  | { allowed: false; reason: 'inactive' | 'not_started' | 'attempts_exhausted' }

export type IdempotencyDecision<T> =
  | { action: 'execute' }
  | { action: 'replay'; result: T }
  | { action: 'conflict' }

/** Pure reference for the future atomic database grading function. */
export function gradeAssignedPracticeQuestions(
  assignedQuestions: readonly PrivateAssignedQuestion[],
  submittedAnswers: readonly PracticeAnswerInput[],
): GradePracticeResult {
  if (assignedQuestions.length < 1) throw new Error('no assigned questions')
  const assigned = new Map<number, PracticeAnswerLetter>()
  for (const question of assignedQuestions) {
    if (!Number.isSafeInteger(question.questionId) || question.questionId <= 0) {
      throw new Error('invalid assigned question')
    }
    if (!ANSWER_SET.has(question.answerKey)) throw new Error('invalid answer key')
    if (assigned.has(question.questionId)) throw new Error('duplicate assigned question')
    assigned.set(question.questionId, question.answerKey)
  }

  const submitted = new Map<number, PracticeAnswerLetter>()
  for (const answer of submittedAnswers) {
    if (!ANSWER_SET.has(answer.answer)) throw new Error('invalid submitted answer')
    if (!assigned.has(answer.questionId)) throw new Error('unassigned question')
    if (submitted.has(answer.questionId)) throw new Error('duplicate submitted question')
    submitted.set(answer.questionId, answer.answer)
  }

  let score = 0
  const review = assignedQuestions.map<PracticeReviewItem>(question => {
    const selectedAnswer = submitted.get(question.questionId) ?? null
    const isCorrect = selectedAnswer === question.answerKey
    if (isCorrect) score += 1
    return {
      questionId: question.questionId,
      selectedAnswer,
      correctAnswer: question.answerKey,
      isCorrect,
    }
  })

  return { score, total: assignedQuestions.length, review }
}

export function checkAttemptAvailability(
  input: AttemptAvailability,
  now: Date,
): AttemptAvailabilityResult {
  if (!Number.isSafeInteger(input.finalizedAttempts) || input.finalizedAttempts < 0) {
    throw new Error('invalid finalized attempt count')
  }
  if (input.maxAttempts !== null && (!Number.isSafeInteger(input.maxAttempts) || input.maxAttempts <= 0)) {
    throw new Error('invalid max attempts')
  }
  if (input.scheduledAt && !Number.isFinite(input.scheduledAt.getTime())) {
    throw new Error('invalid schedule')
  }
  if (!input.active) return { allowed: false, reason: 'inactive' }
  if (input.scheduledAt && input.scheduledAt.getTime() > now.getTime()) {
    return { allowed: false, reason: 'not_started' }
  }
  if (input.maxAttempts !== null && input.finalizedAttempts >= input.maxAttempts) {
    return { allowed: false, reason: 'attempts_exhausted' }
  }
  return { allowed: true, attemptNumber: input.finalizedAttempts + 1 }
}

/**
 * A retry with the same key returns the committed response. A different key
 * cannot finalize an already-closed attempt.
 */
export function decideIdempotentSubmission<T>(
  stored: { key: string; result: T } | null,
  incomingKey: string,
): IdempotencyDecision<T> {
  if (!stored) return { action: 'execute' }
  if (stored.key === incomingKey) return { action: 'replay', result: stored.result }
  return { action: 'conflict' }
}
