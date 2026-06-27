'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

type Tab = 'students' | 'parents' | 'lessons' | 'tests' | 'results'

interface Student { id: string; full_name: string; email: string; class_number?: number }
interface Parent { id: string; full_name: string; email: string }
interface Lesson { id: string; title: string; class_number: number; video_url: string; description: string; order_number: number }
interface Question { id: string; question: string; options: string[]; correct_answer: number; order_number: number }
interface Result { id: string; score: number; total: number; passed: boolean; created_at: string; profiles: { full_name: string }; math_lessons: { title: string; class_number: number } }

export default function MathAdminPage() {
  const [tab, setTab] = useState<Tab>('students')
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  // Data
  const [students, setStudents] = useState<Student[]>([])
  const [parents, setParents] = useState<Parent[]>([])
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [results, setResults] = useState<Result[]>([])
  const [questions, setQuestions] = useState<Question[]>([])

  // Forms
  const [newStudent, setNewStudent] = useState({ full_name: '', email: '', password: '', class_number: 6 })
  const [newParent, setNewParent] = useState({ full_name: '', email: '', password: '', student_id: '' })
  const [newLesson, setNewLesson] = useState({ title: '', class_number: 6, video_url: '', description: '', order_number: 0 })
  const [newQuestion, setNewQuestion] = useState({ lesson_id: '', question: '', options: ['', '', '', ''], correct_answer: 0 })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [selectedLesson, setSelectedLesson] = useState('')

  useEffect(() => { checkAuth() }, [])

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (prof?.role !== 'math_admin') { router.push('/'); return }
    setProfile(prof)
    fetchAll()
    setLoading(false)
  }

  const fetchAll = async () => {
    const [{ data: s }, { data: p }, { data: l }, { data: r }] = await Promise.all([
      supabase.from('profiles').select('id, full_name, email').eq('role', 'math_student'),
      supabase.from('profiles').select('id, full_name, email').eq('role', 'math_parent'),
      supabase.from('math_lessons').select('*').order('class_number').order('order_number'),
      supabase.from('math_results').select('*, profiles(full_name), math_lessons(title, class_number)').order('created_at', { ascending: false }).limit(50),
    ])
    setStudents(s || [])
    setParents(p || [])
    setLessons(l || [])
    setResults(r || [])
  }

  const fetchQuestions = async (lessonId: string) => {
    const { data } = await supabase.from('math_questions').select('*').eq('lesson_id', lessonId).order('order_number')
    setQuestions(data || [])
  }

  const showMsg = (text: string) => { setMsg(text); setTimeout(() => setMsg(''), 3000) }

  // Create student
 const createStudent = async () => {
  setSaving(true)
  const res = await fetch('/api/create-user', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: newStudent.email,
      password: newStudent.password,
      full_name: newStudent.full_name,
      role: 'math_student',
      class_number: newStudent.class_number,
    }),
  })
  const json = await res.json()
  if (json.error) { showMsg('Ката: ' + json.error); setSaving(false); return }
  setNewStudent({ full_name: '', email: '', password: '', class_number: 6 })
  fetchAll()
  showMsg('✓ Студент түзүлдү')
  setSaving(false)
}
  // Create parent
 const createParent = async () => {
  if (!newParent.full_name || !newParent.email || !newParent.password) {
    showMsg('Бардык талааларды толтуруңуз'); return
  }
  setSaving(true)
  const res = await fetch('/api/create-user', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: newParent.email,
      password: newParent.password,
      full_name: newParent.full_name,
      role: 'math_parent',
    }),
  })
  const json = await res.json()
  if (json.error) { showMsg('Ката: ' + json.error); setSaving(false); return }
  
  const parentId = json.id
  if (!parentId) { showMsg('Ката: ID алынган жок'); setSaving(false); return }
  
  if (newParent.student_id) {
    const { error } = await supabase.from('math_parent_student').insert({ 
      parent_id: parentId, 
      student_id: newParent.student_id 
    })
    if (error) { showMsg('Ката байланыш: ' + error.message); setSaving(false); return }
  }
  setNewParent({ full_name: '', email: '', password: '', student_id: '' })
  fetchAll()
  showMsg('✓ Ата-эне түзүлдү')
  setSaving(false)
}

  // Create lesson
  const createLesson = async () => {
    setSaving(true)
    const { error } = await supabase.from('math_lessons').insert(newLesson)
    if (error) { showMsg('Ката: ' + error.message); setSaving(false); return }
    setNewLesson({ title: '', class_number: 6, video_url: '', description: '', order_number: 0 })
    fetchAll()
    showMsg('✓ Сабак кошулду')
    setSaving(false)
  }

  // Create question
  const createQuestion = async () => {
    if (!newQuestion.lesson_id) { showMsg('Сабак тандаңыз'); return }
    setSaving(true)
    const { error } = await supabase.from('math_questions').insert({
      lesson_id: newQuestion.lesson_id,
      question: newQuestion.question,
      options: newQuestion.options,
      correct_answer: newQuestion.correct_answer,
      order_number: questions.length,
    })
    if (error) { showMsg('Ката: ' + error.message); setSaving(false); return }
    setNewQuestion({ ...newQuestion, question: '', options: ['', '', '', ''], correct_answer: 0 })
    fetchQuestions(newQuestion.lesson_id)
    showMsg('✓ Суроо кошулду')
    setSaving(false)
  }

  const deleteLesson = async (id: string) => {
    if (!confirm('Сабакты өчүрүү?')) return
    await supabase.from('math_lessons').delete().eq('id', id)
    fetchAll()
  }

  const deleteQuestion = async (id: string) => {
    await supabase.from('math_questions').delete().eq('id', id)
    fetchQuestions(newQuestion.lesson_id)
  }

  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/') }

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'students', label: 'Студенттер', icon: '👨‍🎓' },
    { id: 'parents', label: 'Ата-эне', icon: '👨‍👩‍👧' },
    { id: 'lessons', label: 'Сабактар', icon: '📚' },
    { id: 'tests', label: 'Тесттер', icon: '📝' },
    { id: 'results', label: 'Натыйжалар', icon: '📊' },
  ]

  const inputStyle = { width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #E2E8F0', fontSize: '14px', outline: 'none', color: '#0D1E4A', background: '#FAFBFF', boxSizing: 'border-box' as const }
  const selectStyle = { ...inputStyle, cursor: 'pointer' }
  const btnStyle = { background: '#1B4FD8', color: '#fff', border: 'none', borderRadius: '10px', padding: '10px 20px', fontWeight: '700', fontSize: '14px', cursor: 'pointer' }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8FAFF' }}>
      <div style={{ textAlign: 'center', color: '#64748B' }}>Жүктөлүүдө...</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFF', fontFamily: 'Inter, sans-serif' }}>
      {/* NAVBAR */}
      <nav style={{ background: '#fff', borderBottom: '1px solid #E2E8F0', padding: '0 32px', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '32px', height: '32px', background: '#1B4FD8', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img src="/images/logo.png" alt="Z" style={{ width: '32px', height: '32px', objectFit: 'cover', borderRadius: '8px' }} />
          </div>
          <span style={{ fontWeight: '900', fontSize: '16px', color: '#0D1E4A' }}>Zhangak</span>
          <span style={{ fontWeight: '800', fontSize: '12px', color: '#1B4FD8', background: '#EEF2FF', padding: '2px 8px', borderRadius: '6px' }}>Math Admin</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '13px', color: '#64748B' }}>{profile?.full_name}</span>
          <button onClick={handleLogout} style={{ background: 'none', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '6px 14px', fontSize: '13px', color: '#64748B', cursor: 'pointer' }}>Чыгуу</button>
        </div>
      </nav>

      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '32px 24px' }}>
        {/* Message */}
        {msg && <div style={{ background: msg.startsWith('✓') ? '#F0FDF4' : '#FEF2F2', color: msg.startsWith('✓') ? '#10B981' : '#EF4444', padding: '12px 20px', borderRadius: '12px', marginBottom: '20px', fontWeight: '600', fontSize: '14px' }}>{msg}</div>}

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '28px', background: '#fff', padding: '6px', borderRadius: '14px', border: '1px solid #E2E8F0', width: 'fit-content' }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 16px', borderRadius: '10px', border: 'none', fontSize: '13px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.15s', background: tab === t.id ? '#1B4FD8' : 'transparent', color: tab === t.id ? '#fff' : '#64748B' }}>
              <span>{t.icon}</span>{t.label}
            </button>
          ))}
        </div>

        {/* STUDENTS */}
        {tab === 'students' && (
          <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: '24px' }}>
            {/* Form */}
            <div style={{ background: '#fff', borderRadius: '20px', border: '1px solid #E2E8F0', padding: '24px' }}>
              <h3 style={{ fontWeight: '800', fontSize: '16px', color: '#0D1E4A', marginBottom: '20px' }}>Студент кошуу</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <input placeholder="Толук аты" value={newStudent.full_name} onChange={e => setNewStudent({ ...newStudent, full_name: e.target.value })} style={inputStyle} />
                <input placeholder="Email" type="email" value={newStudent.email} onChange={e => setNewStudent({ ...newStudent, email: e.target.value })} style={inputStyle} />
                <input placeholder="Сырсөз" type="password" value={newStudent.password} onChange={e => setNewStudent({ ...newStudent, password: e.target.value })} style={inputStyle} />
                <select value={newStudent.class_number} onChange={e => setNewStudent({ ...newStudent, class_number: Number(e.target.value) })} style={selectStyle}>
                  <option value={6}>6-класс</option>
                  <option value={7}>7-класс</option>
                  <option value={8}>8-класс</option>
                </select>
                <button onClick={createStudent} disabled={saving} style={btnStyle}>{saving ? 'Сакталууда...' : '+ Студент кошуу'}</button>
              </div>
            </div>
            {/* List */}
            <div style={{ background: '#fff', borderRadius: '20px', border: '1px solid #E2E8F0', padding: '24px' }}>
              <h3 style={{ fontWeight: '800', fontSize: '16px', color: '#0D1E4A', marginBottom: '20px' }}>Студенттер ({students.length})</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {students.map(s => (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#F8FAFF', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                    <div>
                      <div style={{ fontWeight: '600', fontSize: '14px', color: '#0D1E4A' }}>{s.full_name}</div>
                      <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '2px' }}>{s.email}</div>
                    </div>
                  </div>
                ))}
                {students.length === 0 && <div style={{ color: '#94A3B8', fontSize: '14px', textAlign: 'center', padding: '32px' }}>Студент жок</div>}
              </div>
            </div>
          </div>
        )}

        {/* PARENTS */}
        {tab === 'parents' && (
          <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: '24px' }}>
            <div style={{ background: '#fff', borderRadius: '20px', border: '1px solid #E2E8F0', padding: '24px' }}>
              <h3 style={{ fontWeight: '800', fontSize: '16px', color: '#0D1E4A', marginBottom: '20px' }}>Ата-эне кошуу</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <input placeholder="Толук аты" value={newParent.full_name} onChange={e => setNewParent({ ...newParent, full_name: e.target.value })} style={inputStyle} />
                <input placeholder="Email" type="email" value={newParent.email} onChange={e => setNewParent({ ...newParent, email: e.target.value })} style={inputStyle} />
                <input placeholder="Сырсөз" type="password" value={newParent.password} onChange={e => setNewParent({ ...newParent, password: e.target.value })} style={inputStyle} />
                <select value={newParent.student_id} onChange={e => setNewParent({ ...newParent, student_id: e.target.value })} style={selectStyle}>
                  <option value="">Студент тандоо</option>
                  {students.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                </select>
                <button onClick={createParent} disabled={saving} style={btnStyle}>{saving ? 'Сакталууда...' : '+ Ата-эне кошуу'}</button>
              </div>
            </div>
            <div style={{ background: '#fff', borderRadius: '20px', border: '1px solid #E2E8F0', padding: '24px' }}>
              <h3 style={{ fontWeight: '800', fontSize: '16px', color: '#0D1E4A', marginBottom: '20px' }}>Ата-эне ({parents.length})</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {parents.map(p => (
                  <div key={p.id} style={{ padding: '12px 16px', background: '#F8FAFF', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                    <div style={{ fontWeight: '600', fontSize: '14px', color: '#0D1E4A' }}>{p.full_name}</div>
                    <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '2px' }}>{p.email}</div>
                  </div>
                ))}
                {parents.length === 0 && <div style={{ color: '#94A3B8', fontSize: '14px', textAlign: 'center', padding: '32px' }}>Ата-эне жок</div>}
              </div>
            </div>
          </div>
        )}

        {/* LESSONS */}
        {tab === 'lessons' && (
          <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: '24px' }}>
            <div style={{ background: '#fff', borderRadius: '20px', border: '1px solid #E2E8F0', padding: '24px' }}>
              <h3 style={{ fontWeight: '800', fontSize: '16px', color: '#0D1E4A', marginBottom: '20px' }}>Сабак кошуу</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <input placeholder="Сабактын аты" value={newLesson.title} onChange={e => setNewLesson({ ...newLesson, title: e.target.value })} style={inputStyle} />
                <select value={newLesson.class_number} onChange={e => setNewLesson({ ...newLesson, class_number: Number(e.target.value) })} style={selectStyle}>
                  <option value={6}>6-класс</option>
                  <option value={7}>7-класс</option>
                  <option value={8}>8-класс</option>
                </select>
                <input placeholder="YouTube URL" value={newLesson.video_url} onChange={e => setNewLesson({ ...newLesson, video_url: e.target.value })} style={inputStyle} />
                <textarea placeholder="Сүрөттөмө" value={newLesson.description} onChange={e => setNewLesson({ ...newLesson, description: e.target.value })} style={{ ...inputStyle, height: '80px', resize: 'vertical' }} />
                <input placeholder="Номер (тартиби)" type="number" value={newLesson.order_number} onChange={e => setNewLesson({ ...newLesson, order_number: Number(e.target.value) })} style={inputStyle} />
                <button onClick={createLesson} disabled={saving} style={btnStyle}>{saving ? 'Сакталууда...' : '+ Сабак кошуу'}</button>
              </div>
            </div>
            <div style={{ background: '#fff', borderRadius: '20px', border: '1px solid #E2E8F0', padding: '24px' }}>
              <h3 style={{ fontWeight: '800', fontSize: '16px', color: '#0D1E4A', marginBottom: '20px' }}>Сабактар ({lessons.length})</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[6, 7, 8].map(cls => (
                  <div key={cls}>
                    <div style={{ fontSize: '12px', fontWeight: '700', color: '#1B4FD8', marginBottom: '8px', marginTop: '12px' }}>{cls}-КЛАСС</div>
                    {lessons.filter(l => l.class_number === cls).map(l => (
                      <div key={l.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#F8FAFF', borderRadius: '10px', border: '1px solid #E2E8F0', marginBottom: '6px' }}>
                        <div>
                          <div style={{ fontWeight: '600', fontSize: '14px', color: '#0D1E4A' }}>#{l.order_number} {l.title}</div>
                          {l.video_url && <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>YouTube видео бар</div>}
                        </div>
                        <button onClick={() => deleteLesson(l.id)} style={{ background: '#FEF2F2', color: '#EF4444', border: 'none', borderRadius: '8px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer' }}>Өчүр</button>
                      </div>
                    ))}
                  </div>
                ))}
                {lessons.length === 0 && <div style={{ color: '#94A3B8', fontSize: '14px', textAlign: 'center', padding: '32px' }}>Сабак жок</div>}
              </div>
            </div>
          </div>
        )}

        {/* TESTS */}
        {tab === 'tests' && (
          <div style={{ display: 'grid', gridTemplateColumns: '400px 1fr', gap: '24px' }}>
            <div style={{ background: '#fff', borderRadius: '20px', border: '1px solid #E2E8F0', padding: '24px' }}>
              <h3 style={{ fontWeight: '800', fontSize: '16px', color: '#0D1E4A', marginBottom: '20px' }}>Суроо кошуу</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <select value={newQuestion.lesson_id} onChange={e => { setNewQuestion({ ...newQuestion, lesson_id: e.target.value }); fetchQuestions(e.target.value) }} style={selectStyle}>
                  <option value="">Сабак тандоо</option>
                  {lessons.map(l => <option key={l.id} value={l.id}>{l.class_number}-класс: {l.title}</option>)}
                </select>
                <textarea placeholder="Суроо" value={newQuestion.question} onChange={e => setNewQuestion({ ...newQuestion, question: e.target.value })} style={{ ...inputStyle, height: '80px', resize: 'vertical' }} />
                {newQuestion.options.map((opt, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input type="radio" name="correct" checked={newQuestion.correct_answer === i} onChange={() => setNewQuestion({ ...newQuestion, correct_answer: i })} style={{ flexShrink: 0, accentColor: '#1B4FD8' }} />
                    <input placeholder={`${i + 1}-вариант`} value={opt} onChange={e => { const opts = [...newQuestion.options]; opts[i] = e.target.value; setNewQuestion({ ...newQuestion, options: opts }) }} style={{ ...inputStyle, flex: 1 }} />
                  </div>
                ))}
                <div style={{ fontSize: '12px', color: '#94A3B8' }}>● белгиленген — туура жооп</div>
                <button onClick={createQuestion} disabled={saving} style={btnStyle}>{saving ? 'Сакталууда...' : '+ Суроо кошуу'}</button>
              </div>
            </div>
            <div style={{ background: '#fff', borderRadius: '20px', border: '1px solid #E2E8F0', padding: '24px' }}>
              <h3 style={{ fontWeight: '800', fontSize: '16px', color: '#0D1E4A', marginBottom: '20px' }}>
                Суроолор {newQuestion.lesson_id ? `(${questions.length})` : '— сабак тандаңыз'}
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {questions.map((q, i) => (
                  <div key={q.id} style={{ padding: '16px', background: '#F8FAFF', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <div style={{ fontWeight: '700', fontSize: '14px', color: '#0D1E4A' }}>#{i + 1} {q.question}</div>
                      <button onClick={() => deleteQuestion(q.id)} style={{ background: '#FEF2F2', color: '#EF4444', border: 'none', borderRadius: '6px', padding: '4px 10px', fontSize: '11px', cursor: 'pointer', flexShrink: 0 }}>✕</button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {(q.options as string[]).map((opt, j) => (
                        <div key={j} style={{ fontSize: '13px', color: j === q.correct_answer ? '#10B981' : '#64748B', fontWeight: j === q.correct_answer ? '700' : '400', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>{j === q.correct_answer ? '✓' : '·'}</span> {opt}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {newQuestion.lesson_id && questions.length === 0 && <div style={{ color: '#94A3B8', fontSize: '14px', textAlign: 'center', padding: '32px' }}>Суроо жок</div>}
              </div>
            </div>
          </div>
        )}

        {/* RESULTS */}
        {tab === 'results' && (
          <div style={{ background: '#fff', borderRadius: '20px', border: '1px solid #E2E8F0', padding: '24px' }}>
            <h3 style={{ fontWeight: '800', fontSize: '16px', color: '#0D1E4A', marginBottom: '20px' }}>Акыркы натыйжалар ({results.length})</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {results.map(r => (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', background: '#F8FAFF', borderRadius: '12px', border: `1px solid ${r.passed ? '#BBF7D0' : '#E2E8F0'}` }}>
                  <div>
                    <div style={{ fontWeight: '600', fontSize: '14px', color: '#0D1E4A' }}>{r.profiles?.full_name}</div>
                    <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '2px' }}>{r.math_lessons?.class_number}-класс · {r.math_lessons?.title}</div>
                    <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>{new Date(r.created_at).toLocaleDateString('ru')}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: '900', fontSize: '20px', color: r.passed ? '#10B981' : '#EF4444' }}>{r.score}/{r.total}</div>
                    <div style={{ fontSize: '11px', fontWeight: '700', color: r.passed ? '#10B981' : '#EF4444', marginTop: '2px' }}>{r.passed ? '✓ Өттү' : '✗ Өтпөдү'}</div>
                    <div style={{ fontSize: '11px', color: '#94A3B8' }}>{Math.round((r.score / r.total) * 100)}%</div>
                  </div>
                </div>
              ))}
              {results.length === 0 && <div style={{ color: '#94A3B8', fontSize: '14px', textAlign: 'center', padding: '48px' }}>Натыйжа жок</div>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}