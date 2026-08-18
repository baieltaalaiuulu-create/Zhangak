import assert from 'node:assert/strict'
import test from 'node:test'

import { parseAdminDailyChallenge } from '../../lib/admin-daily-challenges-client.ts'

const challenge = {
  id: 8, courseId: 4, challengeDate: '2026-08-16', title: 'Алгебра: задание дня',
  subject: 'math', xpReward: 30, isPublished: false, questionCount: 15,
  createdAt: '2026-08-16T00:00:00.000Z',
}

test('daily challenge client accepts only the fixed course-scoped admin projection', () => {
  assert.deepEqual(parseAdminDailyChallenge(challenge), challenge)
  assert.throws(() => parseAdminDailyChallenge({ ...challenge, subject: 'physics' }), /предмет задания дня/)
  assert.throws(() => parseAdminDailyChallenge({ ...challenge, questionCount: 14 }), /вопросы задания дня/)
})
