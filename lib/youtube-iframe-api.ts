import { YOUTUBE_IFRAME_API_URL } from './lesson-video.ts'

/**
 * Loader for the official YouTube IFrame Player API.
 *
 * Extracted from the player component so its failure modes are testable
 * without a DOM renderer. Three properties matter and are all covered by
 * tests/learning/youtube-iframe-api.test.ts:
 *
 * 1. A hung network cannot leave the student on a spinner forever — the load
 *    is bounded by a timeout.
 * 2. A failed load does not poison every later attempt: the cached promise is
 *    cleared on rejection, so retry really retries.
 * 3. Concurrent callers share one script tag rather than appending one each.
 */

export const YOUTUBE_API_TIMEOUT_MS = 10_000

interface LoaderDeps {
  /** Present once the API has finished loading. */
  readonly api: () => unknown
  /** Registers the global the API calls back into, returning the previous value. */
  readonly setReadyCallback: (callback: () => void) => void
  /** Appends the script tag; returns a disposer used on failure. */
  readonly appendScript: (src: string, onError: () => void) => void
  readonly setTimer: (fn: () => void, ms: number) => unknown
  readonly clearTimer: (handle: unknown) => void
}

let pending: Promise<void> | null = null

/** Test seam: forget any cached in-flight load. */
export function resetYoutubeApiLoader(): void {
  pending = null
}

export function loadYoutubeApiWith(deps: LoaderDeps, timeoutMs = YOUTUBE_API_TIMEOUT_MS): Promise<void> {
  // Already loaded: resolve immediately, never touch the DOM again.
  if (deps.api()) return Promise.resolve()
  // A load is already in flight: share it instead of appending a second tag.
  if (pending) return pending

  pending = new Promise<void>((resolve, reject) => {
    let settled = false
    let timer: unknown = null

    const finish = (outcome: 'ok' | Error) => {
      if (settled) return
      settled = true
      deps.clearTimer(timer)
      if (outcome === 'ok') {
        resolve()
      } else {
        // Clearing the cache is the whole point: a retry after a failure must
        // be allowed to append a fresh script tag.
        pending = null
        reject(outcome)
      }
    }

    timer = deps.setTimer(() => finish(new Error('youtube_api_timeout')), timeoutMs)
    // The API calls one global hook. The previous owner is invoked too, so a
    // second player mounted on the same page is not silently disconnected.
    deps.setReadyCallback(() => finish('ok'))
    deps.appendScript(YOUTUBE_IFRAME_API_URL, () => finish(new Error('youtube_api_unavailable')))
  })

  return pending
}

/** Browser wiring for {@link loadYoutubeApiWith}. */
export function loadYoutubeApi(timeoutMs = YOUTUBE_API_TIMEOUT_MS): Promise<void> {
  return loadYoutubeApiWith({
    api: () => (window as { YT?: { Player?: unknown } }).YT?.Player,
    setReadyCallback: callback => {
      const host = window as { onYouTubeIframeAPIReady?: () => void }
      const previous = host.onYouTubeIframeAPIReady
      host.onYouTubeIframeAPIReady = () => { previous?.(); callback() }
    },
    appendScript: (src, onError) => {
      const script = document.createElement('script')
      script.src = src
      script.async = true
      script.onerror = onError
      document.head.appendChild(script)
    },
    setTimer: (fn, ms) => window.setTimeout(fn, ms),
    clearTimer: handle => { if (handle !== null) window.clearTimeout(handle as number) },
  }, timeoutMs)
}
