import assert from 'node:assert/strict'
import test from 'node:test'

import {
  activeHomework,
  attendanceSummary,
  nextScheduledLesson,
  scoreGap,
  type OfflineHomework,
  type OfflineLesson,
} from '../../lib/offline-student-contract.ts'

function lesson(id: number, attendance: OfflineLesson['attendance'], startsAt: string | null = null): OfflineLesson {
  return { id, lessonNumber: id, title: `Урок ${id}`, startsAt, durationMinutes: null, isTest: false, attendance, topics: [] }
}

test('attendance counts late as attended and ignores unrecorded lessons', () => {
  assert.deepEqual(attendanceSummary([
    lesson(1, 'present'),
    lesson(2, 'late'),
    lesson(3, 'absent'),
    lesson(4, 'pending'),
  ]), { recorded: 3, present: 1, late: 1, absent: 1, rate: 67 })
  assert.equal(attendanceSummary([lesson(1, 'pending')]).rate, null)
})

test('next lesson uses only valid future dates', () => {
  const now = new Date('2026-08-13T10:00:00+06:00')
  const next = nextScheduledLesson([
    lesson(1, 'present', '2026-08-12T09:00:00+06:00'),
    lesson(2, 'pending', 'not-a-date'),
    lesson(3, 'pending', '2026-08-14T11:00:00+06:00'),
    lesson(4, 'pending', '2026-08-13T12:00:00+06:00'),
  ], now)
  assert.equal(next?.id, 4)
})

test('active homework keeps overdue work visible and orders missing deadlines last', () => {
  const homework: OfflineHomework[] = [
    { id: 1, lessonId: 1, lessonTitle: 'A', title: 'Без срока', description: null, dueAt: null, completed: false },
    { id: 2, lessonId: 1, lessonTitle: 'A', title: 'Просрочено', description: null, dueAt: '2026-01-01T09:00:00Z', completed: false },
    { id: 3, lessonId: 1, lessonTitle: 'A', title: 'Сдано', description: null, dueAt: '2026-01-02T09:00:00Z', completed: true },
  ]
  assert.deepEqual(activeHomework(homework).map(item => item.id), [2, 1])
})

test('score gap remains unknown without a real mock score', () => {
  assert.equal(scoreGap({ latestOrtScore: null, targetScore: 200 }), null)
  assert.equal(scoreGap({ latestOrtScore: 170, targetScore: 200 }), 30)
  assert.equal(scoreGap({ latestOrtScore: 210, targetScore: 200 }), 0)
})
