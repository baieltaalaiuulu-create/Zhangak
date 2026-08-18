import assert from 'node:assert/strict'
import test from 'node:test'

import {
  YOUTUBE_API_TIMEOUT_MS,
  loadYoutubeApiWith,
  resetYoutubeApiLoader,
} from '../../lib/youtube-iframe-api.ts'
import { YOUTUBE_IFRAME_API_URL } from '../../lib/lesson-video.ts'

/**
 * A controllable stand-in for the browser. Time is manual, so a timeout test
 * finishes instantly and cannot become flaky on a slow machine.
 */
function harness(options: { apiPresent?: boolean } = {}) {
  const state = {
    appended: [] as string[],
    timersSet: 0,
    timersCleared: 0,
    readyCallbacks: [] as Array<() => void>,
    errorHandlers: [] as Array<() => void>,
    apiPresent: options.apiPresent ?? false,
  }
  let pendingTimer: (() => void) | null = null

  const deps = {
    api: () => (state.apiPresent ? {} : undefined),
    setReadyCallback: (callback: () => void) => { state.readyCallbacks.push(callback) },
    appendScript: (src: string, onError: () => void) => {
      state.appended.push(src)
      state.errorHandlers.push(onError)
    },
    setTimer: (fn: () => void) => { state.timersSet += 1; pendingTimer = fn; return 1 },
    clearTimer: () => { state.timersCleared += 1; pendingTimer = null },
  }

  return {
    state,
    deps,
    fireReady: () => state.readyCallbacks.at(-1)?.(),
    fireError: () => state.errorHandlers.at(-1)?.(),
    fireTimeout: () => pendingTimer?.(),
    timerIsArmed: () => pendingTimer !== null,
  }
}

test.beforeEach(() => resetYoutubeApiLoader())

test('a successful load resolves and clears its timeout', async () => {
  const h = harness()
  const loading = loadYoutubeApiWith(h.deps)
  assert.deepEqual(h.state.appended, [YOUTUBE_IFRAME_API_URL])
  assert.equal(h.state.timersSet, 1)

  h.fireReady()
  await loading

  assert.equal(h.state.timersCleared, 1, 'the timeout must be cleared on success')
  assert.equal(h.timerIsArmed(), false)
})

test('an already-loaded API resolves immediately without touching the DOM', async () => {
  const h = harness({ apiPresent: true })
  await loadYoutubeApiWith(h.deps)
  assert.deepEqual(h.state.appended, [], 'no second script tag for an API that is already present')
  assert.equal(h.state.timersSet, 0, 'no timer is needed when nothing is awaited')
})

test('a script error rejects, clears the timeout, and allows a real retry', async () => {
  const first = harness()
  const failing = loadYoutubeApiWith(first.deps)
  first.fireError()
  await assert.rejects(failing, /youtube_api_unavailable/)
  assert.equal(first.state.timersCleared, 1, 'a failed load must clear its timeout')

  // The decisive part: the cached promise was dropped, so a retry appends a
  // fresh script rather than re-returning the old rejection forever.
  const second = harness()
  const retry = loadYoutubeApiWith(second.deps)
  assert.deepEqual(second.state.appended, [YOUTUBE_IFRAME_API_URL], 'retry must load again')
  second.fireReady()
  await retry
})

test('a hung network times out instead of spinning forever', async () => {
  const h = harness()
  const hanging = loadYoutubeApiWith(h.deps, YOUTUBE_API_TIMEOUT_MS)
  assert.equal(h.timerIsArmed(), true)

  h.fireTimeout()
  await assert.rejects(hanging, /youtube_api_timeout/)

  // And the timeout path must also be retryable.
  const retryHarness = harness()
  const retry = loadYoutubeApiWith(retryHarness.deps)
  assert.deepEqual(retryHarness.state.appended, [YOUTUBE_IFRAME_API_URL])
  retryHarness.fireReady()
  await retry
})

test('concurrent callers share one script tag and one timer', async () => {
  const h = harness()
  const a = loadYoutubeApiWith(h.deps)
  const b = loadYoutubeApiWith(h.deps)
  assert.equal(h.state.appended.length, 1, 'two players must not append two scripts')
  assert.equal(h.state.timersSet, 1)

  h.fireReady()
  await Promise.all([a, b])
})

test('a late second ready callback cannot re-settle or double-clear', async () => {
  const h = harness()
  const loading = loadYoutubeApiWith(h.deps)
  h.fireReady()
  await loading
  h.fireReady()
  assert.equal(h.state.timersCleared, 1, 'a repeated ready event must be ignored')
})

test('the previous global ready handler is preserved, not overwritten', async () => {
  // Regression guard for a second player on the same page: the loader wraps
  // whatever hook already exists instead of replacing it.
  const calls: string[] = []
  const host: { onYouTubeIframeAPIReady?: () => void } = {
    onYouTubeIframeAPIReady: () => calls.push('previous'),
  }
  const deps = {
    api: () => undefined,
    setReadyCallback: (callback: () => void) => {
      const previous = host.onYouTubeIframeAPIReady
      host.onYouTubeIframeAPIReady = () => { previous?.(); callback() }
    },
    appendScript: () => {},
    setTimer: () => 1,
    clearTimer: () => {},
  }
  const loading = loadYoutubeApiWith(deps)
  host.onYouTubeIframeAPIReady?.()
  await loading
  assert.deepEqual(calls, ['previous'], 'an existing ready handler must still run')
})
