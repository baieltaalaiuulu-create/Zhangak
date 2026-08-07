import Link from 'next/link'
import { LESSON_SUBJECT_META } from '@/lib/lessons-data'
import type { SubjectTrack } from '@/lib/student-data'

interface Props {
  track: SubjectTrack
}

export default function SubjectTrackCard({ track }: Props) {
  const meta = LESSON_SUBJECT_META[track.subject]
  const isStarted = track.completedCount > 0
  const buttonLabel = isStarted ? 'Продолжить' : 'Начать'

  return (
    <div className="flex h-full flex-col rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className={`inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${meta.bg} ${meta.color}`}>
        {meta.icon} {meta.label}
      </div>

      <div className="mt-4 flex-1">
        {track.currentLesson ? (
          <>
            <p className="text-xs font-semibold text-gray-400">Текущий урок</p>
            <h3 className="mt-1 text-lg font-bold leading-snug text-gray-900">{track.currentLesson.title}</h3>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2 py-3 text-center">
            <span className="text-3xl">🎉</span>
            <p className="text-sm font-semibold text-gray-700">Все уроки пройдены!</p>
          </div>
        )}
      </div>

      <div className="mt-4">
        <div className="mb-1 flex items-center justify-between text-xs font-semibold text-gray-500">
          <span>Прогресс</span>
          <span>{track.completedCount}/{track.totalCount} уроков</span>
        </div>
        <div className="h-2 rounded-full bg-gray-100">
          <div className={`h-2 rounded-full ${meta.strip}`} style={{ width: `${track.progressPct}%` }} />
        </div>
      </div>

      <div className="mt-3 flex items-center gap-4 text-xs font-semibold">
        <span className={track.lessonDoneToday ? 'text-green-600' : 'text-gray-400'}>
          {track.lessonDoneToday ? '✓' : '○'} Урок сегодня
        </span>
        <span className={track.practiceDoneToday ? 'text-green-600' : 'text-gray-400'}>
          {track.practiceDoneToday ? '✓' : '○'} Практика сегодня
        </span>
      </div>

      {track.currentLesson && (
        <Link
          href={`/student/online/lessons/${track.currentLesson.id}`}
          className="mt-4 block w-full rounded-xl bg-[#1B4FD8] py-3 text-center text-sm font-bold text-white shadow-md shadow-blue-200 transition-colors hover:bg-blue-700"
        >
          {buttonLabel} →
        </Link>
      )}
    </div>
  )
}
