'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Building2, Plus, Pencil, School, Trash2, ListChecks, Star } from 'lucide-react'
import AdminTopbar from '@/components/admin/AdminTopbar'
import DeleteConfirmModal from '@/components/admin/DeleteConfirmModal'
import UniversityFormModal from '@/components/admin/universities/UniversityFormModal'
import {
  fetchAdminUniversities, deleteUniversity, setUniversityActive, type AdminUniversity,
} from '@/lib/admin-universities-data'

function formatCost(min: number | null, max: number | null): string {
  if (min == null && max == null) return '—'
  if (min === 0 && max == null) return 'Бесплатно'
  if (min != null && max != null) return `${min.toLocaleString('ru')}–${max.toLocaleString('ru')} сом`
  return `от ${(min ?? max ?? 0).toLocaleString('ru')} сом`
}

export default function AdminUniversitiesPage() {
  const [universities, setUniversities] = useState<AdminUniversity[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [formTarget, setFormTarget] = useState<{ university?: AdminUniversity } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AdminUniversity | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = async () => {
    setLoadError(null)
    try {
      const data = await fetchAdminUniversities()
      setUniversities(data)
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Не удалось загрузить университеты')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    const init = async () => {
      try {
        const data = await fetchAdminUniversities()
        if (!cancelled) setUniversities(data)
      } catch (error) {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : 'Не удалось загрузить университеты')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void init()
    return () => { cancelled = true }
  }, [])

  const handleToggleActive = async (u: AdminUniversity) => {
    await setUniversityActive(u.id, !u.is_active)
    load()
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteUniversity(deleteTarget.id)
      setDeleteTarget(null)
      load()
    } finally {
      setDeleting(false)
    }
  }

  const stateCount = universities.filter(u => u.type === 'government').length
  const privateCount = universities.filter(u => u.type === 'private').length
  const scores = universities.map(u => u.min_score).filter((s): s is number => s != null)
  const avgMinScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0

  return (
    <div className="min-h-screen bg-[#FAF8FF]">
      <AdminTopbar title="Университеты" actionLabel="Добавить университет" actionIcon={Plus} onAction={() => setFormTarget({})} />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-5">

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4 text-center">
            <div className="text-xl font-extrabold text-[#191B23]">{universities.length}</div>
            <div className="text-xs text-gray-400">Всего университетов</div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 text-center">
            <div className="text-xl font-extrabold text-blue-600">{stateCount}</div>
            <div className="text-xs text-gray-400">Государственных</div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 text-center">
            <div className="text-xl font-extrabold text-purple-600">{privateCount}</div>
            <div className="text-xs text-gray-400">Частных</div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 text-center">
            <div className="text-xl font-extrabold text-[#191B23]">{avgMinScore}</div>
            <div className="text-xs text-gray-400">Средний проходной балл</div>
          </div>
        </div>

        {loading ? (
          <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-400">Загрузка...</div>
        ) : loadError ? (
          <div className="rounded-xl border border-red-100 bg-white p-8 text-center">
            <p className="text-sm font-semibold text-red-600">{loadError}</p>
            <button type="button" onClick={load} className="mt-4 min-h-11 rounded-xl bg-[#1B4FD8] px-5 text-sm font-bold text-white">Повторить</button>
          </div>
        ) : universities.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-400">Университетов пока нет</div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  <th className="px-4 py-3">Университет</th>
                  <th className="px-4 py-3">Город</th>
                  <th className="px-4 py-3">Тип</th>
                  <th className="px-4 py-3">Мин. балл</th>
                  <th className="px-4 py-3">Стоимость</th>
                  <th className="px-4 py-3">Специальностей</th>
                  <th className="px-4 py-3">Рейтинг</th>
                  <th className="px-4 py-3">Активен</th>
                  <th className="px-4 py-3">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {universities.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50/60">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        {u.logo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element -- admin-entered external logo URL, no next/image domain config
                          <img src={u.logo_url} alt={u.name} className="h-8 w-8 shrink-0 rounded-lg object-cover" />
                        ) : (
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-50 text-gray-500">
                            {u.type === 'government' ? <School size={17} aria-hidden="true" /> : <Building2 size={17} aria-hidden="true" />}
                          </span>
                        )}
                        <span className="font-semibold text-[#191B23]">{u.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{u.city}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${u.type === 'government' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'}`}>
                        {u.type === 'government' ? 'Государственный' : 'Частный'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-bold text-gray-700">{u.min_score ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{formatCost(u.tuition_min, u.tuition_max)}</td>
                    <td className="px-4 py-3 text-gray-500">
                      <div className="flex items-center gap-2">
                        {u.total_specialties ?? '—'}
                        <Link href={`/admin/universities/${u.id}/specialties`} aria-label="Специальности" className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-[#1B4FD8]">
                          <ListChecks size={14} />
                        </Link>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {u.rating != null ? (
                        <span className="flex items-center gap-0.5 text-xs font-semibold text-amber-500">
                          <Star size={12} fill="#F59E0B" strokeWidth={0} /> {u.rating.toFixed(1)}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <button type="button" onClick={() => handleToggleActive(u)}
                        className={`relative h-5 w-9 rounded-full transition-colors ${u.is_active ? 'bg-[#1B4FD8]' : 'bg-gray-200'}`}
                        aria-label="Переключить активность">
                        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${u.is_active ? 'translate-x-4' : 'translate-x-0.5'}`} />
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => setFormTarget({ university: u })} aria-label="Редактировать" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-[#1B4FD8]">
                          <Pencil size={15} />
                        </button>
                        <button onClick={() => setDeleteTarget(u)} aria-label="Удалить" className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {formTarget && (
        <UniversityFormModal
          university={formTarget.university}
          onClose={() => setFormTarget(null)}
          onSaved={load}
        />
      )}
      {deleteTarget && (
        <DeleteConfirmModal
          title="Удаление университета"
          message={`Удалить "${deleteTarget.name}"? Все его специальности и преимущества также будут удалены. Это действие необратимо.`}
          loading={deleting}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
