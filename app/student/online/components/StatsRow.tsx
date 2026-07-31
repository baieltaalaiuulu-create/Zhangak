'use client'

interface StatsRowProps {
  lessons: number
  questions: number
  practiceTests: number
  mockTests: number
  hours: number
}

export default function StatsRow({ lessons, questions, practiceTests, mockTests, hours }: StatsRowProps) {
  const items = [
    { label: 'уроков', value: lessons },
    { label: 'вопросов', value: questions },
    { label: 'тестов', value: practiceTests },
    { label: 'пробных ОРТ', value: mockTests },
    { label: 'часов', value: hours },
  ]

  return (
    <div id="stats" style={{
      background: '#fff',
      borderRadius: '16px',
      border: '1px solid #F1F3F7',
      boxShadow: '0 1px 3px rgba(13,30,74,0.04)',
      padding: '18px 8px',
      display: 'flex',
    }}>
      {items.map((item, i) => (
        <div
          key={item.label}
          style={{
            flex: 1,
            textAlign: 'center',
            padding: '0 8px',
            borderLeft: i > 0 ? '1px solid #F1F3F7' : 'none',
          }}
        >
          <div style={{ fontSize: '22px', fontWeight: 900, color: '#0D1E4A' }}>{item.value}</div>
          <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>{item.label}</div>
        </div>
      ))}
    </div>
  )
}
