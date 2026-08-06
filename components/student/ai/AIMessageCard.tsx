'use client'

import { BookOpen, PenLine, BarChart2, ListChecks, Sparkles, AlertCircle, Check, type LucideIcon } from 'lucide-react'
import type { MentorResponse } from '@/lib/ai-mentor-data'

interface TypeMeta {
  label: string
  icon: LucideIcon
  headerBg: string
  headerText: string
  iconBg: string
}

const TYPE_META: Record<MentorResponse['type'], TypeMeta> = {
  theory:     { label: 'Теория',    icon: BookOpen,   headerBg: 'bg-[#EEF2FF]', headerText: 'text-[#1B4FD8]', iconBg: 'bg-[#1B4FD8]' },
  task:       { label: 'Задание',   icon: PenLine,    headerBg: 'bg-amber-50',  headerText: 'text-amber-600', iconBg: 'bg-amber-500' },
  analysis:   { label: 'Анализ',    icon: BarChart2,  headerBg: 'bg-[#F5F3FF]', headerText: 'text-[#7C3AED]', iconBg: 'bg-[#7C3AED]' },
  plan:       { label: 'План',      icon: ListChecks, headerBg: 'bg-green-50',  headerText: 'text-green-600', iconBg: 'bg-green-600' },
  motivation: { label: 'Мотивация', icon: Sparkles,   headerBg: 'bg-pink-50',   headerText: 'text-pink-600',  iconBg: 'bg-pink-500' },
  error:      { label: 'Ошибка',    icon: AlertCircle, headerBg: 'bg-red-50',   headerText: 'text-red-600',   iconBg: 'bg-red-500' },
}

interface Props {
  response: MentorResponse
  onActionClick?: (action: string) => void
  checkedItems?: Set<number>
  onToggleItem?: (index: number) => void
  className?: string
}

export default function AIMessageCard({ response, onActionClick, checkedItems, onToggleItem, className = '' }: Props) {
  const meta = TYPE_META[response.type] ?? TYPE_META.theory
  const Icon = meta.icon
  const isPlan = response.type === 'plan'

  return (
    <div className={`animate-ai-fade-in overflow-hidden rounded-2xl border border-gray-200 bg-white ${className}`}>
      <div className={`flex items-center gap-2 px-4 py-2.5 ${meta.headerBg}`}>
        <span className={`flex h-6 w-6 items-center justify-center rounded-full text-white ${meta.iconBg}`}>
          <Icon size={13} />
        </span>
        <span className={`text-xs font-bold uppercase tracking-wide ${meta.headerText}`}>{meta.label}</span>
      </div>

      <div className="p-4">
        <h3 className="text-sm font-bold text-[#191B23]">{response.title}</h3>
        <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-gray-600">{response.content}</p>

        {response.actions.length > 0 && (
          isPlan ? (
            <ul className="mt-3 space-y-2">
              {response.actions.map((action, i) => {
                const checked = checkedItems?.has(i) ?? false
                return (
                  <li key={i}>
                    <button
                      type="button"
                      onClick={() => onToggleItem?.(i)}
                      className="flex w-full items-start gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-gray-50"
                    >
                      <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${checked ? 'border-green-600 bg-green-600 text-white' : 'border-gray-300 text-transparent'}`}>
                        <Check size={13} />
                      </span>
                      <span className={`text-sm ${checked ? 'text-gray-400 line-through' : 'text-[#191B23]'}`}>{action}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {response.actions.map((action, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => onActionClick?.(action)}
                  disabled={!onActionClick}
                  className="rounded-full border border-[#1B4FD8]/30 bg-[#EEF2FF] px-3 py-1.5 text-xs font-semibold text-[#1B4FD8] transition-colors hover:bg-[#1B4FD8] hover:text-white disabled:cursor-default disabled:opacity-70 disabled:hover:bg-[#EEF2FF] disabled:hover:text-[#1B4FD8]"
                >
                  {action}
                </button>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  )
}
