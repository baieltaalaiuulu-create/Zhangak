'use client'

import type { SubjectStat } from '../lib/types'

interface SubjectAnalyticsProps {
  subjects: SubjectStat[]
  benchmark: { avg: number; top: number }
}

function statusFor(current: number, avg: number, top: number): { label: string; color: string; bg: string } {
  if (current <= 0) return { label: 'Нет данных', color: '#94A3B8', bg: '#F1F5F9' }
  if (current >= top * 0.9) return { label: 'Хорошо', color: '#10B981', bg: '#ECFDF3' }
  if (current >= avg) return { label: 'Средне', color: '#F59E0B', bg: '#FFFBEB' }
  return { label: 'Повторить', color: '#EF4444', bg: '#FEF2F2' }
}

export default function SubjectAnalytics({ subjects, benchmark }: SubjectAnalyticsProps) {
  return (
    <div id="subjects">
      <div style={{ fontWeight: 800, fontSize: '15px', color: '#0D1E4A', marginBottom: '12px' }}>
        Прогресс по предметам
      </div>
      <div className="ozb-subjects-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
        {subjects.map(s => {
          const status = statusFor(s.current, benchmark.avg, benchmark.top)
          const pct = Math.min(100, Math.round((s.current / benchmark.top) * 100))
          return (
            <div key={s.key} style={{
              background: '#fff',
              borderRadius: '14px',
              border: '1px solid #F1F3F7',
              boxShadow: '0 1px 3px rgba(13,30,74,0.04)',
              padding: '16px 16px 16px 14px',
              display: 'flex',
              gap: '12px',
            }}>
              <div style={{ width: '4px', borderRadius: '4px', background: s.color, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontWeight: 700, fontSize: '13px', color: '#0D1E4A' }}>{s.label}</span>
                  <span style={{
                    fontSize: '10px', fontWeight: 700, padding: '3px 8px', borderRadius: '999px',
                    color: status.color, background: status.bg,
                  }}>
                    {status.label}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '22px', fontWeight: 900, color: '#0D1E4A' }}>{s.current}</span>
                  {s.delta !== null && s.delta !== 0 && (
                    <span style={{ fontSize: '12px', fontWeight: 700, color: s.delta > 0 ? '#10B981' : '#EF4444' }}>
                      {s.delta > 0 ? '▲' : '▼'} {Math.abs(s.delta)}
                    </span>
                  )}
                </div>

                <div style={{ background: '#EEF1F6', borderRadius: '999px', height: '6px', overflow: 'hidden', marginBottom: '8px' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: s.color, borderRadius: '999px', transition: 'width 0.6s ease' }} />
                </div>

                <div style={{ fontSize: '11px', color: '#94A3B8' }}>
                  Ты: <strong style={{ color: '#0D1E4A' }}>{s.current}</strong> • Средний: {benchmark.avg} • Топ: {benchmark.top}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
