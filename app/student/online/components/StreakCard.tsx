'use client'

interface StreakCardProps {
  streak: number
  days: { date: string; active: boolean }[]
}

export default function StreakCard({ streak, days }: StreakCardProps) {
  return (
    <div style={{
      background: 'linear-gradient(160deg, #1a1330 0%, #2b1a3d 100%)',
      borderRadius: '18px',
      padding: '20px',
      color: '#fff',
      boxShadow: '0 16px 36px rgba(26,19,48,0.28)',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '4px' }}>
        <span style={{ fontSize: '30px' }}>🔥</span>
        <span style={{ fontSize: '30px', fontWeight: 900, letterSpacing: '-1px' }}>{streak}</span>
        <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.55)', fontWeight: 600 }}>
          {streak === 1 ? 'день подряд' : 'дней подряд'}
        </span>
      </div>
      <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '16px' }}>
        {streak > 0 ? 'Не прерывай серию — занимайся сегодня' : 'Начни серию — пройди урок или тест сегодня'}
      </div>

      <div style={{ display: 'flex', gap: '5px', justifyContent: 'space-between' }}>
        {days.map(d => (
          <div
            key={d.date}
            title={d.date}
            style={{
              width: '100%',
              aspectRatio: '1',
              maxWidth: '16px',
              borderRadius: '4px',
              background: d.active ? '#F97316' : 'rgba(255,255,255,0.12)',
            }}
          />
        ))}
      </div>
    </div>
  )
}
