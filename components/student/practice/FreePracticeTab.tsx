'use client'

import { useEffect, useState } from 'react'
import { ChevronLeft, Sparkles } from 'lucide-react'
import {
  fetchSubjectOverview, fetchPracticeTopics, fetchTopicStats,
  SUBJECT_TAB_LABELS, SUBJECT_TAB_SECTIONS, SECTION_LABELS,
  type SubjectOverview, type PracticeTopic, type TopicStat, type SubjectTab,
} from '@/lib/practice-data'
import TopicCard from './TopicCard'

interface Props {
  studentId: string | null
}

const SUBJECT_CARD_ICON: Record<Exclude<SubjectTab, 'all'>, string> = {
  math: '📐',
  kyr: '📘',
  analogy: '🧠',
  reading: '👁',
}

export default function FreePracticeTab({ studentId }: Props) {
  const [loading, setLoading] = useState(true)
  const [overview, setOverview] = useState<SubjectOverview[]>([])
  const [topics, setTopics] = useState<PracticeTopic[]>([])
  const [topicStats, setTopicStats] = useState<Map<string, TopicStat>>(new Map())
  const [selectedSubject, setSelectedSubject] = useState<Exclude<SubjectTab, 'all'> | null>(null)
  const [selectedSection, setSelectedSection] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const [allTopics, stats, subjectOverview] = await Promise.all([
        fetchPracticeTopics(),
        studentId ? fetchTopicStats(studentId) : Promise.resolve(new Map<string, TopicStat>()),
        studentId ? fetchSubjectOverview(studentId) : Promise.resolve([]),
      ])
      setTopics(allTopics)
      setTopicStats(stats)
      setOverview(subjectOverview)
      setLoading(false)
    }
    load()
  }, [studentId])

  if (loading) {
    return <div className="rounded-2xl border border-gray-100 bg-white p-10 text-center text-sm text-gray-400">Загрузка тем...</div>
  }

  // ── Subject selection screen ──────────────────────────────────────────
  if (!selectedSubject) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-base font-bold text-gray-900">Выберите предмет</h2>
          <p className="mt-0.5 text-sm text-gray-500">Практикуйся по темам в своём темпе</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {overview.map(o => (
            <button
              key={o.subject}
              type="button"
              onClick={() => setSelectedSubject(o.subject)}
              className="flex flex-col items-start rounded-2xl border border-gray-200 bg-white p-4 text-left transition-colors hover:border-[#1B4FD8]/40 hover:bg-blue-50/30"
            >
              <span className="text-2xl">{SUBJECT_CARD_ICON[o.subject]}</span>
              <span className="mt-2 text-sm font-bold text-[#191B23]">{SUBJECT_TAB_LABELS[o.subject]}</span>
              <span className="mt-1 text-xs text-gray-400">{o.questionCount} вопросов</span>
              {o.accuracyPct !== null && (
                <span className="mt-1.5 text-xs font-bold text-green-600">{o.accuracyPct}% точность</span>
              )}
            </button>
          ))}
        </div>

        <AiMentorFooterCard />
      </div>
    )
  }

  // ── Section + topics screen ───────────────────────────────────────────
  const sections = SUBJECT_TAB_SECTIONS[selectedSubject]
  // Only worth showing a tab bar when the subject actually spans more than
  // one DB `section` value — most (kyr/analogy/reading) map to exactly one,
  // so there's nothing meaningful to switch between.
  const activeSection = selectedSection ?? sections[0]
  const visibleTopics = topics.filter(t => t.section === activeSection)

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => { setSelectedSubject(null); setSelectedSection(null) }}
        className="flex items-center gap-1 text-sm font-semibold text-gray-500 hover:text-gray-700"
      >
        <ChevronLeft size={16} /> Все предметы
      </button>

      <h2 className="text-base font-bold text-gray-900">
        {SUBJECT_CARD_ICON[selectedSubject]} {SUBJECT_TAB_LABELS[selectedSubject]}
      </h2>

      {sections.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {sections.map(section => (
            <button
              key={section}
              type="button"
              onClick={() => setSelectedSection(section)}
              className={`shrink-0 rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                activeSection === section ? 'bg-[#1B4FD8] text-white' : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {SECTION_LABELS[section] ?? section}
            </button>
          ))}
        </div>
      )}

      {visibleTopics.length === 0 ? (
        <div className="rounded-2xl border border-gray-100 bg-white p-10 text-center text-sm text-gray-400">
          Вопросы по этой теме пока не добавлены
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {visibleTopics.map(t => (
            <TopicCard
              key={`${t.section}::${t.topic}`}
              topic={t}
              stat={topicStats.get(`${t.section}::${t.topic}`)}
              buttonLabel="Практика"
            />
          ))}
        </div>
      )}

      <AiMentorFooterCard />
    </div>
  )
}

function AiMentorFooterCard() {
  return (
    <a
      href="/student/online/ai"
      className="flex items-center gap-3 rounded-2xl p-5 text-white shadow-sm transition-opacity hover:opacity-95"
      style={{ background: 'linear-gradient(135deg, #1F1B3A 0%, #0D0D1A 100%)' }}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10">
        <Sparkles size={18} />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-bold">Не знаешь, с чего начать?</p>
        <p className="text-xs text-white/60">Спроси AI Mentor — он подберёт темы под твой уровень</p>
      </div>
    </a>
  )
}
