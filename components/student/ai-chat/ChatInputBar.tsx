'use client'

import { Paperclip, Mic, Send } from 'lucide-react'

interface Props {
  value: string
  onChange: (v: string) => void
  onSend: () => void
  disabled: boolean
}

export default function ChatInputBar({ value, onChange, onSend, disabled }: Props) {
  return (
    <div className="shrink-0 border-t border-gray-100 bg-white px-4 py-3 sm:px-6">
      <div className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2">
        <button type="button" aria-label="Прикрепить файл" disabled className="shrink-0 rounded-lg p-1.5 text-gray-300">
          <Paperclip size={17} />
        </button>
        <input
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend() } }}
          placeholder="Спроси AI что угодно о подготовке к ОРТ..."
          disabled={disabled}
          className="min-w-0 flex-1 bg-transparent text-sm text-gray-800 placeholder:text-gray-400 outline-none disabled:opacity-60"
        />
        <button type="button" aria-label="Голосовой ввод" disabled className="shrink-0 rounded-lg p-1.5 text-gray-300">
          <Mic size={17} />
        </button>
        <button
          type="button"
          onClick={onSend}
          disabled={disabled || !value.trim()}
          aria-label="Отправить"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-white transition-opacity disabled:opacity-40"
          style={{ background: 'linear-gradient(135deg, #6C3DE0 0%, #4338CA 100%)' }}
        >
          <Send size={15} />
        </button>
      </div>
      <p className="mt-1.5 text-center text-[11px] text-gray-400">AI учитывает твой прогресс, ошибки и историю обучения</p>
    </div>
  )
}
