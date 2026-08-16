import { createHash } from 'node:crypto'
import { readFile, realpath } from 'node:fs/promises'
import { isAbsolute, relative, resolve, sep } from 'node:path'

import mammoth from 'mammoth'

const REPOSITORY_ROOT = resolve(import.meta.dirname, '../..')
const configuredSourceRoot = process.env.ZHANGAK_SORTED_DATA_ROOT?.trim()
if (configuredSourceRoot && !isAbsolute(configuredSourceRoot)) {
  throw new Error('Sorted DOCX importer blocked: ZHANGAK_SORTED_DATA_ROOT must be an absolute path')
}
// Releases intentionally do not embed the raw sorted-data archive. Operators
// may stage the two approved documents in a private, absolute directory for a
// one-time import; all source paths remain allowlisted below.
const SORTED_DATA_ROOT = configuredSourceRoot ? resolve(configuredSourceRoot) : resolve(REPOSITORY_ROOT, 'sorted_data')
const MAX_QUESTIONS_PER_TEST = 200

const SOURCE_BANKS = [
  {
    sourceId: 'analogies-245-v1',
    relativePath: '03_analogies/logical_connections/245 аналогия жообу менен.docx',
    expectedQuestions: 245,
    answerHeading: /^аналогия\s*\(жооптор\)$/iu,
    ignoreHeading: /^аналогиялар$/iu,
    title: 'Аналогиялар: тренажёр',
    description: 'Импортированный банк аналогий. Перед публикацией проверьте методическое качество в админ-панели.',
    subject: 'kyr',
    section: 'analogies',
    topic: 'logical-connections',
    // The source's answer list prints "201)в" between 119 and 121. Its
    // position proves it is the answer for question 120; retain this small,
    // reviewed transcription correction in code instead of silently guessing.
    answerKeyCorrections: [{ printedNumber: 201, expectedNumber: 120, answer: 'c' }],
  },
  {
    sourceId: 'kyrgyz-grammar-240-v1',
    relativePath: '02_kyrgyz_language/grammar_and_morphology/240_суроо_кыргыз_прг_жообу_менен_2.docx',
    expectedQuestions: 240,
    answerHeading: /^практикалык\s+грамматика\s*\(жооптору\):?$/iu,
    ignoreHeading: /^с1\.\s*практикалык\s+грамматика\./iu,
    title: 'Кыргыз тили: практикалык грамматика',
    description: 'Импортированный банк практической грамматики. Перед публикацией проверьте методическое качество в админ-панели.',
    subject: 'kyr',
    section: 'grammar',
    topic: 'practical-grammar',
    // The source omits the printed "238." before this question. The answer
    // key includes 238, so its boundary is recorded explicitly for review.
    implicitQuestionStarts: [{ afterQuestion: 237, number: 238, startsWith: '2021-жылдын' }],
  },
]

const OPTION_LETTERS = new Map([
  ['a', 'a'], ['а', 'a'],
  ['b', 'b'], ['б', 'b'],
  ['v', 'c'], ['в', 'c'],
  ['g', 'd'], ['г', 'd'],
])

function fail(message) {
  throw new Error(`Sorted DOCX importer blocked: ${message}`)
}

function digest(value) {
  return createHash('sha256').update(value).digest('hex')
}

function compact(value) {
  return value.replace(/\s+/gu, ' ').trim()
}

function normalizedOptionLetter(value) {
  return OPTION_LETTERS.get(value.toLocaleLowerCase('ru')) ?? null
}

function normalizedQuestionOption(value, occupied) {
  const normalized = normalizedOptionLetter(value)
  // In the grammar DOCX a few Cyrillic "В" labels were extracted as a
  // Latin "B". If the real Б/b choice is already present, the only
  // lossless four-choice interpretation is the next c/В slot.
  if ((value === 'B' || value === 'b') && normalized === 'b' && occupied.has('b') && !occupied.has('c')) return 'c'
  return normalized
}

function sourcePath(bank) {
  const resolved = resolve(SORTED_DATA_ROOT, bank.relativePath)
  const expectedRelative = relative(SORTED_DATA_ROOT, resolved)
  if (!expectedRelative || expectedRelative.startsWith(`..${sep}`) || expectedRelative === '..') {
    fail(`source path escapes sorted_data for ${bank.sourceId}`)
  }
  if (expectedRelative.split(/[\\/]/u).includes('06_chat_exports_and_history')) {
    fail(`chat export paths are forbidden: ${bank.sourceId}`)
  }
  return resolved
}

async function approvedRealPath(bank) {
  const path = sourcePath(bank)
  const actual = await realpath(path)
  const dataRoot = await realpath(SORTED_DATA_ROOT)
  const inside = relative(dataRoot, actual)
  if (!inside || inside.startsWith(`..${sep}`) || inside === '..') fail(`source symlink escapes sorted_data: ${bank.sourceId}`)
  return actual
}

function parseAnswerKey(lines, bank) {
  const answers = new Map()
  const joined = lines.join(' ')
  const expression = /(\d{1,3})\s*[.)-]\s*([A-Za-zА-Яа-я])/gu
  for (const match of joined.matchAll(expression)) {
    const printedNumber = Number(match[1])
    const answer = normalizedOptionLetter(match[2])
    if (!answer) fail(`answer key includes unsupported option ${match[2]} for question ${printedNumber}`)
    const correction = bank.answerKeyCorrections?.find(item => (
      item.printedNumber === printedNumber && item.expectedNumber === answers.size + 1 && item.answer === answer
    ))
    const number = correction ? correction.expectedNumber : printedNumber
    if (number < 1 || number > bank.expectedQuestions || answers.has(number)) fail(`invalid or duplicate answer key number ${printedNumber}`)
    answers.set(number, answer)
  }
  if (answers.size !== bank.expectedQuestions) fail(`answer key has ${answers.size} answers; expected ${bank.expectedQuestions}`)
  for (let number = 1; number <= bank.expectedQuestions; number += 1) {
    if (!answers.has(number)) fail(`answer key misses question ${number}`)
  }
  return answers
}

function parseQuestions(lines, bank) {
  const questions = []
  let current = null
  let expectedNumber = 1

  function append(target, value) {
    target.push(compact(value))
  }

  function flush() {
    if (!current) return
    if (current.number !== expectedNumber) fail(`question sequence expected ${expectedNumber}, received ${current.number}`)
    const questionText = compact(current.question.join(' '))
    const options = Object.fromEntries([...current.options.entries()].map(([key, values]) => [key, compact(values.join(' '))]))
    if (!questionText) fail(`question ${current.number} has no text`)
    for (const option of ['a', 'b', 'c', 'd']) {
      if (!options[option]) fail(`question ${current.number} misses option ${option}`)
    }
    if (Object.keys(options).length !== 4) fail(`question ${current.number} does not have exactly four options`)
    questions.push({ number: current.number, questionText, options })
    expectedNumber += 1
    current = null
  }

  for (const rawLine of lines) {
    const line = compact(rawLine)
    if (!line || bank.ignoreHeading.test(line)) continue

    const questionStart = line.match(/^(\d{1,3})(?:\s*[.)])?\s*(.+)$/u)
    // A few source questions omit the dot after their number (for example
    // "96 хиджаб : араб"). Treat a numeric line as a new question only when
    // it is the immediate next sequence value, never when it is an option.
    const startsNextQuestion = questionStart && (
      (!current && Number(questionStart[1]) === expectedNumber)
      || (current && Number(questionStart[1]) === current.number + 1)
    )
    if (startsNextQuestion) {
      flush()
      current = { number: Number(questionStart[1]), question: [], options: new Map(), currentOption: null }
      if (questionStart[2]) append(current.question, questionStart[2])
      continue
    }

    // Some DOCX rows place two choices on the same visual line. Split only
    // recognised A-D markers; Roman numerals inside the question stay text.
    const optionMarkers = [...line.matchAll(/(?:^|\s)([A-Za-zА-Яа-я])\s*[).:]\s*/gu)]
      .filter(marker => normalizedOptionLetter(marker[1]) !== null)
    if (optionMarkers.length > 0) {
      if (!current) fail('option appears before a question')
      for (const [index, marker] of optionMarkers.entries()) {
        const option = normalizedQuestionOption(marker[1], current.options)
        if (!option) continue
        if (current.options.has(option)) fail(`question ${current.number} has duplicate option ${option}`)
        const startsAt = marker.index + marker[0].length
        const endsAt = optionMarkers[index + 1]?.index ?? line.length
        current.options.set(option, [])
        current.currentOption = option
        const text = compact(line.slice(startsAt, endsAt))
        if (text) append(current.options.get(option), text)
      }
      continue
    }

    const implicitStart = current && bank.implicitQuestionStarts?.find(item => (
      item.afterQuestion === current.number && line.startsWith(item.startsWith)
    ))
    if (implicitStart) {
      flush()
      if (implicitStart.number !== expectedNumber) fail(`implicit question number mismatch at ${implicitStart.number}`)
      current = { number: implicitStart.number, question: [], options: new Map(), currentOption: null }
      append(current.question, line)
      continue
    }

    if (!current) {
      // The analogy document omits the number on its first question.
      current = { number: expectedNumber, question: [], options: new Map(), currentOption: null }
    }
    if (current.currentOption) append(current.options.get(current.currentOption), line)
    else append(current.question, line)
  }
  flush()
  if (questions.length !== bank.expectedQuestions) {
    fail(`${bank.sourceId} yielded ${questions.length} questions; expected ${bank.expectedQuestions}`)
  }
  return questions
}

function splitIntoTests(bank, sourceSha256, parsedQuestions, answers) {
  const tests = []
  const questions = []
  for (let offset = 0; offset < parsedQuestions.length; offset += MAX_QUESTIONS_PER_TEST) {
    const chunk = parsedQuestions.slice(offset, offset + MAX_QUESTIONS_PER_TEST)
    const part = Math.floor(offset / MAX_QUESTIONS_PER_TEST) + 1
    const sourceId = `${bank.sourceId}:part-${part}`
    const test = {
      sourceId,
      title: `${bank.title} — ${part}-бөлүк`,
      subject: bank.subject,
      testType: 'bank',
      description: `${bank.description} Часть ${part} из ${Math.ceil(parsedQuestions.length / MAX_QUESTIONS_PER_TEST)}.`,
      isPublished: false,
      fingerprint: digest(JSON.stringify({ sourceSha256, sourceId, questions: chunk.length })),
    }
    tests.push(test)
    for (const [index, item] of chunk.entries()) {
      const correctAnswer = answers.get(item.number)
      if (!correctAnswer) fail(`missing answer for ${bank.sourceId} question ${item.number}`)
      const question = {
        sourceId: `${bank.sourceId}:question-${item.number}`,
        sourceTestId: sourceId,
        questionText: item.questionText,
        options: item.options,
        correctAnswer,
        section: bank.section,
        topic: bank.topic,
        difficulty: 'medium',
        position: index + 1,
      }
      question.fingerprint = digest(JSON.stringify({ sourceSha256, ...question }))
      questions.push(question)
    }
  }
  return { tests, questions }
}

async function parseBank(bank) {
  const filePath = await approvedRealPath(bank)
  const bytes = await readFile(filePath)
  const sourceSha256 = digest(bytes)
  const extracted = await mammoth.extractRawText({ path: filePath })
  if (extracted.messages.some(message => message.type === 'error')) fail(`DOCX extraction failed for ${bank.sourceId}`)
  const lines = extracted.value.split(/\r?\n/u).map(compact).filter(Boolean)
  const headingIndex = lines.findIndex(line => bank.answerHeading.test(line))
  if (headingIndex < 1) fail(`answer heading not found for ${bank.sourceId}`)
  const answers = parseAnswerKey(lines.slice(headingIndex + 1), bank)
  const parsedQuestions = parseQuestions(lines.slice(0, headingIndex), bank)
  const result = splitIntoTests(bank, sourceSha256, parsedQuestions, answers)
  return { bank, sourceSha256, ...result }
}

/** Read only the two allowlisted documents. It never follows chat-export paths. */
export async function fetchSortedDocxPlan() {
  const parsed = await Promise.all(SOURCE_BANKS.map(parseBank))
  const tests = parsed.flatMap(item => item.tests)
  const questions = parsed.flatMap(item => item.questions)
  return {
    sourceSystem: 'sorted_data_docx_v1',
    tests,
    questions,
    sourceFiles: parsed.map(item => ({ sourceId: item.bank.sourceId, sha256: item.sourceSha256, questionCount: item.bank.expectedQuestions })),
  }
}

export function sortedDocxImportSummary(plan) {
  return {
    sourceSystem: plan.sourceSystem,
    sourceFiles: plan.sourceFiles,
    practiceTests: plan.tests.length,
    practiceQuestions: plan.questions.length,
    published: false,
  }
}
