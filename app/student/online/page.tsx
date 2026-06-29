'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Profile {
  id: string; full_name: string; phone: string
  class_number: number; goal_score: number; student_type: string
  school: string; streak_days: number; last_active: string
}
interface MockTest {
  id: string; title: string; subject: 'math' | 'kyr'
  time_limit_minutes: number; max_attempts: number; is_active: boolean
}
interface PracticeLesson {
  id: string; title: string; subject: 'math' | 'kyr'
  video_url: string; description: string; order_number: number
}
interface PracticeTest {
  id: string; lesson_id: string; title: string
  time_limit_minutes: number | null
}
interface Question {
  id: string; question_text: string; image_url: string
  option_a: string; option_b: string; option_c: string; option_d: string
  correct_answer: string; order_num: number
  section: 'comparison' | 'math' | 'analogy' | 'reading' | 'grammar' | 'general'
}
interface MockResult {
  id: string; test_id: string; attempt_number: number
  math_comparison_score: number; math_raw_score: number
  analogy_score: number; reading_score: number; grammar_score: number
  total_score: number; created_at: string
}
interface PracticeResult {
  id: string; test_id: string; score: number; total: number
  passed: boolean; created_at: string; lesson_id: string
}

type View = 'dashboard' | 'mock_list' | 'mock_intro' | 'mock_test' | 'mock_result'
         | 'practice' | 'lesson' | 'practice_test' | 'practice_result'
         | 'analytics' | 'profile' | 'settings' | 'mistakes'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function calcScore(math: number, analogy: number, reading: number, grammar: number) {
  return Math.round(math * 1.12 + analogy * 2 + reading * 2 + grammar * 1.93)
}
function getEmbed(url: string) {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/)
  return m ? `https://www.youtube.com/embed/${m[1]}?rel=0` : url
}
function daysUntilJRT() {
  const next = new Date('2027-05-17')
  return Math.ceil((next.getTime() - Date.now()) / 86400000)
}
function getStreakDays(results: MockResult[], pResults: PracticeResult[]): number {
  const allDates = [...results.map(r => r.created_at), ...pResults.map(r => r.created_at)]
    .map(d => new Date(d).toDateString())
  const unique = [...new Set(allDates)].sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
  let streak = 0
  const today = new Date().toDateString()
  const yesterday = new Date(Date.now() - 86400000).toDateString()
  if (!unique.includes(today) && !unique.includes(yesterday)) return 0
  for (let i = 0; i < unique.length; i++) {
    const expected = new Date(Date.now() - i * 86400000).toDateString()
    if (unique[i] === expected) streak++
    else break
  }
  return streak
}
function getCalendarDays(results: MockResult[], pResults: PracticeResult[]) {
  const activeDates = new Set([
    ...results.map(r => new Date(r.created_at).toDateString()),
    ...pResults.map(r => new Date(r.created_at).toDateString()),
  ])
  const days = []
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000)
    days.push({ date: d.toDateString(), day: d.getDate(), active: activeDates.has(d.toDateString()) })
  }
  return days
}

// ─── Timer ────────────────────────────────────────────────────────────────────
function useTimer(seconds: number, onEnd: () => void) {
  const [left, setLeft] = useState(seconds)
  const ref = useRef<ReturnType<typeof setInterval> | null>(null)
  const started = useRef(false)
  const start = () => {
    if (started.current) return
    started.current = true
    ref.current = setInterval(() => {
      setLeft(p => { if (p <= 1) { clearInterval(ref.current!); onEnd(); return 0 } return p - 1 })
    }, 1000)
  }
  useEffect(() => () => { if (ref.current) clearInterval(ref.current) }, [])
  return { left, start }
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function TimerBar({ left, total }: { left: number; total: number }) {
  const mm = Math.floor(left / 60), ss = String(left % 60).padStart(2, '0')
  const crit = left < 600
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ fontSize: 18, fontWeight: 900, color: crit ? '#EF4444' : '#1B4FD8', minWidth: 56, fontVariantNumeric: 'tabular-nums' as const }}>{mm}:{ss}</div>
      <div style={{ flex: 1, background: '#E2E8F0', borderRadius: 999, height: 6, overflow: 'hidden' }}>
        <div style={{ width: `${(left / total) * 100}%`, height: '100%', background: crit ? '#EF4444' : '#1B4FD8', borderRadius: 999, transition: 'width 1s linear' }} />
      </div>
    </div>
  )
}

function ScoreRing({ score, max = 145, size = 80 }: { score: number; max?: number; size?: number }) {
  const r = (size - 8) / 2, circ = 2 * Math.PI * r, pct = Math.min(score / max, 1)
  const color = pct >= 0.75 ? '#10B981' : pct >= 0.5 ? '#F59E0B' : '#EF4444'
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#E2E8F0" strokeWidth="7"/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="7"
        strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)} strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.8s ease' }}/>
      <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle"
        style={{ transform: 'rotate(90deg)', transformOrigin: 'center', fill: '#0D1E4A', fontSize: size * 0.22, fontWeight: 800, fontFamily: 'Inter, sans-serif' }}>
        {score}
      </text>
    </svg>
  )
}

function PBar({ value, max, color = '#1B4FD8', h = 8 }: { value: number; max: number; color?: string; h?: number }) {
  return (
    <div style={{ background: '#E2E8F0', borderRadius: 999, height: h, overflow: 'hidden' }}>
      <div style={{ width: `${max > 0 ? Math.min((value / max) * 100, 100) : 0}%`, height: '100%', background: color, borderRadius: 999, transition: 'width 0.6s ease' }} />
    </div>
  )
}

const BLUE = '#1B4FD8'
const sc = (s: 'math' | 'kyr') => s === 'math' ? '#1B4FD8' : '#7C3AED'
const sb = (s: 'math' | 'kyr') => s === 'math' ? '#EEF2FF' : '#F5F3FF'
const sl = (s: 'math' | 'kyr') => s === 'math' ? 'Математика' : 'Кыргыз тили'

const NAV_ITEMS = [
  { id: 'dashboard',  icon: '🏠', label: 'Башкы бет' },
  { id: 'mock_list',  icon: '📋', label: 'Сынамык тест' },
  { id: 'practice',   icon: '🎯', label: 'Практика' },
  { id: 'analytics',  icon: '📊', label: 'Аналитика' },
  { id: 'mistakes',   icon: '🔁', label: 'Каталар' },
  { id: 'profile',    icon: '👤', label: 'Профиль' },
  { id: 'settings',   icon: '⚙️', label: 'Орнотуулар' },
]

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function OnlineStudentPage() {
  const [profile, setProfile]   = useState<Profile | null>(null)
  const [view, setView]         = useState<View>('dashboard')
  const [loading, setLoading]   = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [mockTests, setMockTests]     = useState<MockTest[]>([])
  const [mockResults, setMockResults] = useState<MockResult[]>([])
  const [activeMock, setActiveMock]   = useState<MockTest | null>(null)
  const [mockQuestions, setMockQuestions] = useState<Question[]>([])
  const [mockAnswers, setMockAnswers] = useState<Record<string, string>>({})
  const [mockResult, setMockResult]   = useState<MockResult | null>(null)
  const [practiceSubject, setPracticeSubject] = useState<'math' | 'kyr'>('math')
  const [lessons, setLessons]     = useState<PracticeLesson[]>([])
  const [allLessons, setAllLessons] = useState<PracticeLesson[]>([])
  const [activeLesson, setActiveLesson] = useState<PracticeLesson | null>(null)
  const [practiceTests, setPracticeTests] = useState<PracticeTest[]>([])
  const [activePTest, setActivePTest] = useState<PracticeTest | null>(null)
  const [pQuestions, setPQuestions] = useState<Question[]>([])
  const [pAnswers, setPAnswers]     = useState<Record<string, string>>({})
  const [pResult, setPResult]       = useState<{ score: number; total: number; passed: boolean; wrong: number[] } | null>(null)
  const [pResults, setPResults]     = useState<PracticeResult[]>([])
  const [allPResults, setAllPResults] = useState<PracticeResult[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [editGoal, setEditGoal]     = useState('')
  const [editSchool, setEditSchool] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [mistakeQs, setMistakeQs]   = useState<Question[]>([])
  const [mistakeAns, setMistakeAns] = useState<Record<string, string>>({})
  const [mistakeDone, setMistakeDone] = useState(false)
  const [darkMode, setDarkMode]     = useState(false)
  const router = useRouter()

  useEffect(() => { checkAuth() }, [])

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (!prof || prof.role !== 'student') { router.push('/'); return }
    setProfile(prof)
    setEditGoal(String(prof.goal_score || 190))
    setEditSchool(prof.school || '')
    await Promise.all([fetchMockTests(user.id), fetchAllLessons(), fetchAllPResults(user.id)])
    setLoading(false)
  }

  const fetchMockTests = async (uid: string) => {
    const [{ data: tests }, { data: results }] = await Promise.all([
      supabase.from('practice_tests').select('*').eq('type', 'mock').eq('is_active', true).order('created_at'),
      supabase.from('practice_results').select('*').eq('student_id', uid).eq('test_type', 'mock').order('created_at'),
    ])
    setMockTests(tests || [])
    setMockResults(results || [])
  }

  const fetchAllLessons = async () => {
    const { data } = await supabase.from('practice_lessons').select('*').order('subject').order('order_number')
    setAllLessons(data || [])
  }

  const fetchAllPResults = async (uid: string) => {
    const { data } = await supabase.from('practice_results').select('*').eq('student_id', uid).eq('test_type', 'practice').order('created_at', { ascending: false })
    setAllPResults(data || [])
  }

  const fetchLessons = async (subject: 'math' | 'kyr') => {
    const { data } = await supabase.from('practice_lessons').select('*').eq('subject', subject).order('order_number')
    setLessons(data || [])
  }

  const openMock = async (test: MockTest) => {
    const { data } = await supabase.from('questions').select('*').eq('practice_test_id', test.id).order('order_num')
    setMockQuestions(data || [])
    setMockAnswers({})
    setActiveMock(test)
    setView('mock_intro')
  }

  const openLesson = async (lesson: PracticeLesson) => {
    setActiveLesson(lesson); setPResult(null); setPAnswers({})
    const [{ data: tests }, { data: results }] = await Promise.all([
      supabase.from('practice_tests').select('*').eq('lesson_id', lesson.id).eq('type', 'practice'),
      supabase.from('practice_results').select('*').eq('student_id', profile!.id).eq('lesson_id', lesson.id).order('created_at', { ascending: false }),
    ])
    setPracticeTests(tests || [])
    setPResults(results || [])
    setView('lesson')
  }

  const startPTest = async (test: PracticeTest) => {
    const { data } = await supabase.from('questions').select('*').eq('practice_test_id', test.id).order('order_num')
    setPQuestions(data || []); setPAnswers({}); setActivePTest(test); setView('practice_test')
  }

  const submitMock = async () => {
    if (!activeMock || !profile) return
    setSubmitting(true)
    const sections = {
      comparison: mockQuestions.filter(q => q.section === 'comparison'),
      math:       mockQuestions.filter(q => q.section === 'math'),
      analogy:    mockQuestions.filter(q => q.section === 'analogy'),
      reading:    mockQuestions.filter(q => q.section === 'reading'),
      grammar:    mockQuestions.filter(q => q.section === 'grammar'),
    }
    const s = (qs: Question[]) => qs.filter(q => mockAnswers[q.id] === q.correct_answer).length
    let mc = 0, mr = 0, an = 0, re = 0, gr = 0, total = 0
    if (activeMock.subject === 'math') { mc = s(sections.comparison); mr = s(sections.math); total = calcScore(mc + mr, 0, 0, 0) }
    else { an = s(sections.analogy); re = s(sections.reading); gr = s(sections.grammar); total = calcScore(0, an, re, gr) }
    const attempts = mockResults.filter(r => r.test_id === activeMock.id).length + 1
    const { data } = await supabase.from('practice_results').insert({
      student_id: profile.id, test_id: activeMock.id, test_type: 'mock',
      math_comparison_score: mc, math_raw_score: mr, analogy_score: an, reading_score: re, grammar_score: gr,
      total_score: total, attempt_number: attempts,
    }).select().single()
    if (data) setMockResult(data)
    await fetchMockTests(profile.id)
    setSubmitting(false); setView('mock_result')
  }

  const submitPractice = async () => {
    if (!activePTest || !profile || !activeLesson) return
    setSubmitting(true)
    let score = 0; const wrong: number[] = []
    pQuestions.forEach((q, i) => { if (pAnswers[q.id] === q.correct_answer) score++; else wrong.push(i) })
    const total = pQuestions.length, passed = total > 0 && score / total >= 0.7
    await supabase.from('practice_results').insert({
      student_id: profile.id, test_id: activePTest.id, lesson_id: activeLesson.id,
      test_type: 'practice', score, total, passed,
    })
    setPResult({ score, total, passed, wrong })
    await fetchAllPResults(profile.id)
    setSubmitting(false); setView('practice_result')
  }

  const loadMistakes = async () => {
    if (!profile) return
    const { data: results } = await supabase.from('practice_results').select('test_id').eq('student_id', profile.id).order('created_at', { ascending: false }).limit(10)
    if (!results?.length) return
    const ids = [...new Set(results.map(r => r.test_id))]
    const { data: qs } = await supabase.from('questions').select('*').in('practice_test_id', ids).limit(30)
    setMistakeQs(qs || []); setMistakeAns({}); setMistakeDone(false); setView('mistakes')
  }

  const saveProfile = async () => {
    if (!profile) return
    setSavingProfile(true)
    await supabase.from('profiles').update({ goal_score: Number(editGoal), school: editSchool }).eq('id', profile.id)
    setProfile(p => p ? { ...p, goal_score: Number(editGoal), school: editSchool } : p)
    setSavingProfile(false)
  }

  const navTo = (id: string) => {
    setView(id as View)
    setSidebarOpen(false)
    if (id === 'practice') fetchLessons(practiceSubject)
  }

  // ── Derived ────────────────────────────────────────────────────────────────
  const getMockAttempts = (id: string) => mockResults.filter(r => r.test_id === id).length
  const getBestMock = (id: string) => { const r = mockResults.filter(r => r.test_id === id); return r.length ? r.reduce((b, c) => c.total_score > b.total_score ? c : b) : null }
  const getLessonResult = (lid: string) => allPResults.find(r => r.lesson_id === lid)

  const avgScore  = mockResults.length ? Math.round(mockResults.reduce((s, r) => s + r.total_score, 0) / mockResults.length) : 0
  const bestScore = mockResults.length ? Math.max(...mockResults.map(r => r.total_score)) : 0
  const lastScore = mockResults.length ? mockResults[mockResults.length - 1]?.total_score : 0
  const goalScore = profile?.goal_score || 190
  const streak    = getStreakDays(mockResults, allPResults)
  const calendar  = getCalendarDays(mockResults, allPResults)

  const mathLessons = allLessons.filter(l => l.subject === 'math')
  const kyrLessons  = allLessons.filter(l => l.subject === 'kyr')
  const mathPassed  = mathLessons.filter(l => getLessonResult(l.id)?.passed).length
  const kyrPassed   = kyrLessons.filter(l => getLessonResult(l.id)?.passed).length
  const mathPct = mathLessons.length ? Math.round((mathPassed / mathLessons.length) * 100) : 0
  const kyrPct  = kyrLessons.length  ? Math.round((kyrPassed  / kyrLessons.length)  * 100) : 0

  const chartData = mockResults.slice(-8).map((r, i) => ({ name: `#${i + 1}`, балл: r.total_score }))

  const todayTasks = [
    { done: mockResults.some(r => new Date(r.created_at).toDateString() === new Date().toDateString()), label: 'Сынамык тест тапшыруу' },
    { done: allPResults.filter(r => r.lesson_id && mathLessons.find(l => l.id === r.lesson_id) && new Date(r.created_at).toDateString() === new Date().toDateString()).length > 0, label: 'Математика практикасы' },
    { done: allPResults.filter(r => r.lesson_id && kyrLessons.find(l => l.id === r.lesson_id) && new Date(r.created_at).toDateString() === new Date().toDateString()).length > 0, label: 'Кыргыз тили практикасы' },
  ]

  const dm = darkMode
  const bg    = dm ? '#0D1117' : '#F8FAFF'
  const card  = dm ? '#161B22' : '#FFFFFF'
  const border= dm ? '#30363D' : '#E2E8F0'
  const text  = dm ? '#E6EDF3' : '#0D1E4A'
  const muted = dm ? '#8B949E' : '#64748B'
  const light = dm ? '#484F58' : '#94A3B8'

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: bg, fontFamily: 'Inter, sans-serif' }}>
      <div style={{ color: light, fontSize: 14 }}>Жүктөлүүдө...</div>
    </div>
  )

  const SidebarContent = () => (
    <>
      <div style={{ padding: '20px 16px 16px', borderBottom: `1px solid ${border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, background: BLUE, borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
            <img src="/images/logo.png" alt="Z" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <div>
            <div style={{ fontWeight: 900, fontSize: 15, color: text }}>Zhangak</div>
            <div style={{ fontSize: 10, color: light }}>ЖРТ платформасы</div>
          </div>
        </div>
      </div>

      {/* Profile mini */}
      <div style={{ padding: '14px 16px', borderBottom: `1px solid ${border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, background: 'linear-gradient(135deg,#1B4FD8,#6366F1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 14, flexShrink: 0 }}>
            {profile?.full_name?.[0]}
          </div>
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{profile?.full_name}</div>
            <div style={{ fontSize: 11, color: light }}>Максат: {goalScore} балл</div>
          </div>
        </div>
        {streak > 0 && (
          <div style={{ marginTop: 10, background: dm ? '#2D2006' : '#FFF7ED', borderRadius: 8, padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 16 }}>🔥</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#D97706' }}>{streak} күн streak</span>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav style={{ padding: '10px 10px', flex: 1, overflowY: 'auto' as const }}>
        {NAV_ITEMS.map(item => {
          const active = view === item.id ||
            (item.id === 'mock_list' && ['mock_intro','mock_test','mock_result'].includes(view)) ||
            (item.id === 'practice' && ['lesson','practice_test','practice_result'].includes(view))
          return (
            <button key={item.id} onClick={() => navTo(item.id)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 11px', borderRadius: 10, border: 'none', cursor: 'pointer', marginBottom: 2, textAlign: 'left' as const, background: active ? (dm ? 'rgba(27,79,216,0.2)' : '#EEF2FF') : 'transparent', color: active ? BLUE : muted, fontWeight: active ? 700 : 500, fontSize: 13 }}>
              <span style={{ fontSize: 16 }}>{item.icon}</span>
              {item.label}
            </button>
          )
        })}
      </nav>

      <div style={{ padding: '10px', borderTop: `1px solid ${border}` }}>
        <button onClick={async () => { await supabase.auth.signOut(); router.push('/') }}
          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 11px', borderRadius: 10, border: 'none', cursor: 'pointer', background: dm ? 'rgba(239,68,68,0.1)' : '#FEF2F2', color: '#EF4444', fontSize: 13, fontWeight: 600 }}>
          🚪 Чыгуу
        </button>
      </div>
    </>
  )

  return (
    <div style={{ minHeight: '100vh', background: bg, fontFamily: 'Inter, -apple-system, sans-serif', color: text, display: 'flex' }}>
      <style>{`
        *{box-sizing:border-box}
        @keyframes fadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
        .fade{animation:fadeIn 0.3s ease both}
        @media(hover:hover){.ch:hover{transform:translateY(-2px)!important;box-shadow:0 6px 20px rgba(27,79,216,0.1)!important}}
        .ch{transition:all 0.2s}
        .desktop-sidebar{display:flex;flex-direction:column}
        .mobile-topbar{display:none}
        .main-content{margin-left:220px}
        @media(max-width:768px){
          .desktop-sidebar{display:none!important}
          .mobile-topbar{display:flex!important}
          .main-content{margin-left:0!important}
          .content-pad{padding:16px 14px 80px!important;padding-top:66px!important}
          .stats-g{grid-template-columns:1fr 1fr!important;gap:10px!important}
          .prog-g{grid-template-columns:1fr!important}
          .mock-g{grid-template-columns:1fr!important}
          .lesson-g{grid-template-columns:1fr!important}
          .score-g{grid-template-columns:1fr 1fr!important}
          .rb{flex-direction:column!important}
          .rb button,.rb a{width:100%!important}
          .dash-g{grid-template-columns:1fr 1fr!important}
          .cal-grid{grid-template-columns:repeat(10,1fr)!important}
        }
        .bnav{display:none}
        @media(max-width:768px){.bnav{display:flex!important;position:fixed;bottom:0;left:0;right:0;background:${card};border-top:1px solid ${border};z-index:200;padding-bottom:env(safe-area-inset-bottom)}}
      `}</style>

      {/* ── Desktop Sidebar ── */}
      <aside className="desktop-sidebar" style={{ width: 220, background: card, borderRight: `1px solid ${border}`, position: 'fixed', top: 0, left: 0, height: '100vh', zIndex: 200 }}>
        <SidebarContent />
      </aside>

      {/* ── Mobile overlay ── */}
      {sidebarOpen && (
        <>
          <div onClick={() => setSidebarOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 300 }} />
          <aside style={{ width: 240, background: card, display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, left: 0, height: '100vh', zIndex: 400, boxShadow: '4px 0 24px rgba(0,0,0,0.15)' }}>
            <SidebarContent />
          </aside>
        </>
      )}

      {/* ── Mobile topbar ── */}
      <div className="mobile-topbar" style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 54, background: card, borderBottom: `1px solid ${border}`, display: 'none', alignItems: 'center', justifyContent: 'space-between', padding: '0 14px', zIndex: 150 }}>
        <button onClick={() => setSidebarOpen(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: text }}>☰</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 26, height: 26, background: BLUE, borderRadius: 6, overflow: 'hidden' }}>
            <img src="/images/logo.png" alt="Z" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <span style={{ fontWeight: 900, fontSize: 15, color: BLUE }}>Zhangak</span>
        </div>
        <div style={{ width: 28 }} />
      </div>

      {/* ── Main ── */}
      <main className="main-content" style={{ flex: 1, minHeight: '100vh' }}>
        <div className="content-pad" style={{ maxWidth: 860, margin: '0 auto', padding: '28px 28px 40px' }}>

          {/* ══ DASHBOARD ══ */}
          {view === 'dashboard' && (
            <div className="fade">
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, gap: 12, flexWrap: 'wrap' as const }}>
                <div>
                  <h1 style={{ fontSize: 'clamp(18px,4vw,22px)', fontWeight: 900, margin: 0 }}>
                    Саламатсызбы, {profile?.full_name?.split(' ')[0]} 👋
                  </h1>
                  <p style={{ color: muted, fontSize: 13, margin: '4px 0 0' }}>ЖРТга даярдануу платформасы</p>
                </div>
                <div style={{ background: 'linear-gradient(135deg,#1B4FD8,#6366F1)', borderRadius: 14, padding: '10px 18px', textAlign: 'center', flexShrink: 0 }}>
                  <div style={{ fontWeight: 900, fontSize: 26, color: '#fff' }}>{daysUntilJRT()}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', fontWeight: 600 }}>күн калды</div>
                </div>
              </div>

              {/* Stats */}
              <div className="stats-g" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 14 }}>
                {[
                  { label: 'Акыркы балл', val: lastScore || '—', color: BLUE, icon: '📝' },
                  { label: 'Орточо', val: avgScore || '—', color: '#10B981', icon: '📊' },
                  { label: 'Эң жогорку', val: bestScore || '—', color: '#F59E0B', icon: '🏆' },
                  { label: 'Максат', val: goalScore, color: '#7C3AED', icon: '🎯' },
                ].map(s => (
                  <div key={s.label} style={{ background: card, border: `1px solid ${border}`, borderRadius: 14, padding: '14px 12px' }}>
                    <div style={{ fontSize: 18, marginBottom: 6 }}>{s.icon}</div>
                    <div style={{ fontWeight: 900, fontSize: 22, color: s.color }}>{s.val}</div>
                    <div style={{ fontSize: 11, color: light, marginTop: 2 }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Goal progress */}
              {lastScore > 0 && (
                <div style={{ background: card, borderRadius: 14, border: `1px solid ${border}`, padding: '16px 18px', marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: text }}>Максатка жакындоо</div>
                      <div style={{ fontSize: 12, color: muted, marginTop: 2 }}>Азыр: {lastScore} · Максат: {goalScore} · Дагы: {Math.max(goalScore - lastScore, 0)} балл</div>
                    </div>
                    <div style={{ fontWeight: 900, fontSize: 18, color: lastScore >= goalScore ? '#10B981' : BLUE }}>
                      {Math.round((lastScore / goalScore) * 100)}%
                    </div>
                  </div>
                  <PBar value={lastScore} max={goalScore} color={lastScore >= goalScore ? '#10B981' : BLUE} h={10} />
                </div>
              )}

              {/* Streak + Today */}
              <div className="prog-g" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                {/* Streak */}
                <div style={{ background: card, borderRadius: 14, border: `1px solid ${border}`, padding: '16px 18px' }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: text, marginBottom: 10 }}>
                    {streak > 0 ? `🔥 ${streak} күн streak` : '📅 Streak'}
                  </div>
                  <div className="cal-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(15,1fr)', gap: 3 }}>
                    {calendar.map((d, i) => (
                      <div key={i} title={d.date}
                        style={{ aspectRatio: '1', borderRadius: 3, background: d.active ? (d.date === new Date().toDateString() ? BLUE : '#93C5FD') : (dm ? '#21262D' : '#F1F5F9') }} />
                    ))}
                  </div>
                  <div style={{ fontSize: 11, color: light, marginTop: 8 }}>Акыркы 30 күн</div>
                </div>

                {/* Today's tasks */}
                <div style={{ background: card, borderRadius: 14, border: `1px solid ${border}`, padding: '16px 18px' }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: text, marginBottom: 12 }}>⏳ Бүгүнкү тапшырмалар</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {todayTasks.map((t, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 20, height: 20, borderRadius: 6, background: t.done ? '#10B981' : (dm ? '#21262D' : '#F1F5F9'), border: `2px solid ${t.done ? '#10B981' : border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {t.done && <span style={{ fontSize: 11, color: '#fff' }}>✓</span>}
                        </div>
                        <span style={{ fontSize: 12, color: t.done ? light : text, textDecoration: t.done ? 'line-through' : 'none' }}>{t.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Practice progress */}
              <div style={{ background: card, borderRadius: 14, border: `1px solid ${border}`, padding: '16px 18px', marginBottom: 14 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: text, marginBottom: 12 }}>📚 Практика прогрессу</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[
                    { label: 'Математика', passed: mathPassed, total: mathLessons.length, pct: mathPct, color: BLUE },
                    { label: 'Кыргыз тили', passed: kyrPassed, total: kyrLessons.length, pct: kyrPct, color: '#7C3AED' },
                  ].map(s => (
                    <div key={s.label}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: text }}>{s.label}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: s.color }}>{s.passed}/{s.total} · {s.pct}%</span>
                      </div>
                      <PBar value={s.passed} max={s.total || 1} color={s.color} h={7} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Score chart */}
              {chartData.length > 1 && (
                <div style={{ background: card, borderRadius: 14, border: `1px solid ${border}`, padding: '16px 18px', marginBottom: 14 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: text, marginBottom: 12 }}>📈 Баллдын өсүшү</div>
                  <ResponsiveContainer width="100%" height={130}>
                    <LineChart data={chartData}>
                      <XAxis dataKey="name" tick={{ fill: light, fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: light, fontSize: 11 }} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
                      <Tooltip contentStyle={{ background: card, border: `1px solid ${border}`, borderRadius: 10, fontSize: 12 }} formatter={(v: any) => [v + ' балл', 'Натыйжа']} />
                      <Line type="monotone" dataKey="балл" stroke={BLUE} strokeWidth={2.5} dot={{ fill: BLUE, r: 4 }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Quick actions */}
              <div className="dash-g" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 14 }}>
                {[
                  { label: 'Сынамык тест', icon: '📋', color: BLUE, bg: dm ? 'rgba(27,79,216,0.15)' : '#EEF2FF', action: () => setView('mock_list') },
                  { label: 'Практика', icon: '🎯', color: '#7C3AED', bg: dm ? 'rgba(124,58,237,0.15)' : '#F5F3FF', action: () => { setView('practice'); fetchLessons('math') } },
                  { label: 'Каталар', icon: '🔁', color: '#EF4444', bg: dm ? 'rgba(239,68,68,0.15)' : '#FEF2F2', action: loadMistakes },
                  { label: 'Аналитика', icon: '📊', color: '#10B981', bg: dm ? 'rgba(16,185,129,0.15)' : '#F0FDF4', action: () => setView('analytics') },
                ].map(a => (
                  <div key={a.label} className="ch" onClick={a.action}
                    style={{ background: a.bg, borderRadius: 12, padding: '14px 10px', textAlign: 'center' as const, cursor: 'pointer', border: `1px solid ${a.color}22` }}>
                    <div style={{ fontSize: 22, marginBottom: 5 }}>{a.icon}</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: a.color }}>{a.label}</div>
                  </div>
                ))}
              </div>

              {/* Last results */}
              {mockResults.length > 0 && (
                <div style={{ background: card, borderRadius: 14, border: `1px solid ${border}`, overflow: 'hidden' }}>
                  <div style={{ padding: '12px 18px', borderBottom: `1px solid ${border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: text }}>Акыркы натыйжалар</div>
                    <button onClick={() => setView('mock_list')} style={{ background: 'none', border: 'none', color: BLUE, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Баарын көрүү →</button>
                  </div>
                  {mockResults.slice(-5).reverse().map(r => {
                    const test = mockTests.find(t => t.id === r.test_id)
                    return (
                      <div key={r.id} style={{ display: 'flex', alignItems: 'center', padding: '10px 18px', borderBottom: `1px solid ${border}`, gap: 12 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 13, color: text, whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis' }}>{test?.title || 'Сынамык тест'}</div>
                          <div style={{ fontSize: 11, color: light, marginTop: 1 }}>{new Date(r.created_at).toLocaleDateString('ru')}</div>
                        </div>
                        <div style={{ fontWeight: 900, fontSize: 18, color: r.total_score >= goalScore ? '#10B981' : r.total_score >= 140 ? '#F59E0B' : BLUE }}>{r.total_score}</div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ══ ANALYTICS ══ */}
          {view === 'analytics' && (
            <div className="fade">
              <div style={{ marginBottom: 20 }}>
                <h2 style={{ fontSize: 20, fontWeight: 900, margin: 0, color: text }}>📊 Аналитика</h2>
                <p style={{ color: muted, fontSize: 13, margin: '4px 0 0' }}>Кайсы бөлүмдөн начар экениңди көр</p>
              </div>
              {mockResults.length === 0 ? (
                <div style={{ background: card, borderRadius: 14, border: `1px solid ${border}`, padding: '40px 20px', textAlign: 'center' as const, color: light }}>
                  <div style={{ fontSize: 32, marginBottom: 10 }}>📊</div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: text }}>Маалымат жок</div>
                  <div style={{ fontSize: 13, marginTop: 4 }}>Тест тапшыргандан кийин аналитика пайда болот</div>
                </div>
              ) : (
                <div>
                  {chartData.length > 1 && (
                    <div style={{ background: card, borderRadius: 14, border: `1px solid ${border}`, padding: '16px 18px', marginBottom: 14 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: text, marginBottom: 12 }}>📈 Динамика</div>
                      <ResponsiveContainer width="100%" height={150}>
                        <LineChart data={chartData}>
                          <XAxis dataKey="name" tick={{ fill: light, fontSize: 11 }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fill: light, fontSize: 11 }} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
                          <Tooltip contentStyle={{ background: card, border: `1px solid ${border}`, borderRadius: 10, fontSize: 12 }} formatter={(v: any) => [v + ' балл', 'Натыйжа']} />
                          <Line type="monotone" dataKey="балл" stroke={BLUE} strokeWidth={2.5} dot={{ fill: BLUE, r: 4 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  <div style={{ background: card, borderRadius: 14, border: `1px solid ${border}`, padding: '16px 18px', marginBottom: 14 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: text, marginBottom: 14 }}>Предмет боюнча орточо</div>
                    {[
                      { label: 'Математика (салыштыруу)', key: 'math_comparison_score' as keyof MockResult, max: 30, color: BLUE },
                      { label: 'Математика (чыгарма)', key: 'math_raw_score' as keyof MockResult, max: 30, color: '#0EA5E9' },
                      { label: 'Аналогия', key: 'analogy_score' as keyof MockResult, max: 30, color: '#7C3AED' },
                      { label: 'Окуу жана түшүнүү', key: 'reading_score' as keyof MockResult, max: 30, color: '#059669' },
                      { label: 'Грамматика', key: 'grammar_score' as keyof MockResult, max: 30, color: '#D97706' },
                    ].map(s => {
                      const vals = mockResults.filter(r => (r[s.key] as number) > 0).map(r => r[s.key] as number)
                      const avg = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0
                      const pct = Math.round((avg / s.max) * 100)
                      const col = pct >= 70 ? '#10B981' : pct >= 50 ? '#F59E0B' : '#EF4444'
                      return (
                        <div key={s.label} style={{ marginBottom: 12 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                            <span style={{ fontSize: 13, fontWeight: 500, color: text }}>{s.label}</span>
                            <span style={{ fontSize: 13, fontWeight: 700, color: col }}>{avg}/{s.max} · {pct}%</span>
                          </div>
                          <PBar value={avg} max={s.max} color={col} h={7} />
                        </div>
                      )
                    })}
                  </div>
                  <div className="stats-g" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
                    {[
                      { label: 'Жалпы тест', val: mockResults.length, color: BLUE },
                      { label: 'Орточо балл', val: avgScore, color: '#10B981' },
                      { label: 'Эң жогорку', val: bestScore, color: '#F59E0B' },
                    ].map(s => (
                      <div key={s.label} style={{ background: card, borderRadius: 12, border: `1px solid ${border}`, padding: 16, textAlign: 'center' as const }}>
                        <div style={{ fontWeight: 900, fontSize: 24, color: s.color }}>{s.val}</div>
                        <div style={{ fontSize: 11, color: light, marginTop: 3 }}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══ MOCK LIST ══ */}
          {view === 'mock_list' && (
            <div className="fade">
              <div style={{ marginBottom: 20 }}>
                <h2 style={{ fontSize: 20, fontWeight: 900, margin: 0, color: text }}>📋 Сынамык тесттер</h2>
                <p style={{ color: muted, fontSize: 13, margin: '4px 0 0' }}>ЖРТ форматындагы тесттер · убакыт менен</p>
              </div>
              {mockTests.length === 0 ? (
                <div style={{ background: card, borderRadius: 14, border: `1px solid ${border}`, padding: '40px 20px', textAlign: 'center' as const, color: light }}>
                  <div style={{ fontSize: 32, marginBottom: 10 }}>📋</div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: text }}>Тест жок</div>
                  <div style={{ fontSize: 13, marginTop: 4 }}>Администратор тест кошкондон кийин пайда болот</div>
                </div>
              ) : (
                <div className="mock-g" style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 14 }}>
                  {mockTests.map(test => {
                    const attempts = getMockAttempts(test.id)
                    const best = getBestMock(test.id)
                    const canTake = test.max_attempts === 0 || attempts < test.max_attempts
                    const color = sc(test.subject)
                    return (
                      <div key={test.id} style={{ background: card, borderRadius: 16, border: `1px solid ${border}`, padding: 20 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                          <span style={{ background: sb(test.subject), color, fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 20 }}>{sl(test.subject)}</span>
                          {best && <span style={{ background: dm ? 'rgba(16,185,129,0.15)' : '#F0FDF4', color: '#10B981', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>Эң жогорку: {best.total_score}</span>}
                        </div>
                        <div style={{ fontWeight: 800, fontSize: 16, color: text, marginBottom: 8 }}>{test.title}</div>
                        <div style={{ display: 'flex', gap: 14, marginBottom: 14 }}>
                          <div style={{ fontSize: 12, color: light }}>⏱ {test.time_limit_minutes} мин</div>
                          <div style={{ fontSize: 12, color: light }}>📌 {attempts}/{test.max_attempts === 0 ? '∞' : test.max_attempts} аракет</div>
                        </div>
                        <button onClick={() => canTake && openMock(test)} disabled={!canTake}
                          style={{ width: '100%', background: canTake ? color : border, color: canTake ? '#fff' : light, border: 'none', borderRadius: 11, padding: 11, fontWeight: 700, fontSize: 13, cursor: canTake ? 'pointer' : 'not-allowed' }}>
                          {!canTake ? 'Аракет бүттү' : attempts === 0 ? 'Баштоо →' : 'Кайра тапшыруу'}
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ══ MOCK INTRO ══ */}
          {view === 'mock_intro' && activeMock && (
            <div className="fade" style={{ maxWidth: 520, margin: '0 auto' }}>
              <div style={{ background: card, borderRadius: 22, border: `1px solid ${border}`, padding: '30px 24px', textAlign: 'center' as const }}>
                <div style={{ fontSize: 44, marginBottom: 14 }}>📋</div>
                <div style={{ fontWeight: 900, fontSize: 20, color: text, marginBottom: 6 }}>{activeMock.title}</div>
                <div style={{ fontSize: 13, color: muted, marginBottom: 22 }}>{sl(activeMock.subject)}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
                  {[
                    { label: 'Убакыт', val: `${activeMock.time_limit_minutes} мүнөт` },
                    { label: 'Суроолор', val: `${mockQuestions.length} суроо` },
                    { label: 'Предмет', val: sl(activeMock.subject) },
                    { label: 'Аракет', val: `${getMockAttempts(activeMock.id) + 1}/${activeMock.max_attempts === 0 ? '∞' : activeMock.max_attempts}` },
                  ].map(s => (
                    <div key={s.label} style={{ background: dm ? '#1C2128' : '#F8FAFF', borderRadius: 12, padding: 14 }}>
                      <div style={{ fontSize: 11, color: light, marginBottom: 4 }}>{s.label}</div>
                      <div style={{ fontWeight: 800, fontSize: 15, color: text }}>{s.val}</div>
                    </div>
                  ))}
                </div>
                <div style={{ background: dm ? '#2D2006' : '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 12, padding: '11px 14px', marginBottom: 20, textAlign: 'left' as const, fontSize: 13, color: '#92400E' }}>
                  ⚠️ Убакыт башталганда токтотуу мүмкүн эмес. Убакыт бүткөндө автоматтуу тапшырылат.
                </div>
                <button onClick={() => setView('mock_test')}
                  style={{ width: '100%', background: sc(activeMock.subject), color: '#fff', border: 'none', borderRadius: 13, padding: 14, fontWeight: 900, fontSize: 15, cursor: 'pointer' }}>
                  🚀 Тестти баштоо
                </button>
              </div>
            </div>
          )}

          {/* ══ MOCK TEST ══ */}
          {view === 'mock_test' && activeMock && (
            <MockTestView test={activeMock} questions={mockQuestions} answers={mockAnswers} setAnswers={setMockAnswers} onSubmit={submitMock} submitting={submitting} card={card} border={border} text={text} light={light} dm={dm} />
          )}

          {/* ══ MOCK RESULT ══ */}
          {view === 'mock_result' && mockResult && activeMock && (
            <div className="fade" style={{ maxWidth: 560, margin: '0 auto' }}>
              <div style={{ background: card, borderRadius: 22, border: `1px solid ${border}`, padding: '28px 20px', textAlign: 'center' as const }}>
                <div style={{ fontSize: 44, marginBottom: 10 }}>{mockResult.total_score >= goalScore ? '🎉' : '💪'}</div>
                <div style={{ fontWeight: 900, fontSize: 15, color: text, marginBottom: 14 }}>{activeMock.title}</div>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
                  <ScoreRing score={mockResult.total_score} max={145} size={90} />
                </div>
                <div style={{ fontWeight: 700, fontSize: 13, color: muted, marginBottom: 18 }}>
                  {mockResult.total_score >= goalScore ? '🎯 Максатка жеттиңиз!' : `Максатка дагы ${goalScore - mockResult.total_score} балл керек`}
                </div>
                {activeMock.subject === 'math' ? (
                  <div className="score-g" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
                    {[{ label: 'Салыштыруу', val: mockResult.math_comparison_score, color: BLUE }, { label: 'Математика', val: mockResult.math_raw_score, color: '#0EA5E9' }].map(s => (
                      <div key={s.label} style={{ background: dm ? '#1C2128' : '#F8FAFF', borderRadius: 12, padding: 14 }}>
                        <div style={{ fontSize: 11, color: light, marginBottom: 4 }}>{s.label}</div>
                        <div style={{ fontWeight: 900, fontSize: 20, color: s.color }}>{s.val}<span style={{ fontSize: 11, color: light, fontWeight: 400 }}>/30</span></div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="score-g" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 18 }}>
                    {[{ label: 'Аналогия', val: mockResult.analogy_score, color: '#7C3AED' }, { label: 'Окуу', val: mockResult.reading_score, color: '#059669' }, { label: 'Грамматика', val: mockResult.grammar_score, color: '#D97706' }].map(s => (
                      <div key={s.label} style={{ background: dm ? '#1C2128' : '#F8FAFF', borderRadius: 12, padding: 14 }}>
                        <div style={{ fontSize: 11, color: light, marginBottom: 4 }}>{s.label}</div>
                        <div style={{ fontWeight: 900, fontSize: 20, color: s.color }}>{s.val}<span style={{ fontSize: 11, color: light, fontWeight: 400 }}>/30</span></div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="rb" style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                  <button onClick={() => setView('dashboard')} style={{ background: dm ? '#1C2128' : '#F1F5F9', color: text, border: 'none', borderRadius: 11, padding: '10px 16px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>← Башкы</button>
                  <button onClick={() => setView('mock_list')} style={{ background: dm ? '#1C2128' : '#F1F5F9', color: text, border: 'none', borderRadius: 11, padding: '10px 16px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Тесттер</button>
                  {(activeMock.max_attempts === 0 || getMockAttempts(activeMock.id) < activeMock.max_attempts) && (
                    <button onClick={() => openMock(activeMock)} style={{ background: BLUE, color: '#fff', border: 'none', borderRadius: 11, padding: '10px 16px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>🔄 Кайра</button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ══ PRACTICE ══ */}
          {view === 'practice' && (
            <div className="fade">
              <div style={{ marginBottom: 18 }}>
                <h2 style={{ fontSize: 20, fontWeight: 900, margin: 0, color: text }}>🎯 Практика</h2>
                <p style={{ color: muted, fontSize: 13, margin: '4px 0 0' }}>Тема боюнча видео + тест</p>
              </div>
              <div style={{ display: 'flex', background: dm ? '#1C2128' : '#F1F5F9', borderRadius: 12, padding: 4, gap: 4, marginBottom: 18, width: 'fit-content' as const }}>
                {(['math', 'kyr'] as const).map(s => (
                  <button key={s} onClick={() => { setPracticeSubject(s); fetchLessons(s) }}
                    style={{ padding: '8px 20px', borderRadius: 9, border: 'none', fontSize: 13, fontWeight: practiceSubject === s ? 700 : 600, cursor: 'pointer', background: practiceSubject === s ? sc(s) : 'transparent', color: practiceSubject === s ? '#fff' : muted, transition: 'all 0.15s' }}>
                    {sl(s)}
                  </button>
                ))}
              </div>
              {lessons.length === 0 ? (
                <div style={{ background: card, borderRadius: 14, border: `1px solid ${border}`, padding: '40px 20px', textAlign: 'center' as const, color: light }}>
                  <div style={{ fontSize: 32, marginBottom: 10 }}>📚</div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: text }}>Сабак жок</div>
                </div>
              ) : (
                <div className="lesson-g" style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12 }}>
                  {lessons.map((l, i) => {
                    const res = getLessonResult(l.id)
                    const color = sc(practiceSubject)
                    return (
                      <div key={l.id} className="ch" onClick={() => openLesson(l)}
                        style={{ background: card, borderRadius: 14, border: `1px solid ${res?.passed ? '#BBF7D0' : border}`, padding: 18, cursor: 'pointer' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                          <div style={{ width: 34, height: 34, background: res?.passed ? (dm ? 'rgba(16,185,129,0.15)' : '#F0FDF4') : sb(practiceSubject), borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 13, color: res?.passed ? '#10B981' : color, flexShrink: 0 }}>
                            {res?.passed ? '✓' : i + 1}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: 13, color: text, lineHeight: 1.3, marginBottom: 3 }}>{l.title}</div>
                            {l.description && <div style={{ fontSize: 11, color: light }}>{l.description}</div>}
                          </div>
                          {res && (
                            <div style={{ textAlign: 'right' as const, flexShrink: 0 }}>
                              <div style={{ fontWeight: 800, fontSize: 13, color: res.passed ? '#10B981' : '#F59E0B' }}>{Math.round((res.score / res.total) * 100)}%</div>
                              <div style={{ fontSize: 10, color: res.passed ? '#10B981' : '#F59E0B', fontWeight: 700 }}>{res.passed ? 'Өттү' : 'Кайра'}</div>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ══ LESSON ══ */}
          {view === 'lesson' && activeLesson && (
            <div className="fade">
              <h2 style={{ fontSize: 18, fontWeight: 900, marginBottom: 6, lineHeight: 1.3, color: text }}>{activeLesson.title}</h2>
              {activeLesson.description && <p style={{ color: muted, fontSize: 13, marginBottom: 16 }}>{activeLesson.description}</p>}
              {activeLesson.video_url && (
                <div style={{ borderRadius: 16, overflow: 'hidden', marginBottom: 18, background: '#000', aspectRatio: '16/9' }}>
                  <iframe src={getEmbed(activeLesson.video_url)} style={{ width: '100%', height: '100%', border: 'none' }} allowFullScreen title={activeLesson.title} />
                </div>
              )}
              {practiceTests.length > 0 && (
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: text, marginBottom: 10 }}>📝 Тест</div>
                  {practiceTests.map(test => {
                    const res = pResults.find(r => r.test_id === test.id)
                    return (
                      <div key={test.id} style={{ background: card, borderRadius: 14, border: `1px solid ${border}`, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: 14, color: text }}>{test.title}</div>
                          {test.time_limit_minutes && <div style={{ fontSize: 12, color: light, marginTop: 2 }}>⏱ {test.time_limit_minutes} мин</div>}
                        </div>
                        {res && <div style={{ fontWeight: 800, fontSize: 15, color: res.passed ? '#10B981' : '#F59E0B', flexShrink: 0 }}>{Math.round((res.score / res.total) * 100)}%</div>}
                        <button onClick={() => startPTest(test)}
                          style={{ background: res ? (dm ? '#1C2128' : '#F8FAFF') : BLUE, color: res ? BLUE : '#fff', border: res ? `1.5px solid ${BLUE}` : 'none', borderRadius: 10, padding: '9px 16px', fontWeight: 700, fontSize: 13, cursor: 'pointer', flexShrink: 0 }}>
                          {res ? 'Кайра' : 'Баштоо →'}
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ══ PRACTICE TEST ══ */}
          {view === 'practice_test' && activePTest && (
            <div className="fade">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <h2 style={{ fontSize: 17, fontWeight: 900, margin: 0, color: text }}>{activePTest.title}</h2>
                <div style={{ fontWeight: 700, fontSize: 13, color: BLUE, background: dm ? 'rgba(27,79,216,0.2)' : '#EEF2FF', padding: '4px 12px', borderRadius: 20 }}>{Object.keys(pAnswers).length}/{pQuestions.length}</div>
              </div>
              <div style={{ background: border, borderRadius: 999, height: 6, marginBottom: 18, overflow: 'hidden' }}>
                <div style={{ width: `${(Object.keys(pAnswers).length / pQuestions.length) * 100}%`, height: '100%', background: BLUE, borderRadius: 999, transition: 'width 0.3s' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {pQuestions.map((q, qi) => (
                  <div key={q.id} style={{ background: card, borderRadius: 14, border: `1px solid ${pAnswers[q.id] ? (dm ? 'rgba(27,79,216,0.4)' : '#BFDBFE') : border}`, padding: '16px 18px' }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: text, marginBottom: 12, lineHeight: 1.5 }}>
                      <span style={{ color: BLUE, marginRight: 6, fontWeight: 800 }}>#{qi + 1}</span>
                      {q.image_url ? <img src={q.image_url} alt="q" style={{ maxHeight: 80, borderRadius: 8, display: 'block', marginTop: 6 }} /> : q.question_text}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                      {['A','B','C','D'].map(opt => {
                        const txt = (q as any)[`option_${opt.toLowerCase()}`]
                        const sel = pAnswers[q.id] === opt
                        return (
                          <button key={opt} onClick={() => setPAnswers(p => ({ ...p, [q.id]: opt }))}
                            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 13px', borderRadius: 10, border: `2px solid ${sel ? BLUE : border}`, background: sel ? (dm ? 'rgba(27,79,216,0.2)' : '#EEF2FF') : (dm ? '#1C2128' : '#FAFBFF'), cursor: 'pointer', textAlign: 'left' as const, fontFamily: 'Inter, sans-serif', width: '100%' }}>
                            <div style={{ width: 20, height: 20, borderRadius: '50%', border: `2px solid ${sel ? BLUE : light}`, background: sel ? BLUE : 'transparent', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {sel && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />}
                            </div>
                            <span style={{ fontSize: 13, color: sel ? BLUE : text, fontWeight: sel ? 600 : 400, lineHeight: 1.4 }}>{txt}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={submitPractice} disabled={submitting || Object.keys(pAnswers).length < pQuestions.length}
                style={{ width: '100%', marginTop: 18, background: Object.keys(pAnswers).length < pQuestions.length ? border : BLUE, color: Object.keys(pAnswers).length < pQuestions.length ? light : '#fff', border: 'none', borderRadius: 14, padding: 14, fontWeight: 900, fontSize: 15, cursor: Object.keys(pAnswers).length < pQuestions.length ? 'not-allowed' : 'pointer' }}>
                {submitting ? 'Жөнөтүлүүдө...' : Object.keys(pAnswers).length < pQuestions.length ? `${pQuestions.length - Object.keys(pAnswers).length} суроо калды` : '✓ Тапшыруу'}
              </button>
            </div>
          )}

          {/* ══ PRACTICE RESULT ══ */}
          {view === 'practice_result' && pResult && (
            <div className="fade" style={{ maxWidth: 480, margin: '0 auto', textAlign: 'center' as const }}>
              <div style={{ background: card, borderRadius: 22, border: `2px solid ${pResult.passed ? '#BBF7D0' : '#FECACA'}`, padding: '28px 20px' }}>
                <div style={{ fontSize: 44, marginBottom: 10 }}>{pResult.passed ? '🎉' : '💪'}</div>
                <div style={{ fontWeight: 900, fontSize: 44, color: pResult.passed ? '#10B981' : '#EF4444', letterSpacing: '-2px', marginBottom: 6 }}>
                  {Math.round((pResult.score / pResult.total) * 100)}%
                </div>
                <div style={{ fontWeight: 700, fontSize: 14, color: text, marginBottom: 4 }}>{pResult.score}/{pResult.total} туура жооп</div>
                <div style={{ fontWeight: 800, fontSize: 13, color: pResult.passed ? '#10B981' : '#F59E0B', marginBottom: 18 }}>
                  {pResult.passed ? '✓ Тема өттүңүз!' : 'Кайра аракет кылыңыз'}
                </div>
                {!pResult.passed && pResult.wrong.length > 0 && (
                  <div style={{ background: dm ? '#2D0B0B' : '#FEF2F2', borderRadius: 12, padding: '12px 14px', textAlign: 'left' as const, marginBottom: 16 }}>
                    <div style={{ fontWeight: 700, fontSize: 12, color: '#EF4444', marginBottom: 8 }}>Каталар:</div>
                    {pResult.wrong.slice(0, 5).map(wi => (
                      <div key={wi} style={{ fontSize: 12, color: muted, marginBottom: 5, lineHeight: 1.5 }}>
                        <span style={{ color: '#EF4444', fontWeight: 700 }}>#{wi + 1}</span> {pQuestions[wi]?.question_text} — <span style={{ color: '#10B981', fontWeight: 600 }}>{(pQuestions[wi] as any)?.[`option_${pQuestions[wi]?.correct_answer?.toLowerCase()}`]}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="rb" style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' as const }}>
                  <button onClick={() => setView('lesson')} style={{ background: dm ? '#1C2128' : '#F1F5F9', color: text, border: 'none', borderRadius: 11, padding: '10px 16px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>← Сабак</button>
                  <button onClick={() => setView('practice')} style={{ background: dm ? '#1C2128' : '#F1F5F9', color: text, border: 'none', borderRadius: 11, padding: '10px 16px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>📚 Практика</button>
                  {!pResult.passed && activePTest && (
                    <button onClick={() => startPTest(activePTest)} style={{ background: BLUE, color: '#fff', border: 'none', borderRadius: 11, padding: '10px 16px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>🔄 Кайра</button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ══ MISTAKES ══ */}
          {view === 'mistakes' && (
            <div className="fade">
              <div style={{ marginBottom: 18 }}>
                <h2 style={{ fontSize: 20, fontWeight: 900, margin: 0, color: text }}>🔁 Каталарды иштетүү</h2>
                <p style={{ color: muted, fontSize: 13, margin: '4px 0 0' }}>Акыркы тесттерден туура эмес жооп берилген суроолор</p>
              </div>
              {mistakeQs.length === 0 ? (
                <div style={{ background: card, borderRadius: 14, border: `1px solid ${border}`, padding: '40px 20px', textAlign: 'center' as const, color: light }}>
                  <div style={{ fontSize: 32, marginBottom: 10 }}>✅</div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: text }}>Ката жок</div>
                </div>
              ) : !mistakeDone ? (
                <div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 18 }}>
                    {mistakeQs.map((q, qi) => (
                      <div key={q.id} style={{ background: card, borderRadius: 14, border: `1px solid ${mistakeAns[q.id] ? (dm ? 'rgba(27,79,216,0.4)' : '#BFDBFE') : border}`, padding: '16px 18px' }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: text, marginBottom: 12, lineHeight: 1.5 }}>
                          <span style={{ color: '#EF4444', marginRight: 6, fontWeight: 800 }}>#{qi + 1}</span>{q.question_text}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                          {['A','B','C','D'].map(opt => {
                            const txt = (q as any)[`option_${opt.toLowerCase()}`]
                            const sel = mistakeAns[q.id] === opt
                            return (
                              <button key={opt} onClick={() => setMistakeAns(p => ({ ...p, [q.id]: opt }))}
                                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 13px', borderRadius: 10, border: `2px solid ${sel ? BLUE : border}`, background: sel ? (dm ? 'rgba(27,79,216,0.2)' : '#EEF2FF') : (dm ? '#1C2128' : '#FAFBFF'), cursor: 'pointer', textAlign: 'left' as const, fontFamily: 'Inter, sans-serif', width: '100%' }}>
                                <div style={{ width: 20, height: 20, borderRadius: '50%', border: `2px solid ${sel ? BLUE : light}`, background: sel ? BLUE : 'transparent', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  {sel && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />}
                                </div>
                                <span style={{ fontSize: 13, color: sel ? BLUE : text, fontWeight: sel ? 600 : 400 }}>{txt}</span>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => setMistakeDone(true)} disabled={Object.keys(mistakeAns).length < mistakeQs.length}
                    style={{ width: '100%', background: Object.keys(mistakeAns).length < mistakeQs.length ? border : '#EF4444', color: Object.keys(mistakeAns).length < mistakeQs.length ? light : '#fff', border: 'none', borderRadius: 14, padding: 14, fontWeight: 900, fontSize: 15, cursor: Object.keys(mistakeAns).length < mistakeQs.length ? 'not-allowed' : 'pointer' }}>
                    ✓ Текшерүү
                  </button>
                </div>
              ) : (
                <div>
                  <div style={{ background: dm ? 'rgba(16,185,129,0.1)' : '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 14, padding: '16px 18px', marginBottom: 18, textAlign: 'center' as const }}>
                    <div style={{ fontWeight: 900, fontSize: 22, color: '#10B981' }}>
                      {mistakeQs.filter(q => mistakeAns[q.id] === q.correct_answer).length}/{mistakeQs.length}
                    </div>
                    <div style={{ fontSize: 13, color: muted, marginTop: 4 }}>туура жооп</div>
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={() => setView('dashboard')} style={{ flex: 1, background: dm ? '#1C2128' : '#F1F5F9', color: text, border: 'none', borderRadius: 12, padding: 12, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>← Башкы</button>
                    <button onClick={() => { setMistakeAns({}); setMistakeDone(false) }} style={{ flex: 1, background: BLUE, color: '#fff', border: 'none', borderRadius: 12, padding: 12, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>🔄 Кайра</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══ PROFILE ══ */}
          {view === 'profile' && (
            <div className="fade">
              <div style={{ marginBottom: 18 }}>
                <h2 style={{ fontSize: 20, fontWeight: 900, margin: 0, color: text }}>👤 Профиль</h2>
              </div>
              <div style={{ background: card, borderRadius: 18, border: `1px solid ${border}`, padding: '22px 20px', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20, paddingBottom: 20, borderBottom: `1px solid ${border}` }}>
                  <div style={{ width: 56, height: 56, background: 'linear-gradient(135deg,#1B4FD8,#6366F1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 22, fontWeight: 900, flexShrink: 0 }}>{profile?.full_name?.[0]}</div>
                  <div>
                    <div style={{ fontWeight: 900, fontSize: 17, color: text }}>{profile?.full_name}</div>
                    <div style={{ fontSize: 12, color: light, marginTop: 2 }}>Онлайн студент · ЖРТ</div>
                    {streak > 0 && <div style={{ fontSize: 12, color: '#D97706', marginTop: 4 }}>🔥 {streak} күн streak</div>}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 11, color: light, fontWeight: 600, marginBottom: 6 }}>АТЫ-ЖӨНҮ</div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: text }}>{profile?.full_name || '—'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: light, fontWeight: 600, marginBottom: 6 }}>ТЕЛЕФОН</div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: text }}>{profile?.phone || '—'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: light, fontWeight: 600, marginBottom: 6 }}>МЕКТЕП</div>
                    <input value={editSchool} onChange={e => setEditSchool(e.target.value)} placeholder="Мектебиңизди жазыңыз"
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${border}`, fontSize: 14, color: text, background: dm ? '#1C2128' : '#F8FAFF', outline: 'none' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: light, fontWeight: 600, marginBottom: 6 }}>МАКСАТ БАЛЛ</div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <input value={editGoal} onChange={e => setEditGoal(e.target.value)} type="number" min="100" max="270"
                        style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: `1px solid ${border}`, fontSize: 15, fontWeight: 700, color: BLUE, background: dm ? '#1C2128' : '#F8FAFF', outline: 'none' }} />
                      <button onClick={saveProfile} disabled={savingProfile}
                        style={{ background: BLUE, color: '#fff', border: 'none', borderRadius: 10, padding: '10px 20px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                        {savingProfile ? '...' : 'Сактоо'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <div className="stats-g" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
                {[
                  { label: 'Тест тапшырылды', val: mockResults.length, color: BLUE },
                  { label: 'Орточо балл', val: avgScore || '—', color: '#10B981' },
                  { label: 'Практика өттү', val: `${mathPassed + kyrPassed}/${allLessons.length}`, color: '#7C3AED' },
                ].map(s => (
                  <div key={s.label} style={{ background: card, borderRadius: 12, border: `1px solid ${border}`, padding: 14, textAlign: 'center' as const }}>
                    <div style={{ fontWeight: 900, fontSize: 20, color: s.color }}>{s.val}</div>
                    <div style={{ fontSize: 10, color: light, marginTop: 3 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ══ SETTINGS ══ */}
          {view === 'settings' && (
            <div className="fade">
              <div style={{ marginBottom: 18 }}>
                <h2 style={{ fontSize: 20, fontWeight: 900, margin: 0, color: text }}>⚙️ Орнотуулар</h2>
              </div>
              <div style={{ background: card, borderRadius: 18, border: `1px solid ${border}`, overflow: 'hidden' }}>
                {/* Dark mode */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `1px solid ${border}` }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: text }}>🌙 Түнкү режим</div>
                    <div style={{ fontSize: 12, color: light, marginTop: 2 }}>Карангы фон</div>
                  </div>
                  <div onClick={() => setDarkMode(p => !p)}
                    style={{ width: 48, height: 26, borderRadius: 13, background: darkMode ? BLUE : border, cursor: 'pointer', position: 'relative', transition: 'background 0.2s' }}>
                    <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: darkMode ? 25 : 3, transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }} />
                  </div>
                </div>
                {/* Logout */}
                <div style={{ padding: '16px 20px' }}>
                  <button onClick={async () => { await supabase.auth.signOut(); router.push('/') }}
                    style={{ width: '100%', background: dm ? 'rgba(239,68,68,0.1)' : '#FEF2F2', color: '#EF4444', border: 'none', borderRadius: 12, padding: '12px', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                    🚪 Системадан чыгуу
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* ── Bottom Nav (mobile) ── */}
      <div className="bnav" style={{ display: 'none' }}>
        {[
          { id: 'dashboard', icon: '🏠', label: 'Башкы' },
          { id: 'mock_list', icon: '📋', label: 'Тест' },
          { id: 'practice', icon: '🎯', label: 'Практика' },
          { id: 'analytics', icon: '📊', label: 'Аналитика' },
          { id: 'profile', icon: '👤', label: 'Профиль' },
        ].map(tab => {
          const active = view === tab.id ||
            (tab.id === 'mock_list' && ['mock_intro','mock_test','mock_result'].includes(view)) ||
            (tab.id === 'practice' && ['lesson','practice_test','practice_result'].includes(view))
          return (
            <button key={tab.id} onClick={() => navTo(tab.id)}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '8px 4px', border: 'none', background: 'transparent', cursor: 'pointer', color: active ? BLUE : light }}>
              <div style={{ fontSize: 20 }}>{tab.icon}</div>
              <div style={{ fontSize: 9, fontWeight: 600, marginTop: 3 }}>{tab.label}</div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Mock Test View ───────────────────────────────────────────────────────────
function MockTestView({ test, questions, answers, setAnswers, onSubmit, submitting, card, border, text, light, dm }: {
  test: MockTest; questions: Question[]; answers: Record<string, string>
  setAnswers: (a: Record<string, string>) => void; onSubmit: () => void; submitting: boolean
  card: string; border: string; text: string; light: string; dm: boolean
}) {
  const totalSecs = test.time_limit_minutes * 60
  const { left, start } = useTimer(totalSecs, onSubmit)
  const [activeQ, setActiveQ] = useState(0)
  const BLUE = '#1B4FD8'
  useEffect(() => { start() }, [])
  const q = questions[activeQ]
  return (
    <div>
      <div style={{ background: card, borderRadius: 14, border: `1px solid ${border}`, padding: '14px 18px', marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: text }}>{test.title}</div>
          <div style={{ fontWeight: 700, fontSize: 13, color: BLUE }}>{Object.keys(answers).length}/{questions.length}</div>
        </div>
        <TimerBar left={left} total={totalSecs} />
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 5, marginBottom: 14 }}>
        {questions.map((q, i) => (
          <button key={i} onClick={() => setActiveQ(i)}
            style={{ width: 32, height: 32, borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700,
              background: answers[q.id] ? BLUE : i === activeQ ? (dm ? 'rgba(27,79,216,0.3)' : '#EEF2FF') : (dm ? '#1C2128' : '#F1F5F9'),
              color: answers[q.id] ? '#fff' : i === activeQ ? BLUE : light,
              outline: i === activeQ ? `2px solid ${BLUE}` : 'none' }}>
            {i + 1}
          </button>
        ))}
      </div>
      {q && (
        <div style={{ background: card, borderRadius: 14, border: `1px solid ${answers[q.id] ? (dm ? 'rgba(27,79,216,0.4)' : '#BFDBFE') : border}`, padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ fontWeight: 800, fontSize: 13, color: BLUE }}>#{activeQ + 1}</span>
            {q.section && q.section !== 'general' && (
              <span style={{ background: dm ? 'rgba(27,79,216,0.2)' : '#EEF2FF', color: BLUE, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>
                {q.section === 'comparison' ? 'Салыштыруу' : q.section === 'math' ? 'Математика' : q.section === 'analogy' ? 'Аналогия' : q.section === 'reading' ? 'Окуу' : 'Грамматика'}
              </span>
            )}
          </div>
          {q.image_url ? <img src={q.image_url} alt="q" style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 10, marginBottom: 12, display: 'block' }} />
            : <div style={{ fontWeight: 700, fontSize: 14, color: text, marginBottom: 12, lineHeight: 1.6 }}>{q.question_text}</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {['A','B','C','D'].map(opt => {
              const txt = (q as any)[`option_${opt.toLowerCase()}`]
              const sel = answers[q.id] === opt
              return (
                <button key={opt} onClick={() => setAnswers({ ...answers, [q.id]: opt })}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderRadius: 10, border: `2px solid ${sel ? BLUE : border}`, background: sel ? (dm ? 'rgba(27,79,216,0.2)' : '#EEF2FF') : (dm ? '#1C2128' : '#FAFBFF'), cursor: 'pointer', textAlign: 'left' as const, fontFamily: 'Inter, sans-serif', width: '100%' }}>
                  <div style={{ width: 22, height: 22, borderRadius: '50%', border: `2px solid ${sel ? BLUE : light}`, background: sel ? BLUE : 'transparent', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {sel && <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#fff' }} />}
                  </div>
                  <span style={{ fontSize: 13, color: sel ? BLUE : text, fontWeight: sel ? 600 : 400, lineHeight: 1.4 }}>{txt}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        {activeQ > 0 && <button onClick={() => setActiveQ(p => p - 1)} style={{ flex: 1, background: dm ? '#1C2128' : '#F1F5F9', color: light, border: 'none', borderRadius: 12, padding: 12, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>← Артка</button>}
        {activeQ < questions.length - 1
          ? <button onClick={() => setActiveQ(p => p + 1)} style={{ flex: 1, background: BLUE, color: '#fff', border: 'none', borderRadius: 12, padding: 12, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Кийинки →</button>
          : <button onClick={onSubmit} disabled={submitting} style={{ flex: 1, background: Object.keys(answers).length === questions.length ? '#10B981' : '#F59E0B', color: '#fff', border: 'none', borderRadius: 12, padding: 12, fontWeight: 900, fontSize: 13, cursor: 'pointer' }}>
              {submitting ? 'Жөнөтүлүүдө...' : Object.keys(answers).length < questions.length ? `⚠️ ${questions.length - Object.keys(answers).length} жооп жок` : '✓ Тапшыруу'}
            </button>}
      </div>
    </div>
  )
}