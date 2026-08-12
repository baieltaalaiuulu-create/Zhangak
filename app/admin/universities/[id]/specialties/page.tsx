'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Plus, Pencil, Trash2 } from 'lucide-react'
import AdminTopbar from '@/components/admin/AdminTopbar'
import DeleteConfirmModal from '@/components/admin/DeleteConfirmModal'
import SpecialtyFormModal from '@/components/admin/universities/SpecialtyFormModal'
import {
  fetchAdminUniversityById, fetchAdminSpecialties, deleteSpecialty,
  type AdminUniversity, type AdminSpecialty,
} from '@/lib/admin-universities-data'

function formatCost(cost: number | null): string {
  return cost == null ? 'Бесплатно' : `${cost.toLocaleString('ru')} сом`
}

export default function AdminUniversitySpecialtiesPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [university, setUniversity] = useState<AdminUniversity | null>(null)
  const [specialties, setSpecialties] = useState<AdminSpecialty[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [formTarget, setFormTarget] = useState<{ specialty?: AdminSpecialty } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AdminSpecialty | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = async () => {
    setLoadError(null)
    try {
      const [uni, specs] = await Promise.all([
        fetchAdminUniversityById(params.id),
        fetchAdminSpecialties(params.id),
      ])
      if (!uni) { router.push('/admin/universities'); return }
      setUniversity(uni)
      setSpecialties(specs)
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Не удалось загрузить специальности')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    const init = async () => {
      try {
        const [uni, specs] = await Promise.all([
          fetchAdminUniversityById(params.id),
          fetchAdminSpecialties(params.id),
        ])
        if (cancelled) return
        if (!uni) { router.push('/admin/universities'); return }
        setUniversity(uni)
        setSpecialties(specs)
      } catch (error) {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : 'Не удалось загрузить специальности')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void init()
    return () => { cancelled = true }
  }, [params.id, router])

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteSpecialty(deleteTarget.id)
      setDeleteTarget(null)
      load()
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#FAF8FF]">
      <AdminTopbar
        title={university ? `Специальности — ${university.name}` : 'Специальности'}
        actionLabel="Добавить специальность"
        actionIcon={Plus}
        onAction={() => setFormTarget({})}
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        <Link href="/admin/universities" className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-[#1B4FD8]">
          <ArrowLeft size={15} /> Назад к университетам
        </Link>

        {loading ? (
          <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-400">Загрузка...</div>
        ) : loadError ? (
          <div className="rounded-xl border border-red-100 bg-white p-8 text-center">
            <p className="text-sm font-semibold text-red-600">{loadError}</p>
            <button type="button" onClick={load} className="mt-4 min-h-11 rounded-xl bg-[#1B4FD8] px-5 text-sm font-bold text-white">Повторить</button>
          </div>
        ) : specialties.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-400">Специальностей пока нет</div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  <th className="px-4 py-3">Название</th>
                  <th className="px-4 py-3">Факультет</th>
                  <th className="px-4 py-3">Мин. балл</th>
                  <th className="px-4 py-3">Стоимость</th>
                  <th className="px-4 py-3">Язык</th>
                  <th className="px-4 py-3">Форма</th>
                  <th className="px-4 py-3">Тип</th>
                  <th className="px-4 py-3">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {specialties.map(s => (
                  <tr key={s.id} className="hover:bg-gray-50/60">
                    <td className="px-4 py-3 font-semibold text-[#191B23]">{s.name}</td>
                    <td className="px-4 py-3 text-gray-500">{s.faculty ?? '—'}</td>
                    <td className="px-4 py-3 font-bold text-gray-700">{s.min_score ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{formatCost(s.tuition)}</td>
                    <td className="px-4 py-3 text-gray-500">{s.language ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{s.form}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${s.type === 'Бюджет' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        {s.type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => setFormTarget({ specialty: s })} aria-label="Редактировать" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-[#1B4FD8]">
                          <Pencil size={15} />
                        </button>
                        <button onClick={() => setDeleteTarget(s)} aria-label="Удалить" className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500">
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

      {formTarget && university && (
        <SpecialtyFormModal
          universityId={university.id}
          specialty={formTarget.specialty}
          onClose={() => setFormTarget(null)}
          onSaved={load}
        />
      )}
      {deleteTarget && (
        <DeleteConfirmModal
          title="Удаление специальности"
          message={`Удалить специальность "${deleteTarget.name}"? Это действие необратимо.`}
          loading={deleting}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
