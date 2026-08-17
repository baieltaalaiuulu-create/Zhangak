'use client'

import Link from 'next/link'
import { BookOpen, Check, LockKeyhole, Play, Star } from 'lucide-react'
import type { PlatformRoadmapLesson, PlatformRoadmapUnit, RoadmapAccentColor } from '@/lib/platform-roadmap'

const ACCENTS: Record<RoadmapAccentColor, { surface: string; border: string; text: string; node: string; nodeShadow: string }> = {
  green: { surface: 'bg-[#F0FBEA]', border: 'border-[#B8E89E]', text: 'text-[#397A25]', node: 'bg-[#58B536]', nodeShadow: 'shadow-[0_5px_0_#398B22]' },
  blue: { surface: 'bg-[#ECF4FF]', border: 'border-[#B7D7FF]', text: 'text-[#1B5FA7]', node: 'bg-[#3E8DE3]', nodeShadow: 'shadow-[0_5px_0_#2468AE]' },
  violet: { surface: 'bg-[#F5F0FF]', border: 'border-[#D8C1FF]', text: 'text-[#6B3CAA]', node: 'bg-[#8C5DE8]', nodeShadow: 'shadow-[0_5px_0_#6238B4]' },
  red: { surface: 'bg-[#FFF0F1]', border: 'border-[#FFC2C7]', text: 'text-[#AD3340]', node: 'bg-[#E65A68]', nodeShadow: 'shadow-[0_5px_0_#B93645]' },
}

const POSITIONS = ['self-center', 'self-end sm:mr-[18%]', 'self-start sm:ml-[18%]', 'self-end sm:mr-[10%]', 'self-center', 'self-start sm:ml-[10%]']

function Stars({ count }: { count: 0 | 1 | 2 | 3 }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${count} из 3 звёзд`}>
      {[1, 2, 3].map(index => (
        <Star
          key={index}
          size={17}
          fill={index <= count ? 'currentColor' : 'none'}
          className={index <= count ? 'text-amber-400' : 'text-gray-300'}
          aria-hidden="true"
        />
      ))}
    </span>
  )
}

function LessonNode({ lesson, index, accent }: { lesson: PlatformRoadmapLesson; index: number; accent: RoadmapAccentColor }) {
  const style = ACCENTS[accent]
  const locked = lesson.state === 'locked'
  const done = lesson.state === 'done'
  const current = lesson.state === 'current'
  const label = lesson.isTest ? 'Тест урока' : lesson.completionMode === 'practice' ? 'Пройти тест' : 'Открыть урок'
  const contents = (
    <>
      <span className={`relative flex h-[72px] w-[72px] items-center justify-center rounded-[28px] border-4 border-white text-white transition-transform ${
        done ? `${style.node} ${style.nodeShadow}` : current ? `${style.node} ${style.nodeShadow} ring-4 ring-[#F6D365]/55` : 'bg-[#C9CED7] shadow-[0_5px_0_#A6ADB9]'
      } ${locked ? '' : 'group-hover:-translate-y-0.5 group-active:translate-y-1 group-active:shadow-none'}`}>
        {done ? <Check size={33} strokeWidth={3.3} aria-hidden="true" /> : locked ? <LockKeyhole size={26} aria-hidden="true" /> : current ? <Play size={27} fill="currentColor" aria-hidden="true" /> : <BookOpen size={27} aria-hidden="true" />}
        {current && <span className="absolute -right-2 -top-2 h-4 w-4 rounded-full border-2 border-white bg-[#F7B731]" aria-label="Текущий урок" />}
      </span>
      <span className="mt-3 block max-w-[220px] text-center">
        <span className={`block text-sm font-extrabold leading-5 ${locked ? 'text-gray-400' : 'text-[#191B23]'}`}>{lesson.title}</span>
        <span className="mt-0.5 block text-xs font-medium text-gray-500">
          {lesson.durationMinutes ? `${lesson.durationMinutes} мин` : label}{lesson.isTest ? ' · тест' : ''}
        </span>
      </span>
    </>
  )

  const className = `group flex w-[min(100%,260px)] flex-col items-center rounded-2xl px-3 py-2 text-center outline-offset-4 ${POSITIONS[index % POSITIONS.length]}`
  if (locked) return <div className={className} aria-label={`${lesson.title}: откроется после предыдущего урока`}>{contents}</div>
  return <Link href={`/student/online/lessons/${lesson.id}`} className={className}>{contents}</Link>
}

function UnitCard({ unit }: { unit: PlatformRoadmapUnit }) {
  const style = ACCENTS[unit.accentColor]
  const unitLabel = `Раздел ${unit.unitNumber}`
  return (
    <section aria-labelledby={`roadmap-unit-${unit.id}`} className="relative rounded-[28px] border bg-white px-3 pb-5 pt-3 shadow-sm sm:px-6 sm:pb-7">
      <div className={`mx-auto flex max-w-xl flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 shadow-sm ${style.surface} ${style.border}`}>
        <div className="min-w-0">
          <p className={`text-[11px] font-extrabold uppercase tracking-[0.14em] ${style.text}`}>{unitLabel}</p>
          <h2 id={`roadmap-unit-${unit.id}`} className="truncate text-base font-black text-[#191B23] sm:text-lg">{unit.title}</h2>
          {unit.description && <p className="mt-0.5 max-w-md text-xs text-gray-600">{unit.description}</p>}
        </div>
        <div className="shrink-0 text-right">
          <Stars count={unit.starCount} />
          <p className="mt-1 text-xs font-bold text-gray-600">{unit.completionPercent}% · {unit.completedLessons}/{unit.lessonCount}</p>
        </div>
      </div>

      <ol className="mx-auto mt-6 flex max-w-xl flex-col-reverse gap-5 pb-2 pt-2 sm:gap-7">
        {unit.lessons.map((lesson, index) => (
          <li key={lesson.id} className="flex flex-col items-center">
            <LessonNode lesson={lesson} index={index} accent={unit.accentColor} />
          </li>
        ))}
      </ol>
    </section>
  )
}

export default function RoadmapTrail({ units }: { units: PlatformRoadmapUnit[] }) {
  return (
    <div className="relative mx-auto max-w-3xl">
      <div className="pointer-events-none absolute bottom-10 left-1/2 top-10 w-1 -translate-x-1/2 rounded-full bg-[#E7EBF2]" aria-hidden="true" />
      {/* Flex-reverse is intentional: the first unit/lesson lives at the
          bottom, so progress visibly climbs upward just like a game map. */}
      <div className="relative flex flex-col-reverse gap-8">
        {units.map(unit => <UnitCard key={unit.id} unit={unit} />)}
      </div>
    </div>
  )
}
