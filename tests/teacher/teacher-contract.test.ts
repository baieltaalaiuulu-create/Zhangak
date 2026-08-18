import assert from 'node:assert/strict'
import test from 'node:test'

import { gradeTotal, parseAttendanceEntries, parseGradeEntries } from '../../lib/teacher-contract.ts'

test('attendance accepts only unique, exact and bounded entries', () => {
  assert.deepEqual(parseAttendanceEntries([
    { studentId: 'student-a', status: 'present' },
    { studentId: 'student-b', status: 'late' },
  ]), [
    { studentId: 'student-a', status: 'present' },
    { studentId: 'student-b', status: 'late' },
  ])
  assert.equal(parseAttendanceEntries([]), null)
  assert.equal(parseAttendanceEntries([{ studentId: 'student-a', status: 'remote' }]), null)
  assert.equal(parseAttendanceEntries([{ studentId: 'student-a', status: 'present', role: 'teacher' }]), null)
  assert.equal(parseAttendanceEntries([
    { studentId: 'student-a', status: 'present' },
    { studentId: 'student-a', status: 'absent' },
  ]), null)
})

test('grade parser enforces exact subjects and their individual maxima', () => {
  const valid = [{
    studentId: 'student-a',
    scores: { math: 40, analogy: 20, reading: 30, grammar: 40 },
  }]
  assert.deepEqual(parseGradeEntries(valid), valid)
  assert.equal(parseGradeEntries([{ studentId: 'student-a', scores: { math: 41, analogy: 20, reading: 30, grammar: 40 } }]), null)
  assert.equal(parseGradeEntries([{ studentId: 'student-a', scores: { math: null, analogy: null, reading: null, grammar: null } }]), null)
  assert.equal(parseGradeEntries([{ studentId: 'student-a', scores: { math: 10, analogy: 10, reading: 10, grammar: 10, total: 40 } }]), null)
})

test('grade total is derived by the server contract', () => {
  assert.equal(gradeTotal({ math: 35, analogy: 18, reading: 25, grammar: 32 }), 110)
  assert.equal(gradeTotal({ math: 10, analogy: null, reading: null, grammar: 5 }), 15)
})
