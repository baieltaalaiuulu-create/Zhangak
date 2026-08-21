import assert from 'node:assert/strict'
import test from 'node:test'
import { getAdmissionProbability, rankAdmissionMatches } from '../../lib/university-matching.ts'
import { parseUniversityCatalog } from '../../lib/universities-data.ts'

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

test('an empty first-party catalog is an explicit valid state, not fabricated data', () => {
  assert.deepEqual(parseUniversityCatalog({
    items: [],
    stats: {
      totalUniversities: 0,
      totalSpecialties: 0,
      stateUniversities: 0,
      privateUniversities: 0,
      averagePassingScore: 0,
    },
    catalogStatus: 'empty',
  }), {
    items: [],
    stats: {
      totalUniversities: 0,
      totalSpecialties: 0,
      stateUniversities: 0,
      privateUniversities: 0,
      averagePassingScore: 0,
    },
    catalogStatus: 'empty',
  })

  assert.throws(() => parseUniversityCatalog({
    items: [],
    stats: {
      totalUniversities: 1,
      totalSpecialties: 0,
      stateUniversities: 1,
      privateUniversities: 0,
      averagePassingScore: 0,
    },
    catalogStatus: 'empty',
  }), /empty catalog/)
})
