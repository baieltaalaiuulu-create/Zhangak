import Link from 'next/link'
import { CheckCircle2, Circle } from 'lucide-react'
import { LESSON_SUBJECT_META } from '@/lib/lessons-data'
import type { SubjectTrack } from '@/lib/student-data'

interface Props {
  tracks: SubjectTrack[]
}

function TaskRow({ done, label, href }: { done: boolean; label: string; href: string }) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${done ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'}`}
    >
      {done ? <CheckCircle2 size={18} className="shrink-0 text-green-600" /> : <Circle size={18} className="shrink-0 text-gray-300" />}
      <span className={done ? 'line-through opacity-70' : ''}>{label}</span>
    </Link>
  )
}

// "1 lesson + 1 practice per subject" — the whole point is that a student
// never has to wonder what's left today; it's always exactly these 4 rows.
export default function TodayPlanSimple({ tracks }: Props) {
  const doneCount = tracks.reduce((a, t) => a + (t.lessonDoneToday ? 1 : 0) + (t.practiceDoneToday ? 1 : 0), 0)
  const total = tracks.length * 2

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-900">План на сегодня</h3>
        <span className="text-xs font-semibold text-gray-400">{doneCount}/{total} выполнено</span>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {tracks.map(track => {
          const meta = LESSON_SUBJECT_META[track.subject]
          return (
            <div key={track.subject} className="space-y-2">
              <div className={`text-xs font-semibold ${meta.color}`}>{meta.icon} {meta.label}</div>
              <TaskRow
                done={track.lessonDoneToday}
                label={track.currentLesson ? `Урок: ${track.currentLesson.title}` : 'Урок пройден'}
                href={track.currentLesson ? `/student/online/lessons/${track.currentLesson.id}` : '/student/online/lessons'}
              />
              <TaskRow done={track.practiceDoneToday} label="Практика" href="/student/online/practice" />
            </div>
          )
        })}
      </div>
    </div>
  )
}
