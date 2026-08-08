import type { TopicProgress } from '@/lib/ai-chat-panel-data'

interface Props {
  title: string
  topics: TopicProgress[]
  tone: 'weak' | 'strong'
}

function barColor(pct: number, tone: 'weak' | 'strong'): string {
  if (tone === 'strong') return '#22C55E'
  if (pct < 45) return '#EF4444'
  if (pct < 60) return '#F5890A'
  return '#EAB308'
}

export default function TopicProgressCard({ title, topics, tone }: Props) {
  if (topics.length === 0) return null

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <p className="mb-2.5 text-[11px] font-bold uppercase tracking-wide text-gray-400">{title}</p>
      <div className="space-y-2.5">
        {topics.map(t => (
          <div key={t.section}>
            <div className="mb-1 flex items-center justify-between text-xs font-semibold">
              <span className="text-gray-700">{t.label}</span>
              <span style={{ color: barColor(t.pct, tone) }}>{t.pct}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${t.pct}%`, background: barColor(t.pct, tone) }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
