interface Props {
  lessonsCompleted: number
  lessonsTotal: number
  testsCompleted: number
  mocksCompleted: number
}

function Bar({ label, count, denominator, valueLabel }: { label: string; count: number; denominator: number; valueLabel: string }) {
  const pct = denominator > 0 ? Math.min(100, Math.round((count / denominator) * 100)) : 0
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-sm">
        <span className="font-semibold text-[#191B23]">{label}</span>
        <span className="text-xs text-gray-400">{valueLabel}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-gray-100">
        <div className="h-full rounded-full bg-[#1B4FD8] transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export default function ProfileProgressCard({ lessonsCompleted, lessonsTotal, testsCompleted, mocksCompleted }: Props) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
      <h2 className="text-sm font-bold text-[#191B23]">Прогресс обучения</h2>
      <Bar
        label="Уроки"
        count={lessonsCompleted}
        denominator={lessonsTotal}
        valueLabel={`${lessonsCompleted} из ${lessonsTotal}`}
      />
      {/* No fixed target exists for practice/mock volume — the bar reflects
          relative activity against a soft visual scale, not a real ratio. */}
      <Bar
        label="Практика пройдена"
        count={testsCompleted}
        denominator={Math.max(20, testsCompleted)}
        valueLabel={`${testsCompleted} пройдено`}
      />
      <Bar
        label="Пробные ОРТ"
        count={mocksCompleted}
        denominator={Math.max(5, mocksCompleted)}
        valueLabel={`${mocksCompleted} пройдено`}
      />
    </div>
  )
}
