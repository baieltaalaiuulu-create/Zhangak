'use client'

import { useState } from 'react'
import DailyChallengeTab from './DailyChallengeTab'
import FreePracticeTab from './FreePracticeTab'
import WeeklyLeaderboardPanel from './WeeklyLeaderboardPanel'

type Tab = 'daily' | 'free'

const TABS: { id: Tab; label: string }[] = [
  { id: 'daily', label: '🔥 Задание дня' },
  { id: 'free', label: '🎯 Свободная практика' },
]

interface Props {
  studentId: string | null
}

export default function PracticeHome({ studentId }: Props) {
  const [tab, setTab] = useState<Tab>('daily')

  return (
    <div className="min-h-screen bg-[#F4F6FA] px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <h1 className="text-xl font-bold text-[#191B23]">Практика</h1>
        <p className="mt-1 text-sm text-gray-500">Задание дня, темы для тренировки и рейтинг недели — всё в одном месте</p>

        <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
          {TABS.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`shrink-0 rounded-xl px-4 py-2.5 text-sm font-bold transition-colors ${
                tab === t.id ? 'bg-[#1B4FD8] text-white' : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[1fr_360px]">
          <div className="min-w-0">
            {tab === 'daily' ? <DailyChallengeTab studentId={studentId} /> : <FreePracticeTab studentId={studentId} />}
          </div>
          <div className="min-w-0">
            <WeeklyLeaderboardPanel studentId={studentId} />
          </div>
        </div>
      </div>
    </div>
  )
}
