'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { AdminStudent } from '@/lib/admin-data'

interface Props {
  student: AdminStudent
  onClose: () => void
}

interface PaymentRow {
  id: number
  amount: number
  month: string
  status: string
  note: string | null
  created_at: string
}

const STATUS_LABELS: Record<string, string> = { paid: 'Төлөдү', partial: 'Жарым', debt: 'Карыз' }
const STATUS_COLORS: Record<string, string> = { paid: '#10B981', partial: '#F59E0B', debt: '#EF4444' }

export default function PaymentHistoryModal({ student, onClose }: Props) {
  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('payments').select('*').eq('student_id', student.id).order('created_at', { ascending: false })
      .then(({ data }) => { setPayments(data ?? []); setLoading(false) })
  }, [student.id])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-[#191B23]">Төлөм тарыхы</h2>
            <p className="text-xs text-gray-400">{student.full_name}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-50"><X size={18} /></button>
        </div>

        {loading ? (
          <div className="py-10 text-center text-sm text-gray-400">Жүктөлүүдө...</div>
        ) : payments.length === 0 ? (
          <div className="py-10 text-center text-sm text-gray-400">Төлөмдөр жок</div>
        ) : (
          <div className="space-y-2">
            {payments.map(p => (
              <div key={p.id} className="rounded-lg border border-gray-200 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-[#191B23]">{p.amount.toLocaleString()} сом</span>
                  <span className="rounded-full px-2 py-0.5 text-xs font-bold" style={{ background: `${STATUS_COLORS[p.status] ?? '#9CA3AF'}1A`, color: STATUS_COLORS[p.status] ?? '#9CA3AF' }}>
                    {STATUS_LABELS[p.status] ?? p.status}
                  </span>
                </div>
                <div className="mt-1 text-xs text-gray-400">{p.month} · {new Date(p.created_at).toLocaleDateString('ru')}</div>
                {p.note && <div className="mt-1 text-xs text-gray-500">{p.note}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
