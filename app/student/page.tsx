'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, type ReactElement } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Profile { id: string; full_name: string; role: string }
interface Lesson {
  id: string; lesson_number: number; title: string
  is_test: boolean; math_topic: string; kyr_topic: string; reading_topic: string
}
interface Attendance { id: string; status: 'present' | 'late' | 'absent'; lessons: { title: string; lesson_number: number } }
interface TestResult {
  id: string; total_score: number
  math_score: number; analogy_score: number; reading_score: number; grammar_score: number
  lessons: { title: string }; created_at: string
}
interface Homework {
  id: string; title: string; description: string; due_date: string; lesson_id: string
  homework_submissions: { student_id: string }[]
}
interface PracticeTest {
  id: string; title: string; subject: string
  practice_results: { score: number; student_id: string }[]
}

type TabId = 'home' | 'schedule' | 'tests' | 'results' | 'homework' | 'attendance'

// ─── Icons ────────────────────────────────────────────────────────────────────
const Icon = {
  Home: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  ),
  Calendar: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  ),
  Test: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
    </svg>
  ),
  Chart: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/>
    </svg>
  ),
  Book: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>
    </svg>
  ),
  Check: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
  LogOut: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  ),
}

// ─── Score ring component ──────────────────────────────────────────────────────
function ScoreRing({ score, size = 64 }: { score: number; size?: number }) {
  const r = (size - 8) / 2
  const circ = 2 * Math.PI * r
  const pct = Math.min(Math.max(score / 145, 0), 1)
  const color = score >= 110 ? '#10B981' : score >= 80 ? '#F59E0B' : '#EF4444'
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#E8ECF4" strokeWidth="6"/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="6"
        strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)}
        strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.6s ease' }}/>
      <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle"
        style={{ transform: 'rotate(90deg)', transformOrigin: 'center', fill: '#1E293B', fontSize: size * 0.22 + 'px', fontWeight: '800', fontFamily: 'Inter, sans-serif' }}>
        {Math.round(score)}
      </text>
    </svg>
  )
}

// ─── Progress bar ─────────────────────────────────────────────────────────────
function ProgressBar({ value, max, color = '#1B4FD8' }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0
  return (
    <div style={{ background: '#E8ECF4', borderRadius: '999px', height: '6px', overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '999px', transition: 'width 0.6s ease' }}/>
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────
function EmptyState({ emoji, title, subtitle }: { emoji: string; title: string; subtitle: string }) {
  return (
    <div style={{ background: '#fff', borderRadius: '20px', border: '1px solid #E8ECF4', padding: '56px 32px', textAlign: 'center' }}>
      <div style={{ fontSize: '48px', marginBottom: '16px', lineHeight: 1 }}>{emoji}</div>
      <div style={{ fontWeight: '700', fontSize: '17px', color: '#1E293B', marginBottom: '8px' }}>{title}</div>
      <div style={{ color: '#94A3B8', fontSize: '14px', maxWidth: '280px', margin: '0 auto' }}>{subtitle}</div>
    </div>
  )
}

// ─── Tests tab (extracted as proper component) ────────────────────────────────
function TestsTab({ userId }: { userId: string }) {
  const [tests, setTests] = useState<PracticeTest[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    supabase.from('practice_tests')
      .select('*, practice_results(score, student_id)')
      .then(({ data }) => { setTests(data || []); setLoading(false) })
  }, [])

  if (loading) return <div style={{ color: '#94A3B8', padding: '32px', textAlign: 'center', fontSize: '14px' }}>Жүктөлүүдө...</div>

  if (tests.length === 0) return (
    <EmptyState emoji="📝" title="Тесттер жок" subtitle="Администратор тест кошкондон кийин бул жерде пайда болот" />
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {tests.map(t => {
        const myResult = t.practice_results?.find(r => r.student_id === userId)
        const subjectLabel = t.subject === 'math' ? 'Математика' : t.subject === 'kyr' ? 'Кыргыз тили' : t.subject
        return (
          <div key={t.id} style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E8ECF4', padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: '700', fontSize: '15px', color: '#1E293B', marginBottom: '4px' }}>{t.title}</div>
              <div style={{ fontSize: '12px', color: '#94A3B8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: '#1B4FD8' }}/>
                {subjectLabel}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {myResult && (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontWeight: '900', fontSize: '18px', color: myResult.score >= 70 ? '#10B981' : '#F59E0B' }}>{myResult.score}%</div>
                  <div style={{ fontSize: '10px', color: '#94A3B8' }}>Натыйжа</div>
                </div>
              )}
              <button onClick={() => router.push(`/student/test?id=${t.id}`)}
                style={{ background: myResult ? '#F8FAFF' : '#1B4FD8', color: myResult ? '#1B4FD8' : '#fff', border: myResult ? '1.5px solid #1B4FD8' : 'none', borderRadius: '12px', padding: '10px 20px', fontWeight: '700', fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                {myResult ? 'Кайра' : 'Баштоо →'}
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function StudentPage() {
  const [activeTab, setActiveTab] = useState<TabId>('home')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [attendance, setAttendance] = useState<Attendance[]>([])
  const [results, setResults] = useState<TestResult[]>([])
  const [homeworks, setHomeworks] = useState<Homework[]>([])
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const router = useRouter()

  const fetchData = useCallback(async (uid: string) => {
    const { data: gs } = await supabase
      .from('group_students')
      .select('group_id, groups(course_id, name)')
      .eq('student_id', uid)
      .single()

    if (!gs) { setLoading(false); return }

    const courseId = (gs.groups as any)?.course_id

    const [{ data: lsns }, { data: att }, { data: res }] = await Promise.all([
      supabase.from('lessons').select('*').eq('course_id', courseId).order('lesson_number'),
      supabase.from('attendance').select('*, lessons(title, lesson_number)').eq('student_id', uid),
      supabase.from('test_results').select('*, lessons(title)').eq('student_id', uid).order('created_at', { ascending: false }),
    ])

    setLessons(lsns || [])
    setAttendance(att || [])
    setResults(res || [])

    const lessonIds = lsns?.map((l: any) => l.id) || []
    if (lessonIds.length > 0) {
      const { data: hws } = await supabase
        .from('homeworks')
        .select('*, homework_submissions(student_id)')
        .in('lesson_id', lessonIds)
      setHomeworks(hws || [])
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (prof?.role !== 'student') { router.push('/'); return }
      setProfile(prof)
      fetchData(user.id)
    }
    checkAuth()
  }, [fetchData, router])

  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/') }

  // ── Derived stats ──────────────────────────────────────────────────────────
  const presentCount = attendance.filter(a => a.status === 'present').length
  const attendancePct = attendance.length > 0 ? Math.round((presentCount / attendance.length) * 100) : 0
  const completedLessons = attendance.filter(a => a.status !== 'absent').length
  const avgScore = results.length > 0 ? results.reduce((s, r) => s + r.total_score, 0) / results.length : 0
  const pendingHW = homeworks.filter(hw => !hw.homework_submissions?.some(s => s.student_id === profile?.id)).length
  const lastResult = results[0]

  // ── Navigation ─────────────────────────────────────────────────────────────
  const tabs: { id: TabId; label: string; Icon: () => ReactElement }[] = [
    { id: 'home',       label: 'Башкы бет',    Icon: Icon.Home },
    { id: 'schedule',   label: 'Программа',    Icon: Icon.Calendar },
    { id: 'tests',      label: 'Тесттер',       Icon: Icon.Test },
    { id: 'results',    label: 'Натыйжалар',   Icon: Icon.Chart },
    { id: 'homework',   label: 'Тапшырмалар',  Icon: Icon.Book },
    { id: 'attendance', label: 'Катышуу',       Icon: Icon.Check },
  ]

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8FAFF' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid #E8ECF4', borderTopColor: '#1B4FD8', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }}/>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ color: '#94A3B8', fontSize: '14px' }}>Жүктөлүүдө...</div>
      </div>
    </div>
  )

  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid #E8ECF4' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img src="/images/logo.png" alt="Zhangak" style={{ width: '32px', height: '32px', objectFit: 'contain' }} />
          <span style={{ fontWeight: '900', fontSize: '17px', color: '#1B4FD8', letterSpacing: '-0.3px' }}>Zhangak</span>
        </div>
      </div>

      {/* Profile */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #E8ECF4' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '36px', height: '36px', background: 'linear-gradient(135deg,#1B4FD8,#6366F1)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: '800', fontSize: '14px', flexShrink: 0 }}>
            {profile?.full_name?.[0] || 'У'}
          </div>
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontWeight: '700', fontSize: '13px', color: '#1E293B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{profile?.full_name}</div>
            <div style={{ fontSize: '11px', color: '#94A3B8' }}>Студент</div>
          </div>
        </div>
      </div>

      {/* Nav items */}
      <nav style={{ padding: '12px 12px', flex: 1 }}>
        {tabs.map(tab => {
          const active = activeTab === tab.id
          return (
            <button key={tab.id} onClick={() => { setActiveTab(tab.id); setSidebarOpen(false) }}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '10px', border: 'none', cursor: 'pointer', marginBottom: '2px', background: active ? '#EFF6FF' : 'transparent', color: active ? '#1B4FD8' : '#64748B', fontWeight: active ? '700' : '500', fontSize: '13px', textAlign: 'left', transition: 'all 0.15s' }}>
              <tab.Icon />
              {tab.label}
              {tab.id === 'homework' && pendingHW > 0 && (
                <span style={{ marginLeft: 'auto', background: '#EF4444', color: '#fff', borderRadius: '20px', padding: '1px 7px', fontSize: '10px', fontWeight: '800' }}>{pendingHW}</span>
              )}
            </button>
          )
        })}
      </nav>

      {/* Logout */}
      <div style={{ padding: '12px 12px', borderTop: '1px solid #E8ECF4' }}>
        <button onClick={handleLogout}
          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '10px', border: 'none', cursor: 'pointer', background: 'transparent', color: '#94A3B8', fontWeight: '500', fontSize: '13px' }}>
          <Icon.LogOut />
          Чыгуу
        </button>
      </div>
    </>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFF', fontFamily: 'Inter, -apple-system, sans-serif', display: 'flex' }}>
      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      {/* Desktop sidebar */}
      <aside style={{ width: '220px', background: '#fff', borderRight: '1px solid #E8ECF4', display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, left: 0, height: '100vh', zIndex: 200 }}
        className="desktop-sidebar">
        <SidebarContent />
      </aside>

      {/* Mobile overlay sidebar */}
      {sidebarOpen && (
        <>
          <div onClick={() => setSidebarOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 300 }}/>
          <aside style={{ width: '240px', background: '#fff', display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, left: 0, height: '100vh', zIndex: 400, boxShadow: '4px 0 24px rgba(0,0,0,0.1)' }}>
            <SidebarContent />
          </aside>
        </>
      )}

      {/* ── Main ────────────────────────────────────────────────────────────── */}
      <main style={{ flex: 1, marginLeft: '220px', display: 'flex', flexDirection: 'column', minHeight: '100vh' }}
        className="main-content">

        {/* Top bar (mobile only) */}
        <div style={{ background: '#fff', borderBottom: '1px solid #E8ECF4', padding: '0 20px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
          className="mobile-topbar">
          <button onClick={() => setSidebarOpen(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#64748B' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
          <span style={{ fontWeight: '900', fontSize: '16px', color: '#1B4FD8' }}>Zhangak</span>
          <div style={{ width: '28px' }}/>
        </div>

        <div style={{ padding: '32px', flex: 1 }}>

          {/* ── HOME ──────────────────────────────────────────────────────── */}
          {activeTab === 'home' && (
            <div>
              {/* Welcome */}
              <div style={{ marginBottom: '28px' }}>
                <h1 style={{ fontSize: '24px', fontWeight: '900', color: '#1E293B', margin: 0, letterSpacing: '-0.5px' }}>
                  Саламатсызбы, {profile?.full_name?.split(' ')[0]} 👋
                </h1>
                <p style={{ color: '#64748B', fontSize: '14px', margin: '6px 0 0', fontWeight: '500' }}>
                  Бүгүн дагы бир кадам алга — ЖРТга чейин аракет улантылат
                </p>
              </div>

              {/* Stats grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '24px' }}>
                {[
                  { label: 'Катышуу', value: `${attendancePct}%`, sub: `${presentCount} / ${attendance.length} сабак`, color: '#10B981', bg: '#F0FDF4', icon: '✅' },
                  { label: 'Орточо балл', value: avgScore > 0 ? avgScore.toFixed(1) : '—', sub: results.length > 0 ? `${results.length} тест тапшырылды` : 'Тест жок', color: '#1B4FD8', bg: '#EFF6FF', icon: '📊' },
                  { label: 'Прогресс', value: `${completedLessons}/${lessons.length}`, sub: 'сабак аяктады', color: '#7C3AED', bg: '#F5F3FF', icon: '📅' },
                  { label: 'Тапшырма', value: pendingHW > 0 ? `${pendingHW}` : '✓', sub: pendingHW > 0 ? 'күтүп жатат' : 'бардыгы тапшырылды', color: pendingHW > 0 ? '#EF4444' : '#10B981', bg: pendingHW > 0 ? '#FEF2F2' : '#F0FDF4', icon: '📚' },
                ].map(s => (
                  <div key={s.label} style={{ background: '#fff', borderRadius: '20px', border: '1px solid #E8ECF4', padding: '20px', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: '-12px', right: '-8px', fontSize: '52px', opacity: 0.07, pointerEvents: 'none' }}>{s.icon}</div>
                    <div style={{ fontSize: '12px', color: '#94A3B8', fontWeight: '600', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{s.label}</div>
                    <div style={{ fontWeight: '900', fontSize: '26px', color: s.color, letterSpacing: '-0.5px', marginBottom: '4px' }}>{s.value}</div>
                    <div style={{ fontSize: '12px', color: '#94A3B8' }}>{s.sub}</div>
                  </div>
                ))}
              </div>

              {/* Course progress */}
              {lessons.length > 0 && (
                <div style={{ background: '#fff', borderRadius: '20px', border: '1px solid #E8ECF4', padding: '24px', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                    <div style={{ fontWeight: '800', fontSize: '15px', color: '#1E293B' }}>Курстун прогрессу</div>
                    <span style={{ fontWeight: '700', fontSize: '13px', color: '#1B4FD8' }}>{completedLessons}/{lessons.length}</span>
                  </div>
                  <ProgressBar value={completedLessons} max={lessons.length} color="#1B4FD8" />
                  <div style={{ marginTop: '12px', fontSize: '13px', color: '#64748B' }}>
                    {lessons.length - completedLessons > 0
                      ? `Калды: ${lessons.length - completedLessons} сабак`
                      : '🎉 Бардык сабактар аяктады!'}
                  </div>
                </div>
              )}

              {/* Last result */}
              {lastResult && (
                <div style={{ background: 'linear-gradient(135deg, #1B4FD8 0%, #6366F1 100%)', borderRadius: '20px', padding: '24px', color: '#fff' }}>
                  <div style={{ fontSize: '12px', fontWeight: '700', opacity: 0.75, marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Акыркы тест натыйжасы</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <ScoreRing score={lastResult.total_score} size={72} />
                    <div>
                      <div style={{ fontWeight: '800', fontSize: '16px', marginBottom: '4px' }}>{lastResult.lessons?.title}</div>
                      <div style={{ opacity: 0.75, fontSize: '13px' }}>
                        {new Date(lastResult.created_at).toLocaleDateString('ru', { day: 'numeric', month: 'long' })}
                      </div>
                      <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
                        {[
                          { label: 'Мат', val: lastResult.math_score },
                          { label: 'Анал', val: lastResult.analogy_score },
                          { label: 'Окуу', val: lastResult.reading_score },
                          { label: 'Грам', val: lastResult.grammar_score },
                        ].map(s => (
                          <div key={s.label} style={{ background: 'rgba(255,255,255,0.15)', borderRadius: '8px', padding: '4px 10px', textAlign: 'center' }}>
                            <div style={{ fontSize: '14px', fontWeight: '800' }}>{s.val}</div>
                            <div style={{ fontSize: '10px', opacity: 0.75 }}>{s.label}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Quick actions */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginTop: '20px' }}>
                {[
                  { label: 'Программа', tab: 'schedule' as TabId, icon: '📅', color: '#1B4FD8' },
                  { label: 'Тесттер', tab: 'tests' as TabId, icon: '📝', color: '#7C3AED' },
                  { label: 'Натыйжалар', tab: 'results' as TabId, icon: '📊', color: '#10B981' },
                ].map(a => (
                  <button key={a.tab} onClick={() => setActiveTab(a.tab)}
                    style={{ background: '#fff', border: '1px solid #E8ECF4', borderRadius: '16px', padding: '16px 12px', cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s' }}>
                    <div style={{ fontSize: '24px', marginBottom: '6px' }}>{a.icon}</div>
                    <div style={{ fontSize: '12px', fontWeight: '700', color: a.color }}>{a.label}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── SCHEDULE ──────────────────────────────────────────────────── */}
          {activeTab === 'schedule' && (
            <div>
              <div style={{ marginBottom: '24px' }}>
                <h2 style={{ fontSize: '22px', fontWeight: '900', color: '#1E293B', margin: 0 }}>Сабак программасы</h2>
                <p style={{ color: '#94A3B8', fontSize: '13px', margin: '4px 0 0' }}>{lessons.length} сабак • {lessons.filter(l => l.is_test).length} тест</p>
              </div>
              {lessons.length === 0
                ? <EmptyState emoji="📅" title="Сабактар жок" subtitle="Программа кошулгандан кийин бул жерде пайда болот" />
                : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {lessons.map(l => {
                      const att = attendance.find(a => (a.lessons as any)?.lesson_number === l.lesson_number)
                      const statusColor = att?.status === 'present' ? '#10B981' : att?.status === 'late' ? '#F59E0B' : att ? '#EF4444' : '#94A3B8'
                      return (
                        <div key={l.id} style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E8ECF4', overflow: 'hidden', display: 'flex' }}>
                          <div style={{ width: '4px', background: l.is_test ? '#7C3AED' : '#1B4FD8', flexShrink: 0 }}/>
                          <div style={{ padding: '16px 20px', flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '10px' }}>
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                  <span style={{ fontSize: '11px', fontWeight: '700', color: '#94A3B8' }}>#{l.lesson_number}</span>
                                  {l.is_test && <span style={{ background: '#F5F3FF', color: '#7C3AED', fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '20px' }}>ТЕСТ</span>}
                                </div>
                                <div style={{ fontWeight: '700', fontSize: '14px', color: '#1E293B' }}>{l.title}</div>
                              </div>
                              {att && (
                                <div style={{ background: att.status === 'present' ? '#F0FDF4' : att.status === 'late' ? '#FFF7ED' : '#FEF2F2', color: statusColor, padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700', flexShrink: 0 }}>
                                  {att.status === 'present' ? '✓ Катышты' : att.status === 'late' ? '⏰ Кечигди' : '✗ Жок болду'}
                                </div>
                              )}
                            </div>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                              {[
                                { icon: '📐', text: l.math_topic, color: '#1B4FD8', bg: '#EFF6FF' },
                                { icon: '✍️', text: l.kyr_topic, color: '#7C3AED', bg: '#F5F3FF' },
                                { icon: '📖', text: l.reading_topic, color: '#059669', bg: '#F0FDF4' },
                              ].filter(t => t.text).map((t, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 10px', background: t.bg, borderRadius: '8px' }}>
                                  <span style={{ fontSize: '11px' }}>{t.icon}</span>
                                  <span style={{ fontSize: '11px', color: t.color, fontWeight: '600' }}>{t.text}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
            </div>
          )}

          {/* ── TESTS ─────────────────────────────────────────────────────── */}
          {activeTab === 'tests' && profile && (
            <div>
              <div style={{ marginBottom: '24px' }}>
                <h2 style={{ fontSize: '22px', fontWeight: '900', color: '#1E293B', margin: 0 }}>Практикалык тесттер</h2>
                <p style={{ color: '#94A3B8', fontSize: '13px', margin: '4px 0 0' }}>Каалаган убакта тапшырып, натыйжаны көрүңүз</p>
              </div>
              <TestsTab userId={profile.id} />
            </div>
          )}

          {/* ── RESULTS ───────────────────────────────────────────────────── */}
          {activeTab === 'results' && (
            <div>
              <div style={{ marginBottom: '24px' }}>
                <h2 style={{ fontSize: '22px', fontWeight: '900', color: '#1E293B', margin: 0 }}>Менин натыйжаларым</h2>
                <p style={{ color: '#94A3B8', fontSize: '13px', margin: '4px 0 0' }}>
                  {results.length > 0 ? `${results.length} тест • Орточо: ${avgScore.toFixed(1)} балл` : 'Тест тапшырылган жок'}
                </p>
              </div>
              {results.length === 0
                ? <EmptyState emoji="📊" title="Натыйжа жок" subtitle="Тесттен өткөндөн кийин натыйжалар бул жерде пайда болот" />
                : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {results.map((r, idx) => (
                      <div key={r.id} style={{ background: '#fff', borderRadius: '20px', border: '1px solid #E8ECF4', padding: '24px', overflow: 'hidden', position: 'relative' }}>
                        {idx === 0 && <div style={{ position: 'absolute', top: '16px', right: '16px', background: '#FEF3C7', color: '#D97706', fontSize: '10px', fontWeight: '800', padding: '3px 10px', borderRadius: '20px' }}>АКЫРКЫ</div>}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '20px' }}>
                          <ScoreRing score={r.total_score} size={64} />
                          <div>
                            <div style={{ fontWeight: '800', fontSize: '16px', color: '#1E293B', marginBottom: '4px' }}>{r.lessons?.title}</div>
                            <div style={{ fontSize: '12px', color: '#94A3B8' }}>
                              {new Date(r.created_at).toLocaleDateString('ru', { day: 'numeric', month: 'long', year: 'numeric' })}
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '10px' }}>
                          {[
                            { label: 'Математика', value: r.math_score, mult: 1.12, color: '#1B4FD8', bg: '#EFF6FF' },
                            { label: 'Аналогия', value: r.analogy_score, mult: 2, color: '#7C3AED', bg: '#F5F3FF' },
                            { label: 'Чтение', value: r.reading_score, mult: 2, color: '#059669', bg: '#F0FDF4' },
                            { label: 'Грамматика', value: r.grammar_score, mult: 1.93, color: '#D97706', bg: '#FFF7ED' },
                          ].map(s => (
                            <div key={s.label} style={{ background: s.bg, borderRadius: '12px', padding: '12px', textAlign: 'center' }}>
                              <div style={{ fontSize: '10px', color: s.color, fontWeight: '700', marginBottom: '4px', textTransform: 'uppercase' }}>{s.label}</div>
                              <div style={{ fontWeight: '900', fontSize: '20px', color: '#1E293B' }}>{s.value}</div>
                              <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '2px' }}>= {(s.value * s.mult).toFixed(1)}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
            </div>
          )}

          {/* ── HOMEWORK ──────────────────────────────────────────────────── */}
          {activeTab === 'homework' && (
            <div>
              <div style={{ marginBottom: '24px' }}>
                <h2 style={{ fontSize: '22px', fontWeight: '900', color: '#1E293B', margin: 0 }}>Үй тапшырмалар</h2>
                <p style={{ color: '#94A3B8', fontSize: '13px', margin: '4px 0 0' }}>
                  {pendingHW > 0 ? `${pendingHW} тапшырма күтүп жатат` : 'Бардыгы тапшырылды ✓'}
                </p>
              </div>
              {homeworks.length === 0
                ? <EmptyState emoji="📚" title="Тапшырма жок" subtitle="Мугалим тапшырма берсе бул жерде пайда болот" />
                : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {homeworks.map(hw => {
                      const submitted = hw.homework_submissions?.some(s => s.student_id === profile?.id)
                      const overdue = !submitted && hw.due_date && new Date(hw.due_date) < new Date()
                      return (
                        <div key={hw.id} style={{ background: '#fff', borderRadius: '16px', border: `1px solid ${overdue ? '#FECACA' : submitted ? '#BBF7D0' : '#E8ECF4'}`, padding: '18px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: '700', fontSize: '14px', color: '#1E293B', marginBottom: '4px' }}>{hw.title}</div>
                            {hw.description && <div style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '4px' }}>{hw.description}</div>}
                            {hw.due_date && (
                              <div style={{ fontSize: '11px', color: overdue ? '#EF4444' : '#94A3B8', fontWeight: overdue ? '700' : '400' }}>
                                {overdue ? '⚠️ ' : '📅 '}
                                {new Date(hw.due_date).toLocaleDateString('ru', { day: 'numeric', month: 'long' })}
                                {overdue && ' — мөөнөт өттү'}
                              </div>
                            )}
                          </div>
                          <div style={{ background: submitted ? '#F0FDF4' : overdue ? '#FEF2F2' : '#FFFBEB', color: submitted ? '#10B981' : overdue ? '#EF4444' : '#D97706', padding: '6px 14px', borderRadius: '20px', fontSize: '11px', fontWeight: '800', flexShrink: 0, whiteSpace: 'nowrap' }}>
                            {submitted ? '✓ Тапшырылды' : overdue ? '✗ Кечиктирилди' : '⏳ Күтүүдө'}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
            </div>
          )}

          {/* ── ATTENDANCE ────────────────────────────────────────────────── */}
          {activeTab === 'attendance' && (
            <div>
              <div style={{ marginBottom: '24px' }}>
                <h2 style={{ fontSize: '22px', fontWeight: '900', color: '#1E293B', margin: 0 }}>Катышуу</h2>
                <p style={{ color: '#94A3B8', fontSize: '13px', margin: '4px 0 0' }}>{attendancePct}% жалпы катышуу</p>
              </div>

              {/* Summary */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
                {[
                  { label: 'Катышты', value: attendance.filter(a => a.status === 'present').length, color: '#10B981', bg: '#F0FDF4' },
                  { label: 'Кечигди', value: attendance.filter(a => a.status === 'late').length, color: '#F59E0B', bg: '#FFF7ED' },
                  { label: 'Жок болду', value: attendance.filter(a => a.status === 'absent').length, color: '#EF4444', bg: '#FEF2F2' },
                ].map(s => (
                  <div key={s.label} style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E8ECF4', padding: '18px', textAlign: 'center' }}>
                    <div style={{ fontWeight: '900', fontSize: '28px', color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '4px' }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Attendance rate bar */}
              <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E8ECF4', padding: '20px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <span style={{ fontWeight: '700', fontSize: '13px', color: '#1E293B' }}>Жалпы катышуу</span>
                  <span style={{ fontWeight: '800', fontSize: '13px', color: attendancePct >= 80 ? '#10B981' : '#EF4444' }}>{attendancePct}%</span>
                </div>
                <ProgressBar value={presentCount} max={attendance.length} color={attendancePct >= 80 ? '#10B981' : '#EF4444'} />
              </div>

              {/* List */}
              {attendance.length === 0
                ? <EmptyState emoji="✅" title="Маалымат жок" subtitle="Сабактарга катышкандан кийин бул жерде пайда болот" />
                : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {attendance.map(a => (
                      <div key={a.id} style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E8ECF4', padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                        <div style={{ fontWeight: '600', fontSize: '13px', color: '#1E293B' }}>
                          <span style={{ color: '#94A3B8', marginRight: '8px' }}>#{a.lessons?.lesson_number}</span>
                          {a.lessons?.title}
                        </div>
                        <div style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: '800', flexShrink: 0,
                          background: a.status === 'present' ? '#F0FDF4' : a.status === 'late' ? '#FFF7ED' : '#FEF2F2',
                          color: a.status === 'present' ? '#10B981' : a.status === 'late' ? '#F59E0B' : '#EF4444' }}>
                          {a.status === 'present' ? '✓ Катышты' : a.status === 'late' ? '⏰ Кечигди' : '✗ Жок болду'}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
            </div>
          )}

        </div>
      </main>

      {/* ── Responsive styles ────────────────────────────────────────────────── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; }
        .mobile-topbar { display: none !important; }
        @media (max-width: 768px) {
          .desktop-sidebar { display: none !important; }
          .mobile-topbar { display: flex !important; }
          .main-content { margin-left: 0 !important; }
          .main-content > div:last-child { padding: 20px 16px !important; }
        }
        button:hover { opacity: 0.85; }
      `}</style>
    </div>
  )
}