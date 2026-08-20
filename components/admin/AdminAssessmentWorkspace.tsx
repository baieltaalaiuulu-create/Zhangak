'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  BookOpen,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  FilePlus2,
  ListChecks,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  X,
} from 'lucide-react'

import AdminTopbar from '@/components/admin/AdminTopbar'
import {
  createAdminCoursePracticeTest,
  createAdminLessonPracticeTest,
  createAdminPracticeQuestion,
  listAdminCoursePracticeTests,
  listAdminLessonPracticeTests,
  listAdminPracticeQuestions,
  type AdminPracticeQuestion,
  type AdminPracticeQuestionAnswer,
  type AdminPracticeQuestionDifficulty,
  type AdminPracticeQuestionInput,
  type AdminPracticeTest,
  type AdminPracticeTestInput,
  type AdminPracticeTestType,
  updateAdminPracticeQuestion,
  updateAdminPracticeTest,
} from '@/lib/admin-assessments-client'
import { listAdminCourses, listAdminLessons, type AdminCourse, type AdminLesson } from '@/lib/admin-learning-client'

type WorkspaceKind = 'practice' | 'questions' | 'mock'
type TestFormState = { kind: 'create' } | { kind: 'edit'; test: AdminPracticeTest }

interface AdminAssessmentWorkspaceProps {
  kind: WorkspaceKind
}

const TEST_TYPE_LABELS: Record<AdminPracticeTestType, string> = {
  practice: 'Тренажёр',
  mock: 'Пробный ОРТ',
  bank: 'Банк заданий',
  diagnostic: 'Диагностика',
}

const DIFFICULTY_LABELS: Record<AdminPracticeQuestionDifficulty, string> = {
  easy: 'Базовый',
  medium: 'Средний',
  hard: 'Сложный',
}

const ANSWERS: readonly AdminPracticeQuestionAnswer[] = ['a', 'b', 'c', 'd']

function errorMessage(cause: unknown, fallback: string): string {
  return cause instanceof Error && cause.message ? cause.message : fallback
}

function dateTimeInputValue(value: string | null): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

function dateLabel(value: string | null): string {
  if (!value) return 'Без ограничения'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date)
}

function testScopeLabel(lesson: AdminLesson | null): string {
  return lesson ? `Урок ${lesson.lessonNumber}` : 'Весь курс'
}

function pageTitle(kind: WorkspaceKind): string {
  if (kind === 'questions') return 'Вопросы и тесты'
  if (kind === 'mock') return 'Пробный ОРТ'
  return 'Практика'
}

function pageDescription(kind: WorkspaceKind): string {
  if (kind === 'questions') return 'Выберите курс и тест: ключи ответов доступны только в этой защищённой админ-панели.'
  if (kind === 'mock') return 'Соберите набор заданий пробного ОРТ. Расписание отдельной сессии появится после переноса модели запусков.'
  return 'Создавайте тесты к курсу или конкретному уроку, затем добавляйте проверенные задания.'
}

function visibleTests(kind: WorkspaceKind, tests: readonly AdminPracticeTest[]): AdminPracticeTest[] {
  return kind === 'mock' ? tests.filter(test => test.testType === 'mock') : [...tests]
}

function nextQuestionPosition(questions: readonly AdminPracticeQuestion[]): number | null {
  const occupied = new Set(questions.map(question => question.position))
  for (let position = 1; position <= 200; position += 1) {
    if (!occupied.has(position)) return position
  }
  return null
}

function TestTypeBadge({ type }: { type: AdminPracticeTestType }) {
  const tones: Record<AdminPracticeTestType, string> = {
    practice: 'bg-blue-50 text-blue-700',
    mock: 'bg-violet-50 text-violet-700',
    bank: 'bg-amber-50 text-amber-800',
    diagnostic: 'bg-emerald-50 text-emerald-700',
  }
  return <span className={`rounded-full px-2 py-1 text-[11px] font-extrabold ${tones[type]}`}>{TEST_TYPE_LABELS[type]}</span>
}

function EmptyState({ icon: Icon, title, description, action }: {
  icon: typeof BookOpen
  title: string
  description: string
  action?: { label: string; onClick: () => void }
}) {
  return (
    <div className="px-5 py-10 text-center sm:px-8">
      <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-[#1B3F92]">
        <Icon size={21} aria-hidden="true" />
      </span>
      <h3 className="mt-3 text-sm font-black text-[#191B23]">{title}</h3>
      <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-slate-500">{description}</p>
      {action && <button type="button" onClick={action.onClick} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#1B3F92] px-4 text-sm font-bold text-white hover:bg-blue-700"><Plus size={16} aria-hidden="true" />{action.label}</button>}
    </div>
  )
}

function TestFormModal({ form, course, lesson, fixedType, onClose, onSaved }: {
  form: TestFormState
  course: AdminCourse
  lesson: AdminLesson | null
  fixedType: AdminPracticeTestType | null
  onClose: () => void
  onSaved: (test: AdminPracticeTest) => void
}) {
  const editing = form.kind === 'edit'
  const test = editing ? form.test : null
  const [title, setTitle] = useState(test?.title ?? '')
  const [subject, setSubject] = useState(test?.subject ?? (course.subject === 'ort' ? 'math' : course.subject) ?? '')
  const [testType, setTestType] = useState<AdminPracticeTestType>(fixedType ?? test?.testType ?? 'practice')
  const [description, setDescription] = useState(test?.description ?? '')
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(test?.timeLimitSeconds ? String(Math.ceil(test.timeLimitSeconds / 60)) : '')
  const [maxAttempts, setMaxAttempts] = useState(test?.maxAttempts ? String(test.maxAttempts) : '')
  const [passScore, setPassScore] = useState(String(Math.round((test?.passScoreRatio ?? 0.7) * 100)))
  const [availableFrom, setAvailableFrom] = useState(dateTimeInputValue(test?.availableFrom ?? null))
  const [availableUntil, setAvailableUntil] = useState(dateTimeInputValue(test?.availableUntil ?? null))
  const [isPublished, setIsPublished] = useState(test?.isPublished ?? false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const optionalPositiveInteger = (value: string, label: string, max: number): number | null => {
    if (value.trim() === '') return null
    const parsed = Number(value)
    if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > max) throw new Error(`Введите корректное значение: ${label}`)
    return parsed
  }

  const optionalTimestamp = (value: string, label: string): string | null => {
    if (!value) return null
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) throw new Error(`Введите корректную дату: ${label}`)
    return date.toISOString()
  }

  const handleSubmit = async () => {
    setError('')
    try {
      if (!title.trim()) throw new Error('Введите название теста')
      if (!subject.trim()) throw new Error('Введите предмет теста')
      const passScoreValue = Number(passScore)
      if (!Number.isFinite(passScoreValue) || passScoreValue < 0 || passScoreValue > 100) {
        throw new Error('Проходной балл должен быть от 0 до 100%')
      }
      const from = optionalTimestamp(availableFrom, 'начала доступности')
      const until = optionalTimestamp(availableUntil, 'окончания доступности')
      if (from && until && new Date(until).getTime() <= new Date(from).getTime()) {
        throw new Error('Окончание доступности должно быть позже начала')
      }
      const input: AdminPracticeTestInput = {
        title: title.trim(),
        subject: subject.trim(),
        testType: fixedType ?? testType,
        description: description.trim() || null,
        timeLimitSeconds: (() => {
          const minutes = optionalPositiveInteger(timeLimitMinutes, 'лимит времени (мин.)', 1_440)
          return minutes === null ? null : minutes * 60
        })(),
        maxAttempts: optionalPositiveInteger(maxAttempts, 'количество попыток', 1_000),
        passScoreRatio: Math.round((passScoreValue / 100) * 10_000) / 10_000,
        availableFrom: from,
        availableUntil: until,
        ...(editing ? { isPublished } : {}),
      }
      setSaving(true)
      const saved = editing
        ? await updateAdminPracticeTest(test!.id, input)
        : lesson
          ? await createAdminLessonPracticeTest(lesson.id, input)
          : await createAdminCoursePracticeTest(course.id, input)
      onSaved(saved)
    } catch (cause) {
      setError(errorMessage(cause, 'Не удалось сохранить тест'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-3 sm:p-5" onClick={onClose}>
      <section className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl sm:p-7" onClick={event => event.stopPropagation()} aria-labelledby="assessment-test-form-title">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="assessment-test-form-title" className="text-lg font-black text-[#191B23]">{editing ? 'Редактировать тест' : 'Новый тест'}</h2>
            <p className="mt-1 text-sm leading-5 text-slate-500">{course.name} · {testScopeLabel(lesson)}</p>
          </div>
          <button type="button" onClick={onClose} disabled={saving} aria-label="Закрыть" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 disabled:opacity-50"><X size={19} aria-hidden="true" /></button>
        </div>

        <div className="mt-6 space-y-4">
          <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-600">Название *</span><input value={title} onChange={event => setTitle(event.target.value)} maxLength={500} placeholder="Например, Квадратные уравнения — практика" className="min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-[#1B3F92] focus:ring-2 focus:ring-[#1B3F92]/15" /></label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-600">Предмет *</span>{course.subject === 'ort' ? <select value={subject} onChange={event => setSubject(event.target.value)} className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#1B3F92] focus:ring-2 focus:ring-[#1B3F92]/15"><option value="math">Математика</option><option value="kyr">Кыргызский язык</option></select> : <input value={subject} onChange={event => setSubject(event.target.value)} maxLength={80} placeholder="Математика" className="min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-[#1B3F92] focus:ring-2 focus:ring-[#1B3F92]/15" />}</label>
            <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-600">Тип</span><select value={fixedType ?? testType} disabled={fixedType !== null} onChange={event => setTestType(event.target.value as AdminPracticeTestType)} className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#1B3F92] focus:ring-2 focus:ring-[#1B3F92]/15 disabled:cursor-not-allowed disabled:bg-slate-50">
              {(Object.keys(TEST_TYPE_LABELS) as AdminPracticeTestType[]).map(type => <option key={type} value={type}>{TEST_TYPE_LABELS[type]}</option>)}
            </select></label>
          </div>
          <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-600">Описание</span><textarea value={description} onChange={event => setDescription(event.target.value)} rows={3} maxLength={20_000} placeholder="Что проверяет этот тест" className="w-full resize-y rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#1B3F92] focus:ring-2 focus:ring-[#1B3F92]/15" /></label>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-600">Лимит, мин.</span><input type="number" min={1} max={1_440} value={timeLimitMinutes} onChange={event => setTimeLimitMinutes(event.target.value)} placeholder="Без лимита" className="min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-[#1B3F92] focus:ring-2 focus:ring-[#1B3F92]/15" /></label>
            <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-600">Попыток</span><input type="number" min={1} max={1_000} value={maxAttempts} onChange={event => setMaxAttempts(event.target.value)} placeholder="Без лимита" className="min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-[#1B3F92] focus:ring-2 focus:ring-[#1B3F92]/15" /></label>
            <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-600">Проходной, %</span><input type="number" min={0} max={100} value={passScore} onChange={event => setPassScore(event.target.value)} className="min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-[#1B3F92] focus:ring-2 focus:ring-[#1B3F92]/15" /></label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-600">Доступен с</span><input type="datetime-local" value={availableFrom} onChange={event => setAvailableFrom(event.target.value)} className="min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-[#1B3F92] focus:ring-2 focus:ring-[#1B3F92]/15" /></label>
            <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-600">Доступен до</span><input type="datetime-local" value={availableUntil} onChange={event => setAvailableUntil(event.target.value)} className="min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-[#1B3F92] focus:ring-2 focus:ring-[#1B3F92]/15" /></label>
          </div>
          {editing && <label className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-950"><input type="checkbox" checked={isPublished} onChange={event => setIsPublished(event.target.checked)} className="mt-0.5" /><span><span className="block">Опубликовать для учеников</span><span className="mt-1 block text-xs font-medium leading-5 text-amber-800">Опубликовать можно только тест, в котором есть хотя бы один активный вопрос.</span></span></label>}
          {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-semibold text-red-700">{error}</p>}
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" onClick={() => void handleSubmit()} disabled={saving} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#1B3F92] px-5 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"><FilePlus2 size={17} aria-hidden="true" />{saving ? 'Сохраняем…' : editing ? 'Сохранить' : 'Создать тест'}</button>
          <button type="button" onClick={onClose} disabled={saving} className="min-h-11 rounded-xl bg-slate-100 px-5 text-sm font-bold text-slate-600 hover:bg-slate-200 disabled:opacity-60">Отмена</button>
        </div>
      </section>
    </div>
  )
}

function QuestionFormModal({ question, test, nextPosition, onClose, onSaved }: {
  question: AdminPracticeQuestion | null
  test: AdminPracticeTest
  nextPosition: number
  onClose: () => void
  onSaved: (question: AdminPracticeQuestion) => void
}) {
  const editing = question !== null
  const [questionText, setQuestionText] = useState(question?.questionText ?? '')
  const [options, setOptions] = useState<Record<AdminPracticeQuestionAnswer, string>>(question?.options ?? { a: '', b: '', c: '', d: '' })
  const [correctAnswer, setCorrectAnswer] = useState<AdminPracticeQuestionAnswer>(question?.correctAnswer ?? 'a')
  const [section, setSection] = useState(question?.section ?? 'general')
  const [topic, setTopic] = useState(question?.topic ?? '')
  const [difficulty, setDifficulty] = useState<AdminPracticeQuestionDifficulty>(question?.difficulty ?? 'medium')
  const [explanation, setExplanation] = useState(question?.explanation ?? '')
  const [imageUrl, setImageUrl] = useState(question?.imageUrl ?? '')
  const [position, setPosition] = useState(String(question?.position ?? nextPosition))
  const [isActive, setIsActive] = useState(question?.isActive ?? true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    setError('')
    try {
      const normalizedSection = section.trim().toLowerCase()
      if (!questionText.trim()) throw new Error('Введите текст вопроса')
      if (!ANSWERS.every(answer => options[answer].trim())) throw new Error('Заполните все четыре варианта ответа')
      if (!/^[a-z][a-z0-9_-]{0,63}$/.test(normalizedSection)) {
        throw new Error('Раздел: только латинские буквы, цифры, дефис или подчёркивание')
      }
      const positionValue = Number(position)
      if (!Number.isSafeInteger(positionValue) || positionValue < 1 || positionValue > 200) {
        throw new Error('Порядок вопроса должен быть от 1 до 200')
      }
      const normalizedImage = imageUrl.trim()
      if (normalizedImage) {
        try {
          const parsed = new URL(normalizedImage)
          if (parsed.protocol !== 'https:' || parsed.username || parsed.password) throw new Error('unsafe URL')
        } catch {
          throw new Error('Ссылка на изображение должна быть безопасной HTTPS-ссылкой')
        }
      }
      const input: AdminPracticeQuestionInput = {
        questionText: questionText.trim(),
        options: Object.fromEntries(ANSWERS.map(answer => [answer, options[answer].trim()])) as Record<AdminPracticeQuestionAnswer, string>,
        correctAnswer,
        explanation: explanation.trim() || null,
        section: normalizedSection,
        topic: topic.trim() || null,
        difficulty,
        imageUrl: normalizedImage || null,
        position: positionValue,
        isActive,
      }
      setSaving(true)
      const saved = editing
        ? await updateAdminPracticeQuestion(question.id, input)
        : await createAdminPracticeQuestion(test.id, input)
      onSaved(saved)
    } catch (cause) {
      setError(errorMessage(cause, 'Не удалось сохранить вопрос'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-3 sm:p-5" onClick={onClose}>
      <section className="max-h-[92dvh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl sm:p-7" onClick={event => event.stopPropagation()} aria-labelledby="assessment-question-form-title">
        <div className="flex items-start justify-between gap-4"><div><h2 id="assessment-question-form-title" className="text-lg font-black text-[#191B23]">{editing ? `Вопрос ${question.position}` : 'Новый вопрос'}</h2><p className="mt-1 max-w-xl text-sm leading-5 text-slate-500">{test.title} · ключ ответа виден только администраторам.</p></div><button type="button" onClick={onClose} disabled={saving} aria-label="Закрыть" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 disabled:opacity-50"><X size={19} aria-hidden="true" /></button></div>

        <div className="mt-6 space-y-4">
          <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-600">Текст вопроса *</span><textarea value={questionText} onChange={event => setQuestionText(event.target.value)} rows={4} maxLength={10_000} placeholder="Сформулируйте задание" className="w-full resize-y rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#1B3F92] focus:ring-2 focus:ring-[#1B3F92]/15" /></label>
          <fieldset><legend className="mb-2 text-xs font-bold text-slate-600">Варианты и правильный ответ *</legend><div className="grid gap-3 sm:grid-cols-2">{ANSWERS.map(answer => <label key={answer} className={`flex gap-2 rounded-xl border p-2 transition-colors ${correctAnswer === answer ? 'border-[#1B3F92] bg-blue-50' : 'border-slate-200 bg-white'}`}><input type="radio" name="correct-answer" value={answer} checked={correctAnswer === answer} onChange={() => setCorrectAnswer(answer)} aria-label={`Правильный вариант ${answer.toUpperCase()}`} className="mt-2" /><span className="min-w-0 flex-1"><span className="mb-1 block text-[11px] font-extrabold uppercase text-slate-500">{answer.toUpperCase()}{correctAnswer === answer ? ' · верный' : ''}</span><input value={options[answer]} onChange={event => setOptions(current => ({ ...current, [answer]: event.target.value }))} maxLength={10_000} placeholder={`Вариант ${answer.toUpperCase()}`} className="min-h-10 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm outline-none focus:border-[#1B3F92]" /></span></label>)}</div></fieldset>
          <div className="grid gap-4 sm:grid-cols-3"><label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-600">Раздел *</span><input value={section} onChange={event => setSection(event.target.value)} maxLength={64} placeholder="algebra" className="min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-[#1B3F92] focus:ring-2 focus:ring-[#1B3F92]/15" /></label><label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-600">Тема</span><input value={topic} onChange={event => setTopic(event.target.value)} maxLength={200} placeholder="Квадратные уравнения" className="min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-[#1B3F92] focus:ring-2 focus:ring-[#1B3F92]/15" /></label><label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-600">Сложность</span><select value={difficulty} onChange={event => setDifficulty(event.target.value as AdminPracticeQuestionDifficulty)} className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#1B3F92] focus:ring-2 focus:ring-[#1B3F92]/15">{(Object.keys(DIFFICULTY_LABELS) as AdminPracticeQuestionDifficulty[]).map(value => <option key={value} value={value}>{DIFFICULTY_LABELS[value]}</option>)}</select></label></div>
          <div className="grid gap-4 sm:grid-cols-[140px_1fr]"><label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-600">Порядок *</span><input type="number" min={1} max={200} value={position} onChange={event => setPosition(event.target.value)} className="min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-[#1B3F92] focus:ring-2 focus:ring-[#1B3F92]/15" /></label><label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-600">HTTPS-ссылка на изображение</span><input type="url" value={imageUrl} onChange={event => setImageUrl(event.target.value)} maxLength={2_048} placeholder="https://..." className="min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-[#1B3F92] focus:ring-2 focus:ring-[#1B3F92]/15" /></label></div>
          <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-600">Объяснение после ответа</span><textarea value={explanation} onChange={event => setExplanation(event.target.value)} rows={3} maxLength={20_000} placeholder="Коротко объясните решение" className="w-full resize-y rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#1B3F92] focus:ring-2 focus:ring-[#1B3F92]/15" /></label>
          <label className="flex items-center gap-2 text-sm font-bold text-slate-700"><input type="checkbox" checked={isActive} onChange={event => setIsActive(event.target.checked)} /> Вопрос активен</label>
          {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-semibold text-red-700">{error}</p>}
        </div>
        <div className="mt-6 flex flex-wrap gap-3"><button type="button" onClick={() => void handleSubmit()} disabled={saving} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#1B3F92] px-5 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"><CheckCircle2 size={17} aria-hidden="true" />{saving ? 'Сохраняем…' : editing ? 'Сохранить вопрос' : 'Добавить вопрос'}</button><button type="button" onClick={onClose} disabled={saving} className="min-h-11 rounded-xl bg-slate-100 px-5 text-sm font-bold text-slate-600 hover:bg-slate-200 disabled:opacity-60">Отмена</button></div>
      </section>
    </div>
  )
}

/**
 * A client-only, cookie-authenticated editor for the own-backend assessment
 * model. Answer keys deliberately stay inside the `/v1/admin/*` DTO and are
 * never requested by a mounted student route.
 */
export default function AdminAssessmentWorkspace({ kind }: AdminAssessmentWorkspaceProps) {
  const [courses, setCourses] = useState<AdminCourse[]>([])
  const [lessons, setLessons] = useState<AdminLesson[]>([])
  const [tests, setTests] = useState<AdminPracticeTest[]>([])
  const [questions, setQuestions] = useState<AdminPracticeQuestion[]>([])
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null)
  const [selectedLessonId, setSelectedLessonId] = useState<number | null>(null)
  const [selectedTestId, setSelectedTestId] = useState<number | null>(null)
  const [coursesLoading, setCoursesLoading] = useState(true)
  const [lessonsLoading, setLessonsLoading] = useState(false)
  const [testsLoading, setTestsLoading] = useState(false)
  const [questionsLoading, setQuestionsLoading] = useState(false)
  const [error, setError] = useState('')
  const [testForm, setTestForm] = useState<TestFormState | null>(null)
  const [questionForm, setQuestionForm] = useState<AdminPracticeQuestion | null | 'create'>(null)
  const courseRequest = useRef(0)
  const lessonRequest = useRef(0)
  const testRequest = useRef(0)
  const questionRequest = useRef(0)

  const selectedCourse = useMemo(() => courses.find(course => course.id === selectedCourseId) ?? null, [courses, selectedCourseId])
  const selectedLesson = useMemo(() => lessons.find(lesson => lesson.id === selectedLessonId) ?? null, [lessons, selectedLessonId])
  const displayTests = useMemo(() => visibleTests(kind, tests), [kind, tests])
  const selectedTest = useMemo(() => displayTests.find(test => test.id === selectedTestId) ?? null, [displayTests, selectedTestId])
  const fixedType = kind === 'mock' ? 'mock' as const : null

  const loadCourses = useCallback(async () => {
    const requestId = courseRequest.current + 1
    courseRequest.current = requestId
    setCoursesLoading(true)
    setError('')
    try {
      const result = await listAdminCourses({ limit: 100 })
      if (courseRequest.current !== requestId) return
      setCourses(result.items)
      setSelectedCourseId(current => result.items.some(course => course.id === current) ? current : result.items[0]?.id ?? null)
    } catch (cause) {
      if (courseRequest.current === requestId) setError(errorMessage(cause, 'Не удалось загрузить курсы'))
    } finally {
      if (courseRequest.current === requestId) setCoursesLoading(false)
    }
  }, [])

  const loadLessons = useCallback(async (courseId: number) => {
    const requestId = lessonRequest.current + 1
    lessonRequest.current = requestId
    setLessonsLoading(true)
    try {
      const result = await listAdminLessons(courseId, { limit: 100 })
      if (lessonRequest.current !== requestId) return
      setLessons(result.items)
      setSelectedLessonId(current => result.items.some(lesson => lesson.id === current) ? current : null)
    } catch (cause) {
      if (lessonRequest.current === requestId) {
        setLessons([])
        setSelectedLessonId(null)
        setError(errorMessage(cause, 'Не удалось загрузить уроки'))
      }
    } finally {
      if (lessonRequest.current === requestId) setLessonsLoading(false)
    }
  }, [])

  const loadTests = useCallback(async (courseId: number, lessonId: number | null) => {
    const requestId = testRequest.current + 1
    testRequest.current = requestId
    setTestsLoading(true)
    setError('')
    try {
      const result = lessonId === null
        ? await listAdminCoursePracticeTests(courseId, { limit: 100 })
        : await listAdminLessonPracticeTests(lessonId, { limit: 100 })
      if (testRequest.current !== requestId) return
      const next = visibleTests(kind, result.items)
      setTests(result.items)
      setSelectedTestId(current => next.some(test => test.id === current) ? current : next[0]?.id ?? null)
    } catch (cause) {
      if (testRequest.current === requestId) {
        setTests([])
        setSelectedTestId(null)
        setError(errorMessage(cause, 'Не удалось загрузить тесты'))
      }
    } finally {
      if (testRequest.current === requestId) setTestsLoading(false)
    }
  }, [kind])

  const loadQuestions = useCallback(async (testId: number) => {
    const requestId = questionRequest.current + 1
    questionRequest.current = requestId
    setQuestionsLoading(true)
    setError('')
    try {
      const result = await listAdminPracticeQuestions(testId, { limit: 100 })
      if (questionRequest.current !== requestId) return
      setQuestions(result.items)
    } catch (cause) {
      if (questionRequest.current === requestId) {
        setQuestions([])
        setError(errorMessage(cause, 'Не удалось загрузить вопросы'))
      }
    } finally {
      if (questionRequest.current === requestId) setQuestionsLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadCourses() }, 0)
    return () => window.clearTimeout(timer)
  }, [loadCourses])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSelectedLessonId(null)
      setSelectedTestId(null)
      setQuestions([])
      if (selectedCourseId === null) {
        lessonRequest.current += 1
        setLessons([])
        return
      }
      void loadLessons(selectedCourseId)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [loadLessons, selectedCourseId])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSelectedTestId(null)
      setQuestions([])
      if (selectedCourseId === null) {
        testRequest.current += 1
        setTests([])
        return
      }
      void loadTests(selectedCourseId, selectedLessonId)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [loadTests, selectedCourseId, selectedLessonId])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuestions([])
      if (selectedTestId === null) {
        questionRequest.current += 1
        return
      }
      void loadQuestions(selectedTestId)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [loadQuestions, selectedTestId])

  const onTestSaved = (saved: AdminPracticeTest) => {
    setTestForm(null)
    setTests(current => {
      const exists = current.some(test => test.id === saved.id)
      return exists ? current.map(test => test.id === saved.id ? saved : test) : [saved, ...current]
    })
    if (kind !== 'mock' || saved.testType === 'mock') setSelectedTestId(saved.id)
  }

  const onQuestionSaved = (saved: AdminPracticeQuestion) => {
    setQuestionForm(null)
    const previous = questions.find(question => question.id === saved.id)
    setQuestions(current => {
      const exists = current.some(question => question.id === saved.id)
      return (exists ? current.map(question => question.id === saved.id ? saved : question) : [...current, saved])
        .sort((left, right) => left.position - right.position || left.id - right.id)
    })
    setTests(current => current.map(test => test.id === saved.practiceTestId ? {
      ...test,
      questionCount: previous ? test.questionCount : test.questionCount + 1,
      activeQuestionCount: previous
        ? test.activeQuestionCount + Number(saved.isActive) - Number(previous.isActive)
        : test.activeQuestionCount + Number(saved.isActive),
    } : test))
  }

  const retry = () => {
    if (selectedCourseId === null) void loadCourses()
    else if (selectedTestId !== null && error) void loadQuestions(selectedTestId)
    else void loadTests(selectedCourseId, selectedLessonId)
  }

  const nextPosition = useMemo(() => nextQuestionPosition(questions), [questions])

  return (
    <div className="min-h-screen bg-[#FAF8FF]">
      <AdminTopbar title={pageTitle(kind)} actionLabel="Новый тест" actionIcon={Plus} onAction={() => selectedCourse && setTestForm({ kind: 'create' })} />
      <main className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6">
        <section className="rounded-2xl border border-blue-100 bg-blue-50/80 p-4 sm:flex sm:items-center sm:justify-between sm:gap-5">
          <div className="flex gap-3"><span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#1B3F92] shadow-sm"><ShieldCheck size={20} aria-hidden="true" /></span><div><h1 className="text-sm font-black text-[#0D1E4A]">Собственный backend Zhangak</h1><p className="mt-1 max-w-3xl text-sm leading-5 text-slate-600">{pageDescription(kind)}</p></div></div>
          <button type="button" disabled={!selectedCourse} onClick={() => selectedCourse && setTestForm({ kind: 'create' })} className="mt-3 inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl bg-[#1B3F92] px-4 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 sm:mt-0"><Plus size={16} aria-hidden="true" />Новый тест</button>
        </section>

        {error && <section role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700"><span>{error}</span><button type="button" onClick={retry} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-white px-3 text-xs font-bold text-red-700 hover:bg-red-100"><RefreshCw size={14} aria-hidden="true" />Повторить</button></section>}

        <section className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:p-5" aria-label="Выбор учебного контекста">
          <label className="block"><span className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-slate-600"><BookOpen size={14} aria-hidden="true" />Курс</span><select value={selectedCourseId ?? ''} disabled={coursesLoading} onChange={event => setSelectedCourseId(event.target.value ? Number(event.target.value) : null)} className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-[#1B3F92] focus:ring-2 focus:ring-[#1B3F92]/15 disabled:bg-slate-50"><option value="">{coursesLoading ? 'Загружаем курсы…' : 'Выберите курс'}</option>{courses.map(course => <option key={course.id} value={course.id}>{course.name}{course.subject ? ` · ${course.subject === 'ort' ? 'Математика + кыргызский язык' : course.subject}` : ''}</option>)}</select></label>
          <label className="block"><span className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-slate-600"><SlidersHorizontal size={14} aria-hidden="true" />Связать с уроком</span><select value={selectedLessonId ?? ''} disabled={!selectedCourse || lessonsLoading} onChange={event => setSelectedLessonId(event.target.value ? Number(event.target.value) : null)} className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-[#1B3F92] focus:ring-2 focus:ring-[#1B3F92]/15 disabled:bg-slate-50"><option value="">{lessonsLoading ? 'Загружаем уроки…' : 'Тест на весь курс'}</option>{lessons.map(lesson => <option key={lesson.id} value={lesson.id}>Урок {lesson.lessonNumber}: {lesson.title}</option>)}</select><p className="mt-1.5 text-xs leading-5 text-slate-400">{selectedLesson ? 'Тест будет доступен только в выбранном уроке.' : 'Курсовой тест не привязан к одному уроку.'}</p></label>
        </section>

        {!coursesLoading && courses.length === 0 ? <section className="rounded-2xl border border-slate-200 bg-white shadow-sm"><EmptyState icon={BookOpen} title="Сначала создайте курс" description="Тесты всегда принадлежат курсу, а при необходимости — конкретному уроку. Создайте структуру программы в разделе «Уроки»." /></section> : selectedCourse === null ? <section className="rounded-2xl border border-slate-200 bg-white shadow-sm"><EmptyState icon={ClipboardList} title="Выберите курс" description="После выбора курса появятся его тесты и защищённый редактор заданий." /></section> : <>
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" aria-labelledby="assessment-tests-title">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-5"><div><h2 id="assessment-tests-title" className="text-base font-black text-[#191B23]">Тесты · {testScopeLabel(selectedLesson)}</h2><p className="mt-0.5 text-sm text-slate-400">{kind === 'mock' ? 'Показываем только тесты типа «Пробный ОРТ».': 'Выберите тест, чтобы работать с его заданиями.'}</p></div>{!testsLoading && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">{displayTests.length}</span>}</div>
            {testsLoading ? <div className="flex items-center justify-center gap-2 px-5 py-10 text-sm font-semibold text-slate-400"><LoaderCircle size={18} className="animate-spin" aria-hidden="true" />Загружаем тесты…</div> : displayTests.length === 0 ? <EmptyState icon={ListChecks} title={kind === 'mock' ? 'Пробных ОРТ пока нет' : 'Тестов пока нет'} description={kind === 'mock' ? 'Создайте первый набор заданий для пробного ОРТ в выбранном учебном контексте.' : 'Создайте тест, затем добавьте в него минимум один активный вопрос перед публикацией.'} action={{ label: 'Создать тест', onClick: () => setTestForm({ kind: 'create' }) }} /> : <div className="divide-y divide-slate-100">{displayTests.map(test => {
              const selected = test.id === selectedTestId
              return <article key={test.id} className={`flex items-center gap-1 px-2 py-2 transition-colors sm:px-3 ${selected ? 'bg-blue-50/80' : 'hover:bg-slate-50'}`}>
                <button type="button" onClick={() => setSelectedTestId(test.id)} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-2 text-left">
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${selected ? 'bg-[#1B3F92] text-white' : 'bg-slate-100 text-slate-500'}`}>{selected ? <CheckCircle2 size={18} aria-hidden="true" /> : <ListChecks size={18} aria-hidden="true" />}</span>
                  <span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2"><span className="truncate text-sm font-black text-[#191B23]">{test.title}</span><TestTypeBadge type={test.testType} />{test.isPublished ? <span className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-extrabold text-emerald-700">Опубликован</span> : <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-extrabold text-slate-500">Черновик</span>}</span><span className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs font-medium text-slate-500"><span>{test.activeQuestionCount}/{test.questionCount} активных</span><span>{test.timeLimitSeconds ? `${Math.ceil(test.timeLimitSeconds / 60)} мин.` : 'Без лимита'}</span><span>До {dateLabel(test.availableUntil)}</span></span></span>
                  <ChevronRight size={18} className="shrink-0 text-slate-400" aria-hidden="true" />
                </button>
                <button type="button" onClick={() => setTestForm({ kind: 'edit', test })} aria-label={`Редактировать тест ${test.title}`} className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-white hover:text-[#1B3F92]"><Pencil size={16} aria-hidden="true" /></button>
              </article>
            })}</div>}
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" aria-labelledby="assessment-questions-title">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-5"><div><h2 id="assessment-questions-title" className="text-base font-black text-[#191B23]">Задания</h2><p className="mt-0.5 text-sm text-slate-400">{selectedTest ? `Тест: ${selectedTest.title}` : 'Сначала выберите тест.'}</p></div><button type="button" disabled={!selectedTest || nextPosition === null} onClick={() => { if (nextPosition !== null) setQuestionForm('create') }} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#1B3F92]/20 bg-white px-3.5 text-sm font-bold text-[#1B3F92] hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"><Plus size={16} aria-hidden="true" />Вопрос</button></div>
            {selectedTest === null ? <EmptyState icon={ClipboardList} title="Выберите тест" description="Здесь появится список заданий и защищённый редактор вариантов ответа." /> : questionsLoading ? <div className="flex items-center justify-center gap-2 px-5 py-10 text-sm font-semibold text-slate-400"><LoaderCircle size={18} className="animate-spin" aria-hidden="true" />Загружаем задания…</div> : questions.length === 0 ? <EmptyState icon={FilePlus2} title="В тесте пока нет заданий" description="Добавьте первый вопрос. Правильный ответ хранится в собственной базе и не передаётся ученику до сдачи попытки." action={nextPosition === null ? undefined : { label: 'Добавить вопрос', onClick: () => setQuestionForm('create') }} /> : <div className="divide-y divide-slate-100">{questions.map(question => <article key={question.id} className="flex gap-3 px-4 py-4 sm:px-5"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-black text-slate-600">{question.position}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2 py-1 text-[11px] font-extrabold ${question.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{question.isActive ? 'Активен' : 'Скрыт'}</span><span className="rounded-full bg-blue-50 px-2 py-1 text-[11px] font-bold text-blue-700">{question.section}</span><span className="rounded-full bg-violet-50 px-2 py-1 text-[11px] font-bold text-violet-700">{DIFFICULTY_LABELS[question.difficulty]}</span>{question.topic && <span className="truncate text-xs font-medium text-slate-500">{question.topic}</span>}</div><p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-6 text-[#191B23]">{question.questionText}</p><p className="mt-2 text-xs font-bold text-emerald-700">Ключ администратора: {question.correctAnswer.toUpperCase()}</p></div><button type="button" onClick={() => setQuestionForm(question)} aria-label={`Редактировать вопрос ${question.position}`} className="h-9 shrink-0 rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-[#1B3F92]"><Pencil size={16} aria-hidden="true" /></button></article>)}</div>}
          </section>
        </>}
      </main>
      {testForm && selectedCourse && <TestFormModal form={testForm} course={selectedCourse} lesson={selectedLesson} fixedType={fixedType} onClose={() => setTestForm(null)} onSaved={onTestSaved} />}
      {questionForm && questionForm !== null && selectedTest && (questionForm !== 'create' || nextPosition !== null) && <QuestionFormModal question={questionForm === 'create' ? null : questionForm} test={selectedTest} nextPosition={questionForm === 'create' ? nextPosition! : questionForm.position} onClose={() => setQuestionForm(null)} onSaved={onQuestionSaved} />}
    </div>
  )
}
