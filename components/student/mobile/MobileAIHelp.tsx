import Link from 'next/link'
import { Sparkles } from 'lucide-react'

interface Props {
  lessonTitle: string
}

// The previous quick-question event only dispatched into a retired floating
// drawer, so taps appeared to do nothing. Until the first-party AI API is
// ready, show an explicit state and route the student to a useful live flow.
export default function MobileAIHelp({ lessonTitle }: Props) {
  return (
    <section className="rounded-2xl border border-indigo-100 bg-white p-4 shadow-sm" aria-labelledby="mobile-ai-help-title">
      <div className="flex items-start gap-2">
        <Sparkles size={17} className="mt-0.5 shrink-0 text-[#1B3F92]" aria-hidden="true" />
        <div>
          <h2 id="mobile-ai-help-title" className="text-sm font-bold text-[#0D1E4A]">AI-помощник обновляется</h2>
          <p className="mt-1 text-xs leading-5 text-gray-500">
            Вопросы по уроку «{lessonTitle}» появятся после подключения AI к проверенным материалам курса.
          </p>
        </div>
      </div>
      <Link
        href="/student/online/practice"
        className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-[#EEF2FF] px-3 text-xs font-bold text-[#1B3F92]"
      >
        Открыть тренажёр по теме
      </Link>
    </section>
  )
}
