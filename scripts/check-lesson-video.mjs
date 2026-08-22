import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

/**
 * Static guard for the lesson video player.
 *
 * Scope, stated honestly: this checks the source that produces the layout and
 * the embed, not a rendered browser. Acceptance items 6 and 7 (no horizontal
 * overflow at 320/360/390/430/768 px, keyboard and focus behaviour) are
 * verified here structurally and must still be confirmed by the manual live
 * QA pass recorded in docs/operations/lesson-video.md. A green run here does
 * not by itself mean the player was looked at on a device.
 */

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(scriptDirectory, '..')
const failures = []

function expect(condition, message) {
  if (!condition) failures.push(message)
}

async function source(relativePath) {
  return readFile(path.join(projectRoot, relativePath), 'utf8')
}

/**
 * Strips comments so a check asserts on what the code does, not on prose that
 * happens to name the thing being forbidden. (This file's own explanations
 * mention `modestbranding` and `img.youtube.com` for exactly that reason.)
 */
function code(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1')
}

async function collectSourceFiles(relativePath) {
  const entries = await readdir(path.join(projectRoot, relativePath), { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const child = path.join(relativePath, entry.name)
    if (entry.isDirectory()) files.push(...await collectSourceFiles(child))
    else if (entry.isFile() && /\.(?:ts|tsx)$/.test(entry.name)) files.push(child)
  }
  return files
}

async function main() {
  const player = code(await source('components/student/LessonVideo.tsx'))
  const contract = code(await source('lib/lesson-video.ts'))

  // --- One shared player -------------------------------------------------
  const lessonPage = code(await source('app/student/online/lessons/[id]/page.tsx'))
  expect(
    lessonPage.includes("import LessonVideo from '@/components/student/LessonVideo'"),
    'the lesson page must render the shared player',
  )
  expect(
    (lessonPage.match(/<LessonVideo\b/g) ?? []).length === 1,
    'desktop and mobile must render one shared player instance, not divergent copies',
  )

  // --- Embed configuration (acceptance test 5) ---------------------------
  expect(contract.includes("'https://www.youtube-nocookie.com'"), 'the embed must use the privacy-enhanced host')
  expect(player.includes('host: YOUTUBE_EMBED_HOST'), 'the IFrame player must be pointed at the nocookie host')
  expect(contract.includes('enablejsapi: 1'), 'the player must enable the JS API it listens to')
  expect(contract.includes('playsinline: 1'), 'inline playback is required on small screens')
  expect(contract.includes('rel: 0'), 'related videos must be limited to the same channel')
  expect(
    contract.includes('origin,') && player.includes('window.location.origin'),
    'the exact document origin must be passed to the player, not a build constant',
  )
  for (const deprecated of ['modestbranding', 'showinfo', 'autohide']) {
    expect(!contract.includes(deprecated) && !player.includes(deprecated), `${deprecated} is deprecated and must not be used`)
  }
  expect(
    !player.includes('referrerpolicy') && !player.includes('referrerPolicy'),
    'the Referer must not be suppressed: the embedded player requires it',
  )

  // --- Nothing reaches YouTube before the student asks -------------------
  expect(
    !player.includes('img.youtube.com') && !player.includes('i.ytimg.com'),
    'the placeholder must be drawn locally, not fetched from YouTube before the click',
  )
  expect(
    player.includes("status === 'ready'") && player.includes('loadYoutubeApi'),
    'the iframe and the IFrame API must load only after the student presses play',
  )
  expect(
    /const start = useCallback\(async \(\) => \{[\s\S]*?requestLessonVideo/.test(player),
    'the video id must be fetched from the scoped session at play time',
  )

  // --- No self-built watch or embed URL anywhere in the clients ----------
  const clientFiles = [
    ...await collectSourceFiles('app'),
    ...await collectSourceFiles('components'),
    ...await collectSourceFiles('lib'),
  ]
  for (const file of clientFiles) {
    const text = code(await source(file))
    expect(
      !/youtube\.com\/embed\/|youtu\.be\/|youtube-nocookie\.com\/embed\//.test(text),
      `${file}: a client must not construct a YouTube embed URL; use the scoped video session`,
    )
    expect(
      !/https:\/\/(?:www\.)?youtube\.com\/watch/.test(text),
      `${file}: a client must not construct a YouTube watch URL`,
    )
  }

  // --- No "open on YouTube" escape hatch in our own UI -------------------
  expect(
    !/Открыть на YouTube|Смотреть на YouTube|Watch on YouTube/i.test(player),
    'the product UI must not offer its own link out to YouTube',
  )

  // --- Responsive frame (acceptance test 6) ------------------------------
  expect(player.includes('w-full'), 'the player frame must be fluid, never a fixed pixel width')
  expect(player.includes('aspect-video'), 'the player must keep a 16:9 frame where there is room')
  expect(
    !/min-h-\[\d+px\]/.test(player),
    'the player must not carry a pixel minimum height: below 356px it overrides 16:9 and stretches the video',
  )
  expect(
    player.includes('[&>iframe]:h-full') && player.includes('[&>iframe]:w-full'),
    'the injected iframe must be pinned to the container; the IFrame API gives it fixed width/height attributes',
  )
  expect(player.includes('overflow-hidden'), 'the player frame must not let the embed push the page sideways')
  expect(
    !/\bw-\[\d+px\]|\bmin-w-\[\d{3,}px\]/.test(player),
    'a fixed pixel width would overflow the 320 px viewport',
  )
  expect(player.includes('break-words'), 'a long lesson title must wrap rather than widen the frame')

  // --- Keyboard, focus and accessible name (acceptance test 7) ----------
  expect(player.includes('type="button"'), 'the play control must be a real button')
  expect(player.includes('aria-label={`Смотреть видео: ${title}`}'), 'the play control needs an accessible name')
  expect(
    (player.match(/focus-visible:outline/g) ?? []).length >= 2,
    'every interactive control in the player needs a visible focus ring',
  )
  expect(player.includes("frame.setAttribute('title', title)"), 'the generated iframe needs an accessible name')
  expect(player.includes("frame.setAttribute('allowfullscreen', '')"), 'fullscreen must stay available')
  expect(
    player.includes('role="alert"'),
    'the failure state must be announced, not only shown',
  )
  expect(
    !/pointer-events-none[\s\S]{0,200}absolute inset-0|absolute inset-0[\s\S]{0,120}z-\d/.test(player),
    'the player must not be covered by an overlay that blocks YouTube controls',
  )

  // --- Playback events stay analytics ------------------------------------
  expect(
    contract.includes('Promise<void>'),
    'a playback report must return nothing a caller could treat as a reward',
  )
  expect(
    !/onWatched|setVideoWatched|markCompleted/.test(player),
    'the player must not drive lesson completion from a client-side playback flag',
  )

  // --- CSP allows exactly the two YouTube frame origins -------------------
  const nginx = await source('deploy/nginx/zhangak.conf')
  const csp = nginx.match(/add_header Content-Security-Policy "([^"]+)"/)?.[1] ?? ''
  expect(csp.includes("frame-ancestors 'self'"), 'the platform must stay unframeable')
  expect(csp.includes("object-src 'none'"), 'object embedding must stay blocked')
  expect(
    csp.includes('frame-src https://www.youtube-nocookie.com https://www.youtube.com'),
    'the CSP must allow exactly the two YouTube frame origins the player needs',
  )
  expect(
    !/frame-src[^;]*\*/.test(csp),
    'the frame allowlist must not contain a wildcard',
  )

  if (failures.length > 0) {
    console.error('Lesson video checks failed:')
    for (const failure of failures) console.error(`  - ${failure}`)
    process.exit(1)
  }
  console.log('Lesson video checks passed.')
}

await main()
