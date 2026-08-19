import assert from 'node:assert/strict'
import test from 'node:test'

import {
  COOKIE_INFORMATION_DISMISSED_KEY,
  FIRST_VISIT_DISMISSED_EVENT,
  MARKETING_TOUR_DISMISSED_KEY,
  markDismissed,
  PLATFORM_ONBOARDING_DISMISSED_KEY,
  shouldShowCookieInformation,
  wasDismissed,
} from '../../lib/first-visit.ts'

function memoryStorage(initial: Record<string, string> = {}): Storage {
  const values = new Map(Object.entries(initial))
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value) },
  } as Storage
}

test('first-visit flags only remember an explicit dismissal', () => {
  const storage = memoryStorage()
  assert.equal(wasDismissed(storage, MARKETING_TOUR_DISMISSED_KEY), false)
  markDismissed(storage, MARKETING_TOUR_DISMISSED_KEY)
  assert.equal(wasDismissed(storage, MARKETING_TOUR_DISMISSED_KEY), true)
  assert.equal(wasDismissed(storage, PLATFORM_ONBOARDING_DISMISSED_KEY), false)
  assert.equal(wasDismissed(memoryStorage({ [MARKETING_TOUR_DISMISSED_KEY]: 'true' }), MARKETING_TOUR_DISMISSED_KEY), false)
})

test('optional first-visit flags fail open when browser storage is blocked', () => {
  const unavailable = {
    getItem: () => { throw new Error('storage blocked') },
    setItem: () => { throw new Error('storage blocked') },
  } as unknown as Storage
  assert.equal(wasDismissed(unavailable, MARKETING_TOUR_DISMISSED_KEY), false)
  assert.doesNotThrow(() => markDismissed(unavailable, MARKETING_TOUR_DISMISSED_KEY))
})

test('cookie information waits for the marketing tour and remains dismissible', () => {
  const storage = memoryStorage()
  assert.equal(shouldShowCookieInformation(storage), false)

  markDismissed(storage, MARKETING_TOUR_DISMISSED_KEY)
  assert.equal(shouldShowCookieInformation(storage), true)

  markDismissed(storage, COOKIE_INFORMATION_DISMISSED_KEY)
  assert.equal(shouldShowCookieInformation(storage), false)
  assert.equal(FIRST_VISIT_DISMISSED_EVENT, 'zhangak:first-visit-dismissed')
})
