'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import {
  Home, ClipboardList, Target, BarChart2, RotateCcw, User, Settings,
  LogOut, Menu, X, ChevronRight, Clock, BookOpen, CheckCircle, Circle,
  TrendingUp, Award, Calendar, AlertCircle, Play, FileText, ChevronLeft,
  Flame, Star, ArrowLeft
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────
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

// ─── Helpers ─────────────────────────────────────────────────────────────────
function calcScore(math: number, analogy: number, reading: number, grammar: number) {
  return Math.round(math * 1.12 + analogy * 2 + reading * 2 + grammar * 1.93)
}
function getEmbed(url: string) {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/)
  return m ? `https://www.youtube.com/embed/${m[1]}?rel=0` : url
}
function daysUntilJRT() {
  return Math.ceil((new Date('2027-05-17').getTime() - Date.now()) / 86400000)
}
function getStreakDays(results: MockResult[], pResults: PracticeResult[]): number {
  const allDates = [...results.map(r => r.created_at), ...pResults.map(r => r.created_at)]
    .map(d => new Date(d).toDateString())
  const unique = [...new Set(allDates)].sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
  const today = new Date().toDateString()
  const yesterday = new Date(Date.now() - 86400000).toDateString()
  if (!unique.includes(today) && !unique.includes(yesterday)) return 0
  let streak = 0
  for (let i = 0; i < unique.length; i++) {
    if (unique[i] === new Date(Date.now() - i * 86400000).toDateString()) streak++
    else break
  }
  return streak
}
function getCalendarDays(results: MockResult[], pResults: PracticeResult[]) {
  const activeDates = new Set([
    ...results.map(r => new Date(r.created_at).toDateString()),
    ...pResults.map(r => new Date(r.created_at).toDateString()),
  ])
  return Array.from({ length: 30 }, (_, i) => {
    const d = new Date(Date.now() - (29 - i) * 86400000)
    return { date: d.toDateString(), active: activeDates.has(d.toDateString()), isToday: d.toDateString() === new Date().toDateString() }
  })
}

// ─── Timer ───────────────────────────────────────────────────────────────────
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
function TimerDisplay({ left, total }: { left: number; total: number }) {
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

// ─── Constants ────────────────────────────────────────────────────────────────
const BLUE = '#1B4FD8'
const sColor = (s: 'math' | 'kyr') => s === 'math' ? '#1B4FD8' : '#7C3AED'
const sBg    = (s: 'math' | 'kyr') => s === 'math' ? '#EEF2FF' : '#F5F3FF'
const sLabel = (s: 'math' | 'kyr') => s === 'math' ? 'Математика' : 'Кыргыз тили'

const NAV_ITEMS = [
  { id: 'dashboard', Icon: Home,          label: 'Башкы бет' },
  { id: 'mock_list', Icon: ClipboardList,  label: 'Сынамык тест' },
  { id: 'practice',  Icon: Target,         label: 'Практика' },
  { id: 'analytics', Icon: BarChart2,      label: 'Аналитика' },
  { id: 'mistakes',  Icon: RotateCcw,      label: 'Каталар' },
  { id: 'profile',   Icon: User,           label: 'Профиль' },
  { id: 'settings',  Icon: Settings,       label: 'Орнотуулар' },
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
  const [lessons, setLessons]         = useState<PracticeLesson[]>([])
  const [allLessons, setAllLessons]   = useState<PracticeLesson[]>([])
  const [activeLesson, setActiveLesson] = useState<PracticeLesson | null>(null)
  const [practiceTests, setPracticeTests] = useState<PracticeTest[]>([])
  const [activePTest, setActivePTest] = useState<PracticeTest | null>(null)
  const [pQuestions, setPQuestions]   = useState<Question[]>([])
  const [pAnswers, setPAnswers]       = useState<Record<string, string>>({})
  const [pResult, setPResult]         = useState<{ score: number; total: number; passed: boolean; wrong: number[] } | null>(null)
  const [pResults, setPResults]       = useState<PracticeResult[]>([])
  const [allPResults, setAllPResults] = useState<PracticeResult[]>([])
  const [submitting, setSubmitting]   = useState(false)
  const [editGoal, setEditGoal]       = useState('')
  const [editSchool, setEditSchool]   = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [mistakeQs, setMistakeQs]     = useState<Question[]>([])
  const [mistakeAns, setMistakeAns]   = useState<Record<string, string>>({})
  const [mistakeDone, setMistakeDone] = useState(false)
  const [darkMode, setDarkMode]       = useState(false)
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
    setMockQuestions(data || []); setMockAnswers({}); setActiveMock(test); setView('mock_intro')
  }
  const openLesson = async (lesson: PracticeLesson) => {
    setActiveLesson(lesson); setPResult(null); setPAnswers({})
    const [{ data: tests }, { data: results }] = await Promise.all([
      supabase.from('practice_tests').select('*').eq('lesson_id', lesson.id).eq('type', 'practice'),
      supabase.from('practice_results').select('*').eq('student_id', profile!.id).eq('lesson_id', lesson.id).order('created_at', { ascending: false }),
    ])
    setPracticeTests(tests || []); setPResults(results || []); setView('lesson')
  }
  const startPTest = async (test: PracticeTest) => {
    const { data } = await supabase.from('questions').select('*').eq('practice_test_id', test.id).order('order_num')
    setPQuestions(data || []); setPAnswers({}); setActivePTest(test); setView('practice_test')
  }
  const submitMock = async () => {
    if (!activeMock || !profile) return
    setSubmitting(true)
    const sec = { comparison: mockQuestions.filter(q => q.section === 'comparison'), math: mockQuestions.filter(q => q.section === 'math'), analogy: mockQuestions.filter(q => q.section === 'analogy'), reading: mockQuestions.filter(q => q.section === 'reading'), grammar: mockQuestions.filter(q => q.section === 'grammar') }
    const s = (qs: Question[]) => qs.filter(q => mockAnswers[q.id] === q.correct_answer).length
    let mc = 0, mr = 0, an = 0, re = 0, gr = 0, total = 0
    if (activeMock.subject === 'math') { mc = s(sec.comparison); mr = s(sec.math); total = calcScore(mc + mr, 0, 0, 0) }
    else { an = s(sec.analogy); re = s(sec.reading); gr = s(sec.grammar); total = calcScore(0, an, re, gr) }
    const attempts = mockResults.filter(r => r.test_id === activeMock.id).length + 1
    const { data } = await supabase.from('practice_results').insert({ student_id: profile.id, test_id: activeMock.id, test_type: 'mock', math_comparison_score: mc, math_raw_score: mr, analogy_score: an, reading_score: re, grammar_score: gr, total_score: total, attempt_number: attempts }).select().single()
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
    await supabase.from('practice_results').insert({ student_id: profile.id, test_id: activePTest.id, lesson_id: activeLesson.id, test_type: 'practice', score, total, passed })
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
  const navTo = (id: string) => { setView(id as View); setSidebarOpen(false); if (id === 'practice') fetchLessons(practiceSubject) }
  const goBack = () => {
    if (['mock_intro','mock_result'].includes(view)) setView('mock_list')
    else if (view === 'mock_test') { if (confirm('Тестти токтотосузбу?')) setView('mock_list') }
    else if (view === 'lesson') setView('practice')
    else if (['practice_test','practice_result'].includes(view)) setView('lesson')
  }

  // ── Derived ─────────────────────────────────────────────────────────────────
  const getMockAttempts = (id: string) => mockResults.filter(r => r.test_id === id).length
  const getBestMock = (id: string) => { const r = mockResults.filter(r => r.test_id === id); return r.length ? r.reduce((b, c) => c.total_score > b.total_score ? c : b) : null }
  const getLessonRes = (lid: string) => allPResults.find(r => r.lesson_id === lid)
  const avgScore  = mockResults.length ? Math.round(mockResults.reduce((s, r) => s + r.total_score, 0) / mockResults.length) : 0
  const bestScore = mockResults.length ? Math.max(...mockResults.map(r => r.total_score)) : 0
  const lastScore = mockResults.length ? mockResults[mockResults.length - 1]?.total_score : 0
  const goalScore = profile?.goal_score || 190
  const streak    = getStreakDays(mockResults, allPResults)
  const calendar  = getCalendarDays(mockResults, allPResults)
  const mathLessons = allLessons.filter(l => l.subject === 'math')
  const kyrLessons  = allLessons.filter(l => l.subject === 'kyr')
  const mathPassed  = mathLessons.filter(l => getLessonRes(l.id)?.passed).length
  const kyrPassed   = kyrLessons.filter(l => getLessonRes(l.id)?.passed).length
  const mathPct = mathLessons.length ? Math.round((mathPassed / mathLessons.length) * 100) : 0
  const kyrPct  = kyrLessons.length  ? Math.round((kyrPassed  / kyrLessons.length)  * 100) : 0
  const chartData = mockResults.slice(-8).map((r, i) => ({ name: `#${i + 1}`, балл: r.total_score }))
  const todayStr = new Date().toDateString()
  const todayTasks = [
    { done: mockResults.some(r => new Date(r.created_at).toDateString() === todayStr), label: 'Сынамык тест тапшыруу' },
    { done: allPResults.some(r => r.lesson_id && mathLessons.find(l => l.id === r.lesson_id) && new Date(r.created_at).toDateString() === todayStr), label: 'Математика практикасы' },
    { done: allPResults.some(r => r.lesson_id && kyrLessons.find(l => l.id === r.lesson_id) && new Date(r.created_at).toDateString() === todayStr), label: 'Кыргыз тили практикасы' },
  ]

  const dm = darkMode
  const bg     = dm ? '#0D1117' : '#F4F6FA'
  const card   = dm ? '#161B22' : '#FFFFFF'
  const border = dm ? '#30363D' : '#E8ECF0'
  const text   = dm ? '#E6EDF3' : '#111827'
  const muted  = dm ? '#8B949E' : '#6B7280'
  const light  = dm ? '#484F58' : '#9CA3AF'
  const inputBg = dm ? '#1C2128' : '#F9FAFB'

  const isInnerView = !['dashboard','practice','mock_list','analytics','profile','settings','mistakes'].includes(view)

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: bg, fontFamily: 'Inter, sans-serif' }}>
      <div style={{ color: light, fontSize: 14 }}>Жүктөлүүдө...</div>
    </div>
  )

  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div style={{ padding: '18px 16px 14px', borderBottom: `1px solid ${border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{ width: 30, height: 30, background: BLUE, borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
            <img src="/images/logo.png" alt="Z" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 14, color: text, letterSpacing: '-0.3px' }}>Zhangak</div>
            <div style={{ fontSize: 10, color: light, fontWeight: 500 }}>ЖРТ платформасы</div>
          </div>
        </div>
      </div>

      {/* Profile mini */}
      <div style={{ padding: '12px 14px', borderBottom: `1px solid ${border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{ width: 34, height: 34, background: 'linear-gradient(135deg,#1B4FD8,#6366F1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 13, flexShrink: 0 }}>
            {profile?.full_name?.[0]}
          </div>
          <div style={{ overflow: 'hidden', flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 12, color: text, whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis' }}>{profile?.full_name}</div>
            <div style={{ fontSize: 11, color: light, marginTop: 1 }}>Максат: {goalScore} балл</div>
          </div>
        </div>
        {streak > 0 && (
          <div style={{ marginTop: 8, background: dm ? 'rgba(217,119,6,0.15)' : '#FFF7ED', borderRadius: 7, padding: '5px 9px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Flame size={13} color="#D97706" />
            <span style={{ fontSize: 11, fontWeight: 700, color: '#D97706' }}>{streak} күн streak</span>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav style={{ padding: '8px 8px', flex: 1, overflowY: 'auto' as const }}>
        {NAV_ITEMS.map(({ id, Icon, label }) => {
          const active = view === id ||
            (id === 'mock_list' && ['mock_intro','mock_test','mock_result'].includes(view)) ||
            (id === 'practice' && ['lesson','practice_test','practice_result'].includes(view))
          return (
            <button key={id} onClick={() => navTo(id)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', marginBottom: 1, textAlign: 'left' as const, background: active ? (dm ? 'rgba(27,79,216,0.18)' : '#EEF2FF') : 'transparent', color: active ? BLUE : muted, fontWeight: active ? 600 : 400, fontSize: 13, transition: 'all 0.15s', fontFamily: 'Inter, sans-serif' }}>
              <Icon size={16} strokeWidth={active ? 2.5 : 2} />
              {label}
            </button>
          )
        })}
      </nav>

      {/* Logout */}
      <div style={{ padding: '8px', borderTop: `1px solid ${border}` }}>
        <button onClick={async () => { await supabase.auth.signOut(); router.push('/') }}
          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'transparent', color: '#EF4444', fontSize: 13, fontWeight: 500, fontFamily: 'Inter, sans-serif' }}>
          <LogOut size={16} />
          Чыгуу
        </button>
      </div>
    </>
  )

  const Btn = ({ children, onClick, variant = 'primary', size = 'md', disabled = false, style: extraStyle = {} }: any) => {
    const styles: any = {
      primary:   { background: BLUE, color: '#fff', border: 'none' },
      secondary: { background: dm ? '#1C2128' : '#F3F4F6', color: text, border: 'none' },
      danger:    { background: dm ? 'rgba(239,68,68,0.12)' : '#FEF2F2', color: '#EF4444', border: 'none' },
      outline:   { background: 'transparent', color: BLUE, border: `1.5px solid ${BLUE}` },
    }
    const sizes: any = { sm: '7px 12px', md: '10px 18px', lg: '13px 22px' }
    return (
      <button onClick={onClick} disabled={disabled}
        style={{ ...styles[variant], padding: sizes[size], borderRadius: 9, fontWeight: 600, fontSize: 13, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1, fontFamily: 'Inter, sans-serif', display: 'inline-flex', alignItems: 'center', gap: 6, transition: 'opacity 0.15s', ...extraStyle }}>
        {children}
      </button>
    )
  }

  const Card = ({ children, style: s = {} }: any) => (
    <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 14, ...s }}>{children}</div>
  )

  return (
    <div style={{ minHeight: '100vh', background: bg, fontFamily: 'Inter, -apple-system, sans-serif', color: text, display: 'flex' }}>
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
          .g4{grid-template-columns:1fr 1fr!important}
          .g2{grid-template-columns:1fr!important}
          .g3{grid-template-columns:1fr 1fr!important}
          .rb{flex-direction:column!important}
          .rb>*{width:100%!important}
        }
        .bnav{display:none}
        @media(max-width:768px){.bnav{display:flex!important}}
      `}</style>

      {/* Desktop Sidebar */}
      <aside className="desktop-sb" style={{ width: 210, background: card, borderRight: `1px solid ${border}`, position: 'fixed', top: 0, left: 0, height: '100vh', zIndex: 200 }}>
        <SidebarContent />
      </aside>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <>
          <div onClick={() => setSidebarOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 300 }} />
          <aside style={{ width: 230, background: card, display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, left: 0, height: '100vh', zIndex: 400, boxShadow: '4px 0 20px rgba(0,0,0,0.12)' }}>
            <SidebarContent />
          </aside>
        </>
      )}

      {/* Mobile topbar */}
      <div className="mobile-bar" style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 52, background: card, borderBottom: `1px solid ${border}`, display: 'none', alignItems: 'center', justifyContent: 'space-between', padding: '0 14px', zIndex: 150 }}>
        <button onClick={() => setSidebarOpen(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: text, display: 'flex' }}><Menu size={20} /></button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 24, height: 24, background: BLUE, borderRadius: 6, overflow: 'hidden' }}>
            <img src="/images/logo.png" alt="Z" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <span style={{ fontWeight: 800, fontSize: 14, color: BLUE }}>Zhangak</span>
        </div>
        <div style={{ width: 28 }} />
      </div>

      {/* Main */}
      <main className="main" style={{ flex: 1 }}>
        <div className="pad" style={{ maxWidth: 840, margin: '0 auto', padding: '28px 24px 40px' }}>

          {/* Back button for inner views */}
          {isInnerView && (
            <button onClick={goBack} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: muted, fontSize: 13, fontWeight: 500, marginBottom: 18, padding: 0, fontFamily: 'Inter, sans-serif' }}>
              <ArrowLeft size={15} /> Артка
            </button>
          )}

          {/* ══ DASHBOARD ══ */}
          {view === 'dashboard' && (
            <div className="fade">
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, gap: 12, flexWrap: 'wrap' as const }}>
                <div>
                  <h1 style={{ fontSize: 'clamp(18px,4vw,21px)', fontWeight: 800, margin: 0, letterSpacing: '-0.4px' }}>
                    Саламатсызбы, {profile?.full_name?.split(' ')[0]}
                  </h1>
                  <p style={{ color: muted, fontSize: 13, margin: '4px 0 0' }}>ЖРТга даярдануу платформасы</p>
                </div>
                <div style={{ background: BLUE, borderRadius: 12, padding: '10px 16px', textAlign: 'center' as const, flexShrink: 0 }}>
                  <div style={{ fontWeight: 900, fontSize: 24, color: '#fff', letterSpacing: '-1px' }}>{daysUntilJRT()}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.75)', fontWeight: 600, marginTop: 1 }}>күн калды</div>
                </div>
              </div>

              {/* Stats */}
              <div className="g4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 12 }}>
                {[
                  { label: 'Акыркы балл', val: lastScore || '—', color: BLUE },
                  { label: 'Орточо', val: avgScore || '—', color: '#10B981' },
                  { label: 'Эң жогорку', val: bestScore || '—', color: '#F59E0B' },
                  { label: 'Максат', val: goalScore, color: '#7C3AED' },
                ].map(s => (
                  <Card key={s.label} style={{ padding: '14px 14px' }}>
                    <div style={{ fontWeight: 800, fontSize: 22, color: s.color, letterSpacing: '-0.5px' }}>{s.val}</div>
                    <div style={{ fontSize: 11, color: light, marginTop: 3 }}>{s.label}</div>
                  </Card>
                ))}
              </div>

              {/* Goal progress */}
              {lastScore > 0 && (
                <Card style={{ padding: '14px 16px', marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: text }}>Максатка жакындоо</div>
                      <div style={{ fontSize: 11, color: muted, marginTop: 2 }}>Азыр: {lastScore} · Максат: {goalScore} · Дагы: {Math.max(goalScore - lastScore, 0)} балл</div>
                    </div>
                    <div style={{ fontWeight: 800, fontSize: 16, color: lastScore >= goalScore ? '#10B981' : BLUE }}>{Math.round((lastScore / goalScore) * 100)}%</div>
                  </div>
                  <PBar value={lastScore} max={goalScore} color={lastScore >= goalScore ? '#10B981' : BLUE} h={8} />
                </Card>
              )}

              {/* Streak + Today tasks */}
              <div className="g2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <Card style={{ padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                    <Flame size={15} color={streak > 0 ? '#D97706' : light} />
                    <span style={{ fontWeight: 600, fontSize: 13, color: text }}>{streak > 0 ? `${streak} күн streak` : 'Streak'}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(15,1fr)', gap: 2.5 }}>
                    {calendar.map((d, i) => (
                      <div key={i} title={d.date} style={{ aspectRatio: '1', borderRadius: 2, background: d.active ? (d.isToday ? BLUE : '#93C5FD') : (dm ? '#21262D' : '#F1F5F9') }} />
                    ))}
                  </div>
                  <div style={{ fontSize: 10, color: light, marginTop: 6 }}>Акыркы 30 күн</div>
                </Card>
                <Card style={{ padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                    <Clock size={15} color={muted} />
                    <span style={{ fontWeight: 600, fontSize: 13, color: text }}>Бүгүнкү тапшырмалар</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                    {todayTasks.map((t, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {t.done
                          ? <CheckCircle size={15} color="#10B981" />
                          : <Circle size={15} color={light} />}
                        <span style={{ fontSize: 12, color: t.done ? light : text, textDecoration: t.done ? 'line-through' : 'none' }}>{t.label}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>

              {/* Practice progress */}
              <Card style={{ padding: '14px 16px', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                  <BookOpen size={15} color={muted} />
                  <span style={{ fontWeight: 600, fontSize: 13, color: text }}>Практика прогрессу</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[
                    { label: 'Математика', passed: mathPassed, total: mathLessons.length, pct: mathPct, color: BLUE },
                    { label: 'Кыргыз тили', passed: kyrPassed, total: kyrLessons.length, pct: kyrPct, color: '#7C3AED' },
                  ].map(s => (
                    <div key={s.label}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                        <span style={{ fontSize: 12, fontWeight: 500, color: text }}>{s.label}</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: s.color }}>{s.passed}/{s.total} · {s.pct}%</span>
                      </div>
                      <PBar value={s.passed} max={s.total || 1} color={s.color} h={6} />
                    </div>
                  ))}
                </div>
              </Card>

              {/* Score chart */}
              {chartData.length > 1 && (
                <Card style={{ padding: '14px 16px', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                    <TrendingUp size={15} color={muted} />
                    <span style={{ fontWeight: 600, fontSize: 13, color: text }}>Баллдын өсүшү</span>
                  </div>
                  <ResponsiveContainer width="100%" height={120}>
                    <LineChart data={chartData}>
                      <XAxis dataKey="name" tick={{ fill: light, fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: light, fontSize: 10 }} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
                      <Tooltip contentStyle={{ background: card, border: `1px solid ${border}`, borderRadius: 8, fontSize: 11 }} formatter={(v: any) => [v + ' балл', 'Натыйжа']} />
                      <Line type="monotone" dataKey="балл" stroke={BLUE} strokeWidth={2} dot={{ fill: BLUE, r: 3 }} activeDot={{ r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </Card>
              )}

              {/* Quick actions */}
              <div className="g4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 12 }}>
                {[
                  { label: 'Сынамык тест', Icon: ClipboardList, color: BLUE, bg: dm ? 'rgba(27,79,216,0.12)' : '#EEF2FF', action: () => setView('mock_list') },
                  { label: 'Практика', Icon: Target, color: '#7C3AED', bg: dm ? 'rgba(124,58,237,0.12)' : '#F5F3FF', action: () => { setView('practice'); fetchLessons('math') } },
                  { label: 'Каталар', Icon: RotateCcw, color: '#EF4444', bg: dm ? 'rgba(239,68,68,0.12)' : '#FEF2F2', action: loadMistakes },
                  { label: 'Аналитика', Icon: BarChart2, color: '#10B981', bg: dm ? 'rgba(16,185,129,0.12)' : '#F0FDF4', action: () => setView('analytics') },
                ].map(a => (
                  <div key={a.label} className="ch" onClick={a.action}
                    style={{ background: a.bg, borderRadius: 12, padding: '14px 10px', textAlign: 'center' as const, cursor: 'pointer', border: `1px solid ${a.color}20`, transition: 'opacity 0.15s' }}>
                    <a.Icon size={20} color={a.color} style={{ marginBottom: 6, display: 'block', margin: '0 auto 6px' }} />
                    <div style={{ fontSize: 11, fontWeight: 600, color: a.color }}>{a.label}</div>
                  </div>
                ))}
              </div>

              {/* Last results */}
              {mockResults.length > 0 && (
                <Card style={{ overflow: 'hidden' }}>
                  <div style={{ padding: '12px 16px', borderBottom: `1px solid ${border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, fontSize: 13, color: text }}>Акыркы натыйжалар</span>
                    <button onClick={() => setView('mock_list')} style={{ background: 'none', border: 'none', color: BLUE, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3, fontFamily: 'Inter, sans-serif' }}>
                      Баарын көрүү <ChevronRight size={13} />
                    </button>
                  </div>
                  {mockResults.slice(-5).reverse().map(r => {
                    const test = mockTests.find(t => t.id === r.test_id)
                    return (
                      <div key={r.id} style={{ display: 'flex', alignItems: 'center', padding: '10px 16px', borderBottom: `1px solid ${border}`, gap: 12 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 500, fontSize: 13, color: text, whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis' }}>{test?.title || 'Сынамык тест'}</div>
                          <div style={{ fontSize: 11, color: light, marginTop: 1 }}>{new Date(r.created_at).toLocaleDateString('ru')}</div>
                        </div>
                        <div style={{ fontWeight: 800, fontSize: 17, color: r.total_score >= goalScore ? '#10B981' : r.total_score >= 140 ? '#F59E0B' : BLUE, flexShrink: 0 }}>{r.total_score}</div>
                      </div>
                    )
                  })}
                </Card>
              )}
            </div>
          )}

          {/* ══ ANALYTICS ══ */}
          {view === 'analytics' && (
            <div className="fade">
              <h2 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 18px', color: text, letterSpacing: '-0.3px' }}>Аналитика</h2>
              {mockResults.length === 0 ? (
                <Card style={{ padding: '40px 20px', textAlign: 'center' as const }}>
                  <BarChart2 size={32} color={light} style={{ margin: '0 auto 10px' }} />
                  <div style={{ fontWeight: 600, fontSize: 14, color: text }}>Маалымат жок</div>
                  <div style={{ fontSize: 13, color: muted, marginTop: 4 }}>Тест тапшыргандан кийин аналитика пайда болот</div>
                </Card>
              ) : (
                <div>
                  {chartData.length > 1 && (
                    <Card style={{ padding: '14px 16px', marginBottom: 12 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: text, marginBottom: 12 }}>Динамика</div>
                      <ResponsiveContainer width="100%" height={140}>
                        <LineChart data={chartData}>
                          <XAxis dataKey="name" tick={{ fill: light, fontSize: 10 }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fill: light, fontSize: 10 }} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
                          <Tooltip contentStyle={{ background: card, border: `1px solid ${border}`, borderRadius: 8, fontSize: 11 }} formatter={(v: any) => [v + ' балл', 'Натыйжа']} />
                          <Line type="monotone" dataKey="балл" stroke={BLUE} strokeWidth={2} dot={{ fill: BLUE, r: 3 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </Card>
                  )}
                  <Card style={{ padding: '14px 16px', marginBottom: 12 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: text, marginBottom: 14 }}>Предмет боюнча орточо</div>
                    {[
                      { label: 'Математика (салыштыруу)', key: 'math_comparison_score' as keyof MockResult, max: 30 },
                      { label: 'Математика (чыгарма)', key: 'math_raw_score' as keyof MockResult, max: 30 },
                      { label: 'Аналогия', key: 'analogy_score' as keyof MockResult, max: 30 },
                      { label: 'Окуу жана түшүнүү', key: 'reading_score' as keyof MockResult, max: 30 },
                      { label: 'Грамматика', key: 'grammar_score' as keyof MockResult, max: 30 },
                    ].map(s => {
                      const vals = mockResults.filter(r => (r[s.key] as number) > 0).map(r => r[s.key] as number)
                      const avg = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0
                      const pct = Math.round((avg / s.max) * 100)
                      const col = pct >= 70 ? '#10B981' : pct >= 50 ? '#F59E0B' : '#EF4444'
                      return (
                        <div key={s.label} style={{ marginBottom: 10 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span style={{ fontSize: 12, color: text }}>{s.label}</span>
                            <span style={{ fontSize: 12, fontWeight: 600, color: col }}>{avg}/{s.max} · {pct}%</span>
                          </div>
                          <PBar value={avg} max={s.max} color={col} h={6} />
                        </div>
                      )
                    })}
                  </Card>
                  <div className="g3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
                    {[
                      { label: 'Жалпы тест', val: mockResults.length, color: BLUE },
                      { label: 'Орточо балл', val: avgScore, color: '#10B981' },
                      { label: 'Эң жогорку', val: bestScore, color: '#F59E0B' },
                    ].map(s => (
                      <Card key={s.label} style={{ padding: 14, textAlign: 'center' as const }}>
                        <div style={{ fontWeight: 800, fontSize: 22, color: s.color }}>{s.val}</div>
                        <div style={{ fontSize: 11, color: light, marginTop: 3 }}>{s.label}</div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══ MOCK LIST ══ */}
          {view === 'mock_list' && (
            <div className="fade">
              <h2 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 6px', color: text, letterSpacing: '-0.3px' }}>Сынамык тесттер</h2>
              <p style={{ color: muted, fontSize: 13, margin: '0 0 18px' }}>ЖРТ форматындагы тесттер · убакыт менен</p>
              {mockTests.length === 0 ? (
                <Card style={{ padding: '40px 20px', textAlign: 'center' as const }}>
                  <ClipboardList size={32} color={light} style={{ margin: '0 auto 10px' }} />
                  <div style={{ fontWeight: 600, fontSize: 14, color: text }}>Тест жок</div>
                  <div style={{ fontSize: 13, color: muted, marginTop: 4 }}>Администратор тест кошкондон кийин пайда болот</div>
                </Card>
              ) : (
                <div className="g2" style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12 }}>
                  {mockTests.map(test => {
                    const attempts = getMockAttempts(test.id)
                    const best = getBestMock(test.id)
                    const canTake = test.max_attempts === 0 || attempts < test.max_attempts
                    const color = sColor(test.subject)
                    return (
                      <Card key={test.id} style={{ padding: 18 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
                          <span style={{ background: sBg(test.subject), color, fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 20 }}>{sLabel(test.subject)}</span>
                          {best && <span style={{ background: dm ? 'rgba(16,185,129,0.12)' : '#F0FDF4', color: '#10B981', fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 20 }}>{best.total_score} балл</span>}
                        </div>
                        <div style={{ fontWeight: 700, fontSize: 15, color: text, marginBottom: 8, lineHeight: 1.3 }}>{test.title}</div>
                        <div style={{ display: 'flex', gap: 14, marginBottom: 14 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: muted }}><Clock size={12} /> {test.time_limit_minutes} мин</div>
                          <div style={{ fontSize: 12, color: muted }}>{attempts}/{test.max_attempts === 0 ? '∞' : test.max_attempts} аракет</div>
                        </div>
                        <Btn onClick={() => canTake && openMock(test)} disabled={!canTake}
                          variant={canTake ? 'primary' : 'secondary'} style={{ width: '100%', justifyContent: 'center' }}>
                          {!canTake ? 'Аракет бүттү' : attempts === 0 ? 'Баштоо' : 'Кайра тапшыруу'}
                          {canTake && <ChevronRight size={14} />}
                        </Btn>
                      </Card>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ══ MOCK INTRO ══ */}
          {view === 'mock_intro' && activeMock && (
            <div className="fade" style={{ maxWidth: 480, margin: '0 auto' }}>
              <Card style={{ padding: '28px 24px' }}>
                <div style={{ width: 48, height: 48, background: sBg(activeMock.subject), borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                  <FileText size={22} color={sColor(activeMock.subject)} />
                </div>
                <div style={{ fontWeight: 800, fontSize: 18, color: text, marginBottom: 4, letterSpacing: '-0.3px' }}>{activeMock.title}</div>
                <div style={{ fontSize: 13, color: muted, marginBottom: 20 }}>{sLabel(activeMock.subject)}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 18 }}>
                  {[
                    { label: 'Убакыт', val: `${activeMock.time_limit_minutes} мүнөт` },
                    { label: 'Суроолор', val: `${mockQuestions.length} суроо` },
                    { label: 'Предмет', val: sLabel(activeMock.subject) },
                    { label: 'Аракет', val: `${getMockAttempts(activeMock.id) + 1}/${activeMock.max_attempts === 0 ? '∞' : activeMock.max_attempts}` },
                  ].map(s => (
                    <div key={s.label} style={{ background: dm ? '#1C2128' : '#F9FAFB', borderRadius: 10, padding: '11px 12px' }}>
                      <div style={{ fontSize: 10, color: light, marginBottom: 3, fontWeight: 500 }}>{s.label.toUpperCase()}</div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: text }}>{s.val}</div>
                    </div>
                  ))}
                </div>
                <div style={{ background: dm ? 'rgba(251,191,36,0.08)' : '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, padding: '10px 12px', marginBottom: 18, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <AlertCircle size={14} color="#D97706" style={{ flexShrink: 0, marginTop: 1 }} />
                  <span style={{ fontSize: 12, color: '#92400E', lineHeight: 1.5 }}>Убакыт башталганда токтотуу мүмкүн эмес. Убакыт бүткөндө автоматтуу тапшырылат.</span>
                </div>
                <Btn onClick={() => setView('mock_test')} style={{ width: '100%', justifyContent: 'center' }}>
                  Тестти баштоо <ChevronRight size={15} />
                </Btn>
              </Card>
            </div>
          )}

          {/* ══ MOCK TEST ══ */}
          {view === 'mock_test' && activeMock && (
            <MockTestView test={activeMock} questions={mockQuestions} answers={mockAnswers} setAnswers={setMockAnswers} onSubmit={submitMock} submitting={submitting} card={card} border={border} text={text} light={light} muted={muted} dm={dm} />
          )}

          {/* ══ MOCK RESULT ══ */}
          {view === 'mock_result' && mockResult && activeMock && (
            <div className="fade" style={{ maxWidth: 520, margin: '0 auto' }}>
              <Card style={{ padding: '28px 20px', textAlign: 'center' as const }}>
                <div style={{ width: 48, height: 48, background: mockResult.total_score >= goalScore ? '#F0FDF4' : '#EEF2FF', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                  <Award size={24} color={mockResult.total_score >= goalScore ? '#10B981' : BLUE} />
                </div>
                <div style={{ fontWeight: 700, fontSize: 14, color: text, marginBottom: 14 }}>{activeMock.title}</div>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                  <ScoreRing score={mockResult.total_score} max={145} size={88} />
                </div>
                <div style={{ fontSize: 13, color: muted, marginBottom: 18 }}>
                  {mockResult.total_score >= goalScore ? 'Максатка жеттиңиз!' : `Максатка дагы ${goalScore - mockResult.total_score} балл керек`}
                </div>
                {activeMock.subject === 'math' ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 18 }}>
                    {[{ label: 'Салыштыруу', val: mockResult.math_comparison_score }, { label: 'Математика', val: mockResult.math_raw_score }].map(s => (
                      <div key={s.label} style={{ background: dm ? '#1C2128' : '#F9FAFB', borderRadius: 10, padding: 12 }}>
                        <div style={{ fontSize: 10, color: light, marginBottom: 3 }}>{s.label.toUpperCase()}</div>
                        <div style={{ fontWeight: 800, fontSize: 18, color: text }}>{s.val}<span style={{ fontSize: 11, color: light, fontWeight: 400 }}>/30</span></div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 18 }}>
                    {[{ label: 'Аналогия', val: mockResult.analogy_score }, { label: 'Окуу', val: mockResult.reading_score }, { label: 'Грамматика', val: mockResult.grammar_score }].map(s => (
                      <div key={s.label} style={{ background: dm ? '#1C2128' : '#F9FAFB', borderRadius: 10, padding: 12 }}>
                        <div style={{ fontSize: 10, color: light, marginBottom: 3 }}>{s.label.toUpperCase()}</div>
                        <div style={{ fontWeight: 800, fontSize: 18, color: text }}>{s.val}<span style={{ fontSize: 11, color: light, fontWeight: 400 }}>/30</span></div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="rb" style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                  <Btn variant="secondary" onClick={() => setView('dashboard')}>Башкы бет</Btn>
                  <Btn variant="secondary" onClick={() => setView('mock_list')}>Тесттер</Btn>
                  {(activeMock.max_attempts === 0 || getMockAttempts(activeMock.id) < activeMock.max_attempts) && (
                    <Btn onClick={() => openMock(activeMock)}>Кайра</Btn>
                  )}
                </div>
              </Card>
            </div>
          )}

          {/* ══ PRACTICE ══ */}
          {view === 'practice' && (
            <div className="fade">
              <h2 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 6px', color: text, letterSpacing: '-0.3px' }}>Практика</h2>
              <p style={{ color: muted, fontSize: 13, margin: '0 0 16px' }}>Тема боюнча видео + тест</p>
              <div style={{ display: 'flex', background: dm ? '#1C2128' : '#F3F4F6', borderRadius: 10, padding: 3, gap: 3, marginBottom: 16, width: 'fit-content' as const }}>
                {(['math', 'kyr'] as const).map(s => (
                  <button key={s} onClick={() => { setPracticeSubject(s); fetchLessons(s) }}
                    style={{ padding: '7px 18px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: practiceSubject === s ? 700 : 500, cursor: 'pointer', background: practiceSubject === s ? sColor(s) : 'transparent', color: practiceSubject === s ? '#fff' : muted, transition: 'all 0.15s', fontFamily: 'Inter, sans-serif' }}>
                    {sLabel(s)}
                  </button>
                ))}
              </div>
              {lessons.length === 0 ? (
                <Card style={{ padding: '40px 20px', textAlign: 'center' as const }}>
                  <BookOpen size={32} color={light} style={{ margin: '0 auto 10px' }} />
                  <div style={{ fontWeight: 600, fontSize: 14, color: text }}>Сабак жок</div>
                </Card>
              ) : (
                <div className="g2" style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
                  {lessons.map((l, i) => {
                    const res = getLessonRes(l.id)
                    const color = sColor(practiceSubject)
                    return (
                      <div key={l.id} className="ch" onClick={() => openLesson(l)}
                        style={{ background: card, borderRadius: 12, border: `1px solid ${res?.passed ? '#BBF7D0' : border}`, padding: 16, cursor: 'pointer', transition: 'opacity 0.15s' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 11 }}>
                          <div style={{ width: 32, height: 32, background: res?.passed ? (dm ? 'rgba(16,185,129,0.12)' : '#F0FDF4') : sBg(practiceSubject), borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            {res?.passed ? <CheckCircle size={16} color="#10B981" /> : <span style={{ fontSize: 12, fontWeight: 800, color }}>{i + 1}</span>}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: 13, color: text, lineHeight: 1.3 }}>{l.title}</div>
                            {l.description && <div style={{ fontSize: 11, color: muted, marginTop: 2 }}>{l.description}</div>}
                          </div>
                          {res && (
                            <div style={{ textAlign: 'right' as const, flexShrink: 0 }}>
                              <div style={{ fontWeight: 700, fontSize: 12, color: res.passed ? '#10B981' : '#F59E0B' }}>{Math.round((res.score / res.total) * 100)}%</div>
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
              <h2 style={{ fontSize: 17, fontWeight: 800, marginBottom: 4, lineHeight: 1.3, color: text }}>{activeLesson.title}</h2>
              {activeLesson.description && <p style={{ color: muted, fontSize: 13, marginBottom: 14 }}>{activeLesson.description}</p>}
              {activeLesson.video_url && (
                <div style={{ borderRadius: 14, overflow: 'hidden', marginBottom: 16, background: '#000', aspectRatio: '16/9' }}>
                  <iframe src={getEmbed(activeLesson.video_url)} style={{ width: '100%', height: '100%', border: 'none' }} allowFullScreen title={activeLesson.title} />
                </div>
              )}
              {practiceTests.length > 0 && practiceTests.map(test => {
                const res = pResults.find(r => r.test_id === test.id)
                return (
                  <Card key={test.id} style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 36, height: 36, background: sBg(activeLesson.subject), borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <FileText size={17} color={sColor(activeLesson.subject)} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: text }}>{test.title}</div>
                      {test.time_limit_minutes && <div style={{ fontSize: 11, color: muted, marginTop: 1, display: 'flex', alignItems: 'center', gap: 3 }}><Clock size={11} /> {test.time_limit_minutes} мин</div>}
                    </div>
                    {res && <div style={{ fontWeight: 700, fontSize: 13, color: res.passed ? '#10B981' : '#F59E0B', flexShrink: 0 }}>{Math.round((res.score / res.total) * 100)}%</div>}
                    <Btn variant={res ? 'outline' : 'primary'} onClick={() => startPTest(test)}>
                      {res ? 'Кайра' : 'Баштоо'}
                    </Btn>
                  </Card>
                )
              })}
            </div>
          )}

          {/* ══ PRACTICE TEST ══ */}
          {view === 'practice_test' && activePTest && (
            <div className="fade">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: text }}>{activePTest.title}</h2>
                <div style={{ fontWeight: 700, fontSize: 12, color: BLUE, background: dm ? 'rgba(27,79,216,0.15)' : '#EEF2FF', padding: '3px 10px', borderRadius: 20 }}>{Object.keys(pAnswers).length}/{pQuestions.length}</div>
              </div>
              <div style={{ background: border, borderRadius: 999, height: 5, marginBottom: 16, overflow: 'hidden' }}>
                <div style={{ width: `${(Object.keys(pAnswers).length / pQuestions.length) * 100}%`, height: '100%', background: BLUE, borderRadius: 999, transition: 'width 0.3s' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {pQuestions.map((q, qi) => (
                  <Card key={q.id} style={{ padding: '14px 16px', border: `1px solid ${pAnswers[q.id] ? (dm ? 'rgba(27,79,216,0.35)' : '#BFDBFE') : border}` }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: text, marginBottom: 10, lineHeight: 1.5 }}>
                      <span style={{ color: BLUE, marginRight: 5, fontWeight: 800 }}>{qi + 1}.</span>
                      {q.image_url ? <img src={q.image_url} alt="q" style={{ maxHeight: 80, borderRadius: 8, display: 'block', marginTop: 6 }} /> : q.question_text}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {(['A','B','C','D'] as const).map(opt => {
                        const txt = (q as any)[`option_${opt.toLowerCase()}`]
                        const sel = pAnswers[q.id] === opt
                        return (
                          <button key={opt} onClick={() => setPAnswers(p => ({ ...p, [q.id]: opt }))}
                            style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 12px', borderRadius: 9, border: `1.5px solid ${sel ? BLUE : border}`, background: sel ? (dm ? 'rgba(27,79,216,0.12)' : '#EEF2FF') : (dm ? '#1C2128' : '#FAFBFF'), cursor: 'pointer', textAlign: 'left' as const, fontFamily: 'Inter, sans-serif', width: '100%' }}>
                            <div style={{ width: 18, height: 18, borderRadius: '50%', border: `2px solid ${sel ? BLUE : light}`, background: sel ? BLUE : 'transparent', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {sel && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />}
                            </div>
                            <span style={{ fontSize: 12, color: sel ? BLUE : text, fontWeight: sel ? 600 : 400, lineHeight: 1.4 }}>{txt}</span>
                          </button>
                        )
                      })}
                    </div>
                  </Card>
                ))}
              </div>
              <Btn onClick={submitPractice} disabled={submitting || Object.keys(pAnswers).length < pQuestions.length}
                variant={Object.keys(pAnswers).length < pQuestions.length ? 'secondary' : 'primary'}
                style={{ width: '100%', justifyContent: 'center', marginTop: 16 }}>
                {submitting ? 'Жөнөтүлүүдө...' : Object.keys(pAnswers).length < pQuestions.length ? `${pQuestions.length - Object.keys(pAnswers).length} суроо калды` : 'Тапшыруу'}
              </Btn>
            </div>
          )}

          {/* ══ PRACTICE RESULT ══ */}
          {view === 'practice_result' && pResult && (
            <div className="fade" style={{ maxWidth: 460, margin: '0 auto', textAlign: 'center' as const }}>
              <Card style={{ padding: '26px 20px', border: `2px solid ${pResult.passed ? '#BBF7D0' : '#FECACA'}` }}>
                <div style={{ width: 52, height: 52, background: pResult.passed ? '#F0FDF4' : '#FEF2F2', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                  {pResult.passed ? <CheckCircle size={26} color="#10B981" /> : <RotateCcw size={24} color="#EF4444" />}
                </div>
                <div style={{ fontWeight: 900, fontSize: 40, color: pResult.passed ? '#10B981' : '#EF4444', letterSpacing: '-2px', marginBottom: 4 }}>
                  {Math.round((pResult.score / pResult.total) * 100)}%
                </div>
                <div style={{ fontSize: 13, color: muted, marginBottom: 4 }}>{pResult.score}/{pResult.total} туура жооп</div>
                <div style={{ fontWeight: 700, fontSize: 13, color: pResult.passed ? '#10B981' : '#F59E0B', marginBottom: 18 }}>
                  {pResult.passed ? 'Тема өттүңүз' : 'Кайра аракет кылыңыз'}
                </div>
                {!pResult.passed && pResult.wrong.length > 0 && (
                  <div style={{ background: dm ? '#2D0B0B' : '#FEF2F2', borderRadius: 10, padding: '10px 12px', textAlign: 'left' as const, marginBottom: 16 }}>
                    <div style={{ fontWeight: 600, fontSize: 11, color: '#EF4444', marginBottom: 7 }}>КАТАЛАР</div>
                    {pResult.wrong.slice(0, 5).map(wi => (
                      <div key={wi} style={{ fontSize: 11, color: muted, marginBottom: 5, lineHeight: 1.5 }}>
                        <span style={{ color: '#EF4444', fontWeight: 700 }}>#{wi + 1}</span> {pQuestions[wi]?.question_text} — <span style={{ color: '#10B981', fontWeight: 600 }}>{(pQuestions[wi] as any)?.[`option_${pQuestions[wi]?.correct_answer?.toLowerCase()}`]}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="rb" style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                  <Btn variant="secondary" onClick={() => setView('lesson')}>Сабак</Btn>
                  <Btn variant="secondary" onClick={() => setView('practice')}>Практика</Btn>
                  {!pResult.passed && activePTest && <Btn onClick={() => startPTest(activePTest)}>Кайра</Btn>}
                </div>
              </Card>
            </div>
          )}

          {/* ══ MISTAKES ══ */}
          {view === 'mistakes' && (
            <div className="fade">
              <h2 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 6px', color: text, letterSpacing: '-0.3px' }}>Каталарды иштетүү</h2>
              <p style={{ color: muted, fontSize: 13, margin: '0 0 18px' }}>Акыркы тесттерден туура эмес жооп берилген суроолор</p>
              {mistakeQs.length === 0 ? (
                <Card style={{ padding: '40px 20px', textAlign: 'center' as const }}>
                  <CheckCircle size={32} color={light} style={{ margin: '0 auto 10px' }} />
                  <div style={{ fontWeight: 600, fontSize: 14, color: text }}>Ката жок</div>
                </Card>
              ) : !mistakeDone ? (
                <div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
                    {mistakeQs.map((q, qi) => (
                      <Card key={q.id} style={{ padding: '14px 16px' }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: text, marginBottom: 10, lineHeight: 1.5 }}>
                          <span style={{ color: '#EF4444', marginRight: 5, fontWeight: 800 }}>{qi + 1}.</span>{q.question_text}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {(['A','B','C','D'] as const).map(opt => {
                            const txt = (q as any)[`option_${opt.toLowerCase()}`]
                            const sel = mistakeAns[q.id] === opt
                            return (
                              <button key={opt} onClick={() => setMistakeAns(p => ({ ...p, [q.id]: opt }))}
                                style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 12px', borderRadius: 9, border: `1.5px solid ${sel ? BLUE : border}`, background: sel ? (dm ? 'rgba(27,79,216,0.12)' : '#EEF2FF') : (dm ? '#1C2128' : '#FAFBFF'), cursor: 'pointer', textAlign: 'left' as const, fontFamily: 'Inter, sans-serif', width: '100%' }}>
                                <div style={{ width: 18, height: 18, borderRadius: '50%', border: `2px solid ${sel ? BLUE : light}`, background: sel ? BLUE : 'transparent', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  {sel && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />}
                                </div>
                                <span style={{ fontSize: 12, color: sel ? BLUE : text, fontWeight: sel ? 600 : 400 }}>{txt}</span>
                              </button>
                            )
                          })}
                        </div>
                      </Card>
                    ))}
                  </div>
                  <Btn onClick={() => setMistakeDone(true)} disabled={Object.keys(mistakeAns).length < mistakeQs.length}
                    variant={Object.keys(mistakeAns).length < mistakeQs.length ? 'secondary' : 'primary'}
                    style={{ width: '100%', justifyContent: 'center' }}>
                    Текшерүү
                  </Btn>
                </div>
              ) : (
                <div>
                  <Card style={{ padding: '18px', marginBottom: 14, textAlign: 'center' as const }}>
                    <div style={{ fontWeight: 900, fontSize: 24, color: '#10B981' }}>
                      {mistakeQs.filter(q => mistakeAns[q.id] === q.correct_answer).length}/{mistakeQs.length}
                    </div>
                    <div style={{ fontSize: 13, color: muted, marginTop: 4 }}>туура жооп</div>
                  </Card>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Btn variant="secondary" onClick={() => setView('dashboard')} style={{ flex: 1, justifyContent: 'center' }}>Башкы бет</Btn>
                    <Btn onClick={() => { setMistakeAns({}); setMistakeDone(false) }} style={{ flex: 1, justifyContent: 'center' }}>Кайра</Btn>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══ PROFILE ══ */}
          {view === 'profile' && (
            <div className="fade">
              <h2 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 18px', color: text, letterSpacing: '-0.3px' }}>Профиль</h2>
              <Card style={{ padding: '20px', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18, paddingBottom: 18, borderBottom: `1px solid ${border}` }}>
                  <div style={{ width: 50, height: 50, background: 'linear-gradient(135deg,#1B4FD8,#6366F1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 20, fontWeight: 800, flexShrink: 0 }}>{profile?.full_name?.[0]}</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 16, color: text }}>{profile?.full_name}</div>
                    <div style={{ fontSize: 12, color: muted, marginTop: 2 }}>Онлайн студент · ЖРТ</div>
                    {streak > 0 && <div style={{ fontSize: 12, color: '#D97706', marginTop: 3, display: 'flex', alignItems: 'center', gap: 4 }}><Flame size={12} /> {streak} күн streak</div>}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {[{ label: 'АТЫ-ЖӨНҮ', val: profile?.full_name || '—' }, { label: 'ТЕЛЕФОН', val: profile?.phone || '—' }].map(f => (
                    <div key={f.label}>
                      <div style={{ fontSize: 10, color: light, fontWeight: 600, marginBottom: 4 }}>{f.label}</div>
                      <div style={{ fontWeight: 500, fontSize: 14, color: text }}>{f.val}</div>
                    </div>
                  ))}
                  <div>
                    <div style={{ fontSize: 10, color: light, fontWeight: 600, marginBottom: 6 }}>МЕКТЕП</div>
                    <input value={editSchool} onChange={e => setEditSchool(e.target.value)} placeholder="Мектебиңизди жазыңыз"
                      style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: `1px solid ${border}`, fontSize: 13, color: text, background: inputBg, outline: 'none', fontFamily: 'Inter, sans-serif' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: light, fontWeight: 600, marginBottom: 6 }}>МАКСАТ БАЛЛ</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input value={editGoal} onChange={e => setEditGoal(e.target.value)} type="number" min="100" max="270"
                        style={{ flex: 1, padding: '9px 12px', borderRadius: 9, border: `1px solid ${border}`, fontSize: 14, fontWeight: 700, color: BLUE, background: inputBg, outline: 'none', fontFamily: 'Inter, sans-serif' }} />
                      <Btn onClick={saveProfile} disabled={savingProfile}>{savingProfile ? '...' : 'Сактоо'}</Btn>
                    </div>
                  </div>
                </div>
              </Card>
              <div className="g3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
                {[
                  { label: 'Тест тапшырылды', val: mockResults.length, color: BLUE },
                  { label: 'Орточо балл', val: avgScore || '—', color: '#10B981' },
                  { label: 'Практика өттү', val: `${mathPassed + kyrPassed}/${allLessons.length}`, color: '#7C3AED' },
                ].map(s => (
                  <Card key={s.label} style={{ padding: 14, textAlign: 'center' as const }}>
                    <div style={{ fontWeight: 800, fontSize: 20, color: s.color }}>{s.val}</div>
                    <div style={{ fontSize: 10, color: light, marginTop: 3 }}>{s.label}</div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* ══ SETTINGS ══ */}
          {view === 'settings' && (
            <div className="fade">
              <h2 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 18px', color: text, letterSpacing: '-0.3px' }}>Орнотуулар</h2>
              <Card style={{ overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: `1px solid ${border}` }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: text }}>Түнкү режим</div>
                    <div style={{ fontSize: 11, color: muted, marginTop: 1 }}>Карангы фон</div>
                  </div>
                  <div onClick={() => setDarkMode(p => !p)}
                    style={{ width: 44, height: 24, borderRadius: 12, background: darkMode ? BLUE : border, cursor: 'pointer', position: 'relative' as const, transition: 'background 0.2s', flexShrink: 0 }}>
                    <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff', position: 'absolute' as const, top: 3, left: darkMode ? 23 : 3, transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                  </div>
                </div>
                <div style={{ padding: '14px 18px' }}>
                  <Btn variant="danger" onClick={async () => { await supabase.auth.signOut(); router.push('/') }} style={{ width: '100%', justifyContent: 'center' }}>
                    <LogOut size={14} /> Системадан чыгуу
                  </Btn>
                </div>
              </Card>
            </div>
          )}

        </div>
      </main>

      {/* Bottom Nav */}
      <div className="bnav" style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: card, borderTop: `1px solid ${border}`, display: 'none', zIndex: 200, paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {[
          { id: 'dashboard', Icon: Home, label: 'Башкы' },
          { id: 'mock_list', Icon: ClipboardList, label: 'Тест' },
          { id: 'practice', Icon: Target, label: 'Практика' },
          { id: 'analytics', Icon: BarChart2, label: 'Аналитика' },
          { id: 'profile', Icon: User, label: 'Профиль' },
        ].map(({ id, Icon, label }) => {
          const active = view === id ||
            (id === 'mock_list' && ['mock_intro','mock_test','mock_result'].includes(view)) ||
            (id === 'practice' && ['lesson','practice_test','practice_result'].includes(view))
          return (
            <button key={id} onClick={() => navTo(id)}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '7px 4px', border: 'none', background: 'transparent', cursor: 'pointer', color: active ? BLUE : light }}>
              <Icon size={20} strokeWidth={active ? 2.5 : 1.8} />
              <div style={{ fontSize: 9, fontWeight: active ? 700 : 500, marginTop: 3 }}>{label}</div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Mock Test View ───────────────────────────────────────────────────────────
function MockTestView({ test, questions, answers, setAnswers, onSubmit, submitting, card, border, text, light, muted, dm }: {
  test: MockTest; questions: Question[]; answers: Record<string, string>
  setAnswers: (a: Record<string, string>) => void; onSubmit: () => void; submitting: boolean
  card: string; border: string; text: string; light: string; muted: string; dm: boolean
}) {
  const totalSecs = test.time_limit_minutes * 60
  const { left, start } = useTimer(totalSecs, onSubmit)
  const [activeQ, setActiveQ] = useState(0)
  const BLUE = '#1B4FD8'
  useEffect(() => { start() }, [])
  const q = questions[activeQ]

  return (
    <div>
      <div style={{ background: card, borderRadius: 12, border: `1px solid ${border}`, padding: '12px 16px', marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: text }}>{test.title}</div>
          <div style={{ fontWeight: 700, fontSize: 12, color: BLUE }}>{Object.keys(answers).length}/{questions.length}</div>
        </div>
        <TimerDisplay left={left} total={totalSecs} />
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 4, marginBottom: 12 }}>
        {questions.map((q, i) => (
          <button key={i} onClick={() => setActiveQ(i)}
            style={{ width: 30, height: 30, borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700,
              background: answers[q.id] ? BLUE : i === activeQ ? (dm ? 'rgba(27,79,216,0.2)' : '#EEF2FF') : (dm ? '#1C2128' : '#F3F4F6'),
              color: answers[q.id] ? '#fff' : i === activeQ ? BLUE : light,
              outline: i === activeQ ? `2px solid ${BLUE}` : 'none',
              fontFamily: 'Inter, sans-serif' }}>
            {i + 1}
          </button>
        ))}
      </div>

      {q && (
        <div style={{ background: card, borderRadius: 12, border: `1px solid ${answers[q.id] ? (dm ? 'rgba(27,79,216,0.3)' : '#BFDBFE') : border}`, padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
            <span style={{ fontWeight: 800, fontSize: 12, color: BLUE }}>#{activeQ + 1}</span>
            {q.section && q.section !== 'general' && (
              <span style={{ background: dm ? 'rgba(27,79,216,0.15)' : '#EEF2FF', color: BLUE, fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 20 }}>
                {q.section === 'comparison' ? 'Салыштыруу' : q.section === 'math' ? 'Математика' : q.section === 'analogy' ? 'Аналогия' : q.section === 'reading' ? 'Окуу' : 'Грамматика'}
              </span>
            )}
          </div>
          {q.image_url ? <img src={q.image_url} alt="q" style={{ maxWidth: '100%', maxHeight: 180, borderRadius: 9, marginBottom: 10, display: 'block' }} />
            : <div style={{ fontWeight: 600, fontSize: 13, color: text, marginBottom: 10, lineHeight: 1.6 }}>{q.question_text}</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {(['A','B','C','D'] as const).map(opt => {
              const txt = (q as any)[`option_${opt.toLowerCase()}`]
              const sel = answers[q.id] === opt
              return (
                <button key={opt} onClick={() => setAnswers({ ...answers, [q.id]: opt })}
                  style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 12px', borderRadius: 9, border: `1.5px solid ${sel ? BLUE : border}`, background: sel ? (dm ? 'rgba(27,79,216,0.12)' : '#EEF2FF') : (dm ? '#1C2128' : '#FAFBFF'), cursor: 'pointer', textAlign: 'left' as const, fontFamily: 'Inter, sans-serif', width: '100%' }}>
                  <div style={{ width: 18, height: 18, borderRadius: '50%', border: `2px solid ${sel ? BLUE : light}`, background: sel ? BLUE : 'transparent', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {sel && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />}
                  </div>
                  <span style={{ fontSize: 12, color: sel ? BLUE : text, fontWeight: sel ? 600 : 400, lineHeight: 1.4 }}>{txt}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        {activeQ > 0 && (
          <button onClick={() => setActiveQ(p => p - 1)} style={{ flex: 1, background: dm ? '#1C2128' : '#F3F4F6', color: muted, border: 'none', borderRadius: 10, padding: '11px', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'Inter, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
            <ChevronLeft size={15} /> Артка
          </button>
        )}
        {activeQ < questions.length - 1
          ? <button onClick={() => setActiveQ(p => p + 1)} style={{ flex: 1, background: BLUE, color: '#fff', border: 'none', borderRadius: 10, padding: '11px', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'Inter, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
              Кийинки <ChevronRight size={15} />
            </button>
          : <button onClick={onSubmit} disabled={submitting} style={{ flex: 1, background: Object.keys(answers).length === questions.length ? '#10B981' : '#F59E0B', color: '#fff', border: 'none', borderRadius: 10, padding: '11px', fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
              {submitting ? 'Жөнөтүлүүдө...' : Object.keys(answers).length < questions.length ? `${questions.length - Object.keys(answers).length} жооп жок` : 'Тапшыруу'}
            </button>}
      </div>
    </div>
  )
}