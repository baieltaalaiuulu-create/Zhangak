'use client'

import {
  BookOpen, ListChecks, AlertCircle, Sparkles, TrendingUp, PenLine, GraduationCap, Clock,
  type LucideIcon,
} from 'lucide-react'

export interface QuickAction {
  label: string
  prompt: string
  icon: LucideIcon
}

export const QUICK_ACTIONS: QuickAction[] = [
  { label: 'Объясни слабую тему', prompt: 'Объясни мою самую слабую тему простыми словами, с примером.', icon: BookOpen },
  { label: 'План на сегодня', prompt: 'Составь мне план подготовки на сегодня.', icon: ListChecks },
  { label: 'Разбери ошибки', prompt: 'Разбери мои последние ошибки и объясни, что пошло не так.', icon: AlertCircle },
  { label: 'Мотивируй меня', prompt: 'Мне нужна мотивация продолжать готовиться к ОРТ.', icon: Sparkles },
  { label: 'Прогноз балла', prompt: 'Спрогнозируй мой балл на ОРТ, если я продолжу готовиться как сейчас.', icon: TrendingUp },
  { label: 'Практика по разделу', prompt: 'Какой раздел мне стоит попрактиковать прямо сейчас и почему?', icon: PenLine },
  { label: 'Как готовиться к ОРТ', prompt: 'Дай общую стратегию подготовки к ОРТ с учётом моих результатов.', icon: GraduationCap },
  { label: 'Тайм-менеджмент', prompt: 'Дай совет по тайм-менеджменту на экзамене ОРТ.', icon: Clock },
]

interface Props {
  onAction: (prompt: string) => void
}

export default function AIQuickActions({ onAction }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {QUICK_ACTIONS.map(action => {
        const Icon = action.icon
        return (
          <button
            key={action.label}
            type="button"
            onClick={() => onAction(action.prompt)}
            className="flex flex-col items-start gap-2 rounded-xl border border-gray-200 bg-white p-3.5 text-left transition-colors hover:border-[#1B4FD8] hover:bg-[#EEF2FF]"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EEF2FF] text-[#1B4FD8]">
              <Icon size={16} />
            </span>
            <span className="text-xs font-semibold leading-tight text-[#191B23]">{action.label}</span>
          </button>
        )
      })}
    </div>
  )
}
