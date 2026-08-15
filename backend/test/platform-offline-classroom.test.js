import assert from 'node:assert/strict'
import test from 'node:test'

import { HttpError } from '../src/http.js'
import {
  parseAttendance,
  parseComment,
  parseGrade,
  parseHomework,
  parseSession,
} from '../src/routes/platform-offline-classroom.js'

const STUDENT_ID = '11111111-1111-4111-8111-111111111111'

function invalid(operation, code) {
  assert.throws(operation, error => error instanceof HttpError && error.code === code)
}

test('offline session, homework, and attendance inputs fail closed', () => {
  const session = parseSession({ lessonId: 4, startsAt: '2026-09-01T08:00:00.000Z', room: 'Кабинет 12' })
  assert.equal(session.lessonId, 4)
  assert.equal(session.room, 'Кабинет 12')
  invalid(() => parseSession({ lessonId: 4, startsAt: 'invalid' }), 'invalid_starts_at')
  invalid(() => parseHomework({ title: '  ' }), 'invalid_homework_title')
  invalid(() => parseHomework({ title: 'ДЗ', forged: true }), 'invalid_homework')

  const entries = parseAttendance({ entries: [{ studentId: STUDENT_ID, status: 'present' }] })
  assert.deepEqual(entries, [{ studentId: STUDENT_ID, status: 'present', note: null }])
  invalid(() => parseAttendance({ entries: [{ studentId: STUDENT_ID, status: 'present' }, { studentId: STUDENT_ID, status: 'late' }] }), 'duplicate_attendance_student')
  invalid(() => parseAttendance({ entries: [{ studentId: STUDENT_ID, status: 'remote' }] }), 'invalid_attendance_status')
})

test('offline grades and comments enforce source and visibility boundaries', () => {
  const grade = parseGrade({ studentId: STUDENT_ID, gradeType: 'lesson', sessionId: 3, title: 'Контрольная', score: 90, publish: false })
  assert.equal(grade.score, 90)
  assert.equal(grade.publish, false)
  invalid(() => parseGrade({ studentId: STUDENT_ID, gradeType: 'lesson', sessionId: 3, title: 'Контрольная', score: 101 }), 'invalid_grade_score')
  invalid(() => parseGrade({ studentId: STUDENT_ID, gradeType: 'homework', sessionId: 3, title: 'ДЗ', score: 80 }), 'invalid_grade_source')

  const comment = parseComment({ studentId: STUDENT_ID, visibility: 'internal', body: 'Нужна поддержка' })
  assert.equal(comment.visibility, 'internal')
  invalid(() => parseComment({ studentId: STUDENT_ID, visibility: 'public', body: 'x' }), 'invalid_comment_visibility')
  invalid(() => parseComment({ studentId: STUDENT_ID, visibility: 'student', body: 'x', role: 'admin' }), 'invalid_offline_comment')
})
