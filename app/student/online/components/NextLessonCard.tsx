'use client'

import type { PracticeLesson } from '../lib/types'

interface NextLessonCardProps {
  lesson: PracticeLesson | null
  subjectDone: number
  subjectTotal: number
  onStart: () => void
}

const SUBJECT_META: Record<string, { label: string; color: string; bg: string }> = {
  math: { label: 'Математика', color: '#1B4FD8', bg: '#EEF2FF' },
  kyr: { label: 'Кыргызча', color: '#F59E0B', bg: '#FFFBEB' },
}

export default function NextLessonCard({ lesson, subjectDone, subjectTotal, onStart }: NextLessonCardProps) {
  const meta = lesson ? SUBJECT_META[lesson.subject] : null
  const pct = subjectTotal > 0 ? subjectDone / subjectTotal : 0

  const size = 46
  const stroke = 5
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - pct)

  return (
    <div style={{
      background: '#fff',
      borderRadius: '16px',
      border: '1px solid #F1F3F7',
      boxShadow: '0 1px 3px rgba(13,30,74,0.04)',
      overflow: 'hidden',
    }}>
      <div style={{ height: '5px', background: meta ? meta.color : '#CBD5E1' }} />
      <div style={{ padding: '20px' }}>
        {lesson && meta ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span style={{
                fontSize: '11px', fontWeight: 700, color: meta.color, background: meta.bg,
                padding: '4px 10px', borderRadius: '999px',
              }}>
                {meta.label}
              </span>
              <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
                <circle cx={size / 2} cy={size / 2} r={radius} stroke="#EEF1F6" strokeWidth={stroke} fill="none" />
                <circle
                  cx={size / 2} cy={size / 2} r={radius}
                  stroke={meta.color} strokeWidth={stroke} fill="none"
                  strokeDasharray={circumference} strokeDashoffset={offset}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dashoffset 0.6s ease' }}
                />
              </svg>
            </div>

            <div style={{ fontWeight: 800, fontSize: '15px', color: '#0D1E4A', marginBottom: '10px', lineHeight: 1.35 }}>
              {lesson.title}
            </div>

            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '18px' }}>
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748B', background: '#F4F6FA', padding: '4px 9px', borderRadius: '7px' }}>
                🎬 Видеосабак
              </span>
              {lesson.order_number != null && (
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748B', background: '#F4F6FA', padding: '4px 9px', borderRadius: '7px' }}>
                  Тема {lesson.order_number}
                </span>
              )}
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748B', background: '#F4F6FA', padding: '4px 9px', borderRadius: '7px' }}>
                {subjectDone}/{subjectTotal} пройдено
              </span>
            </div>

            <button
              onClick={onStart}
              style={{
                width: '100%', background: '#1B4FD8', color: '#fff', border: 'none',
                borderRadius: '12px', padding: '13px', fontWeight: 800, fontSize: '14px',
                cursor: 'pointer', boxShadow: '0 8px 20px rgba(27,79,216,0.28)',
              }}
            >
              Начать урок →
            </button>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: '28px', marginBottom: '8px' }}>🎉</div>
            <div style={{ fontWeight: 700, fontSize: '14px', color: '#0D1E4A' }}>Все уроки пройдены</div>
            <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '4px' }}>Отличная работа, продолжай практику</div>
          </div>
        )}
      </div>
    </div>
  )
}
