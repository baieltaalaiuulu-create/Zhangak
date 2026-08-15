import assert from 'node:assert/strict'
import test from 'node:test'

import { parseOfflineTeacherWorkspace } from '../../lib/offline-classroom.ts'

const workspace = {
  group: { id: 4, name: 'ОРТ-1', courseName: 'Подготовка к ОРТ' },
  students: [{ id: '11111111-1111-4111-8111-111111111111', fullName: 'Айдана Токтосунова' }],
  lessons: [{ id: 9, lessonNumber: 1, title: 'Квадратные уравнения' }],
  sessions: [{ id: 12, lessonId: 9, lessonTitle: 'Квадратные уравнения', startsAt: '2026-09-01T08:00:00.000Z', endsAt: null, room: '12', status: 'scheduled' }],
  homework: [{ id: 3, title: 'Решить задания 1–10', dueAt: '2026-09-02T08:00:00.000Z', published: true }],
}

test('offline teacher client accepts a bounded first-party classroom workspace', () => {
  assert.deepEqual(parseOfflineTeacherWorkspace(workspace), workspace)
})

test('offline teacher client rejects duplicate students and malformed journal data', () => {
  const unsafe = [
    { ...workspace, students: [...workspace.students, workspace.students[0]] },
    { ...workspace, sessions: [{ ...workspace.sessions[0], status: 'open' }] },
    { ...workspace, homework: [{ ...workspace.homework[0], published: 'yes' }] },
    { ...workspace, lessons: [{ id: 0, lessonNumber: 1, title: 'x' }] },
  ]
  for (const payload of unsafe) assert.throws(() => parseOfflineTeacherWorkspace(payload))
})
