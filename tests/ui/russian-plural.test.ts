import assert from 'node:assert/strict'
import test from 'node:test'

import { dayLabel, russianPlural, scoreLabel } from '../../lib/russian-plural.ts'

test('Russian plural agreement follows the last one or two digits', () => {
  const forms = (n: number) => russianPlural(n, 'балл', 'балла', 'баллов')
  assert.equal(forms(1), 'балл')
  assert.equal(forms(2), 'балла')
  assert.equal(forms(4), 'балла')
  assert.equal(forms(5), 'баллов')
  assert.equal(forms(0), 'баллов')
  // The teens are the case the common n<5 shortcut gets wrong.
  for (const teen of [11, 12, 13, 14]) assert.equal(forms(teen), 'баллов', `${teen} takes the many form`)
  assert.equal(forms(21), 'балл')
  assert.equal(forms(22), 'балла')
  assert.equal(forms(25), 'баллов')
  assert.equal(forms(101), 'балл')
  assert.equal(forms(111), 'баллов')
  assert.equal(forms(180), 'баллов')
})

test('the target score and streak labels read correctly', () => {
  assert.equal(scoreLabel(180), '180 баллов')
  assert.equal(scoreLabel(21), '21 балл')
  assert.equal(scoreLabel(2), '2 балла')
  assert.equal(dayLabel(1), '1 день')
  assert.equal(dayLabel(3), '3 дня')
  assert.equal(dayLabel(11), '11 дней')
  assert.equal(dayLabel(21), '21 день')
})
