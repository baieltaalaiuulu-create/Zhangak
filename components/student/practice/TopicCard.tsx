import Link from 'next/link'
import { ListChecks } from 'lucide-react'
import type { PracticeTopic } from '@/lib/practice-data'

const DIFFICULTY_META: Record<PracticeTopic['difficulty'], { label: string; color: string; bg: string }> = {
  easy: { label: 'Лёгкий', color: 'text-green-600', bg: 'bg-green-50' },
  medium: { label: 'Средний', color: 'text-amber-600', bg: 'bg-amber-50' },
  hard: { label: 'Сложный', color: 'text-red-600', bg: 'bg-red-50' },
  mixed: { label: 'Смешанный', color: 'text-gray-500', bg: 'bg-gray-100' },
}

interface Props {
  topic: PracticeTopic
}

export default function TopicCard({ topic }: Props) {
  const meta = DIFFICULTY_META[topic.difficulty]

  return (
    <div className="flex flex-col rounded-2xl border border-gray-200 bg-white p-5">
      <span className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${meta.bg} ${meta.color}`}>
        {meta.label}
      </span>
      <h3 className="mt-3 line-clamp-2 text-base font-bold text-[#191B23]">{topic.topic}</h3>

      <div className="mt-4 flex items-center gap-1.5 text-xs text-gray-400">
        <ListChecks size={14} /> {topic.questionCount} вопросов
      </div>

      <Link
        href={`/student/online/practice?section=${encodeURIComponent(topic.section)}&topic=${encodeURIComponent(topic.topic)}`}
        className="mt-5 rounded-xl bg-[#1B4FD8] py-2.5 text-center text-sm font-bold text-white transition-colors hover:bg-blue-700"
      >
        Начать практику
      </Link>
    </div>
  )
}
