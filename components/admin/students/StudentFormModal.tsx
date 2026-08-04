'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { MIN_TARGET_SCORE, MAX_TARGET_SCORE, DEFAULT_TARGET_SCORE } from '@/lib/student-data'
import {
  createStudent, STUDENT_TYPES,
  type AdminStudent, type CourseOption, type GroupOption,
} from '@/lib/admin-data'

interface Props {
  mode: 'create' | 'edit'
  student?: AdminStudent
  courses: CourseOption[]
  groups: GroupOption[]
  onClose: () => void
  onSaved: () => void
}

export default function StudentFormModal({ mode, student, courses, groups, onClose, onSaved }: Props) {
  const [fullName, setFullName] = useState(student?.full_name ?? '')
  const [phone, setPhone] = useState(student?.phone ?? '')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [studentType, setStudentType] = useState(student?.student_type ?? 'offline')
  const [targetScore, setTargetScore] = useState(student?.target_score ?? DEFAULT_TARGET_SCORE)
  const [courseId, setCourseId] = useState<number | ''>('')
  const [groupId, setGroupId] = useState<number | ''>('')
  const [price, setPrice] = useState('')
  const [paidAmount, setPaidAmount] = useState('')
  const [nextPaymentDate, setNextPaymentDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const filteredGroups = courseId === '' ? groups : groups.filter(g => g.course_id === courseId)

  const handleSubmit = async () => {
    setError('')
    if (!fullName.trim()) { setError('Аты-жөнүн киргизиңиз'); return }
    if (mode === 'create' && (!email.trim() || !password.trim())) { setError('Email жана сырсөздү киргизиңиз'); return }
    if (mode === 'create' && password.length < 6) { setError('Сырсөз кеминде 6 символ болушу керек'); return }
    if (targetScore < MIN_TARGET_SCORE || targetScore > MAX_TARGET_SCORE) { setError(`Максат балл ${MIN_TARGET_SCORE}–${MAX_TARGET_SCORE} аралыгында болушу керек`); return }

    setSaving(true)
    try {
      if (mode === 'create') {
        await createStudent({
          full_name: fullName.trim(),
          phone: phone.trim(),
          email: email.trim(),
          password,
          student_type: studentType,
          target_score: targetScore,
          group_id: groupId === '' ? null : groupId,
          initial_paid_amount: Number(paidAmount) || 0,
        })
      } else if (student) {
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ full_name: fullName.trim(), phone: phone.trim(), student_type: studentType, target_score: targetScore })
          .eq('id', student.id)
        if (updateError) throw new Error(updateError.message)

        if (groupId !== '') {
          await supabase.from('group_students').delete().eq('student_id', student.id)
          await supabase.from('group_students').insert({ student_id: student.id, group_id: groupId })
        }
      }
      onSaved()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ката кетти')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#191B23]">{mode === 'create' ? 'Жаңы окуучу' : 'Окуучуну түзөтүү'}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-50"><X size={18} /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-500">Аты-жөнү *</label>
            <input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Иванов Айбек"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1B4FD8]/20" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-500">Телефон</label>
              <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+996 700 000 000"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1B4FD8]/20" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-500">Максат балл</label>
              <input type="number" min={MIN_TARGET_SCORE} max={MAX_TARGET_SCORE} value={targetScore}
                onChange={e => setTargetScore(Number(e.target.value))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1B4FD8]/20" />
            </div>
          </div>

          {mode === 'create' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-500">Email *</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="user@gmail.com"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1B4FD8]/20" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-500">Сырсөз *</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Мин. 6 символ"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1B4FD8]/20" />
              </div>
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-500">Түрү</label>
            <div className="flex gap-2">
              {STUDENT_TYPES.map(t => (
                <button key={t.value} type="button" onClick={() => setStudentType(t.value)}
                  className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors ${studentType === t.value ? 'border-[#1B4FD8] bg-[#EEF2FF] text-[#1B4FD8]' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-500">Курс</label>
              <select value={courseId} onChange={e => { setCourseId(e.target.value === '' ? '' : Number(e.target.value)); setGroupId('') }}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1B4FD8]/20">
                <option value="">Тандаңыз</option>
                {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-500">Группа</label>
              <select value={groupId} onChange={e => setGroupId(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1B4FD8]/20">
                <option value="">Тандаңыз</option>
                {filteredGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
          </div>

          {mode === 'create' && (
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-500">Айлык баа</label>
                <input type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="5000"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1B4FD8]/20" />
                <p className="mt-1 text-[10px] text-gray-400">Азырынча сакталбайт</p>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-500">Баштапкы төлөм</label>
                <input type="number" value={paidAmount} onChange={e => setPaidAmount(e.target.value)} placeholder="0"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1B4FD8]/20" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-500">Кийинки төлөм</label>
                <input type="date" value={nextPaymentDate} onChange={e => setNextPaymentDate(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1B4FD8]/20" />
                <p className="mt-1 text-[10px] text-gray-400">Азырынча сакталбайт</p>
              </div>
            </div>
          )}

          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">{error}</div>}

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={handleSubmit} disabled={saving}
              className="rounded-xl bg-[#1B4FD8] px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:opacity-60">
              {saving ? 'Сакталууда...' : mode === 'create' ? 'Кошуу' : 'Сактоо'}
            </button>
            <button type="button" onClick={onClose}
              className="rounded-xl bg-gray-100 px-5 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-200">
              Жокко чыгаруу
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
