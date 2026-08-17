'use client'

import Link from 'next/link'
import { BookOpen, Check, Gift, LockKeyhole, Play, Star, Trophy } from 'lucide-react'
import type { PlatformRoadmapLesson, PlatformRoadmapUnit, RoadmapAccentColor } from '@/lib/platform-roadmap'

const ACCENTS: Record<RoadmapAccentColor, { card: string; dark: string }> = {
  green: { card: '#70C942', dark: '#4AA71E' },
  blue: { card: '#1B3F92', dark: '#102C69' },
  violet: { card: '#6C3DE0', dark: '#5125B7' },
  red: { card: '#E65A68', dark: '#B93645' },
}

const LANES = ['38%', '62%', '45%', '69%', '31%', '56%']

function Stars({ count }: { count: 0 | 1 | 2 | 3 }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${count} из 3 звёзд за раздел`}>
      {[1, 2, 3].map(index => (
        <Star
          key={index}
          size={18}
          fill={index <= count ? '#FFD84D' : 'rgba(255,255,255,.3)'}
          color={index <= count ? '#FFD84D' : 'rgba(255,255,255,.45)'}
          aria-hidden="true"
        />
      ))}
    </span>
  )
}

function LessonNode({ lesson, index, accent }: { lesson: PlatformRoadmapLesson; index: number; accent: RoadmapAccentColor }) {
  const colors = ACCENTS[accent]
  const locked = lesson.state === 'locked'
  const done = lesson.state === 'done'
  const current = lesson.state === 'current'
  const nodeBackground = done ? '#58CC6C' : current ? colors.card : '#D7DEE8'
  const nodeShadow = done ? '#43A859' : current ? colors.dark : '#B5BFCD'
  const ariaLabel = locked
    ? `${lesson.title}: откроется после предыдущего урока`
    : `${current ? 'Продолжить' : 'Открыть'} урок ${lesson.lessonNumber}: ${lesson.title}`

  const node = (
    <>
      <span
        className="relative flex h-[64px] w-[64px] items-center justify-center rounded-full border-4 border-white text-white transition-transform group-hover:-translate-y-0.5 group-active:translate-y-1 group-active:shadow-none"
        style={{ background: nodeBackground, boxShadow: `0 5px 0 ${nodeShadow}` }}
      >
        {current && <span className="absolute -inset-2 animate-ping rounded-full border-[3px] border-[#F6D365]/80" aria-hidden="true" />}
        {done ? <Check size={30} strokeWidth={3.4} aria-hidden="true" /> : locked ? <LockKeyhole size={25} className="text-[#8994A6]" aria-hidden="true" /> : current ? <Play size={27} fill="currentColor" aria-hidden="true" /> : <BookOpen size={26} aria-hidden="true" />}
      </span>
      {current && <span className="absolute -top-5 whitespace-nowrap rounded-full bg-[#F6D365] px-2 py-1 text-[9px] font-extrabold uppercase tracking-[0.08em] text-[#4A3711]">Ты здесь</span>}
      <span className={`mt-3 block max-w-[148px] text-center text-[11px] font-extrabold leading-4 ${locked ? 'text-[#8994A6]' : 'text-[#0F172A]'}`}>
        {lesson.title}
      </span>
      <span className="mt-0.5 block text-center text-[10px] font-semibold text-[#8A96AC]">
        {lesson.durationMinutes ? `${lesson.durationMinutes} мин` : lesson.isTest ? 'Тест урока' : 'Урок'}
      </span>
    </>
  )

  const style = { paddingLeft: LANES[index % LANES.length] }
  const className = 'group relative flex h-[116px] w-full flex-col items-center justify-center outline-offset-4'
  if (locked) return <div className={className} style={style} aria-label={ariaLabel}>{node}</div>
  return <Link href={`/student/online/lessons/${lesson.id}`} className={className} style={style} aria-label={ariaLabel}>{node}</Link>
}

function UnitCard({ unit }: { unit: PlatformRoadmapUnit }) {
  const colors = ACCENTS[unit.accentColor]
  return (
    <section className="relative">
      <div className="mx-1 rounded-2xl px-4 py-3 text-white" style={{ background: colors.card, boxShadow: `0 4px 0 ${colors.dark}` }}>
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20">
            {unit.unitNumber % 3 === 0 ? <Trophy size={23} aria-hidden="true" /> : <BookOpen size={23} aria-hidden="true" />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-white/75">Раздел {unit.unitNumber}</p>
            <h2 className="truncate text-[16px] font-black leading-tight">{unit.title}</h2>
            {unit.description && <p className="mt-0.5 truncate text-[11px] font-semibold text-white/80">{unit.description}</p>}
          </div>
          <span className="hidden shrink-0 sm:block"><Stars count={unit.starCount} /></span>
        </div>
        <div className="mt-2 flex items-center justify-between border-t border-white/20 pt-2">
          <span className="text-[11px] font-extrabold text-white/90">{unit.completionPercent}% завершено</span>
          <span className="sm:hidden"><Stars count={unit.starCount} /></span>
          <span className="text-[11px] font-bold text-white/80">{unit.completedLessons}/{unit.lessonCount} уроков</span>
        </div>
      </div>

      <ol className="relative mx-auto mt-6 w-full max-w-[330px] pb-2">
        {[...unit.lessons].reverse().map((lesson, index) => (
          <li key={lesson.id} className="relative">
            {index < unit.lessons.length - 1 && <span className="pointer-events-none absolute bottom-[-9px] left-1/2 top-[70px] w-1 -translate-x-1/2 rounded-full bg-[#E2E8F0]" aria-hidden="true" />}
            <LessonNode lesson={lesson} index={index} accent={unit.accentColor} />
          </li>
        ))}
      </ol>

      <div className="mx-auto my-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FFF4D7] text-[#D89000] shadow-[0_4px_0_#E7C772]" aria-label="Награда за прохождение раздела">
        <Gift size={30} aria-hidden="true" />
      </div>
    </section>
  )
}

export default function RoadmapTrail({ units }: { units: PlatformRoadmapUnit[] }) {
  return (
    <div className="mx-auto max-w-[410px] pb-4">
      {/* Reverse ordering keeps the first unit at the bottom: the learner
          literally ascends through the course instead of scrolling down it. */}
      <div className="flex flex-col-reverse gap-7">
        {units.map(unit => <UnitCard key={unit.id} unit={unit} />)}
      </div>
    </div>
  )
}
