'use client'
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
  
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  
  console.log('Admin check - user:', user.id, 'profile:', profile)
  
  if (!profile) {
    console.log('No profile found, staying on admin page')
    return
  }
  
  if (profile.role !== 'admin') {
    router.push('/')
  }
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
    { id: 'results', label: '📈 Результаты' },
  ]

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{background:'var(--bg)'}}>
      <div style={{color:'var(--muted)'}}>Загрузка...</div>
    </div>
  )

  return (
    <div className="min-h-screen" style={{background:'var(--bg)'}}>
      {/* Шапка */}
      <div className="flex items-center justify-between px-6 py-4" style={{borderBottom:'1px solid var(--border)', background:'var(--surface)'}}>
        <div className="font-black text-lg" style={{background:'linear-gradient(90deg,#4B8EF5,#D45FCC)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>
          ЖАНГАК — Админ
        </div>
        <button onClick={handleLogout} className="text-sm px-4 py-2 rounded-lg" style={{background:'var(--bg)',color:'var(--muted)',border:'1px solid var(--border)'}}>
          Выйти
        </button>
      </div>

      <div className="flex">
        {/* Боковое меню */}
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

        {/* Контент */}
        <div className="flex-1 p-6">

          {/* ГЛАВНАЯ */}
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

          {/* ПРОГРАММА */}
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
                          <td className="px-4 py-3 text-xs" style={{color:'#4B8EF5'}}>{l.math_topic}</td>
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

          {/* УЧЕНИКИ */}
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
                      <th className="text-left px-4 py-3" style={{color:'var(--muted)'}}>Email</th>
                      <th className="text-left px-4 py-3" style={{color:'var(--muted)'}}>Телефон</th>
                      <th className="text-left px-4 py-3" style={{color:'var(--muted)'}}>Дата</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((s, i) => (
                      <tr key={s.id} style={{borderBottom:'1px solid var(--border)',background:i%2===0?'var(--bg)':'var(--surface)'}}>
                        <td className="px-4 py-3 font-medium">{s.full_name}</td>
                        <td className="px-4 py-3" style={{color:'var(--muted)'}}>{s.email || '—'}</td>
                        <td className="px-4 py-3" style={{color:'var(--muted)'}}>{s.phone || '—'}</td>
                        <td className="px-4 py-3 text-xs" style={{color:'var(--muted)'}}>{new Date(s.created_at).toLocaleDateString('ru')}</td>
                      </tr>
                    ))}
                    {students.length === 0 && (
                      <tr><td colSpan={4} className="px-4 py-8 text-center" style={{color:'var(--muted)'}}>Ученики не добавлены</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* УЧИТЕЛЯ */}
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

          {/* ГРУППЫ */}
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

          {/* РЕЗУЛЬТАТЫ */}
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