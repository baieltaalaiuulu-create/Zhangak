'use client'

interface AIAdvisorCardProps {
  weakSubjectLabel: string
  weakScore: number
  avgScore: number
  projectedGain: number
  ctaLabel: string
  onAction: () => void
}

export default function AIAdvisorCard({ weakSubjectLabel, weakScore, avgScore, projectedGain, ctaLabel, onAction }: AIAdvisorCardProps) {
  const hasData = weakScore > 0

  return (
    <div style={{
      background: 'linear-gradient(160deg, #0f172a 0%, #1e2d4e 100%)',
      borderRadius: '18px',
      padding: '22px',
      color: '#fff',
      boxShadow: '0 16px 36px rgba(15,23,42,0.28)',
    }}>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: '6px',
        background: 'rgba(255,255,255,0.08)', color: '#93C5FD',
        fontSize: '11px', fontWeight: 700, padding: '5px 11px', borderRadius: '999px',
        marginBottom: '14px',
      }}>
        🤖 AI-наставник
      </div>

      <p style={{ fontSize: '13px', lineHeight: 1.6, color: 'rgba(255,255,255,0.85)', margin: '0 0 16px' }}>
        {hasData ? (
          <>Слабое место — <strong style={{ color: '#fff' }}>{weakSubjectLabel}</strong>. Твой результат {weakScore} балл — ниже среднего ({avgScore}). Удели 20–30 минут в день этому предмету, чтобы подтянуть общий балл ОРТ.</>
        ) : (
          <>Пройди пробный тест, чтобы AI-наставник нашёл твоё слабое место и составил персональный план подготовки по <strong style={{ color: '#fff' }}>{weakSubjectLabel}</strong>.</>
        )}
      </p>

      {hasData && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          background: 'rgba(249,115,22,0.14)', borderRadius: '11px',
          padding: '10px 12px', marginBottom: '16px',
        }}>
          <span style={{ fontSize: '16px' }}>📈</span>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.75)' }}>
            Прогноз: <strong style={{ color: '#FDBA74' }}>+{projectedGain} баллов</strong> за 2 недели практики
          </span>
        </div>
      )}

      <button
        onClick={onAction}
        style={{
          width: '100%', background: '#1B4FD8', color: '#fff', border: 'none',
          borderRadius: '11px', padding: '12px', fontWeight: 700, fontSize: '13px',
          cursor: 'pointer',
        }}
      >
        {ctaLabel}
      </button>
    </div>
  )
}
