'use client'

import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, Play } from 'lucide-react'

interface Props {
  videoUrl: string
  title: string
  watched: boolean
  onWatched: () => void
}

function extractYoutubeId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/)
  return match ? match[1] : null
}

// Not in lib.dom — loaded lazily from https://www.youtube.com/iframe_api
// only once the user actually taps play (see loadYoutubeApi below).
declare global {
  interface Window {
    YT?: {
      Player: new (el: HTMLElement, opts: Record<string, unknown>) => unknown
      PlayerState: { ENDED: number }
    }
    onYouTubeIframeAPIReady?: () => void
  }
}

let apiLoadPromise: Promise<void> | null = null
function loadYoutubeApi(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve()
  if (apiLoadPromise) return apiLoadPromise
  apiLoadPromise = new Promise((resolve) => {
    const prevReady = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => { prevReady?.(); resolve() }
    const script = document.createElement('script')
    script.src = 'https://www.youtube.com/iframe_api'
    document.head.appendChild(script)
  })
  return apiLoadPromise
}

// Mobile-only lesson video: lazy-loaded (a thumbnail + play button stand in
// for the iframe until tapped, per the "don't load until clicked" spec),
// and wired to the real YouTube IFrame API so "✓ Видео просмотрено" reflects
// an actual ENDED playback event rather than a guess.
export default function MobileLessonVideo({ videoUrl, title, watched, onWatched }: Props) {
  const [playing, setPlaying] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const videoId = extractYoutubeId(videoUrl)

  useEffect(() => {
    if (!playing || !videoId || !containerRef.current) return
    let cancelled = false
    loadYoutubeApi().then(() => {
      if (cancelled || !containerRef.current || !window.YT) return
      new window.YT.Player(containerRef.current, {
        videoId,
        playerVars: { autoplay: 1, playsinline: 1 },
        events: {
          onStateChange: (e: { data: number }) => {
            if (window.YT && e.data === window.YT.PlayerState.ENDED) onWatched()
          },
        },
      })
    })
    return () => { cancelled = true }
  }, [playing, videoId, onWatched])

  if (!videoId) {
    return (
      <div className="flex aspect-video items-center justify-center rounded-2xl bg-gray-900 text-center text-gray-400">
        <div>
          <div className="mb-2 text-4xl">🎬</div>
          <p className="text-sm">Видео скоро появится</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="relative aspect-video overflow-hidden rounded-2xl bg-gray-900">
        {playing ? (
          <div ref={containerRef} className="h-full w-full" />
        ) : (
          <button type="button" onClick={() => setPlaying(true)} className="group relative block h-full w-full" aria-label="Смотреть видео">
            {/* eslint-disable-next-line @next/next/no-img-element -- external YouTube thumbnail, only fetched once rendered (lazy) */}
            <img
              src={`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`}
              alt={title}
              loading="lazy"
              className="h-full w-full object-cover opacity-80"
            />
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/90 text-[#1B4FD8] shadow-lg transition-transform group-active:scale-95">
                <Play size={26} fill="currentColor" />
              </span>
            </span>
          </button>
        )}
      </div>
      {watched ? (
        <p className="mt-3 flex items-center justify-center gap-1.5 rounded-xl bg-green-50 py-2.5 text-sm font-semibold text-green-600">
          <CheckCircle2 size={16} /> Видео просмотрено
        </p>
      ) : (
        // Manual fallback alongside the real YouTube ENDED-event auto-detect
        // above — some mobile browsers don't reliably fire it (autoplay
        // restrictions, backgrounding, etc.), so the student always has a
        // way to unlock the next step themselves.
        <button
          type="button"
          onClick={onWatched}
          className="mt-3 flex h-12 w-full items-center justify-center gap-1.5 rounded-xl bg-green-500 text-sm font-bold text-white transition-colors active:bg-green-600"
        >
          <CheckCircle2 size={16} /> Я посмотрел видео
        </button>
      )}
    </div>
  )
}
