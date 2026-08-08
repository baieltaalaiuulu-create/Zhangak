import type { HeatmapDay, HeatmapMonth } from '@/lib/dashboard-data'

interface Props {
  days: HeatmapDay[]
  months: HeatmapMonth[]
}

// GitHub-style intensity buckets — 0 sessions vs. 1/2/3+ sessions that day.
function levelColor(count: number): string {
  if (count === 0) return '#F1F2F6'
  if (count === 1) return '#B4C6FF'
  if (count === 2) return '#5C7CFA'
  return '#1B4FD8'
}

export default function ActivityHeatmap({ days, months }: Props) {
  // Pad the front so the grid starts on a Monday column, then chunk into
  // 7-day weeks (columns), matching the familiar GitHub layout.
  const first = days[0]
  const firstDow = first ? (new Date(`${first.date}T00:00:00`).getDay() + 6) % 7 : 0 // Mon=0
  const padded: (HeatmapDay | null)[] = [...Array(firstDow).fill(null), ...days]

  const weeks: (HeatmapDay | null)[][] = []
  for (let i = 0; i < padded.length; i += 7) {
    weeks.push(padded.slice(i, i + 7))
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-bold text-gray-900">Активность подготовки</h3>

      <div className="mt-4 overflow-x-auto">
        <div className="flex gap-[3px]">
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-[3px]">
              {week.map((day, di) => (
                <div
                  key={di}
                  className="h-[11px] w-[11px] rounded-[2px]"
                  style={{ background: day ? levelColor(day.count) : 'transparent' }}
                  title={day ? `${day.date}: ${day.count}` : undefined}
                />
              ))}
            </div>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium text-gray-400">
          {months.map((m, i) => (
            <span key={i} className={m.isCurrent ? 'font-bold text-[#1B4FD8]' : ''}>
              {m.label}{m.isCurrent ? ' (Текущий)' : ''}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
