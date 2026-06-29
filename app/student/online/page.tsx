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
         | 'analytics' | 'profile' | 'mistakes'

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
  const now = new Date()
  return Math.ceil((next.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

// ─── Timer hook ───────────────────────────────────────────────────────────────
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
  const stop = () => { if (ref.current) clearInterval(ref.current) }
  useEffect(() => () => stop(), [])
  return { left, start, stop }
}

// ─── Components ───────────────────────────────────────────────────────────────
function TimerBar({ left, total }: { left: number; total: number }) {
  const pct = (left / total) * 100
  const mm = Math.floor(left / 60), ss = String(left % 60).padStart(2, '0')
  const crit = left < 600
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ fontSize: 18, fontWeight: 900, color: crit ? '#EF4444' : '#1B4FD8', minWidth: 56, fontVariantNumeric: 'tabular-nums' }}>{mm}:{ss}</div>
      <div style={{ flex: 1, background: '#E2E8F0', borderRadius: 999, height: 6, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: crit ? '#EF4444' : '#1B4FD8', borderRadius: 999, transition: 'width 1s linear' }} />
      </div>
    </div>
  )
}

function ScoreRing({ score, max = 145, size = 80 }: { score: number; max?: number; size?: number }) {
  const r = (size - 8) / 2, circ = 2 * Math.PI * r
  const pct = Math.min(score / max, 1)
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

function ProgressBar({ value, max, color = '#1B4FD8', height = 8 }: { value: number; max: number; color?: string; height?: number }) {
  return (
    <div style={{ background: '#E2E8F0', borderRadius: 999, height, overflow: 'hidden' }}>
      <div style={{ width: `${max > 0 ? Math.min((value / max) * 100, 100) : 0}%`, height: '100%', background: color, borderRadius: 999, transition: 'width 0.6s ease' }} />
    </div>
  )
}

const BLUE = '#1B4FD8', BG = '#F8FAFF'
const subjectColor = (s: 'math' | 'kyr') => s === 'math' ? '#1B4FD8' : '#7C3AED'
const subjectBg    = (s: 'math' | 'kyr') => s === 'math' ? '#EEF2FF' : '#F5F3FF'
const subjectLabel = (s: 'math' | 'kyr') => s === 'math' ? 'Математика' : 'Кыргыз тили'

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function OnlineStudentPage() {
  const [profile, setProfile]   = useState<Profile | null>(null)
  const [view, setView]         = useState<View>('dashboard')
  const [loading, setLoading]   = useState(true)
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
  // Profile edit
  const [editGoal, setEditGoal]       = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  // Mistakes
  const [mistakeQuestions, setMistakeQuestions] = useState<Question[]>([])
  const [mistakeAnswers, setMistakeAnswers] = useState<Record<string, string>>({})
  const [mistakeDone, setMistakeDone] = useState(false)

  const router = useRouter()

  useEffect(() => { checkAuth() }, [])

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (!prof || prof.role !== 'student') { router.push('/'); return }
    setProfile(prof)
    setEditGoal(prof.goal_score || '190')
    await Promise.all([
      fetchMockTests(user.id),
      fetchAllLessons(),
      fetchAllPResults(user.id),
    ])
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
    setActiveLesson(lesson)
    setPResult(null); setPAnswers({})
    const [{ data: tests }, { data: results }] = await Promise.all([
      supabase.from('practice_tests').select('*').eq('lesson_id', lesson.id).eq('type', 'practice'),
      supabase.from('practice_results').select('*').eq('student_id', profile!.id).eq('lesson_id', lesson.id).order('created_at', { ascending: false }),
    ])
    setPracticeTests(tests || [])
    setPResults(results || [])
    setView('lesson')
  }

  const startPracticeTest = async (test: PracticeTest) => {
    const { data } = await supabase.from('questions').select('*').eq('practice_test_id', test.id).order('order_num')
    setPQuestions(data || [])
    setPAnswers({})
    setActivePTest(test)
    setView('practice_test')
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
    const sc = (qs: Question[]) => qs.filter(q => mockAnswers[q.id] === q.correct_answer).length
    let math_comparison_score = 0, math_raw_score = 0, analogy_score = 0, reading_score = 0, grammar_score = 0, total_score = 0
    if (activeMock.subject === 'math') {
      math_comparison_score = sc(sections.comparison)
      math_raw_score = sc(sections.math)
      total_score = calcScore(math_comparison_score + math_raw_score, 0, 0, 0)
    } else {
      analogy_score = sc(sections.analogy)
      reading_score = sc(sections.reading)
      grammar_score = sc(sections.grammar)
      total_score = calcScore(0, analogy_score, reading_score, grammar_score)
    }
    const attempts = mockResults.filter(r => r.test_id === activeMock.id).length + 1
    const { data } = await supabase.from('practice_results').insert({
      student_id: profile.id, test_id: activeMock.id, test_type: 'mock',
      math_comparison_score, math_raw_score, analogy_score, reading_score, grammar_score,
      total_score, attempt_number: attempts,
    }).select().single()
    if (data) setMockResult(data)
    await fetchMockTests(profile.id)
    setSubmitting(false)
    setView('mock_result')
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
    setSubmitting(false)
    setView('practice_result')
  }

  const loadMistakes = async () => {
    if (!profile) return
    // акыркы тесттерден туура эмес жооп берилген суроолорду жый
    const { data: results } = await supabase
      .from('practice_results')
      .select('test_id')
      .eq('student_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(10)
    if (!results || results.length === 0) return
    const testIds = [...new Set(results.map(r => r.test_id))]
    const { data: qs } = await supabase.from('questions').select('*').in('practice_test_id', testIds).limit(30)
    setMistakeQuestions(qs || [])
    setMistakeAnswers({})
    setMistakeDone(false)
    setView('mistakes')
  }

  const saveProfile = async () => {
    if (!profile) return
    setSavingProfile(true)
    await supabase.from('profiles').update({ goal_score: Number(editGoal) }).eq('id', profile.id)
    setProfile(p => p ? { ...p, goal_score: Number(editGoal) } : p)
    setSavingProfile(false)
  }

  // ── Derived stats ──────────────────────────────────────────────────────────
  const getMockAttempts = (id: string) => mockResults.filter(r => r.test_id === id).length
  const getBestMock = (id: string) => {
    const r = mockResults.filter(r => r.test_id === id)
    return r.length > 0 ? r.reduce((b, c) => c.total_score > b.total_score ? c : b) : null
  }
  const getLessonResult = (lessonId: string) => allPResults.find(r => r.lesson_id === lessonId)

  const avgScore = mockResults.length > 0
    ? Math.round(mockResults.reduce((s, r) => s + r.total_score, 0) / mockResults.length) : 0
  const bestScore = mockResults.length > 0 ? Math.max(...mockResults.map(r => r.total_score)) : 0
  const lastScore = mockResults.length > 0 ? mockResults[mockResults.length - 1]?.total_score : 0
  const goalScore = profile?.goal_score || 190

  const mathLessons = allLessons.filter(l => l.subject === 'math')
  const kyrLessons  = allLessons.filter(l => l.subject === 'kyr')
  const mathPassed  = mathLessons.filter(l => getLessonResult(l.id)?.passed).length
  const kyrPassed   = kyrLessons.filter(l => getLessonResult(l.id)?.passed).length
  const mathPct = mathLessons.length > 0 ? Math.round((mathPassed / mathLessons.length) * 100) : 0
  const kyrPct  = kyrLessons.length  > 0 ? Math.round((kyrPassed  / kyrLessons.length)  * 100) : 0
  const overallPct = allLessons.length > 0
    ? Math.round(((mathPassed + kyrPassed) / allLessons.length) * 100) : 0

  const chartData = mockResults.slice(-8).map((r, i) => ({
    name: `№${i + 1}`, балл: r.total_score,
  }))

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: BG, fontFamily: 'Inter, sans-serif' }}>
      <div style={{ color: '#94A3B8', fontSize: 14 }}>Жүктөлүүдө...</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: BG, fontFamily: 'Inter, -apple-system, sans-serif', color: '#0D1E4A' }}>
      <style>{`
        *{box-sizing:border-box}
        @keyframes fadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
        .fade{animation:fadeIn 0.3s ease both}
        @media(hover:hover){.ch:hover{transform:translateY(-2px)!important;box-shadow:0 6px 20px rgba(27,79,216,0.1)!important}}
        .ch{transition:all 0.2s}
        @media(max-width:640px){
          .nav-inner{padding:0 14px!important;height:54px!important}
          .nav-name{display:none!important}
          .page-pad{padding:16px 14px 80px!important}
          .stats-g{grid-template-columns:1fr 1fr!important;gap:10px!important}
          .prog-g{grid-template-columns:1fr!important}
          .mock-g{grid-template-columns:1fr!important}
          .lesson-g{grid-template-columns:1fr!important}
          .score-g{grid-template-columns:1fr 1fr!important}
          .rb{flex-direction:column!important}
          .rb button{width:100%!important}
          .dash-actions{grid-template-columns:1fr 1fr!important}
        }
        .bnav{display:none}
        @media(max-width:640px){.bnav{display:flex!important;position:fixed;bottom:0;left:0;right:0;background:#fff;border-top:1px solid #E2E8F0;z-index:200;padding-bottom:env(safe-area-inset-bottom)}}
      `}</style>

      {/* ── NAVBAR ── */}
      <nav style={{ background: '#fff', borderBottom: '1px solid #E2E8F0', position: 'sticky', top: 0, zIndex: 100 }}>
        <div className="nav-inner" style={{ maxWidth: 920, margin: '0 auto', padding: '0 24px', height: 58, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {!['dashboard', 'practice', 'mock_list', 'analytics', 'profile', 'mistakes'].includes(view) && (
              <button onClick={() => {
                if (['mock_intro','mock_result'].includes(view)) setView('mock_list')
                else if (view === 'mock_test') { if (confirm('Тестти токтотосузбу?')) setView('mock_list') }
                else if (view === 'lesson') setView('practice')
                else if (['practice_test','practice_result'].includes(view)) setView('lesson')
              }} style={{ background: '#F8FAFF', border: '1px solid #E2E8F0', borderRadius: 8, padding: '5px 11px', fontSize: 13, cursor: 'pointer', color: '#64748B' }}>← Артка</button>
            )}
            <div style={{ width: 30, height: 30, background: BLUE, borderRadius: 7, overflow: 'hidden', flexShrink: 0 }}>
              <img src="/images/logo.png" alt="Z" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <span style={{ fontWeight: 900, fontSize: 15 }}>Zhangak</span>
            <span style={{ fontWeight: 800, fontSize: 10, color: BLUE, background: '#EEF2FF', padding: '2px 7px', borderRadius: 5 }}>ЖРТ</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={() => setView('profile')} style={{ background: '#F1F5F9', borderRadius: 9, padding: '4px 10px', border: 'none', display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer' }}>
              <div style={{ width: 22, height: 22, background: BLUE, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 10, fontWeight: 800 }}>{profile?.full_name?.[0]}</div>
              <span className="nav-name" style={{ fontSize: 12, fontWeight: 600 }}>{profile?.full_name}</span>
            </button>
            <button onClick={async () => { await supabase.auth.signOut(); router.push('/') }} style={{ background: 'none', border: '1px solid #E2E8F0', borderRadius: 7, padding: '5px 10px', fontSize: 12, color: '#64748B', cursor: 'pointer' }}>Чыгуу</button>
          </div>
        </div>
      </nav>

      {/* ── CONTENT ── */}
      <div className="page-pad" style={{ maxWidth: 920, margin: '0 auto', padding: '24px 20px' }}>

        {/* ══ DASHBOARD ══ */}
        {view === 'dashboard' && (
          <div className="fade">
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
              <div>
                <h1 style={{ fontSize: 'clamp(18px,5vw,22px)', fontWeight: 900, margin: 0 }}>
                  Саламатсызбы, {profile?.full_name?.split(' ')[0]} 👋
                </h1>
                <p style={{ color: '#64748B', fontSize: 13, margin: '4px 0 0' }}>ЖРТга даярдануу платформасы</p>
              </div>
              {/* JRT countdown */}
              <div style={{ background: 'linear-gradient(135deg,#1B4FD8,#6366F1)', borderRadius: 14, padding: '10px 18px', textAlign: 'center', flexShrink: 0 }}>
                <div style={{ fontWeight: 900, fontSize: 26, color: '#fff', letterSpacing: '-1px' }}>{daysUntilJRT()}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', fontWeight: 600 }}>күн калды</div>
              </div>
            </div>

            {/* Stats */}
            <div className="stats-g" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 16 }}>
              {[
                { label: 'Акыркы балл', val: lastScore || '—', color: BLUE, icon: '📝' },
                { label: 'Орточо балл', val: avgScore || '—', color: '#10B981', icon: '📊' },
                { label: 'Эң жогорку', val: bestScore || '—', color: '#F59E0B', icon: '🏆' },
                { label: 'Максат', val: goalScore, color: '#7C3AED', icon: '🎯' },
              ].map(s => (
                <div key={s.label} style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 14, padding: '14px 16px' }}>
                  <div style={{ fontSize: 18, marginBottom: 6 }}>{s.icon}</div>
                  <div style={{ fontWeight: 900, fontSize: 22, color: s.color, letterSpacing: '-0.5px' }}>{s.val}</div>
                  <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Goal progress */}
            {lastScore > 0 && (
              <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', padding: '18px 20px', marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>Максатка жакындоо</div>
                    <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>Азыр: {lastScore} · Максат: {goalScore} · Дагы керек: {Math.max(goalScore - lastScore, 0)} балл</div>
                  </div>
                  <div style={{ fontWeight: 900, fontSize: 18, color: lastScore >= goalScore ? '#10B981' : BLUE }}>
                    {Math.round((lastScore / goalScore) * 100)}%
                  </div>
                </div>
                <ProgressBar value={lastScore} max={goalScore} color={lastScore >= goalScore ? '#10B981' : BLUE} height={10} />
              </div>
            )}

            {/* Score chart */}
            {chartData.length > 1 && (
              <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', padding: '18px 20px', marginBottom: 16 }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>📈 Баллдын өсүшү</div>
                <ResponsiveContainer width="100%" height={140}>
                  <LineChart data={chartData}>
                    <XAxis dataKey="name" tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
                    <Tooltip contentStyle={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 10, fontSize: 12 }} formatter={(v: any) => [v + ' балл', 'Натыйжа']} />
                    <Line type="monotone" dataKey="балл" stroke={BLUE} strokeWidth={2.5} dot={{ fill: BLUE, r: 4 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Practice progress */}
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', padding: '18px 20px', marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>📚 Практика прогрессу</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  { label: 'Математика', passed: mathPassed, total: mathLessons.length, pct: mathPct, color: BLUE },
                  { label: 'Кыргыз тили', passed: kyrPassed, total: kyrLessons.length, pct: kyrPct, color: '#7C3AED' },
                ].map(s => (
                  <div key={s.label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{s.label}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: s.color }}>{s.passed}/{s.total} · {s.pct}%</span>
                    </div>
                    <ProgressBar value={s.passed} max={s.total || 1} color={s.color} height={7} />
                  </div>
                ))}
              </div>
            </div>

            {/* Quick actions */}
            <div className="dash-actions" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 16 }}>
              {[
                { label: 'Сынамык тест', icon: '📋', color: BLUE, bg: '#EEF2FF', action: () => setView('mock_list') },
                { label: 'Практика', icon: '🎯', color: '#7C3AED', bg: '#F5F3FF', action: () => { setView('practice'); fetchLessons('math') } },
                { label: 'Каталар', icon: '🔁', color: '#EF4444', bg: '#FEF2F2', action: loadMistakes },
                { label: 'Аналитика', icon: '📊', color: '#10B981', bg: '#F0FDF4', action: () => setView('analytics') },
              ].map(a => (
                <div key={a.label} className="ch" onClick={a.action}
                  style={{ background: a.bg, borderRadius: 14, padding: '16px 12px', textAlign: 'center', cursor: 'pointer', border: `1px solid ${a.color}22` }}>
                  <div style={{ fontSize: 24, marginBottom: 6 }}>{a.icon}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: a.color }}>{a.label}</div>
                </div>
              ))}
            </div>

            {/* Last results */}
            {mockResults.length > 0 && (
              <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
                <div style={{ padding: '14px 18px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>Акыркы натыйжалар</div>
                  <button onClick={() => setView('mock_list')} style={{ background: 'none', border: 'none', color: BLUE, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Баарын көрүү →</button>
                </div>
                {mockResults.slice(-5).reverse().map(r => {
                  const test = mockTests.find(t => t.id === r.test_id)
                  return (
                    <div key={r.id} style={{ display: 'flex', alignItems: 'center', padding: '11px 18px', borderBottom: '1px solid #F1F5F9', gap: 12 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{test?.title || 'Сынамык тест'}</div>
                        <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 1 }}>{new Date(r.created_at).toLocaleDateString('ru')}</div>
                      </div>
                      <div style={{ fontWeight: 900, fontSize: 18, color: r.total_score >= goalScore ? '#10B981' : r.total_score >= 140 ? '#F59E0B' : BLUE, flexShrink: 0 }}>{r.total_score}</div>
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
              <h2 style={{ fontSize: 20, fontWeight: 900, margin: 0 }}>📊 Аналитика</h2>
              <p style={{ color: '#64748B', fontSize: 13, margin: '4px 0 0' }}>Кайсы темалардан кыйналып жатасың</p>
            </div>

            {mockResults.length === 0 ? (
              <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', padding: '40px 20px', textAlign: 'center', color: '#94A3B8' }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>📊</div>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#0D1E4A' }}>Маалымат жок</div>
                <div style={{ fontSize: 13, marginTop: 4 }}>Тест тапшыргандан кийин аналитика пайда болот</div>
              </div>
            ) : (
              <div>
                {/* Score dynamics */}
                {chartData.length > 1 && (
                  <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', padding: '18px 20px', marginBottom: 14 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>📈 Баллдын динамикасы</div>
                    <ResponsiveContainer width="100%" height={160}>
                      <LineChart data={chartData}>
                        <XAxis dataKey="name" tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
                        <Tooltip contentStyle={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 10, fontSize: 12 }} formatter={(v: any) => [v + ' балл', 'Натыйжа']} />
                        <Line type="monotone" dataKey="балл" stroke={BLUE} strokeWidth={2.5} dot={{ fill: BLUE, r: 4 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Section breakdown — avg */}
                <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', padding: '18px 20px', marginBottom: 14 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>Предмет боюнча орточо</div>
                  {[
                    { label: 'Математика (салыштыруу)', key: 'math_comparison_score' as keyof MockResult, max: 30, color: BLUE },
                    { label: 'Математика (чыгарма)', key: 'math_raw_score' as keyof MockResult, max: 30, color: '#0EA5E9' },
                    { label: 'Аналогия', key: 'analogy_score' as keyof MockResult, max: 30, color: '#7C3AED' },
                    { label: 'Окуу жана түшүнүү', key: 'reading_score' as keyof MockResult, max: 30, color: '#059669' },
                    { label: 'Грамматика', key: 'grammar_score' as keyof MockResult, max: 30, color: '#D97706' },
                  ].map(s => {
                    const vals = mockResults.filter(r => (r[s.key] as number) > 0).map(r => r[s.key] as number)
                    const avg = vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0
                    const pct = Math.round((avg / s.max) * 100)
                    return (
                      <div key={s.label} style={{ marginBottom: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                          <span style={{ fontSize: 13, fontWeight: 500 }}>{s.label}</span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: pct >= 70 ? '#10B981' : pct >= 50 ? '#F59E0B' : '#EF4444' }}>
                            {avg}/{s.max} · {pct}%
                          </span>
                        </div>
                        <ProgressBar value={avg} max={s.max} color={pct >= 70 ? '#10B981' : pct >= 50 ? '#F59E0B' : '#EF4444'} height={7} />
                      </div>
                    )
                  })}
                </div>

                {/* Stats summary */}
                <div className="stats-g" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
                  {[
                    { label: 'Жалпы тест', val: mockResults.length, color: BLUE },
                    { label: 'Орточо балл', val: avgScore, color: '#10B981' },
                    { label: 'Эң жогорку', val: bestScore, color: '#F59E0B' },
                  ].map(s => (
                    <div key={s.label} style={{ background: '#fff', borderRadius: 14, border: '1px solid #E2E8F0', padding: '16px', textAlign: 'center' }}>
                      <div style={{ fontWeight: 900, fontSize: 24, color: s.color }}>{s.val}</div>
                      <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 3 }}>{s.label}</div>
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
              <h2 style={{ fontSize: 20, fontWeight: 900, margin: 0 }}>📋 Сынамык тесттер</h2>
              <p style={{ color: '#64748B', fontSize: 13, margin: '4px 0 0' }}>ЖРТ форматындагы тесттер — убакыт менен</p>
            </div>
            {mockTests.length === 0 ? (
              <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', padding: '40px 20px', textAlign: 'center', color: '#94A3B8' }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>📋</div>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#0D1E4A' }}>Тест жок</div>
                <div style={{ fontSize: 13, marginTop: 4 }}>Администратор тест кошкондон кийин пайда болот</div>
              </div>
            ) : (
              <div className="mock-g" style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 14 }}>
                {mockTests.map(test => {
                  const attempts = getMockAttempts(test.id)
                  const best = getBestMock(test.id)
                  const canTake = test.max_attempts === 0 || attempts < test.max_attempts
                  const color = subjectColor(test.subject)
                  return (
                    <div key={test.id} style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', padding: 20 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                        <span style={{ background: subjectBg(test.subject), color, fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 20 }}>
                          {subjectLabel(test.subject)}
                        </span>
                        {best && <span style={{ background: '#F0FDF4', color: '#10B981', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>Эң жогорку: {best.total_score}</span>}
                      </div>
                      <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 8 }}>{test.title}</div>
                      <div style={{ display: 'flex', gap: 14, marginBottom: 14 }}>
                        <div style={{ fontSize: 12, color: '#94A3B8' }}>⏱ {test.time_limit_minutes} мин</div>
                        <div style={{ fontSize: 12, color: '#94A3B8' }}>📌 {attempts}/{test.max_attempts === 0 ? '∞' : test.max_attempts} аракет</div>
                      </div>
                      <button onClick={() => canTake && openMock(test)} disabled={!canTake}
                        style={{ width: '100%', background: canTake ? color : '#E2E8F0', color: canTake ? '#fff' : '#94A3B8', border: 'none', borderRadius: 11, padding: 11, fontWeight: 700, fontSize: 13, cursor: canTake ? 'pointer' : 'not-allowed' }}>
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
            <div style={{ background: '#fff', borderRadius: 22, border: '1px solid #E2E8F0', padding: '32px 26px', textAlign: 'center' }}>
              <div style={{ fontSize: 44, marginBottom: 14 }}>📋</div>
              <div style={{ fontWeight: 900, fontSize: 20, marginBottom: 6 }}>{activeMock.title}</div>
              <div style={{ fontSize: 13, color: '#64748B', marginBottom: 22 }}>{subjectLabel(activeMock.subject)}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 22 }}>
                {[
                  { label: 'Убакыт', val: `${activeMock.time_limit_minutes} мүнөт` },
                  { label: 'Суроолор', val: `${mockQuestions.length} суроо` },
                  { label: 'Предмет', val: subjectLabel(activeMock.subject) },
                  { label: 'Аракет', val: `${getMockAttempts(activeMock.id) + 1}/${activeMock.max_attempts === 0 ? '∞' : activeMock.max_attempts}` },
                ].map(s => (
                  <div key={s.label} style={{ background: '#F8FAFF', borderRadius: 12, padding: 14 }}>
                    <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 4 }}>{s.label}</div>
                    <div style={{ fontWeight: 800, fontSize: 15 }}>{s.val}</div>
                  </div>
                ))}
              </div>
              <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 12, padding: '11px 14px', marginBottom: 20, textAlign: 'left', fontSize: 13, color: '#92400E' }}>
                ⚠️ Убакыт башталганда токтотуу мүмкүн эмес. Убакыт бүткөндө автоматтуу тапшырылат.
              </div>
              <button onClick={() => setView('mock_test')}
                style={{ width: '100%', background: subjectColor(activeMock.subject), color: '#fff', border: 'none', borderRadius: 13, padding: 14, fontWeight: 900, fontSize: 15, cursor: 'pointer' }}>
                🚀 Тестти баштоо
              </button>
            </div>
          </div>
        )}

        {/* ══ MOCK TEST ══ */}
        {view === 'mock_test' && activeMock && (
          <MockTestView test={activeMock} questions={mockQuestions} answers={mockAnswers} setAnswers={setMockAnswers} onSubmit={submitMock} submitting={submitting} />
        )}

        {/* ══ MOCK RESULT ══ */}
        {view === 'mock_result' && mockResult && activeMock && (
          <div className="fade" style={{ maxWidth: 580, margin: '0 auto' }}>
            <div style={{ background: '#fff', borderRadius: 22, border: '1px solid #E2E8F0', padding: '30px 22px', textAlign: 'center' }}>
              <div style={{ fontSize: 44, marginBottom: 10 }}>{mockResult.total_score >= goalScore ? '🎉' : mockResult.total_score >= 140 ? '💪' : '📚'}</div>
              <div style={{ fontWeight: 900, fontSize: 15, marginBottom: 16 }}>{activeMock.title}</div>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
                <ScoreRing score={mockResult.total_score} max={145} size={96} />
              </div>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#64748B', marginBottom: 20 }}>
                {mockResult.total_score >= goalScore ? '🎯 Максатка жеттиңиз!' : `Максатка дагы ${goalScore - mockResult.total_score} балл керек`}
              </div>
              {activeMock.subject === 'math' ? (
                <div className="score-g" style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10, marginBottom: 20 }}>
                  {[
                    { label: 'Салыштыруу', val: mockResult.math_comparison_score, max: 30, color: BLUE },
                    { label: 'Математика', val: mockResult.math_raw_score, max: 30, color: '#0EA5E9' },
                  ].map(s => (
                    <div key={s.label} style={{ background: '#F8FAFF', borderRadius: 12, padding: 14 }}>
                      <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 4 }}>{s.label}</div>
                      <div style={{ fontWeight: 900, fontSize: 20, color: s.color }}>{s.val}<span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 400 }}>/{s.max}</span></div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="score-g" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 20 }}>
                  {[
                    { label: 'Аналогия', val: mockResult.analogy_score, max: 30, color: '#7C3AED' },
                    { label: 'Окуу', val: mockResult.reading_score, max: 30, color: '#059669' },
                    { label: 'Грамматика', val: mockResult.grammar_score, max: 30, color: '#D97706' },
                  ].map(s => (
                    <div key={s.label} style={{ background: '#F8FAFF', borderRadius: 12, padding: 14 }}>
                      <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 4 }}>{s.label}</div>
                      <div style={{ fontWeight: 900, fontSize: 20, color: s.color }}>{s.val}<span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 400 }}>/{s.max}</span></div>
                    </div>
                  ))}
                </div>
              )}
              <div className="rb" style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                <button onClick={() => setView('dashboard')} style={{ background: '#F1F5F9', color: '#0D1E4A', border: 'none', borderRadius: 11, padding: '11px 18px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>← Башкы бет</button>
                <button onClick={() => setView('mock_list')} style={{ background: '#F1F5F9', color: '#0D1E4A', border: 'none', borderRadius: 11, padding: '11px 18px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Тесттер</button>
                {(activeMock.max_attempts === 0 || getMockAttempts(activeMock.id) < activeMock.max_attempts) && (
                  <button onClick={() => openMock(activeMock)} style={{ background: BLUE, color: '#fff', border: 'none', borderRadius: 11, padding: '11px 18px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>🔄 Кайра</button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ══ PRACTICE ══ */}
        {view === 'practice' && (
          <div className="fade">
            <div style={{ marginBottom: 20 }}>
              <h2 style={{ fontSize: 20, fontWeight: 900, margin: 0 }}>🎯 Практика</h2>
              <p style={{ color: '#64748B', fontSize: 13, margin: '4px 0 0' }}>Тема боюнча видео + тест</p>
            </div>
            <div style={{ display: 'flex', background: '#F1F5F9', borderRadius: 12, padding: 4, gap: 4, marginBottom: 20, width: 'fit-content' }}>
              {(['math', 'kyr'] as const).map(s => (
                <button key={s} onClick={() => { setPracticeSubject(s); fetchLessons(s) }}
                  style={{ padding: '8px 20px', borderRadius: 9, border: 'none', fontSize: 13, fontWeight: practiceSubject === s ? 700 : 600, cursor: 'pointer', background: practiceSubject === s ? subjectColor(s) : 'transparent', color: practiceSubject === s ? '#fff' : '#64748B', transition: 'all 0.15s' }}>
                  {subjectLabel(s)}
                </button>
              ))}
            </div>
            {lessons.length === 0 ? (
              <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', padding: '40px 20px', textAlign: 'center', color: '#94A3B8' }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>📚</div>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#0D1E4A' }}>Сабак жок</div>
              </div>
            ) : (
              <div className="lesson-g" style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12 }}>
                {lessons.map((l, i) => {
                  const res = getLessonResult(l.id)
                  const color = subjectColor(practiceSubject)
                  return (
                    <div key={l.id} className="ch" onClick={() => openLesson(l)}
                      style={{ background: '#fff', borderRadius: 14, border: `1px solid ${res?.passed ? '#BBF7D0' : '#E2E8F0'}`, padding: 18, cursor: 'pointer' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                        <div style={{ width: 34, height: 34, background: res?.passed ? '#F0FDF4' : subjectBg(practiceSubject), borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 13, color: res?.passed ? '#10B981' : color, flexShrink: 0 }}>
                          {res?.passed ? '✓' : i + 1}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 13, lineHeight: 1.3, marginBottom: 3 }}>{l.title}</div>
                          {l.description && <div style={{ fontSize: 11, color: '#94A3B8' }}>{l.description}</div>}
                        </div>
                        {res && (
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
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
            <h2 style={{ fontSize: 18, fontWeight: 900, marginBottom: 6, lineHeight: 1.3 }}>{activeLesson.title}</h2>
            {activeLesson.description && <p style={{ color: '#64748B', fontSize: 13, marginBottom: 16 }}>{activeLesson.description}</p>}
            {activeLesson.video_url && (
              <div style={{ borderRadius: 16, overflow: 'hidden', marginBottom: 18, background: '#000', aspectRatio: '16/9' }}>
                <iframe src={getEmbed(activeLesson.video_url)} style={{ width: '100%', height: '100%', border: 'none' }} allowFullScreen title={activeLesson.title} />
              </div>
            )}
            {practiceTests.length > 0 && (
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>📝 Тест</div>
                {practiceTests.map(test => {
                  const res = pResults.find(r => r.test_id === test.id)
                  return (
                    <div key={test.id} style={{ background: '#fff', borderRadius: 14, border: '1px solid #E2E8F0', padding: '15px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{test.title}</div>
                        {test.time_limit_minutes && <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>⏱ {test.time_limit_minutes} мин</div>}
                      </div>
                      {res && <div style={{ textAlign: 'center', flexShrink: 0 }}><div style={{ fontWeight: 800, fontSize: 15, color: res.passed ? '#10B981' : '#F59E0B' }}>{Math.round((res.score / res.total) * 100)}%</div></div>}
                      <button onClick={() => startPracticeTest(test)}
                        style={{ background: res ? '#F8FAFF' : BLUE, color: res ? BLUE : '#fff', border: res ? `1.5px solid ${BLUE}` : 'none', borderRadius: 10, padding: '9px 16px', fontWeight: 700, fontSize: 13, cursor: 'pointer', flexShrink: 0 }}>
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
              <h2 style={{ fontSize: 17, fontWeight: 900, margin: 0 }}>{activePTest.title}</h2>
              <div style={{ fontWeight: 700, fontSize: 13, color: BLUE, background: '#EEF2FF', padding: '4px 12px', borderRadius: 20 }}>{Object.keys(pAnswers).length}/{pQuestions.length}</div>
            </div>
            <div style={{ background: '#E2E8F0', borderRadius: 999, height: 6, marginBottom: 18, overflow: 'hidden' }}>
              <div style={{ width: `${(Object.keys(pAnswers).length / pQuestions.length) * 100}%`, height: '100%', background: BLUE, borderRadius: 999, transition: 'width 0.3s' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {pQuestions.map((q, qi) => (
                <div key={q.id} style={{ background: '#fff', borderRadius: 14, border: `1px solid ${pAnswers[q.id] ? '#BFDBFE' : '#E2E8F0'}`, padding: '16px 18px' }}>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, lineHeight: 1.5 }}>
                    <span style={{ color: BLUE, marginRight: 6, fontWeight: 800 }}>#{qi + 1}</span>
                    {q.image_url ? <img src={q.image_url} alt="q" style={{ maxHeight: 80, borderRadius: 8, display: 'block', marginTop: 6 }} /> : q.question_text}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                    {['A','B','C','D'].map(opt => {
                      const text = (q as any)[`option_${opt.toLowerCase()}`]
                      const sel = pAnswers[q.id] === opt
                      return (
                        <button key={opt} onClick={() => setPAnswers(p => ({ ...p, [q.id]: opt }))}
                          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 13px', borderRadius: 10, border: `2px solid ${sel ? BLUE : '#E2E8F0'}`, background: sel ? '#EEF2FF' : '#FAFBFF', cursor: 'pointer', textAlign: 'left', fontFamily: 'Inter, sans-serif', width: '100%' }}>
                          <div style={{ width: 20, height: 20, borderRadius: '50%', border: `2px solid ${sel ? BLUE : '#CBD5E1'}`, background: sel ? BLUE : 'transparent', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {sel && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />}
                          </div>
                          <span style={{ fontSize: 13, color: sel ? BLUE : '#475569', fontWeight: sel ? 600 : 400, lineHeight: 1.4 }}>{text}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
            <button onClick={submitPractice} disabled={submitting || Object.keys(pAnswers).length < pQuestions.length}
              style={{ width: '100%', marginTop: 18, background: Object.keys(pAnswers).length < pQuestions.length ? '#E2E8F0' : BLUE, color: Object.keys(pAnswers).length < pQuestions.length ? '#94A3B8' : '#fff', border: 'none', borderRadius: 14, padding: 14, fontWeight: 900, fontSize: 15, cursor: Object.keys(pAnswers).length < pQuestions.length ? 'not-allowed' : 'pointer' }}>
              {submitting ? 'Жөнөтүлүүдө...' : Object.keys(pAnswers).length < pQuestions.length ? `${pQuestions.length - Object.keys(pAnswers).length} суроо калды` : '✓ Тапшыруу'}
            </button>
          </div>
        )}

        {/* ══ PRACTICE RESULT ══ */}
        {view === 'practice_result' && pResult && (
          <div className="fade" style={{ maxWidth: 500, margin: '0 auto', textAlign: 'center' }}>
            <div style={{ background: '#fff', borderRadius: 22, border: `2px solid ${pResult.passed ? '#BBF7D0' : '#FECACA'}`, padding: '30px 20px' }}>
              <div style={{ fontSize: 44, marginBottom: 10 }}>{pResult.passed ? '🎉' : '💪'}</div>
              <div style={{ fontWeight: 900, fontSize: 44, color: pResult.passed ? '#10B981' : '#EF4444', letterSpacing: '-2px', marginBottom: 6 }}>
                {Math.round((pResult.score / pResult.total) * 100)}%
              </div>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#0D1E4A', marginBottom: 4 }}>{pResult.score}/{pResult.total} туура жооп</div>
              <div style={{ fontWeight: 800, fontSize: 13, color: pResult.passed ? '#10B981' : '#F59E0B', marginBottom: 20 }}>
                {pResult.passed ? '✓ Тема өттүңүз!' : 'Кайра аракет кылыңыз'}
              </div>
              {!pResult.passed && pResult.wrong.length > 0 && (
                <div style={{ background: '#FEF2F2', borderRadius: 12, padding: '12px 14px', textAlign: 'left', marginBottom: 18 }}>
                  <div style={{ fontWeight: 700, fontSize: 12, color: '#EF4444', marginBottom: 8 }}>Каталар:</div>
                  {pResult.wrong.slice(0, 5).map(wi => (
                    <div key={wi} style={{ fontSize: 12, color: '#64748B', marginBottom: 5, lineHeight: 1.5 }}>
                      <span style={{ color: '#EF4444', fontWeight: 700 }}>#{wi + 1}</span> {pQuestions[wi]?.question_text} — <span style={{ color: '#10B981', fontWeight: 600 }}>{(pQuestions[wi] as any)?.[`option_${pQuestions[wi]?.correct_answer?.toLowerCase()}`]}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="rb" style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                <button onClick={() => setView('lesson')} style={{ background: '#F1F5F9', color: '#0D1E4A', border: 'none', borderRadius: 11, padding: '10px 16px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>← Сабак</button>
                <button onClick={() => setView('practice')} style={{ background: '#F1F5F9', color: '#0D1E4A', border: 'none', borderRadius: 11, padding: '10px 16px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>📚 Практика</button>
                {!pResult.passed && activePTest && (
                  <button onClick={() => startPracticeTest(activePTest)} style={{ background: BLUE, color: '#fff', border: 'none', borderRadius: 11, padding: '10px 16px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>🔄 Кайра</button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ══ MISTAKES ══ */}
        {view === 'mistakes' && (
          <div className="fade">
            <div style={{ marginBottom: 20 }}>
              <h2 style={{ fontSize: 20, fontWeight: 900, margin: 0 }}>🔁 Каталарды иштетүү</h2>
              <p style={{ color: '#64748B', fontSize: 13, margin: '4px 0 0' }}>Акыркы тесттерден туура эмес жооп берилген суроолор</p>
            </div>
            {mistakeQuestions.length === 0 ? (
              <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', padding: '40px 20px', textAlign: 'center', color: '#94A3B8' }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>✅</div>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#0D1E4A' }}>Ката жок</div>
                <div style={{ fontSize: 13, marginTop: 4 }}>Тест тапшыргандан кийин каталар бул жерде пайда болот</div>
              </div>
            ) : !mistakeDone ? (
              <div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 18 }}>
                  {mistakeQuestions.map((q, qi) => (
                    <div key={q.id} style={{ background: '#fff', borderRadius: 14, border: `1px solid ${mistakeAnswers[q.id] ? '#BFDBFE' : '#E2E8F0'}`, padding: '16px 18px' }}>
                      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, lineHeight: 1.5 }}>
                        <span style={{ color: '#EF4444', marginRight: 6, fontWeight: 800 }}>#{qi + 1}</span>
                        {q.question_text}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                        {['A','B','C','D'].map(opt => {
                          const text = (q as any)[`option_${opt.toLowerCase()}`]
                          const sel = mistakeAnswers[q.id] === opt
                          return (
                            <button key={opt} onClick={() => setMistakeAnswers(p => ({ ...p, [q.id]: opt }))}
                              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 13px', borderRadius: 10, border: `2px solid ${sel ? BLUE : '#E2E8F0'}`, background: sel ? '#EEF2FF' : '#FAFBFF', cursor: 'pointer', textAlign: 'left', fontFamily: 'Inter, sans-serif', width: '100%' }}>
                              <div style={{ width: 20, height: 20, borderRadius: '50%', border: `2px solid ${sel ? BLUE : '#CBD5E1'}`, background: sel ? BLUE : 'transparent', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {sel && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />}
                              </div>
                              <span style={{ fontSize: 13, color: sel ? BLUE : '#475569', fontWeight: sel ? 600 : 400 }}>{text}</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                <button onClick={() => setMistakeDone(true)} disabled={Object.keys(mistakeAnswers).length < mistakeQuestions.length}
                  style={{ width: '100%', background: Object.keys(mistakeAnswers).length < mistakeQuestions.length ? '#E2E8F0' : '#EF4444', color: Object.keys(mistakeAnswers).length < mistakeQuestions.length ? '#94A3B8' : '#fff', border: 'none', borderRadius: 14, padding: 14, fontWeight: 900, fontSize: 15, cursor: Object.keys(mistakeAnswers).length < mistakeQuestions.length ? 'not-allowed' : 'pointer' }}>
                  ✓ Текшерүү
                </button>
              </div>
            ) : (
              <div>
                {/* Show correct answers */}
                <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 14, padding: '14px 18px', marginBottom: 18, textAlign: 'center' }}>
                  <div style={{ fontWeight: 900, fontSize: 20, color: '#10B981' }}>
                    {mistakeQuestions.filter(q => mistakeAnswers[q.id] === q.correct_answer).length}/{mistakeQuestions.length}
                  </div>
                  <div style={{ fontSize: 13, color: '#64748B', marginTop: 4 }}>туура жооп</div>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => setView('dashboard')} style={{ flex: 1, background: '#F1F5F9', color: '#0D1E4A', border: 'none', borderRadius: 12, padding: 12, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>← Башкы бет</button>
                  <button onClick={() => { setMistakeAnswers({}); setMistakeDone(false) }} style={{ flex: 1, background: BLUE, color: '#fff', border: 'none', borderRadius: 12, padding: 12, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>🔄 Кайра</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══ PROFILE ══ */}
        {view === 'profile' && (
          <div className="fade">
            <div style={{ marginBottom: 20 }}>
              <h2 style={{ fontSize: 20, fontWeight: 900, margin: 0 }}>👤 Профиль</h2>
            </div>
            <div style={{ background: '#fff', borderRadius: 18, border: '1px solid #E2E8F0', padding: '24px 20px', marginBottom: 14 }}>
              {/* Avatar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 22, paddingBottom: 22, borderBottom: '1px solid #F1F5F9' }}>
                <div style={{ width: 56, height: 56, background: BLUE, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 22, fontWeight: 900, flexShrink: 0 }}>
                  {profile?.full_name?.[0]}
                </div>
                <div>
                  <div style={{ fontWeight: 900, fontSize: 17 }}>{profile?.full_name}</div>
                  <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>Онлайн студент · ЖРТ</div>
                </div>
              </div>

              {/* Info */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 22 }}>
                {[
                  { label: 'Аты-жөнү', val: profile?.full_name || '—' },
                  { label: 'Телефон', val: profile?.phone || '—' },
                ].map(f => (
                  <div key={f.label}>
                    <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600, marginBottom: 4 }}>{f.label}</div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: '#0D1E4A' }}>{f.val}</div>
                  </div>
                ))}
              </div>

              {/* Goal score edit */}
              <div style={{ paddingTop: 20, borderTop: '1px solid #F1F5F9' }}>
                <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600, marginBottom: 8 }}>МАКСАТ БАЛЛ</div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <input value={editGoal} onChange={e => setEditGoal(e.target.value)} type="number" min="100" max="270"
                    style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: '1px solid #E2E8F0', fontSize: 15, fontWeight: 700, color: BLUE, background: '#F8FAFF', outline: 'none' }} />
                  <button onClick={saveProfile} disabled={savingProfile}
                    style={{ background: BLUE, color: '#fff', border: 'none', borderRadius: 10, padding: '10px 20px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                    {savingProfile ? '...' : 'Сактоо'}
                  </button>
                </div>
                <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 6 }}>Максат баллыңды киргиз — прогресс ошого карай эсептелет</div>
              </div>
            </div>

            {/* Stats summary */}
            <div className="stats-g" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
              {[
                { label: 'Тест тапшырылды', val: mockResults.length, color: BLUE },
                { label: 'Орточо балл', val: avgScore || '—', color: '#10B981' },
                { label: 'Практика өттү', val: `${mathPassed + kyrPassed}/${allLessons.length}`, color: '#7C3AED' },
              ].map(s => (
                <div key={s.label} style={{ background: '#fff', borderRadius: 14, border: '1px solid #E2E8F0', padding: '16px', textAlign: 'center' }}>
                  <div style={{ fontWeight: 900, fontSize: 22, color: s.color }}>{s.val}</div>
                  <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 3 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* ── BOTTOM NAV ── */}
      <div className="bnav" style={{ display: 'none' }}>
        {[
          { id: 'dashboard', icon: '🏠', label: 'Башкы' },
          { id: 'mock_list', icon: '📋', label: 'Тесттер' },
          { id: 'practice', icon: '🎯', label: 'Практика' },
          { id: 'analytics', icon: '📊', label: 'Аналитика' },
          { id: 'profile', icon: '👤', label: 'Профиль' },
        ].map(tab => {
          const active = view === tab.id ||
            (tab.id === 'mock_list' && ['mock_intro','mock_test','mock_result'].includes(view)) ||
            (tab.id === 'practice' && ['lesson','practice_test','practice_result'].includes(view))
          return (
            <button key={tab.id} onClick={() => {
              setView(tab.id as View)
              if (tab.id === 'practice') fetchLessons(practiceSubject)
            }} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '8px 4px', border: 'none', background: 'transparent', cursor: 'pointer', color: active ? BLUE : '#94A3B8' }}>
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
function MockTestView({ test, questions, answers, setAnswers, onSubmit, submitting }: {
  test: MockTest; questions: Question[]
  answers: Record<string, string>; setAnswers: (a: Record<string, string>) => void
  onSubmit: () => void; submitting: boolean
}) {
  const totalSecs = test.time_limit_minutes * 60
  const { left, start } = useTimer(totalSecs, onSubmit)
  const [activeQ, setActiveQ] = useState(0)
  const BLUE = '#1B4FD8'
  useEffect(() => { start() }, [])

  const q = questions[activeQ]
  return (
    <div>
      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #E2E8F0', padding: '14px 18px', marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 13 }}>{test.title}</div>
          <div style={{ fontWeight: 700, fontSize: 13, color: BLUE }}>{Object.keys(answers).length}/{questions.length}</div>
        </div>
        <TimerBar left={left} total={totalSecs} />
      </div>

      {/* Question dots */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 14 }}>
        {questions.map((q, i) => (
          <button key={i} onClick={() => setActiveQ(i)}
            style={{ width: 32, height: 32, borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700,
              background: answers[q.id] ? BLUE : i === activeQ ? '#EEF2FF' : '#F1F5F9',
              color: answers[q.id] ? '#fff' : i === activeQ ? BLUE : '#64748B',
              outline: i === activeQ ? `2px solid ${BLUE}` : 'none' }}>
            {i + 1}
          </button>
        ))}
      </div>

      {q && (
        <div style={{ background: '#fff', borderRadius: 14, border: `1px solid ${answers[q.id] ? '#BFDBFE' : '#E2E8F0'}`, padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ fontWeight: 800, fontSize: 13, color: BLUE }}>#{activeQ + 1}</span>
            {q.section && q.section !== 'general' && (
              <span style={{ background: '#EEF2FF', color: BLUE, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>
                {q.section === 'comparison' ? 'Салыштыруу' : q.section === 'math' ? 'Математика' : q.section === 'analogy' ? 'Аналогия' : q.section === 'reading' ? 'Окуу' : 'Грамматика'}
              </span>
            )}
          </div>
          {q.image_url
            ? <img src={q.image_url} alt="q" style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 10, marginBottom: 12, display: 'block' }} />
            : <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, lineHeight: 1.6 }}>{q.question_text}</div>
          }
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {['A','B','C','D'].map(opt => {
              const text = (q as any)[`option_${opt.toLowerCase()}`]
              const sel = answers[q.id] === opt
              return (
                <button key={opt} onClick={() => setAnswers({ ...answers, [q.id]: opt })}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderRadius: 10, border: `2px solid ${sel ? BLUE : '#E2E8F0'}`, background: sel ? '#EEF2FF' : '#FAFBFF', cursor: 'pointer', textAlign: 'left', fontFamily: 'Inter, sans-serif', width: '100%' }}>
                  <div style={{ width: 22, height: 22, borderRadius: '50%', border: `2px solid ${sel ? BLUE : '#CBD5E1'}`, background: sel ? BLUE : 'transparent', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {sel && <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#fff' }} />}
                  </div>
                  <span style={{ fontSize: 13, color: sel ? BLUE : '#475569', fontWeight: sel ? 600 : 400, lineHeight: 1.4 }}>{text}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        {activeQ > 0 && <button onClick={() => setActiveQ(p => p - 1)} style={{ flex: 1, background: '#F1F5F9', color: '#64748B', border: 'none', borderRadius: 12, padding: 12, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>← Артка</button>}
        {activeQ < questions.length - 1
          ? <button onClick={() => setActiveQ(p => p + 1)} style={{ flex: 1, background: BLUE, color: '#fff', border: 'none', borderRadius: 12, padding: 12, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Кийинки →</button>
          : <button onClick={onSubmit} disabled={submitting} style={{ flex: 1, background: Object.keys(answers).length === questions.length ? '#10B981' : '#F59E0B', color: '#fff', border: 'none', borderRadius: 12, padding: 12, fontWeight: 900, fontSize: 13, cursor: 'pointer' }}>
              {submitting ? 'Жөнөтүлүүдө...' : Object.keys(answers).length < questions.length ? `⚠️ ${questions.length - Object.keys(answers).length} жооп жок` : '✓ Тапшыруу'}
            </button>
        }
      </div>
    </div>
  )
}