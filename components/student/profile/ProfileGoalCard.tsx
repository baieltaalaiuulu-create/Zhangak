'use client'

import { useState } from 'react'
import { Target, Pencil } from 'lucide-react'
import GoalModal from '@/components/student/GoalModal'

interface Props {
  targetScore: number
  onGoalUpdate: (newGoal: number) => void
}

export default function ProfileGoalCard({ targetScore, onGoalUpdate }: Props) {
  const [modalOpen, setModalOpen] = useState(false)

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-[#191B23]">Личная цель по ОРТ</h2>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          aria-label="Изменить цель"
          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-50 hover:text-[#1B4FD8]"
        >
          <Pencil size={15} />
        </button>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EEF2FF] text-[#1B4FD8]">
          <Target size={18} />
        </span>
        <span className="text-2xl font-extrabold text-[#191B23]">{targetScore} <span className="text-sm font-semibold text-gray-400">баллов</span></span>
      </div>

      {modalOpen && (
        <GoalModal
          currentGoal={targetScore}
          onClose={() => setModalOpen(false)}
          onSaved={onGoalUpdate}
        />
      )}
    </div>
  )
}
