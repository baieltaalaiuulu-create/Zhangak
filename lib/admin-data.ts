import { supabase } from '@/lib/supabase'
import { DEFAULT_TARGET_SCORE } from '@/lib/student-data'

// ── Suggested schema additions (NOT applied — run manually if desired) ─────
// ALTER TABLE profiles ADD COLUMN price integer;
// ALTER TABLE profiles ADD COLUMN next_payment_date date;
// ALTER TABLE payments ADD COLUMN method varchar(20);
// ALTER TABLE practice_lessons ADD COLUMN status varchar(20) DEFAULT 'draft'; -- tri-state active/draft/locked
// Until these exist: price / next_payment_date are collected in the Add Student
// form but not persisted; payment method is folded into payments.note as a
// "[label] comment" prefix; lesson status is derived from whether a linked
// practice_tests row is is_active.

export const SUBJECT_LABELS: Record<'math' | 'kyr', string> = {
  math: 'Математика',
  kyr: 'Кыргыз тили',
}

export const SECTION_OPTIONS: { value: string; label: string }[] = [
  { value: 'general', label: 'Жалпы' },
  { value: 'comparison', label: 'Салыштыруу' },
  { value: 'math', label: 'Математика' },
  { value: 'analogy', label: 'Аналогия' },
  { value: 'reading', label: 'Окуу' },
  { value: 'grammar', label: 'Грамматика' },
]

export const PAYMENT_METHODS: { value: string; label: string }[] = [
  { value: 'cash', label: 'Нак акча' },
  { value: 'transfer', label: 'Которуу' },
  { value: 'elsom', label: 'Элсом' },
  { value: 'mbank', label: 'MBank' },
]

export const STUDENT_TYPES: { value: string; label: string }[] = [
  { value: 'offline', label: 'Оффлайн' },
  { value: 'online', label: 'Онлайн' },
  { value: 'both', label: 'Экөө тең' },
]

// ── Dashboard ────────────────────────────────────────────────────────────

export interface DashboardStats {
  totalStudents: number
  activeToday: number
  lessonsLoaded: number
  testsCompleted: number
}

export interface ActivityItem {
  id: number
  studentName: string
  testTitle: string
  score: number
  completedAt: string
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const [
    { count: totalStudents },
    { data: todayRows },
    { count: lessonsLoaded },
    { count: testsCompleted },
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'student'),
    supabase.from('practice_results').select('student_id').gte('completed_at', todayStart.toISOString()).not('completed_at', 'is', null),
    supabase.from('practice_lessons').select('*', { count: 'exact', head: true }),
    supabase.from('practice_results').select('*', { count: 'exact', head: true }).not('completed_at', 'is', null),
  ])

  const activeToday = new Set((todayRows ?? []).map(r => r.student_id)).size

  return {
    totalStudents: totalStudents ?? 0,
    activeToday,
    lessonsLoaded: lessonsLoaded ?? 0,
    testsCompleted: testsCompleted ?? 0,
  }
}

interface ActivityRow {
  id: number
  total_score: number | null
  completed_at: string
  test_type: string
  profiles: { full_name: string | null } | null
  practice_tests: { title: string | null } | null
}

export async function fetchRecentActivity(): Promise<ActivityItem[]> {
  const { data } = await supabase
    .from('practice_results')
    .select('id, total_score, completed_at, test_type, profiles(full_name), practice_tests(title)')
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(5)

  const rows = (data ?? []) as unknown as ActivityRow[]
  return rows.map(r => ({
    id: r.id,
    studentName: r.profiles?.full_name ?? 'Студент',
    testTitle: r.practice_tests?.title ?? (r.test_type === 'mock' ? 'Пробный ОРТ' : 'Практика'),
    score: Math.round(r.total_score ?? 0),
    completedAt: r.completed_at,
  }))
}

// ── Students ─────────────────────────────────────────────────────────────

export interface AdminStudent {
  id: string
  full_name: string
  email: string | null
  phone: string | null
  student_type: string
  target_score: number
  created_at: string
  groupName: string | null
  courseName: string | null
  paidThisMonth: number
  paymentStatus: 'paid' | 'partial' | 'debt'
  blocked: boolean
}

export interface CourseOption { id: number; name: string }
export interface GroupOption { id: number; name: string; course_id: number | null }

export async function fetchCourseOptions(): Promise<CourseOption[]> {
  const { data } = await supabase.from('courses').select('id, name').order('name')
  return data ?? []
}

export async function fetchGroupOptions(): Promise<GroupOption[]> {
  const { data } = await supabase.from('groups').select('id, name, course_id').order('name')
  return data ?? []
}

interface GroupLinkRow {
  student_id: string
  groups: { name: string | null; courses: { name: string | null } | null } | null
}

interface PaymentRow {
  student_id: string
  amount: number
  status: string
}

interface AuthUserInfo {
  email: string | null
  blocked: boolean
}

export async function fetchAuthUsers(): Promise<Map<string, AuthUserInfo>> {
  const map = new Map<string, AuthUserInfo>()
  try {
    const res = await fetch('/api/list-users')
    if (!res.ok) return map
    const data = await res.json() as { users: { id: string; email: string | null; banned_until: string | null }[] }
    for (const u of data.users ?? []) {
      map.set(u.id, {
        email: u.email,
        blocked: !!u.banned_until && new Date(u.banned_until) > new Date(),
      })
    }
  } catch {
    // best-effort enrichment only
  }
  return map
}

export async function fetchStudents(): Promise<AdminStudent[]> {
  const monthStr = new Date().toISOString().slice(0, 7)

  const [{ data: profiles }, { data: groupLinksRaw }, { data: paymentsRaw }, authMap] = await Promise.all([
    supabase.from('profiles').select('*').eq('role', 'student').order('full_name'),
    supabase.from('group_students').select('student_id, groups(name, courses(name))'),
    supabase.from('payments').select('student_id, amount, status').eq('month', monthStr),
    fetchAuthUsers(),
  ])

  const groupLinks = (groupLinksRaw ?? []) as unknown as GroupLinkRow[]
  const payments = (paymentsRaw ?? []) as unknown as PaymentRow[]

  const groupByStudent = new Map<string, { group: string | null; course: string | null }>()
  for (const g of groupLinks) {
    if (!groupByStudent.has(g.student_id)) {
      groupByStudent.set(g.student_id, {
        group: g.groups?.name ?? null,
        course: g.groups?.courses?.name ?? null,
      })
    }
  }

  const paymentsByStudent = new Map<string, PaymentRow[]>()
  for (const p of payments) {
    const list = paymentsByStudent.get(p.student_id) ?? []
    list.push(p)
    paymentsByStudent.set(p.student_id, list)
  }

  return (profiles ?? []).map(p => {
    const g = groupByStudent.get(p.id)
    const pays = paymentsByStudent.get(p.id) ?? []
    const paidThisMonth = pays.filter(x => x.status === 'paid').reduce((s, x) => s + (x.amount ?? 0), 0)
    const paymentStatus: AdminStudent['paymentStatus'] =
      pays.some(x => x.status === 'paid') ? 'paid' :
      pays.some(x => x.status === 'partial') ? 'partial' : 'debt'
    const auth = authMap.get(p.id)

    return {
      id: p.id,
      full_name: p.full_name ?? '—',
      email: auth?.email ?? null,
      phone: p.phone,
      student_type: p.student_type ?? 'offline',
      target_score: p.target_score ?? DEFAULT_TARGET_SCORE,
      created_at: p.created_at,
      groupName: g?.group ?? null,
      courseName: g?.course ?? null,
      paidThisMonth,
      paymentStatus,
      blocked: auth?.blocked ?? false,
    }
  })
}

// group_students carries an admin/admin_jr/manager/director-only RLS write policy,
// so assignment goes through app/api/admin/group-students (service-role) instead
// of the anon client.
export async function assignStudentGroup(studentId: string, groupId: number): Promise<void> {
  const res = await fetch('/api/admin/group-students', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ studentId, groupId }),
  })
  const data = await res.json()
  if (!res.ok || data.error) throw new Error(data.error ?? 'Failed to assign group')
}

export async function removeStudentGroup(studentId: string): Promise<void> {
  const res = await fetch('/api/admin/group-students', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ studentId }),
  })
  const data = await res.json()
  if (!res.ok || data.error) throw new Error(data.error ?? 'Failed to remove group')
}

export interface NewStudentPayload {
  full_name: string
  phone: string
  email: string
  password: string
  student_type: string
  target_score: number
  group_id: number | null
  initial_paid_amount: number
}

export async function createStudent(payload: NewStudentPayload): Promise<string> {
  const res = await fetch('/api/create-user', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      full_name: payload.full_name,
      email: payload.email,
      password: payload.password,
      phone: payload.phone,
      role: 'student',
      student_type: payload.student_type,
      target_score: payload.target_score,
    }),
  })
  const data = await res.json()
  if (!res.ok || data.error) throw new Error(data.error ?? 'Failed to create student')
  const studentId = data.id as string

  if (payload.group_id) {
    await assignStudentGroup(studentId, payload.group_id)
  }
  if (payload.initial_paid_amount > 0) {
    const monthStr = new Date().toISOString().slice(0, 7)
    await supabase.from('payments').insert({
      student_id: studentId,
      amount: payload.initial_paid_amount,
      month: monthStr,
      status: 'paid',
      note: 'Баштапкы төлөм',
    })
  }
  return studentId
}

export interface NewPaymentPayload {
  student_id: string
  amount: number
  method: string
  date: string
  comment: string
}

export async function addPayment(payload: NewPaymentPayload): Promise<void> {
  const monthStr = payload.date.slice(0, 7)
  const methodLabel = PAYMENT_METHODS.find(m => m.value === payload.method)?.label ?? payload.method
  const note = payload.comment ? `[${methodLabel}] ${payload.comment}` : `[${methodLabel}]`
  const { error } = await supabase.from('payments').insert({
    student_id: payload.student_id,
    amount: payload.amount,
    month: monthStr,
    status: 'paid',
    note,
  })
  if (error) throw new Error(error.message)
}

export async function setStudentBlocked(id: string, blocked: boolean): Promise<void> {
  const res = await fetch('/api/block-user', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, blocked }),
  })
  const data = await res.json()
  if (!res.ok || data.error) throw new Error(data.error ?? 'Failed to update block status')
}

export async function deleteStudent(id: string): Promise<void> {
  await removeStudentGroup(id)
  await supabase.from('payments').delete().eq('student_id', id)
  const res = await fetch('/api/delete-user', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  })
  const data = await res.json()
  if (!res.ok || data.error) throw new Error(data.error ?? 'Failed to delete student')
  await supabase.from('profiles').delete().eq('id', id)
}

// ── Lessons ──────────────────────────────────────────────────────────────

export interface AdminLesson {
  id: string
  title: string
  subject: 'math' | 'kyr'
  description: string | null
  video_url: string | null
  order_number: number
  created_at: string
  questionCount: number
  status: 'active' | 'draft'
}

interface LessonRow {
  id: string
  title: string
  subject: 'math' | 'kyr'
  description: string | null
  video_url: string | null
  order_number: number
  created_at: string
}

interface LessonTestRow {
  id: number
  lesson_id: string | null
  is_active: boolean
}

export async function fetchLessons(): Promise<AdminLesson[]> {
  const [{ data: lessonsRaw }, { data: testsRaw }, { data: questionsRaw }] = await Promise.all([
    supabase.from('practice_lessons').select('*').order('subject').order('order_number'),
    supabase.from('practice_tests').select('id, lesson_id, is_active').eq('type', 'practice').not('lesson_id', 'is', null),
    supabase.from('questions').select('practice_test_id'),
  ])

  const lessons = (lessonsRaw ?? []) as LessonRow[]
  const tests = (testsRaw ?? []) as LessonTestRow[]
  const questions = (questionsRaw ?? []) as { practice_test_id: number }[]

  const testByLesson = new Map<string, LessonTestRow>()
  for (const t of tests) {
    if (t.lesson_id) testByLesson.set(t.lesson_id, t)
  }

  const countByTest = new Map<number, number>()
  for (const q of questions) {
    countByTest.set(q.practice_test_id, (countByTest.get(q.practice_test_id) ?? 0) + 1)
  }

  return lessons.map(l => {
    const test = testByLesson.get(l.id)
    return {
      ...l,
      questionCount: test ? (countByTest.get(test.id) ?? 0) : 0,
      status: test?.is_active ? 'active' : 'draft',
    }
  })
}

export async function fetchLessonById(id: string): Promise<LessonRow | null> {
  const { data } = await supabase.from('practice_lessons').select('*').eq('id', id).single()
  return data ?? null
}

export interface LessonForTest { id: string; title: string; subject: 'math' | 'kyr' }

// practice_tests has an RLS write policy scoped to admin/admin_jr roles that
// rejects inserts/updates from the browser's anon-key client in practice, so
// find-or-create (and the active-flag toggle below) go through a server-side
// route using the service-role key instead — see app/api/admin/ensure-practice-test.
async function callEnsurePracticeTest(lesson: LessonForTest, setActive?: boolean): Promise<{ id: number; is_active: boolean }> {
  const res = await fetch('/api/admin/ensure-practice-test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lessonId: lesson.id, title: lesson.title, subject: lesson.subject, setActive }),
  })
  const data = await res.json()
  if (!res.ok || data.error) throw new Error(data.error ?? 'Failed to ensure practice test')
  return data.test
}

export async function ensurePracticeTestForLesson(lesson: LessonForTest): Promise<{ id: number; is_active: boolean }> {
  return callEnsurePracticeTest(lesson)
}

export interface NewLessonPayload {
  title: string
  description: string
  subject: 'math' | 'kyr'
  order_number: number
  video_url: string
}

// practice_lessons carries the same admin-only RLS write policy as practice_tests,
// so create/update/delete go through app/api/admin/lessons (service-role) instead
// of writing directly with the anon-key client.
export async function createLesson(payload: NewLessonPayload, activate: boolean): Promise<string> {
  const res = await fetch('/api/admin/lessons', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await res.json()
  if (!res.ok || data.error) throw new Error(data.error ?? 'Failed to create lesson')
  const lesson = data.lesson as LessonForTest

  if (activate) {
    await callEnsurePracticeTest(lesson, true)
  }

  return lesson.id
}

export interface UpdateLessonPayload extends NewLessonPayload { id: string }

export async function updateLesson(payload: UpdateLessonPayload): Promise<void> {
  const res = await fetch('/api/admin/lessons', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await res.json()
  if (!res.ok || data.error) throw new Error(data.error ?? 'Failed to update lesson')
}

export async function setLessonActive(lesson: LessonForTest, active: boolean): Promise<void> {
  await callEnsurePracticeTest(lesson, active)
}

export async function deleteLesson(id: string): Promise<void> {
  const res = await fetch('/api/admin/lessons', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  })
  const data = await res.json()
  if (!res.ok || data.error) throw new Error(data.error ?? 'Failed to delete lesson')
}

// ── Practice Tests ───────────────────────────────────────────────────────

export interface AdminPracticeTest {
  id: number
  title: string
  subject: 'math' | 'kyr' | 'all'
  lessonId: string | null
  lessonTitle: string | null
  timeLimitMinutes: number | null
  maxAttempts: number
  isActive: boolean
  questionCount: number
  createdAt: string
}

interface PracticeTestRow {
  id: number
  title: string
  subject: 'math' | 'kyr' | 'all'
  lesson_id: string | null
  time_limit_minutes: number | null
  max_attempts: number | null
  is_active: boolean | null
  created_at: string
  practice_lessons: { title: string | null } | null
}

export async function fetchPracticeTests(): Promise<AdminPracticeTest[]> {
  const [{ data: testsRaw }, { data: questionsRaw }] = await Promise.all([
    supabase
      .from('practice_tests')
      .select('id, title, subject, lesson_id, time_limit_minutes, max_attempts, is_active, created_at, practice_lessons(title)')
      .eq('type', 'practice')
      .order('created_at', { ascending: false }),
    supabase.from('questions').select('practice_test_id'),
  ])

  const countByTest = new Map<number, number>()
  for (const q of (questionsRaw ?? []) as { practice_test_id: number }[]) {
    countByTest.set(q.practice_test_id, (countByTest.get(q.practice_test_id) ?? 0) + 1)
  }

  const tests = (testsRaw ?? []) as unknown as PracticeTestRow[]
  return tests.map(t => ({
    id: t.id,
    title: t.title,
    subject: t.subject,
    lessonId: t.lesson_id,
    lessonTitle: t.practice_lessons?.title ?? null,
    timeLimitMinutes: t.time_limit_minutes,
    maxAttempts: t.max_attempts ?? 1,
    isActive: !!t.is_active,
    questionCount: countByTest.get(t.id) ?? 0,
    createdAt: t.created_at,
  }))
}

export interface PracticeTestPayload {
  title: string
  subject: 'math' | 'kyr' | 'all'
  lessonId: string | null
  timeLimitMinutes: number | null
  maxAttempts: number
  isActive: boolean
}

// practice_tests carries the same admin-only RLS write policy as practice_lessons
// and questions, so create/update/delete go through app/api/admin/practice-tests
// (service-role) instead of the anon client — see lib/admin-data.ts's Lessons
// section above for the identical pattern.
export async function createPracticeTest(payload: PracticeTestPayload): Promise<void> {
  const res = await fetch('/api/admin/practice-tests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await res.json()
  if (!res.ok || data.error) throw new Error(data.error ?? 'Failed to create practice test')
}

export async function updatePracticeTest(id: number, payload: PracticeTestPayload): Promise<void> {
  const res = await fetch('/api/admin/practice-tests', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, ...payload }),
  })
  const data = await res.json()
  if (!res.ok || data.error) throw new Error(data.error ?? 'Failed to update practice test')
}

export async function setPracticeTestActive(id: number, isActive: boolean): Promise<void> {
  const res = await fetch('/api/admin/practice-tests', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, isActive }),
  })
  const data = await res.json()
  if (!res.ok || data.error) throw new Error(data.error ?? 'Failed to update practice test')
}

export async function deletePracticeTest(id: number): Promise<void> {
  const res = await fetch('/api/admin/practice-tests', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  })
  const data = await res.json()
  if (!res.ok || data.error) throw new Error(data.error ?? 'Failed to delete practice test')
}

// ── Questions ────────────────────────────────────────────────────────────

export interface AdminQuestion {
  id: number
  practice_test_id: number
  question_text: string | null
  option_a: string | null
  option_b: string | null
  option_c: string | null
  option_d: string | null
  correct_answer: string
  section: string
  order_num: number
}

export async function fetchQuestionsForTest(testId: number): Promise<AdminQuestion[]> {
  const { data } = await supabase.from('questions').select('*').eq('practice_test_id', testId).order('order_num')
  return data ?? []
}

export interface QuestionPayload {
  question_text: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  correct_answer: 'A' | 'B' | 'C' | 'D'
  section: string
  // Only meaningful for standalone bank questions (see the Question Bank
  // section below). Left undefined by the lesson-tied question form — the
  // API route spreads payload straight into the insert/update, so omitted
  // keys simply fall back to the column defaults (difficulty='medium',
  // topic=null) rather than needing separate routes per question type.
  topic?: string | null
  difficulty?: 'easy' | 'medium' | 'hard'
}

// questions carries the same admin-only RLS write policy, so create/update/delete
// go through app/api/admin/questions (service-role) instead of the anon client.
export async function addQuestion(testId: number, payload: QuestionPayload, orderNum: number): Promise<void> {
  const res = await fetch('/api/admin/questions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ testId, payload, orderNum }),
  })
  const data = await res.json()
  if (!res.ok || data.error) throw new Error(data.error ?? 'Failed to add question')
}

export async function updateQuestion(id: number, payload: QuestionPayload): Promise<void> {
  const res = await fetch('/api/admin/questions', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, payload }),
  })
  const data = await res.json()
  if (!res.ok || data.error) throw new Error(data.error ?? 'Failed to update question')
}

export async function deleteQuestion(id: number): Promise<void> {
  const res = await fetch('/api/admin/questions', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  })
  const data = await res.json()
  if (!res.ok || data.error) throw new Error(data.error ?? 'Failed to delete question')
}

// ── Question Bank ("Банк вопросов" — standalone, not tied to any lesson) ──
//
// The bank keeps exactly one practice_test row per subject bucket
// (lesson_id=null), matching the spec's "create a general practice_test per
// subject if not exists". `section` is the finer-grained axis (math /
// comparison / analogy / reading / grammar) that determines which bucket a
// question belongs to — 'general' is excluded since it's invisible to ORT
// scoring (see the project-wide gotcha in lib/student-data.ts) and isn't a
// real practice topic.

export const BANK_SECTION_OPTIONS = SECTION_OPTIONS.filter(s => s.value !== 'general')

export const SECTION_TO_BANK_SUBJECT: Record<string, 'math' | 'kyr' | 'all'> = {
  math: 'math',
  comparison: 'math',
  grammar: 'kyr',
  analogy: 'all',
  reading: 'all',
}

const BANK_SUBJECT_TITLES: Record<'math' | 'kyr' | 'all', string> = {
  math: 'Банк вопросов — Математика',
  kyr: 'Банк вопросов — Кыргыз тили',
  all: 'Банк вопросов — Аналогия и Окуу',
}

export const DIFFICULTY_OPTIONS: { value: 'easy' | 'medium' | 'hard'; label: string }[] = [
  { value: 'easy', label: 'Лёгкий' },
  { value: 'medium', label: 'Средний' },
  { value: 'hard', label: 'Сложный' },
]

// practice_tests carries the same admin-only RLS write policy as elsewhere, so
// find-or-create for the standalone bank tests goes through
// app/api/admin/bank-test (service-role) — mirrors callEnsurePracticeTest
// above for lesson-linked tests.
export async function ensureBankTest(subject: 'math' | 'kyr' | 'all'): Promise<{ id: number }> {
  const res = await fetch('/api/admin/bank-test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subject, title: BANK_SUBJECT_TITLES[subject] }),
  })
  const data = await res.json()
  if (!res.ok || data.error) throw new Error(data.error ?? 'Failed to ensure bank test')
  return data.test
}

export interface BankQuestion {
  id: number
  question_text: string | null
  option_a: string | null
  option_b: string | null
  option_c: string | null
  option_d: string | null
  correct_answer: string
  section: string
  topic: string | null
  difficulty: string
  subject: 'math' | 'kyr' | 'all'
}

interface BankQuestionRow {
  id: number
  question_text: string | null
  option_a: string | null
  option_b: string | null
  option_c: string | null
  option_d: string | null
  correct_answer: string
  section: string
  topic: string | null
  difficulty: string | null
  practice_tests: { subject: 'math' | 'kyr' | 'all' } | null
}

export async function fetchBankQuestions(): Promise<BankQuestion[]> {
  const { data } = await supabase
    .from('questions')
    .select('id, question_text, option_a, option_b, option_c, option_d, correct_answer, section, topic, difficulty, created_at, practice_tests!inner(subject, lesson_id)')
    .is('practice_tests.lesson_id', null)
    .order('created_at', { ascending: false })

  const rows = (data ?? []) as unknown as BankQuestionRow[]
  return rows.map(r => ({
    id: r.id,
    question_text: r.question_text,
    option_a: r.option_a,
    option_b: r.option_b,
    option_c: r.option_c,
    option_d: r.option_d,
    correct_answer: r.correct_answer,
    section: r.section,
    topic: r.topic,
    difficulty: r.difficulty ?? 'medium',
    subject: r.practice_tests?.subject ?? 'all',
  }))
}

export interface BankQuestionPayload extends QuestionPayload {
  topic: string
  difficulty: 'easy' | 'medium' | 'hard'
}

export async function addBankQuestion(payload: BankQuestionPayload): Promise<void> {
  const subject = SECTION_TO_BANK_SUBJECT[payload.section]
  if (!subject) throw new Error(`Раздел "${payload.section}" недоступен для банка вопросов`)
  const test = await ensureBankTest(subject)
  await addQuestion(test.id, payload, 0)
}

export interface BulkAddResult {
  inserted: number
  errors: string[]
}

// Sequential, per-item error isolation — a single bad row in a pasted batch
// shouldn't sink the rest, and reuses the same service-role /api/admin/questions
// route rather than adding a new bulk endpoint.
export async function bulkAddBankQuestions(items: BankQuestionPayload[]): Promise<BulkAddResult> {
  const testCache = new Map<string, number>()
  let inserted = 0
  const errors: string[] = []

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    try {
      const subject = SECTION_TO_BANK_SUBJECT[item.section]
      if (!subject) throw new Error(`раздел "${item.section}" недоступен`)

      let testId = testCache.get(subject)
      if (!testId) {
        const test = await ensureBankTest(subject)
        testId = test.id
        testCache.set(subject, testId)
      }
      await addQuestion(testId, item, 0)
      inserted++
    } catch (e) {
      errors.push(`#${i + 1}: ${e instanceof Error ? e.message : 'ошибка'}`)
    }
  }

  return { inserted, errors }
}
