import Link from 'next/link'
import { SubjectStat } from '@/lib/student-data'

interface Props {
  latestScore: number | null
  subjects: SubjectStat[]
  targetScore: number
}

function getWeakSubject(subjects: SubjectStat[]): { label: string; questionsNeeded: number } | null {
  const meta: Record<string, { label: string; boost: number }> = {
    math:    { label: 'квадратные уравнения', boost: 1.12 },
    kyr:     { label: 'грамматику', boost: 1.93 },
    analogy: { label: 'аналогии', boost: 2 },
    reading: { label: 'чтение', boost: 2 },
  }
  const weak = subjects
    .filter(s => meta[s.subject])
    .sort((a, b) => (a.current / a.max) - (b.current / b.max))[0]

  if (!weak) return null
  const m = meta[weak.subject]
  // How many more questions to get +8 score
  const questionsNeeded = Math.ceil(8 / m.boost)
  return { label: m.label, questionsNeeded }
}

export default function AICard({ latestScore, subjects, targetScore }: Props) {
  const score = latestScore ?? 0
  const weak = getWeakSubject(subjects)
  const projectedScore = score + 8
  const toGoal = Math.max(0, targetScore - score)

  return (
    <div className="rounded-2xl overflow-hidden shadow-sm">
      {/* Dark gradient background */}
      <div
        className="p-5 flex flex-col gap-4"
        style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e2d4e 100%)' }}
      >
        {/* Header */}
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-blue-300 bg-white/10 px-2.5 py-1 rounded-full">
            🤖 AI-наставник
          </span>
        </div>

        {/* Message */}
        {weak ? (
          <p className="text-sm text-slate-300 leading-relaxed">
            Ты ошибаешься в теме{' '}
            <span className="text-white font-semibold">«{weak.label}»</span>.
            {' '}Сегодня реши{' '}
            <span className="text-orange-300 font-bold">{weak.questionsNeeded} вопросов</span>
            {' '}по этой теме.
          </p>
        ) : (
          <p className="text-sm text-slate-300 leading-relaxed">
            Отличный прогресс! Продолжай заниматься каждый день.
          </p>
        )}

        {/* Distance to personal goal */}
        {score > 0 && (
          <p className="text-xs text-slate-400">
            {toGoal > 0 ? (
              <>До цели {targetScore} баллов осталось{' '}
                <span className="font-bold text-orange-300">{toGoal} баллов</span>
              </>
            ) : (
              <>Цель {targetScore} баллов уже достигнута 🎉</>
            )}
          </p>
        )}

        {/* Score projection */}
        {score > 0 && (
          <div className="flex items-center gap-3">
            <div>
              <p className="text-xs text-slate-400">Прогноз после выполнения</p>
              <p className="text-2xl font-bold text-orange-400">
                {score} → {projectedScore} баллов
              </p>
            </div>
          </div>
        )}

        {/* CTA */}
        <Link
          href="/student/online/practice"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-500 transition-colors"
        >
          Начать практику →
        </Link>
      </div>
    </div>
  )
}
