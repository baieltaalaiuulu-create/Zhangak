'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { DEFAULT_TARGET_SCORE } from '@/lib/student-data'
import { fetchLatestMockScore } from '@/lib/profile-data'
import { getUniversityById, getFavoriteIds, toggleFavorite, UNIVERSITIES } from '@/lib/universities-data'
import UniversityDetailHeader from '@/components/student/universities/UniversityDetailHeader'
import SpecialtiesTable from '@/components/student/universities/SpecialtiesTable'
import ScorePassingChart from '@/components/student/universities/ScorePassingChart'
import DocumentsChecklist from '@/components/student/universities/DocumentsChecklist'
import ComparisonTable from '@/components/student/universities/ComparisonTable'

type TabKey = 'overview' | 'specialties' | 'scores' | 'cost' | 'documents' | 'reviews'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'overview', label: 'Обзор' },
  { key: 'specialties', label: 'Специальности' },
  { key: 'scores', label: 'Проходные баллы' },
  { key: 'cost', label: 'Стоимость' },
  { key: 'documents', label: 'Документы' },
  { key: 'reviews', label: 'Отзывы' },
]

function LoadingScreen() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F4F6FA', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ color: '#9CA3AF', fontSize: 14 }}>Загрузка...</div>
    </div>
  )
}

function formatCost(cost: number | null): string {
  return cost == null ? 'Бесплатно' : `${cost.toLocaleString('ru')} сом`
}

export default function UniversityDetailPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const [loading, setLoading] = useState(true)
  const [studentScore, setStudentScore] = useState(0)
  const [tab, setTab] = useState<TabKey>('overview')
  const [favorites, setFavorites] = useState<Set<string>>(new Set())

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, student_type, target_score')
        .eq('id', user.id)
        .single()

      if (!profile || profile.role !== 'student') { router.push('/login'); return }
      if (profile.student_type === 'offline') { router.push('/student'); return }

      const latest = await fetchLatestMockScore(user.id)
      setStudentScore(latest ?? profile.target_score ?? DEFAULT_TARGET_SCORE)
      setFavorites(getFavoriteIds())
      setLoading(false)
    }
    init()
  }, [router])

  // Arriving from a catalog card's "Сравнить" link (#comparison hash) —
  // scroll straight to the comparison table once the page has rendered.
  useEffect(() => {
    if (!loading && typeof window !== 'undefined' && window.location.hash === '#comparison') {
      document.getElementById('comparison')?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [loading])

  if (loading) return <LoadingScreen />

  const university = getUniversityById(params.id)
  if (!university) {
    router.push('/student/online/universities')
    return <LoadingScreen />
  }

  const isFavorite = favorites.has(university.id)
  const others = UNIVERSITIES.filter(u => u.id !== university.id).slice(0, 2)
  const comparisonList = [university, ...others]

  return (
    <div className="min-h-screen bg-[#F4F6FA]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-5 min-w-0">

        <UniversityDetailHeader
          university={university}
          isFavorite={isFavorite}
          onToggleFavorite={() => setFavorites(toggleFavorite(university.id))}
        />

        <div className="flex gap-2 overflow-x-auto rounded-2xl border border-gray-100 bg-white p-1.5 shadow-sm">
          {TABS.map(t => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`shrink-0 rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                tab === t.key ? 'text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50'
              }`}
              style={tab === t.key ? { background: 'linear-gradient(135deg, #6C3DE0 0%, #4338CA 100%)' } : undefined}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'overview' && (
          <div className="space-y-5">
            <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
              <h3 className="text-sm font-bold text-gray-900">О университете</h3>
              <div className="mt-3 space-y-3">
                {university.about.map((p, i) => (
                  <p key={i} className="text-sm leading-relaxed text-gray-600">{p}</p>
                ))}
              </div>
            </div>

            <div>
              <h3 className="mb-3 text-sm font-bold text-gray-900">Ключевые преимущества</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {university.advantages.map((a, i) => (
                  <div key={i} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                    <div className="text-2xl">{a.icon}</div>
                    <h4 className="mt-2 text-sm font-bold text-gray-900">{a.title}</h4>
                    <p className="mt-1 text-xs leading-relaxed text-gray-500">{a.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'specialties' && (
          <SpecialtiesTable specialties={university.specialties} studentScore={studentScore} />
        )}

        {tab === 'scores' && (
          <ScorePassingChart specialties={university.specialties} studentScore={studentScore} />
        )}

        {tab === 'cost' && (
          <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-bold text-gray-900">Стоимость обучения по специальностям</h3>
            <table className="mt-4 w-full min-w-[480px] text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  <th className="px-3 py-2">Специальность</th>
                  <th className="px-3 py-2">Тип</th>
                  <th className="px-3 py-2">Стоимость в год</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {university.specialties.map(s => (
                  <tr key={s.id}>
                    <td className="px-3 py-2.5 font-semibold text-gray-800">{s.name}</td>
                    <td className="px-3 py-2.5">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${s.type === 'Бюджет' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        {s.type}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-gray-700">{formatCost(s.costPerYear)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'documents' && (
          <DocumentsChecklist documents={university.documents} deadline={university.applicationDeadline} />
        )}

        {tab === 'reviews' && (
          <div className="rounded-2xl border border-gray-100 bg-white p-10 text-center shadow-sm">
            <div className="text-3xl">💬</div>
            <p className="mt-3 text-sm font-semibold text-gray-600">Отзывов пока нет</p>
            <p className="mt-1 text-xs text-gray-400">Эта функция скоро появится — студенты смогут делиться впечатлениями об университете.</p>
          </div>
        )}

        <ComparisonTable universities={comparisonList} studentScore={studentScore} />

      </div>
    </div>
  )
}
