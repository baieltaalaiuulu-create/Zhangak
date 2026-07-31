'use client'

import { AreaChart, Area, ResponsiveContainer, YAxis } from 'recharts'

interface HeroCardProps {
  currentScore: number
  targetScore: number
  remaining: number
  sparkline: { date: string; score: number }[]
  onContinue: () => void
}

export default function HeroCard({ currentScore, targetScore, remaining, sparkline, onContinue }: HeroCardProps) {
  const pct = targetScore > 0 ? Math.min(100, Math.round((currentScore / targetScore) * 100)) : 0
  const hasData = sparkline.length > 0

  return (
    <div id="hero" style={{
      background: 'linear-gradient(135deg, #0D1E4A 0%, #16296B 45%, #1B4FD8 100%)',
      borderRadius: '20px',
      padding: '28px 30px',
      color: '#fff',
      position: 'relative',
      overflow: 'hidden',
      boxShadow: '0 20px 45px rgba(13,30,74,0.25)',
    }}>
      <div className="ozb-hero-grid" style={{ display: 'flex', justifyContent: 'space-between', gap: '24px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '10px' }}>
            Прогресс по ОРТ
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '46px', fontWeight: 900, letterSpacing: '-1.5px', lineHeight: 1 }}>{currentScore}</span>
            <span style={{ fontSize: '18px', fontWeight: 600, color: 'rgba(255,255,255,0.55)' }}>/ {targetScore} балл</span>
          </div>
          <div style={{ marginTop: '10px', display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(249,115,22,0.16)', color: '#FDBA74', fontWeight: 700, fontSize: '13px', padding: '5px 12px', borderRadius: '999px' }}>
            🎯 Осталось {remaining} баллов
          </div>

          <div style={{ marginTop: '20px', background: 'rgba(255,255,255,0.14)', borderRadius: '999px', height: '9px', overflow: 'hidden' }}>
            <div style={{
              width: `${pct}%`,
              height: '100%',
              background: 'linear-gradient(90deg,#F97316,#FB923C)',
              borderRadius: '999px',
              transition: 'width 0.6s ease',
            }} />
          </div>
          <div style={{ marginTop: '8px', fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>{pct}% от цели</div>

          <button
            onClick={onContinue}
            style={{
              marginTop: '22px',
              background: '#fff',
              color: '#0D1E4A',
              border: 'none',
              borderRadius: '12px',
              padding: '12px 22px',
              fontWeight: 800,
              fontSize: '14px',
              cursor: 'pointer',
              boxShadow: '0 8px 20px rgba(0,0,0,0.18)',
            }}
          >
            🚀 Продолжить подготовку
          </button>
        </div>

        <div className="ozb-hero-spark" style={{ width: '220px', flexShrink: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginBottom: '6px', textAlign: 'right' }}>
            Последние попытки
          </div>
          <div style={{ height: '90px' }}>
            {hasData ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={sparkline} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#FB923C" stopOpacity={0.55} />
                      <stop offset="100%" stopColor="#FB923C" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <YAxis hide domain={['dataMin - 5', 'dataMax + 5']} />
                  <Area
                    type="monotone"
                    dataKey="score"
                    stroke="#FB923C"
                    strokeWidth={2.5}
                    fill="url(#sparkFill)"
                    dot={{ r: 3, fill: '#FB923C', strokeWidth: 0 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', fontSize: '12px', color: 'rgba(255,255,255,0.45)' }}>
                Пройди первый пробный тест
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
