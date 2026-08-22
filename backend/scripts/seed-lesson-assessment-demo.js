/**
 * Closes the one concrete product gap the release owner identified: almost
 * every practice_tests row is course-wide (lesson_id IS NULL), so almost no
 * lesson in the live curriculum can complete the
 *   Video -> Test -> Result -> Next lesson
 * chain — a lesson only requires practice completion when it has at least one
 * published, currently available, lesson-bound test with an active question
 * (see `has_active_bound_practice_test` in backend/src/routes/platform-learning.js
 * and backend/src/routes/platform-roadmap.js).
 *
 * This script does not touch the existing course-wide question banks and does
 * not guess a link between an existing bank question and a lesson by matching
 * free-text `topic`/`section` — that would be an unproven, approximate link.
 * Instead it creates one new, minimal, clearly-marked demo test per requested
 * subject, bound to that subject's earliest lesson that does not already have
 * one, with newly authored questions whose correct answer this script's
 * author has verified directly (plain arithmetic), not invented for an
 * existing ambiguous question.
 *
 * Kyrgyz-language content is deliberately NOT authored here: verifying a
 * correct answer for Kyrgyz grammar/vocabulary requires a linguist's
 * judgement this script cannot safely substitute for. Requesting --subject kyr
 * fails closed with that reason instead of guessing.
 *
 * Idempotent: a lesson that already has a practice_tests row carrying the
 * MARKER below in its description is left untouched; re-running with --apply
 * is a safe no-op for lessons it already seeded.
 *
 *   node backend/scripts/seed-lesson-assessment-demo.js [--subject math] [--apply]
 */
import process from 'node:process'

import { loadConfig } from '../src/config.js'
import { closeDatabase, connectDatabase, transaction } from '../src/db.js'

const MARKER = '[seed:lesson-assessment-demo:v1]'
const SUPPORTED_SUBJECTS = new Set(['math'])
const UNVERIFIABLE_SUBJECTS = new Set(['kyr'])

// Every answer below was checked by hand while writing this file. These are
// intentionally plain, unambiguous arithmetic so a reviewer can re-verify
// each one without any subject-matter tooling.
export const MATH_DEMO_QUESTIONS = Object.freeze([
  { text: 'Чему равно 7 + 8?', options: ['13', '14', '15', '16'], correct: 'c', section: 'arithmetic', topic: 'Сложение', difficulty: 'easy', explanation: '7 + 8 = 15.' },
  { text: 'Чему равно 12 − 5?', options: ['5', '6', '7', '8'], correct: 'c', section: 'arithmetic', topic: 'Вычитание', difficulty: 'easy', explanation: '12 − 5 = 7.' },
  { text: 'Чему равно 6 × 7?', options: ['36', '42', '48', '54'], correct: 'b', section: 'arithmetic', topic: 'Умножение', difficulty: 'easy', explanation: '6 × 7 = 42.' },
  { text: 'Чему равно 45 ÷ 9?', options: ['4', '5', '6', '9'], correct: 'b', section: 'arithmetic', topic: 'Деление', difficulty: 'easy', explanation: '45 ÷ 9 = 5, потому что 9 × 5 = 45.' },
  { text: 'Какое из чисел является чётным?', options: ['23', '31', '44', '57'], correct: 'c', section: 'arithmetic', topic: 'Чётность', difficulty: 'medium', explanation: '44 делится на 2 без остатка, остальные — нет.' },
  { text: 'Чему равно 3² (3 в квадрате)?', options: ['6', '8', '9', '12'], correct: 'c', section: 'arithmetic', topic: 'Степени', difficulty: 'medium', explanation: '3² = 3 × 3 = 9.' },
  { text: 'Сократите дробь 6/8 до несократимого вида.', options: ['1/2', '2/3', '3/4', '4/5'], correct: 'c', section: 'fractions', topic: 'Сокращение дробей', difficulty: 'medium', explanation: '6/8 = (6÷2)/(8÷2) = 3/4.' },
  { text: 'Чему равно 0,5 + 0,25?', options: ['0,65', '0,7', '0,75', '0,8'], correct: 'c', section: 'fractions', topic: 'Десятичные дроби', difficulty: 'medium', explanation: '0,5 + 0,25 = 0,75.' },
  { text: 'Какое из чисел наименьшее: 5, −2, 0, 3?', options: ['5', '−2', '0', '3'], correct: 'b', section: 'arithmetic', topic: 'Отрицательные числа', difficulty: 'medium', explanation: '−2 меньше нуля и меньше всех положительных чисел в списке.' },
  { text: 'Чему равно 15% от 200?', options: ['20', '25', '30', '35'], correct: 'c', section: 'percentages', topic: 'Проценты', difficulty: 'medium', explanation: '15% от 200 = 0,15 × 200 = 30.' },
  { text: 'Вычислите: 2 + 3 × 4.', options: ['9', '14', '20', '24'], correct: 'b', section: 'arithmetic', topic: 'Порядок действий', difficulty: 'hard', explanation: 'Сначала умножение: 3 × 4 = 12, затем 2 + 12 = 14.' },
  { text: 'Чему равен периметр квадрата со стороной 5 см?', options: ['10 см', '15 см', '20 см', '25 см'], correct: 'c', section: 'geometry', topic: 'Периметр', difficulty: 'hard', explanation: 'Периметр квадрата = 4 × сторону = 4 × 5 = 20 см.' },
  { text: 'Чему равна площадь прямоугольника со сторонами 4 см и 6 см?', options: ['10 см²', '20 см²', '24 см²', '28 см²'], correct: 'c', section: 'geometry', topic: 'Площадь', difficulty: 'hard', explanation: 'Площадь прямоугольника = 4 × 6 = 24 см².' },
  { text: 'Какое число простое (делится только на 1 и само себя)?', options: ['9', '15', '17', '21'], correct: 'c', section: 'arithmetic', topic: 'Простые числа', difficulty: 'hard', explanation: '17 делится только на 1 и 17. 9 = 3², 15 = 3×5, 21 = 3×7 — составные.' },
  { text: 'Решите уравнение: x + 5 = 12. Чему равен x?', options: ['5', '6', '7', '8'], correct: 'c', section: 'algebra', topic: 'Линейные уравнения', difficulty: 'hard', explanation: 'x = 12 − 5 = 7.' },
])

const DEMO_QUESTION_SETS = Object.freeze({ math: MATH_DEMO_QUESTIONS })

function fail(message) {
  throw new Error(`Lesson assessment demo seed blocked: ${message}`)
}

export function parseArgs(argv) {
  let apply = false
  let subject = 'math'
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--apply') apply = true
    else if (arg === '--dry-run') apply = false
    else if (arg === '--subject') { subject = argv[index + 1]; index += 1 }
    else fail(`unrecognized argument: ${arg}`)
  }
  if (UNVERIFIABLE_SUBJECTS.has(subject)) {
    fail(
      `subject "${subject}" is not seeded automatically: verifying a correct Kyrgyz-language `
      + 'answer requires a linguist/methodologist review this script cannot substitute for. '
      + 'Ask an admin to add a lesson-scoped test for this subject through /admin/lessons/:id/questions instead.',
    )
  }
  if (!SUPPORTED_SUBJECTS.has(subject)) fail(`unsupported --subject "${subject}"; supported: ${[...SUPPORTED_SUBJECTS].join(', ')}`)
  return { apply, subject }
}

/** Validated the same way the four-option/answer-key schema constraints in migration 002 require. */
export function validateDemoQuestions(questions) {
  if (questions.length < 1 || questions.length > 200) fail('demo question set must have between 1 and 200 questions')
  questions.forEach((question, index) => {
    if (typeof question.text !== 'string' || !question.text.trim()) fail(`question ${index + 1} is missing text`)
    if (!Array.isArray(question.options) || question.options.length !== 4) fail(`question ${index + 1} must have exactly four options`)
    if (question.options.some(option => typeof option !== 'string' || !option.trim())) fail(`question ${index + 1} has an empty option`)
    if (!['a', 'b', 'c', 'd'].includes(question.correct)) fail(`question ${index + 1} has an invalid correct answer`)
    if (!['easy', 'medium', 'hard'].includes(question.difficulty)) fail(`question ${index + 1} has an invalid difficulty`)
    if (!/^[a-z][a-z0-9_-]{0,63}$/.test(question.section)) fail(`question ${index + 1} has an invalid section`)
  })
  return questions
}

async function findOnlineCourse(client) {
  const result = await client.query(
    `SELECT id, name FROM courses WHERE delivery_mode = 'online' AND is_active = true FOR UPDATE`,
  )
  if (result.rowCount === 0) fail('no active online course exists; create one in /admin/lessons first')
  if (result.rowCount > 1) fail('more than one active online course exists; pick a target manually, this script refuses to guess')
  return result.rows[0]
}

async function findTargetLesson(client, courseId, subject) {
  // The earliest published lesson of this subject that has no bound,
  // question-bearing practice test yet — the natural first stop of the
  // Video -> Test chain for a fresh student.
  const result = await client.query(
    `SELECT l.id, l.lesson_number, l.title
       FROM lessons l
      WHERE l.course_id = $1 AND l.subject = $2 AND l.is_published = true
        AND NOT EXISTS (
          SELECT 1
            FROM practice_tests t
           WHERE t.lesson_id = l.id
             AND EXISTS (SELECT 1 FROM practice_questions q WHERE q.practice_test_id = t.id AND q.is_active = true)
        )
      ORDER BY l.lesson_number ASC, l.id ASC
      LIMIT 1`,
    [courseId, subject],
  )
  return result.rows[0] ?? null
}

async function findExistingSeededTest(client, courseId, subject) {
  const result = await client.query(
    `SELECT t.id, t.lesson_id, l.lesson_number, t.is_published,
            (SELECT count(*)::int FROM practice_questions q WHERE q.practice_test_id = t.id AND q.is_active = true) AS active_question_count
       FROM practice_tests t
       JOIN lessons l ON l.id = t.lesson_id
      WHERE t.course_id = $1
        AND t.subject = $2
        AND t.description LIKE '%' || $3 || '%'
      ORDER BY t.id ASC
      FOR UPDATE OF t`,
    [courseId, subject, MARKER],
  )
  if (result.rowCount > 1) fail(`multiple ${MARKER} tests exist for course ${courseId} and subject ${subject}; manual review required`)
  return result.rows[0] ?? null
}

async function createLessonTest(client, { courseId, lessonId, lessonTitle, subject, questions }) {
  const inserted = await client.query(
    `INSERT INTO practice_tests (
       course_id, lesson_id, title, subject, test_type, description,
       pass_score_ratio, is_published
     ) VALUES ($1, $2, $3, $4, 'practice', $5, 0.7, true)
     RETURNING id`,
    [
      courseId, lessonId, `Проверка урока: ${lessonTitle}`, subject,
      `Демонстрационный тест урока, чтобы цепочка «видео → тест → результат» была рабочей до полного review контента. `
      + `Вопросы — базовая арифметика, ответы проверены вручную при создании. ${MARKER}`,
    ],
  )
  const testId = Number(inserted.rows[0].id)
  for (const [index, question] of questions.entries()) {
    await client.query(
      `INSERT INTO practice_questions (
         practice_test_id, question_text, options, correct_answer, explanation,
         section, topic, difficulty, position, is_active
       ) VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7, $8, $9, true)`,
      [
        testId, question.text,
        JSON.stringify({ a: question.options[0], b: question.options[1], c: question.options[2], d: question.options[3] }),
        question.correct, question.explanation, question.section, question.topic, question.difficulty, index + 1,
      ],
    )
  }
  await client.query(
    `INSERT INTO audit_log (actor_user_id, action, target_type, target_id, metadata)
     VALUES (NULL, 'seed_lesson_assessment_demo', 'practice_test', $1, $2::jsonb)`,
    [String(testId), JSON.stringify({ lessonId, courseId, subject, questionCount: questions.length })],
  )
  return testId
}

export async function planSeed(client, subject) {
  const course = await findOnlineCourse(client)
  // Check the marker before choosing an empty lesson. Checking only the
  // target lesson is not idempotent: after the first run that lesson is no
  // longer empty, so a second run would advance to another lesson and create
  // a second seed. The marker is unique per course/subject instead.
  const existing = await findExistingSeededTest(client, course.id, subject)
  if (existing) {
    const complete = existing.is_published === true && Number(existing.active_question_count) === DEMO_QUESTION_SETS[subject].length
    return {
      status: complete ? 'already_seeded' : 'seed_requires_review',
      subject,
      courseId: Number(course.id),
      lessonId: Number(existing.lesson_id),
      lessonNumber: Number(existing.lesson_number),
      testId: Number(existing.id),
      isPublished: existing.is_published === true,
      activeQuestionCount: Number(existing.active_question_count),
      ...(complete ? {} : { reason: 'an existing marked seed is incomplete; refusing to duplicate or silently repair it' }),
    }
  }
  const lesson = await findTargetLesson(client, course.id, subject)
  if (!lesson) {
    return {
      status: 'no_target_lesson',
      subject,
      courseId: Number(course.id),
      reason: `every published "${subject}" lesson in "${course.name}" already has a bound practice test, `
        + 'or no published lesson exists for this subject yet',
    }
  }
  return {
    status: 'ready',
    subject,
    courseId: Number(course.id),
    lessonId: Number(lesson.id),
    lessonNumber: lesson.lesson_number,
    lessonTitle: lesson.title,
    questionCount: validateDemoQuestions(DEMO_QUESTION_SETS[subject]).length,
  }
}

async function main() {
  const { apply, subject } = parseArgs(process.argv.slice(2))
  const config = loadConfig()
  connectDatabase(config)
  try {
    const result = await transaction(async client => {
      const plan = await planSeed(client, subject)
      if (!apply || plan.status !== 'ready') return plan
      const testId = await createLessonTest(client, {
        courseId: plan.courseId,
        lessonId: plan.lessonId,
        lessonTitle: plan.lessonTitle,
        subject,
        questions: DEMO_QUESTION_SETS[subject],
      })
      return { ...plan, status: 'applied', testId }
    })
    process.stdout.write(`${JSON.stringify({ dryRun: !apply, ...result }, null, 2)}\n`)
    if (result.status === 'ready' && !apply) {
      process.stdout.write('Dry run only: re-run with --apply to write.\n')
    }
  } finally {
    await closeDatabase()
  }
}

if (process.argv[1] && process.argv[1].endsWith('seed-lesson-assessment-demo.js')) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : 'Lesson assessment demo seed failed')
    process.exitCode = 1
  })
}
