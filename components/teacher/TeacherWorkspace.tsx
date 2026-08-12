'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import {
  BookOpen,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  ListChecks,
  LogOut,
  Save,
  Send,
  Smartphone,
  UserRoundCheck,
  Users,
  XCircle,
  type LucideIcon,
} from 'lucide-react'

import { supabase } from '@/lib/supabase'
import { createTeacherHomework, saveTeacherAttendance, saveTeacherGrades } from '@/lib/teacher-data'
import {
  SCORE_LIMITS,
  type TeacherAttendanceStatus,
  type TeacherGroupSummary,
  type TeacherGroupWorkspace,
  type TeacherLesson,
  type TeacherScores,
} from '@/lib/teacher-contract'

type Tab = 'lessons' | 'attendance' | 'grades' | 'homework'

const TABS: { id: Tab; label: string; short: string; icon: LucideIcon }[] = [
  { id: 'lessons', label: 'Уроки', short: 'Уроки', icon: BookOpen },
  { id: 'attendance', label: 'Посещаемость', short: 'Посещения', icon: UserRoundCheck },
  { id: 'grades', label: 'Оценки', short: 'Оценки', icon: ListChecks },
  { id: 'homework', label: 'Домашние задания', short: 'ДЗ', icon: ClipboardCheck },
]

const ATTENDANCE_OPTIONS: { value: TeacherAttendanceStatus; label: string; active: string; icon: LucideIcon }[] = [
  { value: 'present', label: 'Был', active: 'border-emerald-500 bg-emerald-50 text-emerald-700', icon: CheckCircle2 },
  { value: 'late', label: 'Опоздал', active: 'border-amber-500 bg-amber-50 text-amber-700', icon: Clock3 },
  { value: 'absent', label: 'Нет', active: 'border-red-500 bg-red-50 text-red-700', icon: XCircle },
]

const SCORE_FIELDS: { key: keyof TeacherScores; label: string; max: number }[] = [
  { key: 'math', label: 'Математика', max: SCORE_LIMITS.math },
  { key: 'analogy', label: 'Аналогия', max: SCORE_LIMITS.analogy },
  { key: 'reading', label: 'Окуу', max: SCORE_LIMITS.reading },
  { key: 'grammar', label: 'Кыргыз тили', max: SCORE_LIMITS.grammar },
]

interface Props {
  groups: TeacherGroupSummary[]
  workspace: TeacherGroupWorkspace | null
  onSelectGroup: (groupId: number) => Promise<void>
  onRefresh: () => Promise<void>
}

function formatDate(value: string | null): string {
  if (!value) return 'Дата не назначена'
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value)
  const date = new Date(dateOnly ? `${value}T00:00:00` : value)
  if (!Number.isFinite(date.getTime())) return 'Дата не указана'
  return date.toLocaleString('ru', dateOnly
    ? { day: 'numeric', month: 'long' }
    : { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function blankScores(): TeacherScores {
  return { math: null, analogy: null, reading: null, grammar: null }
}

function WorkspaceEmpty({ groups, onSelectGroup }: Pick<Props, 'groups' | 'onSelectGroup'>) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F6F7FB] p-5">
      <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-7 text-center shadow-sm">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-[#1B4FD8]"><Users size={27} /></span>
        <h1 className="mt-4 text-xl font-black text-slate-950">Нет назначенных групп</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">После назначения группы администратором здесь появятся ученики, уроки и быстрые действия.</p>
        {groups.length > 0 && <button type="button" onClick={() => void onSelectGroup(groups[0].id)} className="mt-5 min-h-12 rounded-xl bg-[#1B4FD8] px-5 text-sm font-bold text-white">Открыть группу</button>}
      </div>
    </div>
  )
}

function LessonPicker({ lessons, value, onChange, testsOnly = false }: { lessons: TeacherLesson[]; value: number | null; onChange: (id: number) => void; testsOnly?: boolean }) {
  const choices = testsOnly ? lessons.filter(lesson => lesson.isTest) : lessons
  if (choices.length === 0) return <p className="rounded-2xl bg-amber-50 p-4 text-sm font-semibold text-amber-800">{testsOnly ? 'В курсе нет контрольных уроков.' : 'В курсе пока нет уроков.'}</p>
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">Выбранный урок</span>
      <select value={value ?? ''} onChange={event => onChange(Number(event.target.value))} className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold text-slate-800 outline-none focus:border-[#1B4FD8]">
        {choices.map(lesson => <option key={lesson.id} value={lesson.id}>Урок {lesson.lessonNumber}: {lesson.title}</option>)}
      </select>
    </label>
  )
}

function LessonsTab({ workspace, openAttendance }: { workspace: TeacherGroupWorkspace; openAttendance: (lessonId: number) => void }) {
  if (workspace.lessons.length === 0) return <Empty icon={BookOpen} title="Уроки ещё не добавлены" text="Администратор должен наполнить курс уроками." />
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {workspace.lessons.map(lesson => (
        <article key={lesson.id} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3"><span className="text-xs font-black uppercase tracking-wide text-slate-400">Урок {lesson.lessonNumber}</span>{lesson.isTest && <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-bold text-violet-700">Контрольная</span>}</div>
          <h2 className="mt-2 text-base font-black text-slate-950">{lesson.title}</h2>
          <div className="mt-3 space-y-1.5 text-xs font-medium text-slate-500"><p className="flex items-center gap-2"><CalendarDays size={14} />{formatDate(lesson.lessonDate)}</p>{lesson.durationMinutes != null && <p className="flex items-center gap-2"><Clock3 size={14} />{lesson.durationMinutes} минут</p>}</div>
          {lesson.topics.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{lesson.topics.map(topic => <span key={topic} className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">{topic}</span>)}</div>}
          <button type="button" onClick={() => openAttendance(lesson.id)} className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-50 px-3 text-sm font-bold text-[#1B4FD8]">Отметить группу <ChevronRight size={16} /></button>
        </article>
      ))}
    </div>
  )
}

function Empty({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  return <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm"><span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-[#1B4FD8]"><Icon size={24} /></span><h2 className="mt-4 font-black text-slate-950">{title}</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">{text}</p></div>
}

export default function TeacherWorkspace({ groups, workspace, onSelectGroup, onRefresh }: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('lessons')
  const [attendanceLessonId, setAttendanceLessonId] = useState<number | null>(workspace?.lessons[0]?.id ?? null)
  const firstTestId = workspace?.lessons.find(lesson => lesson.isTest)?.id ?? null
  const [gradeLessonId, setGradeLessonId] = useState<number | null>(firstTestId)
  const [homeworkLessonId, setHomeworkLessonId] = useState<number | null>(workspace?.lessons[0]?.id ?? null)
  const [attendanceDraft, setAttendanceDraft] = useState(workspace?.attendance ?? {})
  const [gradeDraft, setGradeDraft] = useState(workspace?.grades ?? {})
  const [homeworkForm, setHomeworkForm] = useState({ title: '', description: '', dueAt: '' })
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  const selectedAttendance = useMemo(
    () => attendanceLessonId ? attendanceDraft[attendanceLessonId] ?? {} : {},
    [attendanceDraft, attendanceLessonId],
  )
  const selectedGrades = gradeLessonId ? gradeDraft[gradeLessonId] ?? {} : {}
  const attendanceCounts = useMemo(() => ({
    present: Object.values(selectedAttendance).filter(status => status === 'present').length,
    late: Object.values(selectedAttendance).filter(status => status === 'late').length,
    absent: Object.values(selectedAttendance).filter(status => status === 'absent').length,
  }), [selectedAttendance])

  if (!workspace) return <WorkspaceEmpty groups={groups} onSelectGroup={onSelectGroup} />

  const flash = (kind: 'success' | 'error', text: string) => {
    setNotice({ kind, text })
    window.setTimeout(() => setNotice(null), 3500)
  }

  const openAttendance = (lessonId: number) => { setAttendanceLessonId(lessonId); setTab('attendance'); window.scrollTo({ top: 0, behavior: 'smooth' }) }

  const setAttendance = (studentId: string, status: TeacherAttendanceStatus) => {
    if (!attendanceLessonId) return
    setAttendanceDraft(current => ({ ...current, [attendanceLessonId]: { ...(current[attendanceLessonId] ?? {}), [studentId]: status } }))
  }

  const markAllPresent = () => {
    if (!attendanceLessonId) return
    setAttendanceDraft(current => ({ ...current, [attendanceLessonId]: Object.fromEntries(workspace.students.map(student => [student.id, 'present' as const])) }))
  }

  const submitAttendance = async () => {
    if (!attendanceLessonId) return
    const entries = Object.entries(attendanceDraft[attendanceLessonId] ?? {}).map(([studentId, status]) => ({ studentId, status }))
    if (entries.length === 0) { flash('error', 'Сначала отметьте хотя бы одного ученика.'); return }
    setSaving(true)
    try { await saveTeacherAttendance(workspace.group.id, attendanceLessonId, entries); await onRefresh(); flash('success', 'Посещаемость сохранена.') }
    catch (error) { flash('error', error instanceof Error ? error.message : 'Не удалось сохранить посещаемость.') }
    finally { setSaving(false) }
  }

  const setScore = (studentId: string, field: keyof TeacherScores, raw: string) => {
    if (!gradeLessonId) return
    const value = raw === '' ? null : Number(raw)
    setGradeDraft(current => ({
      ...current,
      [gradeLessonId]: {
        ...(current[gradeLessonId] ?? {}),
        [studentId]: { ...(current[gradeLessonId]?.[studentId] ?? blankScores()), [field]: Number.isFinite(value) ? value : null },
      },
    }))
  }

  const submitGrades = async () => {
    if (!gradeLessonId) return
    const entries = Object.entries(gradeDraft[gradeLessonId] ?? {}).filter(([, scores]) => Object.values(scores).some(score => score != null)).map(([studentId, scores]) => ({ studentId, scores }))
    if (entries.length === 0) { flash('error', 'Введите оценку хотя бы одному ученику.'); return }
    setSaving(true)
    try { await saveTeacherGrades(workspace.group.id, gradeLessonId, entries); await onRefresh(); flash('success', 'Оценки сохранены.') }
    catch (error) { flash('error', error instanceof Error ? error.message : 'Не удалось сохранить оценки.') }
    finally { setSaving(false) }
  }

  const submitHomework = async () => {
    if (!homeworkLessonId || !homeworkForm.title.trim()) { flash('error', 'Выберите урок и укажите название задания.'); return }
    setSaving(true)
    try {
      await createTeacherHomework({ groupId: workspace.group.id, lessonId: homeworkLessonId, title: homeworkForm.title.trim(), description: homeworkForm.description.trim() || null, dueAt: homeworkForm.dueAt || null })
      setHomeworkForm({ title: '', description: '', dueAt: '' })
      await onRefresh()
      flash('success', 'Домашнее задание опубликовано.')
    } catch (error) { flash('error', error instanceof Error ? error.message : 'Не удалось опубликовать задание.') }
    finally { setSaving(false) }
  }

  const logout = async () => { await supabase.auth.signOut(); router.replace('/login') }
  const title = TABS.find(item => item.id === tab)?.label ?? 'Кабинет учителя'

  return (
    <div className="min-h-screen bg-[#F6F7FB] pb-20 lg:pb-0">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3"><Image src="/images/logo.png" alt="Жангак" width={40} height={40} className="h-10 w-10 rounded-xl object-cover" /><div className="min-w-0"><p className="truncate text-sm font-black text-slate-950">Жангак • Учитель</p><p className="truncate text-xs text-slate-500">{workspace.group.name}{workspace.group.courseName ? ` • ${workspace.group.courseName}` : ''}</p></div></div>
          <button type="button" onClick={() => void logout()} aria-label="Выйти" className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 hover:bg-red-50 hover:text-red-600"><LogOut size={20} /></button>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[240px_1fr] lg:py-7">
        <aside className="space-y-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm">
            <label className="block"><span className="mb-2 block px-1 text-xs font-bold uppercase tracking-wide text-slate-400">Моя группа</span><select value={workspace.group.id} onChange={event => void onSelectGroup(Number(event.target.value))} className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold text-slate-800">{groups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>
            <div className="mt-3 grid grid-cols-2 gap-2"><div className="rounded-xl bg-blue-50 p-3"><Users size={17} className="text-[#1B4FD8]" /><p className="mt-2 text-xl font-black text-slate-950">{workspace.students.length}</p><p className="text-xs text-slate-500">учеников</p></div><div className="rounded-xl bg-violet-50 p-3"><BookOpen size={17} className="text-violet-600" /><p className="mt-2 text-xl font-black text-slate-950">{workspace.lessons.length}</p><p className="text-xs text-slate-500">уроков</p></div></div>
          </div>
          <nav aria-label="Разделы кабинета учителя" className="hidden space-y-1 rounded-3xl border border-slate-200 bg-white p-3 shadow-sm lg:block">{TABS.map(item => { const Icon = item.icon; const active = tab === item.id; return <button key={item.id} type="button" onClick={() => setTab(item.id)} aria-current={active ? 'page' : undefined} className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-bold ${active ? 'bg-blue-50 text-[#1B4FD8]' : 'text-slate-600 hover:bg-slate-50'}`}><Icon size={18} />{item.label}</button> })}</nav>
        </aside>

        <main className="min-w-0">
          <div className="mb-5"><h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">{title}</h1><p className="mt-1 text-sm text-slate-500">{workspace.group.courseName ?? 'Учебный курс'}{workspace.group.level ? ` • ${workspace.group.level}` : ''}</p></div>
          {notice && <div aria-live="polite" className={`mb-4 flex items-center gap-2 rounded-2xl border p-4 text-sm font-bold ${notice.kind === 'success' ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : 'border-red-100 bg-red-50 text-red-700'}`}>{notice.kind === 'success' ? <Check size={18} /> : <XCircle size={18} />}{notice.text}</div>}

          {tab === 'lessons' && <LessonsTab workspace={workspace} openAttendance={openAttendance} />}

          {tab === 'attendance' && <div className="space-y-4"><div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><div className="grid items-end gap-3 sm:grid-cols-[1fr_auto]"><LessonPicker lessons={workspace.lessons} value={attendanceLessonId} onChange={setAttendanceLessonId} /><button type="button" onClick={markAllPresent} disabled={!attendanceLessonId || workspace.students.length === 0} className="min-h-12 rounded-xl border border-emerald-200 bg-emerald-50 px-4 text-sm font-bold text-emerald-700 disabled:opacity-40">Отметить всех: был</button></div><div className="mt-4 grid grid-cols-3 gap-2">{[['Были', attendanceCounts.present, 'text-emerald-700'], ['Опоздали', attendanceCounts.late, 'text-amber-700'], ['Нет', attendanceCounts.absent, 'text-red-700']].map(([label, count, color]) => <div key={String(label)} className="rounded-xl bg-slate-50 p-3 text-center"><p className={`text-xl font-black ${String(color)}`}>{String(count)}</p><p className="text-xs text-slate-500">{String(label)}</p></div>)}</div></div>{workspace.students.length === 0 ? <Empty icon={Users} title="В группе нет учеников" text="Добавить учеников может администратор." /> : <div className="space-y-2">{workspace.students.map(student => <article key={student.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-sm font-black text-slate-600">{student.fullName.slice(0, 1).toUpperCase()}</span><div className="min-w-0"><p className="truncate text-sm font-black text-slate-900">{student.fullName}</p>{student.phone && <p className="truncate text-xs text-slate-400">{student.phone}</p>}</div></div><div className="mt-3 grid grid-cols-3 gap-2">{ATTENDANCE_OPTIONS.map(option => { const Icon = option.icon; const active = selectedAttendance[student.id] === option.value; return <button key={option.value} type="button" onClick={() => setAttendance(student.id, option.value)} aria-pressed={active} className={`flex min-h-11 items-center justify-center gap-1 rounded-xl border px-2 text-xs font-bold ${active ? option.active : 'border-slate-200 bg-white text-slate-500'}`}><Icon size={15} />{option.label}</button> })}</div></article>)}</div>}<button type="button" onClick={() => void submitAttendance()} disabled={saving || !attendanceLessonId || workspace.students.length === 0} className="sticky bottom-20 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#1B4FD8] px-5 text-sm font-bold text-white shadow-lg disabled:opacity-50 lg:bottom-4"><Save size={17} />{saving ? 'Сохранение...' : 'Сохранить посещаемость'}</button></div>}

          {tab === 'grades' && <div className="space-y-4"><div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><LessonPicker lessons={workspace.lessons} value={gradeLessonId} onChange={setGradeLessonId} testsOnly /><p className="mt-3 text-xs leading-5 text-slate-500">Оценки доступны только для контрольных уроков. Допустимый максимум указан рядом с каждым полем.</p></div>{!gradeLessonId ? <Empty icon={ListChecks} title="Нет контрольных уроков" text="После добавления контрольной администратором здесь появится журнал оценок." /> : workspace.students.length === 0 ? <Empty icon={Users} title="В группе нет учеников" text="Добавить учеников может администратор." /> : <div className="space-y-3">{workspace.students.map(student => { const scores = selectedGrades[student.id] ?? blankScores(); return <article key={student.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="font-black text-slate-900">{student.fullName}</p><div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">{SCORE_FIELDS.map(field => <label key={field.key} className="block"><span className="mb-1 block text-[11px] font-bold text-slate-500">{field.label} / {field.max}</span><input type="number" min={0} max={field.max} inputMode="numeric" value={scores[field.key] ?? ''} onChange={event => setScore(student.id, field.key, event.target.value)} className="min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm font-bold outline-none focus:border-[#1B4FD8]" /></label>)}</div></article> })}<button type="button" onClick={() => void submitGrades()} disabled={saving} className="sticky bottom-20 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#1B4FD8] px-5 text-sm font-bold text-white shadow-lg disabled:opacity-50 lg:bottom-4"><Save size={17} />{saving ? 'Сохранение...' : 'Сохранить оценки'}</button></div>}</div>}

          {tab === 'homework' && <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]"><section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><h2 className="font-black text-slate-950">Новое задание</h2><p className="mt-1 flex items-start gap-2 text-xs leading-5 text-amber-700"><Smartphone size={15} className="mt-0.5 shrink-0" />Текущая база привязывает ДЗ к уроку курса, поэтому оно будет видно всем группам этого курса.</p><div className="mt-4 space-y-3"><LessonPicker lessons={workspace.lessons} value={homeworkLessonId} onChange={setHomeworkLessonId} /><label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-600">Название</span><input value={homeworkForm.title} maxLength={200} onChange={event => setHomeworkForm(current => ({ ...current, title: event.target.value }))} placeholder="Например: Задачи 1–10" className="min-h-12 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-[#1B4FD8]" /></label><label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-600">Описание</span><textarea value={homeworkForm.description} maxLength={2000} rows={4} onChange={event => setHomeworkForm(current => ({ ...current, description: event.target.value }))} placeholder="Что нужно сделать" className="w-full rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-[#1B4FD8]" /></label><label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-600">Срок</span><input type="date" value={homeworkForm.dueAt} onChange={event => setHomeworkForm(current => ({ ...current, dueAt: event.target.value }))} className="min-h-12 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-[#1B4FD8]" /></label><button type="button" onClick={() => void submitHomework()} disabled={saving || !homeworkLessonId || !homeworkForm.title.trim()} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#1B4FD8] px-4 text-sm font-bold text-white disabled:opacity-50"><Send size={17} />{saving ? 'Публикация...' : 'Опубликовать'}</button></div></section><section><h2 className="mb-3 font-black text-slate-950">Опубликованные задания</h2>{workspace.homework.length === 0 ? <Empty icon={ClipboardCheck} title="Заданий пока нет" text="Создайте первое задание для урока." /> : <div className="space-y-3">{workspace.homework.map(item => <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold text-slate-400">{workspace.lessons.find(lesson => lesson.id === item.lessonId)?.title ?? 'Урок'}</p><h3 className="mt-1 font-black text-slate-950">{item.title}</h3></div><span className="shrink-0 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-[#1B4FD8]">{item.submittedCount}/{workspace.students.length}</span></div>{item.description && <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{item.description}</p>}<p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-slate-500"><Clock3 size={14} />{item.dueAt ? `Срок: ${formatDate(item.dueAt)}` : 'Без срока'}</p></article>)}</div>}</section></div>}
        </main>
      </div>

      <nav aria-label="Навигация учителя" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">{TABS.map(item => { const Icon = item.icon; const active = tab === item.id; return <button key={item.id} type="button" onClick={() => setTab(item.id)} aria-current={active ? 'page' : undefined} className={`flex min-h-16 min-w-11 flex-col items-center justify-center gap-1 px-1 text-[10px] font-bold ${active ? 'text-[#1B4FD8]' : 'text-slate-500'}`}><Icon size={20} strokeWidth={active ? 2.5 : 2} /><span className="max-w-full truncate">{item.short}</span></button> })}</nav>
    </div>
  )
}
