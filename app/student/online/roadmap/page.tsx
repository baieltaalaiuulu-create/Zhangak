'use client'

export const dynamic = 'force-dynamic'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, BookOpen, Map, RefreshCw, Sparkles } from 'lucide-react'
import RoadmapTrail from '@/components/student/RoadmapTrail'
import { fetchPlatformRoadmap, type PlatformRoadmap } from '@/lib/platform-roadmap'

export default function RoadmapPage() {
  const [roadmap, setRoadmap] = useState<PlatformRoadmap | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      setRoadmap(await fetchPlatformRoadmap())
    } catch {
      setLoadError('Не удалось загрузить дорожную карту курса.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    void fetchPlatformRoadmap()
      .then(value => { if (active) setRoadmap(value) })
      .catch(() => { if (active) setLoadError('Не удалось загрузить дорожную карту курса.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  if (loading) {
    return (
      <main className="min-h-screen bg-[#F7F8FC] px-4 py-6 pb-28">
        <div className="mx-auto max-w-3xl space-y-5">
          <div className="h-24 animate-pulse rounded-3xl bg-white" />
          <div className="mx-auto h-[440px] max-w-xl animate-pulse rounded-3xl bg-white" />
        </div>
      </main>
    )
  }

  if (loadError) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#F7F8FC] px-6 pb-28 text-center">
        <Map size={34} className="text-gray-400" aria-hidden="true" />
        <h1 className="text-lg font-black text-[#191B23]">Карта пока недоступна</h1>
        <p className="max-w-sm text-sm leading-6 text-gray-500">{loadError} Прогресс не заменён демонстрационными данными.</p>
        <button type="button" onClick={() => void load()} className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#1B3F92] px-5 text-sm font-bold text-white">
          <RefreshCw size={16} aria-hidden="true" /> Повторить
        </button>
      </main>
    )
  }

  const summary = roadmap?.summary ?? { completedLessons: 0, lessonCount: 0, completionPercent: 0 }
  const hasMap = Boolean(roadmap?.course && roadmap.units.length > 0)
  return (
    <main className="min-h-screen bg-[#F7F8FC] pb-28">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        <Link href="/student/online" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-bold text-gray-500 hover:text-[#1B3F92]">
          <ArrowLeft size={17} aria-hidden="true" /> Главная
        </Link>

        <header className="mt-2 rounded-[28px] bg-[#1B3F92] px-5 py-5 text-white shadow-[0_8px_0_#102C69] sm:px-7 sm:py-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-blue-100"><Map size={19} aria-hidden="true" /><span className="text-xs font-extrabold uppercase tracking-[0.15em]">Твоя дорожная карта</span></div>
              <h1 className="mt-2 text-2xl font-black sm:text-3xl">{roadmap?.course?.name ?? 'Мой курс'}</h1>
              <p className="mt-1 max-w-xl text-sm leading-6 text-blue-100">Начни внизу и поднимайся выше. Заверши урок — откроется следующий шаг.</p>
            </div>
            <div className="rounded-2xl bg-white/12 px-4 py-3 text-right backdrop-blur-sm">
              <p className="text-2xl font-black">{summary.completionPercent}%</p>
              <p className="text-xs font-bold text-blue-100">{summary.completedLessons} из {summary.lessonCount} уроков</p>
            </div>
          </div>
          <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/20">
            <div className="h-full rounded-full bg-[#8FD14F] transition-all duration-700" style={{ width: `${summary.completionPercent}%` }} />
          </div>
        </header>

        {hasMap ? (
          <section className="mt-7" aria-label="Путь обучения снизу вверх">
            <p className="mb-4 text-center text-xs font-bold uppercase tracking-[0.13em] text-gray-400">Старт снизу · новые разделы выше</p>
            <RoadmapTrail units={roadmap!.units} />
          </section>
        ) : (
          <section className="mt-7 rounded-[28px] border border-dashed border-[#C9D3E4] bg-white px-6 py-12 text-center shadow-sm">
            <BookOpen size={36} className="mx-auto text-[#1B3F92]" aria-hidden="true" />
            <h2 className="mt-4 text-lg font-black text-[#191B23]">Карта курса готовится</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-500">Как только администратор опубликует разделы и уроки для твоего курса, они появятся здесь в правильном порядке.</p>
            <Link href="/student/online/trainer" className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#1B3F92] px-5 py-2.5 text-sm font-bold text-white">
              <Sparkles size={16} aria-hidden="true" /> Открыть тренажёр
            </Link>
          </section>
        )}
      </div>
    </main>
  )
}
