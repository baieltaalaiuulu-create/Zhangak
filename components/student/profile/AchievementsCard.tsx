import { Flame, CheckCircle2, ClipboardList, BookOpen } from 'lucide-react'

interface Props {
  streak: number
  questionsSolved: number
  mocksCompleted: number
  lessonsCompleted: number
}

export default function AchievementsCard({ streak, questionsSolved, mocksCompleted, lessonsCompleted }: Props) {
  const items = [
    { icon: Flame, label: 'Дней подряд', value: streak, color: '#EF4444', bg: '#FEF2F2' },
    { icon: CheckCircle2, label: 'Вопросов решено', value: questionsSolved, color: '#10B981', bg: '#F0FDF4' },
    { icon: ClipboardList, label: 'Пробных ОРТ', value: mocksCompleted, color: '#1B4FD8', bg: '#EEF2FF' },
    { icon: BookOpen, label: 'Уроков пройдено', value: lessonsCompleted, color: '#7C3AED', bg: '#F5F3FF' },
  ]

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <h2 className="text-sm font-bold text-[#191B23]">Достижения</h2>
      <div className="mt-3 grid grid-cols-2 gap-3">
        {items.map(item => {
          const Icon = item.icon
          return (
            <div key={item.label} className="rounded-xl border border-gray-100 p-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: item.bg }}>
                <Icon size={17} color={item.color} />
              </span>
              <div className="mt-2 text-lg font-extrabold text-[#191B23]">{item.value}</div>
              <div className="text-[11px] text-gray-400">{item.label}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
