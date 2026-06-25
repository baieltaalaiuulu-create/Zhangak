'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [courses, setCourses] = useState<any[]>([])
  const [lessons, setLessons] = useState<any[]>([])
  const [groups, setGroups] = useState<any[]>([])
  const [students, setStudents] = useState<any[]>([])
  const [teachers, setTeachers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCourse, setSelectedCourse] = useState<number | null>(null)
  const router = useRouter()

  useEffect(() => {
    checkAuth()
    fetchData()
  }, [])

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    console.log('Admin check - user:', user.id, 'profile:', profile)
    if (!profile) { console.log('No profile found, staying on admin page'); return }
    if (profile.role !== 'admin') router.push('/')
  }

  const fetchData = async () => {
    console.log('Fetching data...')
    const { data: c, error: ce } = await supabase.from('courses').select('*').order('id')
    console.log('Courses:', c, 'Error:', ce)
    const { data: g } = await supabase.from('groups').select('*, courses(name), profiles(full_name)')
    const { data: s } = await supabase.from('profiles').select('*').eq('role', 'student').order('full_name')
    const { data: t } = await supabase.from('profiles').select('*').eq('role', 'teacher').order('full_name')
    setCourses(c || [])
    setGroups(g || [])
    setStudents(s || [])
    setTeachers(t || [])
    setLoading(false)
  }

  const fetchLessons = async (courseId: number) => {
    setSelectedCourse(courseId)
    const { data } = await supabase.from('lessons').select('*').eq('course_id', courseId).order('lesson_number')
    setLessons(data || [])
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const tabs = [
    { id: 'dashboard', label: '📊 Главная' },
    { id: 'courses', label: '📚 Программа' },
    { id: 'groups', label: '👥 Группы' },
    { id: 'students', label: '🎓 Ученики' },
    { id: 'teachers', label: '👨‍🏫 Учителя' },
    { id: 'tests', label: '📝 Тесттер' },
    { id: 'results', label: '📈 Результаты' },
  ]

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{background:'var(--bg)'}}>
      <div style={{color:'var(--muted)'}}>Загрузка...</div>
    </div>
  )

  return (
    <div className="min-h-screen" style={{background:'var(--bg)'}}>
      <div className="flex items-center justify-between px-6 py-4" style={{borderBottom:'1px solid var(--border)', background:'var(--surface)'}}>
        <div className="font-black text-lg" style={{background:'linear-gradient(90deg,#4B8EF5,#D45FCC)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>
          ЖАНГАК — Админ
        </div>
        <button onClick={handleLogout} className="text-sm px-4 py-2 rounded-lg" style={{background:'var(--bg)',color:'var(--muted)',border:'1px solid var(--border)'}}>
          Выйти
        </button>
      </div>

      <div className="flex">
        <div className="w-52 min-h-screen p-4 flex flex-col gap-1" style={{borderRight:'1px solid var(--border)',background:'var(--surface)'}}>
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className="text-left px-4 py-3 rounded-xl text-sm font-medium transition-all"
              style={{
                background: activeTab === tab.id ? 'rgba(75,142,245,0.15)' : 'transparent',
                color: activeTab === tab.id ? '#4B8EF5' : 'var(--muted)',
                border: activeTab === tab.id ? '1px solid rgba(75,142,245,0.3)' : '1px solid transparent'
              }}>
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 p-6">

          {activeTab === 'dashboard' && (
            <div>
              <h2 className="text-xl font-bold mb-6" style={{color:'var(--text)'}}>Обзор</h2>
              <div className="grid grid-cols-4 gap-4 mb-8">
                {[
                  { label: 'Курсов', value: courses.length, color: '#4B8EF5' },
                  { label: 'Групп', value: groups.length, color: '#D45FCC' },
                  { label: 'Учеников', value: students.length, color: '#34C97B' },
                  { label: 'Учителей', value: teachers.length, color: '#F5A623' },
                ].map(stat => (
                  <div key={stat.label} className="p-5 rounded-xl" style={{background:'var(--surface)',border:'1px solid var(--border)'}}>
                    <div className="text-3xl font-black mb-1" style={{color: stat.color}}>{stat.value}</div>
                    <div className="text-sm" style={{color:'var(--muted)'}}>{stat.label}</div>
                  </div>
                ))}
              </div>
              <div className="p-5 rounded-xl" style={{background:'var(--surface)',border:'1px solid var(--border)'}}>
                <h3 className="font-bold mb-4">Курсы</h3>
                {courses.map(c => (
                  <div key={c.id} className="flex items-center justify-between py-3" style={{borderBottom:'1px solid var(--border)'}}>
                    <div>
                      <div className="font-medium">{c.name}</div>
                      <div className="text-xs mt-1" style={{color:'var(--muted)'}}>{c.description}</div>
                    </div>
                    <div className="text-xs px-3 py-1 rounded-full font-bold" style={{background:'rgba(75,142,245,0.15)',color:'#4B8EF5'}}>
                      {c.level}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'courses' && (
            <div>
              <h2 className="text-xl font-bold mb-6">Учебная программа</h2>
              <div className="grid grid-cols-3 gap-4 mb-6">
                {courses.map(c => (
                  <button key={c.id} onClick={() => fetchLessons(c.id)}
                    className="p-4 rounded-xl text-left transition-all"
                    style={{
                      background: selectedCourse === c.id ? 'rgba(75,142,245,0.15)' : 'var(--surface)',
                      border: selectedCourse === c.id ? '1px solid rgba(75,142,245,0.4)' : '1px solid var(--border)'
                    }}>
                    <div className="font-bold mb-1">{c.name}</div>
                    <div className="text-xs" style={{color:'var(--muted)'}}>{c.month} · {c.level}</div>
                  </button>
                ))}
              </div>
              {lessons.length > 0 && (
                <div className="rounded-xl overflow-hidden" style={{border:'1px solid var(--border)'}}>
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{background:'var(--surface)',borderBottom:'1px solid var(--border)'}}>
                        <th className="text-left px-4 py-3" style={{color:'var(--muted)'}}>№</th>
                        <th className="text-left px-4 py-3" style={{color:'var(--muted)'}}>Тема</th>
                        <th className="text-left px-4 py-3" style={{color:'var(--muted)'}}>Математика</th>
                        <th className="text-left px-4 py-3" style={{color:'var(--muted)'}}>Кыргыз тили</th>
                        <th className="text-left px-4 py-3" style={{color:'var(--muted)'}}>Чтение</th>
                        <th className="text-left px-4 py-3" style={{color:'var(--muted)'}}>Тест</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lessons.map((l, i) => (
                        <tr key={l.id} style={{borderBottom:'1px solid var(--border)',background: i%2===0?'var(--bg)':'var(--surface)'}}>
                          <td className="px-4 py-3 font-bold" style={{color:'var(--muted)'}}>{l.lesson_number}</td>
                          <td className="px-4 py-3 font-medium">{l.title}</td>
                          <td className="px-4 py-3 text-xs" style={{color:'#4F8EF7'}}>{l.math_topic}</td>
                          <td className="px-4 py-3 text-xs" style={{color:'#D45FCC'}}>{l.kyr_topic}</td>
                          <td className="px-4 py-3 text-xs" style={{color:'#34C97B'}}>{l.reading_topic}</td>
                          <td className="px-4 py-3">
                            {l.is_test && <span className="text-xs px-2 py-1 rounded-full" style={{background:'rgba(123,97,255,0.15)',color:'#7B61FF'}}>Тест</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'students' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">Ученики ({students.length})</h2>
              </div>
              <div className="rounded-xl overflow-hidden" style={{border:'1px solid var(--border)'}}>
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{background:'var(--surface)',borderBottom:'1px solid var(--border)'}}>
                      <th className="text-left px-4 py-3" style={{color:'var(--muted)'}}>Имя</th>
                      <th className="text-left px-4 py-3" style={{color:'var(--muted)'}}>Телефон</th>
                      <th className="text-left px-4 py-3" style={{color:'var(--muted)'}}>Дата</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((s, i) => (
                      <tr key={s.id} style={{borderBottom:'1px solid var(--border)',background:i%2===0?'var(--bg)':'var(--surface)'}}>
                        <td className="px-4 py-3 font-medium">{s.full_name}</td>
                        <td className="px-4 py-3" style={{color:'var(--muted)'}}>{s.phone || '—'}</td>
                        <td className="px-4 py-3 text-xs" style={{color:'var(--muted)'}}>{new Date(s.created_at).toLocaleDateString('ru')}</td>
                      </tr>
                    ))}
                    {students.length === 0 && (
                      <tr><td colSpan={3} className="px-4 py-8 text-center" style={{color:'var(--muted)'}}>Ученики не добавлены</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'teachers' && (
            <div>
              <h2 className="text-xl font-bold mb-6">Учителя ({teachers.length})</h2>
              <div className="rounded-xl overflow-hidden" style={{border:'1px solid var(--border)'}}>
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{background:'var(--surface)',borderBottom:'1px solid var(--border)'}}>
                      <th className="text-left px-4 py-3" style={{color:'var(--muted)'}}>Имя</th>
                      <th className="text-left px-4 py-3" style={{color:'var(--muted)'}}>Телефон</th>
                      <th className="text-left px-4 py-3" style={{color:'var(--muted)'}}>Дата</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teachers.map((t, i) => (
                      <tr key={t.id} style={{borderBottom:'1px solid var(--border)',background:i%2===0?'var(--bg)':'var(--surface)'}}>
                        <td className="px-4 py-3 font-medium">{t.full_name}</td>
                        <td className="px-4 py-3" style={{color:'var(--muted)'}}>{t.phone || '—'}</td>
                        <td className="px-4 py-3 text-xs" style={{color:'var(--muted)'}}>{new Date(t.created_at).toLocaleDateString('ru')}</td>
                      </tr>
                    ))}
                    {teachers.length === 0 && (
                      <tr><td colSpan={3} className="px-4 py-8 text-center" style={{color:'var(--muted)'}}>Учителя не добавлены</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'groups' && (
            <div>
              <h2 className="text-xl font-bold mb-6">Группы ({groups.length})</h2>
              <div className="grid grid-cols-3 gap-4">
                {groups.map(g => (
                  <div key={g.id} className="p-4 rounded-xl" style={{background:'var(--surface)',border:'1px solid var(--border)'}}>
                    <div className="font-bold mb-2">{g.name}</div>
                    <div className="text-xs mb-1" style={{color:'var(--muted)'}}>Курс: {g.courses?.name || '—'}</div>
                    <div className="text-xs" style={{color:'var(--muted)'}}>Учитель: {g.profiles?.full_name || '—'}</div>
                  </div>
                ))}
                {groups.length === 0 && (
                  <div className="col-span-3 py-8 text-center" style={{color:'var(--muted)'}}>Группы не созданы</div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'tests' && (
            <div>
              <h2 className="text-xl font-bold mb-6">Практикалык тесттер</h2>
              <AdminTests />
            </div>
          )}

          {activeTab === 'results' && (
            <div>
              <h2 className="text-xl font-bold mb-6">Результаты тестов</h2>
              <ResultsTab />
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

function ResultsTab() {
  const [results, setResults] = useState<any[]>([])

  useEffect(() => {
    supabase.from('test_results')
      .select('*, profiles(full_name), lessons(title, courses(name))')
      .order('created_at', { ascending: false })
      .then(({ data }) => setResults(data || []))
  }, [])

  return (
    <div className="rounded-xl overflow-hidden" style={{border:'1px solid var(--border)'}}>
      <table className="w-full text-sm">
        <thead>
          <tr style={{background:'var(--surface)',borderBottom:'1px solid var(--border)'}}>
            <th className="text-left px-4 py-3" style={{color:'var(--muted)'}}>Ученик</th>
            <th className="text-left px-4 py-3" style={{color:'var(--muted)'}}>Занятие</th>
            <th className="text-left px-4 py-3" style={{color:'var(--muted)'}}>Мат</th>
            <th className="text-left px-4 py-3" style={{color:'var(--muted)'}}>Аналогия</th>
            <th className="text-left px-4 py-3" style={{color:'var(--muted)'}}>Чтение</th>
            <th className="text-left px-4 py-3" style={{color:'var(--muted)'}}>Грамматика</th>
            <th className="text-left px-4 py-3" style={{color:'var(--muted)'}}>Итог</th>
          </tr>
        </thead>
        <tbody>
          {results.map((r, i) => (
            <tr key={r.id} style={{borderBottom:'1px solid var(--border)',background:i%2===0?'var(--bg)':'var(--surface)'}}>
              <td className="px-4 py-3 font-medium">{r.profiles?.full_name}</td>
              <td className="px-4 py-3 text-xs" style={{color:'var(--muted)'}}>{r.lessons?.title}</td>
              <td className="px-4 py-3" style={{color:'#4B8EF5'}}>{r.math_score}</td>
              <td className="px-4 py-3" style={{color:'#D45FCC'}}>{r.analogy_score}</td>
              <td className="px-4 py-3" style={{color:'#34C97B'}}>{r.reading_score}</td>
              <td className="px-4 py-3" style={{color:'#F5A623'}}>{r.grammar_score}</td>
              <td className="px-4 py-3 font-bold" style={{color:'#7B61FF'}}>{Number(r.total_score).toFixed(1)}</td>
            </tr>
          ))}
          {results.length === 0 && (
            <tr><td colSpan={7} className="px-4 py-8 text-center" style={{color:'var(--muted)'}}>Результатов пока нет</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function AdminTests() {
  const [tests, setTests] = useState<any[]>([])
  const [selectedTest, setSelectedTest] = useState<any>(null)
  const [questions, setQuestions] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [newTest, setNewTest] = useState({ title: '', subject: 'math' })
  const [newQ, setNewQ] = useState({ question_text: '', option_a: '', option_b: '', option_c: '', option_d: '', correct_answer: 'A', image_url: '' })
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [qType, setQType] = useState<'text' | 'image'>('text')
  const router = useRouter()

  useEffect(() => { fetchTests() }, [])

  const fetchTests = async () => {
    const { data } = await supabase.from('practice_tests').select('*').order('id')
    setTests(data || [])
  }

  const fetchQuestions = async (testId: number) => {
    const { data } = await supabase.from('questions').select('*').eq('practice_test_id', testId).order('order_num')
    setQuestions(data || [])
  }

  const selectTest = (t: any) => {
    setSelectedTest(t)
    fetchQuestions(t.id)
  }

  const createTest = async () => {
    if (!newTest.title) return
    setSaving(true)
    const { data } = await supabase.from('practice_tests').insert({
      title: newTest.title,
      subject: newTest.subject,
      questions: [],
      lesson_id: 1,
    }).select().single()
    if (data) { setTests(p => [...p, data]); selectTest(data) }
    setNewTest({ title: '', subject: 'math' })
    setShowForm(false)
    setSaving(false)
  }

  const uploadImage = async (file: File) => {
  setUploading(true)
  try {
    const ext = file.name.split('.').pop()
    const path = `question_${Date.now()}.${ext}`
    const { data, error } = await supabase.storage.from('questions').upload(path, file, {
      cacheControl: '3600',
      upsert: false
    })
    if (error) {
      console.error('Upload error:', error)
      alert('Жүктөө катасы: ' + error.message)
    } else {
      const { data: urlData } = supabase.storage.from('questions').getPublicUrl(path)
      setNewQ(p => ({ ...p, image_url: urlData.publicUrl }))
    }
  } catch (e) {
    console.error(e)
  }
  setUploading(false)
}

  const addQuestion = async () => {
    if (!selectedTest) return
    if (qType === 'text' && !newQ.question_text) return
    if (qType === 'image' && !newQ.image_url) return
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
      order_num: questions.length + 1,
    })
    setNewQ({ question_text: '', option_a: '', option_b: '', option_c: '', option_d: '', correct_answer: 'A', image_url: '' })
    fetchQuestions(selectedTest.id)
    setSaving(false)
  }

  const deleteQuestion = async (id: number) => {
    await supabase.from('questions').delete().eq('id', id)
    if (selectedTest) fetchQuestions(selectedTest.id)
  }

  const BLUE = '#2563EB'
  const subjects = [
    { value: 'math', label: 'Математика' },
    { value: 'kyr', label: 'Кыргыз тили' },
    { value: 'reading', label: 'Окуу жана түшүнүү' },
    { value: 'grammar', label: 'Грамматика' },
  ]

  return (
    <div style={{display:'grid', gridTemplateColumns:'280px 1fr', gap:'24px', alignItems:'start'}}>
      <div>
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'12px'}}>
          <div style={{fontWeight:'700', fontSize:'14px', color:'var(--muted)'}}>Тесттер</div>
          <button onClick={() => setShowForm(p => !p)}
            style={{background:BLUE, color:'#fff', border:'none', borderRadius:'8px', padding:'6px 14px', fontSize:'12px', fontWeight:'700', cursor:'pointer'}}>
            + Жаңы
          </button>
        </div>

        {showForm && (
          <div style={{background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'12px', padding:'16px', marginBottom:'12px'}}>
            <input value={newTest.title} onChange={e => setNewTest(p => ({...p, title: e.target.value}))}
              placeholder="Тест аталышы"
              style={{width:'100%', padding:'8px 12px', borderRadius:'8px', border:'1px solid var(--border)', background:'var(--bg)', color:'var(--text)', fontSize:'13px', marginBottom:'8px', boxSizing:'border-box' as const}} />
            <select value={newTest.subject} onChange={e => setNewTest(p => ({...p, subject: e.target.value}))}
              style={{width:'100%', padding:'8px 12px', borderRadius:'8px', border:'1px solid var(--border)', background:'var(--bg)', color:'var(--text)', fontSize:'13px', marginBottom:'12px', boxSizing:'border-box' as const}}>
              {subjects.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <button onClick={createTest} disabled={saving}
              style={{width:'100%', background:BLUE, color:'#fff', border:'none', borderRadius:'8px', padding:'8px', fontSize:'13px', fontWeight:'700', cursor:'pointer'}}>
              {saving ? 'Сакталууда...' : 'Түзүү'}
            </button>
          </div>
        )}

        <div style={{display:'flex', flexDirection:'column', gap:'6px'}}>
          {tests.map(t => (
            <button key={t.id} onClick={() => selectTest(t)}
              style={{textAlign:'left', padding:'12px', borderRadius:'10px', border:'none', cursor:'pointer',
                background: selectedTest?.id === t.id ? 'rgba(37,99,235,0.15)' : 'var(--surface)',
                borderLeft: selectedTest?.id === t.id ? `3px solid ${BLUE}` : '3px solid transparent',
                color:'var(--text)'}}>
              <div style={{fontWeight:'600', fontSize:'13px'}}>{t.title}</div>
              <div style={{fontSize:'11px', color:'var(--muted)', marginTop:'3px'}}>
                {subjects.find(s => s.value === t.subject)?.label}
              </div>
            </button>
          ))}
          {tests.length === 0 && (
            <div style={{textAlign:'center', color:'var(--muted)', fontSize:'13px', padding:'24px'}}>
              Тест жок
            </div>
          )}
        </div>
      </div>

      {selectedTest ? (
        <div>
          <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'20px'}}>
            <div>
              <h3 style={{fontWeight:'800', fontSize:'18px'}}>{selectedTest.title}</h3>
              <div style={{color:'var(--muted)', fontSize:'13px', marginTop:'4px'}}>{questions.length} суроо</div>
            </div>
            <a href={`/student/test?id=${selectedTest.id}`} target="_blank" rel="noopener noreferrer"
              style={{background:'rgba(37,99,235,0.15)', color:BLUE, borderRadius:'8px', padding:'8px 16px', fontSize:'13px', fontWeight:'700', textDecoration:'none'}}>
              👁 Алдын ала көрүү
            </a>
          </div>

          <div style={{background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'16px', padding:'20px', marginBottom:'20px'}}>
            <div style={{fontWeight:'700', fontSize:'14px', marginBottom:'16px'}}>Жаңы суроо кошуу</div>

            <div style={{display:'flex', gap:'8px', marginBottom:'16px'}}>
              {(['text', 'image'] as const).map(type => (
                <button key={type} onClick={() => setQType(type)}
                  style={{padding:'6px 16px', borderRadius:'8px', border:'none', cursor:'pointer', fontSize:'13px', fontWeight:'600',
                    background: qType === type ? BLUE : 'rgba(255,255,255,0.05)',
                    color: qType === type ? '#fff' : 'var(--muted)'}}>
                  {type === 'text' ? '📝 Текст' : '🖼 Сүрөт'}
                </button>
              ))}
            </div>

            {qType === 'text' ? (
              <textarea value={newQ.question_text} onChange={e => setNewQ(p => ({...p, question_text: e.target.value}))}
                placeholder="Суроону жазыңыз..."
                rows={3}
                style={{width:'100%', padding:'10px 12px', borderRadius:'8px', border:'1px solid var(--border)', background:'var(--bg)', color:'var(--text)', fontSize:'13px', marginBottom:'12px', resize:'none', boxSizing:'border-box' as const}} />
            ) : (
              <div style={{marginBottom:'12px'}}>
                <input type="file" accept="image/*" onChange={e => e.target.files?.[0] && uploadImage(e.target.files[0])}
                  style={{display:'none'}} id="img-upload" />
                <label htmlFor="img-upload" style={{display:'block', border:'2px dashed var(--border)', borderRadius:'12px', padding:'24px', textAlign:'center', cursor:'pointer'}}>
                  {uploading ? (
                    <div style={{color:'var(--muted)', fontSize:'13px'}}>Жүктөлүүдө...</div>
                  ) : newQ.image_url ? (
                    <img src={newQ.image_url} alt="preview" style={{maxHeight:'120px', borderRadius:'8px'}} />
                  ) : (
                    <div style={{color:'var(--muted)', fontSize:'13px'}}>🖼 Сүрөт жүктөө үчүн басыңыз</div>
                  )}
                </label>
              </div>
            )}

            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', marginBottom:'12px'}}>
              {(['A','B','C','D'] as const).map(opt => (
                <div key={opt} style={{display:'flex', gap:'6px', alignItems:'center'}}>
                  <div style={{width:'24px', height:'24px', borderRadius:'6px', background: newQ.correct_answer === opt ? BLUE : 'rgba(255,255,255,0.05)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'11px', fontWeight:'800', color: newQ.correct_answer === opt ? '#fff' : 'var(--muted)', flexShrink:0, cursor:'pointer'}}
                    onClick={() => setNewQ(p => ({...p, correct_answer: opt}))}>
                    {opt}
                  </div>
                  <input
                    value={(newQ as any)[`option_${opt.toLowerCase()}`]}
                    onChange={e => setNewQ(p => ({...p, [`option_${opt.toLowerCase()}`]: e.target.value}))}
                    placeholder={`${opt} варианты`}
                    style={{flex:1, padding:'6px 10px', borderRadius:'6px', border:`1px solid ${newQ.correct_answer === opt ? BLUE : 'var(--border)'}`, background:'var(--bg)', color:'var(--text)', fontSize:'12px'}} />
                </div>
              ))}
            </div>

            <div style={{fontSize:'11px', color:'var(--muted)', marginBottom:'12px'}}>
              💡 Туура жооптун тамгасын басыңыз (азыр: <strong style={{color:BLUE}}>{newQ.correct_answer}</strong>)
            </div>

            <button onClick={addQuestion} disabled={saving || uploading}
              style={{background:BLUE, color:'#fff', border:'none', borderRadius:'10px', padding:'10px 24px', fontSize:'14px', fontWeight:'700', cursor:'pointer', opacity: saving ? 0.7 : 1}}>
              {saving ? 'Сакталууда...' : '+ Суроо кошуу'}
            </button>
          </div>

          <div style={{display:'flex', flexDirection:'column', gap:'10px'}}>
            {questions.map((q, i) => (
              <div key={q.id} style={{background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'12px', padding:'16px', display:'flex', gap:'16px', alignItems:'flex-start'}}>
                <div style={{width:'28px', height:'28px', background:BLUE, borderRadius:'8px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'12px', fontWeight:'800', flexShrink:0}}>
                  {i + 1}
                </div>
                <div style={{flex:1}}>
                  {q.image_url ? (
                    <img src={q.image_url} alt="question" style={{maxHeight:'80px', borderRadius:'8px', marginBottom:'8px'}} />
                  ) : (
                    <div style={{fontSize:'13px', fontWeight:'600', marginBottom:'8px'}}>{q.question_text}</div>
                  )}
                  <div style={{display:'flex', gap:'8px', flexWrap:'wrap'}}>
                    {['A','B','C','D'].map(opt => (
                      <span key={opt} style={{fontSize:'11px', padding:'3px 8px', borderRadius:'6px',
                        background: q.correct_answer === opt ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.05)',
                        color: q.correct_answer === opt ? '#10B981' : 'var(--muted)',
                        fontWeight: q.correct_answer === opt ? '700' : '400'}}>
                        {opt}: {q[`option_${opt.toLowerCase()}`]}
                      </span>
                    ))}
                  </div>
                </div>
                <button onClick={() => deleteQuestion(q.id)}
                  style={{background:'rgba(239,68,68,0.15)', color:'#EF4444', border:'none', borderRadius:'8px', padding:'6px 10px', cursor:'pointer', fontSize:'12px', flexShrink:0}}>
                  🗑
                </button>
              </div>
            ))}
            {questions.length === 0 && (
              <div style={{textAlign:'center', color:'var(--muted)', fontSize:'13px', padding:'32px'}}>
                Суроолор жок — жогорудагы форм менен кошуңуз
              </div>
            )}
          </div>
        </div>
      ) : (
        <div style={{textAlign:'center', color:'var(--muted)', fontSize:'14px', padding:'60px'}}>
          ← Тест тандаңыз же жаңы тест түзүңүз
        </div>
      )}
    </div>
  )
}