'use client'

export const dynamic = 'force-dynamic'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, BookOpen, Calculator, Languages, Map, RefreshCw, Sparkles } from 'lucide-react'
import RoadmapTrail from '@/components/student/RoadmapTrail'
import StudentVisualIcon from '@/components/student/StudentVisualIcon'
import { fetchPlatformRoadmap, roadmapLessonStarCount, type PlatformRoadmap, type PlatformRoadmapUnit } from '@/lib/platform-roadmap'

type RoadmapSubject = 'math' | 'kyr'

const SUBJECTS: Record<RoadmapSubject, { title: string; description: string; accent: string; soft: string; icon: typeof Calculator }> = {
  math: {
    title: 'Математика',
    description: 'Числа, алгебра, геометрия и задачи ОРТ — в понятной последовательности.',
    accent: '#1B3F92',
    soft: '#E8EDFA',
    icon: Calculator,
  },
  kyr: {
    title: 'Кыргызский язык',
    description: 'Грамматика, лексика и работа с текстом — отдельным учебным маршрутом.',
    accent: '#16803F',
    soft: '#E8FAEF',
    icon: Languages,
  },
}

function roadmapForSubject(units: PlatformRoadmapUnit[], subject: RoadmapSubject): PlatformRoadmapUnit[] {
  return units.flatMap(unit => {
    const lessons = unit.lessons.filter(lesson => lesson.subject === subject)
    if (lessons.length === 0) return []
    const completedLessons = lessons.filter(lesson => lesson.state === 'done').length
    const completionPercent = Math.round((completedLessons / lessons.length) * 100)
    return [{
      ...unit,
      lessons,
      completedLessons,
      lessonCount: lessons.length,
      completionPercent,
      starCount: roadmapLessonStarCount(completionPercent),
    }]
  })
}

function subjectStats(units: PlatformRoadmapUnit[]) {
  const lessons = units.flatMap(unit => unit.lessons)
  const completed = lessons.filter(lesson => lesson.state === 'done').length
  return {
    lessonCount: lessons.length,
    completedLessons: completed,
    completionPercent: lessons.length === 0 ? 0 : Math.round((completed / lessons.length) * 100),
  }
}

export default function RoadmapPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
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

  const selectedSubject = searchParams.get('subject')
  const subject: RoadmapSubject | null = selectedSubject === 'math' || selectedSubject === 'kyr' ? selectedSubject : null
  const subjectUnits = useMemo(() => subject && roadmap ? roadmapForSubject(roadmap.units, subject) : [], [roadmap, subject])
  const selectedSummary = useMemo(() => subjectStats(subjectUnits), [subjectUnits])

  useEffect(() => {
    if (!subject || subjectUnits.length === 0) return
    const frame = window.requestAnimationFrame(() => {
      document.querySelector<HTMLElement>("[data-roadmap-current='true']")?.scrollIntoView({ block: 'center' })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [subject, subjectUnits])

  if (loading) {
    return (
      <main className="min-h-screen bg-[#F1F4FB] px-4 py-6 pb-28">
        <div className="mx-auto max-w-3xl space-y-5">
          <div className="h-24 animate-pulse rounded-3xl bg-white" />
          <div className="mx-auto h-[440px] max-w-xl animate-pulse rounded-3xl bg-white" />
        </div>
      </main>
    )
  }

  if (loadError) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#F1F4FB] px-6 pb-28 text-center">
        <Map size={34} className="text-gray-400" aria-hidden="true" />
        <h1 className="text-lg font-black text-[#191B23]">Карта пока недоступна</h1>
        <p className="max-w-sm text-sm leading-6 text-gray-500">{loadError} Прогресс не заменён демонстрационными данными.</p>
        <button type="button" onClick={() => void load()} className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#1B3F92] px-5 text-sm font-bold text-white">
          <RefreshCw size={16} aria-hidden="true" /> Повторить
        </button>
      </main>
    )
  }

  const summary = subject ? selectedSummary : roadmap?.summary ?? { completedLessons: 0, lessonCount: 0, completionPercent: 0 }
  const hasMap = Boolean(roadmap?.course && roadmap.units.length > 0)
  const chooseSubject = (value: RoadmapSubject) => router.push(`/student/online/roadmap?subject=${value}`)
  return (
    <main className="min-h-screen bg-white pb-28">
      <div className="mx-auto max-w-[470px] px-4 py-5">
        <header className="relative overflow-hidden border-b border-[#DCE2EC] pb-4">
          <span aria-hidden="true" className="absolute -right-5 -top-8 h-28 w-28 rounded-full border-[20px] border-[#E7ECF8]" />
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-[#1B3F92]">
                {subject && <button type="button" onClick={() => router.push('/student/online/roadmap')} className="-ml-1 flex h-8 w-8 items-center justify-center rounded-full hover:bg-[#E8EDFA]" aria-label="К выбору предмета"><ArrowLeft size={18} aria-hidden="true" /></button>}
                <StudentVisualIcon name="alt_route" size={18} color="#1B3F92" /><span className="text-[11px] font-extrabold uppercase tracking-[0.1em]">Твой учебный путь</span>
              </div>
              <h1 className="mt-0.5 text-[26px] font-black tracking-[-0.03em] text-[#0F172A]">{subject ? SUBJECTS[subject].title : 'Roadmap'}</h1>
            </div>
            <div className="relative rounded-full bg-[#E8FAEF] px-3 py-1.5 text-[12px] font-extrabold text-[#16803F]">
              {summary.completedLessons}/{summary.lessonCount} пройдено
            </div>
          </div>
          <p className="mt-2 max-w-[350px] text-[13px] leading-5 text-[#475569]">
            {subject ? 'Двигайся по темам снизу вверх: видео, короткий тест и понятный результат после каждого урока.' : 'Выбери предмет — у каждого свой последовательный маршрут подготовки к ОРТ.'}
          </p>
        </header>

        {hasMap && !subject ? (
          <section className="mt-5 space-y-3" aria-label="Выбор предмета">
            {(Object.keys(SUBJECTS) as RoadmapSubject[]).map(key => {
              const meta = SUBJECTS[key]
              const stats = subjectStats(roadmapForSubject(roadmap!.units, key))
              const Icon = meta.icon
              const available = stats.lessonCount > 0
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => available && chooseSubject(key)}
                  disabled={!available}
                  className="group w-full overflow-hidden rounded-[24px] border border-[#DCE2EC] bg-white p-4 text-left shadow-[0_7px_20px_rgba(15,23,42,.07)] transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:hover:translate-y-0"
                >
                  <div className="flex items-start gap-3">
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl" style={{ background: meta.soft, color: meta.accent }}><Icon size={29} aria-hidden="true" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2"><span className="text-[18px] font-black text-[#0F172A]">{meta.title}</span><StudentVisualIcon name="arrow_forward" size={20} color={meta.accent} /></span>
                      <span className="mt-1 block text-[12px] leading-5 text-[#526076]">{available ? meta.description : 'Материалы этого направления готовятся к публикации.'}</span>
                    </span>
                  </div>
                  <span className="mt-4 block h-2 overflow-hidden rounded-full bg-[#E9EDF4]"><span className="block h-full rounded-full" style={{ width: `${stats.completionPercent}%`, background: meta.accent }} /></span>
                  <span className="mt-2 flex items-center justify-between text-[11px] font-bold text-[#5D687A]"><span>{stats.completedLessons}/{stats.lessonCount} уроков пройдено</span><span>{stats.completionPercent}%</span></span>
                </button>
              )
            })}
          </section>
        ) : hasMap && subject && subjectUnits.length > 0 ? (
          <section className="-mx-4 mt-3 bg-white pt-2" aria-label="Единый путь подготовки к ОРТ снизу вверх">
            <RoadmapTrail units={subjectUnits} />
          </section>
        ) : (
          <section className="mx-auto mt-7 max-w-[410px] rounded-[28px] border border-dashed border-[#C9D3E4] bg-white px-6 py-12 text-center shadow-sm">
            <BookOpen size={36} className="mx-auto text-[#1B3F92]" aria-hidden="true" />
            <h2 className="mt-4 text-lg font-black text-[#191B23]">{subject ? `${SUBJECTS[subject].title}: маршрут готовится` : 'Карта курса готовится'}</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-500">Как только администратор опубликует разделы и уроки для этого направления, они появятся здесь в правильном порядке.</p>
            <Link href="/student/online/trainer" className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#1B3F92] px-5 py-2.5 text-sm font-bold text-white">
              <Sparkles size={16} aria-hidden="true" /> Открыть тренажёр
            </Link>
          </section>
        )}
      </div>
    </main>
  )
}
