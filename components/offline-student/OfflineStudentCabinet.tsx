'use client'

import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useMemo, useState, type TouchEvent } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDashed,
  ClipboardCheck,
  Clock3,
  FileText,
  GraduationCap,
  Home,
  Info,
  LogOut,
  Menu,
  PenLine,
  Target,
  TrendingUp,
  UserRoundCheck,
  X,
  XCircle,
  type LucideIcon,
} from 'lucide-react'

import { logoutZhangak } from '@/lib/zhangak-auth-client'
import { submitOfflineHomework } from '@/lib/offline-classroom'
import {
  activeHomework,
  attendanceSummary,
  nextScheduledLesson,
  scoreGap,
  type AttendanceState,
  type OfflineGrade,
  type OfflineHomework,
  type OfflineLesson,
  type OfflineStudentDashboard,
} from '@/lib/offline-student-contract'

type Section = 'home' | 'schedule' | 'attendance' | 'materials' | 'practice' | 'progress' | 'homework'

const SECTIONS: { id: Section; label: string; shortLabel: string; icon: LucideIcon }[] = [
  { id: 'home', label: 'Главная', shortLabel: 'Главная', icon: Home },
  { id: 'schedule', label: 'Расписание', shortLabel: 'Расписание', icon: CalendarDays },
  { id: 'attendance', label: 'Посещаемость', shortLabel: 'Посещения', icon: UserRoundCheck },
  { id: 'materials', label: 'Материалы', shortLabel: 'Материалы', icon: FileText },
  { id: 'practice', label: 'Практика', shortLabel: 'Практика', icon: PenLine },
  { id: 'progress', label: 'Мой прогресс', shortLabel: 'Прогресс', icon: TrendingUp },
  { id: 'homework', label: 'Домашние задания', shortLabel: 'Задания', icon: ClipboardCheck },
]

const ATTENDANCE_META: Record<AttendanceState, { label: string; color: string; bg: string; icon: LucideIcon }> = {
  present: { label: 'Был', color: 'text-emerald-700', bg: 'bg-emerald-50', icon: CheckCircle2 },
  late: { label: 'Опоздал', color: 'text-amber-700', bg: 'bg-amber-50', icon: Clock3 },
  absent: { label: 'Пропустил', color: 'text-red-700', bg: 'bg-red-50', icon: XCircle },
  pending: { label: 'Не отмечено', color: 'text-slate-500', bg: 'bg-slate-100', icon: CircleDashed },
}

const dateTime = new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const dateOnly = new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'long' })

function formatDate(value: string | null, withTime = true): string {
  if (!value) return 'Время не назначено'
  const dateOnlyValue = /^\d{4}-\d{2}-\d{2}$/.test(value)
  const date = new Date(dateOnlyValue ? `${value}T00:00:00` : value)
  if (dateOnlyValue) withTime = false
  return Number.isFinite(date.getTime()) ? (withTime ? dateTime.format(date) : dateOnly.format(date)) : 'Дата не указана'
}

function SectionTitle({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">{title}</h1>
      <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
    </div>
  )
}

function EmptyState({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-[#1B3F92]">
        <Icon size={24} aria-hidden="true" />
      </span>
      <h2 className="mt-4 text-base font-extrabold text-slate-900">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">{text}</p>
    </div>
  )
}

function AttendanceBadge({ state }: { state: AttendanceState }) {
  const meta = ATTENDANCE_META[state]
  const Icon = meta.icon
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${meta.bg} ${meta.color}`}>
      <Icon size={14} aria-hidden="true" />
      {meta.label}
    </span>
  )
}

function LessonRow({ lesson }: { lesson: OfflineLesson }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Урок {lesson.lessonNumber}</p>
          <h3 className="mt-1 font-extrabold text-slate-900">{lesson.title}</h3>
        </div>
        <AttendanceBadge state={lesson.attendance} />
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs font-medium text-slate-500">
        <span className="inline-flex items-center gap-1.5"><CalendarDays size={14} aria-hidden="true" />{formatDate(lesson.startsAt)}</span>
        {lesson.durationMinutes != null && <span className="inline-flex items-center gap-1.5"><Clock3 size={14} aria-hidden="true" />{lesson.durationMinutes} мин</span>}
        {lesson.isTest && <span className="inline-flex items-center gap-1.5"><ClipboardCheck size={14} aria-hidden="true" />Контрольная</span>}
      </div>
      {lesson.topics.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {lesson.topics.map(topic => <span key={topic} className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{topic}</span>)}
        </div>
      )}
    </article>
  )
}

function HomeworkCard({ item, onSubmitted }: { item: OfflineHomework; onSubmitted?: () => Promise<void> }) {
  const [answer, setAnswer] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submit = async () => {
    if (!answer.trim() || !onSubmitted) return
    setSaving(true); setError(null)
    try { await submitOfflineHomework(item.id, answer.trim()); await onSubmitted(); setAnswer('') }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Не удалось сдать задание') }
    finally { setSaving(false) }
  }
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${item.completed ? 'bg-emerald-50 text-emerald-600' : 'bg-violet-50 text-violet-600'}`}>
          {item.completed ? <CheckCircle2 size={20} aria-hidden="true" /> : <ClipboardCheck size={20} aria-hidden="true" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-slate-400">{item.lessonTitle}</p>
          <h3 className="mt-1 font-extrabold text-slate-900">{item.title}</h3>
          {item.description && <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{item.description}</p>}
          <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500">
            <Clock3 size={14} aria-hidden="true" />
            {item.completed ? 'Выполнено' : item.dueAt ? `Срок: ${formatDate(item.dueAt)}` : 'Срок не указан'}
          </p>
          {!item.completed && onSubmitted && <div className="mt-4 border-t border-slate-100 pt-4"><label className="text-xs font-bold text-slate-600" htmlFor={`homework-${item.id}`}>Текст сдачи</label><textarea id={`homework-${item.id}`} value={answer} onChange={event => setAnswer(event.target.value)} maxLength={50000} rows={3} className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:ring-2 focus:ring-[#1B3F92]" placeholder="Напиши ответ или опиши выполненную работу" /><div className="mt-2 flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-slate-500">Файлы будут добавлены в следующем этапе хранилища.</p><button type="button" onClick={() => void submit()} disabled={saving || !answer.trim()} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#1B3F92] px-3 text-sm font-bold text-white disabled:opacity-50"><CheckCircle2 size={16} />{saving ? 'Отправляем…' : 'Сдать'}</button></div>{error && <p role="alert" className="mt-2 text-xs font-semibold text-red-700">{error}</p>}</div>}
        </div>
      </div>
    </article>
  )
}

function GradeCard({ grade }: { grade: OfflineGrade }) {
  const scores = [
    ['Математика', grade.math],
    ['Аналогия', grade.analogy],
    ['Окуу', grade.reading],
    ['Кыргыз тили', grade.grammar],
  ].filter((entry): entry is [string, number] => typeof entry[1] === 'number')

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-extrabold text-slate-900">{grade.lessonTitle}</h3>
        {grade.total != null && <span className="rounded-xl bg-blue-50 px-3 py-1.5 text-sm font-black text-[#1B3F92]">{grade.total}</span>}
      </div>
      {scores.length > 0 ? (
        <dl className="mt-3 grid grid-cols-2 gap-2">
          {scores.map(([label, score]) => (
            <div key={label} className="rounded-xl bg-slate-50 p-3">
              <dt className="text-xs text-slate-500">{label}</dt>
              <dd className="mt-1 text-lg font-black text-slate-900">{score}</dd>
            </div>
          ))}
        </dl>
      ) : <p className="mt-3 text-sm text-slate-500">Оценка пока не опубликована.</p>}
    </article>
  )
}

function HomeSection({ dashboard, goTo }: { dashboard: OfflineStudentDashboard; goTo: (section: Section) => void }) {
  const next = nextScheduledLesson(dashboard.lessons)
  const pendingHomework = activeHomework(dashboard.homework)
  const summary = attendanceSummary(dashboard.lessons)

  return (
    <div className="space-y-5">
      <SectionTitle title={`Салам, ${dashboard.profile.fullName.split(' ')[0]}`} description={dashboard.group ? `${dashboard.group.name}${dashboard.group.courseName ? ` • ${dashboard.group.courseName}` : ''}` : 'Офлайн-кабинет ученика'} />

      {!dashboard.group && <EmptyState icon={GraduationCap} title="Группа ещё не назначена" text="Администратор добавит тебя в учебную группу. После этого здесь появятся уроки, посещаемость и задания." />}

      {dashboard.group && (
        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-3xl bg-[#132B66] p-5 text-white shadow-lg shadow-blue-950/10 sm:p-6">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-200">Следующий урок</p>
            {next ? (
              <>
                <h2 className="mt-3 text-2xl font-black">{next.title}</h2>
                <div className="mt-3 space-y-2 text-sm text-blue-100">
                  <p className="flex items-center gap-2"><CalendarDays size={16} aria-hidden="true" />{formatDate(next.startsAt)}</p>
                  {dashboard.group.teacherName && <p className="flex items-center gap-2"><GraduationCap size={16} aria-hidden="true" />{dashboard.group.teacherName}</p>}
                </div>
              </>
            ) : (
              <>
                <h2 className="mt-3 text-xl font-black">Точное расписание пока не опубликовано</h2>
                <p className="mt-2 text-sm leading-6 text-blue-100">Можно посмотреть опубликованную программу курса и темы занятий.</p>
              </>
            )}
            <button type="button" onClick={() => goTo('schedule')} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 text-sm font-bold text-[#132B66]">
              Открыть расписание <ArrowRight size={16} aria-hidden="true" />
            </button>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Посещаемость</p>
            <div className="mt-3 flex items-end gap-2">
              <span className="text-4xl font-black text-slate-950">{summary.rate == null ? '—' : `${summary.rate}%`}</span>
              <span className="pb-1 text-sm font-semibold text-slate-500">за отмеченные уроки</span>
            </div>
            <p className="mt-3 text-sm text-slate-500">Был: {summary.present} • Опоздал: {summary.late} • Пропустил: {summary.absent}</p>
            <button type="button" onClick={() => goTo('attendance')} className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-[#1B3F92]">
              Подробнее <ArrowRight size={16} aria-hidden="true" />
            </button>
          </section>
        </div>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Домашнее задание</p>
            <h2 className="mt-1 text-lg font-black text-slate-900">Что сделать дальше</h2>
          </div>
          <button type="button" onClick={() => goTo('homework')} className="min-h-11 text-sm font-bold text-[#1B3F92]">Все задания</button>
        </div>
        {pendingHomework[0] ? <HomeworkCard item={pendingHomework[0]} /> : <EmptyState icon={ClipboardCheck} title="Новых заданий нет" text="Когда преподаватель задаст домашнюю работу, она появится здесь." />}
      </section>

      {dashboard.announcements.length > 0 && <section className="rounded-3xl border border-amber-100 bg-white p-5 shadow-sm"><div className="flex items-center gap-2"><Info size={18} className="text-amber-700" aria-hidden="true" /><h2 className="font-black text-slate-950">Объявления</h2></div><div className="mt-3 space-y-3">{dashboard.announcements.slice(0, 3).map(item => <article key={item.id} className="rounded-2xl bg-amber-50 p-3"><h3 className="text-sm font-black text-slate-900">{item.title}</h3><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">{item.body}</p><p className="mt-2 text-xs font-semibold text-slate-500">{formatDate(item.publishedAt)}</p></article>)}</div></section>}

      {dashboard.comments.length > 0 && <section className="rounded-3xl border border-blue-100 bg-white p-5 shadow-sm"><div className="flex items-center gap-2"><Info size={18} className="text-[#1B3F92]" aria-hidden="true" /><h2 className="font-black text-slate-950">От преподавателя</h2></div><div className="mt-3 space-y-3">{dashboard.comments.slice(0, 3).map(comment => <article key={comment.id} className="rounded-2xl bg-blue-50 p-3"><p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{comment.body}</p><p className="mt-2 text-xs font-semibold text-slate-500">{formatDate(comment.createdAt)}</p></article>)}</div></section>}
    </div>
  )
}

function ScheduleSection({ lessons }: { lessons: OfflineLesson[] }) {
  const [page, setPage] = useState(0)
  const pageSize = 5
  const totalPages = Math.max(1, Math.ceil(lessons.length / pageSize))
  const visible = lessons.slice(page * pageSize, page * pageSize + pageSize)

  const move = (delta: number) => setPage(current => Math.min(totalPages - 1, Math.max(0, current + delta)))
  const swipe = useSwipe(move)

  return (
    <div className="space-y-5" {...swipe}>
      <SectionTitle title="Расписание" description="Листай влево и вправо, чтобы перейти к следующей части программы." />
      {lessons.length === 0 ? <EmptyState icon={CalendarDays} title="Расписание ещё не готово" text="Когда администратор назначит курс, уроки появятся здесь." /> : (
        <>
          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
            <button type="button" onClick={() => move(-1)} disabled={page === 0} aria-label="Предыдущие уроки" className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-600 disabled:opacity-30"><ChevronLeft size={20} /></button>
            <p className="text-sm font-bold text-slate-700">Уроки {page * pageSize + 1}–{Math.min(lessons.length, (page + 1) * pageSize)} из {lessons.length}</p>
            <button type="button" onClick={() => move(1)} disabled={page === totalPages - 1} aria-label="Следующие уроки" className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-600 disabled:opacity-30"><ChevronRight size={20} /></button>
          </div>
          {!lessons.some(lesson => lesson.startsAt) && (
            <div className="flex gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-800">
              <Info className="mt-0.5 shrink-0" size={18} aria-hidden="true" />
              <p>В базе есть порядок уроков, но нет точного времени и кабинетов. Мы не показываем выдуманное расписание.</p>
            </div>
          )}
          <div className="space-y-3">{visible.map(lesson => <LessonRow key={lesson.id} lesson={lesson} />)}</div>
        </>
      )}
    </div>
  )
}

function AttendanceSection({ lessons }: { lessons: OfflineLesson[] }) {
  const summary = attendanceSummary(lessons)
  const recorded = lessons.filter(lesson => lesson.attendance !== 'pending')
  return (
    <div className="space-y-5">
      <SectionTitle title="Посещаемость" description="Отметки появятся после отдельного защищённого переноса посещаемости. Ученик не сможет их менять." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ['Посещаемость', summary.rate == null ? '—' : `${summary.rate}%`, UserRoundCheck],
          ['Был', String(summary.present), CheckCircle2],
          ['Опоздал', String(summary.late), Clock3],
          ['Пропустил', String(summary.absent), XCircle],
        ].map(([label, value, RawIcon]) => {
          const Icon = RawIcon as LucideIcon
          return <div key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><Icon size={19} className="text-[#1B3F92]" /><p className="mt-3 text-2xl font-black text-slate-950">{String(value)}</p><p className="mt-1 text-xs font-semibold text-slate-500">{String(label)}</p></div>
        })}
      </div>
      {recorded.length === 0 ? <EmptyState icon={UserRoundCheck} title="Посещаемость ещё переносится" text="В первой версии офлайн-кабинета мы не показываем старые или выдуманные отметки. Они появятся только после переноса в наш сервер." /> : <div className="space-y-3">{recorded.map(lesson => <LessonRow key={lesson.id} lesson={lesson} />)}</div>}
    </div>
  )
}

function MaterialsSection({ lessons, available }: { lessons: OfflineLesson[]; available: boolean }) {
  const topicLessons = lessons.filter(lesson => lesson.topics.length > 0)
  return (
    <div className="space-y-5">
      <SectionTitle title="Материалы" description="Темы курса доступны для просмотра. Файлы появятся после подключения безопасного хранилища." />
      {!available && <div className="flex gap-3 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm leading-6 text-amber-900"><Info className="mt-0.5 shrink-0" size={18} /><p>В текущей подтверждённой схеме нет отдельного источника учебных файлов. Поэтому кабинет не показывает фиктивные PDF и видео.</p></div>}
      {topicLessons.length === 0 ? <EmptyState icon={FileText} title="Материалы ещё не добавлены" text="Учитель или администратор опубликует темы и файлы курса." /> : (
        <div className="grid gap-3 sm:grid-cols-2">
          {topicLessons.map(lesson => <article key={lesson.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600"><BookOpen size={20} /></span><p className="mt-3 text-xs font-bold text-slate-400">Урок {lesson.lessonNumber}</p><h2 className="mt-1 font-extrabold text-slate-900">{lesson.title}</h2><ul className="mt-3 space-y-2 text-sm text-slate-600">{lesson.topics.map(topic => <li key={topic} className="flex items-start gap-2"><FileText size={15} className="mt-0.5 shrink-0 text-slate-400" />{topic}</li>)}</ul></article>)}
        </div>
      )}
    </div>
  )
}

function PracticeSection() {
  return (
    <div className="space-y-5">
      <SectionTitle title="Практика" description="Ученик решает задания в общем тренажёре — отдельные копии результатов не создаются." />
      <EmptyState icon={PenLine} title="Онлайн-тренажёр недоступен в офлайн-курсе" text="У каждого ученика один активный тип обучения. Администратор поможет сменить курс после завершения или отмены текущего обучения." />
    </div>
  )
}

function ProgressSection({ dashboard }: { dashboard: OfflineStudentDashboard }) {
  const gap = scoreGap(dashboard.progress)
  return (
    <div className="space-y-5">
      <SectionTitle title="Мой прогресс" description="Здесь появятся только подтверждённые результаты после отдельного переноса ОРТ-оценок и контрольных работ в наш сервер." />
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-3xl bg-[#132B66] p-5 text-white"><Target size={22} className="text-blue-200" /><p className="mt-4 text-xs font-bold uppercase tracking-wide text-blue-200">Последний ОРТ</p><p className="mt-1 text-3xl font-black">{dashboard.progress.latestOrtScore ?? '—'}</p></div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><GraduationCap size={22} className="text-violet-600" /><p className="mt-4 text-xs font-bold uppercase tracking-wide text-slate-400">Цель</p><p className="mt-1 text-3xl font-black text-slate-950">{dashboard.progress.targetScore ?? '—'}</p></div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><TrendingUp size={22} className="text-emerald-600" /><p className="mt-4 text-xs font-bold uppercase tracking-wide text-slate-400">До цели</p><p className="mt-1 text-3xl font-black text-slate-950">{gap ?? '—'}</p></div>
      </div>
      {dashboard.grades.length === 0 ? <EmptyState icon={ClipboardCheck} title="Оценки ещё не подключены" text="Чтобы не смешивать старые и новые данные, оценки появятся здесь только после защищённого переноса на наш сервер." /> : <div className="grid gap-3 lg:grid-cols-2">{dashboard.grades.map(grade => <GradeCard key={grade.lessonId} grade={grade} />)}</div>}
    </div>
  )
}

function HomeworkSection({ homework, onSubmitted }: { homework: OfflineHomework[]; onSubmitted: () => Promise<void> }) {
  const active = homework.filter(item => !item.completed)
  const completed = homework.filter(item => item.completed)
  return (
    <div className="space-y-5">
      <SectionTitle title="Домашние задания" description="Сдай текстовый ответ до срока. После отправки преподаватель увидит его в журнале." />
      {homework.length === 0 ? <EmptyState icon={ClipboardCheck} title="Новых заданий нет" text="Когда преподаватель опубликует задание для твоей группы, оно появится здесь." /> : (
        <>
          <section><h2 className="mb-3 text-sm font-black uppercase tracking-wide text-slate-500">Нужно сделать</h2>{active.length > 0 ? <div className="space-y-3">{active.map(item => <HomeworkCard key={item.id} item={item} onSubmitted={onSubmitted} />)}</div> : <p className="rounded-2xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">Все опубликованные задания выполнены.</p>}</section>
          {completed.length > 0 && <section><h2 className="mb-3 text-sm font-black uppercase tracking-wide text-slate-500">Выполненные</h2><div className="space-y-3">{completed.map(item => <HomeworkCard key={item.id} item={item} />)}</div></section>}
        </>
      )}
    </div>
  )
}

function useSwipe(onMove: (delta: number) => void) {
  const [start, setStart] = useState<{ x: number; y: number } | null>(null)
  return {
    onTouchStart: (event: TouchEvent) => {
      const point = event.touches[0]
      setStart(point ? { x: point.clientX, y: point.clientY } : null)
    },
    onTouchEnd: (event: TouchEvent) => {
      if (start == null) return
      const point = event.changedTouches[0]
      const distanceX = (point?.clientX ?? start.x) - start.x
      const distanceY = (point?.clientY ?? start.y) - start.y
      // Only intentional horizontal swipes should switch cabinet sections.
      // A normal vertical page scroll or diagonal gesture must keep its state.
      if (Math.abs(distanceX) >= 70 && Math.abs(distanceX) > Math.abs(distanceY) * 1.5) {
        onMove(distanceX < 0 ? 1 : -1)
      }
      setStart(null)
    },
  }
}

export default function OfflineStudentCabinet({ dashboard, onRefresh }: { dashboard: OfflineStudentDashboard; onRefresh: () => Promise<void> }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const requestedSection = searchParams.get('section')
  const section: Section = SECTIONS.some(item => item.id === requestedSection) ? requestedSection as Section : 'home'
  const [menuOpen, setMenuOpen] = useState(false)
  const sectionIndex = SECTIONS.findIndex(item => item.id === section)
  const goTo = useCallback((next: Section) => {
    setMenuOpen(false)
    const params = new URLSearchParams(searchParams.toString())
    if (next === 'home') params.delete('section')
    else params.set('section', next)
    router.replace(params.size ? `/student?${params.toString()}` : '/student', { scroll: false })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [router, searchParams])
  const swipe = useSwipe(delta => {
    if (section === 'schedule') return
    const nextIndex = Math.min(SECTIONS.length - 1, Math.max(0, sectionIndex + delta))
    goTo(SECTIONS[nextIndex].id)
  })
  const content = useMemo(() => {
    if (section === 'home') return <HomeSection dashboard={dashboard} goTo={goTo} />
    if (section === 'schedule') return <ScheduleSection lessons={dashboard.lessons} />
    if (section === 'attendance') return <AttendanceSection lessons={dashboard.lessons} />
    if (section === 'materials') return <MaterialsSection lessons={dashboard.lessons} available={dashboard.availability.materials} />
    if (section === 'practice') return <PracticeSection />
    if (section === 'progress') return <ProgressSection dashboard={dashboard} />
    return <HomeworkSection homework={dashboard.homework} onSubmitted={onRefresh} />
  }, [dashboard, goTo, onRefresh, section])

  const logout = async () => {
    await logoutZhangak().catch(() => {})
    router.replace('/login')
  }

  return (
    <div className="min-h-screen bg-[#F6F7FB] text-slate-900">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#1B3F92]"><Image src="/images/logo.png" alt="Жангак" width={40} height={40} className="h-full w-full object-cover" /></span><div className="min-w-0"><p className="truncate text-sm font-black text-slate-950">Жангак</p><p className="truncate text-xs text-slate-500">Офлайн-кабинет • {dashboard.group?.name ?? 'без группы'}</p></div></div>
          <div className="flex items-center gap-1"><button type="button" onClick={() => setMenuOpen(true)} aria-label="Открыть все разделы" className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 lg:hidden"><Menu size={21} /></button><button type="button" onClick={() => void logout()} aria-label="Выйти" className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 hover:bg-red-50 hover:text-red-600"><LogOut size={20} /></button></div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-5 sm:px-6 lg:py-7">
        <aside className="hidden w-60 shrink-0 lg:block"><nav aria-label="Разделы офлайн-кабинета" className="sticky top-24 space-y-1 rounded-3xl border border-slate-200 bg-white p-3 shadow-sm">{SECTIONS.map(item => { const Icon = item.icon; const active = section === item.id; return <button key={item.id} type="button" onClick={() => goTo(item.id)} aria-current={active ? 'page' : undefined} className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-bold ${active ? 'bg-blue-50 text-[#1B3F92]' : 'text-slate-600 hover:bg-slate-50'}`}><Icon size={18} aria-hidden="true" />{item.label}</button> })}</nav></aside>
        <main className="min-w-0 flex-1 pb-28 lg:pb-8" {...swipe}>{content}<div className="mt-7 flex items-center justify-between border-t border-slate-200 pt-4 lg:hidden"><button type="button" disabled={sectionIndex === 0} onClick={() => goTo(SECTIONS[sectionIndex - 1].id)} className="inline-flex min-h-11 items-center gap-1 text-sm font-bold text-slate-600 disabled:opacity-30"><ArrowLeft size={16} /> Назад</button><span className="text-xs font-semibold text-slate-400">{sectionIndex + 1} из {SECTIONS.length}</span><button type="button" disabled={sectionIndex === SECTIONS.length - 1} onClick={() => goTo(SECTIONS[sectionIndex + 1].id)} className="inline-flex min-h-11 items-center gap-1 text-sm font-bold text-[#1B3F92] disabled:opacity-30">Дальше <ArrowRight size={16} /></button></div></main>
      </div>

      <nav aria-label="Быстрая навигация" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">{SECTIONS.filter(item => ['home', 'schedule', 'attendance', 'progress', 'homework'].includes(item.id)).map(item => { const Icon = item.icon; const active = section === item.id; return <button key={item.id} type="button" onClick={() => goTo(item.id)} aria-current={active ? 'page' : undefined} className={`flex min-h-16 min-w-11 flex-col items-center justify-center gap-1 px-1 text-[10px] font-bold ${active ? 'text-[#1B3F92]' : 'text-slate-500'}`}><Icon size={20} strokeWidth={active ? 2.5 : 2} /><span className="max-w-full truncate">{item.shortLabel}</span></button> })}</nav>

      {menuOpen && <div className="fixed inset-0 z-50 bg-slate-950/40 lg:hidden" onClick={() => setMenuOpen(false)}><div role="dialog" aria-modal="true" aria-label="Все разделы" className="absolute inset-x-3 top-3 rounded-3xl bg-white p-4 shadow-2xl" onClick={event => event.stopPropagation()}><div className="flex items-center justify-between"><h2 className="text-lg font-black">Все разделы</h2><button type="button" onClick={() => setMenuOpen(false)} aria-label="Закрыть" className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-500"><X size={21} /></button></div><div className="mt-3 grid grid-cols-2 gap-2">{SECTIONS.map(item => { const Icon = item.icon; return <button key={item.id} type="button" onClick={() => goTo(item.id)} className={`flex min-h-14 items-center gap-2 rounded-2xl p-3 text-left text-sm font-bold ${section === item.id ? 'bg-blue-50 text-[#1B3F92]' : 'bg-slate-50 text-slate-700'}`}><Icon size={19} />{item.label}</button> })}</div></div></div>}
    </div>
  )
}
