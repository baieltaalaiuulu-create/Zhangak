'use client'

import { useState } from 'react'
import {
  SUBJECT_TAB_LABELS,
  SUBJECT_TAB_SECTIONS,
  type SubjectTab,
  type PracticeTopic,
} from '@/lib/practice-data'
import TopicCard from './TopicCard'

const TABS: SubjectTab[] = ['all', 'math', 'kyr', 'analogy', 'reading']

interface Props {
  topics: PracticeTopic[]
}

export default function PracticeTopicBrowser({ topics }: Props) {
  const [tab, setTab] = useState<SubjectTab>('all')

  const visible = tab === 'all'
    ? topics
    : topics.filter(t => SUBJECT_TAB_SECTIONS[tab].includes(t.section))

  return (
    <div className="min-h-screen bg-[#F4F6FA] px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-xl font-bold text-[#191B23]">Практика</h1>
        <p className="mt-1 text-sm text-gray-500">Выбери тему и практикуйся в любое время</p>

        <div className="mt-5 flex flex-wrap gap-2">
          {TABS.map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                tab === t
                  ? 'bg-[#1B4FD8] text-white'
                  : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {SUBJECT_TAB_LABELS[t]}
            </button>
          ))}
        </div>

        {visible.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-gray-100 bg-white p-10 text-center text-sm text-gray-400">
            Вопросы по этой теме пока не добавлены
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map(t => (
              <TopicCard key={`${t.section}::${t.topic}`} topic={t} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
