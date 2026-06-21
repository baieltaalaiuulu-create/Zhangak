'use client'
export const dynamic = 'force-dynamic'

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

  useEffect(() => { checkAuth() }, [])

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (prof?.role !== 'student') { router.push('/'); return }
    setProfile(prof)
    fetchData(user.id)
  }

  const fetchData = async (uid: string) => {
    const { data: gs } = await supabase.from('group_students').select('group_id, groups(course_id, name)').eq('student_id', uid).single()
    if (gs) {
      const courseId = (gs.groups as any)?.course_id
      const { data: lsns } = await supabase.from('lessons').select('*').eq('course_id', courseId).order('lesson_number')
      setLessons(lsns || [])
      const { data: att } = await supabase.from('attendance').select('*, lessons(title, lesson_number)').eq('student_id', uid)
      setAttendance(att || [])
      const { data: res } = await supabase.from('test_results').select('*, lessons(title)').eq('student_id', uid).order('created_at', { ascending: false })
      setResults(res || [])
      const lessonIds = lsns?.map((l: any) => l.id) || []
      if (lessonIds.length > 0) {
        const { data: hws } = await supabase.from('homeworks').select('*, homework_submissions(student_id)').in('lesson_id', lessonIds)
        setHomeworks(hws || [])
      }
    }
    setLoading(false)
  }

  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/') }

  const tabs = [
    { id: 'schedule', label: 'Расписание', icon: '📅' },
    { id: 'tests', label: 'Тесттер', icon: '📝' },
    { id: 'results', label: 'Натыйжалар', icon: '📊' },
    { id: 'homework', label: 'Үй тапшырма', icon: '📚' },
    { id: 'attendance', label: 'Катышуу', icon: '✅' },
  ]

  const presentCount = attendance.filter(a => a.status === 'present').length

  if (loading) return (
    <div style={{minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#F8FAFF'}}>
      <div style={{textAlign:'center'}}>
        <img src="/images/logo.png" alt="Zhangak" style={{width:'48px', marginBottom:'16px'}} />
        <div style={{color:'#64748B', fontSize:'14px'}}>Жүктөлүүдө...</div>
      </div>
    </div>
  )

  return (
    <div style={{minHeight:'100vh', background:'#F8FAFF', fontFamily:'Inter, sans-serif'}}>
      {/* NAVBAR */}
      <nav style={{background:'#fff', borderBottom:'1px solid #E8ECF4', padding:'0 32px', height:'64px', display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:100, boxShadow:'0 1px 8px rgba(0,0,0,0.06)'}}>
        <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
          <img src="/images/logo.png" alt="Zhangak" style={{width:'36px', height:'36px', objectFit:'contain'}} />
          <span style={{fontWeight:'900', fontSize:'18px', color:'#1B4FD8'}}>Zhangak</span>
        </div>
        <div style={{display:'flex', alignItems:'center', gap:'16px'}}>
          <div style={{display:'flex', alignItems:'center', gap:'8px', background:'#F1F5F9', borderRadius:'10px', padding:'8px 14px'}}>
            <div style={{width:'28px', height:'28px', background:'linear-gradient(135deg,#1B4FD8,#3B82F6)', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:'700', fontSize:'12px'}}>
              {profile?.full_name?.[0] || 'У'}
            </div>
            <span style={{fontSize:'14px', fontWeight:'600', color:'#1E293B'}}>{profile?.full_name}</span>
          </div>
          <button onClick={handleLogout} style={{background:'none', border:'1px solid #E2E8F0', borderRadius:'8px', padding:'8px 16px', fontSize:'13px', color:'#64748B', cursor:'pointer', fontWeight:'500'}}>
            Чыгуу
          </button>
        </div>
      </nav>

      <div style={{maxWidth:'1100px', margin:'0 auto', padding:'32px 24px'}}>
        {/* STATS ROW */}
        <div style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'16px', marginBottom:'28px'}}>
          {[
            { label:'Сабактар', value: lessons.length, icon:'📅', color:'#1B4FD8', bg:'#EFF6FF' },
            { label:'Катышуу', value: `${presentCount}/${attendance.length}`, icon:'✅', color:'#059669', bg:'#F0FDF4' },
            { label:'Тесттер', value: results.length, icon:'📊', color:'#7C3AED', bg:'#F5F3FF' },
            { label:'Үй тапшырма', value: homeworks.length, icon:'📚', color:'#D97706', bg:'#FFF7ED' },
          ].map(s => (
            <div key={s.label} style={{background:'#fff', borderRadius:'16px', padding:'20px', border:'1px solid #E8ECF4', display:'flex', alignItems:'center', gap:'14px'}}>
              <div style={{width:'44px', height:'44px', background:s.bg, borderRadius:'12px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'20px', flexShrink:0}}>{s.icon}</div>
              <div>
                <div style={{fontWeight:'900', fontSize:'22px', color:s.color}}>{s.value}</div>
                <div style={{fontSize:'12px', color:'#94A3B8', marginTop:'2px'}}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* TABS */}
        <div style={{display:'flex', gap:'8px', marginBottom:'24px', background:'#fff', padding:'6px', borderRadius:'14px', border:'1px solid #E8ECF4', width:'fit-content'}}>
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              style={{display:'flex', alignItems:'center', gap:'6px', padding:'10px 18px', borderRadius:'10px', border:'none', fontSize:'13px', fontWeight:'600', cursor:'pointer', transition:'all 0.2s',
                background: activeTab === tab.id ? '#1B4FD8' : 'transparent',
                color: activeTab === tab.id ? '#fff' : '#64748B',
              }}>
              <span>{tab.icon}</span> {tab.label}
            </button>
          ))}
        </div>

        {/* SCHEDULE */}
        {activeTab === 'schedule' && (
          <div>
            <h2 style={{fontSize:'20px', fontWeight:'800', color:'#1E293B', marginBottom:'20px'}}>Сабак программасы</h2>
            <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:'16px'}}>
              {lessons.map(l => (
                <div key={l.id} style={{background:'#fff', borderRadius:'16px', border: l.is_test ? '2px solid #7C3AED' : '1px solid #E8ECF4', overflow:'hidden'}}>
                  <div style={{height:'4px', background: l.is_test ? 'linear-gradient(90deg,#7C3AED,#A855F7)' : 'linear-gradient(90deg,#1B4FD8,#3B82F6)'}}></div>
                  <div style={{padding:'18px'}}>
                    <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'12px'}}>
                      <span style={{fontSize:'11px', fontWeight:'700', color:'#94A3B8'}}>#{l.lesson_number}</span>
                      {l.is_test && <span style={{background:'#F5F3FF', color:'#7C3AED', fontSize:'11px', fontWeight:'700', padding:'3px 10px', borderRadius:'20px'}}>Тест</span>}
                    </div>
                    <div style={{fontWeight:'700', fontSize:'15px', color:'#1E293B', marginBottom:'12px'}}>{l.title}</div>
                    <div style={{display:'flex', flexDirection:'column', gap:'6px'}}>
                      <div style={{display:'flex', alignItems:'center', gap:'8px', padding:'6px 10px', background:'#EFF6FF', borderRadius:'8px'}}>
                        <span style={{fontSize:'12px'}}>📐</span>
                        <span style={{fontSize:'12px', color:'#1B4FD8', fontWeight:'500'}}>{l.math_topic}</span>
                      </div>
                      <div style={{display:'flex', alignItems:'center', gap:'8px', padding:'6px 10px', background:'#F5F3FF', borderRadius:'8px'}}>
                        <span style={{fontSize:'12px'}}>✍️</span>
                        <span style={{fontSize:'12px', color:'#7C3AED', fontWeight:'500'}}>{l.kyr_topic}</span>
                      </div>
                      <div style={{display:'flex', alignItems:'center', gap:'8px', padding:'6px 10px', background:'#F0FDF4', borderRadius:'8px'}}>
                        <span style={{fontSize:'12px'}}>📖</span>
                        <span style={{fontSize:'12px', color:'#059669', fontWeight:'500'}}>{l.reading_topic}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TESTS */}
        {activeTab === 'tests' && (
          <div>
            <h2 style={{fontSize:'20px', fontWeight:'800', color:'#1E293B', marginBottom:'20px'}}>Практикалык тесттер</h2>
            <div style={{background:'#fff', borderRadius:'16px', border:'1px solid #E8ECF4', padding:'48px', textAlign:'center'}}>
              <div style={{fontSize:'48px', marginBottom:'16px'}}>📝</div>
              <div style={{fontWeight:'700', fontSize:'18px', color:'#1E293B', marginBottom:'8px'}}>Тесттер жакында</div>
              <div style={{color:'#94A3B8', fontSize:'14px'}}>Мугалим тесттерди жүктөгөндөн кийин бул жерде пайда болот</div>
            </div>
          </div>
        )}

        {/* RESULTS */}
        {activeTab === 'results' && (
          <div>
            <h2 style={{fontSize:'20px', fontWeight:'800', color:'#1E293B', marginBottom:'20px'}}>Менин натыйжаларым</h2>
            {results.length === 0 ? (
              <div style={{background:'#fff', borderRadius:'16px', border:'1px solid #E8ECF4', padding:'48px', textAlign:'center'}}>
                <div style={{fontSize:'48px', marginBottom:'16px'}}>📊</div>
                <div style={{fontWeight:'700', fontSize:'18px', color:'#1E293B', marginBottom:'8px'}}>Натыйжа жок</div>
                <div style={{color:'#94A3B8', fontSize:'14px'}}>Тесттен өткөндөн кийин натыйжалар бул жерде пайда болот</div>
              </div>
            ) : (
              <div style={{display:'flex', flexDirection:'column', gap:'16px'}}>
                {results.map(r => (
                  <div key={r.id} style={{background:'#fff', borderRadius:'16px', border:'1px solid #E8ECF4', padding:'24px'}}>
                    <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'20px'}}>
                      <div style={{fontWeight:'700', fontSize:'16px', color:'#1E293B'}}>{r.lessons?.title}</div>
                      <div style={{background:'linear-gradient(135deg,#1B4FD8,#7C3AED)', borderRadius:'12px', padding:'8px 20px'}}>
                        <span style={{color:'#fff', fontWeight:'900', fontSize:'20px'}}>{Number(r.total_score).toFixed(1)}</span>
                        <span style={{color:'rgba(255,255,255,0.7)', fontSize:'12px', marginLeft:'4px'}}>балл</span>
                      </div>
                    </div>
                    <div style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'12px'}}>
                      {[
                        { label:'Математика', value: r.math_score, mult: 1.12, color:'#1B4FD8', bg:'#EFF6FF' },
                        { label:'Аналогия', value: r.analogy_score, mult: 2, color:'#7C3AED', bg:'#F5F3FF' },
                        { label:'Чтение', value: r.reading_score, mult: 2, color:'#059669', bg:'#F0FDF4' },
                        { label:'Грамматика', value: r.grammar_score, mult: 1.93, color:'#D97706', bg:'#FFF7ED' },
                      ].map(s => (
                        <div key={s.label} style={{background:s.bg, borderRadius:'12px', padding:'14px', textAlign:'center'}}>
                          <div style={{fontSize:'11px', color:s.color, fontWeight:'600', marginBottom:'6px'}}>{s.label}</div>
                          <div style={{fontWeight:'900', fontSize:'20px', color:'#1E293B'}}>{s.value}</div>
                          <div style={{fontSize:'11px', color:'#94A3B8', marginTop:'3px'}}>×{s.mult} = {(s.value*s.mult).toFixed(1)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* HOMEWORK */}
        {activeTab === 'homework' && (
          <div>
            <h2 style={{fontSize:'20px', fontWeight:'800', color:'#1E293B', marginBottom:'20px'}}>Үй тапшырмалар</h2>
            {homeworks.length === 0 ? (
              <div style={{background:'#fff', borderRadius:'16px', border:'1px solid #E8ECF4', padding:'48px', textAlign:'center'}}>
                <div style={{fontSize:'48px', marginBottom:'16px'}}>📚</div>
                <div style={{fontWeight:'700', fontSize:'18px', color:'#1E293B', marginBottom:'8px'}}>Тапшырма жок</div>
                <div style={{color:'#94A3B8', fontSize:'14px'}}>Мугалим тапшырма берсе бул жерде пайда болот</div>
              </div>
            ) : (
              <div style={{display:'flex', flexDirection:'column', gap:'12px'}}>
                {homeworks.map(hw => {
                  const submitted = hw.homework_submissions?.some((s: any) => s.student_id === profile?.id)
                  return (
                    <div key={hw.id} style={{background:'#fff', borderRadius:'16px', border:`1px solid ${submitted ? '#BBF7D0' : '#E8ECF4'}`, padding:'20px', display:'flex', alignItems:'center', justifyContent:'space-between'}}>
                      <div>
                        <div style={{fontWeight:'700', fontSize:'15px', color:'#1E293B', marginBottom:'4px'}}>{hw.title}</div>
                        {hw.description && <div style={{fontSize:'13px', color:'#94A3B8'}}>{hw.description}</div>}
                        {hw.due_date && <div style={{fontSize:'12px', color:'#D97706', marginTop:'6px'}}>📅 {new Date(hw.due_date).toLocaleDateString('ru')}</div>}
                      </div>
                      <div style={{background: submitted ? '#F0FDF4' : '#FEF2F2', color: submitted ? '#059669' : '#EF4444', padding:'6px 14px', borderRadius:'20px', fontSize:'12px', fontWeight:'700', flexShrink:0}}>
                        {submitted ? '✓ Тапшырылды' : '⏳ Тапшырылган жок'}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ATTENDANCE */}
        {activeTab === 'attendance' && (
          <div>
            <h2 style={{fontSize:'20px', fontWeight:'800', color:'#1E293B', marginBottom:'20px'}}>Катышуу</h2>
            <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'16px', marginBottom:'24px'}}>
              {[
                { label:'Катышты', value: attendance.filter(a=>a.status==='present').length, color:'#059669', bg:'#F0FDF4' },
                { label:'Кечигип келди', value: attendance.filter(a=>a.status==='late').length, color:'#D97706', bg:'#FFF7ED' },
                { label:'Катышкан жок', value: attendance.filter(a=>a.status==='absent').length, color:'#EF4444', bg:'#FEF2F2' },
              ].map(s => (
                <div key={s.label} style={{background:'#fff', borderRadius:'16px', padding:'20px', border:'1px solid #E8ECF4', textAlign:'center'}}>
                  <div style={{fontWeight:'900', fontSize:'32px', color:s.color, marginBottom:'6px'}}>{s.value}</div>
                  <div style={{fontSize:'13px', color:'#94A3B8'}}>{s.label}</div>
                </div>
              ))}
            </div>
            <div style={{display:'flex', flexDirection:'column', gap:'10px'}}>
              {attendance.map(a => (
                <div key={a.id} style={{background:'#fff', borderRadius:'12px', border:'1px solid #E8ECF4', padding:'14px 20px', display:'flex', alignItems:'center', justifyContent:'space-between'}}>
                  <div style={{fontWeight:'500', fontSize:'14px', color:'#1E293B'}}>
                    #{a.lessons?.lesson_number} {a.lessons?.title}
                  </div>
                  <div style={{
                    padding:'5px 14px', borderRadius:'20px', fontSize:'12px', fontWeight:'700',
                    background: a.status==='present' ? '#F0FDF4' : a.status==='late' ? '#FFF7ED' : '#FEF2F2',
                    color: a.status==='present' ? '#059669' : a.status==='late' ? '#D97706' : '#EF4444'
                  }}>
                    {a.status==='present' ? '✓ Катышты' : a.status==='late' ? '⏰ Кечигди' : '✗ Жок болду'}
                  </div>
                </div>
              ))}
              {attendance.length === 0 && (
                <div style={{background:'#fff', borderRadius:'16px', border:'1px solid #E8ECF4', padding:'48px', textAlign:'center', color:'#94A3B8'}}>
                  Маалымат жок
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}