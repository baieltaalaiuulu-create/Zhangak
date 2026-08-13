import assert from 'node:assert/strict'
import test from 'node:test'

import { parsePlatformTeacherDashboard } from '../../lib/platform-teacher.ts'

const RESPONSE = {
  teacher: { fullName: 'Айжан Токтосунова' },
  groups: [{
    id: 14,
    name: 'ОРТ-11 А',
    course: { id: 7, name: 'Подготовка к ОРТ', level: '11 класс', subject: 'Математика' },
    deliveryMode: 'hybrid',
    startsOn: '2026-09-01',
    endsOn: null,
    activeStudentCount: 22,
    publishedLessonCount: 4,
  }],
}

test('teacher dashboard parser accepts only the first-party read model', () => {
  assert.deepEqual(parsePlatformTeacherDashboard(RESPONSE), RESPONSE)
})

test('teacher dashboard parser rejects unsafe IDs, counters and unrecognized delivery modes', () => {
  assert.throws(
    () => parsePlatformTeacherDashboard({ ...RESPONSE, groups: [{ ...RESPONSE.groups[0], activeStudentCount: -1 }] }),
    /некорректные данные кабинета/,
  )
  assert.throws(
    () => parsePlatformTeacherDashboard({ ...RESPONSE, groups: [{ ...RESPONSE.groups[0], deliveryMode: 'remote' }] }),
    /некорректные данные кабинета/,
  )
  assert.throws(
    () => parsePlatformTeacherDashboard({ ...RESPONSE, groups: [{ ...RESPONSE.groups[0], course: { ...RESPONSE.groups[0].course, id: 0 } }] }),
    /некорректные данные кабинета/,
  )
})
