'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { bulkAddBankQuestions, type BankQuestionPayload } from '@/lib/admin-data'

interface Props {
  onClose: () => void
  onDone: () => void
}

const PLACEHOLDER = `[
  {
    "question_text": "2 + 2 = ?",
    "option_a": "3", "option_b": "4", "option_c": "5", "option_d": "6",
    "correct_answer": "B",
    "section": "math",
    "topic": "Арифметика",
    "difficulty": "easy"
  }
]`

const VALID_SECTIONS = ['math', 'comparison', 'analogy', 'reading', 'grammar']
const VALID_ANSWERS = ['A', 'B', 'C', 'D']
const VALID_DIFFICULTIES = ['easy', 'medium', 'hard']
const REQUIRED_STRING_FIELDS = ['question_text', 'option_a', 'option_b', 'option_c', 'option_d', 'correct_answer', 'section', 'topic']

function validateItem(item: unknown, index: number): { payload: BankQuestionPayload } | { error: string } {
  if (typeof item !== 'object' || item === null) return { error: `#${index + 1}: должен быть объектом` }
  const o = item as Record<string, unknown>

  for (const f of REQUIRED_STRING_FIELDS) {
    if (typeof o[f] !== 'string' || !(o[f] as string).trim()) return { error: `#${index + 1}: поле "${f}" обязательно` }
  }

  const correct = (o.correct_answer as string).trim().toUpperCase()
  if (!VALID_ANSWERS.includes(correct)) return { error: `#${index + 1}: correct_answer должен быть A/B/C/D` }

  const section = (o.section as string).trim()
  if (!VALID_SECTIONS.includes(section)) return { error: `#${index + 1}: недопустимый section "${section}"` }

  const rawDifficulty = typeof o.difficulty === 'string' ? o.difficulty.trim() : ''
  const difficulty = VALID_DIFFICULTIES.includes(rawDifficulty) ? rawDifficulty : 'medium'
  // Optional — lets an admin paste a pre-hosted image URL; there's no way to
  // attach a binary file through a JSON paste, so upload-per-question stays
  // the only path for new images.
  const imageUrl = typeof o.image_url === 'string' && o.image_url.trim() ? o.image_url.trim() : null

  return {
    payload: {
      question_text: (o.question_text as string).trim(),
      option_a: (o.option_a as string).trim(),
      option_b: (o.option_b as string).trim(),
      option_c: (o.option_c as string).trim(),
      option_d: (o.option_d as string).trim(),
      correct_answer: correct as 'A' | 'B' | 'C' | 'D',
      section,
      topic: (o.topic as string).trim(),
      difficulty: difficulty as 'easy' | 'medium' | 'hard',
      image_url: imageUrl,
    },
  }
}

export default function BulkAddModal({ onClose, onDone }: Props) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ inserted: number; errors: string[] } | null>(null)

  const handleSubmit = async () => {
    setError('')
    setResult(null)

    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      setError('Неверный JSON')
      return
    }
    if (!Array.isArray(parsed) || parsed.length === 0) {
      setError('Ожидается непустой массив вопросов')
      return
    }

    const payloads: BankQuestionPayload[] = []
    const validationErrors: string[] = []
    parsed.forEach((item, i) => {
      const r = validateItem(item, i)
      if ('error' in r) validationErrors.push(r.error)
      else payloads.push(r.payload)
    })

    if (payloads.length === 0) {
      setError(validationErrors.join('; '))
      return
    }

    setBusy(true)
    const outcome = await bulkAddBankQuestions(payloads)
    setBusy(false)
    setResult({ inserted: outcome.inserted, errors: [...validationErrors, ...outcome.errors] })
    if (outcome.inserted > 0) onDone()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#191B23]">Массалык кошуу (JSON)</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-50"><X size={18} /></button>
        </div>

        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder={PLACEHOLDER}
          rows={12}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 font-mono text-xs outline-none focus:ring-2 focus:ring-[#1B4FD8]/20"
        />

        {error && <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">{error}</div>}

        {result && (
          <div className={`mt-3 rounded-lg border px-3 py-2 text-xs font-semibold ${result.errors.length ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-green-200 bg-green-50 text-green-700'}`}>
            <p>Добавлено: {result.inserted}</p>
            {result.errors.length > 0 && (
              <ul className="mt-1 list-disc pl-4">
                {result.errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            )}
          </div>
        )}

        <div className="mt-5 flex gap-2">
          <button type="button" onClick={handleSubmit} disabled={busy || !text.trim()}
            className="rounded-xl bg-[#1B4FD8] px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:opacity-60">
            {busy ? 'Кошулууда...' : 'Кошуу'}
          </button>
          <button type="button" onClick={onClose} className="rounded-xl bg-gray-100 px-5 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-200">
            Жабуу
          </button>
        </div>
      </div>
    </div>
  )
}
