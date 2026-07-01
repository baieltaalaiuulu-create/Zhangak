'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import {
  GraduationCap, FileText, BookOpen, LogOut, Menu,
  Plus, Trash2, CheckCircle, AlertCircle, Upload,
  Image, ChevronRight, X, Users
} from 'lucide-react'

type Tab = 'students' | 'tests' | 'lessons'

const TABS: { id: Tab; label: string; Icon: any }[] = [
  { id: 'students', label: 'Окуучулар', Icon: GraduationCap },
  { id: 'tests',    label: 'Тесттер',   Icon: FileText },
  { id: 'lessons',  label: 'Сабактар',  Icon: BookOpen },
]

const BLUE = '#1B4FD8'
const BG   = '#F4F6FA'
const inp: React.CSSProperties = { width: '100%', padding: '9px 12px', borderRadius: 9, border: '1px solid #E8ECF0', background: '#F9FAFB', color: '#111827', fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'Inter, sans-serif' }
const sel: React.CSSProperties = { ...inp, cursor: 'pointer' }

function Avatar({ name, size = 30 }: { name: string; size?: number }) {
  const colors = [BLUE, '#7C3AED', '#EC4899', '#F59E0B', '#10B981', '#EF4444']
  const bg = colors[(name?.charCodeAt(0) || 0) % colors.length]
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.38, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
      {(name || '?').slice(0, 1).toUpperCase()}
    </div>
  )
}

function Card({ children, style: s = {} }: any) {
  return <div style={{ background: '#fff', border: '1px solid #E8ECF0', borderRadius: 14, ...s }}>{children}</div>
}

function THead({ cols }: { cols: string[] }) {
  return (
    <thead>
      <tr style={{ background: '#F9FAFB' }}>
        {cols.map(c => (
          <th key={c} style={{ textAlign: 'left', padding: '9px 16px', color: '#9CA3AF', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' as const, borderBottom: '1px solid #E8ECF0', letterSpacing: '0.4px' }}>{c}</th>
        ))}
      </tr>
    </thead>
  )
}

export default function AdminJrPage() {
  const [tab, setTab]           = useState<Tab>('students')
  const [students, setStudents] = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const router = useRouter()

  useEffect(() => { checkAuth() }, [])

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }
    const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (!prof || !['admin_jr', 'admin', 'super_admin'].includes(prof.role)) {
      await supabase.auth.signOut(); router.push('/'); return
    }
    fetchStudents()
  }

  const fetchStudents = async () => {
    const { data } = await supabase.from('profiles').select('*').eq('role', 'student').order('full_name')
    setStudents(data || [])
    setLoading(false)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: BG, fontFamily: 'Inter, sans-serif' }}>
      <div style={{ color: '#9CA3AF', fontSize: 14 }}>Жүктөлүүдө...</div>
    </div>
  )

  const SidebarContent = () => (
    <>
      <div style={{ padding: '18px 16px 14px', borderBottom: '1px solid #E8ECF0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{ width: 30, height: 30, background: BLUE, borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
            <img src="/images/logo.png" alt="Z" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 14, color: '#111827', letterSpacing: '-0.3px' }}>Zhangak</div>
            <div style={{ fontSize: 10, color: '#9CA3AF' }}>Admin кабинети</div>
          </div>
        </div>
      </div>

      <nav style={{ padding: '8px 8px', flex: 1 }}>
        {TABS.map(({ id, label, Icon }) => {
          const active = tab === id
          return (
            <button key={id} onClick={() => { setTab(id); setSidebarOpen(false) }}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', marginBottom: 1, textAlign: 'left' as const, background: active ? '#EEF2FF' : 'transparent', color: active ? BLUE : '#6B7280', fontWeight: active ? 600 : 400, fontSize: 13, transition: 'all 0.15s', fontFamily: 'Inter, sans-serif' }}>
              <Icon size={16} strokeWidth={active ? 2.5 : 2} />
              {label}
              {active && <div style={{ marginLeft: 'auto', width: 5, height: 5, borderRadius: '50%', background: BLUE }} />}
            </button>
          )
        })}
      </nav>

      <div style={{ padding: '8px', borderTop: '1px solid #E8ECF0' }}>
        <button onClick={async () => { await supabase.auth.signOut(); router.push('/') }}
          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'transparent', color: '#EF4444', fontSize: 13, fontWeight: 500, fontFamily: 'Inter, sans-serif' }}>
          <LogOut size={16} /> Чыгуу
        </button>
      </div>
    </>
  )

  return (
    <div style={{ minHeight: '100vh', background: BG, fontFamily: 'Inter, -apple-system, sans-serif', color: '#111827', display: 'flex' }}>
      <style>{`
        *{box-sizing:border-box}
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
        .fade{animation:fadeUp 0.28s ease both}
        .desktop-sb{display:flex;flex-direction:column}
        .mobile-bar{display:none}
        .main{margin-left:210px}
        @media(max-width:900px){
          .desktop-sb{display:none!important}
          .mobile-bar{display:flex!important}
          .main{margin-left:0!important}
          .pad{padding:16px 14px 30px!important;padding-top:62px!important}
          .g2{grid-template-columns:1fr!important}
          .test-layout{grid-template-columns:1fr!important}
        }
      `}</style>

      {/* Desktop Sidebar */}
      <aside className="desktop-sb" style={{ width: 210, background: '#fff', borderRight: '1px solid #E8ECF0', position: 'fixed', top: 0, left: 0, height: '100vh', zIndex: 200 }}>
        <SidebarContent />
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <>
          <div onClick={() => setSidebarOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 300 }} />
          <aside style={{ width: 230, background: '#fff', display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, left: 0, height: '100vh', zIndex: 400, boxShadow: '4px 0 20px rgba(0,0,0,0.12)' }}>
            <SidebarContent />
          </aside>
        </>
      )}

      {/* Mobile topbar */}
      <div className="mobile-bar" style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 52, background: '#fff', borderBottom: '1px solid #E8ECF0', display: 'none', alignItems: 'center', justifyContent: 'space-between', padding: '0 14px', zIndex: 150 }}>
        <button onClick={() => setSidebarOpen(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#111827', display: 'flex' }}><Menu size={20} /></button>
        <span style={{ fontWeight: 800, fontSize: 14, color: BLUE }}>Zhangak Admin</span>
        <div style={{ width: 28 }} />
      </div>

      {/* Main */}
      <main className="main" style={{ flex: 1 }}>
        <header style={{ background: '#fff', borderBottom: '1px solid #E8ECF0', padding: '0 28px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: BLUE }} />
            <span style={{ fontWeight: 700, fontSize: 16, color: '#111827' }}>{TABS.find(t => t.id === tab)?.label}</span>
          </div>
          <div style={{ background: '#EEF2FF', borderRadius: 8, padding: '4px 12px', fontSize: 12, color: BLUE, fontWeight: 600 }}>Admin</div>
        </header>

        <div className="pad" style={{ padding: '24px 28px' }}>

          {/* ══ STUDENTS ══ */}
          {tab === 'students' && (
            <div className="fade">
              <AddStudentForm onAdded={fetchStudents} />
              <Card style={{ overflow: 'hidden', marginTop: 18 }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid #E8ECF0', fontWeight: 600, fontSize: 13 }}>
                  Окуучулар ({students.length})
                </div>
                <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                  <THead cols={['Аты-жөнү', 'Телефон', 'Түрү', 'Катталган']} />
                  <tbody>
                    {students.map((s, i) => (
                      <tr key={s.id} style={{ borderBottom: i < students.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
                        <td style={{ padding: '11px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                            <Avatar name={s.full_name || '?'} />
                            <span style={{ fontWeight: 600 }}>{s.full_name}</span>
                          </div>
                        </td>
                        <td style={{ padding: '11px 16px', color: '#6B7280' }}>{s.phone || '—'}</td>
                        <td style={{ padding: '11px 16px' }}>
                          <span style={{
                            background: s.student_type === 'online' ? '#F0FDF4' : s.student_type === 'both' ? '#F5F3FF' : '#EEF2FF',
                            color: s.student_type === 'online' ? '#10B981' : s.student_type === 'both' ? '#7C3AED' : BLUE,
                            borderRadius: 6, padding: '2px 9px', fontSize: 11, fontWeight: 700
                          }}>
                            {s.student_type === 'online' ? 'Онлайн' : s.student_type === 'both' ? 'Экөө' : 'Оффлайн'}
                          </span>
                        </td>
                        <td style={{ padding: '11px 16px', color: '#9CA3AF', fontSize: 12 }}>
                          {new Date(s.created_at).toLocaleDateString('ru')}
                        </td>
                      </tr>
                    ))}
                    {students.length === 0 && (
                      <tr><td colSpan={4} style={{ padding: 28, textAlign: 'center', color: '#9CA3AF' }}>Окуучулар жок</td></tr>
                    )}
                  </tbody>
                </table>
              </Card>
            </div>
          )}

          {/* ══ TESTS ══ */}
          {tab === 'tests' && <AdminTests />}

          {/* ══ LESSONS ══ */}
          {tab === 'lessons' && <AdminLessons />}

        </div>
      </main>
    </div>
  )
}

// ─── Add Student Form ─────────────────────────────────────────────────────────
function AddStudentForm({ onAdded }: { onAdded: () => void }) {
  const [show, setShow]       = useState(false)
  const [form, setForm]       = useState({ full_name: '', email: '', password: '', phone: '', student_type: 'offline' })
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')
  const [success, setSuccess] = useState('')

  const handleSubmit = async () => {
    if (!form.full_name || !form.email || !form.password) { setError('Бардык талааларды толтуруңуз'); return }
    setSaving(true); setError(''); setSuccess('')
    const res = await fetch('/api/create-user', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, role: 'student' })
    })
    const data = await res.json()
    if (data.error) { setError(data.error) }
    else {
      setSuccess('Окуучу кошулду')
      setForm({ full_name: '', email: '', password: '', phone: '', student_type: 'offline' })
      setShow(false); onAdded()
    }
    setSaving(false)
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0, letterSpacing: '-0.3px' }}>Окуучулар</h2>
        <button onClick={() => { setShow(p => !p); setError(''); setSuccess('') }}
          style={{ background: BLUE, color: '#fff', border: 'none', borderRadius: 9, padding: '9px 18px', fontWeight: 600, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'Inter, sans-serif' }}>
          <Plus size={15} /> Окуучу кошуу
        </button>
      </div>

      {success && (
        <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 10, padding: '10px 14px', marginBottom: 12, color: '#10B981', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 7 }}>
          <CheckCircle size={15} /> {success}
        </div>
      )}

      {show && (
        <Card style={{ padding: 20, marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16 }}>Жаңы окуучу</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            {[
              { label: 'АТЫ-ЖӨНҮ *', key: 'full_name', placeholder: 'Иванов Айбек', type: 'text' },
              { label: 'ТЕЛЕФОН',     key: 'phone',     placeholder: '+996 700 000 000', type: 'text' },
              { label: 'EMAIL *',     key: 'email',     placeholder: 'user@gmail.com', type: 'email' },
              { label: 'СЫРСӨЗ *',   key: 'password',  placeholder: 'Мин. 6 символ', type: 'password' },
            ].map(f => (
              <div key={f.key}>
                <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600, marginBottom: 5 }}>{f.label}</div>
                <input value={(form as any)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  placeholder={f.placeholder} type={f.type} style={inp} />
              </div>
            ))}
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600, marginBottom: 7 }}>СТУДЕНТ ТҮРҮ</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[
                { val: 'offline', label: 'Оффлайн' },
                { val: 'online',  label: 'Онлайн' },
                { val: 'both',    label: 'Экөө тең' },
              ].map(o => (
                <button key={o.val} onClick={() => setForm(p => ({ ...p, student_type: o.val }))}
                  style={{ padding: '7px 16px', borderRadius: 8, border: `1.5px solid ${form.student_type === o.val ? BLUE : '#E8ECF0'}`, background: form.student_type === o.val ? '#EEF2FF' : '#fff', color: form.student_type === o.val ? BLUE : '#6B7280', fontSize: 13, fontWeight: form.student_type === o.val ? 700 : 500, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 9, padding: '9px 12px', marginBottom: 12, color: '#EF4444', fontSize: 13, display: 'flex', alignItems: 'center', gap: 7 }}>
              <AlertCircle size={14} /> {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleSubmit} disabled={saving}
              style={{ background: BLUE, color: '#fff', border: 'none', borderRadius: 9, padding: '9px 20px', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'Inter, sans-serif', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Plus size={14} /> {saving ? 'Кошулууда...' : 'Кошуу'}
            </button>
            <button onClick={() => setShow(false)}
              style={{ background: '#F3F4F6', color: '#6B7280', border: 'none', borderRadius: 9, padding: '9px 16px', fontWeight: 500, fontSize: 13, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
              Жокко чыгаруу
            </button>
          </div>
        </Card>
      )}
    </div>
  )
}

// ─── Admin Tests ──────────────────────────────────────────────────────────────
function AdminTests() {
  const [tests, setTests]           = useState<any[]>([])
  const [selectedTest, setSelectedTest] = useState<any>(null)
  const [questions, setQuestions]   = useState<any[]>([])
  const [lessons, setLessons]       = useState<any[]>([])
  const [showForm, setShowForm]     = useState(false)
  const [newTest, setNewTest]       = useState({ title: '', subject: 'math', type: 'mock', time_limit_minutes: 90, max_attempts: 1, is_active: false, lesson_id: '' })
  const [newQ, setNewQ]             = useState({ question_text: '', option_a: '', option_b: '', option_c: '', option_d: '', correct_answer: 'A', image_url: '', section: 'general' })
  const [uploading, setUploading]   = useState(false)
  const [saving, setSaving]         = useState(false)
  const [qType, setQType]           = useState<'text'|'image'>('text')

  const subjects = [
    { value: 'math', label: 'Математика' },
    { value: 'kyr',  label: 'Кыргыз тили' },
  ]
  const sections = [
    { value: 'general',    label: 'Жалпы' },
    { value: 'comparison', label: 'Салыштыруу' },
    { value: 'math',       label: 'Математика' },
    { value: 'analogy',    label: 'Аналогия' },
    { value: 'reading',    label: 'Окуу' },
    { value: 'grammar',    label: 'Грамматика' },
  ]

  useEffect(() => { fetchTests(); fetchLessons() }, [])
  const fetchTests = async () => { const { data } = await supabase.from('practice_tests').select('*').order('id'); setTests(data || []) }
  const fetchLessons = async () => { const { data } = await supabase.from('practice_lessons').select('*').order('subject').order('order_number'); setLessons(data || []) }
  const fetchQuestions = async (id: number) => { const { data } = await supabase.from('questions').select('*').eq('practice_test_id', id).order('order_num'); setQuestions(data || []) }
  const selectTest = (t: any) => { setSelectedTest(t); fetchQuestions(t.id) }

  const createTest = async () => {
    if (!newTest.title) return
    setSaving(true)
    const insertData: any = {
      title: newTest.title, subject: newTest.subject, type: newTest.type,
      time_limit_minutes: newTest.time_limit_minutes, max_attempts: newTest.max_attempts,
      is_active: newTest.is_active, questions: [],
    }
    if (newTest.type === 'practice' && newTest.lesson_id) {
      insertData.lesson_id = newTest.lesson_id
    }
    const { data } = await supabase.from('practice_tests').insert(insertData).select().single()
    if (data) { setTests(p => [...p, data]); selectTest(data) }
    setNewTest({ title: '', subject: 'math', type: 'mock', time_limit_minutes: 90, max_attempts: 1, is_active: false, lesson_id: '' })
    setShowForm(false); setSaving(false)
  }

  const toggleActive = async (test: any) => {
    await supabase.from('practice_tests').update({ is_active: !test.is_active }).eq('id', test.id)
    fetchTests()
    if (selectedTest?.id === test.id) setSelectedTest((p: any) => ({ ...p, is_active: !p.is_active }))
  }

  const uploadImage = async (file: File) => {
    setUploading(true)
    const path = `question_${Date.now()}.${file.name.split('.').pop()}`
    const { error } = await supabase.storage.from('questions').upload(path, file, { cacheControl: '3600', upsert: false })
    if (!error) { const { data: u } = supabase.storage.from('questions').getPublicUrl(path); setNewQ(p => ({ ...p, image_url: u.publicUrl })) }
    setUploading(false)
  }

  const addQuestion = async () => {
    if (!selectedTest) return
    setSaving(true)
    await supabase.from('questions').insert({
      practice_test_id: selectedTest.id,
      question_text: qType === 'text' ? newQ.question_text : '',
      image_url: qType === 'image' ? newQ.image_url : '',
      option_a: newQ.option_a || 'А тилкеси чоң',
      option_b: newQ.option_b || 'Б тилкеси чоң',
      option_c: newQ.option_c || 'Барабар',
      option_d: newQ.option_d || 'Аныктоо мүмкүн эмес',
      correct_answer: newQ.correct_answer,
      section: newQ.section,
      order_num: questions.length + 1,
    })
    setNewQ({ question_text: '', option_a: '', option_b: '', option_c: '', option_d: '', correct_answer: 'A', image_url: '', section: 'general' })
    await fetchQuestions(selectedTest.id)
    setSaving(false)
  }

  const deleteQuestion = async (id: number) => {
    await supabase.from('questions').delete().eq('id', id)
    if (selectedTest) fetchQuestions(selectedTest.id)
  }

  return (
    <div className="fade">
      <div className="test-layout" style={{ display: 'grid', gridTemplateColumns: '230px 1fr', gap: 18, alignItems: 'start' }}>
        {/* Left — test list */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontWeight: 600, fontSize: 13, color: '#6B7280' }}>Тесттер</span>
            <button onClick={() => setShowForm(p => !p)}
              style={{ background: BLUE, color: '#fff', border: 'none', borderRadius: 7, padding: '5px 11px', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'Inter, sans-serif' }}>
              <Plus size={13} /> Жаңы
            </button>
          </div>

          {showForm && (
            <Card style={{ padding: 14, marginBottom: 10 }}>
              <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600, marginBottom: 5 }}>АТАЛЫШЫ *</div>
              <input value={newTest.title} onChange={e => setNewTest(p => ({ ...p, title: e.target.value }))}
                placeholder="Тест аталышы" style={{ ...inp, marginBottom: 8 }} />
              <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600, marginBottom: 5 }}>ПРЕДМЕТ</div>
              <select value={newTest.subject} onChange={e => setNewTest(p => ({ ...p, subject: e.target.value }))} style={{ ...sel, marginBottom: 8 }}>
                {subjects.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600, marginBottom: 5 }}>ТИП</div>
              <select value={newTest.type} onChange={e => setNewTest(p => ({ ...p, type: e.target.value }))} style={{ ...sel, marginBottom: 8 }}>
                <option value="mock">Сынамык тест</option>
                <option value="practice">Практика</option>
              </select>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600, marginBottom: 5 }}>УБАКЫТ (мин)</div>
                  <input value={newTest.time_limit_minutes} onChange={e => setNewTest(p => ({ ...p, time_limit_minutes: Number(e.target.value) }))} type="number" style={inp} />
                </div>
                <div>
                  <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600, marginBottom: 5 }}>АРАКЕТ</div>
                  <input value={newTest.max_attempts} onChange={e => setNewTest(p => ({ ...p, max_attempts: Number(e.target.value) }))} type="number" style={inp} />
                </div>
              </div>
              {newTest.type === 'practice' && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600, marginBottom: 5 }}>САБАК (практика үчүн)</div>
                  <select value={newTest.lesson_id} onChange={e => setNewTest(p => ({ ...p, lesson_id: e.target.value }))} style={sel}>
                    <option value="">Сабак тандаңыз</option>
                    {lessons.map(l => (
                      <option key={l.id} value={l.id}>{l.subject === 'math' ? 'Мат' : 'Кыр'} — {l.title}</option>
                    ))}
                  </select>
                </div>
              )}
              <label style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12, cursor: 'pointer', fontSize: 13, color: '#374151' }}>
                <input type="checkbox" checked={newTest.is_active} onChange={e => setNewTest(p => ({ ...p, is_active: e.target.checked }))} />
                Активдүү (студенттерге көрүнөт)
              </label>
              <button onClick={createTest} disabled={saving}
                style={{ width: '100%', background: BLUE, color: '#fff', border: 'none', borderRadius: 8, padding: 9, fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                {saving ? '...' : 'Түзүү'}
              </button>
            </Card>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {tests.map(t => (
              <button key={t.id} onClick={() => selectTest(t)}
                style={{ textAlign: 'left' as const, padding: '10px 12px', borderRadius: 10, border: `${selectedTest?.id === t.id ? 2 : 1}px solid ${selectedTest?.id === t.id ? BLUE : '#E8ECF0'}`, cursor: 'pointer', background: selectedTest?.id === t.id ? '#EEF2FF' : '#fff', fontFamily: 'Inter, sans-serif', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 12, color: selectedTest?.id === t.id ? BLUE : '#111827', marginBottom: 2 }}>{t.title}</div>
                  <div style={{ fontSize: 10, color: '#9CA3AF' }}>{subjects.find(s => s.value === t.subject)?.label} · {t.type === 'mock' ? 'Сынамык' : 'Практика'}</div>
                </div>
                <div onClick={e => { e.stopPropagation(); toggleActive(t) }}
                  style={{ width: 28, height: 16, borderRadius: 8, background: t.is_active ? '#10B981' : '#E8ECF0', position: 'relative' as const, cursor: 'pointer', flexShrink: 0, transition: 'background 0.2s', marginTop: 2 }}>
                  <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#fff', position: 'absolute' as const, top: 2, left: t.is_active ? 14 : 2, transition: 'left 0.2s' }} />
                </div>
              </button>
            ))}
            {tests.length === 0 && <div style={{ textAlign: 'center', color: '#9CA3AF', padding: 24, fontSize: 12 }}>Тест жок</div>}
          </div>
        </div>

        {/* Right — questions */}
        {selectedTest ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div>
                <h3 style={{ fontWeight: 700, fontSize: 16, margin: 0 }}>{selectedTest.title}</h3>
                <div style={{ color: '#9CA3AF', fontSize: 12, marginTop: 2 }}>
                  {questions.length} суроо · {selectedTest.time_limit_minutes} мин · аракет: {selectedTest.max_attempts}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: selectedTest.is_active ? '#10B981' : '#9CA3AF' }}>
                {selectedTest.is_active ? <CheckCircle size={14} /> : <X size={14} />}
                {selectedTest.is_active ? 'Активдүү' : 'Өчүрүлгөн'}
              </div>
            </div>

            <Card style={{ padding: 18, marginBottom: 14 }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12 }}>Жаңы суроо</div>
              <div style={{ display: 'flex', gap: 7, marginBottom: 12, flexWrap: 'wrap' as const }}>
                {(['text','image'] as const).map(type => (
                  <button key={type} onClick={() => setQType(type)}
                    style={{ padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: qType === type ? BLUE : '#F3F4F6', color: qType === type ? '#fff' : '#6B7280', display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'Inter, sans-serif' }}>
                    {type === 'text' ? <><FileText size={12} /> Текст</> : <><Image size={12} /> Сүрөт</>}
                  </button>
                ))}
                <select value={newQ.section} onChange={e => setNewQ(p => ({ ...p, section: e.target.value }))} style={{ ...sel, width: 'auto', marginLeft: 'auto' }}>
                  {sections.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>

              {qType === 'text' ? (
                <textarea value={newQ.question_text} onChange={e => setNewQ(p => ({ ...p, question_text: e.target.value }))}
                  placeholder="Суроону жазыңыз..." rows={3}
                  style={{ ...inp, resize: 'none' as const, marginBottom: 12 }} />
              ) : (
                <div style={{ marginBottom: 12 }}>
                  <input type="file" accept="image/*" onChange={e => e.target.files?.[0] && uploadImage(e.target.files[0])} style={{ display: 'none' }} id="img-upload-jr" />
                  <label htmlFor="img-upload-jr"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, border: '2px dashed #E8ECF0', borderRadius: 10, padding: 20, cursor: 'pointer', background: '#F9FAFB' }}>
                    {uploading ? <span style={{ color: '#9CA3AF', fontSize: 13 }}>Жүктөлүүдө...</span>
                      : newQ.image_url ? <img src={newQ.image_url} alt="preview" style={{ maxHeight: 90, borderRadius: 8 }} />
                      : <><Upload size={18} color="#9CA3AF" /><span style={{ color: '#9CA3AF', fontSize: 13 }}>Сүрөт жүктөө</span></>}
                  </label>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, marginBottom: 10 }}>
                {(['A','B','C','D'] as const).map(opt => (
                  <div key={opt} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <div onClick={() => setNewQ(p => ({ ...p, correct_answer: opt }))}
                      style={{ width: 22, height: 22, borderRadius: 6, background: newQ.correct_answer === opt ? BLUE : '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: newQ.correct_answer === opt ? '#fff' : '#6B7280', cursor: 'pointer', flexShrink: 0 }}>
                      {opt}
                    </div>
                    <input value={(newQ as any)[`option_${opt.toLowerCase()}`]}
                      onChange={e => setNewQ(p => ({ ...p, [`option_${opt.toLowerCase()}`]: e.target.value }))}
                      placeholder={`${opt} варианты`}
                      style={{ flex: 1, padding: '6px 8px', borderRadius: 7, border: `1px solid ${newQ.correct_answer === opt ? BLUE : '#E8ECF0'}`, background: newQ.correct_answer === opt ? '#EEF2FF' : '#F9FAFB', color: '#111827', fontSize: 12, outline: 'none', fontFamily: 'Inter, sans-serif' }} />
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 10 }}>
                Туура жооп: <strong style={{ color: BLUE }}>{newQ.correct_answer}</strong>
              </div>
              <button onClick={addQuestion} disabled={saving || uploading}
                style={{ background: BLUE, color: '#fff', border: 'none', borderRadius: 9, padding: '9px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'Inter, sans-serif' }}>
                <Plus size={14} /> {saving ? '...' : 'Суроо кошуу'}
              </button>
            </Card>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {questions.map((q, i) => (
                <Card key={q.id} style={{ padding: 14, display: 'flex', gap: 11, alignItems: 'flex-start' }}>
                  <div style={{ width: 26, height: 26, background: BLUE, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#fff', flexShrink: 0 }}>{i+1}</div>
                  <div style={{ flex: 1 }}>
                    {q.image_url
                      ? <img src={q.image_url} alt="q" style={{ maxHeight: 65, borderRadius: 7, marginBottom: 7, display: 'block' }} />
                      : <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 7, color: '#111827', lineHeight: 1.4 }}>{q.question_text}</div>}
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' as const }}>
                      {['A','B','C','D'].map(opt => (
                        <span key={opt} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, fontWeight: q.correct_answer === opt ? 700 : 400,
                          background: q.correct_answer === opt ? '#F0FDF4' : '#F9FAFB',
                          color: q.correct_answer === opt ? '#10B981' : '#6B7280',
                          border: `1px solid ${q.correct_answer === opt ? '#BBF7D0' : '#E8ECF0'}` }}>
                          {opt}: {q[`option_${opt.toLowerCase()}`]}
                        </span>
                      ))}
                    </div>
                  </div>
                  <button onClick={() => deleteQuestion(q.id)}
                    style={{ background: '#FEF2F2', color: '#EF4444', border: 'none', borderRadius: 7, padding: '5px 8px', cursor: 'pointer', flexShrink: 0, display: 'flex' }}>
                    <Trash2 size={13} />
                  </button>
                </Card>
              ))}
              {questions.length === 0 && (
                <div style={{ textAlign: 'center', color: '#9CA3AF', fontSize: 13, padding: 24 }}>Суроолор жок — жогорудан кошуңуз</div>
              )}
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', color: '#9CA3AF', fontSize: 13, padding: 60 }}>Тест тандаңыз</div>
        )}
      </div>
    </div>
  )
}

// ─── Admin Lessons ────────────────────────────────────────────────────────────
function AdminLessons() {
  const [lessons, setLessons]   = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving]     = useState(false)
  const [newLesson, setNewLesson] = useState({
    title: '', subject: 'math', description: '', video_url: '', order_number: 1
  })
  const [success, setSuccess]   = useState('')

  useEffect(() => { fetchLessons() }, [])

  const fetchLessons = async () => {
    const { data } = await supabase.from('practice_lessons').select('*').order('subject').order('order_number')
    setLessons(data || [])
  }

  const addLesson = async () => {
    if (!newLesson.title) return
    setSaving(true)
    await supabase.from('practice_lessons').insert(newLesson)
    setNewLesson({ title: '', subject: 'math', description: '', video_url: '', order_number: lessons.length + 1 })
    setShowForm(false); setSuccess('Сабак кошулду'); fetchLessons(); setSaving(false)
  }

  const deleteLesson = async (id: string) => {
    await supabase.from('practice_lessons').delete().eq('id', id)
    fetchLessons()
  }

  const mathLessons = lessons.filter(l => l.subject === 'math')
  const kyrLessons  = lessons.filter(l => l.subject === 'kyr')

  return (
    <div className="fade">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0, letterSpacing: '-0.3px' }}>Практика сабактары</h2>
        <button onClick={() => { setShowForm(p => !p); setSuccess('') }}
          style={{ background: BLUE, color: '#fff', border: 'none', borderRadius: 9, padding: '9px 18px', fontWeight: 600, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'Inter, sans-serif' }}>
          <Plus size={15} /> Сабак кошуу
        </button>
      </div>

      {success && (
        <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 10, padding: '10px 14px', marginBottom: 12, color: '#10B981', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 7 }}>
          <CheckCircle size={15} /> {success}
        </div>
      )}

      {showForm && (
        <Card style={{ padding: 20, marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16 }}>Жаңы сабак</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div style={{ gridColumn: 'span 2' }}>
              <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600, marginBottom: 5 }}>АТАЛЫШЫ *</div>
              <input value={newLesson.title} onChange={e => setNewLesson(p => ({ ...p, title: e.target.value }))}
                placeholder="Сабак аталышы" style={inp} />
            </div>
            <div>
              <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600, marginBottom: 5 }}>ПРЕДМЕТ</div>
              <select value={newLesson.subject} onChange={e => setNewLesson(p => ({ ...p, subject: e.target.value }))} style={sel}>
                <option value="math">Математика</option>
                <option value="kyr">Кыргыз тили</option>
              </select>
            </div>
            <div>
              <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600, marginBottom: 5 }}>ТАРТИБИ</div>
              <input value={newLesson.order_number} onChange={e => setNewLesson(p => ({ ...p, order_number: Number(e.target.value) }))}
                type="number" style={inp} />
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600, marginBottom: 5 }}>YOUTUBE ШИЛТЕМЕСИ</div>
              <input value={newLesson.video_url} onChange={e => setNewLesson(p => ({ ...p, video_url: e.target.value }))}
                placeholder="https://youtube.com/watch?v=..." style={inp} />
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600, marginBottom: 5 }}>СҮРӨТТӨМӨ</div>
              <input value={newLesson.description} onChange={e => setNewLesson(p => ({ ...p, description: e.target.value }))}
                placeholder="Кыскача сүрөттөмө" style={inp} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={addLesson} disabled={saving}
              style={{ background: BLUE, color: '#fff', border: 'none', borderRadius: 9, padding: '9px 20px', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'Inter, sans-serif', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Plus size={14} /> {saving ? 'Кошулууда...' : 'Кошуу'}
            </button>
            <button onClick={() => setShowForm(false)}
              style={{ background: '#F3F4F6', color: '#6B7280', border: 'none', borderRadius: 9, padding: '9px 16px', fontWeight: 500, fontSize: 13, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
              Жокко чыгаруу
            </button>
          </div>
        </Card>
      )}

      <div className="g2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {[
          { label: 'Математика', data: mathLessons, color: BLUE, bg: '#EEF2FF' },
          { label: 'Кыргыз тили', data: kyrLessons, color: '#7C3AED', bg: '#F5F3FF' },
        ].map(group => (
          <Card key={group.label} style={{ overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #E8ECF0', display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: group.color }} />
              <span style={{ fontWeight: 600, fontSize: 13 }}>{group.label} ({group.data.length})</span>
            </div>
            <div style={{ padding: 8 }}>
              {group.data.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>Сабак жок</div>
              ) : group.data.map((l, i) => (
                <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 9, marginBottom: 3, background: '#F9FAFB', border: '1px solid #E8ECF0' }}>
                  <div style={{ width: 24, height: 24, background: group.bg, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: group.color, flexShrink: 0 }}>
                    {i + 1}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: '#111827', whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.title}</div>
                    {l.video_url && <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>YouTube видео бар</div>}
                  </div>
                  <button onClick={() => deleteLesson(l.id)}
                    style={{ background: '#FEF2F2', color: '#EF4444', border: 'none', borderRadius: 6, padding: '4px 7px', cursor: 'pointer', flexShrink: 0, display: 'flex' }}>
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}