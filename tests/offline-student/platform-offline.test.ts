import assert from 'node:assert/strict'
import test from 'node:test'

import {
  OfflineStudentRequestError,
  parseOfflineStudentDashboard,
} from '../../lib/offline-student-data.ts'

const response = {
  profile: {
    id: 'student-1',
    fullName: 'Алия Тестова',
    studentType: 'offline',
    targetScore: 200,
  },
  group: {
    id: 7,
    name: 'ОРТ-11 А',
    courseName: 'Подготовка к ОРТ',
    teacherName: 'Айбек У.',
  },
  lessons: [{
    id: 3,
    lessonNumber: 4,
    title: 'Квадратные уравнения',
    startsAt: '2026-09-10',
    durationMinutes: 90,
    isTest: false,
    attendance: 'pending',
    topics: ['Дискриминант'],
  }],
  homework: [],
  grades: [],
  progress: { latestOrtScore: null, targetScore: 200 },
  availability: { exactSchedule: false, materials: false },
}

test('first-party offline client accepts the limited owned-schema projection', () => {
  assert.deepEqual(parseOfflineStudentDashboard(response), response)
})

test('offline client fails closed if an unmigrated attendance, grade, or schedule field appears', () => {
  const unsafeResponses = [
    { ...response, homework: [{ id: 1 }] },
    { ...response, grades: [{ lessonId: 3 }] },
    { ...response, availability: { exactSchedule: true, materials: false } },
    { ...response, lessons: [{ ...response.lessons[0], attendance: 'present' }] },
    { ...response, progress: { latestOrtScore: 180, targetScore: 200 } },
  ]
  for (const value of unsafeResponses) {
    assert.throws(
      () => parseOfflineStudentDashboard(value),
      error => error instanceof OfflineStudentRequestError && error.status === 502,
    )
  }
})
