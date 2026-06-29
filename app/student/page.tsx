'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import {
  Home, Calendar, FileText, BarChart2, BookOpen, CheckSquare,
  LogOut, Menu, ChevronRight, Clock, AlertCircle, CheckCircle,
  XCircle, TrendingUp, User, Award
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────
interface Profile { id: string; full_name: string; role: string }
interface Lesson { id: string; lesson_number: number; title: string; is_test: boolean; math_topic: string; kyr_topic: string; reading_topic: string }
interface Attendance { id: string; status: 'present' | 'late' | 'absent'; lessons: { title: string; lesson_number: number } }
interface TestResult { id: string; total_score: number; math_score: number; analogy_score: number; reading_score: number; grammar_score: number; lessons: { title: string }; created_at: string }
interface Homework { id: string; title: string; description: string; due_date: string; lesson_id: string; homework_submissions: { student_id: string }[] }
interface PracticeTest { id: string; title: string; subject: string; practice_results: { score: number; student_id: string }[] }

type TabId = 'home' | 'schedule' | 'tests' | 'results' | 'homework' | 'attendance'

// ─── Sub-components ───────────────────────────────────────────────────────────
function ScoreRing({ score, size = 64 }: { score: number; size?: number }) {
  const r = (size - 8) / 2
  const circ = 2 * Math.PI * r
  const pct = Math.min(Math.max(score / 145, 0), 1)
  const color = score >= 110 ? '#10B981' : score >= 80 ? '#F59E0B' : '#EF4444'
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#E8ECF0" strokeWidth="6"/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="6"
        strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)} strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.6s ease' }}/>
      <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle"
        style={{ transform: 'rotate(90deg)', transformOrigin: 'center', fill: '#111827', fontSize: size * 0.22 + 'px', fontWeight: '800', fontFamily: 'Inter, sans-serif' }}>
        {Math.round(score)}
      </text>
    </svg>
  )
}

function PBar({ value, max, color = '#1B4FD8', h = 6 }: { value: number; max: number; color?: string; h?: number }) {
  return (
    <div style={{ background: '#E8ECF0', borderRadius: 999, height: h, overflow: 'hidden' }}>
      <div style={{ width: `${max > 0 ? Math.min((value / max) * 100, 100) : 0}%`, height: '100%', background: color, borderRadius: 999, transition: 'width 0.6s ease' }} />
    </div>
  )
}

function Empty({ icon: Icon, title, subtitle }: { icon: any; title: string; subtitle: string }) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #E8ECF0', padding: '40px 20px', textAlign: 'center' as const }}>
      <Icon size={32} color="#D1D5DB" style={{ margin: '0 auto 10px' }} />
      <div style={{ fontWeight: 700, fontSize: 14, color: '#111827', marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 13, color: '#9CA3AF', maxWidth: 240, margin: '0 auto' }}>{subtitle}</div>
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
  if (loading) return <div style={{ color: '#9CA3AF', padding: '32px', textAlign: 'center' as const, fontSize: 14 }}>Жүктөлүүдө...</div>
  if (tests.length === 0) return <Empty icon={FileText} title="Тесттер жок" subtitle="Администратор тест кошкондон кийин пайда болот" />
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {tests.map(t => {
        const myResult = t.practice_results?.find(r => r.student_id === userId)
        const subjectLabel = t.subject === 'math' ? 'Математика' : t.subject === 'kyr' ? 'Кыргыз тили' : t.subject
        const subjectColor = t.subject === 'math' ? '#1B4FD8' : '#7C3AED'
        const subjectBg = t.subject === 'math' ? '#EEF2FF' : '#F5F3FF'
        return (
          <div key={t.id} style={{ background: '#fff', borderRadius: 14, border: '1px solid #E8ECF0', padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#111827', marginBottom: 4 }}>{t.title}</div>
                <span style={{ background: subjectBg, color: subjectColor, fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 20 }}>{subjectLabel}</span>
              </div>
              {myResult && (
                <div style={{ textAlign: 'center' as const, flexShrink: 0 }}>
                  <div style={{ fontWeight: 900, fontSize: 18, color: myResult.score >= 70 ? '#10B981' : '#F59E0B' }}>{myResult.score}%</div>
                  <div style={{ fontSize: 10, color: '#9CA3AF' }}>Натыйжа</div>
                </div>
              )}
            </div>
            <button onClick={() => router.push(`/student/test?id=${t.id}`)}
              style={{ width: '100%', background: myResult ? '#F9FAFB' : '#1B4FD8', color: myResult ? '#1B4FD8' : '#fff', border: myResult ? '1.5px solid #1B4FD8' : 'none', borderRadius: 10, padding: '10px', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'Inter, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
              {myResult ? <><ChevronRight size={14} /> Кайра аракет</> : <>Баштоо <ChevronRight size={14} /></>}
            </button>
          </div>
        )
      })}
    </div>
  )
}

const BLUE = '#1B4FD8'
const BG   = '#F4F6FA'

// ─── NAV ─────────────────────────────────────────────────────────────────────
const NAV_ITEMS: { id: TabId; label: string; Icon: any }[] = [
  { id: 'home',       label: 'Башкы бет',    Icon: Home },
  { id: 'schedule',   label: 'Программа',    Icon: Calendar },
  { id: 'tests',      label: 'Тесттер',       Icon: FileText },
  { id: 'results',    label: 'Натыйжалар',   Icon: BarChart2 },
  { id: 'homework',   label: 'Тапшырмалар',  Icon: BookOpen },
  { id: 'attendance', label: 'Катышуу',       Icon: CheckSquare },
]

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function StudentPage() {
  const [activeTab, setActiveTab] = useState<TabId>('home')
  const [profile, setProfile]     = useState<Profile | null>(null)
  const [lessons, setLessons]     = useState<Lesson[]>([])
  const [attendance, setAttendance] = useState<Attendance[]>([])
  const [results, setResults]     = useState<TestResult[]>([])
  const [homeworks, setHomeworks] = useState<Homework[]>([])
  const [loading, setLoading]     = useState(true)
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

  const presentCount = attendance.filter(a => a.status === 'present').length
  const attendancePct = attendance.length > 0 ? Math.round((presentCount / attendance.length) * 100) : 0
  const completedLessons = attendance.filter(a => a.status !== 'absent').length
  const avgScore = results.length > 0 ? results.reduce((s, r) => s + r.total_score, 0) / results.length : 0
  const pendingHW = homeworks.filter(hw => !hw.homework_submissions?.some(s => s.student_id === profile?.id)).length
  const lastResult = results[0]

  const navTo = (id: TabId) => { setActiveTab(id); setSidebarOpen(false) }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: BG, fontFamily: 'Inter, sans-serif' }}>
      <div style={{ color: '#9CA3AF', fontSize: 14 }}>Жүктөлүүдө...</div>
    </div>
  )

  const SidebarContent = () => (
    <>
      <div style={{ padding: '18px 16px 14px', borderBottom: '1px solid #E8ECF0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{ width: 30, height: 30, background: BLUE, borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
            <img src="/images/logo.png" alt="Z" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 14, color: '#111827', letterSpacing: '-0.3px' }}>Zhangak</div>
            <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 500 }}>ЖРТ платформасы</div>
          </div>
        </div>
      </div>

      <div style={{ padding: '12px 14px', borderBottom: '1px solid #E8ECF0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{ width: 34, height: 34, background: 'linear-gradient(135deg,#1B4FD8,#6366F1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 13, flexShrink: 0 }}>
            {profile?.full_name?.[0]}
          </div>
          <div style={{ overflow: 'hidden', flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 12, color: '#111827', whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis' }}>{profile?.full_name}</div>
            <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>Оффлайн студент</div>
          </div>
        </div>
      </div>

      <nav style={{ padding: '8px 8px', flex: 1, overflowY: 'auto' as const }}>
        {NAV_ITEMS.map(({ id, Icon, label }) => {
          const active = activeTab === id
          return (
            <button key={id} onClick={() => navTo(id)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', marginBottom: 1, textAlign: 'left' as const, background: active ? '#EEF2FF' : 'transparent', color: active ? BLUE : '#6B7280', fontWeight: active ? 600 : 400, fontSize: 13, transition: 'all 0.15s', fontFamily: 'Inter, sans-serif', position: 'relative' as const }}>
              <Icon size={16} strokeWidth={active ? 2.5 : 2} />
              {label}
              {id === 'homework' && pendingHW > 0 && (
                <span style={{ marginLeft: 'auto', background: '#EF4444', color: '#fff', borderRadius: 20, padding: '1px 6px', fontSize: 10, fontWeight: 800 }}>{pendingHW}</span>
              )}
            </button>
          )
        })}
      </nav>

      <div style={{ padding: '8px', borderTop: '1px solid #E8ECF0' }}>
        <button onClick={async () => { await supabase.auth.signOut(); router.push('/') }}
          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'transparent', color: '#9CA3AF', fontSize: 13, fontWeight: 500, fontFamily: 'Inter, sans-serif' }}>
          <LogOut size={16} /> Чыгуу
        </button>
      </div>
    </>
  )

  return (
    <div style={{ minHeight: '100vh', background: BG, fontFamily: 'Inter, -apple-system, sans-serif', color: '#111827', display: 'flex' }}>
      <style>{`
        *{box-sizing:border-box}
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
        .fade{animation:fadeUp 0.28s ease both}
        @media(hover:hover){.ch:hover{opacity:0.85}}
        .desktop-sb{display:flex;flex-direction:column}
        .mobile-bar{display:none}
        .main{margin-left:210px}
        @media(max-width:768px){
          .desktop-sb{display:none!important}
          .mobile-bar{display:flex!important}
          .main{margin-left:0!important}
          .pad{padding:16px 14px 76px!important;padding-top:62px!important}
          .g4{grid-template-columns:1fr 1fr!important;gap:10px!important}
          .g2{grid-template-columns:1fr!important}
          .g3{grid-template-columns:1fr 1fr 1fr!important;gap:8px!important}
          .g4r{grid-template-columns:1fr 1fr!important;gap:8px!important}
          .rb{flex-direction:column!important}
          .last-inner{flex-direction:column!important;gap:12px!important}
          .score-wrap{display:flex!important;align-items:center!important;gap:12px!important}
        }
        .bnav{display:none}
        @media(max-width:768px){.bnav{display:flex!important;position:fixed;bottom:0;left:0;right:0;background:#fff;border-top:1px solid #E8ECF0;z-index:200;padding-bottom:env(safe-area-inset-bottom)}}
      `}</style>

      {/* Desktop Sidebar */}
      <aside className="desktop-sb" style={{ width: 210, background: '#fff', borderRight: '1px solid #E8ECF0', position: 'fixed', top: 0, left: 0, height: '100vh', zIndex: 200 }}>
        <SidebarContent />
      </aside>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <>
          <div onClick={() => setSidebarOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 300 }} />
          <aside style={{ width: 230, background: '#fff', display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, left: 0, height: '100vh', zIndex: 400, boxShadow: '4px 0 20px rgba(0,0,0,0.12)' }}>
            <SidebarContent />
          </aside>
        </>
      )}

      {/* Mobile topbar */}
      <div className="mobile-bar" style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 52, background: '#fff', borderBottom: '1px solid #E8ECF0', display: 'none', alignItems: 'center', justifyContent: 'space-between', padding: '0 14px', zIndex: 150 }}>
        <button onClick={() => setSidebarOpen(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#111827', display: 'flex' }}><Menu size={20} /></button>
        <span style={{ fontWeight: 800, fontSize: 14, color: BLUE }}>Zhangak</span>
        <div style={{ width: 28 }} />
      </div>

      {/* Main */}
      <main className="main" style={{ flex: 1 }}>
        <div className="pad" style={{ maxWidth: 840, margin: '0 auto', padding: '28px 24px 40px' }}>

          {/* ══ HOME ══ */}
          {activeTab === 'home' && (
            <div className="fade">
              <div style={{ marginBottom: 20 }}>
                <h1 style={{ fontSize: 'clamp(18px,4vw,21px)', fontWeight: 800, margin: 0, letterSpacing: '-0.4px' }}>
                  Саламатсызбы, {profile?.full_name?.split(' ')[0]}
                </h1>
                <p style={{ color: '#6B7280', fontSize: 13, margin: '4px 0 0' }}>ЖРТга чейин аракет улантылат</p>
              </div>

              {/* Stats */}
              <div className="g4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 12 }}>
                {[
                  { label: 'Катышуу', val: `${attendancePct}%`, sub: `${presentCount}/${attendance.length} сабак`, color: '#10B981' },
                  { label: 'Орточо балл', val: avgScore > 0 ? avgScore.toFixed(1) : '—', sub: results.length > 0 ? `${results.length} тест` : 'жок', color: BLUE },
                  { label: 'Прогресс', val: `${completedLessons}/${lessons.length}`, sub: 'сабак аяктады', color: '#7C3AED' },
                  { label: 'Тапшырма', val: pendingHW > 0 ? String(pendingHW) : '✓', sub: pendingHW > 0 ? 'күтүп жатат' : 'баары тапшырылды', color: pendingHW > 0 ? '#EF4444' : '#10B981' },
                ].map(s => (
                  <div key={s.label} style={{ background: '#fff', border: '1px solid #E8ECF0', borderRadius: 14, padding: '14px 12px' }}>
                    <div style={{ fontWeight: 800, fontSize: 22, color: s.color, letterSpacing: '-0.5px' }}>{s.val}</div>
                    <div style={{ fontSize: 11, color: '#111827', fontWeight: 600, marginTop: 3 }}>{s.label}</div>
                    <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 2 }}>{s.sub}</div>
                  </div>
                ))}
              </div>

              {/* Course progress */}
              {lessons.length > 0 && (
                <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #E8ECF0', padding: '14px 16px', marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <TrendingUp size={15} color="#6B7280" />
                      <span style={{ fontWeight: 600, fontSize: 13 }}>Курстун прогрессу</span>
                    </div>
                    <span style={{ fontWeight: 700, fontSize: 13, color: BLUE }}>{completedLessons}/{lessons.length}</span>
                  </div>
                  <PBar value={completedLessons} max={lessons.length} color={BLUE} h={7} />
                  <div style={{ marginTop: 6, fontSize: 12, color: '#6B7280' }}>
                    {lessons.length - completedLessons > 0 ? `Калды: ${lessons.length - completedLessons} сабак` : 'Бардык сабактар аяктады'}
                  </div>
                </div>
              )}

              {/* Last result */}
              {lastResult && (
                <div style={{ background: 'linear-gradient(135deg,#1B4FD8,#6366F1)', borderRadius: 14, padding: '18px', color: '#fff', marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.7, marginBottom: 10, textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>Акыркы тест натыйжасы</div>
                  <div className="last-inner" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div className="score-wrap">
                      <ScoreRing score={lastResult.total_score} size={56} />
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 3 }}>{lastResult.lessons?.title}</div>
                        <div style={{ opacity: 0.7, fontSize: 12 }}>{new Date(lastResult.created_at).toLocaleDateString('ru', { day: 'numeric', month: 'long' })}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
                      {[
                        { label: 'Мат', val: lastResult.math_score },
                        { label: 'Анал', val: lastResult.analogy_score },
                        { label: 'Окуу', val: lastResult.reading_score },
                        { label: 'Грам', val: lastResult.grammar_score },
                      ].map(s => (
                        <div key={s.label} style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 8, padding: '4px 9px', textAlign: 'center' as const }}>
                          <div style={{ fontSize: 14, fontWeight: 800 }}>{s.val}</div>
                          <div style={{ fontSize: 9, opacity: 0.75 }}>{s.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Quick nav */}
              <div className="g3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
                {[
                  { label: 'Программа', id: 'schedule' as TabId, Icon: Calendar, color: BLUE, bg: '#EEF2FF' },
                  { label: 'Тесттер',   id: 'tests' as TabId,    Icon: FileText, color: '#7C3AED', bg: '#F5F3FF' },
                  { label: 'Натыйжалар', id: 'results' as TabId, Icon: BarChart2, color: '#10B981', bg: '#F0FDF4' },
                ].map(a => (
                  <div key={a.id} className="ch" onClick={() => navTo(a.id)}
                    style={{ background: a.bg, borderRadius: 12, padding: '14px 10px', textAlign: 'center' as const, cursor: 'pointer', border: `1px solid ${a.color}20`, transition: 'opacity 0.15s' }}>
                    <a.Icon size={20} color={a.color} style={{ margin: '0 auto 6px', display: 'block' }} />
                    <div style={{ fontSize: 11, fontWeight: 600, color: a.color }}>{a.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ══ SCHEDULE ══ */}
          {activeTab === 'schedule' && (
            <div className="fade">
              <div style={{ marginBottom: 18 }}>
                <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0, letterSpacing: '-0.3px' }}>Сабак программасы</h2>
                <p style={{ color: '#9CA3AF', fontSize: 12, margin: '4px 0 0' }}>{lessons.length} сабак · {lessons.filter(l => l.is_test).length} тест</p>
              </div>
              {lessons.length === 0
                ? <Empty icon={Calendar} title="Сабактар жок" subtitle="Программа кошулгандан кийин пайда болот" />
                : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {lessons.map(l => {
                      const att = attendance.find(a => (a.lessons as any)?.lesson_number === l.lesson_number)
                      return (
                        <div key={l.id} style={{ background: '#fff', borderRadius: 12, border: '1px solid #E8ECF0', overflow: 'hidden', display: 'flex' }}>
                          <div style={{ width: 4, background: l.is_test ? '#7C3AED' : BLUE, flexShrink: 0 }} />
                          <div style={{ padding: '12px 14px', flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 7 }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                                  <span style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF' }}>#{l.lesson_number}</span>
                                  {l.is_test && <span style={{ background: '#F5F3FF', color: '#7C3AED', fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 20 }}>ТЕСТ</span>}
                                </div>
                                <div style={{ fontWeight: 600, fontSize: 13, color: '#111827', lineHeight: 1.3 }}>{l.title}</div>
                              </div>
                              {att && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, flexShrink: 0,
                                  background: att.status === 'present' ? '#F0FDF4' : att.status === 'late' ? '#FFF7ED' : '#FEF2F2',
                                  color: att.status === 'present' ? '#10B981' : att.status === 'late' ? '#F59E0B' : '#EF4444' }}>
                                  {att.status === 'present' ? <CheckCircle size={10} /> : att.status === 'late' ? <Clock size={10} /> : <XCircle size={10} />}
                                  {att.status === 'present' ? 'Катышты' : att.status === 'late' ? 'Кечигди' : 'Жок'}
                                </div>
                              )}
                            </div>
                            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' as const }}>
                              {[
                                { text: l.math_topic, color: '#1B4FD8', bg: '#EEF2FF' },
                                { text: l.kyr_topic,  color: '#7C3AED', bg: '#F5F3FF' },
                                { text: l.reading_topic, color: '#059669', bg: '#F0FDF4' },
                              ].filter(t => t.text).map((t, i) => (
                                <div key={i} style={{ padding: '2px 8px', background: t.bg, borderRadius: 6 }}>
                                  <span style={{ fontSize: 11, color: t.color, fontWeight: 600 }}>{t.text}</span>
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

          {/* ══ TESTS ══ */}
          {activeTab === 'tests' && profile && (
            <div className="fade">
              <div style={{ marginBottom: 18 }}>
                <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0, letterSpacing: '-0.3px' }}>Практикалык тесттер</h2>
                <p style={{ color: '#9CA3AF', fontSize: 12, margin: '4px 0 0' }}>Каалаган убакта тапшыр</p>
              </div>
              <TestsTab userId={profile.id} />
            </div>
          )}

          {/* ══ RESULTS ══ */}
          {activeTab === 'results' && (
            <div className="fade">
              <div style={{ marginBottom: 18 }}>
                <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0, letterSpacing: '-0.3px' }}>Менин натыйжаларым</h2>
                <p style={{ color: '#9CA3AF', fontSize: 12, margin: '4px 0 0' }}>
                  {results.length > 0 ? `${results.length} тест · Орточо: ${avgScore.toFixed(1)} балл` : 'Тест жок'}
                </p>
              </div>
              {results.length === 0
                ? <Empty icon={BarChart2} title="Натыйжа жок" subtitle="Тесттен өткөндөн кийин пайда болот" />
                : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {results.map((r, idx) => (
                      <div key={r.id} style={{ background: '#fff', borderRadius: 14, border: '1px solid #E8ECF0', padding: 16, position: 'relative' as const, overflow: 'hidden' }}>
                        {idx === 0 && (
                          <div style={{ position: 'absolute' as const, top: 12, right: 12, background: '#FEF3C7', color: '#D97706', fontSize: 9, fontWeight: 800, padding: '2px 8px', borderRadius: 20 }}>АКЫРКЫ</div>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                          <ScoreRing score={r.total_score} size={52} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: 14, color: '#111827', marginBottom: 3, lineHeight: 1.3 }}>{r.lessons?.title}</div>
                            <div style={{ fontSize: 11, color: '#9CA3AF' }}>{new Date(r.created_at).toLocaleDateString('ru', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                          </div>
                        </div>
                        <div className="g4r" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
                          {[
                            { label: 'Математика', val: r.math_score, mult: 1.12, color: BLUE, bg: '#EEF2FF' },
                            { label: 'Аналогия', val: r.analogy_score, mult: 2, color: '#7C3AED', bg: '#F5F3FF' },
                            { label: 'Чтение', val: r.reading_score, mult: 2, color: '#059669', bg: '#F0FDF4' },
                            { label: 'Грамматика', val: r.grammar_score, mult: 1.93, color: '#D97706', bg: '#FFF7ED' },
                          ].map(s => (
                            <div key={s.label} style={{ background: s.bg, borderRadius: 10, padding: '10px 8px', textAlign: 'center' as const }}>
                              <div style={{ fontSize: 9, color: s.color, fontWeight: 700, marginBottom: 3, textTransform: 'uppercase' as const }}>{s.label}</div>
                              <div style={{ fontWeight: 900, fontSize: 18, color: '#111827' }}>{s.val}</div>
                              <div style={{ fontSize: 9, color: '#9CA3AF', marginTop: 1 }}>={(s.val * s.mult).toFixed(1)}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
            </div>
          )}

          {/* ══ HOMEWORK ══ */}
          {activeTab === 'homework' && (
            <div className="fade">
              <div style={{ marginBottom: 18 }}>
                <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0, letterSpacing: '-0.3px' }}>Үй тапшырмалар</h2>
                <p style={{ color: '#9CA3AF', fontSize: 12, margin: '4px 0 0' }}>
                  {pendingHW > 0 ? `${pendingHW} тапшырма күтүп жатат` : 'Бардыгы тапшырылды'}
                </p>
              </div>
              {homeworks.length === 0
                ? <Empty icon={BookOpen} title="Тапшырма жок" subtitle="Мугалим тапшырма берсе пайда болот" />
                : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {homeworks.map(hw => {
                      const submitted = hw.homework_submissions?.some(s => s.student_id === profile?.id)
                      const overdue = !submitted && hw.due_date && new Date(hw.due_date) < new Date()
                      return (
                        <div key={hw.id} style={{ background: '#fff', borderRadius: 12, border: `1px solid ${overdue ? '#FECACA' : submitted ? '#BBF7D0' : '#E8ECF0'}`, padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: 13, color: '#111827', marginBottom: 3 }}>{hw.title}</div>
                            {hw.description && <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 3, lineHeight: 1.4 }}>{hw.description}</div>}
                            {hw.due_date && (
                              <div style={{ fontSize: 11, color: overdue ? '#EF4444' : '#9CA3AF', fontWeight: overdue ? 700 : 400, display: 'flex', alignItems: 'center', gap: 4 }}>
                                {overdue ? <AlertCircle size={11} /> : <Clock size={11} />}
                                {new Date(hw.due_date).toLocaleDateString('ru', { day: 'numeric', month: 'long' })}
                                {overdue ? ' — мөөнөт өттү' : ''}
                              </div>
                            )}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, flexShrink: 0, whiteSpace: 'nowrap' as const,
                            background: submitted ? '#F0FDF4' : overdue ? '#FEF2F2' : '#FFFBEB',
                            color: submitted ? '#10B981' : overdue ? '#EF4444' : '#D97706' }}>
                            {submitted ? <CheckCircle size={12} /> : overdue ? <XCircle size={12} /> : <Clock size={12} />}
                            {submitted ? 'Тапшырылды' : overdue ? 'Кечикти' : 'Күтүүдө'}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
            </div>
          )}

          {/* ══ ATTENDANCE ══ */}
          {activeTab === 'attendance' && (
            <div className="fade">
              <div style={{ marginBottom: 18 }}>
                <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0, letterSpacing: '-0.3px' }}>Катышуу</h2>
                <p style={{ color: '#9CA3AF', fontSize: 12, margin: '4px 0 0' }}>{attendancePct}% жалпы катышуу</p>
              </div>

              <div className="g3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 12 }}>
                {[
                  { label: 'Катышты', val: attendance.filter(a => a.status === 'present').length, color: '#10B981', Icon: CheckCircle },
                  { label: 'Кечигди', val: attendance.filter(a => a.status === 'late').length, color: '#F59E0B', Icon: Clock },
                  { label: 'Жок болду', val: attendance.filter(a => a.status === 'absent').length, color: '#EF4444', Icon: XCircle },
                ].map(s => (
                  <div key={s.label} style={{ background: '#fff', borderRadius: 12, border: '1px solid #E8ECF0', padding: '14px 10px', textAlign: 'center' as const }}>
                    <s.Icon size={18} color={s.color} style={{ margin: '0 auto 6px', display: 'block' }} />
                    <div style={{ fontWeight: 800, fontSize: 22, color: s.color }}>{s.val}</div>
                    <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 3 }}>{s.label}</div>
                  </div>
                ))}
              </div>

              <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E8ECF0', padding: '14px 16px', marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>Жалпы катышуу</span>
                  <span style={{ fontWeight: 700, fontSize: 13, color: attendancePct >= 80 ? '#10B981' : '#EF4444' }}>{attendancePct}%</span>
                </div>
                <PBar value={presentCount} max={attendance.length} color={attendancePct >= 80 ? '#10B981' : '#EF4444'} h={7} />
              </div>

              {attendance.length === 0
                ? <Empty icon={CheckSquare} title="Маалымат жок" subtitle="Сабактарга катышкандан кийин пайда болот" />
                : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {attendance.map(a => (
                      <div key={a.id} style={{ background: '#fff', borderRadius: 10, border: '1px solid #E8ECF0', padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                        <div style={{ fontWeight: 500, fontSize: 13, color: '#111827', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                          <span style={{ color: '#9CA3AF', marginRight: 6, fontSize: 11 }}>#{a.lessons?.lesson_number}</span>
                          {a.lessons?.title}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 20, fontSize: 10, fontWeight: 700, flexShrink: 0, whiteSpace: 'nowrap' as const,
                          background: a.status === 'present' ? '#F0FDF4' : a.status === 'late' ? '#FFF7ED' : '#FEF2F2',
                          color: a.status === 'present' ? '#10B981' : a.status === 'late' ? '#F59E0B' : '#EF4444' }}>
                          {a.status === 'present' ? <CheckCircle size={10} /> : a.status === 'late' ? <Clock size={10} /> : <XCircle size={10} />}
                          {a.status === 'present' ? 'Катышты' : a.status === 'late' ? 'Кечигди' : 'Жок'}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
            </div>
          )}

        </div>
      </main>

      {/* Bottom Nav */}
      <div className="bnav" style={{ display: 'none' }}>
        {NAV_ITEMS.map(({ id, Icon, label }) => {
          const active = activeTab === id
          return (
            <button key={id} onClick={() => navTo(id)}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '7px 4px', border: 'none', background: 'transparent', cursor: 'pointer', color: active ? BLUE : '#9CA3AF', minWidth: 0, position: 'relative' as const }}>
              <Icon size={20} strokeWidth={active ? 2.5 : 1.8} />
              <div style={{ fontSize: 9, fontWeight: active ? 700 : 500, marginTop: 3, whiteSpace: 'nowrap' as const }}>{label}</div>
              {id === 'homework' && pendingHW > 0 && (
                <div style={{ position: 'absolute' as const, top: 4, right: '15%', background: '#EF4444', color: '#fff', borderRadius: 20, padding: '1px 5px', fontSize: 9, fontWeight: 800 }}>{pendingHW}</div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}