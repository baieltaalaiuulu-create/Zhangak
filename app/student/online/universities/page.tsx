'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { DEFAULT_TARGET_SCORE } from '@/lib/student-data'
import { fetchLatestMockScore } from '@/lib/profile-data'
import {
  fetchUniversities, fetchCatalogStats, getFavoriteIds, toggleFavorite,
  type University, type CatalogStats,
} from '@/lib/universities-data'
import UniversitiesHero from '@/components/student/universities/UniversitiesHero'
import UniversitiesStatsRow from '@/components/student/universities/UniversitiesStatsRow'
import UniversitiesFilters, { DEFAULT_FILTERS, type FilterState } from '@/components/student/universities/UniversitiesFilters'
import AIRecommendationBar from '@/components/student/universities/AIRecommendationBar'
import UniversityCard from '@/components/student/universities/UniversityCard'
import UniversitiesBottomCTA from '@/components/student/universities/UniversitiesBottomCTA'

function LoadingScreen() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F4F6FA', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ color: '#9CA3AF', fontSize: 14 }}>Загрузка...</div>
    </div>
  )
}

export default function UniversitiesPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [latestScore, setLatestScore] = useState<number | null>(null)
  const [targetScore, setTargetScore] = useState(DEFAULT_TARGET_SCORE)

  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS)
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false)
  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  const [universities, setUniversities] = useState<University[]>([])
  const [catalogStats, setCatalogStats] = useState<CatalogStats | null>(null)

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

      const [latest, universityList, stats] = await Promise.all([
        fetchLatestMockScore(user.id),
        fetchUniversities(),
        fetchCatalogStats(),
      ])

      setTargetScore(profile.target_score ?? DEFAULT_TARGET_SCORE)
      setLatestScore(latest)
      setUniversities(universityList)
      setCatalogStats(stats)
      setFavorites(getFavoriteIds())
      setLoading(false)
    }
    init()
  }, [router])

  const handleToggleFavorite = (id: string) => setFavorites(toggleFavorite(id))

  // "Current result" — real ORT score if the student has taken a mock,
  // otherwise their personal target as a reasonable starting estimate.
  const studentScore = latestScore ?? targetScore

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return universities.filter(u => {
      if (showFavoritesOnly && !favorites.has(u.id)) return false
      if (q && !(u.name.toLowerCase().includes(q) || u.shortName.toLowerCase().includes(q) || u.specialties.some(s => s.name.toLowerCase().includes(q)))) return false
      if (filters.city !== 'all' && u.city !== filters.city) return false
      if (filters.direction !== 'all' && !u.directions.includes(filters.direction)) return false
      if (filters.language !== 'all' && !u.languages.includes(filters.language)) return false
      if (filters.type !== 'all' && u.type !== filters.type) return false
      if (u.minScore > filters.maxMinScore) return false
      if ((u.costFrom ?? 0) > filters.maxCost) return false
      if (filters.dormitoryOnly && !u.hasDormitory) return false
      if (filters.budgetOnly && !u.budgetSeats) return false
      return true
    })
  }, [universities, query, filters, showFavoritesOnly, favorites])

  const recommended = universities.slice(0, 3)

  if (loading || !catalogStats) return <LoadingScreen />

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

        <div id="catalog" className="grid grid-cols-1 gap-5 lg:grid-cols-[300px_1fr]">
          <div className="min-w-0">
            <UniversitiesFilters filters={filters} onChange={setFilters} />
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
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <UniversitiesBottomCTA currentScore={studentScore} targetScore={targetScore} />

      </div>
    </div>
  )
}
