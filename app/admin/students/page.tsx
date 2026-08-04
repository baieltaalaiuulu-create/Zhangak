'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Search } from 'lucide-react'
import AdminTopbar from '@/components/admin/AdminTopbar'
import DeleteConfirmModal from '@/components/admin/DeleteConfirmModal'
import StudentFormModal from '@/components/admin/students/StudentFormModal'
import AddPaymentModal from '@/components/admin/students/AddPaymentModal'
import PaymentHistoryModal from '@/components/admin/students/PaymentHistoryModal'
import StudentActionsMenu from '@/components/admin/students/StudentActionsMenu'
import {
  fetchStudents, fetchCourseOptions, fetchGroupOptions, setStudentBlocked, deleteStudent,
  type AdminStudent, type CourseOption, type GroupOption,
} from '@/lib/admin-data'

const PAYMENT_STATUS_LABELS: Record<AdminStudent['paymentStatus'], string> = {
  paid: 'Төлөдү', partial: 'Жарым', debt: 'Карыз',
}
const PAYMENT_STATUS_COLORS: Record<AdminStudent['paymentStatus'], string> = {
  paid: '#10B981', partial: '#F59E0B', debt: '#EF4444',
}

export default function AdminStudentsPage() {
  const [students, setStudents] = useState<AdminStudent[]>([])
  const [courses, setCourses] = useState<CourseOption[]>([])
  const [groups, setGroups] = useState<GroupOption[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [courseFilter, setCourseFilter] = useState('')
  const [groupFilter, setGroupFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const [formModal, setFormModal] = useState<{ mode: 'create' | 'edit'; student?: AdminStudent } | null>(null)
  const [paymentModal, setPaymentModal] = useState<AdminStudent | null>(null)
  const [historyModal, setHistoryModal] = useState<AdminStudent | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AdminStudent | null>(null)
  const [deleting, setDeleting] = useState(false)

  const router = useRouter()

  const load = async () => {
    const [s, c, g] = await Promise.all([fetchStudents(), fetchCourseOptions(), fetchGroupOptions()])
    setStudents(s)
    setCourses(c)
    setGroups(g)
    setLoading(false)
  }

  useEffect(() => {
    const init = async () => {
      const [s, c, g] = await Promise.all([fetchStudents(), fetchCourseOptions(), fetchGroupOptions()])
      setStudents(s)
      setCourses(c)
      setGroups(g)
      setLoading(false)
    }
    init()
  }, [])

  const stats = useMemo(() => ({
    total: students.length,
    paid: students.filter(s => s.paymentStatus === 'paid').length,
    partial: students.filter(s => s.paymentStatus === 'partial').length,
    overdue: students.filter(s => s.paymentStatus === 'debt').length,
  }), [students])

  const filtered = useMemo(() => students.filter(s => {
    if (search && !s.full_name.toLowerCase().includes(search.toLowerCase()) && !(s.email ?? '').toLowerCase().includes(search.toLowerCase())) return false
    if (courseFilter && s.courseName !== courseFilter) return false
    if (groupFilter && s.groupName !== groupFilter) return false
    if (statusFilter && s.paymentStatus !== statusFilter) return false
    return true
  }), [students, search, courseFilter, groupFilter, statusFilter])

  const toggleSelected = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }
  const toggleSelectAll = () => {
    setSelected(prev => prev.size === filtered.length ? new Set() : new Set(filtered.map(s => s.id)))
  }

  const handleToggleBlock = async (s: AdminStudent) => {
    await setStudentBlocked(s.id, !s.blocked)
    load()
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteStudent(deleteTarget.id)
      setDeleteTarget(null)
      load()
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#FAF8FF]">
      <AdminTopbar title="Ученики" actionLabel="Добавить ученика" actionIcon={Plus} onAction={() => setFormModal({ mode: 'create' })} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Бардыгы', value: stats.total, color: '#1B4FD8' },
            { label: 'Төлөдү', value: stats.paid, color: '#10B981' },
            { label: 'Жарым', value: stats.partial, color: '#F59E0B' },
            { label: 'Карыз', value: stats.overdue, color: '#EF4444' },
          ].map(c => (
            <div key={c.label} className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="text-2xl font-extrabold" style={{ color: c.color }}>{c.value}</div>
              <div className="mt-1 text-xs font-semibold text-gray-500">{c.label}</div>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Издөө: аты же email"
              className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-[#1B4FD8]/20" />
          </div>
          <select value={courseFilter} onChange={e => setCourseFilter(e.target.value)}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1B4FD8]/20">
            <option value="">Бардык курстар</option>
            {courses.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
          <select value={groupFilter} onChange={e => setGroupFilter(e.target.value)}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1B4FD8]/20">
            <option value="">Бардык группалар</option>
            {groups.map(g => <option key={g.id} value={g.name}>{g.name}</option>)}
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1B4FD8]/20">
            <option value="">Бардык статустар</option>
            <option value="paid">Төлөдү</option>
            <option value="partial">Жарым</option>
            <option value="debt">Карыз</option>
          </select>
        </div>

        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full min-w-[1000px] text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="w-10 px-4 py-3"><input type="checkbox" checked={selected.size > 0 && selected.size === filtered.length} onChange={toggleSelectAll} /></th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Окуучу</th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Телефон</th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Группа</th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Курс</th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Баасы</th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Төлөдү</th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Карыз</th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Кийинки төлөм</th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Төлөм</th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Статус</th>
                <th className="w-10 px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={12} className="px-4 py-10 text-center text-gray-400">Жүктөлүүдө...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={12} className="px-4 py-10 text-center text-gray-400">Окуучулар табылган жок</td></tr>
              ) : filtered.map((s, i) => (
                <tr key={s.id} className={`border-b border-gray-100 last:border-0 hover:bg-gray-50 ${i % 2 === 1 ? 'bg-gray-50/40' : ''}`}>
                  <td className="px-4 py-3"><input type="checkbox" checked={selected.has(s.id)} onChange={() => toggleSelected(s.id)} /></td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1B4FD8] text-xs font-bold text-white">
                        {s.full_name.slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-[#191B23]">{s.full_name}</div>
                        <div className="truncate text-xs text-gray-400">{s.email ?? '—'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-gray-500">{s.phone || '—'}</td>
                  <td className="px-3 py-3 text-gray-500">{s.groupName ?? '—'}</td>
                  <td className="px-3 py-3 text-gray-500">{s.courseName ?? '—'}</td>
                  <td className="px-3 py-3 text-gray-400">—</td>
                  <td className="px-3 py-3 font-semibold text-[#191B23]">{s.paidThisMonth ? `${s.paidThisMonth.toLocaleString()} сом` : '—'}</td>
                  <td className="px-3 py-3 text-gray-400">—</td>
                  <td className="px-3 py-3 text-gray-400">—</td>
                  <td className="px-3 py-3">
                    <span className="rounded-full px-2.5 py-1 text-xs font-bold" style={{ background: `${PAYMENT_STATUS_COLORS[s.paymentStatus]}1A`, color: PAYMENT_STATUS_COLORS[s.paymentStatus] }}>
                      {PAYMENT_STATUS_LABELS[s.paymentStatus]}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${s.blocked ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-600'}`}>
                      {s.blocked ? 'Бөгөттөлгөн' : 'Активдүү'}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <StudentActionsMenu
                      blocked={s.blocked}
                      onViewProfile={() => router.push(`/admin/students/${s.id}`)}
                      onEdit={() => setFormModal({ mode: 'edit', student: s })}
                      onAddPayment={() => setPaymentModal(s)}
                      onPaymentHistory={() => setHistoryModal(s)}
                      onToggleBlock={() => handleToggleBlock(s)}
                      onDelete={() => setDeleteTarget(s)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {formModal && (
        <StudentFormModal
          mode={formModal.mode}
          student={formModal.student}
          courses={courses}
          groups={groups}
          onClose={() => setFormModal(null)}
          onSaved={load}
        />
      )}
      {paymentModal && <AddPaymentModal student={paymentModal} onClose={() => setPaymentModal(null)} onSaved={load} />}
      {historyModal && <PaymentHistoryModal student={historyModal} onClose={() => setHistoryModal(null)} />}
      {deleteTarget && (
        <DeleteConfirmModal
          title="Окуучуну өчүрүү"
          message={`"${deleteTarget.full_name}" аккаунтун өчүрөсүзбү? Бул аракетти артка кайтаруу мүмкүн эмес.`}
          loading={deleting}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
