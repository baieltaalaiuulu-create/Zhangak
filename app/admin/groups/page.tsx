'use client'

export const dynamic = 'force-dynamic'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  BookOpen,
  CheckCircle2,
  Circle,
  GraduationCap,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  UserMinus,
  UserPlus,
  Users,
  X,
} from 'lucide-react'

import AdminTopbar from '@/components/admin/AdminTopbar'
import {
  addAdminGroupStudent,
  createAdminGroup,
  listAdminGroupAssignees,
  listAdminGroupMembers,
  listAdminGroups,
  removeAdminGroupStudent,
  setAdminGroupTeacher,
  updateAdminGroup,
  type AdminGroup,
  type AdminGroupAssignee,
  type AdminGroupDeliveryMode,
  type AdminGroupMember,
} from '@/lib/admin-groups-client'
import { listAdminCourses, type AdminCourse } from '@/lib/admin-learning-client'

const MODE_LABELS: Record<AdminGroupDeliveryMode, string> = {
  online: 'Онлайн',
  offline: 'Оффлайн',
  hybrid: 'Гибрид',
}

function errorMessage(cause: unknown, fallback: string): string {
  return cause instanceof Error && cause.message ? cause.message : fallback
}

function courseMeta(course: AdminCourse): string {
  return [course.subject, course.level].filter((value): value is string => Boolean(value)).join(' · ') || 'Параметры не указаны'
}

function studentTypeLabel(value: AdminGroupMember['studentType']): string {
  return value === 'both' ? 'Онлайн и оффлайн' : MODE_LABELS[value]
}

function dateValue(value: string | null): string {
  return value ?? ''
}

function formatDate(value: string | null): string {
  if (!value) return '—'
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

function modeForStudent(group: AdminGroup, student: AdminGroupAssignee): boolean {
  if (!student.studentType) return false
  if (group.deliveryMode === 'hybrid') return student.studentType === 'both'
  return student.studentType === group.deliveryMode || student.studentType === 'both'
}

function ModalFrame({ title, children, onClose, closeDisabled = false }: {
  title: string
  children: ReactNode
  onClose: () => void
  closeDisabled?: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-3 sm:p-5" onClick={closeDisabled ? undefined : onClose}>
      <section className="max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl sm:p-7" onClick={event => event.stopPropagation()} aria-labelledby="group-modal-title">
        <div className="flex items-start justify-between gap-4">
          <h2 id="group-modal-title" className="text-lg font-black text-[#191B23]">{title}</h2>
          <button type="button" onClick={onClose} disabled={closeDisabled} aria-label="Закрыть" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 disabled:opacity-50"><X size={19} aria-hidden="true" /></button>
        </div>
        {children}
      </section>
    </div>
  )
}

type GroupFormProps = {
  courses: readonly AdminCourse[]
  group: AdminGroup | null
  onClose: () => void
  onSaved: (group: AdminGroup) => void
}

function GroupFormModal({ courses, group, onClose, onSaved }: GroupFormProps) {
  const editing = group !== null
  const [courseId, setCourseId] = useState(group?.course.id ? String(group.course.id) : '')
  const [name, setName] = useState(group?.name ?? '')
  const [deliveryMode, setDeliveryMode] = useState<AdminGroupDeliveryMode>(group?.deliveryMode ?? 'offline')
  const [capacity, setCapacity] = useState(group?.capacity === null || !group ? '' : String(group.capacity))
  const [startsOn, setStartsOn] = useState(dateValue(group?.startsOn ?? null))
  const [endsOn, setEndsOn] = useState(dateValue(group?.endsOn ?? null))
  const [isActive, setIsActive] = useState(group?.isActive ?? true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    setError('')
    try {
      if (!name.trim()) throw new Error('Введите название группы')
      const capacityValue = capacity.trim() === '' ? null : Number(capacity)
      if (capacityValue !== null && (!Number.isSafeInteger(capacityValue) || capacityValue < 1 || capacityValue > 5_000)) {
        throw new Error('Вместимость должна быть от 1 до 5000')
      }
      if (startsOn && endsOn && endsOn < startsOn) throw new Error('Дата окончания не может быть раньше даты начала')
      setSaving(true)
      const input = {
        name: name.trim(),
        deliveryMode,
        capacity: capacityValue,
        startsOn: startsOn || null,
        endsOn: endsOn || null,
        isActive,
      }
      if (editing) {
        onSaved(await updateAdminGroup(group.id, input))
      } else {
        const parsedCourseId = Number(courseId)
        if (!Number.isSafeInteger(parsedCourseId) || parsedCourseId < 1) throw new Error('Выберите активный курс')
        onSaved(await createAdminGroup({ ...input, courseId: parsedCourseId }))
      }
    } catch (cause) {
      setError(errorMessage(cause, 'Не удалось сохранить группу'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalFrame title={editing ? 'Настроить группу' : 'Новая группа'} onClose={onClose} closeDisabled={saving}>
      <div className="mt-6 space-y-4">
        <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-600">Курс *</span><select value={courseId} disabled={editing || saving} onChange={event => setCourseId(event.target.value)} className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:border-[#1B3F92] focus:ring-2 focus:ring-[#1B3F92]/15 disabled:bg-slate-50"><option value="">Выберите активный курс</option>{courses.filter(course => course.isActive || course.id === group?.course.id).map(course => <option key={course.id} value={course.id}>{course.name} · {courseMeta(course)}</option>)}</select>{editing && <p className="mt-1.5 text-xs leading-5 text-slate-400">Курс нельзя менять после создания: это сохраняет учебный контекст назначений.</p>}</label>
        <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-600">Название *</span><input value={name} onChange={event => setName(event.target.value)} maxLength={160} placeholder="Например, ОРТ-11 / вечер" className="min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-[#1B3F92] focus:ring-2 focus:ring-[#1B3F92]/15" /></label>
        <div className="grid gap-4 sm:grid-cols-2"><label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-600">Формат</span><select value={deliveryMode} onChange={event => setDeliveryMode(event.target.value as AdminGroupDeliveryMode)} disabled={saving} className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#1B3F92] focus:ring-2 focus:ring-[#1B3F92]/15">{(Object.keys(MODE_LABELS) as AdminGroupDeliveryMode[]).map(mode => <option key={mode} value={mode}>{MODE_LABELS[mode]}</option>)}</select></label><label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-600">Вместимость</span><input type="number" value={capacity} onChange={event => setCapacity(event.target.value)} min={1} max={5_000} placeholder="Без лимита" disabled={saving} className="min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-[#1B3F92] focus:ring-2 focus:ring-[#1B3F92]/15" /></label></div>
        <div className="grid gap-4 sm:grid-cols-2"><label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-600">Начало</span><input type="date" value={startsOn} onChange={event => setStartsOn(event.target.value)} disabled={saving} className="min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-[#1B3F92] focus:ring-2 focus:ring-[#1B3F92]/15" /></label><label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-600">Окончание</span><input type="date" value={endsOn} onChange={event => setEndsOn(event.target.value)} disabled={saving} className="min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-[#1B3F92] focus:ring-2 focus:ring-[#1B3F92]/15" /></label></div>
        <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700"><input type="checkbox" checked={isActive} onChange={event => setIsActive(event.target.checked)} disabled={saving} className="mt-0.5" /><span><span className="block">Активная группа</span><span className="mt-1 block text-xs font-medium leading-5 text-slate-500">В неактивную группу нельзя добавлять учеников, но история назначений сохраняется.</span></span></label>
        {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-semibold text-red-700">{error}</p>}
      </div>
      <div className="mt-6 flex flex-wrap gap-3"><button type="button" onClick={() => void submit()} disabled={saving} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#1B3F92] px-5 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"><CheckCircle2 size={17} aria-hidden="true" />{saving ? 'Сохраняем…' : editing ? 'Сохранить' : 'Создать группу'}</button><button type="button" onClick={onClose} disabled={saving} className="min-h-11 rounded-xl bg-slate-100 px-5 text-sm font-bold text-slate-600 hover:bg-slate-200 disabled:opacity-60">Отмена</button></div>
    </ModalFrame>
  )
}

function TeacherAssignmentModal({ group, teachers, onClose, onSaved }: {
  group: AdminGroup
  teachers: readonly AdminGroupAssignee[]
  onClose: () => void
  onSaved: (group: AdminGroup) => void
}) {
  const [teacherId, setTeacherId] = useState(group.teacher?.id ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const submit = async () => {
    setError('')
    setSaving(true)
    try { onSaved(await setAdminGroupTeacher(group.id, teacherId || null)) }
    catch (cause) { setError(errorMessage(cause, 'Не удалось назначить преподавателя')) }
    finally { setSaving(false) }
  }
  return (
    <ModalFrame title="Преподаватель группы" onClose={onClose} closeDisabled={saving}>
      <p className="mt-3 text-sm leading-6 text-slate-500">{group.name} · {group.course.name}</p>
      <label className="mt-5 block"><span className="mb-1.5 block text-xs font-bold text-slate-600">Преподаватель</span><select value={teacherId} onChange={event => setTeacherId(event.target.value)} disabled={saving} className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#1B3F92] focus:ring-2 focus:ring-[#1B3F92]/15"><option value="">Не назначен</option>{teachers.map(teacher => <option key={teacher.id} value={teacher.id}>{teacher.fullName} · {teacher.email}</option>)}</select></label>
      {teachers.length === 0 && <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm font-semibold text-amber-900">Активных преподавателей пока нет. Создайте учётную запись с ролью «Преподаватель» в разделе «Ученики».</p>}
      {error && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-semibold text-red-700">{error}</p>}
      <div className="mt-6 flex flex-wrap gap-3"><button type="button" onClick={() => void submit()} disabled={saving} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#1B3F92] px-5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60"><GraduationCap size={17} aria-hidden="true" />{saving ? 'Сохраняем…' : 'Сохранить'}</button><button type="button" onClick={onClose} disabled={saving} className="min-h-11 rounded-xl bg-slate-100 px-5 text-sm font-bold text-slate-600 hover:bg-slate-200">Отмена</button></div>
    </ModalFrame>
  )
}

function StudentAssignmentModal({ group, students, existingIds, onClose, onAdded }: {
  group: AdminGroup
  students: readonly AdminGroupAssignee[]
  existingIds: ReadonlySet<string>
  onClose: () => void
  onAdded: () => void
}) {
  const [studentId, setStudentId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const eligible = students.filter(student => !existingIds.has(student.id) && modeForStudent(group, student))
  const submit = async () => {
    setError('')
    if (!studentId) { setError('Выберите ученика'); return }
    setSaving(true)
    try { await addAdminGroupStudent(group.id, studentId); onAdded() }
    catch (cause) { setError(errorMessage(cause, 'Не удалось добавить ученика')) }
    finally { setSaving(false) }
  }
  return (
    <ModalFrame title="Добавить ученика" onClose={onClose} closeDisabled={saving}>
      <p className="mt-3 text-sm leading-6 text-slate-500">В группу «{group.name}» можно добавить только активного ученика, совместимого с форматом «{MODE_LABELS[group.deliveryMode]}».</p>
      <label className="mt-5 block"><span className="mb-1.5 block text-xs font-bold text-slate-600">Ученик</span><select value={studentId} onChange={event => setStudentId(event.target.value)} disabled={saving || eligible.length === 0} className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#1B3F92] focus:ring-2 focus:ring-[#1B3F92]/15"><option value="">Выберите ученика</option>{eligible.map(student => <option key={student.id} value={student.id}>{student.fullName} · {student.email} · {studentTypeLabel(student.studentType!)}</option>)}</select></label>
      {eligible.length === 0 && <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm font-semibold text-amber-900">Нет подходящих активных учеников. Проверьте формат группы и тип обучения в учётной записи.</p>}
      {error && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-semibold text-red-700">{error}</p>}
      <div className="mt-6 flex flex-wrap gap-3"><button type="button" onClick={() => void submit()} disabled={saving || eligible.length === 0} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#1B3F92] px-5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60"><UserPlus size={17} aria-hidden="true" />{saving ? 'Добавляем…' : 'Добавить'}</button><button type="button" onClick={onClose} disabled={saving} className="min-h-11 rounded-xl bg-slate-100 px-5 text-sm font-bold text-slate-600 hover:bg-slate-200">Отмена</button></div>
    </ModalFrame>
  )
}

export default function AdminGroupsPage() {
  const [courses, setCourses] = useState<AdminCourse[]>([])
  const [groups, setGroups] = useState<AdminGroup[]>([])
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null)
  const [members, setMembers] = useState<AdminGroupMember[]>([])
  const [teachers, setTeachers] = useState<AdminGroupAssignee[]>([])
  const [students, setStudents] = useState<AdminGroupAssignee[]>([])
  const [loading, setLoading] = useState(true)
  const [membersLoading, setMembersLoading] = useState(false)
  const [error, setError] = useState('')
  const [memberError, setMemberError] = useState('')
  const [formTarget, setFormTarget] = useState<AdminGroup | 'create' | null>(null)
  const [teacherTarget, setTeacherTarget] = useState<AdminGroup | null>(null)
  const [studentTarget, setStudentTarget] = useState<AdminGroup | null>(null)
  const [removingStudentId, setRemovingStudentId] = useState<string | null>(null)
  const membersRequest = useRef(0)

  const selectedGroup = useMemo(() => groups.find(group => group.id === selectedGroupId) ?? null, [groups, selectedGroupId])

  const loadBase = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [courseResult, groupResult, teacherResult, studentResult] = await Promise.all([
        listAdminCourses({ limit: 100 }),
        listAdminGroups({ limit: 100 }),
        listAdminGroupAssignees('teacher', { limit: 100 }),
        listAdminGroupAssignees('student', { limit: 100 }),
      ])
      setCourses(courseResult.items)
      setGroups(groupResult.items)
      setTeachers(teacherResult.items)
      setStudents(studentResult.items)
      setSelectedGroupId(current => groupResult.items.some(group => group.id === current) ? current : groupResult.items[0]?.id ?? null)
    } catch (cause) {
      setError(errorMessage(cause, 'Не удалось загрузить группы. Повторите попытку.'))
    } finally {
      setLoading(false)
    }
  }, [])

  const loadMembers = useCallback(async (groupId: number) => {
    const requestId = membersRequest.current + 1
    membersRequest.current = requestId
    setMembersLoading(true)
    setMemberError('')
    try {
      const result = await listAdminGroupMembers(groupId, { limit: 100 })
      if (membersRequest.current !== requestId) return
      setMembers(result.items)
      setGroups(current => current.map(group => group.id === result.group.id ? result.group : group))
    } catch (cause) {
      if (membersRequest.current === requestId) {
        setMembers([])
        setMemberError(errorMessage(cause, 'Не удалось загрузить состав группы.'))
      }
    } finally {
      if (membersRequest.current === requestId) setMembersLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadBase() }, 0)
    return () => window.clearTimeout(timer)
  }, [loadBase])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (selectedGroupId === null) {
        membersRequest.current += 1
        setMembers([])
        setMemberError('')
        setMembersLoading(false)
        return
      }
      void loadMembers(selectedGroupId)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [loadMembers, selectedGroupId])

  const saveGroup = (saved: AdminGroup) => {
    setFormTarget(null)
    setGroups(current => current.some(group => group.id === saved.id)
      ? current.map(group => group.id === saved.id ? saved : group)
      : [saved, ...current])
    setSelectedGroupId(saved.id)
  }

  const saveTeacher = (saved: AdminGroup) => {
    setTeacherTarget(null)
    setGroups(current => current.map(group => group.id === saved.id ? saved : group))
  }

  const onStudentAdded = () => {
    setStudentTarget(null)
    if (selectedGroupId !== null) void loadMembers(selectedGroupId)
  }

  const removeStudent = async (student: AdminGroupMember) => {
    if (!selectedGroup) return
    setRemovingStudentId(student.id)
    setMemberError('')
    try {
      await removeAdminGroupStudent(selectedGroup.id, student.id)
      await loadMembers(selectedGroup.id)
    } catch (cause) {
      setMemberError(errorMessage(cause, 'Не удалось убрать ученика из группы.'))
    } finally {
      setRemovingStudentId(null)
    }
  }

  const activeGroups = groups.filter(group => group.isActive).length
  const existingIds = useMemo(() => new Set(members.map(member => member.id)), [members])

  return (
    <div className="min-h-screen bg-[#FAF8FF]">
      <AdminTopbar title="Учебные группы" actionLabel="Новая группа" actionIcon={Plus} onAction={() => setFormTarget('create')} />
      <main className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6">
        <section className="rounded-2xl border border-blue-100 bg-blue-50/80 p-4 sm:flex sm:items-center sm:justify-between sm:gap-5"><div className="flex gap-3"><span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#1B3F92] shadow-sm"><Users size={20} aria-hidden="true" /></span><div><h1 className="text-sm font-black text-[#0D1E4A]">Группы работают через собственный backend Zhangak</h1><p className="mt-1 max-w-3xl text-sm leading-5 text-slate-600">Создайте группу внутри курса, назначьте преподавателя и добавьте учеников. История исключения сохраняется, а формат обучения проверяется на сервере.</p></div></div><button type="button" onClick={() => setFormTarget('create')} className="mt-3 inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl bg-[#1B3F92] px-4 text-sm font-bold text-white hover:bg-blue-700 sm:mt-0"><Plus size={16} aria-hidden="true" />Новая группа</button></section>

        {error && <section role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700"><span>{error}</span><button type="button" onClick={() => void loadBase()} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-white px-3 text-xs font-bold text-red-700 hover:bg-red-100"><RefreshCw size={14} aria-hidden="true" />Повторить</button></section>}

        <section aria-labelledby="groups-heading"><div className="mb-3 flex items-center justify-between gap-3"><div><h2 id="groups-heading" className="text-base font-bold text-[#191B23]">Все группы</h2><p className="mt-0.5 text-sm text-slate-400">Выберите группу, чтобы управлять её составом.</p></div>{!loading && <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-slate-600">{activeGroups} активных / {groups.length}</span>}</div>
          {loading ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 3 }).map((_, index) => <div key={index} className="h-36 animate-pulse rounded-2xl border border-slate-200 bg-white" />)}</div> : groups.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-10 text-center"><Users size={24} className="mx-auto text-[#1B3F92]" aria-hidden="true" /><h3 className="mt-3 text-sm font-bold text-[#191B23]">Групп пока нет</h3><p className="mt-1 text-sm text-slate-500">Сначала создайте активный курс, затем соберите первую учебную группу.</p><button type="button" onClick={() => setFormTarget('create')} className="mt-4 rounded-xl bg-[#1B3F92] px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700">Создать группу</button></div> : <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{groups.map(group => { const selected = group.id === selectedGroupId; return <button key={group.id} type="button" onClick={() => setSelectedGroupId(group.id)} className={`min-h-36 rounded-2xl border p-4 text-left transition-colors ${selected ? 'border-[#1B3F92] bg-[#EEF2FF] shadow-sm' : 'border-slate-200 bg-white hover:border-[#1B3F92]/40 hover:bg-blue-50/30'}`}><div className="flex items-start justify-between gap-3"><span className={`flex h-9 w-9 items-center justify-center rounded-xl ${selected ? 'bg-[#1B3F92] text-white' : 'bg-blue-50 text-[#1B3F92]'}`}><Users size={18} aria-hidden="true" /></span><span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold ${group.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{group.isActive ? <CheckCircle2 size={12} aria-hidden="true" /> : <Circle size={12} aria-hidden="true" />}{group.isActive ? 'Активна' : 'Неактивна'}</span></div><h3 className="mt-3 line-clamp-2 text-sm font-black text-[#191B23]">{group.name}</h3><p className="mt-1 truncate text-xs text-slate-500">{group.course.name} · {MODE_LABELS[group.deliveryMode]}</p><p className="mt-3 text-xs font-semibold text-[#1B3F92]">{group.activeStudentCount}{group.capacity ? ` из ${group.capacity}` : ''} учеников</p></button> })}</div>}</section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" aria-labelledby="group-detail-heading"><div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-5"><div><h2 id="group-detail-heading" className="text-base font-black text-[#191B23]">{selectedGroup ? selectedGroup.name : 'Состав группы'}</h2><p className="mt-0.5 text-sm text-slate-400">{selectedGroup ? `${selectedGroup.course.name} · ${MODE_LABELS[selectedGroup.deliveryMode]} · ${formatDate(selectedGroup.startsOn)} — ${formatDate(selectedGroup.endsOn)}` : 'Выберите группу выше.'}</p></div>{selectedGroup && <div className="flex flex-wrap gap-2"><button type="button" onClick={() => setFormTarget(selectedGroup)} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-bold text-slate-600 hover:bg-slate-50"><Pencil size={15} aria-hidden="true" />Настроить</button><button type="button" onClick={() => setTeacherTarget(selectedGroup)} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-3.5 text-sm font-bold text-violet-800 hover:bg-violet-100"><GraduationCap size={15} aria-hidden="true" />{selectedGroup.teacher ? 'Преподаватель' : 'Назначить'}</button><button type="button" disabled={!selectedGroup.isActive} onClick={() => setStudentTarget(selectedGroup)} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-[#1B3F92] px-3.5 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"><UserPlus size={16} aria-hidden="true" />Ученик</button></div>}</div>
          {selectedGroup === null ? <div className="px-5 py-12 text-center text-sm text-slate-400">После выбора группы здесь появятся преподаватель и список учеников.</div> : <><div className="grid gap-3 border-b border-slate-100 bg-slate-50/70 p-4 sm:grid-cols-3 sm:px-5"><div className="rounded-xl bg-white p-3"><p className="text-xs font-bold text-slate-400">Преподаватель</p><p className="mt-1 truncate text-sm font-black text-[#191B23]">{selectedGroup.teacher?.fullName ?? 'Не назначен'}</p></div><div className="rounded-xl bg-white p-3"><p className="text-xs font-bold text-slate-400">Учеников</p><p className="mt-1 text-sm font-black text-[#191B23]">{selectedGroup.activeStudentCount}{selectedGroup.capacity ? ` / ${selectedGroup.capacity}` : ''}</p></div><div className="rounded-xl bg-white p-3"><p className="text-xs font-bold text-slate-400">Период</p><p className="mt-1 truncate text-sm font-black text-[#191B23]">{formatDate(selectedGroup.startsOn)} — {formatDate(selectedGroup.endsOn)}</p></div></div>{memberError && <div role="alert" className="mx-4 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 sm:mx-5"><span>{memberError}</span><button type="button" onClick={() => void loadMembers(selectedGroup.id)} className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-100"><RefreshCw size={14} aria-hidden="true" />Повторить</button></div>}{membersLoading ? <div className="flex items-center justify-center gap-2 px-5 py-12 text-sm font-semibold text-slate-400"><LoaderCircle size={18} className="animate-spin" aria-hidden="true" />Загружаем состав…</div> : members.length === 0 ? <div className="px-5 py-10 text-center"><Users size={22} className="mx-auto text-[#1B3F92]" aria-hidden="true" /><p className="mt-3 text-sm font-bold text-[#191B23]">В группе пока нет учеников</p><p className="mt-1 text-sm text-slate-500">Добавьте активного ученика с совместимым форматом обучения.</p><button type="button" disabled={!selectedGroup.isActive} onClick={() => setStudentTarget(selectedGroup)} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#1B3F92] px-4 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50"><UserPlus size={16} aria-hidden="true" />Добавить ученика</button></div> : <div className="divide-y divide-slate-100">{members.map(member => <article key={member.id} className="flex items-center gap-3 px-4 py-3 sm:px-5"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm font-black text-[#1B3F92]">{member.fullName.slice(0, 1).toUpperCase()}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-[#191B23]">{member.fullName}</p><p className="truncate text-xs text-slate-500">{member.email} · {studentTypeLabel(member.studentType)}</p></div><button type="button" disabled={removingStudentId === member.id} onClick={() => void removeStudent(member)} aria-label={`Убрать ${member.fullName} из группы`} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"><UserMinus size={17} aria-hidden="true" /></button></article>)}</div>}</>}</section>

        {!loading && courses.length === 0 && <section className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950"><BookOpen className="mt-0.5 shrink-0 text-amber-700" size={20} aria-hidden="true" /><p>Чтобы создать группу, сначала добавьте активный курс в разделе «Уроки». Мы не создаём группы без учебной программы.</p></section>}
      </main>

      {formTarget && <GroupFormModal courses={courses} group={formTarget === 'create' ? null : formTarget} onClose={() => setFormTarget(null)} onSaved={saveGroup} />}
      {teacherTarget && <TeacherAssignmentModal group={teacherTarget} teachers={teachers} onClose={() => setTeacherTarget(null)} onSaved={saveTeacher} />}
      {studentTarget && <StudentAssignmentModal group={studentTarget} students={students} existingIds={existingIds} onClose={() => setStudentTarget(null)} onAdded={onStudentAdded} />}
    </div>
  )
}
