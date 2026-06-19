 'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function StudentPage() {
  const [activeTab, setActiveTab] = useState('schedule')
  const [profile, setProfile] = useState<any>(null)
  const [lessons, setLessons] = useState<any[]>([])
  const [attendance, setAttendance] = useState<any[]>([])
  const [results, setResults] = useState<any[]>([])
  const [homeworks, setHomeworks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }

    const { data: prof } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (prof?.role !== 'student') { router.push('/'); return }
    setProfile(prof)
    fetchData(user.id)
  }

  const fetchData = async (uid: string) => {
    // Находим группу ученика
    const { data: gs } = await supabase
      .from('group_students')
      .select('group_id, groups(course_id, name)')
      .eq('student_id', uid)
      .single()

    if (gs) {
      const courseId = (gs.groups as any)?.course_id

      // Занятия
      const { data: lsns } = await supabase
        .from('lessons')
        .select('*')
        .eq('course_id', courseId)
        .order('lesson_number')
      setLessons(lsns || [])

      // Посещаемость
      const { data: att } = await supabase
        .from('attendance')
        .select('*, lessons(title, lesson_number)')
        .eq('student_id', uid)
      setAttendance(att || [])

      // Результаты тестов
      const { data: res } = await supabase
        .from('test_results')
        .select('*, lessons(title)')
        .eq('student_id', uid)
        .order('created_at', { ascending: false })
      setResults(res || [])

      // Домашки
      const lessonIds = lsns?.map((l: any) => l.id) || []
      if (lessonIds.length > 0) {
        const { data: hws } = await supabase
          .from('homeworks')
          .select('*, homework_submissions(student_id)')
          .in('lesson_id', lessonIds)
        setHomeworks(hws || [])
      }
    }
    setLoading(false)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const tabs = [
    { id: 'schedule', label: '📅 Расписание' },
    { id: 'attendance', label: '✅ Посещаемость' },
    { id: 'results', label: '📊 Мои результаты' },
    { id: 'homework', label: '📝 Домашка' },
  ]

  const presentCount = attendance.filter(a => a.status === 'present').length
  const totalCount = attendance.length

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{background:'var(--bg)'}}>
      <div style={{color:'var(--muted)'}}>Загрузка...</div>
    </div>
  )

  return (
    <div className="min-h-screen" style={{background:'var(--bg)'}}>
      {/* Шапка */}
      <div className="flex items-center justify-between px-6 py-4" style={{borderBottom:'1px solid var(--border)',background:'var(--surface)'}}>
        <div className="font-black text-lg" style={{background:'linear-gradient(90deg,#4B8EF5,#D45FCC)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>
          ЖАНГАК
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm" style={{color:'var(--muted)'}}>
            {profile?.full_name}
          </div>
          <button onClick={handleLogout} className="text-sm px-4 py-2 rounded-lg" style={{background:'var(--bg)',color:'var(--muted)',border:'1px solid var(--border)'}}>
            Выйти
          </button>
        </div>
      </div>

      <div className="flex">
        {/* Меню */}
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

          {/* Статистика */}
          <div className="mt-6 p-3 rounded-xl" style={{background:'var(--bg)',border:'1px solid var(--border)'}}>
            <div className="text-xs mb-2" style={{color:'var(--muted)'}}>Посещаемость</div>
            <div className="text-2xl font-black" style={{color:'#34C97B'}}>
              {totalCount > 0 ? Math.round(presentCount/totalCount*100) : 0}%
            </div>
            <div className="text-xs mt-1" style={{color:'var(--muted)'}}>
              {presentCount} из {totalCount} занятий
            </div>
          </div>
        </div>

        {/* Контент */}
        <div className="flex-1 p-6">

          {/* РАСПИСАНИЕ */}
          {activeTab === 'schedule' && (
            <div>
              <h2 className="text-xl font-bold mb-6">Расписание занятий</h2>
              <div className="grid grid-cols-3 gap-3">
                {lessons.map(l => (
                  <div key={l.id} className="p-4 rounded-xl"
                    style={{
                      background:'var(--surface)',
                      border: l.is_test ? '1px solid rgba(123,97,255,0.4)' : '1px solid var(--border)'
                    }}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold" style={{color:'var(--muted)'}}>№{l.lesson_number}</span>
                      {l.is_test && (
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{background:'rgba(123,97,255,0.15)',color:'#7B61FF'}}>
                          Тест
                        </span>
                      )}
                    </div>
                    <div className="font-medium text-sm mb-3">{l.title}</div>
                    <div className="flex flex-col gap-1">
                      <div className="text-xs px-2 py-1 rounded-lg" style={{background:'rgba(75,142,245,0.1)',color:'#4B8EF5'}}>
                        📐 {l.math_topic}
                      </div>
                      <div className="text-xs px-2 py-1 rounded-lg" style={{background:'rgba(212,95,204,0.1)',color:'#D45FCC'}}>
                        🔤 {l.kyr_topic}
                      </div>
                      <div className="text-xs px-2 py-1 rounded-lg" style={{background:'rgba(52,201,123,0.1)',color:'#34C97B'}}>
                        📖 {l.reading_topic}
                      </div>
                    </div>
                    {l.lesson_date && (
                      <div className="text-xs mt-2" style={{color:'var(--muted)'}}>
                        📅 {new Date(l.lesson_date).toLocaleDateString('ru')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ПОСЕЩАЕМОСТЬ */}
          {activeTab === 'attendance' && (
            <div>
              <h2 className="text-xl font-bold mb-6">Моя посещаемость</h2>
              <div className="grid grid-cols-3 gap-3 mb-6">
                {[
                  { label:'Присутствовал', value: attendance.filter(a=>a.status==='present').length, color:'#34C97B' },
                  { label:'Опоздал', value: attendance.filter(a=>a.status==='late').length, color:'#F5A623' },
                  { label:'Отсутствовал', value: attendance.filter(a=>a.status==='absent').length, color:'#FF6B6B' },
                ].map(stat => (
                  <div key={stat.label} className="p-4 rounded-xl text-center" style={{background:'var(--surface)',border:'1px solid var(--border)'}}>
                    <div className="text-3xl font-black mb-1" style={{color:stat.color}}>{stat.value}</div>
                    <div className="text-xs" style={{color:'var(--muted)'}}>{stat.label}</div>
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-2">
                {attendance.map(a => (
                  <div key={a.id} className="flex items-center justify-between p-3 rounded-xl"
                    style={{background:'var(--surface)',border:'1px solid var(--border)'}}>
                    <div className="text-sm font-medium">
                      №{a.lessons?.lesson_number} {a.lessons?.title}
                    </div>
                    <div className="text-xs px-3 py-1 rounded-full font-bold" style={{
                      background: a.status==='present' ? 'rgba(52,201,123,0.15)' : a.status==='late' ? 'rgba(245,166,35,0.15)' : 'rgba(255,107,107,0.15)',
                      color: a.status==='present' ? '#34C97B' : a.status==='late' ? '#F5A623' : '#FF6B6B'
                    }}>
                      {a.status==='present' ? '✓ Присутствовал' : a.status==='late' ? '⏰ Опоздал' : '✗ Отсутствовал'}
                    </div>
                  </div>
                ))}
                {attendance.length === 0 && (
                  <div className="text-center py-8" style={{color:'var(--muted)'}}>Данных пока нет</div>
                )}
              </div>
            </div>
          )}

          {/* РЕЗУЛЬТАТЫ */}
          {activeTab === 'results' && (
            <div>
              <h2 className="text-xl font-bold mb-6">Мои результаты</h2>
              {results.length === 0 ? (
                <div className="text-center py-12" style={{color:'var(--muted)'}}>Результатов пока нет</div>
              ) : (
                <div className="flex flex-col gap-4">
                  {results.map(r => (
                    <div key={r.id} className="p-5 rounded-xl" style={{background:'var(--surface)',border:'1px solid var(--border)'}}>
                      <div className="flex items-center justify-between mb-4">
                        <div className="font-bold">{r.lessons?.title}</div>
                        <div className="text-2xl font-black" style={{color:'#7B61FF'}}>
                          {Number(r.total_score).toFixed(1)} б
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-3">
                        {[
                          { label:'Математика', value: r.math_score, mult: 1.12, color:'#4B8EF5' },
                          { label:'Аналогия', value: r.analogy_score, mult: 2, color:'#D45FCC' },
                          { label:'Чтение', value: r.reading_score, mult: 2, color:'#34C97B' },
                          { label:'Грамматика', value: r.grammar_score, mult: 1.93, color:'#F5A623' },
                        ].map(s => (
                          <div key={s.label} className="p-3 rounded-lg text-center" style={{background:'var(--bg)'}}>
                            <div className="text-xs mb-1" style={{color:s.color}}>{s.label}</div>
                            <div className="font-black text-lg" style={{color:'var(--text)'}}>{s.value}</div>
                            <div className="text-xs mt-1" style={{color:'var(--muted)'}}>×{s.mult} = {(s.value*s.mult).toFixed(1)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ДОМАШКА */}
          {activeTab === 'homework' && (
            <div>
              <h2 className="text-xl font-bold mb-6">Домашние задания</h2>
              {homeworks.length === 0 ? (
                <div className="text-center py-12" style={{color:'var(--muted)'}}>Заданий пока нет</div>
              ) : (
                <div className="flex flex-col gap-3">
                  {homeworks.map(hw => {
                    const submitted = hw.homework_submissions?.some((s: any) => s.student_id === profile?.id)
                    return (
                      <div key={hw.id} className="p-4 rounded-xl" style={{background:'var(--surface)',border:`1px solid ${submitted ? 'rgba(52,201,123,0.3)' : 'var(--border)'}`}}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-bold">{hw.title}</div>
                          <div className="text-xs px-2 py-1 rounded-full" style={{
                            background: submitted ? 'rgba(52,201,123,0.15)' : 'rgba(255,107,107,0.15)',
                            color: submitted ? '#34C97B' : '#FF6B6B'
                          }}>
                            {submitted ? '✓ Сдано' : '⏳ Не сдано'}
                          </div>
                        </div>
                        {hw.description && <div className="text-sm mb-2" style={{color:'var(--muted)'}}>{hw.description}</div>}
                        {hw.due_date && (
                          <div className="text-xs" style={{color:'#F5A623'}}>
                            До: {new Date(hw.due_date).toLocaleDateString('ru')}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
