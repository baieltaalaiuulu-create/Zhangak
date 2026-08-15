import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'

import { parseAdminOfflineScheduleWorkspace } from '../../lib/admin-offline-schedule-client.ts'

const workspace = {
  group: { id: 4, name: 'ОРТ-11 А', courseName: 'ОРТ математика' },
  lessons: [{ id: 7, lessonNumber: 1, title: 'Функции' }],
  sessions: [{ id: 3, lessonId: 7, lessonTitle: 'Функции', startsAt: '2026-09-01T08:00:00.000Z', endsAt: null, room: '12', status: 'scheduled' }],
  announcements: [{ id: 9, title: 'Кабинет', body: 'Занятие в 12 кабинете.', published: true, publishedAt: '2026-09-01T08:00:00.000Z', createdAt: '2026-08-30T08:00:00.000Z' }],
}

test('admin offline schedule parser accepts only first-party schedule and announcement DTOs', () => {
  assert.deepEqual(parseAdminOfflineScheduleWorkspace(workspace), workspace)
  assert.throws(() => parseAdminOfflineScheduleWorkspace({ ...workspace, sessions: [{ ...workspace.sessions[0], status: 'moved' }] }))
  assert.throws(() => parseAdminOfflineScheduleWorkspace({ ...workspace, announcements: [{ ...workspace.announcements[0], published: 'yes' }] }))
})

test('admin schedule client remains on the own admin BFF namespace', async () => {
  const source = await readFile(path.resolve('lib/admin-offline-schedule-client.ts'), 'utf8')
  assert.match(source, /\/v1\/admin\/offline\/groups\//)
  assert.doesNotMatch(source, /supabase/i)
  assert.doesNotMatch(source, /\/v1\/platform\//)
})
