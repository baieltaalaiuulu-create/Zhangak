import Link from 'next/link'
import { ArrowRight, BookOpenCheck } from 'lucide-react'

interface Props {
  currentScore: number | null
  targetScore: number
}

export default function UniversitiesBottomCTA({ currentScore, targetScore }: Props) {
  const remaining = currentScore == null ? null : Math.max(0, targetScore - currentScore)

  return (
    <div className="rounded-2xl p-6 text-white shadow-sm sm:p-8" style={{ background: 'linear-gradient(135deg, #1F1B3A 0%, #0D0D1A 100%)' }}>
      <h3 className="flex items-center gap-2 text-lg font-bold sm:text-xl"><BookOpenCheck size={20} aria-hidden="true" /> Начать подготовку к поступлению</h3>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/70">
        Начни с опубликованных уроков и серверно проверенных тестов. Персональный план появится, когда AI-коуч будет подключён к проверенному учебному прогрессу.
      </p>

      <div className="mt-5 flex flex-wrap gap-6">
        <div>
          <div className="text-2xl font-extrabold">{currentScore ?? '—'}</div>
          <div className="text-xs text-white/50">Текущий балл</div>
        </div>
        <div>
          <div className="text-2xl font-extrabold">{targetScore}</div>
          <div className="text-xs text-white/50">Цель</div>
        </div>
        <div>
          <div className="text-2xl font-extrabold" style={{ color: remaining == null || remaining > 0 ? '#FBBF24' : '#34D399' }}>{remaining ?? '—'}</div>
          <div className="text-xs text-white/50">Осталось баллов</div>
        </div>
      </div>

      <Link
        href="/student/online/lessons"
        className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-full px-6 py-3 text-sm font-bold text-white shadow-md transition-opacity hover:opacity-90"
        style={{ background: 'linear-gradient(135deg, #6C3DE0 0%, #4338CA 100%)' }}
      >
        Открыть уроки <ArrowRight size={17} aria-hidden="true" />
      </Link>
    </div>
  )
}
