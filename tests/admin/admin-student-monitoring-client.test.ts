import assert from 'node:assert/strict'
import test from 'node:test'
import { changeStudentAccess, parseStudentMonitoring } from '../../lib/admin-student-monitoring-client.ts'

test('student access client exposes the bounded access action', () => {
  assert.equal(typeof changeStudentAccess, 'function')
})

test('monitoring parser accepts aggregate activity and bounded access terms', () => {
  const result = parseStudentMonitoring({ total: 1, items: [{
    id: '22222222-2222-4222-8222-222222222222', fullName: 'Тестовый ученик', email: 'student@example.test', blocked: false,
    studentType: 'online', phone: null, createdAt: '2026-08-21T00:00:00.000Z', lastSeenAt: null,
    metrics: { xp: 20, level: 1, visits30d: 3, lessonsCompleted: 1, practiceSubmitted: 2, trainerMastered: 4, dailyChallenges: 0, questsClaimed: 1 },
    access: { enrollmentId: 7, state: 'active', status: 'active', plan: 'three_months', courseName: 'ОРТ', startedAt: '2026-08-01T00:00:00.000Z', expiresAt: '2026-11-01T00:00:00.000Z', frozenAt: null, freezeReason: null },
  }] })
  assert.equal(result.items[0].access?.plan, 'three_months')
  assert.throws(() => parseStudentMonitoring({ total: 1, items: [{ ...result.items[0], metrics: { ...result.items[0].metrics, xp: -1 } }] }), /Некорректный ответ/)
})
