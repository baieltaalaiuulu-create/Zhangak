import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

/**
 * Guard for the companion lesson video embed.
 *
 * Scope, stated honestly: this asserts on the source that builds the embed
 * document, not on a running Android or iOS WebView. Whether YouTube accepts
 * the presented identity on device (error 153) can only be confirmed by a real
 * device test, which is tracked as a release blocker in
 * docs/development/CLAUDE_VIDEO_IMPLEMENTATION_REPORT.md.
 */

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const mobileRoot = path.resolve(scriptDirectory, '..')
const failures = []

function expect(condition, message) {
  if (!condition) failures.push(message)
}

async function source(relativePath) {
  return readFile(path.join(mobileRoot, relativePath), 'utf8')
}

/** Strips comments so a check reads code, not prose that names the forbidden thing. */
function code(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1')
}

async function main() {
  const lessons = code(await source('lib/lessons.ts'))
  const player = code(await source('components/LessonVideoPlayer.tsx'))

  // --- Client identity (the error 153 cause) -----------------------------
  expect(
    player.includes('source={{ html: youtubeEmbedDocument(config.videoId), baseUrl: MOBILE_EMBED_BASE_URL }}'),
    'the WebView must render a local document under an explicit baseUrl, not a remote embed uri',
  )
  expect(
    !/source=\{\{\s*uri:\s*`?\$?\{?config\.embedHost/.test(player),
    'loading the embed URL directly leaves the player without a usable Referer',
  )
  expect(
    lessons.includes("MOBILE_EMBED_BASE_URL = 'https://platform.zhangak.com'"),
    'the presented origin must be the real platform origin',
  )
  expect(
    lessons.includes('origin=${encodeURIComponent(MOBILE_EMBED_BASE_URL)}'),
    'the embed must pass an origin parameter matching its document origin',
  )

  // --- The id must already be verified before it reaches markup ----------
  expect(
    /export function youtubeEmbedDocument\(videoId: string\): string \{\s*if \(!VIDEO_ID_PATTERN\.test\(videoId\)\)/.test(lessons),
    'the embed document must re-check the 11-character id before interpolating it',
  )
  expect(
    !/\$\{(?:config\.)?title\}/.test(lessons) && !/\$\{video\.title\}/.test(lessons),
    'no server-supplied title may be interpolated into the embed markup',
  )
  expect(
    !/source=\{\{\s*html:\s*[a-zA-Z]*[Rr]esponse/.test(player) && !player.includes('dangerouslySetInnerHTML'),
    'the document must be built locally, never taken from the server',
  )

  // --- Supported parameters only -----------------------------------------
  expect(lessons.includes('enablejsapi=1'), 'the embed must enable the JS API')
  expect(lessons.includes('playsinline=1'), 'inline playback is required on phones')
  expect(lessons.includes('rel=0'), 'related videos must be limited')
  for (const deprecated of ['modestbranding', 'showinfo', 'autohide']) {
    expect(!lessons.includes(deprecated), `${deprecated} is deprecated and must not be sent`)
  }
  expect(
    !/referrerPolicy|referrerpolicy|no-referrer/.test(lessons + player),
    'the Referer must not be suppressed: the embedded player requires it',
  )

  // --- Privacy-enhanced host and no raw watch URL ------------------------
  expect(
    lessons.includes("YOUTUBE_EMBED_HOST = 'https://www.youtube-nocookie.com'"),
    'the companion must use the privacy-enhanced host',
  )
  expect(
    !/https:\/\/(?:www\.)?youtube\.com\/watch/.test(lessons + player),
    'the companion must never construct a watch URL',
  )

  // --- Nothing before the tap, and no cached video reference -------------
  expect(
    player.includes("status === 'ready' && config"),
    'the WebView must mount only after the student taps play',
  )
  expect(
    /cacheSafeLesson[\s\S]{0,240}video: null/.test(lessons),
    'a cached lesson must not retain a video handle',
  )
  expect(
    /cacheSafeMaterials[\s\S]{0,240}video: null/.test(lessons),
    'cached materials must not retain a video handle',
  )

  // --- The DTO contract must reject a raw URL ----------------------------
  expect(
    lessons.includes('function nullableVideoHandle'),
    'the companion must parse a session handle, not a URL',
  )
  expect(
    /LESSON_VIDEO_SESSION = \/\^/.test(lessons) && /MATERIAL_VIDEO_SESSION = \/\^/.test(lessons),
    'session paths must be pattern-checked per kind',
  )

  if (failures.length > 0) {
    console.error('Mobile video embed checks failed:')
    for (const failure of failures) console.error(`  - ${failure}`)
    process.exit(1)
  }
  console.log('Mobile video embed checks passed.')
}

await main()
