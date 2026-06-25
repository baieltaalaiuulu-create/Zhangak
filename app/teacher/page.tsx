 'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function TeacherPage() {
  const [activeTab, setActiveTab] = useState('lessons')
  const [lessons, setLessons] = useState<any[]>([])
  const [groups, setGroups] = useState<any[]>([])
  const [students, setStudents] = useState<any[]>([])
  const [selectedLesson, setSelectedLesson] = useState<any>(null)
  const [selectedGroup, setSelectedGroup] = useState<any>(null)
  const [attendance, setAttendance] = useState<any>({})
  const [testScores, setTestScores] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [userId, setUserId] = useState<string>('')
  const router = useRouter()

 useEffect(() => { checkAuth() }, [])

const checkAuth = async () => {
  await supabase.auth.getSession()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) { router.push('/'); return }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || profile.role !== 'teacher') {
    await supabase.auth.signOut()
    router.push('/')
    return
  }
  fetchData(user.id)
}
  const fetchData = async (uid: string) => {
    const { data: grps } = await supabase
      .from('groups')
      .select('*, courses(name, level)')
      .eq('teacher_id', uid)

    setGroups(grps || [])

    if (grps && grps.length > 0) {
      setSelectedGroup(grps[0])
      fetchGroupStudents(grps[0].id)
      fetchLessons(grps[0].course_id)
    }
    setLoading(false)
  }

  const fetchLessons = async (courseId: number) => {
    const { data } = await supabase
      .from('lessons')
      .select('*')
      .eq('course_id', courseId)
      .order('lesson_number')
    setLessons(data || [])
  }

  const fetchGroupStudents = async (groupId: number) => {
    const { data } = await supabase
      .from('group_students')
      .select('*, profiles(id, full_name, phone)')
      .eq('group_id', groupId)
    setStudents(data?.map((d: any) => d.profiles) || [])
  }

  const fetchAttendance = async (lessonId: number) => {
    const { data } = await supabase
      .from('attendance')
      .select('*')
      .eq('lesson_id', lessonId)

    const map: any = {}
    data?.forEach((a: any) => { map[a.student_id] = a.status })
    setAttendance(map)
  }

  const selectLesson = async (lesson: any) => {
    setSelectedLesson(lesson)
    await fetchAttendance(lesson.id)

    if (lesson.is_test) {
      const { data } = await supabase
        .from('test_results')
        .select('*')
        .eq('lesson_id', lesson.id)
      const map: any = {}
      data?.forEach((r: any) => {
        map[r.student_id] = {
          math_score: r.math_score,
          analogy_score: r.analogy_score,
          reading_score: r.reading_score,
          grammar_score: r.grammar_score,
        }
      })
      setTestScores(map)
    }
  }

  const saveAttendance = async () => {
    if (!selectedLesson) return
    setSaving(true)

    for (const student of students) {
      const status = attendance[student.id] || 'absent'
      await supabase.from('attendance').upsert({
        lesson_id: selectedLesson.id,
        student_id: student.id,
        status,
      }, { onConflict: 'lesson_id,student_id' })
    }
    setSaving(false)
    alert('Посещаемость сохранена!')
  }

  const saveTestResults = async () => {
    if (!selectedLesson) return
    setSaving(true)

    for (const student of students) {
      const scores = testScores[student.id] || {}
      const math = Number(scores.math_score || 0)
      const analogy = Number(scores.analogy_score || 0)
      const reading = Number(scores.reading_score || 0)
      const grammar = Number(scores.grammar_score || 0)

      await supabase.from('test_results').upsert({
        lesson_id: selectedLesson.id,
        student_id: student.id,
        math_score: math,
        analogy_score: analogy,
        reading_score: reading,
        grammar_score: grammar,
      }, { onConflict: 'lesson_id,student_id' })
    }
    setSaving(false)
    alert('Результаты сохранены!')
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const tabs = [
    { id: 'lessons', label: '📚 Занятия' },
    { id: 'attendance', label: '✅ Посещаемость' },
    { id: 'results', label: '📊 Результаты' },
    { id: 'homework', label: '📝 Домашка' },
  ]

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
          ЖАНГАК — Учитель
        </div>
        <div className="flex items-center gap-4">
          {selectedGroup && (
            <div className="text-sm px-3 py-1 rounded-lg" style={{background:'rgba(75,142,245,0.1)',color:'#4B8EF5',border:'1px solid rgba(75,142,245,0.2)'}}>
              {selectedGroup.name} · {selectedGroup.courses?.level}
            </div>
          )}
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

          <div className="mt-4 pt-4" style={{borderTop:'1px solid var(--border)'}}>
            <div className="text-xs mb-2 px-2" style={{color:'var(--muted)'}}>Группы</div>
            {groups.map(g => (
              <button key={g.id}
                onClick={() => { setSelectedGroup(g); fetchGroupStudents(g.id); fetchLessons(g.course_id) }}
                className="w-full text-left px-3 py-2 rounded-lg text-xs mb-1"
                style={{
                  background: selectedGroup?.id === g.id ? 'rgba(212,95,204,0.15)' : 'transparent',
                  color: selectedGroup?.id === g.id ? '#D45FCC' : 'var(--muted)'
                }}>
                {g.name}
              </button>
            ))}
          </div>
        </div>

        {/* Контент */}
        <div className="flex-1 p-6">

          {/* ЗАНЯТИЯ */}
          {activeTab === 'lessons' && (
            <div>
              <h2 className="text-xl font-bold mb-6">Занятия</h2>
              <div className="grid grid-cols-3 gap-3">
                {lessons.map(l => (
                  <button key={l.id} onClick={() => { selectLesson(l); setActiveTab('attendance') }}
                    className="p-4 rounded-xl text-left transition-all"
                    style={{
                      background: 'var(--surface)',
                      border: l.is_test ? '1px solid rgba(123,97,255,0.4)' : '1px solid var(--border)'
                    }}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold" style={{color:'var(--muted)'}}>№{l.lesson_number}</span>
                      {l.is_test && <span className="text-xs px-2 py-0.5 rounded-full" style={{background:'rgba(123,97,255,0.15)',color:'#7B61FF'}}>Тест</span>}
                    </div>
                    <div className="font-medium text-sm mb-2">{l.title}</div>
                    <div className="text-xs" style={{color:'#4B8EF5'}}>{l.math_topic}</div>
                    <div className="text-xs mt-1" style={{color:'#D45FCC'}}>{l.kyr_topic}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ПОСЕЩАЕМОСТЬ */}
          {activeTab === 'attendance' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">Посещаемость</h2>
                <button onClick={saveAttendance} disabled={saving || !selectedLesson}
                  className="px-5 py-2 rounded-xl text-sm font-bold"
                  style={{background:'linear-gradient(90deg,#4B8EF5,#D45FCC)',color:'#fff',opacity:saving?0.7:1}}>
                  {saving ? 'Сохраняем...' : 'Сохранить'}
                </button>
              </div>

              {!selectedLesson ? (
                <div className="text-center py-12" style={{color:'var(--muted)'}}>
                  Выберите занятие на вкладке Занятия
                </div>
              ) : (
                <div>
                  <div className="p-4 rounded-xl mb-4" style={{background:'var(--surface)',border:'1px solid var(--border)'}}>
                    <div className="font-bold">{selectedLesson.title}</div>
                    <div className="text-xs mt-1" style={{color:'var(--muted)'}}>
                      Мат: {selectedLesson.math_topic} · Кыр: {selectedLesson.kyr_topic}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    {students.map(student => (
                      <div key={student.id} className="flex items-center justify-between p-4 rounded-xl"
                        style={{background:'var(--surface)',border:'1px solid var(--border)'}}>
                        <div className="font-medium">{student.full_name}</div>
                        <div className="flex gap-2">
                          {[
                            { value: 'present', label: '✓ Пришёл', color: '#34C97B' },
                            { value: 'late', label: '⏰ Опоздал', color: '#F5A623' },
                            { value: 'absent', label: '✗ Отсутствует', color: '#FF6B6B' },
                          ].map(opt => (
                            <button key={opt.value}
                              onClick={() => setAttendance((prev: any) => ({...prev, [student.id]: opt.value}))}
                              className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all"
                              style={{
                                background: attendance[student.id] === opt.value ? `${opt.color}22` : 'var(--bg)',
                                color: attendance[student.id] === opt.value ? opt.color : 'var(--muted)',
                                border: attendance[student.id] === opt.value ? `1px solid ${opt.color}44` : '1px solid var(--border)'
                              }}>
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                    {students.length === 0 && (
                      <div className="text-center py-8" style={{color:'var(--muted)'}}>Ученики не добавлены в группу</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* РЕЗУЛЬТАТЫ ТЕСТОВ */}
          {activeTab === 'results' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">Результаты тестов</h2>
                <button onClick={saveTestResults} disabled={saving || !selectedLesson?.is_test}
                  className="px-5 py-2 rounded-xl text-sm font-bold"
                  style={{background:'linear-gradient(90deg,#4B8EF5,#D45FCC)',color:'#fff',opacity:(saving||!selectedLesson?.is_test)?0.5:1}}>
                  {saving ? 'Сохраняем...' : 'Сохранить'}
                </button>
              </div>

              {!selectedLesson?.is_test ? (
                <div className="text-center py-12" style={{color:'var(--muted)'}}>
                  Выберите тестовое занятие на вкладке Занятия
                </div>
              ) : (
                <div>
                  <div className="p-3 mb-4 rounded-xl text-sm" style={{background:'rgba(75,142,245,0.1)',color:'#4B8EF5',border:'1px solid rgba(75,142,245,0.2)'}}>
                    Формула: Мат×1.12 + Аналогия×2 + Чтение×2 + Грамматика×1.93
                  </div>
                  <div className="flex flex-col gap-3">
                    {students.map(student => {
                      const scores = testScores[student.id] || {}
                      const total = (
                        Number(scores.math_score||0)*1.12 +
                        Number(scores.analogy_score||0)*2 +
                        Number(scores.reading_score||0)*2 +
                        Number(scores.grammar_score||0)*1.93
                      ).toFixed(1)
                      return (
                        <div key={student.id} className="p-4 rounded-xl" style={{background:'var(--surface)',border:'1px solid var(--border)'}}>
                          <div className="flex items-center justify-between mb-3">
                            <div className="font-bold">{student.full_name}</div>
                            <div className="font-black text-lg" style={{color:'#7B61FF'}}>{total} б</div>
                          </div>
                          <div className="grid grid-cols-4 gap-3">
                            {[
                              { key:'math_score', label:'Математика', color:'#4B8EF5' },
                              { key:'analogy_score', label:'Аналогия', color:'#D45FCC' },
                              { key:'reading_score', label:'Чтение', color:'#34C97B' },
                              { key:'grammar_score', label:'Грамматика', color:'#F5A623' },
                            ].map(field => (
                              <div key={field.key}>
                                <div className="text-xs mb-1" style={{color:field.color}}>{field.label}</div>
                                <input
                                  type="number"
                                  min="0"
                                  value={scores[field.key] || ''}
                                  onChange={e => setTestScores((prev: any) => ({
                                    ...prev,
                                    [student.id]: {...(prev[student.id]||{}), [field.key]: e.target.value}
                                  }))}
                                  placeholder="0"
                                  className="w-full px-3 py-2 rounded-lg text-sm text-center font-bold outline-none"
                                  style={{background:'var(--bg)',border:`1px solid ${field.color}44`,color:field.color}}
                                />
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

          {/* ДОМАШКА */}
          {activeTab === 'homework' && (
            <HomeworkTab lessons={lessons} students={students} selectedLesson={selectedLesson} setSelectedLesson={setSelectedLesson} />
          )}
        </div>
      </div>
    </div>
  )
}

function HomeworkTab({ lessons, students, selectedLesson, setSelectedLesson }: any) {
  const [homeworks, setHomeworks] = useState<any[]>([])
  const [newHW, setNewHW] = useState({ title: '', description: '', due_date: '' })
  const [saving, setSaving] = useState(false)

  const fetchHomeworks = async (lessonId: number) => {
    const { data } = await supabase.from('homeworks').select('*, homework_submissions(student_id, answer)').eq('lesson_id', lessonId)
    setHomeworks(data || [])
  }

  const selectLesson = (l: any) => {
    setSelectedLesson(l)
    fetchHomeworks(l.id)
  }

  const addHomework = async () => {
    if (!selectedLesson || !newHW.title) return
    setSaving(true)
    await supabase.from('homeworks').insert({
      lesson_id: selectedLesson.id,
      title: newHW.title,
      description: newHW.description,
      due_date: newHW.due_date || null,
    })
    setNewHW({ title: '', description: '', due_date: '' })
    fetchHomeworks(selectedLesson.id)
    setSaving(false)
  }

  return (
    <div>
      <h2 className="text-xl font-bold mb-6">Домашние задания</h2>
      <div className="grid grid-cols-3 gap-3 mb-6">
        {lessons.map((l: any) => (
          <button key={l.id} onClick={() => selectLesson(l)}
            className="p-3 rounded-xl text-left text-sm"
            style={{
              background: selectedLesson?.id === l.id ? 'rgba(75,142,245,0.15)' : 'var(--surface)',
              border: selectedLesson?.id === l.id ? '1px solid rgba(75,142,245,0.4)' : '1px solid var(--border)',
              color: 'var(--text)'
            }}>
            <span style={{color:'var(--muted)'}}>№{l.lesson_number}</span> {l.title}
          </button>
        ))}
      </div>

      {selectedLesson && (
        <div>
          {/* Добавить ДЗ */}
          <div className="p-4 rounded-xl mb-4" style={{background:'var(--surface)',border:'1px solid var(--border)'}}>
            <div className="font-bold mb-3">Новое задание</div>
            <input value={newHW.title} onChange={e => setNewHW(p => ({...p, title: e.target.value}))}
              placeholder="Название задания"
              className="w-full px-3 py-2 rounded-lg text-sm mb-2 outline-none"
              style={{background:'var(--bg)',border:'1px solid var(--border)',color:'var(--text)'}} />
            <textarea value={newHW.description} onChange={e => setNewHW(p => ({...p, description: e.target.value}))}
              placeholder="Описание (необязательно)"
              rows={2}
              className="w-full px-3 py-2 rounded-lg text-sm mb-2 outline-none resize-none"
              style={{background:'var(--bg)',border:'1px solid var(--border)',color:'var(--text)'}} />
            <div className="flex gap-2">
              <input type="date" value={newHW.due_date} onChange={e => setNewHW(p => ({...p, due_date: e.target.value}))}
                className="px-3 py-2 rounded-lg text-sm outline-none"
                style={{background:'var(--bg)',border:'1px solid var(--border)',color:'var(--text)'}} />
              <button onClick={addHomework} disabled={saving}
                className="px-5 py-2 rounded-lg text-sm font-bold"
                style={{background:'linear-gradient(90deg,#4B8EF5,#D45FCC)',color:'#fff'}}>
                {saving ? 'Добавляем...' : 'Добавить'}
              </button>
            </div>
          </div>

          {/* Список ДЗ */}
          {homeworks.map(hw => (
            <div key={hw.id} className="p-4 rounded-xl mb-3" style={{background:'var(--surface)',border:'1px solid var(--border)'}}>
              <div className="flex items-center justify-between mb-2">
                <div className="font-bold">{hw.title}</div>
                <div className="text-xs" style={{color:'var(--muted)'}}>
                  Сдали: {hw.homework_submissions?.length || 0} / {students.length}
                </div>
              </div>
              {hw.description && <div className="text-sm mb-2" style={{color:'var(--muted)'}}>{hw.description}</div>}
              {hw.due_date && <div className="text-xs" style={{color:'#F5A623'}}>До: {new Date(hw.due_date).toLocaleDateString('ru')}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
