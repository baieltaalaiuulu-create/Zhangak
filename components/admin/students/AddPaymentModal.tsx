'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { addPayment, PAYMENT_METHODS, type AdminStudent } from '@/lib/admin-data'

interface Props {
  student: AdminStudent
  onClose: () => void
  onSaved: () => void
}

export default function AddPaymentModal({ student, onClose, onSaved }: Props) {
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState(PAYMENT_METHODS[0].value)
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    setError('')
    const amountNum = Number(amount)
    if (!amountNum || amountNum <= 0) { setError('Введите корректную сумму'); return }

    setSaving(true)
    try {
      await addPayment({ student_id: student.id, amount: amountNum, method, date, comment: comment.trim() })
      onSaved()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Произошла ошибка')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-[#191B23]">Добавить платёж</h2>
            <p className="text-xs text-gray-400">{student.full_name}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-50"><X size={18} /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-500">Сумма (сом) *</label>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="5000"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1B4FD8]/20" />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-500">Способ</label>
            <div className="grid grid-cols-2 gap-2">
              {PAYMENT_METHODS.map(m => (
                <button key={m.value} type="button" onClick={() => setMethod(m.value)}
                  className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors ${method === m.value ? 'border-[#1B4FD8] bg-[#EEF2FF] text-[#1B4FD8]' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-500">Дата</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1B4FD8]/20" />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-500">Комментарий</label>
            <textarea value={comment} onChange={e => setComment(e.target.value)} rows={2} placeholder="Дополнительная информация"
              className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1B4FD8]/20" />
          </div>

          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">{error}</div>}

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={handleSubmit} disabled={saving}
              className="rounded-xl bg-[#1B4FD8] px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:opacity-60">
              {saving ? 'Сохранение...' : 'Добавить'}
            </button>
            <button type="button" onClick={onClose}
              className="rounded-xl bg-gray-100 px-5 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-200">
              Отмена
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
