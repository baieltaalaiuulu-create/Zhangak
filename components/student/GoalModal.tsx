'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { MIN_TARGET_SCORE, MAX_TARGET_SCORE } from '@/lib/student-data'

interface Props {
  currentGoal: number
  onClose: () => void
  onSaved: (newGoal: number) => void
}

function validationError(raw: string): string | null {
  if (raw.trim() === '') return 'Введите число'
  const n = Number(raw)
  if (Number.isNaN(n)) return 'Введите число'
  if (n < MIN_TARGET_SCORE) return `Минимальная цель — ${MIN_TARGET_SCORE} баллов`
  if (n > MAX_TARGET_SCORE) return `Максимальный балл ОРТ — ${MAX_TARGET_SCORE}`
  return null
}

// Mounted only while the modal is open (see HeroCard), so this initial
// state is always fresh — no effect needed to resync it on reopen.
export default function GoalModal({ currentGoal, onClose, onSaved }: Props) {
  const [inputText, setInputText] = useState<string>(String(currentGoal))
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const parsed = Number(inputText)
  const hasValidNumber = inputText.trim() !== '' && !Number.isNaN(parsed)
  const rangeError = validationError(inputText)
  const sliderValue = hasValidNumber
    ? Math.min(Math.max(Math.round(parsed), MIN_TARGET_SCORE), MAX_TARGET_SCORE)
    : currentGoal

  const handleSave = async () => {
    if (rangeError) return
    const goal = Math.round(parsed)

    setSaving(true)
    setSaveError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setSaveError('Не удалось определить пользователя')
      setSaving(false)
      return
    }

    const { error } = await supabase
      .from('profiles')
      .update({ target_score: goal })
      .eq('id', user.id)

    setSaving(false)

    if (error) {
      setSaveError('Не удалось сохранить. Попробуйте снова.')
      return
    }

    onSaved(goal)
    onClose()
  }

  const displayedError = rangeError ?? saveError

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="goal-modal-title"
      >
        <h2 id="goal-modal-title" className="text-lg font-bold text-gray-900">
          Личная цель по ОРТ
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Выбери желаемый балл от {MIN_TARGET_SCORE} до {MAX_TARGET_SCORE}
        </p>

        <div className="mt-5 flex items-center gap-4">
          <input
            type="range"
            min={MIN_TARGET_SCORE}
            max={MAX_TARGET_SCORE}
            value={sliderValue}
            onChange={(e) => setInputText(e.target.value)}
            className="h-2 flex-1 accent-[#1B4FD8]"
            aria-label="Личная цель по ОРТ"
          />
          <input
            type="number"
            min={MIN_TARGET_SCORE}
            max={MAX_TARGET_SCORE}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className={`w-20 rounded-lg border px-2 py-1.5 text-center text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1B4FD8]/30 ${
              rangeError ? 'border-red-400' : 'border-gray-200'
            }`}
          />
        </div>

        {displayedError && (
          <p className="mt-2 text-xs font-semibold text-red-600">{displayedError}</p>
        )}

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-gray-500 transition-colors hover:bg-gray-50"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !!rangeError}
            className="rounded-xl bg-[#1B4FD8] px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? 'Сохранение…' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  )
}
