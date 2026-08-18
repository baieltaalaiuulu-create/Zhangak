'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { LoaderCircle, Play, RotateCcw, Video } from 'lucide-react'

import { loadYoutubeApi } from '@/lib/youtube-iframe-api'
import {
  YOUTUBE_EMBED_HOST,
  requestLessonVideo,
  reportLessonVideoEvent,
  youtubePlayerVars,
  type LessonVideoConfig,
  type LessonVideoHandle,
} from '@/lib/lesson-video'

interface Props {
  handle: LessonVideoHandle
  lessonId: number
  materialId: number | null
  /** Lesson or material title. Used as the accessible name of the player. */
  title: string
}

// Loaded lazily from YouTube, and only after the student presses play.
declare global {
  interface Window {
    YT?: {
      Player: new (el: HTMLElement, opts: Record<string, unknown>) => { destroy?: () => void, getCurrentTime?: () => number }
      PlayerState: { ENDED: number, PLAYING: number }
    }
    onYouTubeIframeAPIReady?: () => void
  }
}

/**
 * The one lesson video player, shared by the mobile and desktop branches of
 * the lesson page so their behaviour cannot drift apart.
 *
 * Two deliberate properties:
 *
 * 1. Nothing is requested from YouTube until the student presses play. The
 *    placeholder is drawn locally — no `img.youtube.com` thumbnail — so
 *    opening a lesson does not announce it to a third party.
 * 2. The video id is fetched from the first-party session route at that same
 *    moment, so a student without an active enrollment or with a locked
 *    lesson never receives it.
 *
 * What this does not do: hide the id from someone who is allowed to watch.
 * The embed cannot play without it. Do not describe this player to students
 * as making a video undownloadable.
 */
export default function LessonVideo({ handle, lessonId, materialId, title }: Props) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [config, setConfig] = useState<LessonVideoConfig | null>(null)
  const mountRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<{ destroy?: () => void, getCurrentTime?: () => number } | null>(null)
  // The session request and the API load both outlive a fast unmount, so
  // their completion must not write state into a gone component.
  const aliveRef = useRef(true)
  useEffect(() => () => { aliveRef.current = false }, [])

  const report = useCallback((event: 'started' | 'ended', positionSeconds: number) => {
    // Analytics only, and never allowed to surface as a student-facing error:
    // a failed beacon must not look like a broken lesson.
    void reportLessonVideoEvent({ lessonId, materialId, event, positionSeconds }).catch(() => {})
  }, [lessonId, materialId])

  const start = useCallback(async () => {
    setStatus('loading')
    try {
      const [loaded] = await Promise.all([requestLessonVideo(handle), loadYoutubeApi()])
      if (!aliveRef.current) return
      setConfig(loaded)
      setStatus('ready')
    } catch {
      // Covers a rejected session (401/403/404), a failed script load and the
      // loader's own timeout. The student gets one honest retry affordance
      // rather than an indefinite spinner.
      if (aliveRef.current) setStatus('error')
    }
  }, [handle])

  useEffect(() => {
    if (status !== 'ready' || !config || !mountRef.current || !window.YT) return
    // The API replaces its target node, so it gets a throwaway child rather
    // than the React-owned container.
    const target = document.createElement('div')
    target.className = 'h-full w-full'
    mountRef.current.replaceChildren(target)

    const player = new window.YT.Player(target, {
      videoId: config.videoId,
      host: YOUTUBE_EMBED_HOST,
      playerVars: { ...youtubePlayerVars(window.location.origin), autoplay: 1 },
      events: {
        onReady: (event: { target: { getIframe?: () => HTMLIFrameElement } }) => {
          const frame = event.target.getIframe?.()
          // Accessible name and fullscreen are set on the real iframe once it
          // exists; the API creates it, so it cannot be declared in JSX.
          if (frame) {
            frame.setAttribute('title', title)
            frame.setAttribute('allowfullscreen', '')
            frame.setAttribute('allow', 'accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen')
          }
          report('started', 0)
        },
        onStateChange: (event: { data: number }) => {
          if (window.YT && event.data === window.YT.PlayerState.ENDED) {
            report('ended', Math.round(playerRef.current?.getCurrentTime?.() ?? 0))
          }
        },
        onError: () => setStatus('error'),
      },
    })
    playerRef.current = player

    return () => {
      playerRef.current?.destroy?.()
      playerRef.current = null
    }
  }, [status, config, title, report])

  const frame = 'relative w-full overflow-hidden rounded-2xl bg-gray-900 aspect-video min-h-[200px]'

  if (status === 'error') {
    return (
      <div className={`${frame} flex flex-col items-center justify-center gap-3 px-5 text-center`}>
        <Video size={30} className="text-gray-500" aria-hidden="true" />
        <p role="alert" className="text-sm font-semibold text-gray-200">Видео сейчас не открывается</p>
        <button
          type="button"
          onClick={() => void start()}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 text-sm font-bold text-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <RotateCcw size={16} aria-hidden="true" /> Попробовать снова
        </button>
      </div>
    )
  }

  if (status === 'ready') {
    return <div ref={mountRef} className={frame} />
  }

  return (
    <div className={frame}>
      <button
        type="button"
        onClick={() => void start()}
        disabled={status === 'loading'}
        aria-label={`Смотреть видео: ${title}`}
        className="group flex h-full w-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-[#16224a] to-[#0b1020] px-5 text-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-white"
      >
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/90 text-[#1B3F92] shadow-lg transition-transform group-active:scale-95">
          {status === 'loading'
            ? <LoaderCircle size={24} className="animate-spin" aria-hidden="true" />
            : <Play size={26} fill="currentColor" aria-hidden="true" />}
        </span>
        <span className="max-w-full break-words text-sm font-semibold text-white/90">
          {status === 'loading' ? 'Открываем видео…' : 'Смотреть видео'}
        </span>
        <span className="text-xs leading-4 text-white/55">
          Видео загрузится с YouTube после нажатия
        </span>
      </button>
    </div>
  )
}
