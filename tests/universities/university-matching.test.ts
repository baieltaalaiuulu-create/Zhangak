import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildAdmissionPlanPrompt,
  getAdmissionProbability,
  rankAdmissionMatches,
} from '../../lib/university-matching.ts'

test('admission probability stays unknown without a real mock result or published threshold', () => {
  assert.equal(getAdmissionProbability(null, 140).level, 'unknown')
  assert.equal(getAdmissionProbability(0, 140).level, 'unknown')
  assert.equal(getAdmissionProbability(180, null).level, 'unknown')
  assert.equal(getAdmissionProbability(180, 0).level, 'unknown')
})

test('admission probability uses the documented score bands', () => {
  assert.deepEqual(getAdmissionProbability(180, 150), {
    level: 'high', label: 'Высокая вероятность', pointsNeeded: 0,
  })
  assert.equal(getAdmissionProbability(155, 150).level, 'medium')
  assert.deepEqual(getAdmissionProbability(135, 150), {
    level: 'low', label: 'Низкая вероятность', pointsNeeded: 15,
  })
})

test('recommended universities prioritize reachable thresholds and closest gap', () => {
  const candidates = [
    { id: 'unknown', name: 'Нет данных', minScore: null, rating: 5 },
    { id: 'far', name: 'Высокий порог', minScore: 190, rating: 5 },
    { id: 'medium', name: 'Подходит', minScore: 160, rating: 3 },
    { id: 'high', name: 'Уверенный вариант', minScore: 130, rating: 2 },
    { id: 'near', name: 'Близкий порог', minScore: 175, rating: 4 },
  ]

  assert.deepEqual(
    rankAdmissionMatches(candidates, 165, 4).map(candidate => candidate.id),
    ['high', 'medium', 'near', 'far'],
  )
})

test('admission plan prompt forbids fabricated university facts', () => {
  const prompt = buildAdmissionPlanPrompt(null, 200)
  assert.match(prompt, /нет результата пробного ОРТ/)
  assert.match(prompt, /Не придумывай проходные баллы, стоимость или сроки/)
})
