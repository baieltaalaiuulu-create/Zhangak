'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import { GitCompareArrows, GraduationCap, RefreshCw, WifiOff, X } from 'lucide-react'
import { DEFAULT_TARGET_SCORE } from '@/lib/student-dashboard-contract'
import {
  fetchUniversityCatalog, getFavoriteIds, toggleFavorite,
  type CatalogStatus, type University, type CatalogStats,
} from '@/lib/universities-data'
import { rankAdmissionMatches } from '@/lib/university-matching'
import UniversitiesHero from '@/components/student/universities/UniversitiesHero'
import UniversitiesStatsRow from '@/components/student/universities/UniversitiesStatsRow'
import UniversitiesFilters, { DEFAULT_FILTERS, type FilterState } from '@/components/student/universities/UniversitiesFilters'
import AIRecommendationBar from '@/components/student/universities/AIRecommendationBar'
import UniversityCard from '@/components/student/universities/UniversityCard'
import UniversitiesBottomCTA from '@/components/student/universities/UniversitiesBottomCTA'
import ComparisonTable from '@/components/student/universities/ComparisonTable'
import { useStudentSession } from '@/components/student/StudentSessionContext'

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-[#F4F6FA] px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-7xl animate-pulse space-y-5">
        <div className="h-56 rounded-2xl bg-violet-100" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-28 rounded-2xl bg-white" />)}
        </div>
        <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
          <div className="h-80 rounded-2xl bg-white" />
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-72 rounded-2xl bg-white" />)}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function UniversitiesPage() {
  const sessionUser = useStudentSession()
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [studentId, setStudentId] = useState<string | null>(null)
  const [latestScore, setLatestScore] = useState<number | null>(null)
  const [targetScore, setTargetScore] = useState(DEFAULT_TARGET_SCORE)

  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS)
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false)
  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  const [comparisonIds, setComparisonIds] = useState<Set<string>>(new Set())
  const [universities, setUniversities] = useState<University[]>([])
  const [catalogStats, setCatalogStats] = useState<CatalogStats | null>(null)
  const [catalogStatus, setCatalogStatus] = useState<CatalogStatus | null>(null)

  useEffect(() => {
    let active = true
    const init = async () => {
      const user = sessionUser

      try {
        const catalog = await fetchUniversityCatalog()
        if (!active) return

        setTargetScore(user.targetScore ?? DEFAULT_TARGET_SCORE)
        // An own API for an authoritative full ORT mock score is not part of
        // this slice yet. Never reinterpret a practice percentage or the
        // student's target score as a current result.
        setLatestScore(null)
        setUniversities(catalog.items)
        setCatalogStats(catalog.stats)
        setCatalogStatus(catalog.catalogStatus)
        setStudentId(user.id)
        setFavorites(getFavoriteIds(user.id))
      } catch {
        if (active) setLoadError(true)
      } finally {
        if (active) setLoading(false)
      }
    }
    void init()
    return () => { active = false }
  }, [sessionUser])

  const handleToggleFavorite = (id: string) => {
    if (studentId) setFavorites(toggleFavorite(studentId, id))
  }

  const handleToggleCompare = (id: string) => {
    setComparisonIds(current => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else if (next.size < 3) next.add(id)
      return next
    })
  }

  // Only an actual mock result is a current score. A target is aspirational
  // and must never be presented as evidence of admission probability. The
  // first-party mock score projection is pending, so this stays unknown.
  const studentScore = latestScore

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return universities.filter(u => {
      if (showFavoritesOnly && !favorites.has(u.id)) return false
      if (q && !(u.name.toLowerCase().includes(q) || u.shortName.toLowerCase().includes(q) || u.specialties.some(s => s.name.toLowerCase().includes(q)))) return false
      if (filters.city !== 'all' && u.city !== filters.city) return false
      if (filters.direction !== 'all' && !u.directions.includes(filters.direction)) return false
      if (filters.language !== 'all' && !u.languages.includes(filters.language)) return false
      if (filters.type !== 'all' && u.type !== filters.type) return false
      if (u.minScore != null && u.minScore > filters.maxMinScore) return false
      if ((u.costFrom ?? 0) > filters.maxCost) return false
      if (filters.dormitoryOnly && !u.hasDormitory) return false
      if (filters.budgetOnly && !u.budgetSeats) return false
      return true
    })
  }, [universities, query, filters, showFavoritesOnly, favorites])

  const recommended = rankAdmissionMatches(universities, studentScore, 3)
  const comparisonList = universities.filter(university => comparisonIds.has(university.id))
  const cities = Array.from(new Set(universities.map(university => university.city).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'ru'))

  if (loading) return <LoadingScreen />

  if (loadError || !catalogStats) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F4F6FA] px-6 text-center">
        <div className="max-w-sm rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <WifiOff size={30} className="mx-auto text-gray-400" aria-hidden="true" />
          <h1 className="mt-3 text-lg font-bold text-gray-900">Каталог не загрузился</h1>
          <p className="mt-1 text-sm text-gray-500">Проверь интернет и попробуй ещё раз. Фильтры и избранное сохранятся на этом устройстве.</p>
          <button type="button" onClick={() => window.location.reload()} className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#6C3DE0] px-5 text-sm font-bold text-white">
            <RefreshCw size={16} aria-hidden="true" /> Повторить
          </button>
        </div>
      </div>
    )
  }

  if (catalogStatus === 'empty') {
    return (
      <div className="min-h-screen bg-[#F4F6FA]">
        <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
          <section className="rounded-3xl border border-violet-100 bg-white p-6 text-center shadow-sm sm:p-10">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-50 text-[#6C3DE0]">
              <GraduationCap size={28} aria-hidden="true" />
            </span>
            <h1 className="mt-5 text-xl font-extrabold text-gray-900">Каталог университетов обновляется</h1>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-gray-500">
              Мы добавим сюда только проверенные карточки университетов и специальностей. Пока данных нет в новой платформе, поэтому не показываем старые или непроверенные сведения.
            </p>
            <p className="mt-4 text-xs leading-5 text-gray-400">
              Для выбора вуза сейчас сверяй условия поступления на официальных сайтах и в приёмных комиссиях.
            </p>
          </section>
          <div className="mt-5">
            <UniversitiesBottomCTA currentScore={studentScore} targetScore={targetScore} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F4F6FA]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5 min-w-0">

        <UniversitiesHero
          query={query}
          onQueryChange={setQuery}
          showFavoritesOnly={showFavoritesOnly}
          onToggleFavoritesOnly={() => setShowFavoritesOnly(v => !v)}
        />

        <UniversitiesStatsRow stats={catalogStats} />

        <AIRecommendationBar studentScore={studentScore} universities={recommended} />

        {comparisonList.length > 0 && (
          <div className="rounded-2xl border border-violet-100 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-1 inline-flex items-center gap-2 text-sm font-bold text-gray-800">
                <GitCompareArrows size={17} className="text-[#6C3DE0]" aria-hidden="true" />
                Сравнение ({comparisonList.length}/3)
              </span>
              {comparisonList.map(university => (
                <button
                  key={university.id}
                  type="button"
                  onClick={() => handleToggleCompare(university.id)}
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-violet-50 px-3 text-xs font-semibold text-[#6C3DE0]"
                  aria-label={`Убрать ${university.shortName} из сравнения`}
                >
                  {university.shortName} <X size={14} aria-hidden="true" />
                </button>
              ))}
              {comparisonList.length < 2 ? (
                <span className="text-xs text-gray-400">Выбери ещё один университет</span>
              ) : (
                <a href="#comparison" className="ml-auto inline-flex min-h-10 items-center text-xs font-bold text-[#6C3DE0] hover:underline">
                  Показать таблицу
                </a>
              )}
            </div>
          </div>
        )}

        <div id="catalog" className="grid grid-cols-1 gap-5 lg:grid-cols-[300px_1fr]">
          <div className="min-w-0">
            <UniversitiesFilters filters={filters} onChange={setFilters} cities={cities} />
          </div>

          <div className="min-w-0 space-y-4">
            <p className="text-sm font-semibold text-gray-500">
              Найдено: {filtered.length} {filtered.length === 1 ? 'университет' : 'университетов'}
            </p>

            {filtered.length === 0 ? (
              <div className="rounded-2xl border border-gray-100 bg-white p-10 text-center text-sm text-gray-400">
                Ничего не найдено — попробуйте изменить фильтры.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {filtered.map(u => (
                  <UniversityCard
                    key={u.id}
                    university={u}
                    studentScore={studentScore}
                    isFavorite={favorites.has(u.id)}
                    onToggleFavorite={handleToggleFavorite}
                    isCompared={comparisonIds.has(u.id)}
                    onToggleCompare={handleToggleCompare}
                    compareDisabled={comparisonIds.size >= 3}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {comparisonList.length >= 2 && <ComparisonTable universities={comparisonList} studentScore={studentScore} />}

        <UniversitiesBottomCTA currentScore={studentScore} targetScore={targetScore} />

      </div>
    </div>
  )
}
