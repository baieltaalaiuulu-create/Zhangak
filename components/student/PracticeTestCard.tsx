import Link from 'next/link'
import { Clock, ListChecks } from 'lucide-react'
import type { PracticeTestListItem } from '@/lib/practice-data'

const SUBJECT_META: Record<PracticeTestListItem['subject'], { label: string; color: string; bg: string }> = {
  math: { label: 'Математика', color: 'text-blue-600', bg: 'bg-blue-50' },
  kyr: { label: 'Кыргыз тили', color: 'text-orange-600', bg: 'bg-orange-50' },
  all: { label: 'Общий тест', color: 'text-purple-600', bg: 'bg-purple-50' },
}

interface Props {
  test: PracticeTestListItem
}

export default function PracticeTestCard({ test }: Props) {
  const meta = SUBJECT_META[test.subject]

  return (
    <div className="flex flex-col rounded-2xl border border-gray-200 bg-white p-5">
      <span className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${meta.bg} ${meta.color}`}>
        {meta.label}
      </span>
      <h3 className="mt-3 line-clamp-2 text-base font-bold text-[#191B23]">{test.title}</h3>

      <div className="mt-4 flex items-center gap-4 text-xs text-gray-400">
        <span className="flex items-center gap-1.5">
          <ListChecks size={14} /> {test.questionCount} вопросов
        </span>
        <span className="flex items-center gap-1.5">
          <Clock size={14} /> {test.timeLimitMinutes ? `${test.timeLimitMinutes} мин` : '—'}
        </span>
      </div>

      <Link
        href={`/student/online/practice?lesson=${test.lessonId}`}
        className="mt-5 rounded-xl bg-[#1B4FD8] py-2.5 text-center text-sm font-bold text-white transition-colors hover:bg-blue-700"
      >
        Начать тест
      </Link>
    </div>
  )
}
