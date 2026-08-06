'use client'
export const dynamic = 'force-dynamic'

import { useState } from 'react'
import AdminTopbar from '@/components/admin/AdminTopbar'
import QuestionBankTab from '@/components/admin/practice/QuestionBankTab'
import LessonTestsTab from '@/components/admin/practice/LessonTestsTab'

type Tab = 'bank' | 'lesson'

const TABS: { id: Tab; label: string }[] = [
  { id: 'bank', label: 'Банк вопросов' },
  { id: 'lesson', label: 'Тесты к урокам' },
]

export default function AdminPracticePage() {
  const [tab, setTab] = useState<Tab>('bank')

  return (
    <div className="min-h-screen bg-[#FAF8FF]">
      <AdminTopbar title="Практика" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        <div className="flex gap-1 border-b border-gray-200">
          {TABS.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
                tab === t.id
                  ? 'border-[#1B4FD8] text-[#1B4FD8]'
                  : 'border-transparent text-gray-500 hover:text-[#191B23]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'bank' ? <QuestionBankTab /> : <LessonTestsTab />}
      </div>
    </div>
  )
}
