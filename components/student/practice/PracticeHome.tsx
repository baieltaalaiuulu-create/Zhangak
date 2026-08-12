'use client'

import { useState } from 'react'
import { CalendarCheck2, Dumbbell, type LucideIcon } from 'lucide-react'
import DailyChallengeTab from './DailyChallengeTab'
import FreePracticeTab from './FreePracticeTab'
import MobileDailyChallengeTab from './MobileDailyChallengeTab'
import WeeklyLeaderboardPanel from './WeeklyLeaderboardPanel'

type Tab = 'daily' | 'free'

const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: 'daily', label: 'Задание дня', icon: CalendarCheck2 },
  { id: 'free', label: 'Свободная', icon: Dumbbell },
]

interface Props {
  studentId: string | null
}

export default function PracticeHome({ studentId }: Props) {
  const [tab, setTab] = useState<Tab>('daily')

  return (
    <>
      {/* ============ MOBILE (< 768px) ============ */}
      <div className="block min-h-screen bg-[#F4F6FA] pb-6 md:hidden">
        <h1 className="px-4 pt-4 text-xl font-bold text-[#191B23]">Тренажёр</h1>

        <div className="mt-3 flex gap-2 px-4">
          {TABS.map(t => {
            const Icon = t.icon
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                aria-pressed={tab === t.id}
                className={`flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full px-3 py-2.5 text-sm font-bold transition-colors ${
                  tab === t.id ? 'bg-[#1B4FD8] text-white' : 'bg-white text-gray-600'
                }`}
              >
                <Icon size={17} aria-hidden="true" />
                {t.label}
              </button>
            )
          })}
        </div>

        {tab === 'daily' ? (
          <MobileDailyChallengeTab studentId={studentId} />
        ) : (
          <div className="mt-3">
            <FreePracticeTab studentId={studentId} compact />
          </div>
        )}
      </div>

      {/* ============ DESKTOP (>= 768px) — unchanged ============ */}
      <div className="hidden min-h-screen bg-[#F4F6FA] px-4 py-6 sm:px-6 md:block">
        <div className="mx-auto max-w-7xl">
          <h1 className="text-xl font-bold text-[#191B23]">Тренажёр</h1>
          <p className="mt-1 text-sm text-gray-500">Задание дня, темы для тренировки и рейтинг недели — всё в одном месте</p>

          <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
            {TABS.map(t => {
              const Icon = t.icon
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  aria-pressed={tab === t.id}
                  className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-colors ${
                    tab === t.id ? 'bg-[#1B4FD8] text-white' : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Icon size={17} aria-hidden="true" />
                  {t.label}
                </button>
              )
            })}
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
    </>
  )
}
