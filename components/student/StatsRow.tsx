interface Props {
  stats: {
    lessons: number
    questions: number
    tests: number
    mocks: number
    hours: number
  }
}

const ITEMS = [
  { key: 'lessons',   label: 'уроков',      icon: '🎥' },
  { key: 'questions', label: 'вопросов',    icon: '📝' },
  { key: 'tests',     label: 'тестов',      icon: '📋' },
  { key: 'mocks',     label: 'пробных ОРТ', icon: '🎯' },
  { key: 'hours',     label: 'часов',       icon: '⏱' },
] as const

export default function StatsRow({ stats }: Props) {
  return (
    <div className="rounded-2xl bg-white shadow-sm border border-gray-100 overflow-hidden">
      <div className="grid grid-cols-5 divide-x divide-gray-100">
        {ITEMS.map((item, i) => (
          <div key={item.key} className="flex flex-col items-center justify-center py-4 gap-0.5">
            <span className="text-lg">{item.icon}</span>
            <span className="text-xl font-bold text-blue-700">
              {stats[item.key]}
            </span>
            <span className="text-xs text-gray-400">{item.label}</span>
            <span className="text-[10px] text-gray-300">за месяц</span>
          </div>
        ))}
      </div>
    </div>
  )
}
