'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

function Animate({ children, delay = 0 }: { children: React.ReactNode, delay?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setInView(true) }, { threshold: 0.05 })
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [])
  return (
    <div ref={ref} style={{
      opacity: inView ? 1 : 0,
      transform: inView ? 'translateY(0)' : 'translateY(20px)',
      transition: `opacity 0.5s ease ${delay}ms, transform 0.5s ease ${delay}ms`
    }}>
      {children}
    </div>
  )
}

const BLUE = '#2563EB'
const DARK = '#0D1E4A'
const SURFACE = '#0F1E35'
const BORDER = 'rgba(255,255,255,0.08)'

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

  useEffect(() => { checkAuth() }, [])

 const checkAuth = async () => {
await supabase.auth.getSession()
const { data: { user } } = await supabase.auth.getUser()  
  if (!user) { router.push('/'); return }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || profile.role !== 'admin') {
    await supabase.auth.signOut()
    router.push('/')
    return
  }
  fetchData()
}
  const fetchData = async () => {
    const [c, g, s, t] = await Promise.all([
      supabase.from('courses').select('*').order('id'),
      supabase.from('groups').select('*, courses(name), profiles(full_name)'),
      supabase.from('profiles').select('*').eq('role', 'student').order('full_name'),
      supabase.from('profiles').select('*').eq('role', 'teacher').order('full_name'),
    ])
    setCourses(c.data || [])
    setGroups(g.data || [])
    setStudents(s.data || [])
    setTeachers(t.data || [])
    setLoading(false)
  }

  const fetchLessons = async (courseId: number) => {
    setSelectedCourse(courseId)
    const { data } = await supabase.from('lessons').select('*').eq('course_id', courseId).order('lesson_number')
    setLessons(data || [])
  }

  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/') }

  const tabs = [
  { id: 'dashboard', label: 'Башкы бет', icon: '📊' },
  { id: 'crm', label: 'CRM', icon: '🎯' },
  { id: 'finance', label: 'Финансы', icon: '💰' },
  { id: 'courses', label: 'Программа', icon: '📚' },
  { id: 'groups', label: 'Группалар', icon: '👥' },
  { id: 'students', label: 'Окуучулар', icon: '🎓' },
  { id: 'teachers', label: 'Мугалимдер', icon: '👨‍🏫' },
  { id: 'tests', label: 'Тесттер', icon: '📝' },
  { id: 'results', label: 'Натыйжалар', icon: '📈' },
]

  if (loading) return (
    <div style={{minHeight:'100vh', background:DARK, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Inter, sans-serif'}}>
      <div style={{textAlign:'center'}}>
        <img src="/images/logo.png" alt="Zhangak" style={{width:'48px', filter:'brightness(0) invert(1)', marginBottom:'16px'}} />
        <div style={{color:'rgba(255,255,255,0.5)', fontSize:'14px'}}>Жүктөлүүдө...</div>
      </div>
    </div>
  )

  return (
    <div style={{minHeight:'100vh', background:DARK, fontFamily:'Inter, sans-serif', color:'#fff', display:'flex'}}>

      {/* SIDEBAR */}
      <div style={{width:'220px', minHeight:'100vh', background:SURFACE, borderRight:`1px solid ${BORDER}`, display:'flex', flexDirection:'column', position:'sticky', top:0, height:'100vh', overflowY:'auto'}}>
        {/* LOGO */}
        <div style={{padding:'20px 16px', borderBottom:`1px solid ${BORDER}`}}>
          <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
            <img src="/images/logo.png" alt="Zhangak" style={{width:'32px', height:'32px', objectFit:'contain', filter:'brightness(0) invert(1)'}} />
            <div>
              <div style={{fontWeight:'900', fontSize:'16px', color:'#fff'}}>Zhangak</div>
              <div style={{fontSize:'10px', color:'rgba(255,255,255,0.4)', marginTop:'1px'}}>Админ панели</div>
            </div>
          </div>
        </div>

        {/* NAV */}
        <nav style={{padding:'12px 8px', flex:1}}>
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              style={{
                width:'100%', display:'flex', alignItems:'center', gap:'10px',
                padding:'10px 12px', borderRadius:'10px', border:'none', cursor:'pointer',
                marginBottom:'2px', textAlign:'left', transition:'all 0.15s',
                background: activeTab === tab.id ? 'rgba(37,99,235,0.2)' : 'transparent',
                color: activeTab === tab.id ? '#60A5FA' : 'rgba(255,255,255,0.5)',
              }}>
              <span style={{fontSize:'16px'}}>{tab.icon}</span>
              <span style={{fontSize:'13px', fontWeight: activeTab === tab.id ? '700' : '500'}}>{tab.label}</span>
              {activeTab === tab.id && <div style={{marginLeft:'auto', width:'4px', height:'4px', borderRadius:'50%', background:'#60A5FA'}} />}
            </button>
          ))}
        </nav>

        {/* LOGOUT */}
        <div style={{padding:'12px 8px', borderTop:`1px solid ${BORDER}`}}>
          <button onClick={handleLogout}
            style={{width:'100%', display:'flex', alignItems:'center', gap:'10px', padding:'10px 12px', borderRadius:'10px', border:'none', cursor:'pointer', background:'rgba(239,68,68,0.1)', color:'#FCA5A5'}}>
            <span>🚪</span>
            <span style={{fontSize:'13px', fontWeight:'600'}}>Чыгуу</span>
          </button>
        </div>
      </div>

      {/* MAIN */}
      <div style={{flex:1, overflowY:'auto'}}>
        {/* TOPBAR */}
        <div style={{background:SURFACE, borderBottom:`1px solid ${BORDER}`, padding:'16px 28px', display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:50}}>
          <div>
            <div style={{fontWeight:'800', fontSize:'18px', color:'#fff'}}>
              {tabs.find(t => t.id === activeTab)?.icon} {tabs.find(t => t.id === activeTab)?.label}
            </div>
          </div>
          <div style={{display:'flex', alignItems:'center', gap:'12px'}}>
            <div style={{background:'rgba(37,99,235,0.15)', border:'1px solid rgba(37,99,235,0.3)', borderRadius:'20px', padding:'6px 14px', fontSize:'12px', color:'#60A5FA', fontWeight:'600'}}>
              👤 Администратор
            </div>
          </div>
        </div>

        <div style={{padding:'28px'}}>

          {/* DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div>
              <div style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'16px', marginBottom:'28px'}}>
                {[
                  { label:'Курстар', value: courses.length, icon:'📚', color:'#3B82F6', bg:'rgba(59,130,246,0.15)' },
                  { label:'Группалар', value: groups.length, icon:'👥', color:'#8B5CF6', bg:'rgba(139,92,246,0.15)' },
                  { label:'Окуучулар', value: students.length, icon:'🎓', color:'#10B981', bg:'rgba(16,185,129,0.15)' },
                  { label:'Мугалимдер', value: teachers.length, icon:'👨‍🏫', color:'#F59E0B', bg:'rgba(245,158,11,0.15)' },
                ].map((stat, i) => (
                  <Animate key={stat.label} delay={i * 80}>
                    <div style={{background:SURFACE, border:`1px solid ${BORDER}`, borderRadius:'16px', padding:'20px', display:'flex', alignItems:'center', gap:'16px'}}>
                      <div style={{width:'48px', height:'48px', background:stat.bg, borderRadius:'14px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'22px', flexShrink:0}}>
                        {stat.icon}
                      </div>
                      <div>
                        <div style={{fontWeight:'900', fontSize:'28px', color:stat.color, lineHeight:'1'}}>{stat.value}</div>
                        <div style={{fontSize:'12px', color:'rgba(255,255,255,0.5)', marginTop:'4px'}}>{stat.label}</div>
                      </div>
                    </div>
                  </Animate>
                ))}
              </div>

              <Animate delay={200}>
                <div style={{background:SURFACE, border:`1px solid ${BORDER}`, borderRadius:'16px', overflow:'hidden'}}>
                  <div style={{padding:'16px 20px', borderBottom:`1px solid ${BORDER}`, display:'flex', alignItems:'center', justifyContent:'space-between'}}>
                    <div style={{fontWeight:'700', fontSize:'15px'}}>Курстар</div>
                  </div>
                  {courses.map((c, i) => (
                    <div key={c.id} style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 20px', borderBottom: i < courses.length-1 ? `1px solid ${BORDER}` : 'none'}}>
                      <div>
                        <div style={{fontWeight:'600', fontSize:'14px'}}>{c.name}</div>
                        <div style={{fontSize:'12px', color:'rgba(255,255,255,0.4)', marginTop:'3px'}}>{c.description}</div>
                      </div>
                      <div style={{background:'rgba(37,99,235,0.2)', color:'#60A5FA', borderRadius:'8px', padding:'4px 12px', fontSize:'12px', fontWeight:'700'}}>{c.level}</div>
                    </div>
                  ))}
                </div>
              </Animate>
            </div>
          )}

          {/* CRM */}
          {activeTab === 'crm' && <CRMTab />}

          {/* ПРОГРАММА */}
          {activeTab === 'courses' && (
            <div>
              <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'12px', marginBottom:'20px'}}>
                {courses.map(c => (
                  <button key={c.id} onClick={() => fetchLessons(c.id)}
                    style={{padding:'16px', borderRadius:'12px', border:'none', cursor:'pointer', textAlign:'left', transition:'all 0.15s',
                      background: selectedCourse === c.id ? 'rgba(37,99,235,0.2)' : SURFACE,
                      borderLeft: selectedCourse === c.id ? `3px solid ${BLUE}` : `3px solid transparent`,
                      color:'#fff'}}>
                    <div style={{fontWeight:'700', fontSize:'14px'}}>{c.name}</div>
                    <div style={{fontSize:'11px', color:'rgba(255,255,255,0.4)', marginTop:'4px'}}>{c.month} · {c.level}</div>
                  </button>
                ))}
              </div>
              {lessons.length > 0 && (
                <Animate>
                  <div style={{background:SURFACE, border:`1px solid ${BORDER}`, borderRadius:'16px', overflow:'hidden'}}>
                    <table style={{width:'100%', fontSize:'13px', borderCollapse:'collapse'}}>
                      <thead>
                        <tr style={{borderBottom:`1px solid ${BORDER}`}}>
                          {['№','Тема','Математика','Кыргыз тили','Чтение','Тест'].map(h => (
                            <th key={h} style={{textAlign:'left', padding:'12px 16px', color:'rgba(255,255,255,0.4)', fontWeight:'600', fontSize:'12px'}}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {lessons.map((l, i) => (
                          <tr key={l.id} style={{borderBottom: i < lessons.length-1 ? `1px solid ${BORDER}` : 'none', background: i%2===0 ? 'transparent' : 'rgba(255,255,255,0.02)'}}>
                            <td style={{padding:'12px 16px', color:'rgba(255,255,255,0.4)', fontWeight:'700'}}>{l.lesson_number}</td>
                            <td style={{padding:'12px 16px', fontWeight:'600'}}>{l.title}</td>
                            <td style={{padding:'12px 16px', color:'#60A5FA', fontSize:'12px'}}>{l.math_topic}</td>
                            <td style={{padding:'12px 16px', color:'#C084FC', fontSize:'12px'}}>{l.kyr_topic}</td>
                            <td style={{padding:'12px 16px', color:'#34D399', fontSize:'12px'}}>{l.reading_topic}</td>
                            <td style={{padding:'12px 16px'}}>
                              {l.is_test && <span style={{background:'rgba(139,92,246,0.2)', color:'#A78BFA', borderRadius:'6px', padding:'3px 8px', fontSize:'11px', fontWeight:'700'}}>Тест</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Animate>
              )}
            </div>
          )}

          {/* ОКУУЧУЛАР */}
          {activeTab === 'students' && (
  <div>
    <AddUserForm role="student" onAdded={fetchData} />
    <Animate>
      <div style={{background:SURFACE, border:`1px solid ${BORDER}`, borderRadius:'16px', overflow:'hidden', marginTop:'20px'}}>
        <div style={{padding:'16px 20px', borderBottom:`1px solid ${BORDER}`}}>
          <div style={{fontWeight:'700', fontSize:'15px'}}>Окуучулар ({students.length})</div>
        </div>
        <table style={{width:'100%', fontSize:'13px', borderCollapse:'collapse'}}>
          <thead>
            <tr style={{borderBottom:`1px solid ${BORDER}`}}>
              {['Аты-жөнү','Телефон','Катталган күн'].map(h => (
                <th key={h} style={{textAlign:'left', padding:'12px 16px', color:'rgba(255,255,255,0.4)', fontWeight:'600', fontSize:'12px'}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {students.map((s, i) => (
              <tr key={s.id} style={{borderBottom: i < students.length-1 ? `1px solid ${BORDER}` : 'none'}}>
                <td style={{padding:'12px 16px'}}>
                  <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
                    <div style={{width:'32px', height:'32px', background:BLUE, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:'700', fontSize:'13px', flexShrink:0}}>
                      {s.full_name?.[0]}
                    </div>
                    <span style={{fontWeight:'600'}}>{s.full_name}</span>
                  </div>
                </td>
                <td style={{padding:'12px 16px', color:'rgba(255,255,255,0.5)'}}>{s.phone || '—'}</td>
                <td style={{padding:'12px 16px', color:'rgba(255,255,255,0.5)', fontSize:'12px'}}>{new Date(s.created_at).toLocaleDateString('ru')}</td>
              </tr>
            ))}
            {students.length === 0 && (
              <tr><td colSpan={3} style={{padding:'32px', textAlign:'center', color:'rgba(255,255,255,0.3)'}}>Окуучулар жок</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Animate>
  </div>
)}

          {/* МУГАЛИМДЕР */}
          {activeTab === 'teachers' && (
  <div>
    <AddUserForm role="teacher" onAdded={fetchData} />
    <Animate>
      <div style={{background:SURFACE, border:`1px solid ${BORDER}`, borderRadius:'16px', overflow:'hidden', marginTop:'20px'}}>
        <div style={{padding:'16px 20px', borderBottom:`1px solid ${BORDER}`}}>
          <div style={{fontWeight:'700', fontSize:'15px'}}>Мугалимдер ({teachers.length})</div>
        </div>
        <table style={{width:'100%', fontSize:'13px', borderCollapse:'collapse'}}>
          <thead>
            <tr style={{borderBottom:`1px solid ${BORDER}`}}>
              {['Аты-жөнү','Телефон','Катталган күн'].map(h => (
                <th key={h} style={{textAlign:'left', padding:'12px 16px', color:'rgba(255,255,255,0.4)', fontWeight:'600', fontSize:'12px'}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {teachers.map((t, i) => (
              <tr key={t.id} style={{borderBottom: i < teachers.length-1 ? `1px solid ${BORDER}` : 'none'}}>
                <td style={{padding:'12px 16px'}}>
                  <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
                    <div style={{width:'32px', height:'32px', background:'#8B5CF6', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:'700', fontSize:'13px', flexShrink:0}}>
                      {t.full_name?.[0]}
                    </div>
                    <span style={{fontWeight:'600'}}>{t.full_name}</span>
                  </div>
                </td>
                <td style={{padding:'12px 16px', color:'rgba(255,255,255,0.5)'}}>{t.phone || '—'}</td>
                <td style={{padding:'12px 16px', color:'rgba(255,255,255,0.5)', fontSize:'12px'}}>{new Date(t.created_at).toLocaleDateString('ru')}</td>
              </tr>
            ))}
            {teachers.length === 0 && (
              <tr><td colSpan={3} style={{padding:'32px', textAlign:'center', color:'rgba(255,255,255,0.3)'}}>Мугалимдер жок</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Animate>
  </div>
)}

          {/* ГРУППАЛАР */}
          {activeTab === 'groups' && (
            <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'16px'}}>
              {groups.map((g, i) => (
                <Animate key={g.id} delay={i * 80}>
                  <div style={{background:SURFACE, border:`1px solid ${BORDER}`, borderRadius:'16px', padding:'20px'}}>
                    <div style={{fontWeight:'700', fontSize:'15px', marginBottom:'12px'}}>{g.name}</div>
                    <div style={{display:'flex', flexDirection:'column', gap:'8px'}}>
                      <div style={{display:'flex', alignItems:'center', gap:'8px', fontSize:'13px', color:'rgba(255,255,255,0.6)'}}>
                        <span>📚</span><span>{g.courses?.name || '—'}</span>
                      </div>
                      <div style={{display:'flex', alignItems:'center', gap:'8px', fontSize:'13px', color:'rgba(255,255,255,0.6)'}}>
                        <span>👨‍🏫</span><span>{g.profiles?.full_name || '—'}</span>
                      </div>
                    </div>
                  </div>
                </Animate>
              ))}
              {groups.length === 0 && (
                <div style={{gridColumn:'span 3', textAlign:'center', color:'rgba(255,255,255,0.3)', padding:'48px'}}>Группалар жок</div>
              )}
            </div>
          )}

          {activeTab === 'finance' && (<FinanceTab students={students} />
)
}
{/* ТЕСТТЕР */}
          {activeTab === 'tests' && (
            <AdminTests />
          )}

          {/* НАТЫЙЖАЛАР */}
          {activeTab === 'results' && (
            <ResultsTab />
          )}

        </div>
      </div>
    </div>
  )
}

function CRMTab() {
  const [leads, setLeads] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [newLead, setNewLead] = useState({ full_name: '', phone: '', course: 'B1', stage: 'new' })
  const [saving, setSaving] = useState(false)

  const stages = [
    { id: 'new', label: 'Жаңы заявка', color: '#6B7280', bg: 'rgba(107,114,128,0.15)' },
    { id: 'call', label: 'Биринчи чалуу', color: '#3B82F6', bg: 'rgba(59,130,246,0.15)' },
    { id: 'consult', label: 'Консультация', color: '#8B5CF6', bg: 'rgba(139,92,246,0.15)' },
    { id: 'trial', label: 'Сынак сабак', color: '#F59E0B', bg: 'rgba(245,158,11,0.15)' },
    { id: 'payment', label: 'Оплата', color: '#EF4444', bg: 'rgba(239,68,68,0.15)' },
    { id: 'studying', label: 'Окуп жатат', color: '#10B981', bg: 'rgba(16,185,129,0.15)' },
    { id: 'graduate', label: 'Бүтүрүүчү', color: '#F0C040', bg: 'rgba(240,192,64,0.15)' },
  ]

  useEffect(() => { fetchLeads() }, [])

  const fetchLeads = async () => {
    const { data } = await supabase.from('crm_leads').select('*').order('created_at', { ascending: false })
    setLeads(data || [])
  }

  const createLead = async () => {
    if (!newLead.full_name || !newLead.phone) return
    setSaving(true)
    await supabase.from('crm_leads').insert(newLead)
    setNewLead({ full_name: '', phone: '', course: 'B1', stage: 'new' })
    setShowForm(false)
    fetchLeads()
    setSaving(false)
  }

  const updateStage = async (id: number, stage: string) => {
    await supabase.from('crm_leads').update({ stage }).eq('id', id)
    fetchLeads()
  }

  return (
    <div>
      <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'24px'}}>
        <div style={{fontWeight:'800', fontSize:'18px'}}>CRM — Воронка продаж</div>
        <button onClick={() => setShowForm(p => !p)}
          style={{background:BLUE, color:'#fff', border:'none', borderRadius:'10px', padding:'10px 20px', fontWeight:'700', fontSize:'13px', cursor:'pointer'}}>
          + Жаңы клиент
        </button>
      </div>

      {showForm && (
        <Animate>
          <div style={{background:SURFACE, border:`1px solid ${BORDER}`, borderRadius:'16px', padding:'20px', marginBottom:'20px', display:'grid', gridTemplateColumns:'1fr 1fr 1fr auto', gap:'12px', alignItems:'end'}}>
            <div>
              <div style={{fontSize:'12px', color:'rgba(255,255,255,0.4)', marginBottom:'6px'}}>Аты-жөнү</div>
              <input value={newLead.full_name} onChange={e => setNewLead(p => ({...p, full_name: e.target.value}))}
                placeholder="Иванов Айбек"
                style={{width:'100%', padding:'10px 12px', borderRadius:'8px', border:`1px solid ${BORDER}`, background:'rgba(255,255,255,0.05)', color:'#fff', fontSize:'13px', boxSizing:'border-box' as const}} />
            </div>
            <div>
              <div style={{fontSize:'12px', color:'rgba(255,255,255,0.4)', marginBottom:'6px'}}>Телефон</div>
              <input value={newLead.phone} onChange={e => setNewLead(p => ({...p, phone: e.target.value}))}
                placeholder="+996 700 000 000"
                style={{width:'100%', padding:'10px 12px', borderRadius:'8px', border:`1px solid ${BORDER}`, background:'rgba(255,255,255,0.05)', color:'#fff', fontSize:'13px', boxSizing:'border-box' as const}} />
            </div>
            <div>
              <div style={{fontSize:'12px', color:'rgba(255,255,255,0.4)', marginBottom:'6px'}}>Курс</div>
              <select value={newLead.course} onChange={e => setNewLead(p => ({...p, course: e.target.value}))}
                style={{width:'100%', padding:'10px 12px', borderRadius:'8px', border:`1px solid ${BORDER}`, background:'#0D1E4A', color:'#fff', fontSize:'13px', boxSizing:'border-box' as const}}>
                {['B1','B2','C1','Жайкы интенсив'].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <button onClick={createLead} disabled={saving}
              style={{background:BLUE, color:'#fff', border:'none', borderRadius:'8px', padding:'10px 20px', fontWeight:'700', fontSize:'13px', cursor:'pointer'}}>
              {saving ? '...' : 'Кошуу'}
            </button>
          </div>
        </Animate>
      )}

      {/* KANBAN */}
      <div style={{display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:'12px', overflowX:'auto'}}>
        {stages.map(stage => {
          const stageLeads = leads.filter(l => l.stage === stage.id)
          return (
            <div key={stage.id} style={{minWidth:'160px'}}>
              <div style={{background:stage.bg, border:`1px solid ${stage.color}44`, borderRadius:'10px', padding:'8px 12px', marginBottom:'10px', display:'flex', alignItems:'center', justifyContent:'space-between'}}>
                <div style={{fontSize:'12px', fontWeight:'700', color:stage.color}}>{stage.label}</div>
                <div style={{background:stage.color, color:'#fff', borderRadius:'50%', width:'20px', height:'20px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'11px', fontWeight:'800'}}>{stageLeads.length}</div>
              </div>
              <div style={{display:'flex', flexDirection:'column', gap:'8px'}}>
                {stageLeads.map(lead => (
                  <div key={lead.id} style={{background:SURFACE, border:`1px solid ${BORDER}`, borderRadius:'10px', padding:'12px'}}>
                    <div style={{fontWeight:'700', fontSize:'13px', marginBottom:'4px'}}>{lead.full_name}</div>
                    <div style={{fontSize:'11px', color:'rgba(255,255,255,0.5)', marginBottom:'8px'}}>{lead.phone}</div>
                    <div style={{fontSize:'11px', background:'rgba(37,99,235,0.15)', color:'#60A5FA', borderRadius:'6px', padding:'2px 8px', display:'inline-block', marginBottom:'8px'}}>{lead.course}</div>
                    <select value={lead.stage} onChange={e => updateStage(lead.id, e.target.value)}
                      style={{width:'100%', padding:'4px 8px', borderRadius:'6px', border:`1px solid ${BORDER}`, background:'#0D1E4A', color:'rgba(255,255,255,0.7)', fontSize:'11px'}}>
                      {stages.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ResultsTab() {
  const [results, setResults] = useState<any[]>([])
  useEffect(() => {
    supabase.from('test_results').select('*, profiles(full_name), lessons(title)').order('created_at', { ascending: false }).then(({ data }) => setResults(data || []))
  }, [])
  return (
    <div style={{background:SURFACE, border:`1px solid ${BORDER}`, borderRadius:'16px', overflow:'hidden'}}>
      <div style={{padding:'16px 20px', borderBottom:`1px solid ${BORDER}`}}>
        <div style={{fontWeight:'700', fontSize:'15px'}}>ЖРТ Натыйжалары</div>
      </div>
      <table style={{width:'100%', fontSize:'13px', borderCollapse:'collapse'}}>
        <thead>
          <tr style={{borderBottom:`1px solid ${BORDER}`}}>
            {['Окуучу','Сабак','Мат','Аналогия','Чтение','Грамматика','Жалпы'].map(h => (
              <th key={h} style={{textAlign:'left', padding:'12px 16px', color:'rgba(255,255,255,0.4)', fontWeight:'600', fontSize:'12px'}}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {results.map((r, i) => (
            <tr key={r.id} style={{borderBottom: i < results.length-1 ? `1px solid ${BORDER}` : 'none'}}>
              <td style={{padding:'12px 16px', fontWeight:'600'}}>{r.profiles?.full_name}</td>
              <td style={{padding:'12px 16px', color:'rgba(255,255,255,0.5)', fontSize:'12px'}}>{r.lessons?.title}</td>
              <td style={{padding:'12px 16px', color:'#60A5FA'}}>{r.math_score}</td>
              <td style={{padding:'12px 16px', color:'#C084FC'}}>{r.analogy_score}</td>
              <td style={{padding:'12px 16px', color:'#34D399'}}>{r.reading_score}</td>
              <td style={{padding:'12px 16px', color:'#FCD34D'}}>{r.grammar_score}</td>
              <td style={{padding:'12px 16px', fontWeight:'800', color:'#A78BFA'}}>{Number(r.total_score).toFixed(1)}</td>
            </tr>
          ))}
          {results.length === 0 && (
            <tr><td colSpan={7} style={{padding:'32px', textAlign:'center', color:'rgba(255,255,255,0.3)'}}>Натыйжалар жок</td></tr>
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

  useEffect(() => { fetchTests() }, [])

  const fetchTests = async () => {
    const { data } = await supabase.from('practice_tests').select('*').order('id')
    setTests(data || [])
  }

  const fetchQuestions = async (testId: number) => {
    const { data } = await supabase.from('questions').select('*').eq('practice_test_id', testId).order('order_num')
    setQuestions(data || [])
  }

  const selectTest = (t: any) => { setSelectedTest(t); fetchQuestions(t.id) }

  const createTest = async () => {
    if (!newTest.title) return
    setSaving(true)
    const { data } = await supabase.from('practice_tests').insert({ title: newTest.title, subject: newTest.subject, questions: [], lesson_id: 1 }).select().single()
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
      const { error } = await supabase.storage.from('questions').upload(path, file, { cacheControl: '3600', upsert: false })
      if (error) { alert('Жүктөө катасы: ' + error.message) }
      else {
        const { data: urlData } = supabase.storage.from('questions').getPublicUrl(path)
        setNewQ(p => ({ ...p, image_url: urlData.publicUrl }))
      }
    } catch (e) { console.error(e) }
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

  const subjects = [
    { value: 'math', label: 'Математика' },
    { value: 'kyr', label: 'Кыргыз тили' },
    { value: 'reading', label: 'Окуу жана түшүнүү' },
    { value: 'grammar', label: 'Грамматика' },
  ]

  return (
    <div style={{display:'grid', gridTemplateColumns:'240px 1fr', gap:'20px', alignItems:'start'}}>
      <div>
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'12px'}}>
          <div style={{fontWeight:'700', fontSize:'13px', color:'rgba(255,255,255,0.5)'}}>Тесттер</div>
          <button onClick={() => setShowForm(p => !p)} style={{background:BLUE, color:'#fff', border:'none', borderRadius:'8px', padding:'5px 12px', fontSize:'12px', fontWeight:'700', cursor:'pointer'}}>+ Жаңы</button>
        </div>
        {showForm && (
          <div style={{background:SURFACE, border:`1px solid ${BORDER}`, borderRadius:'12px', padding:'14px', marginBottom:'12px'}}>
            <input value={newTest.title} onChange={e => setNewTest(p => ({...p, title: e.target.value}))} placeholder="Тест аталышы"
              style={{width:'100%', padding:'8px 10px', borderRadius:'8px', border:`1px solid ${BORDER}`, background:'rgba(255,255,255,0.05)', color:'#fff', fontSize:'13px', marginBottom:'8px', boxSizing:'border-box' as const}} />
            <select value={newTest.subject} onChange={e => setNewTest(p => ({...p, subject: e.target.value}))}
              style={{width:'100%', padding:'8px 10px', borderRadius:'8px', border:`1px solid ${BORDER}`, background:'#0D1E4A', color:'#fff', fontSize:'13px', marginBottom:'10px', boxSizing:'border-box' as const}}>
              {subjects.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <button onClick={createTest} disabled={saving} style={{width:'100%', background:BLUE, color:'#fff', border:'none', borderRadius:'8px', padding:'8px', fontSize:'13px', fontWeight:'700', cursor:'pointer'}}>
              {saving ? '...' : 'Түзүү'}
            </button>
          </div>
        )}
        <div style={{display:'flex', flexDirection:'column', gap:'4px'}}>
          {tests.map(t => (
            <button key={t.id} onClick={() => selectTest(t)}
              style={{textAlign:'left', padding:'10px 12px', borderRadius:'10px', border:'none', cursor:'pointer',
                background: selectedTest?.id === t.id ? 'rgba(37,99,235,0.2)' : SURFACE,
                borderLeft: selectedTest?.id === t.id ? `3px solid ${BLUE}` : `3px solid transparent`,
                color:'#fff'}}>
              <div style={{fontWeight:'600', fontSize:'13px'}}>{t.title}</div>
              <div style={{fontSize:'11px', color:'rgba(255,255,255,0.4)', marginTop:'2px'}}>{subjects.find(s => s.value === t.subject)?.label}</div>
            </button>
          ))}
        </div>
      </div>

      {selectedTest ? (
        <div>
          <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'16px'}}>
            <div>
              <h3 style={{fontWeight:'800', fontSize:'17px'}}>{selectedTest.title}</h3>
              <div style={{color:'rgba(255,255,255,0.4)', fontSize:'12px', marginTop:'3px'}}>{questions.length} суроо</div>
            </div>
            <a href={`/student/test?id=${selectedTest.id}`} target="_blank" rel="noopener noreferrer"
              style={{background:'rgba(37,99,235,0.15)', color:'#60A5FA', borderRadius:'8px', padding:'7px 14px', fontSize:'12px', fontWeight:'700', textDecoration:'none'}}>
              👁 Көрүү
            </a>
          </div>

          <div style={{background:SURFACE, border:`1px solid ${BORDER}`, borderRadius:'14px', padding:'18px', marginBottom:'16px'}}>
            <div style={{fontWeight:'700', fontSize:'13px', marginBottom:'14px'}}>Жаңы суроо</div>
            <div style={{display:'flex', gap:'8px', marginBottom:'14px'}}>
              {(['text', 'image'] as const).map(type => (
                <button key={type} onClick={() => setQType(type)}
                  style={{padding:'6px 14px', borderRadius:'8px', border:'none', cursor:'pointer', fontSize:'12px', fontWeight:'600',
                    background: qType === type ? BLUE : 'rgba(255,255,255,0.05)',
                    color: qType === type ? '#fff' : 'rgba(255,255,255,0.5)'}}>
                  {type === 'text' ? '📝 Текст' : '🖼 Сүрөт'}
                </button>
              ))}
            </div>
            {qType === 'text' ? (
              <textarea value={newQ.question_text} onChange={e => setNewQ(p => ({...p, question_text: e.target.value}))}
                placeholder="Суроону жазыңыз..." rows={3}
                style={{width:'100%', padding:'10px', borderRadius:'8px', border:`1px solid ${BORDER}`, background:'rgba(255,255,255,0.05)', color:'#fff', fontSize:'13px', marginBottom:'12px', resize:'none', boxSizing:'border-box' as const}} />
            ) : (
              <div style={{marginBottom:'12px'}}>
                <input type="file" accept="image/*" onChange={e => e.target.files?.[0] && uploadImage(e.target.files[0])} style={{display:'none'}} id="img-upload" />
                <label htmlFor="img-upload" style={{display:'block', border:`2px dashed ${BORDER}`, borderRadius:'10px', padding:'20px', textAlign:'center', cursor:'pointer'}}>
                  {uploading ? <div style={{color:'rgba(255,255,255,0.5)', fontSize:'13px'}}>Жүктөлүүдө...</div>
                    : newQ.image_url ? <img src={newQ.image_url} alt="preview" style={{maxHeight:'100px', borderRadius:'8px'}} />
                    : <div style={{color:'rgba(255,255,255,0.4)', fontSize:'13px'}}>🖼 Сүрөт жүктөө</div>}
                </label>
              </div>
            )}
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', marginBottom:'10px'}}>
              {(['A','B','C','D'] as const).map(opt => (
                <div key={opt} style={{display:'flex', gap:'6px', alignItems:'center'}}>
                  <div style={{width:'22px', height:'22px', borderRadius:'6px', background: newQ.correct_answer === opt ? BLUE : 'rgba(255,255,255,0.05)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'10px', fontWeight:'800', color: newQ.correct_answer === opt ? '#fff' : 'rgba(255,255,255,0.4)', cursor:'pointer', flexShrink:0}}
                    onClick={() => setNewQ(p => ({...p, correct_answer: opt}))}>
                    {opt}
                  </div>
                  <input value={(newQ as any)[`option_${opt.toLowerCase()}`]} onChange={e => setNewQ(p => ({...p, [`option_${opt.toLowerCase()}`]: e.target.value}))}
                    placeholder={`${opt} варианты`}
                    style={{flex:1, padding:'6px 8px', borderRadius:'6px', border:`1px solid ${newQ.correct_answer === opt ? BLUE : BORDER}`, background:'rgba(255,255,255,0.05)', color:'#fff', fontSize:'12px'}} />
                </div>
              ))}
            </div>
            <div style={{fontSize:'11px', color:'rgba(255,255,255,0.4)', marginBottom:'10px'}}>
              💡 Туура жооп: <strong style={{color:'#60A5FA'}}>{newQ.correct_answer}</strong> — тамгасын басыңыз
            </div>
            <button onClick={addQuestion} disabled={saving || uploading}
              style={{background:BLUE, color:'#fff', border:'none', borderRadius:'8px', padding:'10px 20px', fontSize:'13px', fontWeight:'700', cursor:'pointer', opacity: saving ? 0.7 : 1}}>
              {saving ? '...' : '+ Суроо кошуу'}
            </button>
          </div>

          <div style={{display:'flex', flexDirection:'column', gap:'8px'}}>
            {questions.map((q, i) => (
              <div key={q.id} style={{background:SURFACE, border:`1px solid ${BORDER}`, borderRadius:'12px', padding:'14px', display:'flex', gap:'12px', alignItems:'flex-start'}}>
                <div style={{width:'26px', height:'26px', background:BLUE, borderRadius:'7px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'11px', fontWeight:'800', flexShrink:0}}>{i+1}</div>
                <div style={{flex:1}}>
                  {q.image_url ? <img src={q.image_url} alt="q" style={{maxHeight:'70px', borderRadius:'8px', marginBottom:'8px'}} />
                    : <div style={{fontSize:'13px', fontWeight:'600', marginBottom:'8px'}}>{q.question_text}</div>}
                  <div style={{display:'flex', gap:'6px', flexWrap:'wrap'}}>
                    {['A','B','C','D'].map(opt => (
                      <span key={opt} style={{fontSize:'11px', padding:'3px 8px', borderRadius:'6px',
                        background: q.correct_answer === opt ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.04)',
                        color: q.correct_answer === opt ? '#34D399' : 'rgba(255,255,255,0.4)',
                        fontWeight: q.correct_answer === opt ? '700' : '400'}}>
                        {opt}: {q[`option_${opt.toLowerCase()}`]}
                      </span>
                    ))}
                  </div>
                </div>
                <button onClick={() => deleteQuestion(q.id)} style={{background:'rgba(239,68,68,0.1)', color:'#FCA5A5', border:'none', borderRadius:'7px', padding:'5px 8px', cursor:'pointer', fontSize:'12px', flexShrink:0}}>🗑</button>
              </div>
            ))}
            {questions.length === 0 && <div style={{textAlign:'center', color:'rgba(255,255,255,0.3)', fontSize:'13px', padding:'24px'}}>Суроолор жок</div>}
          </div>
        </div>
      ) : (
        <div style={{textAlign:'center', color:'rgba(255,255,255,0.3)', fontSize:'14px', padding:'60px'}}>← Тест тандаңыз</div>
      )}
    </div>
  )


}
function AddUserForm({ role, onAdded }: { role: string, onAdded: () => void }) {
  const [show, setShow] = useState(false)
  const [form, setForm] = useState({ full_name: '', email: '', password: '', phone: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleSubmit = async () => {
    if (!form.full_name || !form.email || !form.password) { setError('Бардык талааларды толтуруңуз'); return }
    setSaving(true); setError(''); setSuccess('')
    try {
      const res = await fetch('/api/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, role }),
      })
      const data = await res.json()
      if (data.error) { setError(data.error) }
      else { setSuccess(role === 'student' ? 'Окуучу кошулду!' : 'Мугалим кошулду!'); setForm({ full_name: '', email: '', password: '', phone: '' }); setShow(false); onAdded() }
    } catch (e) { setError('Ката кетти') }
    setSaving(false)
  }

  return (
    <div>
      <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'16px'}}>
        <div style={{fontWeight:'800', fontSize:'18px'}}>{role === 'student' ? 'Окуучулар' : 'Мугалимдер'}</div>
        <button onClick={() => { setShow(p => !p); setError(''); setSuccess('') }}
          style={{background:BLUE, color:'#fff', border:'none', borderRadius:'10px', padding:'10px 20px', fontWeight:'700', fontSize:'13px', cursor:'pointer'}}>
          + {role === 'student' ? 'Окуучу кошуу' : 'Мугалим кошуу'}
        </button>
      </div>
      {success && (
        <div style={{background:'rgba(16,185,129,0.15)', border:'1px solid rgba(16,185,129,0.3)', borderRadius:'10px', padding:'12px 16px', marginBottom:'16px', color:'#34D399', fontSize:'14px'}}>
          ✅ {success}
        </div>
      )}
      {show && (
        <Animate>
          <div style={{background:SURFACE, border:`1px solid ${BORDER}`, borderRadius:'16px', padding:'20px', marginBottom:'16px'}}>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'12px'}}>
              <div>
                <div style={{fontSize:'12px', color:'rgba(255,255,255,0.4)', marginBottom:'6px'}}>Аты-жөнү *</div>
                <input value={form.full_name} onChange={e => setForm(p => ({...p, full_name: e.target.value}))}
                  placeholder="Иванов Айбек"
                  style={{width:'100%', padding:'10px 12px', borderRadius:'8px', border:`1px solid ${BORDER}`, background:'rgba(255,255,255,0.05)', color:'#fff', fontSize:'13px', boxSizing:'border-box' as const}} />
              </div>
              <div>
                <div style={{fontSize:'12px', color:'rgba(255,255,255,0.4)', marginBottom:'6px'}}>Телефон</div>
                <input value={form.phone} onChange={e => setForm(p => ({...p, phone: e.target.value}))}
                  placeholder="+996 700 000 000"
                  style={{width:'100%', padding:'10px 12px', borderRadius:'8px', border:`1px solid ${BORDER}`, background:'rgba(255,255,255,0.05)', color:'#fff', fontSize:'13px', boxSizing:'border-box' as const}} />
              </div>
              <div>
                <div style={{fontSize:'12px', color:'rgba(255,255,255,0.4)', marginBottom:'6px'}}>Email *</div>
                <input value={form.email} onChange={e => setForm(p => ({...p, email: e.target.value}))}
                  placeholder="student@gmail.com" type="email"
                  style={{width:'100%', padding:'10px 12px', borderRadius:'8px', border:`1px solid ${BORDER}`, background:'rgba(255,255,255,0.05)', color:'#fff', fontSize:'13px', boxSizing:'border-box' as const}} />
              </div>
              <div>
                <div style={{fontSize:'12px', color:'rgba(255,255,255,0.4)', marginBottom:'6px'}}>Сырсөз *</div>
                <input value={form.password} onChange={e => setForm(p => ({...p, password: e.target.value}))}
                  placeholder="Жок дегенде 6 символ" type="password"
                  style={{width:'100%', padding:'10px 12px', borderRadius:'8px', border:`1px solid ${BORDER}`, background:'rgba(255,255,255,0.05)', color:'#fff', fontSize:'13px', boxSizing:'border-box' as const}} />
              </div>
            </div>
            {error && (
              <div style={{background:'rgba(239,68,68,0.15)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:'8px', padding:'10px 14px', marginBottom:'12px', color:'#FCA5A5', fontSize:'13px'}}>
                ❌ {error}
              </div>
            )}
            <div style={{display:'flex', gap:'10px'}}>
              <button onClick={handleSubmit} disabled={saving}
                style={{background:BLUE, color:'#fff', border:'none', borderRadius:'10px', padding:'10px 24px', fontWeight:'700', fontSize:'14px', cursor:'pointer', opacity: saving ? 0.7 : 1}}>
                {saving ? 'Кошулууда...' : '+ Кошуу'}
              </button>
              <button onClick={() => setShow(false)}
                style={{background:'rgba(255,255,255,0.05)', color:'rgba(255,255,255,0.5)', border:`1px solid ${BORDER}`, borderRadius:'10px', padding:'10px 20px', fontWeight:'600', fontSize:'14px', cursor:'pointer'}}>
                Жокко чыгаруу
              </button>
            </div>
          </div>
        </Animate>
      )}
    </div>
    )
   }
  function FinanceTab({ students }: { students: any[] }) {
  const [payments, setPayments] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [newPayment, setNewPayment] = useState({ student_id: '', amount: '', month: new Date().toISOString().slice(0,7), status: 'paid', note: '' })
  const [saving, setSaving] = useState(false)
  const [filterMonth, setFilterMonth] = useState(new Date().toISOString().slice(0,7))

  useEffect(() => { fetchPayments() }, [])

  const fetchPayments = async () => {
    const { data } = await supabase.from('payments').select('*, profiles(full_name)').order('created_at', { ascending: false })
    setPayments(data || [])
  }

  const addPayment = async () => {
    if (!newPayment.student_id || !newPayment.amount) return
    setSaving(true)
    await supabase.from('payments').insert({
      student_id: newPayment.student_id,
      amount: Number(newPayment.amount),
      month: newPayment.month,
      status: newPayment.status,
      note: newPayment.note,
    })
    setNewPayment({ student_id: '', amount: '', month: new Date().toISOString().slice(0,7), status: 'paid', note: '' })
    setShowForm(false)
    fetchPayments()
    setSaving(false)
  }

  const deletePayment = async (id: number) => {
    await supabase.from('payments').delete().eq('id', id)
    fetchPayments()
  }

  const filtered = filterMonth ? payments.filter(p => p.month === filterMonth) : payments
  const totalIncome = filtered.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0)
  const totalDebt = filtered.filter(p => p.status === 'debt').reduce((sum, p) => sum + p.amount, 0)

  // Кто не оплатил в этом месяце
  const paidStudentIds = filtered.filter(p => p.status === 'paid').map(p => p.student_id)
  const debtors = students.filter(s => !paidStudentIds.includes(s.id))

  const months = []
  for (let i = 0; i < 6; i++) {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    months.push(d.toISOString().slice(0,7))
  }

  return (
    <div>
      {/* STATS */}
      <div style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'16px', marginBottom:'24px'}}>
        {[
          {label:'Айлык киреше', value: totalIncome.toLocaleString() + ' сом', icon:'💰', color:'#34D399', bg:'rgba(52,211,153,0.1)'},
          {label:'Карыз', value: totalDebt.toLocaleString() + ' сом', icon:'⚠️', color:'#FCA5A5', bg:'rgba(239,68,68,0.1)'},
          {label:'Төлөгөндөр', value: filtered.filter(p=>p.status==='paid').length + ' окуучу', icon:'✅', color:'#60A5FA', bg:'rgba(96,165,250,0.1)'},
          {label:'Карыздуулар', value: debtors.length + ' окуучу', icon:'❌', color:'#FCD34D', bg:'rgba(252,211,77,0.1)'},
        ].map((s,i) => (
          <Animate key={i} delay={i*80}>
            <div style={{background:SURFACE, border:`1px solid ${BORDER}`, borderRadius:'16px', padding:'20px'}}>
              <div style={{width:'40px', height:'40px', background:s.bg, borderRadius:'10px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'18px', marginBottom:'12px'}}>{s.icon}</div>
              <div style={{fontWeight:'900', fontSize:'22px', color:s.color, marginBottom:'4px'}}>{s.value}</div>
              <div style={{fontSize:'12px', color:'rgba(255,255,255,0.5)'}}>{s.label}</div>
            </div>
          </Animate>
        ))}
      </div>

      {/* TOOLBAR */}
      <div style={{display:'flex', alignItems:'center', gap:'12px', marginBottom:'20px', flexWrap:'wrap'}}>
        <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)}
          style={{padding:'10px 14px', borderRadius:'10px', border:`1px solid ${BORDER}`, background:SURFACE, color:'#fff', fontSize:'13px'}}>
          {months.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <button onClick={() => setShowForm(p => !p)}
          style={{background:BLUE, color:'#fff', border:'none', borderRadius:'10px', padding:'10px 20px', fontWeight:'700', fontSize:'14px', cursor:'pointer'}}>
          + Оплата кошуу
        </button>
      </div>

      {/* ADD FORM */}
      {showForm && (
        <Animate>
          <div style={{background:SURFACE, border:`1px solid ${BORDER}`, borderRadius:'16px', padding:'20px', marginBottom:'20px'}}>
            <div style={{fontWeight:'700', fontSize:'15px', marginBottom:'16px'}}>Жаңы оплата</div>
            <div style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'12px', marginBottom:'12px'}}>
              <div>
                <div style={{fontSize:'12px', color:'rgba(255,255,255,0.4)', marginBottom:'6px'}}>Окуучу *</div>
                <select value={newPayment.student_id} onChange={e => setNewPayment(p => ({...p, student_id: e.target.value}))}
                  style={{width:'100%', padding:'10px 12px', borderRadius:'8px', border:`1px solid ${BORDER}`, background:DARK, color:'#fff', fontSize:'13px', boxSizing:'border-box' as const}}>
                  <option value="">Тандаңыз</option>
                  {students.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                </select>
              </div>
              <div>
                <div style={{fontSize:'12px', color:'rgba(255,255,255,0.4)', marginBottom:'6px'}}>Сумма (сом) *</div>
                <input value={newPayment.amount} onChange={e => setNewPayment(p => ({...p, amount: e.target.value}))}
                  placeholder="5000" type="number"
                  style={{width:'100%', padding:'10px 12px', borderRadius:'8px', border:`1px solid ${BORDER}`, background:'rgba(255,255,255,0.05)', color:'#fff', fontSize:'13px', boxSizing:'border-box' as const}} />
              </div>
              <div>
                <div style={{fontSize:'12px', color:'rgba(255,255,255,0.4)', marginBottom:'6px'}}>Ай</div>
                <input value={newPayment.month} onChange={e => setNewPayment(p => ({...p, month: e.target.value}))}
                  type="month"
                  style={{width:'100%', padding:'10px 12px', borderRadius:'8px', border:`1px solid ${BORDER}`, background:'rgba(255,255,255,0.05)', color:'#fff', fontSize:'13px', boxSizing:'border-box' as const}} />
              </div>
              <div>
                <div style={{fontSize:'12px', color:'rgba(255,255,255,0.4)', marginBottom:'6px'}}>Статус</div>
                <select value={newPayment.status} onChange={e => setNewPayment(p => ({...p, status: e.target.value}))}
                  style={{width:'100%', padding:'10px 12px', borderRadius:'8px', border:`1px solid ${BORDER}`, background:DARK, color:'#fff', fontSize:'13px', boxSizing:'border-box' as const}}>
                  <option value="paid">✅ Төлөдү</option>
                  <option value="debt">⚠️ Карыз</option>
                  <option value="partial">🔶 Жарым-жартылай</option>
                </select>
              </div>
            </div>
            <div style={{marginBottom:'12px'}}>
              <div style={{fontSize:'12px', color:'rgba(255,255,255,0.4)', marginBottom:'6px'}}>Эскертүү</div>
              <input value={newPayment.note} onChange={e => setNewPayment(p => ({...p, note: e.target.value}))}
                placeholder="Кошумча маалымат..."
                style={{width:'100%', padding:'10px 12px', borderRadius:'8px', border:`1px solid ${BORDER}`, background:'rgba(255,255,255,0.05)', color:'#fff', fontSize:'13px', boxSizing:'border-box' as const}} />
            </div>
            <div style={{display:'flex', gap:'10px'}}>
              <button onClick={addPayment} disabled={saving}
                style={{background:BLUE, color:'#fff', border:'none', borderRadius:'10px', padding:'10px 24px', fontWeight:'700', fontSize:'14px', cursor:'pointer'}}>
                {saving ? '...' : '+ Кошуу'}
              </button>
              <button onClick={() => setShowForm(false)}
                style={{background:'rgba(255,255,255,0.05)', color:'rgba(255,255,255,0.5)', border:`1px solid ${BORDER}`, borderRadius:'10px', padding:'10px 20px', fontWeight:'600', fontSize:'14px', cursor:'pointer'}}>
                Жокко чыгаруу
              </button>
            </div>
          </div>
        </Animate>
      )}

      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px'}}>
        {/* PAYMENTS TABLE */}
        <Animate>
          <div style={{background:SURFACE, border:`1px solid ${BORDER}`, borderRadius:'16px', overflow:'hidden'}}>
            <div style={{padding:'16px 20px', borderBottom:`1px solid ${BORDER}`}}>
              <div style={{fontWeight:'700', fontSize:'14px'}}>💳 Оплаталар — {filterMonth}</div>
            </div>
            <table style={{width:'100%', fontSize:'13px', borderCollapse:'collapse'}}>
              <thead>
                <tr style={{borderBottom:`1px solid ${BORDER}`}}>
                  {['Окуучу','Сумма','Статус',''].map(h => (
                    <th key={h} style={{textAlign:'left', padding:'10px 16px', color:'rgba(255,255,255,0.4)', fontWeight:'600', fontSize:'11px'}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, i) => (
                  <tr key={p.id} style={{borderBottom: i < filtered.length-1 ? `1px solid ${BORDER}` : 'none'}}>
                    <td style={{padding:'10px 16px', fontWeight:'600'}}>{p.profiles?.full_name}</td>
                    <td style={{padding:'10px 16px', fontWeight:'700', color:'#34D399'}}>{p.amount.toLocaleString()} сом</td>
                    <td style={{padding:'10px 16px'}}>
                      <span style={{
                        background: p.status === 'paid' ? 'rgba(52,211,153,0.15)' : p.status === 'debt' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                        color: p.status === 'paid' ? '#34D399' : p.status === 'debt' ? '#FCA5A5' : '#FCD34D',
                        borderRadius:'6px', padding:'3px 8px', fontSize:'11px', fontWeight:'600'
                      }}>
                        {p.status === 'paid' ? '✅ Төлөдү' : p.status === 'debt' ? '⚠️ Карыз' : '🔶 Жарым'}
                      </span>
                    </td>
                    <td style={{padding:'10px 16px'}}>
                      <button onClick={() => deletePayment(p.id)}
                        style={{background:'rgba(239,68,68,0.1)', color:'#FCA5A5', border:'none', borderRadius:'6px', padding:'4px 8px', cursor:'pointer', fontSize:'11px'}}>
                        🗑
                      </button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={4} style={{padding:'24px', textAlign:'center', color:'rgba(255,255,255,0.3)'}}>Оплаталар жок</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Animate>

        {/* DEBTORS */}
        <Animate delay={100}>
          <div style={{background:SURFACE, border:`1px solid ${BORDER}`, borderRadius:'16px', overflow:'hidden'}}>
            <div style={{padding:'16px 20px', borderBottom:`1px solid ${BORDER}`}}>
              <div style={{fontWeight:'700', fontSize:'14px'}}>⚠️ Төлөбөгөндөр — {filterMonth}</div>
            </div>
            <div style={{padding:'8px'}}>
              {debtors.length === 0 ? (
                <div style={{padding:'24px', textAlign:'center', color:'rgba(255,255,255,0.3)', fontSize:'13px'}}>
                  ✅ Баары төлөдү!
                </div>
              ) : debtors.map((s, i) => (
                <div key={s.id} style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 12px', borderRadius:'10px', marginBottom:'4px', background:'rgba(239,68,68,0.05)', border:'1px solid rgba(239,68,68,0.1)'}}>
                  <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
                    <div style={{width:'32px', height:'32px', background:'rgba(239,68,68,0.2)', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:'700', fontSize:'13px', color:'#FCA5A5'}}>
                      {s.full_name?.[0]}
                    </div>
                    <div>
                      <div style={{fontWeight:'600', fontSize:'13px'}}>{s.full_name}</div>
                      <div style={{fontSize:'11px', color:'rgba(255,255,255,0.4)'}}>{s.phone || '—'}</div>
                    </div>
                  </div>
                  <button onClick={() => {
                    setNewPayment(p => ({...p, student_id: s.id, status: 'debt'}))
                    setShowForm(true)
                  }}
                    style={{background:'rgba(239,68,68,0.15)', color:'#FCA5A5', border:'none', borderRadius:'8px', padding:'5px 10px', fontSize:'11px', fontWeight:'600', cursor:'pointer'}}>
                    Карыз кошуу
                  </button>
                </div>
              ))}
            </div>
          </div>
        </Animate>
      </div>
    </div>
  )
}


