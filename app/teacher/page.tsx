'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

type Tab = 'lessons' | 'attendance' | 'results' | 'homework'

export default function TeacherPage() {
  const [activeTab, setActiveTab] = useState<Tab>('lessons')
  const [lessons, setLessons] = useState<any[]>([])
  const [groups, setGroups] = useState<any[]>([])
  const [students, setStudents] = useState<any[]>([])
  const [selectedLesson, setSelectedLesson] = useState<any>(null)
  const [selectedGroup, setSelectedGroup] = useState<any>(null)
  const [attendance, setAttendance] = useState<any>({})
  const [testScores, setTestScores] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const router = useRouter()

  useEffect(() => { checkAuth() }, [])

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (!profile || profile.role !== 'teacher') { await supabase.auth.signOut(); router.push('/'); return }
    fetchData(user.id)
  }

  const fetchData = async (uid: string) => {
    const { data: grps } = await supabase.from('groups').select('*, courses(name, level)').eq('teacher_id', uid)
    setGroups(grps || [])
    if (grps && grps.length > 0) {
      setSelectedGroup(grps[0])
      fetchGroupStudents(grps[0].id)
      fetchLessons(grps[0].course_id)
    }
    setLoading(false)
  }

  const fetchLessons = async (courseId: number) => {
    const { data } = await supabase.from('lessons').select('*').eq('course_id', courseId).order('lesson_number')
    setLessons(data || [])
  }

  const fetchGroupStudents = async (groupId: number) => {
    const { data } = await supabase.from('group_students').select('*, profiles(id, full_name, phone)').eq('group_id', groupId)
    setStudents(data?.map((d: any) => d.profiles) || [])
  }

  const fetchAttendance = async (lessonId: number) => {
    const { data } = await supabase.from('attendance').select('*').eq('lesson_id', lessonId)
    const map: any = {}
    data?.forEach((a: any) => { map[a.student_id] = a.status })
    setAttendance(map)
  }

  const selectLesson = async (lesson: any) => {
    setSelectedLesson(lesson)
    await fetchAttendance(lesson.id)
    if (lesson.is_test) {
      const { data } = await supabase.from('test_results').select('*').eq('lesson_id', lesson.id)
      const map: any = {}
      data?.forEach((r: any) => { map[r.student_id] = { math_score: r.math_score, analogy_score: r.analogy_score, reading_score: r.reading_score, grammar_score: r.grammar_score } })
      setTestScores(map)
    }
  }

  const flash = (text: string) => { setMsg(text); setTimeout(() => setMsg(''), 3000) }

  const saveAttendance = async () => {
    if (!selectedLesson) return
    setSaving(true)
    for (const student of students) {
      const status = attendance[student.id] || 'absent'
      await supabase.from('attendance').upsert({ lesson_id: selectedLesson.id, student_id: student.id, status }, { onConflict: 'lesson_id,student_id' })
    }
    setSaving(false)
    flash('✓ Катышуу сакталды')
  }

  const saveTestResults = async () => {
    if (!selectedLesson) return
    setSaving(true)
    for (const student of students) {
      const scores = testScores[student.id] || {}
      await supabase.from('test_results').upsert({
        lesson_id: selectedLesson.id, student_id: student.id,
        math_score: Number(scores.math_score || 0), analogy_score: Number(scores.analogy_score || 0),
        reading_score: Number(scores.reading_score || 0), grammar_score: Number(scores.grammar_score || 0),
      }, { onConflict: 'lesson_id,student_id' })
    }
    setSaving(false)
    flash('✓ Натыйжалар сакталды')
  }

  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/') }

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'lessons', label: 'Сабактар', icon: '📚' },
    { id: 'attendance', label: 'Катышуу', icon: '✅' },
    { id: 'results', label: 'Натыйжалар', icon: '📊' },
    { id: 'homework', label: 'Үй тапшырма', icon: '📝' },
  ]

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8FAFF' }}>
      <div style={{ color: '#64748B', fontSize: '14px' }}>Жүктөлүүдө...</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFF', fontFamily: 'Inter, sans-serif', display: 'flex' }}>

      {/* SIDEBAR */}
      <aside style={{ width: '220px', background: '#fff', borderRight: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, left: 0, height: '100vh', zIndex: 100 }}>
        {/* Logo */}
        <div style={{ padding: '20px 16px', borderBottom: '1px solid #E2E8F0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '32px', height: '32px', background: '#1B4FD8', borderRadius: '8px', overflow: 'hidden' }}>
              <img src="/images/logo.png" alt="Z" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <div>
              <div style={{ fontWeight: '900', fontSize: '15px', color: '#0D1E4A' }}>Zhangak</div>
              <div style={{ fontSize: '11px', color: '#94A3B8' }}>Мугалим</div>
            </div>
          </div>
        </div>

        {/* Group selector */}
        {groups.length > 0 && (
          <div style={{ padding: '12px 12px', borderBottom: '1px solid #E2E8F0' }}>
            <div style={{ fontSize: '11px', fontWeight: '700', color: '#94A3B8', marginBottom: '8px', letterSpacing: '0.5px' }}>ГРУППАЛАР</div>
            {groups.map(g => (
              <button key={g.id} onClick={() => { setSelectedGroup(g); fetchGroupStudents(g.id); fetchLessons(g.course_id) }}
                style={{ width: '100%', textAlign: 'left', padding: '8px 10px', borderRadius: '8px', border: 'none', cursor: 'pointer', marginBottom: '2px', fontSize: '12px', fontWeight: '600', background: selectedGroup?.id === g.id ? '#EEF2FF' : 'transparent', color: selectedGroup?.id === g.id ? '#1B4FD8' : '#64748B' }}>
                {g.name}
                <span style={{ fontSize: '10px', color: '#94A3B8', marginLeft: '4px' }}>{g.courses?.level}</span>
              </button>
            ))}
          </div>
        )}

        {/* Nav */}
        <nav style={{ padding: '12px 12px', flex: 1 }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 10px', borderRadius: '10px', border: 'none', cursor: 'pointer', marginBottom: '2px', fontSize: '13px', fontWeight: '600', background: activeTab === t.id ? '#EEF2FF' : 'transparent', color: activeTab === t.id ? '#1B4FD8' : '#64748B' }}>
              <span>{t.icon}</span>{t.label}
            </button>
          ))}
        </nav>

        {/* Logout */}
        <div style={{ padding: '12px', borderTop: '1px solid #E2E8F0' }}>
          <button onClick={handleLogout} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '10px', borderRadius: '10px', border: 'none', cursor: 'pointer', background: 'transparent', color: '#94A3B8', fontSize: '13px' }}>
            🚪 Чыгуу
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <main style={{ marginLeft: '220px', flex: 1, padding: '32px', minHeight: '100vh' }}>

        {/* MSG */}
        {msg && (
          <div style={{ background: '#F0FDF4', color: '#10B981', padding: '12px 20px', borderRadius: '12px', marginBottom: '20px', fontWeight: '600', fontSize: '14px', border: '1px solid #BBF7D0' }}>
            {msg}
          </div>
        )}

        {/* ── LESSONS ── */}
        {activeTab === 'lessons' && (
          <div>
            <div style={{ marginBottom: '24px' }}>
              <h2 style={{ fontSize: '22px', fontWeight: '900', color: '#0D1E4A', margin: 0 }}>Сабактар</h2>
              <p style={{ color: '#94A3B8', fontSize: '13px', margin: '4px 0 0' }}>{lessons.length} сабак · {selectedGroup?.name}</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '14px' }}>
              {lessons.map(l => (
                <div key={l.id} onClick={() => { selectLesson(l); setActiveTab('attendance') }}
                  style={{ background: '#fff', borderRadius: '16px', border: `1px solid ${l.is_test ? '#C7D2FE' : '#E2E8F0'}`, padding: '18px', cursor: 'pointer', transition: 'all 0.15s', overflow: 'hidden' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#1B4FD8'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = l.is_test ? '#C7D2FE' : '#E2E8F0'; e.currentTarget.style.transform = 'translateY(0)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <span style={{ fontSize: '11px', fontWeight: '700', color: '#94A3B8' }}>№{l.lesson_number}</span>
                    {l.is_test && <span style={{ background: '#EEF2FF', color: '#1B4FD8', fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '20px' }}>Тест</span>}
                  </div>
                  <div style={{ fontWeight: '700', fontSize: '14px', color: '#0D1E4A', marginBottom: '10px' }}>{l.title}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {l.math_topic && <div style={{ fontSize: '11px', color: '#1B4FD8', background: '#EFF6FF', padding: '3px 8px', borderRadius: '6px', display: 'inline-block' }}>📐 {l.math_topic}</div>}
                    {l.kyr_topic && <div style={{ fontSize: '11px', color: '#7C3AED', background: '#F5F3FF', padding: '3px 8px', borderRadius: '6px', display: 'inline-block' }}>✍️ {l.kyr_topic}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── ATTENDANCE ── */}
        {activeTab === 'attendance' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
              <div>
                <h2 style={{ fontSize: '22px', fontWeight: '900', color: '#0D1E4A', margin: 0 }}>Катышуу</h2>
                <p style={{ color: '#94A3B8', fontSize: '13px', margin: '4px 0 0' }}>{selectedLesson ? selectedLesson.title : 'Сабак тандаңыз'}</p>
              </div>
              <button onClick={saveAttendance} disabled={saving || !selectedLesson}
                style={{ background: '#1B4FD8', color: '#fff', border: 'none', borderRadius: '12px', padding: '11px 24px', fontWeight: '700', fontSize: '14px', cursor: saving || !selectedLesson ? 'not-allowed' : 'pointer', opacity: saving || !selectedLesson ? 0.5 : 1 }}>
                {saving ? 'Сакталууда...' : 'Сактоо'}
              </button>
            </div>

            {!selectedLesson ? (
              <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '48px', textAlign: 'center', color: '#94A3B8', fontSize: '14px' }}>
                📚 "Сабактар" бөлүмүнөн сабак тандаңыз
              </div>
            ) : (
              <div>
                {/* Selected lesson info */}
                <div style={{ background: '#EEF2FF', borderRadius: '14px', padding: '16px 20px', marginBottom: '20px', border: '1px solid #C7D2FE' }}>
                  <div style={{ fontWeight: '700', fontSize: '15px', color: '#0D1E4A' }}>{selectedLesson.title}</div>
                  {selectedLesson.math_topic && <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>📐 {selectedLesson.math_topic} · ✍️ {selectedLesson.kyr_topic}</div>}
                </div>

                {/* Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px', marginBottom: '20px' }}>
                  {[
                    { label: 'Катышты', count: Object.values(attendance).filter((v: any) => v === 'present').length, color: '#10B981', bg: '#F0FDF4' },
                    { label: 'Кечигди', count: Object.values(attendance).filter((v: any) => v === 'late').length, color: '#F59E0B', bg: '#FFF7ED' },
                    { label: 'Жок', count: Object.values(attendance).filter((v: any) => v === 'absent').length, color: '#EF4444', bg: '#FEF2F2' },
                  ].map(s => (
                    <div key={s.label} style={{ background: s.bg, borderRadius: '12px', padding: '14px', textAlign: 'center', border: `1px solid ${s.color}22` }}>
                      <div style={{ fontWeight: '900', fontSize: '24px', color: s.color }}>{s.count}</div>
                      <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* Students */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {students.map(student => (
                    <div key={student.id} style={{ background: '#fff', borderRadius: '14px', border: '1px solid #E2E8F0', padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
                      <div style={{ fontWeight: '600', fontSize: '14px', color: '#0D1E4A' }}>{student.full_name}</div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {[
                          { value: 'present', label: '✓ Келди', color: '#10B981' },
                          { value: 'late', label: '⏰ Кечигди', color: '#F59E0B' },
                          { value: 'absent', label: '✗ Жок', color: '#EF4444' },
                        ].map(opt => (
                          <button key={opt.value} onClick={() => setAttendance((prev: any) => ({ ...prev, [student.id]: opt.value }))}
                            style={{ padding: '6px 12px', borderRadius: '8px', border: `1px solid ${attendance[student.id] === opt.value ? opt.color : '#E2E8F0'}`, background: attendance[student.id] === opt.value ? `${opt.color}15` : '#F8FAFF', color: attendance[student.id] === opt.value ? opt.color : '#94A3B8', fontSize: '12px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.15s' }}>
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  {students.length === 0 && <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #E2E8F0', padding: '32px', textAlign: 'center', color: '#94A3B8', fontSize: '14px' }}>Студент кошулган жок</div>}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── RESULTS ── */}
        {activeTab === 'results' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
              <div>
                <h2 style={{ fontSize: '22px', fontWeight: '900', color: '#0D1E4A', margin: 0 }}>Тест натыйжалары</h2>
                <p style={{ color: '#94A3B8', fontSize: '13px', margin: '4px 0 0' }}>{selectedLesson?.is_test ? selectedLesson.title : 'Тест сабагын тандаңыз'}</p>
              </div>
              <button onClick={saveTestResults} disabled={saving || !selectedLesson?.is_test}
                style={{ background: '#1B4FD8', color: '#fff', border: 'none', borderRadius: '12px', padding: '11px 24px', fontWeight: '700', fontSize: '14px', cursor: saving || !selectedLesson?.is_test ? 'not-allowed' : 'pointer', opacity: saving || !selectedLesson?.is_test ? 0.5 : 1 }}>
                {saving ? 'Сакталууда...' : 'Сактоо'}
              </button>
            </div>

            {!selectedLesson?.is_test ? (
              <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '48px', textAlign: 'center', color: '#94A3B8', fontSize: '14px' }}>
                📊 "Сабактар" бөлүмүнөн тест сабагын тандаңыз
              </div>
            ) : (
              <div>
                <div style={{ background: '#EEF2FF', borderRadius: '12px', padding: '12px 16px', marginBottom: '20px', fontSize: '13px', color: '#1B4FD8', fontWeight: '600' }}>
                  Формула: Мат×1.12 + Аналогия×2 + Окуу×2 + Грамматика×1.93
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {students.map(student => {
                    const scores = testScores[student.id] || {}
                    const total = (Number(scores.math_score || 0) * 1.12 + Number(scores.analogy_score || 0) * 2 + Number(scores.reading_score || 0) * 2 + Number(scores.grammar_score || 0) * 1.93).toFixed(1)
                    return (
                      <div key={student.id} style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '18px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                          <div style={{ fontWeight: '700', fontSize: '15px', color: '#0D1E4A' }}>{student.full_name}</div>
                          <div style={{ background: 'linear-gradient(135deg,#1B4FD8,#7C3AED)', color: '#fff', borderRadius: '10px', padding: '6px 16px', fontWeight: '900', fontSize: '16px' }}>{total} б</div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '10px' }}>
                          {[
                            { key: 'math_score', label: 'Математика', color: '#1B4FD8', bg: '#EFF6FF' },
                            { key: 'analogy_score', label: 'Аналогия', color: '#7C3AED', bg: '#F5F3FF' },
                            { key: 'reading_score', label: 'Окуу', color: '#059669', bg: '#F0FDF4' },
                            { key: 'grammar_score', label: 'Грамматика', color: '#D97706', bg: '#FFF7ED' },
                          ].map(field => (
                            <div key={field.key}>
                              <div style={{ fontSize: '11px', color: field.color, fontWeight: '700', marginBottom: '6px' }}>{field.label}</div>
                              <input type="number" min="0" value={scores[field.key] || ''} placeholder="0"
                                onChange={e => setTestScores((prev: any) => ({ ...prev, [student.id]: { ...(prev[student.id] || {}), [field.key]: e.target.value } }))}
                                style={{ width: '100%', padding: '8px', borderRadius: '8px', border: `1px solid ${field.color}44`, background: field.bg, color: field.color, fontWeight: '700', fontSize: '14px', textAlign: 'center', outline: 'none', boxSizing: 'border-box' as const }} />
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── HOMEWORK ── */}
        {activeTab === 'homework' && (
          <HomeworkTab lessons={lessons} students={students} selectedLesson={selectedLesson} setSelectedLesson={setSelectedLesson} flash={flash} />
        )}

      </main>
    </div>
  )
}

function HomeworkTab({ lessons, students, selectedLesson, setSelectedLesson, flash }: any) {
  const [homeworks, setHomeworks] = useState<any[]>([])
  const [newHW, setNewHW] = useState({ title: '', description: '', due_date: '' })
  const [saving, setSaving] = useState(false)

  const fetchHomeworks = async (lessonId: number) => {
    const { data } = await supabase.from('homeworks').select('*, homework_submissions(student_id, answer)').eq('lesson_id', lessonId)
    setHomeworks(data || [])
  }

  const selectLesson = (l: any) => { setSelectedLesson(l); fetchHomeworks(l.id) }

  const addHomework = async () => {
    if (!selectedLesson || !newHW.title) return
    setSaving(true)
    await supabase.from('homeworks').insert({ lesson_id: selectedLesson.id, title: newHW.title, description: newHW.description, due_date: newHW.due_date || null })
    setNewHW({ title: '', description: '', due_date: '' })
    fetchHomeworks(selectedLesson.id)
    setSaving(false)
    flash('✓ Тапшырма кошулду')
  }

  const inputStyle = { width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #E2E8F0', fontSize: '14px', outline: 'none', color: '#0D1E4A', background: '#FAFBFF', boxSizing: 'border-box' as const }

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '22px', fontWeight: '900', color: '#0D1E4A', margin: 0 }}>Үй тапшырмалар</h2>
      </div>

      {/* Lesson selector */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '10px', marginBottom: '24px' }}>
        {lessons.map((l: any) => (
          <button key={l.id} onClick={() => selectLesson(l)}
            style={{ padding: '12px 14px', borderRadius: '12px', border: `1px solid ${selectedLesson?.id === l.id ? '#1B4FD8' : '#E2E8F0'}`, background: selectedLesson?.id === l.id ? '#EEF2FF' : '#fff', color: selectedLesson?.id === l.id ? '#1B4FD8' : '#64748B', fontSize: '12px', fontWeight: '600', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}>
            <span style={{ color: '#94A3B8' }}>№{l.lesson_number}</span> {l.title}
          </button>
        ))}
      </div>

      {selectedLesson && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          {/* Add form */}
          <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '20px' }}>
            <h3 style={{ fontWeight: '800', fontSize: '15px', color: '#0D1E4A', marginBottom: '16px' }}>Тапшырма кошуу</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <input value={newHW.title} onChange={e => setNewHW(p => ({ ...p, title: e.target.value }))} placeholder="Тапшырманын аты" style={inputStyle} />
              <textarea value={newHW.description} onChange={e => setNewHW(p => ({ ...p, description: e.target.value }))} placeholder="Сүрөттөмө (милдеттүү эмес)" rows={3} style={{ ...inputStyle, resize: 'vertical' as const }} />
              <input type="date" value={newHW.due_date} onChange={e => setNewHW(p => ({ ...p, due_date: e.target.value }))} style={inputStyle} />
              <button onClick={addHomework} disabled={saving} style={{ background: '#1B4FD8', color: '#fff', border: 'none', borderRadius: '10px', padding: '11px', fontWeight: '700', fontSize: '14px', cursor: 'pointer' }}>
                {saving ? 'Кошулууда...' : '+ Тапшырма кошуу'}
              </button>
            </div>
          </div>

          {/* HW list */}
          <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '20px' }}>
            <h3 style={{ fontWeight: '800', fontSize: '15px', color: '#0D1E4A', marginBottom: '16px' }}>Тапшырмалар ({homeworks.length})</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {homeworks.map(hw => (
                <div key={hw.id} style={{ padding: '14px', background: '#F8FAFF', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <div style={{ fontWeight: '700', fontSize: '14px', color: '#0D1E4A' }}>{hw.title}</div>
                    <div style={{ fontSize: '12px', color: '#1B4FD8', fontWeight: '700' }}>
                      {hw.homework_submissions?.length || 0}/{students.length}
                    </div>
                  </div>
                  {hw.description && <div style={{ fontSize: '12px', color: '#64748B', marginBottom: '4px' }}>{hw.description}</div>}
                  {hw.due_date && <div style={{ fontSize: '11px', color: '#D97706' }}>📅 {new Date(hw.due_date).toLocaleDateString('ru')}</div>}
                </div>
              ))}
              {homeworks.length === 0 && <div style={{ color: '#94A3B8', textAlign: 'center', padding: '24px', fontSize: '13px' }}>Тапшырма жок</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}