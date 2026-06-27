'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

type Tab = 'students' | 'parents' | 'lessons' | 'tests' | 'results'

export default function MathAdminPage() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('students')
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')
  const [saving, setSaving] = useState(false)

  const [students, setStudents] = useState<any[]>([])
  const [parents, setParents] = useState<any[]>([])
  const [lessons, setLessons] = useState<any[]>([])
  const [results, setResults] = useState<any[]>([])
  const [questions, setQuestions] = useState<any[]>([])

  const [newStudent, setNewStudent] = useState({ full_name: '', email: '', password: '', class_number: 6 })
  const [newParent, setNewParent] = useState({ full_name: '', email: '', password: '', student_id: '' })
  const [newLesson, setNewLesson] = useState({ title: '', class_number: 6, video_url: '', description: '', order_number: 0 })
  const [newQuestion, setNewQuestion] = useState({ lesson_id: '', question: '', options: ['', '', '', ''], correct_answer: 0 })

  useEffect(() => { checkAuth() }, [])

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (prof?.role !== 'math_admin') { router.push('/'); return }
    setProfile(prof)
    await fetchAll()
    setLoading(false)
  }

  const fetchAll = async () => {
    const [{ data: s }, { data: p }, { data: l }, { data: r }] = await Promise.all([
      supabase.from('profiles').select('id, full_name, class_number').eq('role', 'math_student' as any),
      supabase.from('profiles').select('id, full_name').eq('role', 'math_parent' as any),
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

  const flash = (text: string) => { setMsg(text); setTimeout(() => setMsg(''), 3000) }

  const createUser = async (body: object) => {
    const res = await fetch('/api/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return res.json()
  }

  const deleteUser = async (id: string, name: string) => {
    if (!confirm(`${name} өчүрүлсүнбү?`)) return
    const res = await fetch('/api/delete-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    const json = await res.json()
    if (json.error) { flash('Ката: ' + json.error); return }
    await fetchAll()
    flash('✓ Өчүрүлдү')
  }

  const handleCreateStudent = async () => {
    if (!newStudent.full_name || !newStudent.email || !newStudent.password) { flash('Бардык талааларды толтуруңуз'); return }
    setSaving(true)
    const json = await createUser({ ...newStudent, role: 'math_student' })
    if (json.error) { flash('Ката: ' + json.error); setSaving(false); return }
    setNewStudent({ full_name: '', email: '', password: '', class_number: 6 })
    await fetchAll()
    flash('✓ Студент түзүлдү')
    setSaving(false)
  }

  const handleCreateParent = async () => {
    if (!newParent.full_name || !newParent.email || !newParent.password) { flash('Бардык талааларды толтуруңуз'); return }
    setSaving(true)
    const json = await createUser({ ...newParent, role: 'math_parent' })
    if (json.error) { flash('Ката: ' + json.error); setSaving(false); return }
    if (!json.id) { flash('Ката: ID алынган жок'); setSaving(false); return }
    if (newParent.student_id) {
      await supabase.from('math_parent_student').insert({ parent_id: json.id, student_id: newParent.student_id })
    }
    setNewParent({ full_name: '', email: '', password: '', student_id: '' })
    await fetchAll()
    flash('✓ Ата-эне түзүлдү')
    setSaving(false)
  }

  const handleCreateLesson = async () => {
    if (!newLesson.title) { flash('Сабактын атын жазыңыз'); return }
    setSaving(true)
    const { error } = await supabase.from('math_lessons').insert(newLesson)
    if (error) { flash('Ката: ' + error.message); setSaving(false); return }
    setNewLesson({ title: '', class_number: 6, video_url: '', description: '', order_number: 0 })
    await fetchAll()
    flash('✓ Сабак кошулду')
    setSaving(false)
  }

  const handleCreateQuestion = async () => {
    if (!newQuestion.lesson_id) { flash('Сабак тандаңыз'); return }
    if (!newQuestion.question) { flash('Суроону жазыңыз'); return }
    setSaving(true)
    const { error } = await supabase.from('math_questions').insert({
      lesson_id: newQuestion.lesson_id,
      question: newQuestion.question,
      options: newQuestion.options,
      correct_answer: newQuestion.correct_answer,
      order_number: questions.length,
    })
    if (error) { flash('Ката: ' + error.message); setSaving(false); return }
    setNewQuestion({ ...newQuestion, question: '', options: ['', '', '', ''], correct_answer: 0 })
    await fetchQuestions(newQuestion.lesson_id)
    flash('✓ Суроо кошулду')
    setSaving(false)
  }

  const handleDeleteLesson = async (id: string) => {
    if (!confirm('Сабакты өчүрүү?')) return
    await supabase.from('math_lessons').delete().eq('id', id)
    await fetchAll()
  }

  const handleDeleteQuestion = async (id: string) => {
    await supabase.from('math_questions').delete().eq('id', id)
    await fetchQuestions(newQuestion.lesson_id)
  }

  const handleReassign = async (parentId: string, studentId: string) => {
    await supabase.from('math_parent_student').delete().eq('parent_id', parentId)
    if (studentId) await supabase.from('math_parent_student').insert({ parent_id: parentId, student_id: studentId })
    flash('✓ Байланыш өзгөртүлдү')
  }

  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/') }

  // Styles
  const S = {
    input: { width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #E2E8F0', fontSize: '14px', outline: 'none', color: '#0D1E4A', background: '#FAFBFF', boxSizing: 'border-box' as const },
    btn: { width: '100%', background: '#1B4FD8', color: '#fff', border: 'none', borderRadius: '10px', padding: '11px', fontWeight: '700', fontSize: '14px', cursor: 'pointer' },
    card: { background: '#fff', borderRadius: '20px', border: '1px solid #E2E8F0', padding: '24px' },
    row: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#F8FAFF', borderRadius: '10px', border: '1px solid #E2E8F0' },
    delBtn: { background: '#FEF2F2', color: '#EF4444', border: 'none', borderRadius: '8px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer', flexShrink: 0 as const },
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8FAFF' }}>
      <div style={{ color: '#64748B', fontSize: '14px' }}>Жүктөлүүдө...</div>
    </div>
  )

  const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: 'students', label: 'Студенттер', icon: '👨‍🎓' },
    { id: 'parents', label: 'Ата-эне', icon: '👨‍👩‍👧' },
    { id: 'lessons', label: 'Сабактар', icon: '📚' },
    { id: 'tests', label: 'Тесттер', icon: '📝' },
    { id: 'results', label: 'Натыйжалар', icon: '📊' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFF', fontFamily: 'Inter, sans-serif' }}>

      {/* NAVBAR */}
      <nav style={{ background: '#fff', borderBottom: '1px solid #E2E8F0', padding: '0 32px', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '32px', height: '32px', background: '#1B4FD8', borderRadius: '8px', overflow: 'hidden' }}>
            <img src="/images/logo.png" alt="Z" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <span style={{ fontWeight: '900', fontSize: '16px', color: '#0D1E4A' }}>Zhangak</span>
          <span style={{ fontWeight: '800', fontSize: '11px', color: '#1B4FD8', background: '#EEF2FF', padding: '3px 8px', borderRadius: '6px' }}>Math Admin</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '13px', color: '#64748B' }}>{profile?.full_name}</span>
          <button onClick={handleLogout} style={{ background: 'none', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '6px 14px', fontSize: '13px', color: '#64748B', cursor: 'pointer' }}>Чыгуу</button>
        </div>
      </nav>

      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '32px 24px' }}>

        {/* MSG */}
        {msg && (
          <div style={{ background: msg.startsWith('✓') ? '#F0FDF4' : '#FEF2F2', color: msg.startsWith('✓') ? '#10B981' : '#EF4444', padding: '12px 20px', borderRadius: '12px', marginBottom: '20px', fontWeight: '600', fontSize: '14px' }}>
            {msg}
          </div>
        )}

        {/* TABS */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '28px', background: '#fff', padding: '5px', borderRadius: '14px', border: '1px solid #E2E8F0', width: 'fit-content' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 16px', borderRadius: '10px', border: 'none', fontSize: '13px', fontWeight: '600', cursor: 'pointer', background: tab === t.id ? '#1B4FD8' : 'transparent', color: tab === t.id ? '#fff' : '#64748B' }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* ── STUDENTS ── */}
        {tab === 'students' && (
          <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: '20px' }}>
            <div style={S.card}>
              <h3 style={{ fontWeight: '800', fontSize: '16px', color: '#0D1E4A', marginBottom: '18px' }}>Студент кошуу</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <input placeholder="Толук аты" value={newStudent.full_name} onChange={e => setNewStudent({ ...newStudent, full_name: e.target.value })} style={S.input} />
                <input placeholder="Email" type="email" value={newStudent.email} onChange={e => setNewStudent({ ...newStudent, email: e.target.value })} style={S.input} />
                <input placeholder="Сырсөз" type="password" value={newStudent.password} onChange={e => setNewStudent({ ...newStudent, password: e.target.value })} style={S.input} />
                <select value={newStudent.class_number} onChange={e => setNewStudent({ ...newStudent, class_number: Number(e.target.value) })} style={{ ...S.input, cursor: 'pointer' }}>
                  <option value={6}>6-класс</option>
                  <option value={7}>7-класс</option>
                  <option value={8}>8-класс</option>
                </select>
                <button onClick={handleCreateStudent} disabled={saving} style={S.btn}>{saving ? 'Жүктөлүүдө...' : '+ Студент кошуу'}</button>
              </div>
            </div>
            <div style={S.card}>
              <h3 style={{ fontWeight: '800', fontSize: '16px', color: '#0D1E4A', marginBottom: '18px' }}>Студенттер ({students.length})</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {students.map(s => (
                  <div key={s.id} style={S.row}>
                    <div>
                      <div style={{ fontWeight: '600', fontSize: '14px', color: '#0D1E4A' }}>{s.full_name}</div>
                      <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '2px' }}>{s.email} · {s.class_number}-класс</div>
                    </div>
                    <button onClick={() => deleteUser(s.id, s.full_name)} style={S.delBtn}>Өчүр</button>
                  </div>
                ))}
                {students.length === 0 && <div style={{ color: '#94A3B8', textAlign: 'center', padding: '32px', fontSize: '14px' }}>Студент жок</div>}
              </div>
            </div>
          </div>
        )}

        {/* ── PARENTS ── */}
        {tab === 'parents' && (
          <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: '20px' }}>
            <div style={S.card}>
              <h3 style={{ fontWeight: '800', fontSize: '16px', color: '#0D1E4A', marginBottom: '18px' }}>Ата-эне кошуу</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <input placeholder="Толук аты" value={newParent.full_name} onChange={e => setNewParent({ ...newParent, full_name: e.target.value })} style={S.input} />
                <input placeholder="Email" type="email" value={newParent.email} onChange={e => setNewParent({ ...newParent, email: e.target.value })} style={S.input} />
                <input placeholder="Сырсөз" type="password" value={newParent.password} onChange={e => setNewParent({ ...newParent, password: e.target.value })} style={S.input} />
                <select value={newParent.student_id} onChange={e => setNewParent({ ...newParent, student_id: e.target.value })} style={{ ...S.input, cursor: 'pointer' }}>
                  <option value="">Студент тандоо</option>
                  {students.map(s => <option key={s.id} value={s.id}>{s.full_name} ({s.class_number}-класс)</option>)}
                </select>
                <button onClick={handleCreateParent} disabled={saving} style={S.btn}>{saving ? 'Жүктөлүүдө...' : '+ Ата-эне кошуу'}</button>
              </div>
            </div>
            <div style={S.card}>
              <h3 style={{ fontWeight: '800', fontSize: '16px', color: '#0D1E4A', marginBottom: '18px' }}>Ата-эне ({parents.length})</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {parents.map(p => (
                  <div key={p.id} style={{ ...S.card, padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <div>
                        <div style={{ fontWeight: '600', fontSize: '14px', color: '#0D1E4A' }}>{p.full_name}</div>
                        <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '2px' }}>{p.email}</div>
                      </div>
                      <button onClick={() => deleteUser(p.id, p.full_name)} style={S.delBtn}>Өчүр</button>
                    </div>
                    <select defaultValue="" onChange={e => handleReassign(p.id, e.target.value)} style={{ ...S.input, fontSize: '12px', padding: '7px 12px' }}>
                      <option value="">Баланы өзгөртүү...</option>
                      {students.map(s => <option key={s.id} value={s.id}>{s.full_name} ({s.class_number}-класс)</option>)}
                    </select>
                  </div>
                ))}
                {parents.length === 0 && <div style={{ color: '#94A3B8', textAlign: 'center', padding: '32px', fontSize: '14px' }}>Ата-эне жок</div>}
              </div>
            </div>
          </div>
        )}

        {/* ── LESSONS ── */}
        {tab === 'lessons' && (
          <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: '20px' }}>
            <div style={S.card}>
              <h3 style={{ fontWeight: '800', fontSize: '16px', color: '#0D1E4A', marginBottom: '18px' }}>Сабак кошуу</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <input placeholder="Сабактын аты" value={newLesson.title} onChange={e => setNewLesson({ ...newLesson, title: e.target.value })} style={S.input} />
                <select value={newLesson.class_number} onChange={e => setNewLesson({ ...newLesson, class_number: Number(e.target.value) })} style={{ ...S.input, cursor: 'pointer' }}>
                  <option value={6}>6-класс</option>
                  <option value={7}>7-класс</option>
                  <option value={8}>8-класс</option>
                </select>
                <input placeholder="YouTube URL" value={newLesson.video_url} onChange={e => setNewLesson({ ...newLesson, video_url: e.target.value })} style={S.input} />
                <textarea placeholder="Сүрөттөмө" value={newLesson.description} onChange={e => setNewLesson({ ...newLesson, description: e.target.value })} style={{ ...S.input, height: '72px', resize: 'vertical' }} />
                <input placeholder="Тартиби (номер)" type="number" value={newLesson.order_number} onChange={e => setNewLesson({ ...newLesson, order_number: Number(e.target.value) })} style={S.input} />
                <button onClick={handleCreateLesson} disabled={saving} style={S.btn}>{saving ? 'Жүктөлүүдө...' : '+ Сабак кошуу'}</button>
              </div>
            </div>
            <div style={S.card}>
              <h3 style={{ fontWeight: '800', fontSize: '16px', color: '#0D1E4A', marginBottom: '18px' }}>Сабактар ({lessons.length})</h3>
              {[6, 7, 8].map(cls => (
                <div key={cls}>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: '#1B4FD8', letterSpacing: '1px', marginBottom: '8px', marginTop: '16px' }}>{cls}-КЛАСС</div>
                  {lessons.filter(l => l.class_number === cls).map(l => (
                    <div key={l.id} style={{ ...S.row, marginBottom: '6px' }}>
                      <div>
                        <div style={{ fontWeight: '600', fontSize: '14px', color: '#0D1E4A' }}>#{l.order_number} {l.title}</div>
                        {l.video_url && <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>📹 YouTube видео бар</div>}
                      </div>
                      <button onClick={() => handleDeleteLesson(l.id)} style={S.delBtn}>Өчүр</button>
                    </div>
                  ))}
                  {lessons.filter(l => l.class_number === cls).length === 0 && (
                    <div style={{ fontSize: '13px', color: '#CBD5E1', padding: '8px 0' }}>Сабак жок</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── TESTS ── */}
        {tab === 'tests' && (
          <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: '20px' }}>
            <div style={S.card}>
              <h3 style={{ fontWeight: '800', fontSize: '16px', color: '#0D1E4A', marginBottom: '18px' }}>Суроо кошуу</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <select value={newQuestion.lesson_id} onChange={e => { setNewQuestion({ ...newQuestion, lesson_id: e.target.value }); fetchQuestions(e.target.value) }} style={{ ...S.input, cursor: 'pointer' }}>
                  <option value="">Сабак тандоо</option>
                  {lessons.map(l => <option key={l.id} value={l.id}>{l.class_number}-класс: {l.title}</option>)}
                </select>
                <textarea placeholder="Суроо" value={newQuestion.question} onChange={e => setNewQuestion({ ...newQuestion, question: e.target.value })} style={{ ...S.input, height: '80px', resize: 'vertical' }} />
                {newQuestion.options.map((opt, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input type="radio" name="correct" checked={newQuestion.correct_answer === i} onChange={() => setNewQuestion({ ...newQuestion, correct_answer: i })} style={{ accentColor: '#1B4FD8', flexShrink: 0 }} />
                    <input placeholder={`${i + 1}-вариант`} value={opt} onChange={e => { const o = [...newQuestion.options]; o[i] = e.target.value; setNewQuestion({ ...newQuestion, options: o }) }} style={{ ...S.input, flex: 1 }} />
                  </div>
                ))}
                <div style={{ fontSize: '11px', color: '#94A3B8' }}>● белгиленген вариант — туура жооп</div>
                <button onClick={handleCreateQuestion} disabled={saving} style={S.btn}>{saving ? 'Жүктөлүүдө...' : '+ Суроо кошуу'}</button>
              </div>
            </div>
            <div style={S.card}>
              <h3 style={{ fontWeight: '800', fontSize: '16px', color: '#0D1E4A', marginBottom: '18px' }}>
                {newQuestion.lesson_id ? `Суроолор (${questions.length})` : 'Сабак тандаңыз'}
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {questions.map((q, i) => (
                  <div key={q.id} style={{ padding: '14px', background: '#F8FAFF', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <div style={{ fontWeight: '700', fontSize: '14px', color: '#0D1E4A' }}>#{i + 1} {q.question}</div>
                      <button onClick={() => handleDeleteQuestion(q.id)} style={{ ...S.delBtn, padding: '3px 10px', fontSize: '11px' }}>✕</button>
                    </div>
                    {(q.options as string[]).map((opt: string, j: number) => (
                      <div key={j} style={{ fontSize: '13px', color: j === q.correct_answer ? '#10B981' : '#64748B', fontWeight: j === q.correct_answer ? '700' : '400', display: 'flex', gap: '6px', marginBottom: '4px' }}>
                        <span>{j === q.correct_answer ? '✓' : '·'}</span>{opt}
                      </div>
                    ))}
                  </div>
                ))}
                {newQuestion.lesson_id && questions.length === 0 && <div style={{ color: '#94A3B8', textAlign: 'center', padding: '32px', fontSize: '14px' }}>Суроо жок</div>}
              </div>
            </div>
          </div>
        )}

        {/* ── RESULTS ── */}
        {tab === 'results' && (
          <div style={S.card}>
            <h3 style={{ fontWeight: '800', fontSize: '16px', color: '#0D1E4A', marginBottom: '18px' }}>Натыйжалар ({results.length})</h3>
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
                    <div style={{ fontSize: '11px', fontWeight: '700', color: r.passed ? '#10B981' : '#EF4444' }}>{r.passed ? '✓ Өттү' : '✗ Өтпөдү'}</div>
                    <div style={{ fontSize: '11px', color: '#94A3B8' }}>{Math.round((r.score / r.total) * 100)}%</div>
                  </div>
                </div>
              ))}
              {results.length === 0 && <div style={{ color: '#94A3B8', textAlign: 'center', padding: '48px', fontSize: '14px' }}>Натыйжа жок</div>}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}