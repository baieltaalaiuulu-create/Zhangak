'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import StudentVisualIcon from './StudentVisualIcon'
import { roadmapLessonStarCount, type PlatformRoadmapLesson, type PlatformRoadmapUnit, type RoadmapAccentColor } from '@/lib/platform-roadmap'

const ACCENTS: Record<RoadmapAccentColor, { main: string; dark: string; soft: string; ink: string }> = {
  green: { main: '#58B938', dark: '#347B20', soft: '#EAF8E4', ink: '#193711' },
  blue: { main: '#24499A', dark: '#122B67', soft: '#E8EEFC', ink: '#102452' },
  violet: { main: '#7452C8', dark: '#4E3297', soft: '#F0EBFF', ink: '#35216D' },
  red: { main: '#D94A57', dark: '#9C2633', soft: '#FCEAEC', ink: '#6F1720' },
}

const LANES = [34, 66, 43, 70, 30]

function subjectLabel(subject: string | null) {
  if (subject === 'math') return 'Математика'
  if (subject === 'kyr') return 'Кыргызский язык'
  return 'Подготовка к ОРТ'
}

function subjectIcon(lesson: PlatformRoadmapLesson) {
  if (lesson.isTest) return 'quiz'
  if (lesson.subject === 'math') return 'calculate'
  if (lesson.subject === 'kyr') return 'translate'
  return 'menu_book'
}

function LessonStars({ lesson, compact = false }: { lesson: PlatformRoadmapLesson; compact?: boolean }) {
  const count = roadmapLessonStarCount(lesson.completionPercent)
  return (
    <span className={`flex items-center ${compact ? 'gap-px' : 'gap-1'}`} aria-label={`${count} из 3 звёзд за урок`}>
      {[1, 2, 3].map(star => (
        <span key={star} className={`${compact ? 'flex h-[17px] w-[17px]' : 'flex h-7 w-7'} items-center justify-center rounded-full border border-white/80 bg-white shadow-[0_2px_5px_rgba(15,23,42,.16)]`}>
          <StudentVisualIcon name="star" size={compact ? 12 : 18} color={star <= count ? '#F5B82E' : '#B8C1D0'} filled={star <= count} />
        </span>
      ))}
    </span>
  )
}

function TrailConnector({ from, to, height }: { from: number; to: number; height: number }) {
  const startX = from * 3.2
  const endX = to * 3.2
  const middleY = Math.round(height * 0.56)
  return (
    <svg aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 h-full w-full overflow-visible" viewBox={`0 0 320 ${height}`} preserveAspectRatio="none">
      <path d={`M ${startX} 74 C ${startX} ${middleY}, ${endX} ${middleY}, ${endX} ${height + 4}`} fill="none" stroke="#D2D9E6" strokeDasharray="3 9" strokeLinecap="round" strokeWidth="5" />
    </svg>
  )
}

function LessonDetail({ lesson, lane, accent, onClose }: { lesson: PlatformRoadmapLesson; lane: number; accent: RoadmapAccentColor; onClose: () => void }) {
  const colors = ACCENTS[accent]
  const locked = lesson.state === 'locked'
  const action = lesson.state === 'done' ? 'Повторить урок' : lesson.completionPercent > 0 ? 'Продолжить' : 'Начать урок'
  const detail = lesson.description ?? (lesson.isTest ? 'Проверь знания и получи звёзды за результат.' : 'Изучи материал и выполни следующий шаг учебного пути.')
  return (
    <article id={`roadmap-lesson-${lesson.id}`} className="roadmap-popover absolute left-1 right-1 top-[108px] z-20 overflow-visible rounded-[22px] border border-[#D9DFEA] bg-white p-4 shadow-[0_18px_45px_rgba(26,43,79,.18)]" style={{ borderTopColor: colors.main, borderTopWidth: 4 }}>
      <span aria-hidden="true" className="absolute -top-[10px] h-[18px] w-[18px] rotate-45 border-l border-t border-[#D9DFEA] bg-white" style={{ left: `calc(${lane}% - 9px)`, borderLeftColor: colors.main, borderTopColor: colors.main }} />
      <button type="button" onClick={onClose} className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-[#667085] transition-colors hover:bg-[#F1F3F7] hover:text-[#172033]" aria-label="Закрыть информацию об уроке">
        <StudentVisualIcon name="close" size={18} color="currentColor" />
      </button>
      <div className="pr-9">
        <div className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-[0.09em]" style={{ color: colors.main }}>
          <span>Урок {lesson.lessonNumber}</span><span aria-hidden="true">•</span><span>{subjectLabel(lesson.subject)}</span>
        </div>
        <h3 className="mt-1 text-[17px] font-black leading-[1.22] tracking-[-0.02em] text-[#111827]">{lesson.title}</h3>
        <p className="mt-1.5 line-clamp-2 text-[12px] leading-[1.55] text-[#566176]">{detail}</p>
      </div>
      <div className="mt-3 grid grid-cols-[1fr_auto] items-end gap-3 border-t border-[#E8ECF2] pt-3">
        <div>
          <div className="mb-1.5 flex items-center justify-between text-[10px] font-bold text-[#697386]"><span>Прогресс урока</span><span>{lesson.completionPercent}%</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-[#E8ECF2]"><span className="block h-full rounded-full transition-[width] duration-500" style={{ width: `${lesson.completionPercent}%`, background: colors.main }} /></div>
          <div className="mt-2 flex items-center gap-2"><LessonStars lesson={lesson} /><span className="text-[9px] font-semibold leading-3 text-[#7B8494]">50 · 75 · 90%</span></div>
        </div>
        {lesson.durationMinutes && <span className="inline-flex items-center gap-1 rounded-full bg-[#F2F4F7] px-2 py-1 text-[10px] font-bold text-[#4D5768]"><StudentVisualIcon name="schedule" size={13} color="#4D5768" />{lesson.durationMinutes} мин</span>}
      </div>
      {locked ? (
        <div className="mt-3 flex min-h-11 items-center gap-2 rounded-xl bg-[#F1F3F6] px-3 text-[11px] font-bold text-[#687386]"><StudentVisualIcon name="lock" size={16} color="#687386" />Сначала заверши предыдущий урок</div>
      ) : (
        <Link href={`/student/online/lessons/${lesson.id}`} className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 text-[13px] font-black text-white transition-transform active:translate-y-0.5" style={{ background: colors.main, boxShadow: `0 3px 0 ${colors.dark}` }}>
          {action}<StudentVisualIcon name="arrow_forward" size={17} color="#FFFFFF" />
        </Link>
      )}
    </article>
  )
}

function LessonNode({ lesson, index, accent, selected, onSelect, nextLane }: { lesson: PlatformRoadmapLesson; index: number; accent: RoadmapAccentColor; selected: boolean; onSelect: () => void; nextLane: number | null }) {
  const colors = ACCENTS[accent]
  const lane = LANES[index % LANES.length]
  const locked = lesson.state === 'locked'
  const done = lesson.state === 'done'
  const current = lesson.state === 'current'
  const stars = roadmapLessonStarCount(lesson.completionPercent)
  const height = selected ? 390 : 126
  const ringColor = locked ? '#C9D1DE' : done ? '#4AB665' : colors.main
  const nodeColor = locked ? '#E7EBF1' : done ? '#E8F8EC' : current ? colors.main : '#FFFFFF'
  const iconColor = locked ? '#7D8797' : current ? '#FFFFFF' : done ? '#278B43' : colors.main
  const progress = locked ? 0 : Math.max(lesson.completionPercent, current ? 3 : 0)

  return (
    <div className="relative w-full transition-[height] duration-200" style={{ height }}>
      {nextLane !== null && <TrailConnector from={lane} to={nextLane} height={height} />}
      <button
        type="button"
        data-roadmap-current={current || undefined}
        aria-expanded={selected}
        aria-controls={`roadmap-lesson-${lesson.id}`}
        onClick={onSelect}
        className="group absolute top-3 z-10 -translate-x-1/2 text-center focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#9BB4EC]"
        style={{ left: `${lane}%` }}
        aria-label={`${selected ? 'Закрыть' : 'Подробнее'}: урок ${lesson.lessonNumber}, ${lesson.title}, прогресс ${lesson.completionPercent}%, ${stars} из 3 звёзд`}
      >
        {current && <span className="absolute -top-[23px] left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#172B59] px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.08em] text-white shadow-sm">Ты здесь</span>}
        <span className="relative flex h-[82px] w-[82px] items-center justify-center rounded-full p-[5px] transition-transform duration-200 group-hover:-translate-y-1 group-active:translate-y-0" style={{ background: locked ? '#D3D9E3' : `conic-gradient(${ringColor} ${progress}%, #E1E6EE ${progress}% 100%)`, boxShadow: `0 6px 0 ${locked ? '#ADB7C5' : colors.dark}, 0 9px 18px rgba(30,48,82,.16)` }}>
          <span className="flex h-full w-full items-center justify-center rounded-full border-[3px] border-white" style={{ background: nodeColor }}>
            <StudentVisualIcon name={done ? 'check' : locked ? 'lock' : subjectIcon(lesson)} size={31} color={iconColor} filled />
          </span>
          <span className="absolute -right-2 top-1 flex min-w-8 items-center justify-center rounded-full border-2 border-white px-1.5 py-0.5 text-[9px] font-black text-white shadow-sm" style={{ background: locked ? '#8792A3' : colors.main }}>{lesson.completionPercent}%</span>
          <span className="absolute -bottom-[12px] left-1/2 -translate-x-1/2"><LessonStars lesson={lesson} compact /></span>
        </span>
        <span className={`mt-4 block max-w-[106px] truncate text-[10px] font-black ${locked ? 'text-[#8A93A2]' : 'text-[#344054]'}`}>Урок {lesson.lessonNumber}</span>
      </button>
      {selected && <LessonDetail lesson={lesson} lane={lane} accent={accent} onClose={onSelect} />}
    </div>
  )
}

function UnitMarker({ unit }: { unit: PlatformRoadmapUnit }) {
  const colors = ACCENTS[unit.accentColor]
  return (
    <header className="relative mx-3 mb-4 mt-3 overflow-hidden rounded-[8px_30px_8px_8px] border border-black/5 bg-white py-4 pl-[76px] pr-5 shadow-[0_8px_24px_rgba(27,45,82,.10)]" style={{ borderLeft: `7px solid ${colors.main}` }}>
      <span aria-hidden="true" className="absolute -left-4 top-1/2 flex h-[72px] w-[72px] -translate-y-1/2 items-center justify-end rounded-full pr-3 text-[25px] font-black text-white" style={{ background: colors.main }}>0{unit.unitNumber}</span>
      <span aria-hidden="true" className="absolute -right-4 -top-7 h-20 w-20 rounded-full border-[14px] opacity-40" style={{ borderColor: colors.soft }} />
      <p className="text-[9px] font-black uppercase tracking-[0.14em]" style={{ color: colors.main }}>Раздел учебного маршрута</p>
      <h2 className="mt-0.5 text-[17px] font-black leading-tight tracking-[-0.02em] text-[#111827]">{unit.title}</h2>
      {unit.description && <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-[#637083]">{unit.description}</p>}
      <p className="mt-2 text-[10px] font-extrabold" style={{ color: colors.ink }}>{unit.completedLessons} из {unit.lessonCount} шагов пройдено</p>
    </header>
  )
}

export default function RoadmapTrail({ units }: { units: PlatformRoadmapUnit[] }) {
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null)
  const ascentUnits = [...units].reverse().map(unit => ({ ...unit, lessons: [...unit.lessons].reverse() }))
  const highestUnit = Math.max(...units.map(item => item.unitNumber))
  return (
    <div className="relative mx-auto max-w-[410px] overflow-hidden pb-7">
      <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-1/2 w-[360px] -translate-x-1/2 opacity-40 [background-image:radial-gradient(#DCE2ED_1px,transparent_1px)] [background-size:18px_18px]" />
      {ascentUnits.map((unit, ascentIndex) => (
        <section key={unit.id} className="relative pb-4">
          {unit.unitNumber < highestUnit && (
            <div className="relative z-10 flex h-[96px] items-center justify-center">
              <div className="relative h-[78px] w-[78px] overflow-hidden drop-shadow-[0_10px_10px_rgba(34,50,85,.18)]">
                <Image src="/roadmap-assets/reward-chest.png" alt="Награда между разделами" fill sizes="78px" className="scale-[2.05] object-cover mix-blend-multiply" />
              </div>
            </div>
          )}
          <UnitMarker unit={unit} />
          <div className="relative z-10 mx-auto w-[320px] max-w-full">
            {unit.lessons.map((lesson, index) => {
              const globalIndex = index + ascentIndex * 2
              const nextLane = index < unit.lessons.length - 1 ? LANES[(globalIndex + 1) % LANES.length] : null
              return <LessonNode key={lesson.id} lesson={lesson} index={globalIndex} accent={unit.accentColor} selected={selectedLessonId === lesson.id} onSelect={() => setSelectedLessonId(current => current === lesson.id ? null : lesson.id)} nextLane={nextLane} />
            })}
          </div>
        </section>
      ))}

      <section className="relative z-10 mx-auto mt-3 flex w-[306px] max-w-[calc(100%_-_32px)] items-center gap-2 border-y border-[#D9E0EC] bg-white/90 px-2 py-3 backdrop-blur-sm">
        <Image src="/roadmap-assets/student-reading.png" alt="Ученик Zhangak готовится к ОРТ" width={84} height={84} className="h-[72px] w-[72px] object-contain mix-blend-multiply" />
        <div className="min-w-0 pr-2">
          <p className="text-[12px] font-black text-[#0F172A]">Поднимайся шаг за шагом</p>
          <p className="mt-0.5 text-[11px] leading-4 text-[#5B6678]">Нажми на кружок, чтобы увидеть детали урока.</p>
        </div>
      </section>
      <style jsx global>{`
        .roadmap-popover { animation: roadmap-popover-in 180ms cubic-bezier(.2,.8,.2,1) both; transform-origin: top center; }
        @keyframes roadmap-popover-in { from { opacity: 0; transform: translateY(-7px) scale(.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @media (prefers-reduced-motion: reduce) { .roadmap-popover { animation: none; } }
      `}</style>
    </div>
  )
}
