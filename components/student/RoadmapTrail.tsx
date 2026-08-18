'use client'

import Image from 'next/image'
import Link from 'next/link'
import StudentVisualIcon from './StudentVisualIcon'
import type { PlatformRoadmapLesson, PlatformRoadmapUnit, RoadmapAccentColor } from '@/lib/platform-roadmap'

const ACCENTS: Record<RoadmapAccentColor, { card: string; dark: string }> = {
  green: { card: '#70C942', dark: '#4AA71E' },
  blue: { card: '#1B3F92', dark: '#102C69' },
  violet: { card: '#6C3DE0', dark: '#5125B7' },
  red: { card: '#E65A68', dark: '#B93645' },
}

const LANES = ['38%', '62%', '45%', '69%', '31%']

function Stars({ count }: { count: 0 | 1 | 2 | 3 }) {
  return (
    <span className="flex items-center gap-0.5" aria-label={`${count} из 3 звёзд за раздел`}>
      {[1, 2, 3].map(index => (
        <StudentVisualIcon key={index} name="star" size={18} color={index <= count ? '#FFD84D' : 'rgba(255,255,255,.35)'} filled={index <= count} />
      ))}
    </span>
  )
}

function LessonNode({ lesson, index, accent }: { lesson: PlatformRoadmapLesson; index: number; accent: RoadmapAccentColor }) {
  const colors = ACCENTS[accent]
  const locked = lesson.state === 'locked'
  const done = lesson.state === 'done'
  const current = lesson.state === 'current'
  const available = lesson.state === 'available'
  const subjectIcon = lesson.isTest ? 'quiz' : lesson.subject === 'math' ? 'calculate' : lesson.subject === 'kyr' ? 'translate' : 'menu_book'
  const icon = done ? 'check' : locked ? 'lock' : subjectIcon
  const background = done || available ? '#58CC6C' : current ? colors.card : '#D7DEE8'
  const shadow = done || available ? '#43A859' : current ? colors.dark : '#B5BFCD'

  const content = (
    <span data-roadmap-current={current || undefined} className="relative z-[1] flex h-[62px] w-[62px] shrink-0 items-center justify-center rounded-full transition-transform active:translate-y-[2px]" style={{ background, boxShadow: `0 5px 0 ${shadow}`, opacity: locked ? 0.78 : 1 }}>
      {current && <span className="student-ring absolute -inset-2 rounded-full border-[3px] border-[#1B3F92]" />}
      {current && <span className="absolute -top-[18px] whitespace-nowrap rounded-full bg-[#1B3F92] px-2 py-1 text-[9px] font-extrabold uppercase tracking-[0.07em] text-white">Ты здесь</span>}
      <StudentVisualIcon name={icon} size={current ? 30 : 28} color={locked ? '#8994A6' : '#FFFFFF'} filled={done || !locked} />
      {!current && <span className={`absolute -bottom-[20px] whitespace-nowrap text-[10px] font-bold ${locked ? 'text-[#8A96AC]' : 'rounded-full bg-white px-2 py-0.5 text-[#475569] shadow-sm'}`}>Урок {lesson.lessonNumber}</span>}
    </span>
  )

  const className = 'relative flex h-[104px] items-center'
  const style = { paddingLeft: LANES[index % LANES.length] }
  if (locked) return <div className={className} style={style} aria-label={`Закрытый урок ${lesson.lessonNumber}: ${lesson.title}`}>{content}</div>
  return <Link href={`/student/online/lessons/${lesson.id}`} className={className} style={style} aria-label={`Открыть урок ${lesson.lessonNumber}: ${lesson.title}`}>{content}</Link>
}

function UnitCard({ unit }: { unit: PlatformRoadmapUnit }) {
  const colors = ACCENTS[unit.accentColor]
  const icon = unit.unitNumber === 1 ? 'rocket_launch' : unit.unitNumber === 2 ? 'bolt' : 'workspace_premium'
  return (
    <section className="mx-4 rounded-2xl px-4 py-3 text-white" style={{ background: colors.card, boxShadow: `0 4px 0 ${colors.dark}` }}>
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20">
          <StudentVisualIcon name={icon} size={24} color="#FFFFFF" />
        </span>
        <div className="min-w-0 flex-1">
          <span className="block text-[10px] font-extrabold uppercase tracking-[0.1em] text-white/75">Юнит {unit.unitNumber}</span>
          <h2 className="text-[16px] font-black leading-tight">{unit.title}</h2>
          {unit.description && <p className="mt-0.5 text-[11px] font-semibold leading-4 text-white/80">{unit.description}</p>}
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between border-t border-white/20 pt-2">
        <span className="text-[11px] font-extrabold text-white/90">{unit.completionPercent}% завершено</span>
        <Stars count={unit.starCount} />
      </div>
    </section>
  )
}

export default function RoadmapTrail({ units }: { units: PlatformRoadmapUnit[] }) {
  const ascentUnits = [...units].reverse().map(unit => ({ ...unit, lessons: [...unit.lessons].reverse() }))
  const highestUnit = Math.max(...units.map(item => item.unitNumber))
  return (
    <div className="mx-auto max-w-[390px] pb-5">
      {ascentUnits.map((unit, ascentIndex) => (
        <section key={unit.id} className="pb-2">
          {unit.unitNumber < highestUnit && (
            <div className="flex h-[90px] items-center justify-center">
              <div className="relative h-[78px] w-[78px] overflow-hidden">
                <Image src="/roadmap-assets/reward-chest.png" alt="Награда за прохождение юнита" fill sizes="78px" className="scale-[2.1] object-cover mix-blend-multiply" />
              </div>
            </div>
          )}
          <UnitCard unit={unit} />
          <div className="relative mx-auto mt-2 w-[270px]">
            {unit.lessons.map((lesson, index) => <LessonNode key={lesson.id} lesson={lesson} index={index + ascentIndex * 2} accent={unit.accentColor} />)}
          </div>
        </section>
      ))}

      <section className="mx-auto mt-2 flex w-[282px] items-center gap-1 rounded-3xl border border-[#E8EDFA] bg-[#E8EDFA] px-2 py-2">
        <Image src="/roadmap-assets/student-reading.png" alt="Ученик Zhangak готовится к ОРТ" width={84} height={84} className="h-[74px] w-[74px] object-contain mix-blend-multiply" />
        <div className="min-w-0 pr-2">
          <p className="text-[12px] font-black text-[#0F172A]">Продолжай в своём темпе</p>
          <p className="mt-0.5 text-[11px] leading-4 text-[#475569]">Каждый урок приближает тебя к цели ОРТ.</p>
        </div>
      </section>
    </div>
  )
}
