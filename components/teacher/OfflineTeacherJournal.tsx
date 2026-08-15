'use client'

import { useCallback, useEffect, useState } from 'react'
import { BookOpenCheck, CalendarPlus, Check, ClipboardCheck, LoaderCircle, Save, UsersRound } from 'lucide-react'

import {
  type OfflineAttendance,
  createOfflineComment,
  createOfflineHomework,
  createOfflineSession,
  getOfflineTeacherWorkspace,
  recordOfflineAttendance,
  recordOfflineGrade,
  type OfflineTeacherWorkspace,
} from '@/lib/offline-classroom'
import { ZhangakApiError } from '@/lib/zhangak-api-client'

type Notice = { kind: 'success' | 'error'; text: string } | null

function localDateTime(value = new Date(Date.now() + 60 * 60 * 1000)) {
  const offset = value.getTimezoneOffset() * 60_000
  return new Date(value.getTime() - offset).toISOString().slice(0, 16)
}

function formatDate(value: string | null) {
  if (!value) return 'не назначен'
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date.toLocaleString('ru', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'не назначен'
}

function Panel({ title, description, icon: Icon, children }: { title: string; description: string; icon: typeof CalendarPlus; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#1B3F92]"><Icon size={20} aria-hidden="true" /></span><div><h2 className="font-black text-slate-950">{title}</h2><p className="mt-1 text-sm leading-5 text-slate-500">{description}</p></div></div>
      <div className="mt-5">{children}</div>
    </section>
  )
}

function Button({ disabled, children }: { disabled?: boolean; children: React.ReactNode }) {
  return <button disabled={disabled} type="submit" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#1B3F92] px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"><Save size={16} aria-hidden="true" />{children}</button>
}

function Input({ className = '', ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none ring-[#1B3F92] placeholder:text-slate-400 focus:ring-2 ${className}`} />
}

function Select({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-[#1B3F92]">{children}</select>
}

function failureText(cause: unknown) {
  return cause instanceof ZhangakApiError ? cause.message : 'Не удалось сохранить изменения. Попробуйте ещё раз.'
}

export default function OfflineTeacherJournal({ groupId }: { groupId: number }) {
  const [workspace, setWorkspace] = useState<OfflineTeacherWorkspace | null>(null)
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState<Notice>(null)
  const [saving, setSaving] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try { setWorkspace(await getOfflineTeacherWorkspace(groupId)) }
    catch (cause) { setNotice({ kind: 'error', text: failureText(cause) }) }
    finally { setLoading(false) }
  }, [groupId])

  useEffect(() => {
    let cancelled = false
    const loadInitialWorkspace = async () => {
      try {
        const nextWorkspace = await getOfflineTeacherWorkspace(groupId)
        if (!cancelled) setWorkspace(nextWorkspace)
      } catch (cause) {
        if (!cancelled) setNotice({ kind: 'error', text: failureText(cause) })
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void loadInitialWorkspace()
    return () => { cancelled = true }
  }, [groupId])

  const firstLessonId = workspace?.lessons[0]?.id ?? ''
  const firstStudentId = workspace?.students[0]?.id ?? ''
  const firstSessionId = workspace?.sessions.find(item => item.status !== 'cancelled')?.id ?? ''
  const [attendance, setAttendance] = useState<Record<string, OfflineAttendance>>({})

  const save = async (work: () => Promise<unknown>, success: string) => {
    setSaving(true); setNotice(null)
    try { await work(); setNotice({ kind: 'success', text: success }); await refresh() }
    catch (cause) { setNotice({ kind: 'error', text: failureText(cause) }) }
    finally { setSaving(false) }
  }

  if (loading && !workspace) return <div className="mt-5 flex min-h-40 items-center justify-center rounded-3xl border border-slate-200 bg-white text-sm font-semibold text-slate-500"><LoaderCircle className="mr-2 animate-spin" size={18} />Загружаем журнал…</div>
  if (!workspace) return <div className="mt-5 rounded-3xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">Журнал пока недоступен. Нажмите «Обновить» и попробуйте снова.</div>

  return (
    <section className="mt-6 space-y-4" aria-labelledby="teacher-journal-title">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Рабочий журнал</p><h2 id="teacher-journal-title" className="mt-1 text-xl font-black text-slate-950">{workspace.group.name}</h2><p className="mt-1 text-sm text-slate-500">{workspace.group.courseName} • данные сохраняются на сервере Zhangak</p></div><button type="button" onClick={() => void refresh()} disabled={loading || saving} className="min-h-11 rounded-xl px-4 text-sm font-bold text-[#1B3F92] hover:bg-blue-50 disabled:opacity-60">Обновить журнал</button></div>
      {notice && <div role="status" className={`rounded-2xl p-4 text-sm font-semibold ${notice.kind === 'success' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'}`}>{notice.text}</div>}
      {workspace.students.length === 0 && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">В группе пока нет активных учеников. Администратор управляет составом группы.</div>}

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Запланировать урок" description="Выберите опубликованный урок курса и укажите время. Изменять курс и группу может только администратор." icon={CalendarPlus}>
          <form className="grid gap-3" onSubmit={event => { event.preventDefault(); const form = new FormData(event.currentTarget); void save(() => createOfflineSession(groupId, { lessonId: Number(form.get('lessonId')), startsAt: new Date(String(form.get('startsAt'))).toISOString(), endsAt: form.get('endsAt') ? new Date(String(form.get('endsAt'))).toISOString() : null, room: String(form.get('room') || '') || null }), 'Урок добавлен в расписание.') }}>
            <Select name="lessonId" required defaultValue={firstLessonId}><option value="" disabled>Выберите урок</option>{workspace.lessons.map(lesson => <option key={lesson.id} value={lesson.id}>Урок {lesson.lessonNumber}: {lesson.title}</option>)}</Select>
            <div className="grid gap-3 sm:grid-cols-2"><Input name="startsAt" type="datetime-local" required defaultValue={localDateTime()} /><Input name="endsAt" type="datetime-local" /></div>
            <Input name="room" maxLength={160} placeholder="Кабинет (необязательно)" />
            <Button disabled={saving || workspace.lessons.length === 0}>Добавить в расписание</Button>
          </form>
          {workspace.sessions.length > 0 && <p className="mt-4 text-xs leading-5 text-slate-500">Ближайшее: {workspace.sessions.filter(item => item.status === 'scheduled')[0] ? `${workspace.sessions.filter(item => item.status === 'scheduled')[0].lessonTitle} — ${formatDate(workspace.sessions.filter(item => item.status === 'scheduled')[0].startsAt)}` : 'нет запланированных уроков'}.</p>}
        </Panel>

        <Panel title="Посещаемость" description="Отметьте всех учеников после занятия. Ученик видит только свою отметку." icon={UsersRound}>
          <form className="space-y-3" onSubmit={event => { event.preventDefault(); const form = new FormData(event.currentTarget); const sessionId = Number(form.get('sessionId')); void save(() => recordOfflineAttendance(groupId, sessionId, workspace.students.map(student => ({ studentId: student.id, status: attendance[student.id] ?? 'present' }))), 'Посещаемость сохранена.') }}>
            <Select name="sessionId" required defaultValue={firstSessionId}><option value="" disabled>Выберите занятие</option>{workspace.sessions.filter(item => item.status !== 'cancelled').map(item => <option key={item.id} value={item.id}>{item.lessonTitle} — {formatDate(item.startsAt)}</option>)}</Select>
            {workspace.students.length > 0 && <div className="max-h-52 space-y-2 overflow-y-auto rounded-2xl bg-slate-50 p-3">{workspace.students.map(student => <label key={student.id} className="flex min-h-11 items-center justify-between gap-3 rounded-xl bg-white px-3 text-sm font-semibold text-slate-800"><span className="min-w-0 truncate">{student.fullName}</span><Select value={attendance[student.id] ?? 'present'} onChange={event => setAttendance(current => ({ ...current, [student.id]: event.target.value as OfflineAttendance }))} className="w-28 shrink-0"><option value="present">Был</option><option value="late">Опоздал</option><option value="absent">Отсутствовал</option></Select></label>)}</div>}
            <Button disabled={saving || !firstSessionId || workspace.students.length === 0}>Сохранить отметки</Button>
          </form>
        </Panel>

        <Panel title="Домашнее задание" description="По умолчанию срок — следующее запланированное занятие; при необходимости выберите другой." icon={ClipboardCheck}>
          <form className="grid gap-3" onSubmit={event => { event.preventDefault(); const form = new FormData(event.currentTarget); const lesson = String(form.get('lessonId')); const due = String(form.get('dueAt')); void save(() => createOfflineHomework(groupId, { lessonId: lesson ? Number(lesson) : null, title: String(form.get('title')), body: String(form.get('body') || '') || null, dueAt: due ? new Date(due).toISOString() : null }), 'Домашнее задание опубликовано для группы.') }}>
            <Input name="title" required maxLength={300} placeholder="Что нужно сделать" />
            <textarea name="body" maxLength={50000} rows={3} className="w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:ring-2 focus:ring-[#1B3F92]" placeholder="Условия и подсказки (необязательно)" />
            <div className="grid gap-3 sm:grid-cols-2"><Select name="lessonId" defaultValue=""><option value="">Без привязки к уроку</option>{workspace.lessons.map(lesson => <option key={lesson.id} value={lesson.id}>Урок {lesson.lessonNumber}: {lesson.title}</option>)}</Select><Input name="dueAt" type="datetime-local" /></div>
            <Button disabled={saving}>Опубликовать задание</Button>
          </form>
        </Panel>

        <Panel title="Оценка и комментарий" description="Оценка от 0 до 100. Комментарий можно сделать видимым ученику или оставить внутренним для команды." icon={BookOpenCheck}>
          <form className="grid gap-3" onSubmit={event => { event.preventDefault(); const form = new FormData(event.currentTarget); const studentId = String(form.get('studentId')); const comment = String(form.get('comment') || '').trim(); const visibility = String(form.get('visibility')) as 'student' | 'internal'; void save(async () => { await recordOfflineGrade(groupId, { studentId, gradeType: 'manual', title: String(form.get('title')), score: Number(form.get('score')), publish: form.get('publish') === 'on' }); if (comment) await createOfflineComment(groupId, { studentId, visibility, body: comment }) }, 'Оценка и комментарий сохранены.') }}>
            <Select name="studentId" required defaultValue={firstStudentId}><option value="" disabled>Выберите ученика</option>{workspace.students.map(student => <option key={student.id} value={student.id}>{student.fullName}</option>)}</Select>
            <div className="grid gap-3 sm:grid-cols-[1fr_8rem]"><Input name="title" required maxLength={300} placeholder="Например: работа на уроке" /><Input name="score" required type="number" min="0" max="100" step="1" placeholder="0–100" /></div>
            <textarea name="comment" maxLength={10000} rows={2} className="w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:ring-2 focus:ring-[#1B3F92]" placeholder="Комментарий (необязательно)" />
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm"><Select name="visibility" className="max-w-60"><option value="student">Виден ученику</option><option value="internal">Только преподавателю и администраторам</option></Select><label className="inline-flex min-h-11 items-center gap-2 font-semibold text-slate-700"><input name="publish" type="checkbox" defaultChecked className="h-4 w-4 accent-[#1B3F92]" />Показать оценку ученику</label></div>
            <Button disabled={saving || workspace.students.length === 0}>Сохранить</Button>
          </form>
        </Panel>
      </div>
      <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-900"><Check className="mr-2 inline" size={17} aria-hidden="true" />Состав группы, курс и учётные записи меняет только администратор. Все действия в журнале записываются в аудит.</div>
    </section>
  )
}
