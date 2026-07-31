interface GreetingBarProps {
  firstName: string
  remaining: number
}

function motivation(remaining: number): string {
  if (remaining <= 0) return 'Цель достигнута — теперь закрепляем результат 🎯'
  if (remaining <= 10) return `Ещё ${remaining} баллов — ты почти у цели, не сбавляй темп 🔥`
  if (remaining <= 30) return `Осталось ${remaining} баллов до цели. Стабильная практика решает всё 💪`
  return `До цели ${remaining} баллов. Начни с малого — один урок в день даёт результат`
}

export default function GreetingBar({ firstName, remaining }: GreetingBarProps) {
  return (
    <div style={{ maxWidth: '1180px', margin: '0 auto', padding: '22px 24px 0', minWidth: 0 }}>
      <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#0D1E4A', margin: 0, letterSpacing: '-0.3px' }}>
        Привет, {firstName} 👋
      </h1>
      <p style={{ fontSize: '13px', color: '#64748B', margin: '5px 0 0' }}>
        {motivation(remaining)}
      </p>
    </div>
  )
}
