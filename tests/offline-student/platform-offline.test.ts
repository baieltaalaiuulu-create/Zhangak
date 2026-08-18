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
    attendance: 'present',
    topics: ['Дискриминант'],
  }],
  homework: [{ id: 8, lessonId: 3, lessonTitle: 'Квадратные уравнения', title: 'Решить №1–10', description: null, dueAt: '2026-09-12T08:00:00.000Z', completed: false }],
  grades: [{ lessonId: 3, lessonTitle: 'Контрольная', math: null, analogy: null, reading: null, grammar: null, total: 90 }],
  comments: [{ id: 4, body: 'Хорошая работа', createdAt: '2026-09-12T08:00:00.000Z' }],
  announcements: [{ id: 2, title: 'Изменение кабинета', body: 'Встречаемся в кабинете 12.', publishedAt: '2026-09-12T08:00:00.000Z' }],
  progress: { latestOrtScore: null, targetScore: 200 },
  availability: { exactSchedule: true, materials: false },
}

test('first-party offline client accepts the owned classroom projection', () => {
  assert.deepEqual(parseOfflineStudentDashboard(response), response)
})

test('offline client fails closed for malformed classroom data', () => {
  const unsafeResponses = [
    { ...response, homework: [{ id: 1 }] },
    { ...response, grades: [{ lessonId: 3 }] },
    { ...response, comments: [{ id: 4, body: '', createdAt: '2026-09-12T08:00:00.000Z' }] },
    { ...response, announcements: [{ id: 2, title: 'Новость', body: '', publishedAt: '2026-09-12T08:00:00.000Z' }] },
    { ...response, availability: { exactSchedule: 'yes', materials: false } },
    { ...response, lessons: [{ ...response.lessons[0], attendance: 'remote' }] },
    { ...response, progress: { latestOrtScore: 180, targetScore: 200 } },
  ]
  for (const value of unsafeResponses) {
    assert.throws(
      () => parseOfflineStudentDashboard(value),
      error => error instanceof OfflineStudentRequestError && error.status === 502,
    )
  }
})
