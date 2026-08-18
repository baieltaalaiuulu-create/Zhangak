'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { GitCompareArrows, RefreshCw, WifiOff } from 'lucide-react'
import {
  fetchUniversityById, fetchUniversityCatalog, getFavoriteIds, toggleFavorite, type University,
} from '@/lib/universities-data'
import UniversityDetailHeader from '@/components/student/universities/UniversityDetailHeader'
import SpecialtiesTable from '@/components/student/universities/SpecialtiesTable'
import ScorePassingChart from '@/components/student/universities/ScorePassingChart'
import DocumentsChecklist from '@/components/student/universities/DocumentsChecklist'
import ComparisonTable from '@/components/student/universities/ComparisonTable'
import { UniversityAdvantageIcon } from '@/components/student/universities/UniversityVisuals'
import { useStudentSession } from '@/components/student/StudentSessionContext'

type TabKey = 'overview' | 'specialties' | 'scores' | 'cost' | 'documents'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'overview', label: 'Обзор' },
  { key: 'specialties', label: 'Специальности' },
  { key: 'scores', label: 'Проходные баллы' },
  { key: 'cost', label: 'Стоимость' },
  { key: 'documents', label: 'Документы' },
]

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-[#F4F6FA] px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-5xl animate-pulse space-y-5">
        <div className="h-64 rounded-2xl bg-white" />
        <div className="h-14 rounded-2xl bg-white" />
        <div className="h-80 rounded-2xl bg-white" />
      </div>
    </div>
  )
}

function formatCost(cost: number | null): string {
  if (cost == null) return 'Не указано'
  return cost === 0 ? 'Бесплатно' : `${cost.toLocaleString('ru')} сом`
}

export default function UniversityDetailPage() {
  const params = useParams<{ id: string }>()
  const sessionUser = useStudentSession()
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [studentId, setStudentId] = useState<string | null>(null)
  const [studentScore, setStudentScore] = useState<number | null>(null)
  const [tab, setTab] = useState<TabKey>('overview')
  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  const [university, setUniversity] = useState<University | null>(null)
  const [comparisonList, setComparisonList] = useState<University[]>([])
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    let active = true
    const init = async () => {
      const user = sessionUser
      setLoading(true)
      setLoadError(false)
      setNotFound(false)

      try {
        const [foundUniversity, catalog] = await Promise.all([
          fetchUniversityById(params.id),
          fetchUniversityCatalog(),
        ])
        if (!active) return

        if (!foundUniversity) { setNotFound(true); return }

        // The catalog no longer reads a legacy mock result. An own full ORT
        // score projection is still pending, so admission probability remains
        // explicitly unknown instead of using a target score or percentage.
        setStudentScore(null)
        setUniversity(foundUniversity)
        const savedFavorites = getFavoriteIds(user.id)
        setComparisonList([
          foundUniversity,
          ...catalog.items.filter(u => u.id !== foundUniversity.id && savedFavorites.has(u.id)).slice(0, 2),
        ])
        setStudentId(user.id)
        setFavorites(savedFavorites)
      } catch {
        if (active) setLoadError(true)
      } finally {
        if (active) setLoading(false)
      }
    }
    void init()
    return () => { active = false }
  }, [params.id, sessionUser])

  if (loading) return <LoadingScreen />

  if (loadError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F4F6FA] px-6 text-center">
        <div className="max-w-sm rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <WifiOff size={30} className="mx-auto text-gray-400" aria-hidden="true" />
          <h1 className="mt-3 text-lg font-bold text-gray-900">Данные не загрузились</h1>
          <p className="mt-1 text-sm text-gray-500">Проверь интернет и попробуй открыть университет ещё раз.</p>
          <button type="button" onClick={() => window.location.reload()} className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#6C3DE0] px-5 text-sm font-bold text-white">
            <RefreshCw size={16} aria-hidden="true" /> Повторить
          </button>
        </div>
      </div>
    )
  }

  if (notFound || !university) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F4F6FA] px-6 text-center">
        <div className="max-w-sm rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <h1 className="text-lg font-bold text-gray-900">Университет пока не опубликован</h1>
          <p className="mt-2 text-sm leading-6 text-gray-500">Карточка не найдена в новом каталоге. Мы показываем только проверенные и активные данные.</p>
          <Link href="/student/online/universities" className="mt-5 inline-flex min-h-12 items-center rounded-xl bg-[#6C3DE0] px-5 text-sm font-bold text-white">
            Вернуться в каталог
          </Link>
        </div>
      </div>
    )
  }

  const isFavorite = favorites.has(university.id)

  return (
    <div className="min-h-screen bg-[#F4F6FA]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-5 min-w-0">

        <UniversityDetailHeader
          university={university}
          isFavorite={isFavorite}
          onToggleFavorite={() => {
            if (studentId) setFavorites(toggleFavorite(studentId, university.id))
          }}
        />

        <div className="flex gap-2 overflow-x-auto rounded-2xl border border-gray-100 bg-white p-1.5 shadow-sm">
          {TABS.map(t => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              aria-pressed={tab === t.key}
              className={`min-h-11 shrink-0 rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
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
                {university.about.length > 0 ? university.about.map((p, i) => (
                  <p key={i} className="text-sm leading-relaxed text-gray-600">{p}</p>
                )) : <p className="text-sm text-gray-500">Описание пока не добавлено. Проверь информацию на официальном сайте университета.</p>}
              </div>
            </div>

            {university.advantages.length > 0 && <div>
              <h3 className="mb-3 text-sm font-bold text-gray-900">Ключевые преимущества</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {university.advantages.map((a, i) => (
                  <div key={i} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                    <UniversityAdvantageIcon iconKey={a.iconKey} />
                    <h4 className="mt-2 text-sm font-bold text-gray-900">{a.title}</h4>
                    <p className="mt-1 text-xs leading-relaxed text-gray-500">{a.description}</p>
                  </div>
                ))}
              </div>
            </div>}
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
          <DocumentsChecklist documents={university.documents} deadline={university.applicationDeadline} officialWebsite={university.website} />
        )}

        {comparisonList.length >= 2 ? (
          <ComparisonTable universities={comparisonList} studentScore={studentScore} />
        ) : (
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-[#6C3DE0]"><GitCompareArrows size={19} aria-hidden="true" /></span>
              <div>
                <h3 className="text-sm font-bold text-gray-900">Сравнить с избранными</h3>
                <p className="mt-1 text-sm text-gray-500">Добавь университеты в избранное, затем выбери их для сравнения в каталоге.</p>
                <Link href="/student/online/universities" className="mt-3 inline-flex min-h-11 items-center text-sm font-bold text-[#6C3DE0] hover:underline">Вернуться в каталог</Link>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
