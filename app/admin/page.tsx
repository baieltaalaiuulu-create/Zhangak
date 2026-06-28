'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [v, setV] = useState(false)
  useEffect(() => {
    const o = new IntersectionObserver(([e]) => { if (e.isIntersecting) setV(true) }, { threshold: 0.05 })
    if (ref.current) o.observe(ref.current)
    return () => o.disconnect()
  }, [])
  return (
    <div ref={ref} style={{ opacity: v ? 1 : 0, transform: v ? 'none' : 'translateY(16px)', transition: `opacity 0.4s ease ${delay}ms, transform 0.4s ease ${delay}ms` }}>
      {children}
    </div>
  )
}

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  blue:    '#1B4FD8',
  blueSoft:'#EEF2FF',
  blueBorder:'#C7D2FE',
  green:   '#10B981',
  red:     '#EF4444',
  yellow:  '#F59E0B',
  purple:  '#8B5CF6',
  bg:      '#F8FAFF',
  white:   '#FFFFFF',
  border:  '#E2E8F0',
  text:    '#0D1E4A',
  muted:   '#64748B',
  light:   '#94A3B8',
}

const TAB_COLORS: Record<string, string> = {
  dashboard: C.blue, crm: '#EC4899', finance: C.green,
  courses: C.purple, groups: C.yellow, students: C.blue,
  teachers: '#0EA5E9', tests: C.purple, results: C.green,
}

type Tab = 'dashboard'|'crm'|'finance'|'courses'|'groups'|'students'|'teachers'|'tests'|'results'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Дашборд',     icon: '📊' },
  { id: 'crm',       label: 'CRM',         icon: '🎯' },
  { id: 'finance',   label: 'Финансы',     icon: '💰' },
  { id: 'courses',   label: 'Программа',   icon: '📚' },
  { id: 'groups',    label: 'Группалар',   icon: '👥' },
  { id: 'students',  label: 'Окуучулар',   icon: '🎓' },
  { id: 'teachers',  label: 'Мугалимдер', icon: '👨‍🏫' },
  { id: 'tests',     label: 'Тесттер',     icon: '📝' },
  { id: 'results',   label: 'Натыйжалар',  icon: '📈' },
]

function Avatar({ name, size = 32, color = C.blue }: { name: string; size?: number; color?: string }) {
  const colors = [C.blue, C.purple, '#EC4899', C.yellow, C.green, C.red, '#0EA5E9']
  const bg = colors[name.charCodeAt(0) % colors.length]
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.38, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
      {name.slice(0,1).toUpperCase()}
    </div>
  )
}

// ─── Shared input style ───────────────────────────────────────────────────────
const inp: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontSize: 13, outline: 'none', boxSizing: 'border-box' }
const sel: React.CSSProperties = { ...inp, cursor: 'pointer' }

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('dashboard')
  const [courses, setCourses]   = useState<any[]>([])
  const [lessons, setLessons]   = useState<any[]>([])
  const [groups, setGroups]     = useState<any[]>([])
  const [students, setStudents] = useState<any[]>([])
  const [teachers, setTeachers] = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [selectedCourse, setSelectedCourse] = useState<number|null>(null)
  const router = useRouter()

  useEffect(() => { checkAuth() }, [])

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }
    const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (!prof || prof.role !== 'admin') { await supabase.auth.signOut(); router.push('/'); return }
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

  const accentColor = TAB_COLORS[tab] || C.blue

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bg, fontFamily: 'Inter, sans-serif' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 40, height: 40, border: `3px solid ${C.border}`, borderTopColor: C.blue, borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <div style={{ color: C.light, fontSize: 14 }}>Жүктөлүүдө...</div>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: 'Inter, -apple-system, sans-serif', color: C.text, display: 'flex' }}>

      {/* ── SIDEBAR ── */}
      <aside style={{ width: 220, background: C.white, borderRight: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, left: 0, height: '100vh', zIndex: 100 }}>
        {/* Logo */}
        <div style={{ padding: '20px 16px 16px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, background: C.blue, borderRadius: 9, overflow: 'hidden', flexShrink: 0 }}>
              <img src="/images/logo.png" alt="Z" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <div>
              <div style={{ fontWeight: 900, fontSize: 16, color: C.text }}>Zhangak</div>
              <div style={{ fontSize: 10, color: C.light, marginTop: 1 }}>Админ панели</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ padding: '10px 10px', flex: 1, overflowY: 'auto' }}>
          {TABS.map(t => {
            const active = tab === t.id
            const color = TAB_COLORS[t.id]
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 10, border: 'none', cursor: 'pointer', marginBottom: 2, textAlign: 'left', transition: 'all 0.15s', background: active ? `${color}14` : 'transparent', color: active ? color : C.muted, fontWeight: active ? 700 : 500, fontSize: 13 }}>
                <span style={{ fontSize: 16 }}>{t.icon}</span>
                <span>{t.label}</span>
                {active && <div style={{ marginLeft: 'auto', width: 5, height: 5, borderRadius: '50%', background: color }} />}
              </button>
            )
          })}
        </nav>

        {/* Footer */}
        <div style={{ padding: '10px', borderTop: `1px solid ${C.border}` }}>
          <button onClick={handleLogout} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 10, border: 'none', cursor: 'pointer', background: '#FEF2F2', color: C.red, fontSize: 13, fontWeight: 600 }}>
            🚪 Чыгуу
          </button>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <main style={{ marginLeft: 220, flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Topbar */}
        <header style={{ background: C.white, borderBottom: `1px solid ${C.border}`, padding: '0 28px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: accentColor }} />
            <span style={{ fontWeight: 800, fontSize: 17, color: C.text }}>{TABS.find(t => t.id === tab)?.icon} {TABS.find(t => t.id === tab)?.label}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ background: C.blueSoft, borderRadius: 8, padding: '4px 12px', fontSize: 12, color: C.blue, fontWeight: 600 }}>👤 Администратор</div>
            </div>
          </div>
        </header>

        {/* Content */}
        <div style={{ padding: '28px 28px', flex: 1 }}>

          {/* ── DASHBOARD ── */}
          {tab === 'dashboard' && (
            <div>
              <div style={{ marginBottom: 24 }}>
                <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>Башкы бет 👋</h1>
                <p style={{ color: C.light, fontSize: 13, margin: '4px 0 0' }}>Платформанын жалпы статистикасы</p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 28 }}>
                {[
                  { label: 'Курстар',     value: courses.length,  icon: '📚', color: C.blue,   bg: C.blueSoft },
                  { label: 'Группалар',   value: groups.length,   icon: '👥', color: C.purple,  bg: '#F5F3FF' },
                  { label: 'Окуучулар',   value: students.length, icon: '🎓', color: C.green,   bg: '#F0FDF4' },
                  { label: 'Мугалимдер', value: teachers.length, icon: '👨‍🏫', color: C.yellow,  bg: '#FFFBEB' },
                ].map((s, i) => (
                  <Reveal key={s.label} delay={i * 70}>
                    <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 18, padding: 20, cursor: 'pointer', transition: 'all 0.2s' }}
                      onClick={() => setTab(['courses','groups','students','teachers'][i] as Tab)}>
                      <div style={{ width: 44, height: 44, background: s.bg, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, marginBottom: 14 }}>{s.icon}</div>
                      <div style={{ fontWeight: 900, fontSize: 32, color: s.color, letterSpacing: '-1px', marginBottom: 4 }}>{s.value}</div>
                      <div style={{ fontSize: 13, color: C.muted }}>{s.label}</div>
                    </div>
                  </Reveal>
                ))}
              </div>

              <Reveal delay={200}>
                <div style={{ background: C.white, borderRadius: 18, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
                  <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}`, fontWeight: 700, fontSize: 14 }}>📚 Курстар</div>
                  {courses.map((c, i) => (
                    <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: i < courses.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{c.name}</div>
                        <div style={{ fontSize: 12, color: C.light, marginTop: 2 }}>{c.description}</div>
                      </div>
                      <span style={{ background: C.blueSoft, color: C.blue, borderRadius: 8, padding: '3px 12px', fontSize: 12, fontWeight: 700 }}>{c.level}</span>
                    </div>
                  ))}
                  {courses.length === 0 && <div style={{ padding: 32, textAlign: 'center', color: C.light }}>Курстар жок</div>}
                </div>
              </Reveal>
            </div>
          )}

          {/* ── CRM ── */}
          {tab === 'crm' && <CRMTab />}

          {/* ── FINANCE ── */}
          {tab === 'finance' && <FinanceTab students={students} />}

          {/* ── COURSES ── */}
          {tab === 'courses' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
                {courses.map(c => (
                  <button key={c.id} onClick={() => fetchLessons(c.id)}
                    style={{ padding: 16, borderRadius: 14, border: `${selectedCourse === c.id ? 2 : 1}px solid ${selectedCourse === c.id ? C.blue : C.border}`, cursor: 'pointer', textAlign: 'left', background: selectedCourse === c.id ? C.blueSoft : C.white, transition: 'all 0.15s' }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: selectedCourse === c.id ? C.blue : C.text }}>{c.name}</div>
                    <div style={{ fontSize: 11, color: C.light, marginTop: 4 }}>{c.month} · {c.level}</div>
                  </button>
                ))}
              </div>
              {lessons.length > 0 && (
                <Reveal>
                  <div style={{ background: C.white, borderRadius: 18, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
                    <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: '#F8FAFF' }}>
                          {['№','Тема','Математика','Кыргыз тили','Чтение','Тест'].map(h => (
                            <th key={h} style={{ textAlign: 'left', padding: '10px 16px', color: C.light, fontWeight: 600, fontSize: 11, textTransform: 'uppercase' as const, borderBottom: `1px solid ${C.border}` }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {lessons.map((l, i) => (
                          <tr key={l.id} style={{ borderBottom: i < lessons.length - 1 ? `1px solid #F1F5F9` : 'none' }}>
                            <td style={{ padding: '11px 16px', color: C.light, fontWeight: 700 }}>{l.lesson_number}</td>
                            <td style={{ padding: '11px 16px', fontWeight: 600 }}>{l.title}</td>
                            <td style={{ padding: '11px 16px', color: C.blue, fontSize: 12 }}>{l.math_topic}</td>
                            <td style={{ padding: '11px 16px', color: C.purple, fontSize: 12 }}>{l.kyr_topic}</td>
                            <td style={{ padding: '11px 16px', color: C.green, fontSize: 12 }}>{l.reading_topic}</td>
                            <td style={{ padding: '11px 16px' }}>
                              {l.is_test && <span style={{ background: '#F5F3FF', color: C.purple, borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>Тест</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Reveal>
              )}
              {!selectedCourse && <div style={{ textAlign: 'center', color: C.light, padding: 48, fontSize: 14 }}>← Курс тандаңыз</div>}
            </div>
          )}

          {/* ── STUDENTS ── */}
          {tab === 'students' && (
            <div>
              <AddUserForm role="student" onAdded={fetchData} />
              <Reveal>
                <div style={{ background: C.white, borderRadius: 18, border: `1px solid ${C.border}`, overflow: 'hidden', marginTop: 20 }}>
                  <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>Окуучулар ({students.length})</div>
                  </div>
                  <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#F8FAFF' }}>
                        {['Аты-жөнү','Телефон','Катталган'].map(h => (
                          <th key={h} style={{ textAlign: 'left', padding: '10px 18px', color: C.light, fontWeight: 600, fontSize: 11, textTransform: 'uppercase' as const, borderBottom: `1px solid ${C.border}` }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((s, i) => (
                        <tr key={s.id} style={{ borderBottom: i < students.length - 1 ? `1px solid #F1F5F9` : 'none' }}>
                          <td style={{ padding: '12px 18px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <Avatar name={s.full_name || '?'} size={30} />
                              <span style={{ fontWeight: 600 }}>{s.full_name}</span>
                            </div>
                          </td>
                          <td style={{ padding: '12px 18px', color: C.muted }}>{s.phone || '—'}</td>
                          <td style={{ padding: '12px 18px', color: C.light, fontSize: 12 }}>{new Date(s.created_at).toLocaleDateString('ru')}</td>
                        </tr>
                      ))}
                      {students.length === 0 && <tr><td colSpan={3} style={{ padding: 32, textAlign: 'center', color: C.light }}>Окуучулар жок</td></tr>}
                    </tbody>
                  </table>
                </div>
              </Reveal>
            </div>
          )}

          {/* ── TEACHERS ── */}
          {tab === 'teachers' && (
            <div>
              <AddUserForm role="teacher" onAdded={fetchData} />
              <Reveal>
                <div style={{ background: C.white, borderRadius: 18, border: `1px solid ${C.border}`, overflow: 'hidden', marginTop: 20 }}>
                  <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}` }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>Мугалимдер ({teachers.length})</div>
                  </div>
                  <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#F8FAFF' }}>
                        {['Аты-жөнү','Телефон','Катталган'].map(h => (
                          <th key={h} style={{ textAlign: 'left', padding: '10px 18px', color: C.light, fontWeight: 600, fontSize: 11, textTransform: 'uppercase' as const, borderBottom: `1px solid ${C.border}` }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {teachers.map((t, i) => (
                        <tr key={t.id} style={{ borderBottom: i < teachers.length - 1 ? `1px solid #F1F5F9` : 'none' }}>
                          <td style={{ padding: '12px 18px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <Avatar name={t.full_name || '?'} size={30} color={C.purple} />
                              <span style={{ fontWeight: 600 }}>{t.full_name}</span>
                            </div>
                          </td>
                          <td style={{ padding: '12px 18px', color: C.muted }}>{t.phone || '—'}</td>
                          <td style={{ padding: '12px 18px', color: C.light, fontSize: 12 }}>{new Date(t.created_at).toLocaleDateString('ru')}</td>
                        </tr>
                      ))}
                      {teachers.length === 0 && <tr><td colSpan={3} style={{ padding: 32, textAlign: 'center', color: C.light }}>Мугалимдер жок</td></tr>}
                    </tbody>
                  </table>
                </div>
              </Reveal>
            </div>
          )}

          {/* ── GROUPS ── */}
          {tab === 'groups' && (
            <div>
              <div style={{ marginBottom: 20 }}>
                <h2 style={{ fontSize: 20, fontWeight: 900, margin: 0 }}>Группалар ({groups.length})</h2>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
                {groups.map((g, i) => (
                  <Reveal key={g.id} delay={i * 60}>
                    <div style={{ background: C.white, borderRadius: 18, border: `1px solid ${C.border}`, padding: 20 }}>
                      <div style={{ width: 40, height: 40, background: C.blueSoft, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, marginBottom: 14 }}>👥</div>
                      <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 12 }}>{g.name}</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: C.muted }}>
                          <span>📚</span><span>{g.courses?.name || '—'}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: C.muted }}>
                          <span>👨‍🏫</span><span>{g.profiles?.full_name || '—'}</span>
                        </div>
                      </div>
                    </div>
                  </Reveal>
                ))}
                {groups.length === 0 && <div style={{ gridColumn: 'span 3', textAlign: 'center', color: C.light, padding: 48 }}>Группалар жок</div>}
              </div>
            </div>
          )}

          {/* ── TESTS ── */}
          {tab === 'tests' && <AdminTests />}

          {/* ── RESULTS ── */}
          {tab === 'results' && <ResultsTab />}

        </div>
      </main>
    </div>
  )
}

// ─── Add User Form ────────────────────────────────────────────────────────────
function AddUserForm({ role, onAdded }: { role: string; onAdded: () => void }) {
  const [show, setShow] = useState(false)
  const [form, setForm] = useState({ full_name: '', email: '', password: '', phone: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleSubmit = async () => {
    if (!form.full_name || !form.email || !form.password) { setError('Бардык талааларды толтуруңуз'); return }
    setSaving(true); setError(''); setSuccess('')
    const res = await fetch('/api/create-user', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, role }) })
    const data = await res.json()
    if (data.error) { setError(data.error) }
    else { setSuccess(role === 'student' ? '✓ Окуучу кошулду' : '✓ Мугалим кошулду'); setForm({ full_name: '', email: '', password: '', phone: '' }); setShow(false); onAdded() }
    setSaving(false)
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 900, margin: 0 }}>{role === 'student' ? 'Окуучулар' : 'Мугалимдер'}</h2>
        </div>
        <button onClick={() => { setShow(p => !p); setError(''); setSuccess('') }}
          style={{ background: C.blue, color: '#fff', border: 'none', borderRadius: 12, padding: '10px 20px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          + {role === 'student' ? 'Окуучу кошуу' : 'Мугалим кошуу'}
        </button>
      </div>

      {success && <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 12, padding: '12px 16px', marginBottom: 16, color: C.green, fontSize: 13, fontWeight: 600 }}>{success}</div>}

      {show && (
        <Reveal>
          <div style={{ background: C.white, borderRadius: 18, border: `1px solid ${C.border}`, padding: 24, marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 18, color: C.text }}>
              {role === 'student' ? '🎓 Жаңы окуучу' : '👨‍🏫 Жаңы мугалим'}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 11, color: C.light, fontWeight: 600, marginBottom: 6 }}>АТЫ-ЖӨНҮ *</div>
                <input value={form.full_name} onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))} placeholder="Иванов Айбек" style={inp} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: C.light, fontWeight: 600, marginBottom: 6 }}>ТЕЛЕФОН</div>
                <input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="+996 700 000 000" style={inp} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: C.light, fontWeight: 600, marginBottom: 6 }}>EMAIL *</div>
                <input value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="user@gmail.com" type="email" style={inp} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: C.light, fontWeight: 600, marginBottom: 6 }}>СЫРСӨЗ *</div>
                <input value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} placeholder="Мин. 6 символ" type="password" style={inp} />
              </div>
            </div>
            {error && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '10px 14px', marginBottom: 14, color: C.red, fontSize: 13 }}>❌ {error}</div>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={handleSubmit} disabled={saving} style={{ background: C.blue, color: '#fff', border: 'none', borderRadius: 10, padding: '10px 24px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                {saving ? 'Кошулууда...' : '+ Кошуу'}
              </button>
              <button onClick={() => setShow(false)} style={{ background: '#F1F5F9', color: C.muted, border: 'none', borderRadius: 10, padding: '10px 18px', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                Жокко чыгаруу
              </button>
            </div>
          </div>
        </Reveal>
      )}
    </div>
  )
}

// ─── CRM Tab ──────────────────────────────────────────────────────────────────
function CRMTab() {
  const [leads, setLeads] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [newLead, setNewLead] = useState({ full_name: '', phone: '', course: 'B1', stage: 'new' })
  const [saving, setSaving] = useState(false)

  const stages = [
    { id: 'new',      label: 'Жаңы',        color: '#6B7280' },
    { id: 'call',     label: 'Чалуу',       color: '#3B82F6' },
    { id: 'consult',  label: 'Консультация', color: C.purple },
    { id: 'trial',    label: 'Сынак',       color: C.yellow },
    { id: 'payment',  label: 'Оплата',      color: C.red },
    { id: 'studying', label: 'Окуп жатат',  color: C.green },
    { id: 'graduate', label: 'Бүтүрдү',    color: '#F0C040' },
  ]

  useEffect(() => { fetchLeads() }, [])
  const fetchLeads = async () => { const { data } = await supabase.from('crm_leads').select('*').order('created_at', { ascending: false }); setLeads(data || []) }
  const createLead = async () => {
    if (!newLead.full_name || !newLead.phone) return
    setSaving(true)
    await supabase.from('crm_leads').insert(newLead)
    setNewLead({ full_name: '', phone: '', course: 'B1', stage: 'new' })
    setShowForm(false); fetchLeads(); setSaving(false)
  }
  const updateStage = async (id: number, stage: string) => { await supabase.from('crm_leads').update({ stage }).eq('id', id); fetchLeads() }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 900, margin: 0 }}>CRM — Воронка</h2>
          <p style={{ color: C.light, fontSize: 13, margin: '4px 0 0' }}>{leads.length} лид</p>
        </div>
        <button onClick={() => setShowForm(p => !p)} style={{ background: C.blue, color: '#fff', border: 'none', borderRadius: 12, padding: '10px 20px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>+ Жаңы клиент</button>
      </div>

      {showForm && (
        <Reveal>
          <div style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.border}`, padding: 20, marginBottom: 20, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 12, alignItems: 'end' }}>
            {[
              { label: 'Аты-жөнү', el: <input value={newLead.full_name} onChange={e => setNewLead(p => ({ ...p, full_name: e.target.value }))} placeholder="Иванов Айбек" style={inp} /> },
              { label: 'Телефон',  el: <input value={newLead.phone}     onChange={e => setNewLead(p => ({ ...p, phone: e.target.value }))}     placeholder="+996 700 000 000" style={inp} /> },
              { label: 'Курс',     el: <select value={newLead.course} onChange={e => setNewLead(p => ({ ...p, course: e.target.value }))} style={sel}>{['B1','B2','C1','Жайкы интенсив'].map(c => <option key={c}>{c}</option>)}</select> },
            ].map(f => (
              <div key={f.label}>
                <div style={{ fontSize: 11, color: C.light, fontWeight: 600, marginBottom: 6 }}>{f.label}</div>
                {f.el}
              </div>
            ))}
            <button onClick={createLead} disabled={saving} style={{ background: C.blue, color: '#fff', border: 'none', borderRadius: 10, padding: '10px 20px', fontWeight: 700, fontSize: 13, cursor: 'pointer', height: 42 }}>
              {saving ? '...' : 'Кошуу'}
            </button>
          </div>
        </Reveal>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 12, overflowX: 'auto' }}>
        {stages.map(stage => {
          const stageLeads = leads.filter(l => l.stage === stage.id)
          return (
            <div key={stage.id} style={{ minWidth: 140 }}>
              <div style={{ background: `${stage.color}14`, border: `1px solid ${stage.color}33`, borderRadius: 10, padding: '7px 10px', marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: stage.color }}>{stage.label}</div>
                <div style={{ background: stage.color, color: '#fff', borderRadius: '50%', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800 }}>{stageLeads.length}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {stageLeads.map(lead => (
                  <div key={lead.id} style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: 12, transition: 'all 0.15s' }}>
                    <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 3 }}>{lead.full_name}</div>
                    <div style={{ fontSize: 11, color: C.light, marginBottom: 8 }}>{lead.phone}</div>
                    <div style={{ background: C.blueSoft, color: C.blue, borderRadius: 6, padding: '2px 8px', fontSize: 10, fontWeight: 700, display: 'inline-block', marginBottom: 8 }}>{lead.course}</div>
                    <select value={lead.stage} onChange={e => updateStage(lead.id, e.target.value)}
                      style={{ width: '100%', padding: '4px 8px', borderRadius: 6, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontSize: 11 }}>
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

// ─── Finance Tab ──────────────────────────────────────────────────────────────
function FinanceTab({ students }: { students: any[] }) {
  const [payments, setPayments] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [newPayment, setNewPayment] = useState({ student_id: '', amount: '', month: new Date().toISOString().slice(0,7), status: 'paid', note: '' })
  const [saving, setSaving] = useState(false)
  const [filterMonth, setFilterMonth] = useState(new Date().toISOString().slice(0,7))

  useEffect(() => { fetchPayments() }, [])
  const fetchPayments = async () => { const { data } = await supabase.from('payments').select('*, profiles(full_name)').order('created_at', { ascending: false }); setPayments(data || []) }

  const addPayment = async () => {
    if (!newPayment.student_id || !newPayment.amount) return
    setSaving(true)
    await supabase.from('payments').insert({ ...newPayment, amount: Number(newPayment.amount) })
    setNewPayment({ student_id: '', amount: '', month: new Date().toISOString().slice(0,7), status: 'paid', note: '' })
    setShowForm(false); fetchPayments(); setSaving(false)
  }

  const deletePayment = async (id: number) => { await supabase.from('payments').delete().eq('id', id); fetchPayments() }

  const months = Array.from({ length: 6 }, (_, i) => { const d = new Date(); d.setMonth(d.getMonth() - i); return d.toISOString().slice(0,7) })
  const filtered = payments.filter(p => p.month === filterMonth)
  const totalPaid = filtered.filter(p => p.status === 'paid').reduce((s, p) => s + p.amount, 0)
  const paidIds = filtered.filter(p => p.status === 'paid').map(p => p.student_id)
  const debtors = students.filter(s => !paidIds.includes(s.id))

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 900, margin: 0 }}>💰 Оплаталар</h2>
          <p style={{ color: C.light, fontSize: 13, margin: '4px 0 0' }}>{filterMonth}</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} style={{ ...sel, width: 'auto' }}>
            {months.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <button onClick={() => setShowForm(p => !p)} style={{ background: C.blue, color: '#fff', border: 'none', borderRadius: 12, padding: '10px 18px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>+ Оплата кошуу</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 }}>
        {[
          { label: 'Айлык киреше', value: totalPaid.toLocaleString() + ' сом', color: C.green, bg: '#F0FDF4', icon: '💚' },
          { label: 'Төлөдү', value: filtered.filter(p => p.status === 'paid').length + ' окуучу', color: C.blue, bg: C.blueSoft, icon: '✅' },
          { label: 'Карыздуулар', value: debtors.length + ' окуучу', color: C.red, bg: '#FEF2F2', icon: '⚠️' },
          { label: 'Жалпы оплата', value: filtered.length + ' жазуу', color: C.yellow, bg: '#FFFBEB', icon: '📊' },
        ].map((s, i) => (
          <Reveal key={i} delay={i * 60}>
            <div style={{ background: s.bg, borderRadius: 16, padding: 18, border: `1px solid ${s.color}22` }}>
              <div style={{ fontSize: 20, marginBottom: 8 }}>{s.icon}</div>
              <div style={{ fontWeight: 900, fontSize: 20, color: s.color, marginBottom: 3 }}>{s.value}</div>
              <div style={{ fontSize: 12, color: C.muted }}>{s.label}</div>
            </div>
          </Reveal>
        ))}
      </div>

      {showForm && (
        <Reveal>
          <div style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.border}`, padding: 20, marginBottom: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>+ Жаңы оплата</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 11, color: C.light, fontWeight: 600, marginBottom: 6 }}>ОКУУЧУ *</div>
                <select value={newPayment.student_id} onChange={e => setNewPayment(p => ({ ...p, student_id: e.target.value }))} style={sel}>
                  <option value="">Тандаңыз</option>
                  {students.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 11, color: C.light, fontWeight: 600, marginBottom: 6 }}>СУММА *</div>
                <input value={newPayment.amount} onChange={e => setNewPayment(p => ({ ...p, amount: e.target.value }))} type="number" placeholder="5000" style={inp} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: C.light, fontWeight: 600, marginBottom: 6 }}>АЙ</div>
                <input value={newPayment.month} onChange={e => setNewPayment(p => ({ ...p, month: e.target.value }))} type="month" style={inp} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: C.light, fontWeight: 600, marginBottom: 6 }}>СТАТУС</div>
                <select value={newPayment.status} onChange={e => setNewPayment(p => ({ ...p, status: e.target.value }))} style={sel}>
                  <option value="paid">✅ Төлөдү</option>
                  <option value="debt">⚠️ Карыз</option>
                  <option value="partial">◑ Жарым</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={addPayment} disabled={saving} style={{ background: C.blue, color: '#fff', border: 'none', borderRadius: 10, padding: '10px 22px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>{saving ? '...' : '+ Кошуу'}</button>
              <button onClick={() => setShowForm(false)} style={{ background: '#F1F5F9', color: C.muted, border: 'none', borderRadius: 10, padding: '10px 18px', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Жокко чыгаруу</button>
            </div>
          </div>
        </Reveal>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <Reveal>
          <div style={{ background: C.white, borderRadius: 18, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>💳 Оплаталар — {filterMonth}</div>
              <div style={{ fontWeight: 800, color: C.green }}>{totalPaid.toLocaleString()} сом</div>
            </div>
            <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F8FAFF' }}>
                  {['Окуучу','Сумма','Статус',''].map(h => <th key={h} style={{ textAlign: 'left', padding: '9px 16px', color: C.light, fontWeight: 600, fontSize: 11, textTransform: 'uppercase' as const, borderBottom: `1px solid ${C.border}` }}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, i) => (
                  <tr key={p.id} style={{ borderBottom: i < filtered.length - 1 ? `1px solid #F1F5F9` : 'none' }}>
                    <td style={{ padding: '11px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Avatar name={p.profiles?.full_name || '?'} size={26} />
                        <span style={{ fontWeight: 600 }}>{p.profiles?.full_name}</span>
                      </div>
                    </td>
                    <td style={{ padding: '11px 16px', color: C.green, fontWeight: 700 }}>{p.amount.toLocaleString()} сом</td>
                    <td style={{ padding: '11px 16px' }}>
                      <span style={{ background: p.status === 'paid' ? '#F0FDF4' : p.status === 'debt' ? '#FEF2F2' : '#FFFBEB', color: p.status === 'paid' ? C.green : p.status === 'debt' ? C.red : C.yellow, borderRadius: 6, padding: '3px 8px', fontSize: 11, fontWeight: 700 }}>
                        {p.status === 'paid' ? '✅ Төлөдү' : p.status === 'debt' ? '⚠️ Карыз' : '◑ Жарым'}
                      </span>
                    </td>
                    <td style={{ padding: '11px 16px' }}>
                      <button onClick={() => deletePayment(p.id)} style={{ background: '#FEF2F2', color: C.red, border: 'none', borderRadius: 7, padding: '4px 9px', fontSize: 12, cursor: 'pointer' }}>🗑</button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && <tr><td colSpan={4} style={{ padding: 28, textAlign: 'center', color: C.light }}>Оплаталар жок</td></tr>}
              </tbody>
            </table>
          </div>
        </Reveal>

        <Reveal delay={80}>
          <div style={{ background: C.white, borderRadius: 18, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}`, fontWeight: 700, fontSize: 14 }}>⚠️ Төлөбөгөндөр — {filterMonth}</div>
            <div style={{ padding: 10 }}>
              {debtors.length === 0 ? (
                <div style={{ padding: 28, textAlign: 'center', color: C.light, fontSize: 13 }}>✅ Баары төлөдү!</div>
              ) : debtors.map(s => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 10, marginBottom: 4, background: '#FEF2F2', border: '1px solid #FECACA' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Avatar name={s.full_name || '?'} size={28} color={C.red} />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{s.full_name}</div>
                      <div style={{ fontSize: 11, color: C.light }}>{s.phone || '—'}</div>
                    </div>
                  </div>
                  <button onClick={() => { setNewPayment(p => ({ ...p, student_id: s.id, status: 'debt' })); setShowForm(true) }}
                    style={{ background: '#FEF2F2', color: C.red, border: '1px solid #FECACA', borderRadius: 8, padding: '5px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                    Карыз кошуу
                  </button>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </div>
  )
}

// ─── Results Tab ──────────────────────────────────────────────────────────────
function ResultsTab() {
  const [results, setResults] = useState<any[]>([])
  useEffect(() => {
    supabase.from('test_results').select('*, profiles(full_name), lessons(title)').order('created_at', { ascending: false }).then(({ data }) => setResults(data || []))
  }, [])
  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 900, margin: 0 }}>📈 ЖРТ Натыйжалары</h2>
      </div>
      <Reveal>
        <div style={{ background: C.white, borderRadius: 18, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F8FAFF' }}>
                {['Окуучу','Сабак','Мат','Аналогия','Чтение','Грамматика','Жалпы'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 16px', color: C.light, fontWeight: 600, fontSize: 11, textTransform: 'uppercase' as const, borderBottom: `1px solid ${C.border}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {results.map((r, i) => (
                <tr key={r.id} style={{ borderBottom: i < results.length - 1 ? `1px solid #F1F5F9` : 'none' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Avatar name={r.profiles?.full_name || '?'} size={28} />
                      <span style={{ fontWeight: 600 }}>{r.profiles?.full_name}</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', color: C.muted, fontSize: 12 }}>{r.lessons?.title}</td>
                  <td style={{ padding: '12px 16px', color: C.blue, fontWeight: 600 }}>{r.math_score}</td>
                  <td style={{ padding: '12px 16px', color: C.purple, fontWeight: 600 }}>{r.analogy_score}</td>
                  <td style={{ padding: '12px 16px', color: C.green, fontWeight: 600 }}>{r.reading_score}</td>
                  <td style={{ padding: '12px 16px', color: C.yellow, fontWeight: 600 }}>{r.grammar_score}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ background: C.blueSoft, color: C.blue, borderRadius: 8, padding: '4px 12px', fontWeight: 800, fontSize: 14 }}>{Number(r.total_score).toFixed(1)}</span>
                  </td>
                </tr>
              ))}
              {results.length === 0 && <tr><td colSpan={7} style={{ padding: 32, textAlign: 'center', color: C.light }}>Натыйжалар жок</td></tr>}
            </tbody>
          </table>
        </div>
      </Reveal>
    </div>
  )
}

// ─── Admin Tests ──────────────────────────────────────────────────────────────
function AdminTests() {
  const [tests, setTests] = useState<any[]>([])
  const [selectedTest, setSelectedTest] = useState<any>(null)
  const [questions, setQuestions] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [newTest, setNewTest] = useState({ title: '', subject: 'math' })
  const [newQ, setNewQ] = useState({ question_text: '', option_a: '', option_b: '', option_c: '', option_d: '', correct_answer: 'A', image_url: '' })
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [qType, setQType] = useState<'text'|'image'>('text')

  const subjects = [{ value: 'math', label: 'Математика' }, { value: 'kyr', label: 'Кыргыз тили' }, { value: 'reading', label: 'Окуу' }, { value: 'grammar', label: 'Грамматика' }]

  useEffect(() => { fetchTests() }, [])
  const fetchTests = async () => { const { data } = await supabase.from('practice_tests').select('*').order('id'); setTests(data || []) }
  const fetchQuestions = async (id: number) => { const { data } = await supabase.from('questions').select('*').eq('practice_test_id', id).order('order_num'); setQuestions(data || []) }
  const selectTest = (t: any) => { setSelectedTest(t); fetchQuestions(t.id) }

  const createTest = async () => {
    if (!newTest.title) return
    setSaving(true)
    const { data } = await supabase.from('practice_tests').insert({ title: newTest.title, subject: newTest.subject, questions: [], lesson_id: 1 }).select().single()
    if (data) { setTests(p => [...p, data]); selectTest(data) }
    setNewTest({ title: '', subject: 'math' }); setShowForm(false); setSaving(false)
  }

  const uploadImage = async (file: File) => {
    setUploading(true)
    const ext = file.name.split('.').pop()
    const path = `question_${Date.now()}.${ext}`
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
      order_num: questions.length + 1,
    })
    setNewQ({ question_text: '', option_a: '', option_b: '', option_c: '', option_d: '', correct_answer: 'A', image_url: '' })
    fetchQuestions(selectedTest.id); setSaving(false)
  }

  const deleteQuestion = async (id: number) => { await supabase.from('questions').delete().eq('id', id); if (selectedTest) fetchQuestions(selectedTest.id) }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 20, alignItems: 'start' }}>
      {/* Left: test list */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: C.muted }}>Тесттер</div>
          <button onClick={() => setShowForm(p => !p)} style={{ background: C.blue, color: '#fff', border: 'none', borderRadius: 8, padding: '5px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>+ Жаңы</button>
        </div>
        {showForm && (
          <div style={{ background: C.white, borderRadius: 12, border: `1px solid ${C.border}`, padding: 14, marginBottom: 12 }}>
            <input value={newTest.title} onChange={e => setNewTest(p => ({ ...p, title: e.target.value }))} placeholder="Тест аталышы" style={{ ...inp, marginBottom: 8 }} />
            <select value={newTest.subject} onChange={e => setNewTest(p => ({ ...p, subject: e.target.value }))} style={{ ...sel, marginBottom: 10 }}>
              {subjects.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <button onClick={createTest} disabled={saving} style={{ width: '100%', background: C.blue, color: '#fff', border: 'none', borderRadius: 8, padding: 9, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>{saving ? '...' : 'Түзүү'}</button>
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {tests.map(t => (
            <button key={t.id} onClick={() => selectTest(t)}
              style={{ textAlign: 'left', padding: '10px 12px', borderRadius: 10, border: `${selectedTest?.id === t.id ? 2 : 1}px solid ${selectedTest?.id === t.id ? C.blue : C.border}`, cursor: 'pointer', background: selectedTest?.id === t.id ? C.blueSoft : C.white }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: selectedTest?.id === t.id ? C.blue : C.text }}>{t.title}</div>
              <div style={{ fontSize: 11, color: C.light, marginTop: 2 }}>{subjects.find(s => s.value === t.subject)?.label}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Right: questions */}
      {selectedTest ? (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <h3 style={{ fontWeight: 800, fontSize: 17, margin: 0 }}>{selectedTest.title}</h3>
              <div style={{ color: C.light, fontSize: 12, marginTop: 3 }}>{questions.length} суроо</div>
            </div>
          </div>

          {/* Add question form */}
          <div style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.border}`, padding: 20, marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>Жаңы суроо</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              {(['text','image'] as const).map(type => (
                <button key={type} onClick={() => setQType(type)}
                  style={{ padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: qType === type ? C.blue : '#F1F5F9', color: qType === type ? '#fff' : C.muted }}>
                  {type === 'text' ? '📝 Текст' : '🖼 Сүрөт'}
                </button>
              ))}
            </div>
            {qType === 'text' ? (
              <textarea value={newQ.question_text} onChange={e => setNewQ(p => ({ ...p, question_text: e.target.value }))} placeholder="Суроону жазыңыз..." rows={3}
                style={{ ...inp, resize: 'none' as const, marginBottom: 12 }} />
            ) : (
              <div style={{ marginBottom: 12 }}>
                <input type="file" accept="image/*" onChange={e => e.target.files?.[0] && uploadImage(e.target.files[0])} style={{ display: 'none' }} id="img-upload" />
                <label htmlFor="img-upload" style={{ display: 'block', border: `2px dashed ${C.border}`, borderRadius: 10, padding: 20, textAlign: 'center', cursor: 'pointer', background: C.bg }}>
                  {uploading ? <div style={{ color: C.light, fontSize: 13 }}>Жүктөлүүдө...</div>
                    : newQ.image_url ? <img src={newQ.image_url} alt="preview" style={{ maxHeight: 100, borderRadius: 8 }} />
                    : <div style={{ color: C.light, fontSize: 13 }}>🖼 Сүрөт жүктөө үчүн басыңыз</div>}
                </label>
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
              {(['A','B','C','D'] as const).map(opt => (
                <div key={opt} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <div onClick={() => setNewQ(p => ({ ...p, correct_answer: opt }))}
                    style={{ width: 24, height: 24, borderRadius: 6, background: newQ.correct_answer === opt ? C.blue : '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: newQ.correct_answer === opt ? '#fff' : C.muted, cursor: 'pointer', flexShrink: 0 }}>
                    {opt}
                  </div>
                  <input value={(newQ as any)[`option_${opt.toLowerCase()}`]} onChange={e => setNewQ(p => ({ ...p, [`option_${opt.toLowerCase()}`]: e.target.value }))}
                    placeholder={`${opt} варианты`}
                    style={{ flex: 1, padding: '6px 8px', borderRadius: 7, border: `1px solid ${newQ.correct_answer === opt ? C.blue : C.border}`, background: newQ.correct_answer === opt ? C.blueSoft : C.bg, color: C.text, fontSize: 12, outline: 'none' }} />
                </div>
              ))}
            </div>
            <div style={{ fontSize: 11, color: C.light, marginBottom: 12 }}>💡 Туура жооп тамгасын тандаңыз: <strong style={{ color: C.blue }}>{newQ.correct_answer}</strong></div>
            <button onClick={addQuestion} disabled={saving || uploading}
              style={{ background: C.blue, color: '#fff', border: 'none', borderRadius: 10, padding: '10px 22px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              {saving ? '...' : '+ Суроо кошуу'}
            </button>
          </div>

          {/* Questions list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {questions.map((q, i) => (
              <div key={q.id} style={{ background: C.white, borderRadius: 14, border: `1px solid ${C.border}`, padding: 16, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ width: 28, height: 28, background: C.blue, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#fff', flexShrink: 0 }}>{i+1}</div>
                <div style={{ flex: 1 }}>
                  {q.image_url ? <img src={q.image_url} alt="q" style={{ maxHeight: 70, borderRadius: 8, marginBottom: 8 }} />
                    : <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: C.text }}>{q.question_text}</div>}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {['A','B','C','D'].map(opt => (
                      <span key={opt} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, background: q.correct_answer === opt ? '#F0FDF4' : C.bg, color: q.correct_answer === opt ? C.green : C.muted, fontWeight: q.correct_answer === opt ? 700 : 400, border: `1px solid ${q.correct_answer === opt ? '#BBF7D0' : C.border}` }}>
                        {opt}: {q[`option_${opt.toLowerCase()}`]}
                      </span>
                    ))}
                  </div>
                </div>
                <button onClick={() => deleteQuestion(q.id)} style={{ background: '#FEF2F2', color: C.red, border: 'none', borderRadius: 7, padding: '5px 9px', cursor: 'pointer', fontSize: 12, flexShrink: 0 }}>🗑</button>
              </div>
            ))}
            {questions.length === 0 && <div style={{ textAlign: 'center', color: C.light, fontSize: 13, padding: 28 }}>Суроолор жок — жогорудан кошуңуз</div>}
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', color: C.light, fontSize: 14, padding: 60 }}>← Тест тандаңыз</div>
      )}
    </div>
  )
}