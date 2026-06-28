'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, type ReactElement } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

interface Profile { id: string; full_name: string; role: string }
interface Lesson { id: string; lesson_number: number; title: string; is_test: boolean; math_topic: string; kyr_topic: string; reading_topic: string }
interface Attendance { id: string; status: 'present' | 'late' | 'absent'; lessons: { title: string; lesson_number: number } }
interface TestResult { id: string; total_score: number; math_score: number; analogy_score: number; reading_score: number; grammar_score: number; lessons: { title: string }; created_at: string }
interface Homework { id: string; title: string; description: string; due_date: string; lesson_id: string; homework_submissions: { student_id: string }[] }
interface PracticeTest { id: string; title: string; subject: string; practice_results: { score: number; student_id: string }[] }

type TabId = 'home' | 'schedule' | 'tests' | 'results' | 'homework' | 'attendance'

const Icon = {
  Home: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  Calendar: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  Test: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  Chart: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>,
  Book: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>,
  Check: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  LogOut: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  Menu: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>,
}

function ScoreRing({ score, size = 64 }: { score: number; size?: number }) {
  const r = (size - 8) / 2
  const circ = 2 * Math.PI * r
  const pct = Math.min(Math.max(score / 145, 0), 1)
  const color = score >= 110 ? '#10B981' : score >= 80 ? '#F59E0B' : '#EF4444'
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#E8ECF4" strokeWidth="6"/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="6"
        strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)} strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.6s ease' }}/>
      <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle"
        style={{ transform: 'rotate(90deg)', transformOrigin: 'center', fill: '#1E293B', fontSize: size * 0.22 + 'px', fontWeight: '800', fontFamily: 'Inter, sans-serif' }}>
        {Math.round(score)}
      </text>
    </svg>
  )
}

function ProgressBar({ value, max, color = '#1B4FD8' }: { value: number; max: number; color?: string }) {
  return (
    <div style={{ background: '#E8ECF4', borderRadius: '999px', height: '6px', overflow: 'hidden' }}>
      <div style={{ width: `${max > 0 ? (value / max) * 100 : 0}%`, height: '100%', background: color, borderRadius: '999px', transition: 'width 0.6s ease' }}/>
    </div>
  )
}

function EmptyState({ emoji, title, subtitle }: { emoji: string; title: string; subtitle: string }) {
  return (
    <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E8ECF4', padding: '44px 20px', textAlign: 'center' }}>
      <div style={{ fontSize: '40px', marginBottom: '12px', lineHeight: 1 }}>{emoji}</div>
      <div style={{ fontWeight: '700', fontSize: '15px', color: '#1E293B', marginBottom: '6px' }}>{title}</div>
      <div style={{ color: '#94A3B8', fontSize: '13px', maxWidth: '260px', margin: '0 auto' }}>{subtitle}</div>
    </div>
  )
}

function TestsTab({ userId }: { userId: string }) {
  const [tests, setTests] = useState<PracticeTest[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    supabase.from('practice_tests').select('*, practice_results(score, student_id)')
      .then(({ data }) => { setTests(data || []); setLoading(false) })
  }, [])

  if (loading) return <div style={{ color: '#94A3B8', padding: '32px', textAlign: 'center', fontSize: '14px' }}>Жүктөлүүдө...</div>
  if (tests.length === 0) return <EmptyState emoji="📝" title="Тесттер жок" subtitle="Администратор тест кошкондон кийин пайда болот" />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {tests.map(t => {
        const myResult = t.practice_results?.find(r => r.student_id === userId)
        const subjectLabel = t.subject === 'math' ? 'Математика' : t.subject === 'kyr' ? 'Кыргыз тили' : t.subject
        return (
          <div key={t.id} style={{ background: '#fff', borderRadius: '14px', border: '1px solid #E8ECF4', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '12px' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: '700', fontSize: '14px', color: '#1E293B', marginBottom: '3px' }}>{t.title}</div>
                <div style={{ fontSize: '12px', color: '#94A3B8', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ display: 'inline-block', width: '5px', height: '5px', borderRadius: '50%', background: '#1B4FD8', flexShrink: 0 }}/>
                  {subjectLabel}
                </div>
              </div>
              {myResult && (
                <div style={{ textAlign: 'center', flexShrink: 0 }}>
                  <div style={{ fontWeight: '900', fontSize: '17px', color: myResult.score >= 70 ? '#10B981' : '#F59E0B' }}>{myResult.score}%</div>
                  <div style={{ fontSize: '10px', color: '#94A3B8' }}>Натыйжа</div>
                </div>
              )}
            </div>
            <button onClick={() => router.push(`/student/test?id=${t.id}`)}
              style={{ width: '100%', background: myResult ? '#F8FAFF' : '#1B4FD8', color: myResult ? '#1B4FD8' : '#fff', border: myResult ? '1.5px solid #1B4FD8' : 'none', borderRadius: '10px', padding: '11px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}>
              {myResult ? '🔄 Кайра аракет' : '🚀 Баштоо →'}
            </button>
          </div>
        )
      })}
    </div>
  )
}

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
    const { data: gs } = await supabase.from('group_students').select('group_id, groups(course_id, name)').eq('student_id', uid).single()
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
      const { data: hws } = await supabase.from('homeworks').select('*, homework_submissions(student_id)').in('lesson_id', lessonIds)
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

  const presentCount = attendance.filter(a => a.status === 'present').length
  const attendancePct = attendance.length > 0 ? Math.round((presentCount / attendance.length) * 100) : 0
  const completedLessons = attendance.filter(a => a.status !== 'absent').length
  const avgScore = results.length > 0 ? results.reduce((s, r) => s + r.total_score, 0) / results.length : 0
  const pendingHW = homeworks.filter(hw => !hw.homework_submissions?.some(s => s.student_id === profile?.id)).length
  const lastResult = results[0]

  const tabs: { id: TabId; label: string; Icon: () => ReactElement }[] = [
    { id: 'home',       label: 'Башкы бет',   Icon: Icon.Home },
    { id: 'schedule',   label: 'Программа',   Icon: Icon.Calendar },
    { id: 'tests',      label: 'Тесттер',      Icon: Icon.Test },
    { id: 'results',    label: 'Натыйжалар',  Icon: Icon.Chart },
    { id: 'homework',   label: 'Тапшырмалар', Icon: Icon.Book },
    { id: 'attendance', label: 'Катышуу',      Icon: Icon.Check },
  ]

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8FAFF', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: '36px', height: '36px', border: '3px solid #E8ECF4', borderTopColor: '#1B4FD8', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }}/>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <div style={{ color: '#94A3B8', fontSize: '14px' }}>Жүктөлүүдө...</div>
      </div>
    </div>
  )

  const SidebarContent = () => (
    <>
      <div style={{ padding: '20px 16px', borderBottom: '1px solid #E8ECF4', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ width: '30px', height: '30px', background: '#1B4FD8', borderRadius: '7px', overflow: 'hidden', flexShrink: 0 }}>
          <img src="/images/logo.png" alt="Z" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
        <span style={{ fontWeight: '900', fontSize: '16px', color: '#1B4FD8' }}>Zhangak</span>
      </div>

      <div style={{ padding: '14px 16px', borderBottom: '1px solid #E8ECF4' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
          <div style={{ width: '34px', height: '34px', background: 'linear-gradient(135deg,#1B4FD8,#6366F1)', borderRadius: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: '800', fontSize: '13px', flexShrink: 0 }}>
            {profile?.full_name?.[0] || 'У'}
          </div>
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontWeight: '700', fontSize: '13px', color: '#1E293B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{profile?.full_name}</div>
            <div style={{ fontSize: '11px', color: '#94A3B8' }}>Студент</div>
          </div>
        </div>
      </div>

      <nav style={{ padding: '10px 10px', flex: 1, overflowY: 'auto' }}>
        {tabs.map(tab => {
          const active = activeTab === tab.id
          return (
            <button key={tab.id} onClick={() => { setActiveTab(tab.id); setSidebarOpen(false) }}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '9px', padding: '9px 11px', borderRadius: '10px', border: 'none', cursor: 'pointer', marginBottom: '2px', background: active ? '#EFF6FF' : 'transparent', color: active ? '#1B4FD8' : '#64748B', fontWeight: active ? '700' : '500', fontSize: '13px', textAlign: 'left', transition: 'all 0.15s' }}>
              <tab.Icon />
              {tab.label}
              {tab.id === 'homework' && pendingHW > 0 && (
                <span style={{ marginLeft: 'auto', background: '#EF4444', color: '#fff', borderRadius: '20px', padding: '1px 6px', fontSize: '10px', fontWeight: '800' }}>{pendingHW}</span>
              )}
            </button>
          )
        })}
      </nav>

      <div style={{ padding: '10px', borderTop: '1px solid #E8ECF4' }}>
        <button onClick={handleLogout} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '9px', padding: '9px 11px', borderRadius: '10px', border: 'none', cursor: 'pointer', background: 'transparent', color: '#94A3B8', fontWeight: '500', fontSize: '13px' }}>
          <Icon.LogOut /> Чыгуу
        </button>
      </div>
    </>
  )

  // Bottom nav tabs for mobile
  const BottomNav = () => (
    <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', borderTop: '1px solid #E8ECF4', display: 'flex', zIndex: 200, paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {tabs.map(tab => {
        const active = activeTab === tab.id
        return (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '8px 4px', border: 'none', background: 'transparent', cursor: 'pointer', color: active ? '#1B4FD8' : '#94A3B8', position: 'relative', minWidth: 0 }}>
            <div style={{ transform: active ? 'scale(1.15)' : 'scale(1)', transition: 'transform 0.15s' }}>
              <tab.Icon />
            </div>
            <div style={{ fontSize: '9px', fontWeight: active ? '700' : '500', marginTop: '3px', whiteSpace: 'nowrap' }}>{tab.label}</div>
            {tab.id === 'homework' && pendingHW > 0 && (
              <div style={{ position: 'absolute', top: '4px', right: '12%', background: '#EF4444', color: '#fff', borderRadius: '20px', padding: '1px 5px', fontSize: '9px', fontWeight: '800' }}>{pendingHW}</div>
            )}
          </button>
        )
      })}
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFF', fontFamily: 'Inter, -apple-system, sans-serif', display: 'flex' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        *{box-sizing:border-box}
        @keyframes spin{to{transform:rotate(360deg)}}
        .desktop-sidebar{display:flex;flex-direction:column}
        .mobile-topbar{display:none}
        .bottom-nav{display:none}
        .main-content{margin-left:220px}
        .content-pad{padding:28px 28px}
        .stats-grid{grid-template-columns:repeat(2,1fr)}
        .results-grid{grid-template-columns:repeat(4,1fr)}
        .att-grid{grid-template-columns:repeat(3,1fr)}
        .quick-grid{grid-template-columns:repeat(3,1fr)}
        .score-badges{flex-wrap:wrap}
        @media(max-width:768px){
          .desktop-sidebar{display:none!important}
          .mobile-topbar{display:flex!important}
          .bottom-nav{display:flex!important}
          .main-content{margin-left:0!important}
          .content-pad{padding:16px 14px 80px!important}
          .stats-grid{grid-template-columns:1fr 1fr!important}
          .results-grid{grid-template-columns:1fr 1fr!important;gap:8px!important}
          .att-grid{grid-template-columns:1fr 1fr 1fr!important;gap:8px!important}
          .quick-grid{grid-template-columns:repeat(3,1fr)!important;gap:8px!important}
          .h1-title{font-size:20px!important}
          .h2-title{font-size:18px!important}
          .last-result-inner{flex-direction:column!important;gap:14px!important}
          .score-ring-wrap{display:flex!important;align-items:center!important;gap:14px!important}
          .schedule-topics{gap:5px!important}
          .schedule-topic-tag{font-size:10px!important;padding:3px 7px!important}
          .hw-item{flex-direction:column!important;align-items:flex-start!important;gap:8px!important}
          .hw-badge{align-self:flex-start!important}
          .att-item{padding:10px 12px!important}
          .test-item{padding:14px!important}
          .stat-val{font-size:22px!important}
        }
        @media(hover:hover){button:hover{opacity:0.85}}
      `}</style>

      {/* Desktop sidebar */}
      <aside className="desktop-sidebar" style={{ width: '220px', background: '#fff', borderRight: '1px solid #E8ECF4', position: 'fixed', top: 0, left: 0, height: '100vh', zIndex: 200 }}>
        <SidebarContent />
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <>
          <div onClick={() => setSidebarOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 300 }}/>
          <aside style={{ width: '240px', background: '#fff', display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, left: 0, height: '100vh', zIndex: 400, boxShadow: '4px 0 24px rgba(0,0,0,0.12)' }}>
            <SidebarContent />
          </aside>
        </>
      )}

      {/* Mobile topbar */}
      <div className="mobile-topbar" style={{ position: 'fixed', top: 0, left: 0, right: 0, background: '#fff', borderBottom: '1px solid #E8ECF4', height: '52px', display: 'none', alignItems: 'center', justifyContent: 'space-between', padding: '0 14px', zIndex: 150 }}>
        <button onClick={() => setSidebarOpen(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#64748B' }}>
          <Icon.Menu />
        </button>
        <span style={{ fontWeight: '900', fontSize: '16px', color: '#1B4FD8' }}>Zhangak</span>
        <div style={{ width: '28px' }}/>
      </div>

      {/* Mobile bottom nav */}
      <div className="bottom-nav" style={{ display: 'none' }}>
        <BottomNav />
      </div>

      {/* Main */}
      <main className="main-content" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh', paddingTop: 0 }}>
        {/* Desktop top padding */}
        <div className="desktop-toppad" style={{ height: '0' }} />

        <div className="content-pad" style={{ padding: '28px', flex: 1, marginTop: '0' }}>
          {/* Mobile top spacing */}
          <div className="mobile-topspace" style={{ display: 'none', height: '52px' }} />

          {/* ── HOME ── */}
          {activeTab === 'home' && (
            <div>
              <div style={{ marginBottom: '20px' }}>
                <h1 className="h1-title" style={{ fontSize: '22px', fontWeight: '900', color: '#1E293B', margin: 0, letterSpacing: '-0.5px' }}>
                  Саламатсызбы, {profile?.full_name?.split(' ')[0]} 👋
                </h1>
                <p style={{ color: '#64748B', fontSize: '13px', margin: '5px 0 0' }}>ЖРТга чейин аракет улантылат</p>
              </div>

              <div className="stats-grid" style={{ display: 'grid', gap: '12px', marginBottom: '16px' }}>
                {[
                  { label: 'Катышуу', value: `${attendancePct}%`, sub: `${presentCount}/${attendance.length} сабак`, color: '#10B981', icon: '✅' },
                  { label: 'Орточо балл', value: avgScore > 0 ? avgScore.toFixed(1) : '—', sub: results.length > 0 ? `${results.length} тест` : 'Жок', color: '#1B4FD8', icon: '📊' },
                  { label: 'Прогресс', value: `${completedLessons}/${lessons.length}`, sub: 'сабак аяктады', color: '#7C3AED', icon: '📅' },
                  { label: 'Тапшырма', value: pendingHW > 0 ? `${pendingHW}` : '✓', sub: pendingHW > 0 ? 'күтүп жатат' : 'баары тапшырылды', color: pendingHW > 0 ? '#EF4444' : '#10B981', icon: '📚' },
                ].map(s => (
                  <div key={s.label} style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E8ECF4', padding: '16px', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: '-10px', right: '-6px', fontSize: '44px', opacity: 0.07, pointerEvents: 'none' }}>{s.icon}</div>
                    <div style={{ fontSize: '11px', color: '#94A3B8', fontWeight: '600', marginBottom: '6px', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>{s.label}</div>
                    <div className="stat-val" style={{ fontWeight: '900', fontSize: '24px', color: s.color, letterSpacing: '-0.5px', marginBottom: '2px' }}>{s.value}</div>
                    <div style={{ fontSize: '11px', color: '#94A3B8' }}>{s.sub}</div>
                  </div>
                ))}
              </div>

              {lessons.length > 0 && (
                <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E8ECF4', padding: '18px', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <div style={{ fontWeight: '800', fontSize: '14px', color: '#1E293B' }}>Курстун прогрессу</div>
                    <span style={{ fontWeight: '700', fontSize: '13px', color: '#1B4FD8' }}>{completedLessons}/{lessons.length}</span>
                  </div>
                  <ProgressBar value={completedLessons} max={lessons.length} color="#1B4FD8" />
                  <div style={{ marginTop: '8px', fontSize: '12px', color: '#64748B' }}>
                    {lessons.length - completedLessons > 0 ? `Калды: ${lessons.length - completedLessons} сабак` : '🎉 Бардык сабактар аяктады!'}
                  </div>
                </div>
              )}

              {lastResult && (
                <div style={{ background: 'linear-gradient(135deg,#1B4FD8 0%,#6366F1 100%)', borderRadius: '16px', padding: '20px', color: '#fff', marginBottom: '14px' }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', opacity: 0.75, marginBottom: '10px', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>Акыркы тест натыйжасы</div>
                  <div className="last-result-inner" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div className="score-ring-wrap">
                      <ScoreRing score={lastResult.total_score} size={60} />
                      <div>
                        <div style={{ fontWeight: '800', fontSize: '14px', marginBottom: '3px' }}>{lastResult.lessons?.title}</div>
                        <div style={{ opacity: 0.75, fontSize: '12px' }}>
                          {new Date(lastResult.created_at).toLocaleDateString('ru', { day: 'numeric', month: 'long' })}
                        </div>
                      </div>
                    </div>
                    <div className="score-badges" style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' as const }}>
                      {[
                        { label: 'Мат', val: lastResult.math_score },
                        { label: 'Анал', val: lastResult.analogy_score },
                        { label: 'Окуу', val: lastResult.reading_score },
                        { label: 'Грам', val: lastResult.grammar_score },
                      ].map(s => (
                        <div key={s.label} style={{ background: 'rgba(255,255,255,0.15)', borderRadius: '8px', padding: '4px 9px', textAlign: 'center' }}>
                          <div style={{ fontSize: '13px', fontWeight: '800' }}>{s.val}</div>
                          <div style={{ fontSize: '9px', opacity: 0.75 }}>{s.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className="quick-grid" style={{ display: 'grid', gap: '10px' }}>
                {[
                  { label: 'Программа', tab: 'schedule' as TabId, icon: '📅', color: '#1B4FD8' },
                  { label: 'Тесттер', tab: 'tests' as TabId, icon: '📝', color: '#7C3AED' },
                  { label: 'Натыйжалар', tab: 'results' as TabId, icon: '📊', color: '#10B981' },
                ].map(a => (
                  <button key={a.tab} onClick={() => setActiveTab(a.tab)}
                    style={{ background: '#fff', border: '1px solid #E8ECF4', borderRadius: '14px', padding: '14px 8px', cursor: 'pointer', textAlign: 'center' }}>
                    <div style={{ fontSize: '22px', marginBottom: '5px' }}>{a.icon}</div>
                    <div style={{ fontSize: '11px', fontWeight: '700', color: a.color }}>{a.label}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── SCHEDULE ── */}
          {activeTab === 'schedule' && (
            <div>
              <div style={{ marginBottom: '20px' }}>
                <h2 className="h2-title" style={{ fontSize: '20px', fontWeight: '900', color: '#1E293B', margin: 0 }}>Сабак программасы</h2>
                <p style={{ color: '#94A3B8', fontSize: '12px', margin: '4px 0 0' }}>{lessons.length} сабак · {lessons.filter(l => l.is_test).length} тест</p>
              </div>
              {lessons.length === 0
                ? <EmptyState emoji="📅" title="Сабактар жок" subtitle="Программа кошулгандан кийин пайда болот" />
                : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {lessons.map(l => {
                      const att = attendance.find(a => (a.lessons as any)?.lesson_number === l.lesson_number)
                      const statusColor = att?.status === 'present' ? '#10B981' : att?.status === 'late' ? '#F59E0B' : '#EF4444'
                      return (
                        <div key={l.id} style={{ background: '#fff', borderRadius: '14px', border: '1px solid #E8ECF4', overflow: 'hidden', display: 'flex' }}>
                          <div style={{ width: '4px', background: l.is_test ? '#7C3AED' : '#1B4FD8', flexShrink: 0 }}/>
                          <div style={{ padding: '13px 14px', flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px', marginBottom: '8px' }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px', flexWrap: 'wrap' as const }}>
                                  <span style={{ fontSize: '10px', fontWeight: '700', color: '#94A3B8' }}>#{l.lesson_number}</span>
                                  {l.is_test && <span style={{ background: '#F5F3FF', color: '#7C3AED', fontSize: '9px', fontWeight: '700', padding: '2px 7px', borderRadius: '20px' }}>ТЕСТ</span>}
                                </div>
                                <div style={{ fontWeight: '700', fontSize: '13px', color: '#1E293B', lineHeight: '1.3' }}>{l.title}</div>
                              </div>
                              {att && (
                                <div style={{ background: att.status === 'present' ? '#F0FDF4' : att.status === 'late' ? '#FFF7ED' : '#FEF2F2', color: statusColor, padding: '3px 8px', borderRadius: '20px', fontSize: '10px', fontWeight: '700', flexShrink: 0, whiteSpace: 'nowrap' as const }}>
                                  {att.status === 'present' ? '✓ Катышты' : att.status === 'late' ? '⏰ Кечигди' : '✗ Жок'}
                                </div>
                              )}
                            </div>
                            <div className="schedule-topics" style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' as const }}>
                              {[
                                { icon: '📐', text: l.math_topic, color: '#1B4FD8', bg: '#EFF6FF' },
                                { icon: '✍️', text: l.kyr_topic, color: '#7C3AED', bg: '#F5F3FF' },
                                { icon: '📖', text: l.reading_topic, color: '#059669', bg: '#F0FDF4' },
                              ].filter(t => t.text).map((t, i) => (
                                <div key={i} className="schedule-topic-tag" style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 8px', background: t.bg, borderRadius: '7px' }}>
                                  <span style={{ fontSize: '10px' }}>{t.icon}</span>
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

          {/* ── TESTS ── */}
          {activeTab === 'tests' && profile && (
            <div>
              <div style={{ marginBottom: '20px' }}>
                <h2 className="h2-title" style={{ fontSize: '20px', fontWeight: '900', color: '#1E293B', margin: 0 }}>Практикалык тесттер</h2>
                <p style={{ color: '#94A3B8', fontSize: '12px', margin: '4px 0 0' }}>Каалаган убакта тапшыр</p>
              </div>
              <TestsTab userId={profile.id} />
            </div>
          )}

          {/* ── RESULTS ── */}
          {activeTab === 'results' && (
            <div>
              <div style={{ marginBottom: '20px' }}>
                <h2 className="h2-title" style={{ fontSize: '20px', fontWeight: '900', color: '#1E293B', margin: 0 }}>Менин натыйжаларым</h2>
                <p style={{ color: '#94A3B8', fontSize: '12px', margin: '4px 0 0' }}>
                  {results.length > 0 ? `${results.length} тест · Орточо: ${avgScore.toFixed(1)} балл` : 'Тест жок'}
                </p>
              </div>
              {results.length === 0
                ? <EmptyState emoji="📊" title="Натыйжа жок" subtitle="Тесттен өткөндөн кийин пайда болот" />
                : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {results.map((r, idx) => (
                      <div key={r.id} style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E8ECF4', padding: '18px', position: 'relative', overflow: 'hidden' }}>
                        {idx === 0 && <div style={{ position: 'absolute', top: '12px', right: '12px', background: '#FEF3C7', color: '#D97706', fontSize: '9px', fontWeight: '800', padding: '2px 8px', borderRadius: '20px' }}>АКЫРКЫ</div>}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '14px' }}>
                          <ScoreRing score={r.total_score} size={56} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: '800', fontSize: '14px', color: '#1E293B', marginBottom: '3px', lineHeight: '1.3' }}>{r.lessons?.title}</div>
                            <div style={{ fontSize: '11px', color: '#94A3B8' }}>
                              {new Date(r.created_at).toLocaleDateString('ru', { day: 'numeric', month: 'long', year: 'numeric' })}
                            </div>
                          </div>
                        </div>
                        <div className="results-grid" style={{ display: 'grid', gap: '8px' }}>
                          {[
                            { label: 'Математика', value: r.math_score, mult: 1.12, color: '#1B4FD8', bg: '#EFF6FF' },
                            { label: 'Аналогия', value: r.analogy_score, mult: 2, color: '#7C3AED', bg: '#F5F3FF' },
                            { label: 'Чтение', value: r.reading_score, mult: 2, color: '#059669', bg: '#F0FDF4' },
                            { label: 'Грамматика', value: r.grammar_score, mult: 1.93, color: '#D97706', bg: '#FFF7ED' },
                          ].map(s => (
                            <div key={s.label} style={{ background: s.bg, borderRadius: '10px', padding: '10px 8px', textAlign: 'center' }}>
                              <div style={{ fontSize: '9px', color: s.color, fontWeight: '700', marginBottom: '3px', textTransform: 'uppercase' as const }}>{s.label}</div>
                              <div style={{ fontWeight: '900', fontSize: '18px', color: '#1E293B' }}>{s.value}</div>
                              <div style={{ fontSize: '9px', color: '#94A3B8', marginTop: '1px' }}>={(s.value * s.mult).toFixed(1)}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
            </div>
          )}

          {/* ── HOMEWORK ── */}
          {activeTab === 'homework' && (
            <div>
              <div style={{ marginBottom: '20px' }}>
                <h2 className="h2-title" style={{ fontSize: '20px', fontWeight: '900', color: '#1E293B', margin: 0 }}>Үй тапшырмалар</h2>
                <p style={{ color: '#94A3B8', fontSize: '12px', margin: '4px 0 0' }}>
                  {pendingHW > 0 ? `${pendingHW} тапшырма күтүп жатат` : 'Бардыгы тапшырылды ✓'}
                </p>
              </div>
              {homeworks.length === 0
                ? <EmptyState emoji="📚" title="Тапшырма жок" subtitle="Мугалим тапшырма берсе пайда болот" />
                : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {homeworks.map(hw => {
                      const submitted = hw.homework_submissions?.some(s => s.student_id === profile?.id)
                      const overdue = !submitted && hw.due_date && new Date(hw.due_date) < new Date()
                      return (
                        <div key={hw.id} className="hw-item" style={{ background: '#fff', borderRadius: '14px', border: `1px solid ${overdue ? '#FECACA' : submitted ? '#BBF7D0' : '#E8ECF4'}`, padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: '700', fontSize: '13px', color: '#1E293B', marginBottom: '3px' }}>{hw.title}</div>
                            {hw.description && <div style={{ fontSize: '11px', color: '#94A3B8', marginBottom: '3px', lineHeight: '1.4' }}>{hw.description}</div>}
                            {hw.due_date && (
                              <div style={{ fontSize: '11px', color: overdue ? '#EF4444' : '#94A3B8', fontWeight: overdue ? '700' : '400' }}>
                                {overdue ? '⚠️ ' : '📅 '}{new Date(hw.due_date).toLocaleDateString('ru', { day: 'numeric', month: 'long' })}{overdue ? ' — мөөнөт өттү' : ''}
                              </div>
                            )}
                          </div>
                          <div className="hw-badge" style={{ background: submitted ? '#F0FDF4' : overdue ? '#FEF2F2' : '#FFFBEB', color: submitted ? '#10B981' : overdue ? '#EF4444' : '#D97706', padding: '5px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '800', flexShrink: 0, whiteSpace: 'nowrap' as const }}>
                            {submitted ? '✓ Тапшырылды' : overdue ? '✗ Кечикти' : '⏳ Күтүүдө'}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
            </div>
          )}

          {/* ── ATTENDANCE ── */}
          {activeTab === 'attendance' && (
            <div>
              <div style={{ marginBottom: '20px' }}>
                <h2 className="h2-title" style={{ fontSize: '20px', fontWeight: '900', color: '#1E293B', margin: 0 }}>Катышуу</h2>
                <p style={{ color: '#94A3B8', fontSize: '12px', margin: '4px 0 0' }}>{attendancePct}% жалпы катышуу</p>
              </div>

              <div className="att-grid" style={{ display: 'grid', gap: '10px', marginBottom: '14px' }}>
                {[
                  { label: 'Катышты', value: attendance.filter(a => a.status === 'present').length, color: '#10B981' },
                  { label: 'Кечигди', value: attendance.filter(a => a.status === 'late').length, color: '#F59E0B' },
                  { label: 'Жок болду', value: attendance.filter(a => a.status === 'absent').length, color: '#EF4444' },
                ].map(s => (
                  <div key={s.label} style={{ background: '#fff', borderRadius: '14px', border: '1px solid #E8ECF4', padding: '14px 10px', textAlign: 'center' }}>
                    <div style={{ fontWeight: '900', fontSize: '24px', color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '3px' }}>{s.label}</div>
                  </div>
                ))}
              </div>

              <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #E8ECF4', padding: '16px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontWeight: '700', fontSize: '13px', color: '#1E293B' }}>Жалпы катышуу</span>
                  <span style={{ fontWeight: '800', fontSize: '13px', color: attendancePct >= 80 ? '#10B981' : '#EF4444' }}>{attendancePct}%</span>
                </div>
                <ProgressBar value={presentCount} max={attendance.length} color={attendancePct >= 80 ? '#10B981' : '#EF4444'} />
              </div>

              {attendance.length === 0
                ? <EmptyState emoji="✅" title="Маалымат жок" subtitle="Сабактарга катышкандан кийин пайда болот" />
                : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                    {attendance.map(a => (
                      <div key={a.id} className="att-item" style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E8ECF4', padding: '11px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                        <div style={{ fontWeight: '600', fontSize: '13px', color: '#1E293B', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                          <span style={{ color: '#94A3B8', marginRight: '6px', fontSize: '11px' }}>#{a.lessons?.lesson_number}</span>
                          {a.lessons?.title}
                        </div>
                        <div style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '10px', fontWeight: '800', flexShrink: 0, whiteSpace: 'nowrap' as const,
                          background: a.status === 'present' ? '#F0FDF4' : a.status === 'late' ? '#FFF7ED' : '#FEF2F2',
                          color: a.status === 'present' ? '#10B981' : a.status === 'late' ? '#F59E0B' : '#EF4444' }}>
                          {a.status === 'present' ? '✓ Катышты' : a.status === 'late' ? '⏰ Кечигди' : '✗ Жок'}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
            </div>
          )}

        </div>

        {/* Mobile top offset */}
        <style>{`
          @media(max-width:768px){
            .content-pad{padding-top:66px!important}
            .mobile-topspace{display:none!important}
            .desktop-toppad{display:none!important}
          }
        `}</style>
      </main>
    </div>
  )
}