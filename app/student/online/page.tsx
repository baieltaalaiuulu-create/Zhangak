'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Profile { id: string; full_name: string }
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

// ─── Score calculator ─────────────────────────────────────────────────────────
function calcScore(math: number, analogy: number, reading: number, grammar: number) {
  return Math.round(math * 1.12 + analogy * 2 + reading * 2 + grammar * 1.93)
}

// ─── YouTube embed ────────────────────────────────────────────────────────────
function getEmbed(url: string) {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/)
  return m ? `https://www.youtube.com/embed/${m[1]}?rel=0` : url
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
      setLeft(p => {
        if (p <= 1) { clearInterval(ref.current!); onEnd(); return 0 }
        return p - 1
      })
    }, 1000)
  }
  const stop = () => { if (ref.current) clearInterval(ref.current) }

  useEffect(() => () => stop(), [])
  return { left, start, stop }
}

function TimerBar({ left, total }: { left: number; total: number }) {
  const pct = (left / total) * 100
  const mm = Math.floor(left / 60)
  const ss = String(left % 60).padStart(2, '0')
  const critical = left < 600
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ fontSize: 18, fontWeight: 900, color: critical ? '#EF4444' : '#1B4FD8', fontVariantNumeric: 'tabular-nums', minWidth: 56 }}>
        {mm}:{ss}
      </div>
      <div style={{ flex: 1, background: '#E2E8F0', borderRadius: 999, height: 6, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: critical ? '#EF4444' : '#1B4FD8', borderRadius: 999, transition: 'width 1s linear' }} />
      </div>
    </div>
  )
}

// ─── Score ring ───────────────────────────────────────────────────────────────
function ScoreRing({ score, max = 145, size = 80 }: { score: number; max?: number; size?: number }) {
  const r = (size - 8) / 2
  const circ = 2 * Math.PI * r
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

const BLUE = '#1B4FD8'
const BG   = '#F8FAFF'

export default function OnlineStudentPage() {
  const [profile, setProfile]   = useState<Profile | null>(null)
  const [view, setView]         = useState<View>('dashboard')
  const [loading, setLoading]   = useState(true)

  // Mock test state
  const [mockTests, setMockTests]       = useState<MockTest[]>([])
  const [mockResults, setMockResults]   = useState<MockResult[]>([])
  const [activeMock, setActiveMock]     = useState<MockTest | null>(null)
  const [mockQuestions, setMockQuestions] = useState<Question[]>([])
  const [mockAnswers, setMockAnswers]   = useState<Record<string, string>>({})
  const [mockResult, setMockResult]     = useState<MockResult | null>(null)
  const [submitting, setSubmitting]     = useState(false)

  // Practice state
  const [practiceSubject, setPracticeSubject] = useState<'math' | 'kyr'>('math')
  const [lessons, setLessons]           = useState<PracticeLesson[]>([])
  const [activeLesson, setActiveLesson] = useState<PracticeLesson | null>(null)
  const [practiceTests, setPracticeTests] = useState<PracticeTest[]>([])
  const [activePTest, setActivePTest]   = useState<PracticeTest | null>(null)
  const [pQuestions, setPQuestions]     = useState<Question[]>([])
  const [pAnswers, setPAnswers]         = useState<Record<string, string>>({})
  const [pResult, setPResult]           = useState<{ score: number; total: number; passed: boolean; wrong: number[] } | null>(null)
  const [pResults, setPResults]         = useState<PracticeResult[]>([])

  const router = useRouter()

  useEffect(() => { checkAuth() }, [])

  const checkAuth = async () => {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) { router.push('/'); return }
  const { data: prof, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()
  if (error || !prof) { router.push('/'); return }
  if (prof.role !== 'student') { router.push('/'); return }
  setProfile(prof)
  await Promise.all([fetchMockTests(user.id), fetchLessons('math')])
  setLoading(false)
}

  const fetchMockTests = async (uid: string) => {
    const [{ data: tests }, { data: results }] = await Promise.all([
      supabase.from('practice_tests').select('*').eq('type', 'mock').eq('is_active', true).order('created_at'),
      supabase.from('practice_results').select('*').eq('student_id', uid).eq('test_type', 'mock').order('created_at', { ascending: false }),
    ])
    setMockTests(tests || [])
    setMockResults(results || [])
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
    setPResult(null)
    setPAnswers({})
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

  const submitMock = async (autoSubmit = false) => {
    if (!activeMock || !profile) return
    setSubmitting(true)

    const sections = {
      comparison: mockQuestions.filter(q => q.section === 'comparison'),
      math:       mockQuestions.filter(q => q.section === 'math'),
      analogy:    mockQuestions.filter(q => q.section === 'analogy'),
      reading:    mockQuestions.filter(q => q.section === 'reading'),
      grammar:    mockQuestions.filter(q => q.section === 'grammar'),
    }

    const score = (qs: Question[]) => qs.filter(q => mockAnswers[q.id] === q.correct_answer).length

    let total_score = 0
    let math_comparison_score = 0, math_raw_score = 0
    let analogy_score = 0, reading_score = 0, grammar_score = 0

    if (activeMock.subject === 'math') {
      math_comparison_score = score(sections.comparison)
      math_raw_score = score(sections.math)
      total_score = calcScore(math_comparison_score + math_raw_score, 0, 0, 0)
    } else {
      analogy_score   = score(sections.analogy)
      reading_score   = score(sections.reading)
      grammar_score   = score(sections.grammar)
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
    let score = 0
    const wrong: number[] = []
    pQuestions.forEach((q, i) => {
      if (pAnswers[q.id] === q.correct_answer) score++
      else wrong.push(i)
    })
    const total = pQuestions.length
    const passed = total > 0 && score / total >= 0.7

    await supabase.from('practice_results').insert({
      student_id: profile.id, test_id: activePTest.id, lesson_id: activeLesson.id,
      test_type: 'practice', score, total, passed,
    })
    setPResult({ score, total, passed, wrong })
    setSubmitting(false)
    setView('practice_result')
  }

  const getMockAttempts = (testId: string) => mockResults.filter(r => r.test_id === testId).length
  const getBestMock = (testId: string) => {
    const r = mockResults.filter(r => r.test_id === testId)
    return r.length > 0 ? r.reduce((b, c) => c.total_score > b.total_score ? c : b) : null
  }
  const getLessonResult = (lessonId: string) => pResults.find(r => r.lesson_id === lessonId)

  const subjectLabel = (s: 'math' | 'kyr') => s === 'math' ? 'Математика' : 'Кыргыз тили'
  const subjectColor = (s: 'math' | 'kyr') => s === 'math' ? '#1B4FD8' : '#7C3AED'
  const subjectBg    = (s: 'math' | 'kyr') => s === 'math' ? '#EEF2FF' : '#F5F3FF'

  const avgScore = mockResults.length > 0
    ? Math.round(mockResults.reduce((s, r) => s + r.total_score, 0) / mockResults.length)
    : 0

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: BG, fontFamily: 'Inter, sans-serif' }}>
      <div style={{ textAlign: 'center', color: '#94A3B8', fontSize: 14 }}>Жүктөлүүдө...</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: BG, fontFamily: 'Inter, -apple-system, sans-serif', color: '#0D1E4A' }}>
      <style>{`
        *{box-sizing:border-box}
        @keyframes fadeIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
        .fade{animation:fadeIn 0.35s ease both}
        @media(hover:hover){.card-hover:hover{transform:translateY(-3px)!important;box-shadow:0 8px 24px rgba(27,79,216,0.1)!important}}
        .card-hover{transition:all 0.2s}
        @media(max-width:640px){
          .nav-inner{padding:0 14px!important;height:54px!important}
          .nav-name{display:none!important}
          .page-pad{padding:16px 14px 80px!important}
          .stats-grid{grid-template-columns:1fr 1fr!important}
          .mock-grid{grid-template-columns:1fr!important}
          .lesson-grid{grid-template-columns:1fr!important}
          .score-grid{grid-template-columns:1fr 1fr!important}
          .result-btns{flex-direction:column!important}
          .result-btns button{width:100%!important}
        }
        .bottom-nav{display:none}
        @media(max-width:640px){.bottom-nav{display:flex!important}}
      `}</style>

      {/* ── NAVBAR ── */}
      <nav style={{ background: '#fff', borderBottom: '1px solid #E2E8F0', position: 'sticky', top: 0, zIndex: 100 }}>
        <div className="nav-inner" style={{ maxWidth: 900, margin: '0 auto', padding: '0 24px', height: 58, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {view !== 'dashboard' && view !== 'practice' && view !== 'mock_list' && (
              <button onClick={() => {
                if (view === 'mock_intro' || view === 'mock_result') setView('mock_list')
                else if (view === 'mock_test') { if (confirm('Тестти токтотосузбу?')) { setView('mock_list') } }
                else if (view === 'lesson') setView('practice')
                else if (view === 'practice_test' || view === 'practice_result') setView('lesson')
              }} style={{ background: '#F8FAFF', border: '1px solid #E2E8F0', borderRadius: 8, padding: '5px 11px', fontSize: 13, cursor: 'pointer', color: '#64748B' }}>← Артка</button>
            )}
            <div style={{ width: 30, height: 30, background: BLUE, borderRadius: 7, overflow: 'hidden', flexShrink: 0 }}>
              <img src="/images/logo.png" alt="Z" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <span style={{ fontWeight: 900, fontSize: 15, color: '#0D1E4A' }}>Zhangak</span>
            <span style={{ fontWeight: 800, fontSize: 10, color: BLUE, background: '#EEF2FF', padding: '2px 7px', borderRadius: 5 }}>ЖРТ</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ background: '#F1F5F9', borderRadius: 9, padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 7 }}>
              <div style={{ width: 22, height: 22, background: BLUE, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 10, fontWeight: 800, flexShrink: 0 }}>
                {profile?.full_name?.[0]}
              </div>
              <span className="nav-name" style={{ fontSize: 12, fontWeight: 600, color: '#0D1E4A' }}>{profile?.full_name}</span>
            </div>
            <button onClick={async () => { await supabase.auth.signOut(); router.push('/') }} style={{ background: 'none', border: '1px solid #E2E8F0', borderRadius: 7, padding: '5px 10px', fontSize: 12, color: '#64748B', cursor: 'pointer' }}>Чыгуу</button>
          </div>
        </div>
      </nav>

      {/* ── CONTENT ── */}
      <div className="page-pad" style={{ maxWidth: 900, margin: '0 auto', padding: '24px 20px' }}>

        {/* ── DASHBOARD ── */}
        {view === 'dashboard' && (
          <div className="fade">
            <div style={{ marginBottom: 22 }}>
              <h1 style={{ fontSize: 'clamp(18px,5vw,22px)', fontWeight: 900, margin: 0 }}>
                Саламатсызбы, {profile?.full_name?.split(' ')[0]} 👋
              </h1>
              <p style={{ color: '#64748B', fontSize: 13, margin: '4px 0 0' }}>ЖРТга даярдануу платформасы</p>
            </div>

            {/* Stats */}
            <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
              {[
                { label: 'Тест тапшырылды', val: mockResults.length, color: BLUE, bg: '#EEF2FF', icon: '📝' },
                { label: 'Орточо балл', val: avgScore > 0 ? avgScore : '—', color: '#10B981', bg: '#F0FDF4', icon: '📊' },
                { label: 'Эң жогорку', val: mockResults.length > 0 ? Math.max(...mockResults.map(r => r.total_score)) : '—', color: '#F59E0B', bg: '#FFFBEB', icon: '🏆' },
              ].map(s => (
                <div key={s.label} style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, padding: 16 }}>
                  <div style={{ fontSize: 20, marginBottom: 8 }}>{s.icon}</div>
                  <div style={{ fontWeight: 900, fontSize: 24, color: s.color, letterSpacing: '-0.5px' }}>{s.val}</div>
                  <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 3 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Quick nav */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div className="card-hover" onClick={() => setView('mock_list')}
                style={{ background: '#fff', border: `1px solid #E2E8F0`, borderRadius: 18, padding: 22, cursor: 'pointer' }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
                <div style={{ fontWeight: 800, fontSize: 16, color: '#0D1E4A', marginBottom: 5 }}>Сынамык тесттер</div>
                <div style={{ fontSize: 13, color: '#64748B', lineHeight: 1.5 }}>ЖРТ форматындагы толук тест. Убакыт чектөөсү менен.</div>
                <div style={{ marginTop: 14, background: BLUE, color: '#fff', borderRadius: 10, padding: '9px 16px', fontSize: 13, fontWeight: 700, display: 'inline-block' }}>Баштоо →</div>
              </div>

              <div className="card-hover" onClick={() => { setView('practice'); fetchLessons('math') }}
                style={{ background: '#fff', border: `1px solid #E2E8F0`, borderRadius: 18, padding: 22, cursor: 'pointer' }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>🎯</div>
                <div style={{ fontWeight: 800, fontSize: 16, color: '#0D1E4A', marginBottom: 5 }}>Практика</div>
                <div style={{ fontSize: 13, color: '#64748B', lineHeight: 1.5 }}>Тема боюнча видео жана тест. Убакыт жок.</div>
                <div style={{ marginTop: 14, background: '#7C3AED', color: '#fff', borderRadius: 10, padding: '9px 16px', fontSize: 13, fontWeight: 700, display: 'inline-block' }}>Ачуу →</div>
              </div>
            </div>

            {/* Last results */}
            {mockResults.length > 0 && (
              <div style={{ marginTop: 20, background: '#fff', borderRadius: 18, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
                <div style={{ padding: '14px 18px', borderBottom: '1px solid #E2E8F0', fontWeight: 700, fontSize: 14 }}>Акыркы натыйжалар</div>
                {mockResults.slice(0, 5).map(r => {
                  const test = mockTests.find(t => t.id === r.test_id)
                  return (
                    <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', borderBottom: '1px solid #F1F5F9', gap: 12 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{test?.title || '—'}</div>
                        <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>{new Date(r.created_at).toLocaleDateString('ru')}</div>
                      </div>
                      <div style={{ fontWeight: 900, fontSize: 18, color: r.total_score >= 110 ? '#10B981' : r.total_score >= 70 ? '#F59E0B' : '#EF4444', flexShrink: 0 }}>
                        {r.total_score}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── MOCK LIST ── */}
        {view === 'mock_list' && (
          <div className="fade">
            <div style={{ marginBottom: 22 }}>
              <h2 style={{ fontSize: 'clamp(17px,5vw,20px)', fontWeight: 900, margin: 0 }}>📋 Сынамык тесттер</h2>
              <p style={{ color: '#64748B', fontSize: 13, margin: '4px 0 0' }}>ЖРТ форматындагы тесттер — убакыт чектөөсү менен</p>
            </div>

            {mockTests.length === 0 ? (
              <div style={{ background: '#fff', borderRadius: 18, border: '1px solid #E2E8F0', padding: '48px 20px', textAlign: 'center', color: '#94A3B8' }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>📋</div>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#0D1E4A' }}>Тест жок</div>
                <div style={{ fontSize: 13, marginTop: 4 }}>Администратор тест кошкондон кийин пайда болот</div>
              </div>
            ) : (
              <div className="mock-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 14 }}>
                {mockTests.map(test => {
                  const attempts = getMockAttempts(test.id)
                  const best = getBestMock(test.id)
                  const canTake = test.max_attempts === 0 || attempts < test.max_attempts
                  const color = subjectColor(test.subject)
                  const bg = subjectBg(test.subject)
                  return (
                    <div key={test.id} style={{ background: '#fff', borderRadius: 18, border: `1px solid #E2E8F0`, padding: 20 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                        <span style={{ background: bg, color, fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 20 }}>
                          {subjectLabel(test.subject)}
                        </span>
                        {best && (
                          <span style={{ background: '#F0FDF4', color: '#10B981', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>
                            Эң жогорку: {best.total_score}
                          </span>
                        )}
                      </div>
                      <div style={{ fontWeight: 800, fontSize: 16, color: '#0D1E4A', marginBottom: 8 }}>{test.title}</div>
                      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                        <div style={{ fontSize: 12, color: '#94A3B8' }}>⏱ {test.time_limit_minutes} мин</div>
                        <div style={{ fontSize: 12, color: '#94A3B8' }}>
                          📌 {attempts}/{test.max_attempts === 0 ? '∞' : test.max_attempts} аракет
                        </div>
                      </div>
                      <button onClick={() => canTake && openMock(test)} disabled={!canTake}
                        style={{ width: '100%', background: canTake ? color : '#E2E8F0', color: canTake ? '#fff' : '#94A3B8', border: 'none', borderRadius: 11, padding: '11px', fontWeight: 700, fontSize: 13, cursor: canTake ? 'pointer' : 'not-allowed' }}>
                        {!canTake ? 'Аракет бүттү' : attempts === 0 ? 'Баштоо →' : 'Кайра тапшыруу'}
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── MOCK INTRO ── */}
        {view === 'mock_intro' && activeMock && (
          <div className="fade" style={{ maxWidth: 560, margin: '0 auto' }}>
            <div style={{ background: '#fff', borderRadius: 24, border: '1px solid #E2E8F0', padding: '32px 28px', textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
              <div style={{ fontWeight: 900, fontSize: 20, marginBottom: 6 }}>{activeMock.title}</div>
              <div style={{ fontSize: 14, color: '#64748B', marginBottom: 24 }}>{subjectLabel(activeMock.subject)}</div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
                {[
                  { label: 'Убакыт', val: `${activeMock.time_limit_minutes} мүнөт` },
                  { label: 'Суроолор', val: `${mockQuestions.length} суроо` },
                  { label: 'Предмет', val: subjectLabel(activeMock.subject) },
                  { label: 'Аракет', val: `${getMockAttempts(activeMock.id) + 1}/${activeMock.max_attempts === 0 ? '∞' : activeMock.max_attempts}` },
                ].map(s => (
                  <div key={s.label} style={{ background: '#F8FAFF', borderRadius: 12, padding: '14px' }}>
                    <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 4 }}>{s.label}</div>
                    <div style={{ fontWeight: 800, fontSize: 15, color: '#0D1E4A' }}>{s.val}</div>
                  </div>
                ))}
              </div>

              <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 12, padding: '12px 16px', marginBottom: 24, textAlign: 'left', fontSize: 13, color: '#92400E' }}>
                ⚠️ Убакыт башталганда токтотуу мүмкүн эмес. Убакыт бүткөндө автоматтуу тапшырылат.
              </div>

              <button onClick={() => setView('mock_test')}
                style={{ width: '100%', background: subjectColor(activeMock.subject), color: '#fff', border: 'none', borderRadius: 13, padding: '14px', fontWeight: 900, fontSize: 15, cursor: 'pointer' }}>
                🚀 Тестти баштоо
              </button>
            </div>
          </div>
        )}

        {/* ── MOCK TEST ── */}
        {view === 'mock_test' && activeMock && (
          <MockTestView
            test={activeMock}
            questions={mockQuestions}
            answers={mockAnswers}
            setAnswers={setMockAnswers}
            onSubmit={() => submitMock()}
            submitting={submitting}
          />
        )}

        {/* ── MOCK RESULT ── */}
        {view === 'mock_result' && mockResult && activeMock && (
          <div className="fade" style={{ maxWidth: 600, margin: '0 auto' }}>
            <div style={{ background: '#fff', borderRadius: 24, border: '1px solid #E2E8F0', padding: '32px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>
                {mockResult.total_score >= 110 ? '🎉' : mockResult.total_score >= 70 ? '💪' : '📚'}
              </div>
              <div style={{ fontWeight: 900, fontSize: 16, color: '#0D1E4A', marginBottom: 20 }}>{activeMock.title}</div>

              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
                <ScoreRing score={mockResult.total_score} max={145} size={100} />
              </div>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#64748B', marginBottom: 24 }}>
                {mockResult.total_score >= 110 ? 'Мыкты натыйжа!' : mockResult.total_score >= 70 ? 'Жакшы, уланта бер!' : 'Машыгуу керек, кайра аракет!'}
              </div>

              {/* Score breakdown */}
              {activeMock.subject === 'math' ? (
                <div className="score-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10, marginBottom: 24 }}>
                  {[
                    { label: 'Салыштыруу', val: mockResult.math_comparison_score, max: 30, color: BLUE },
                    { label: 'Математика', val: mockResult.math_raw_score, max: 30, color: '#0EA5E9' },
                  ].map(s => (
                    <div key={s.label} style={{ background: '#F8FAFF', borderRadius: 12, padding: 14 }}>
                      <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 4 }}>{s.label}</div>
                      <div style={{ fontWeight: 900, fontSize: 20, color: s.color }}>{s.val}<span style={{ fontSize: 12, color: '#94A3B8', fontWeight: 400 }}>/{s.max}</span></div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="score-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 24 }}>
                  {[
                    { label: 'Аналогия', val: mockResult.analogy_score, max: 30, color: '#7C3AED' },
                    { label: 'Окуу', val: mockResult.reading_score, max: 30, color: '#059669' },
                    { label: 'Грамматика', val: mockResult.grammar_score, max: 30, color: '#D97706' },
                  ].map(s => (
                    <div key={s.label} style={{ background: '#F8FAFF', borderRadius: 12, padding: 14 }}>
                      <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 4 }}>{s.label}</div>
                      <div style={{ fontWeight: 900, fontSize: 20, color: s.color }}>{s.val}<span style={{ fontSize: 12, color: '#94A3B8', fontWeight: 400 }}>/{s.max}</span></div>
                    </div>
                  ))}
                </div>
              )}

              <div className="result-btns" style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                <button onClick={() => setView('dashboard')} style={{ background: '#F1F5F9', color: '#0D1E4A', border: 'none', borderRadius: 12, padding: '12px 20px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>← Панель</button>
                <button onClick={() => setView('mock_list')} style={{ background: '#F1F5F9', color: '#0D1E4A', border: 'none', borderRadius: 12, padding: '12px 20px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Тесттер</button>
                {(activeMock.max_attempts === 0 || getMockAttempts(activeMock.id) < activeMock.max_attempts) && (
                  <button onClick={() => openMock(activeMock)} style={{ background: BLUE, color: '#fff', border: 'none', borderRadius: 12, padding: '12px 20px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>🔄 Кайра</button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── PRACTICE ── */}
        {view === 'practice' && (
          <div className="fade">
            <div style={{ marginBottom: 20 }}>
              <h2 style={{ fontSize: 'clamp(17px,5vw,20px)', fontWeight: 900, margin: 0 }}>🎯 Практика</h2>
              <p style={{ color: '#64748B', fontSize: 13, margin: '4px 0 0' }}>Тема боюнча видео + тест</p>
            </div>

            {/* Subject switcher */}
            <div style={{ display: 'flex', background: '#F1F5F9', borderRadius: 12, padding: 4, gap: 4, marginBottom: 20, width: 'fit-content' }}>
              {(['math', 'kyr'] as const).map(s => (
                <button key={s} onClick={() => { setPracticeSubject(s); fetchLessons(s) }}
                  style={{ padding: '8px 20px', borderRadius: 9, border: 'none', fontSize: 13, fontWeight: practiceSubject === s ? 700 : 600, cursor: 'pointer', background: practiceSubject === s ? subjectColor(s) : 'transparent', color: practiceSubject === s ? '#fff' : '#64748B', transition: 'all 0.15s' }}>
                  {subjectLabel(s)}
                </button>
              ))}
            </div>

            {lessons.length === 0 ? (
              <div style={{ background: '#fff', borderRadius: 18, border: '1px solid #E2E8F0', padding: '40px 20px', textAlign: 'center', color: '#94A3B8' }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>📚</div>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#0D1E4A' }}>Сабак жок</div>
              </div>
            ) : (
              <div className="lesson-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12 }}>
                {lessons.map((l, i) => {
                  const res = getLessonResult(l.id)
                  const color = subjectColor(practiceSubject)
                  return (
                    <div key={l.id} className="card-hover" onClick={() => openLesson(l)}
                      style={{ background: '#fff', borderRadius: 16, border: `1px solid ${res?.passed ? '#BBF7D0' : '#E2E8F0'}`, padding: 18, cursor: 'pointer' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                        <div style={{ width: 36, height: 36, background: res?.passed ? '#F0FDF4' : subjectBg(practiceSubject), borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 13, color: res?.passed ? '#10B981' : color, flexShrink: 0 }}>
                          {res?.passed ? '✓' : i + 1}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 13, color: '#0D1E4A', marginBottom: 4, lineHeight: 1.3 }}>{l.title}</div>
                          {l.description && <div style={{ fontSize: 11, color: '#94A3B8', lineHeight: 1.4 }}>{l.description}</div>}
                        </div>
                        {res && (
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <div style={{ fontWeight: 800, fontSize: 14, color: res.passed ? '#10B981' : '#F59E0B' }}>
                              {Math.round((res.score / res.total) * 100)}%
                            </div>
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

        {/* ── LESSON ── */}
        {view === 'lesson' && activeLesson && (
          <div className="fade">
            <h2 style={{ fontSize: 'clamp(16px,5vw,19px)', fontWeight: 900, marginBottom: 6, lineHeight: 1.3 }}>{activeLesson.title}</h2>
            {activeLesson.description && <p style={{ color: '#64748B', fontSize: 13, marginBottom: 18 }}>{activeLesson.description}</p>}

            {activeLesson.video_url && (
              <div style={{ borderRadius: 16, overflow: 'hidden', marginBottom: 20, background: '#000', aspectRatio: '16/9' }}>
                <iframe src={getEmbed(activeLesson.video_url)} style={{ width: '100%', height: '100%', border: 'none' }} allowFullScreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" title={activeLesson.title} />
              </div>
            )}

            {/* Practice tests for this lesson */}
            {practiceTests.length > 0 && (
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>📝 Тесттер</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {practiceTests.map(test => {
                    const res = pResults.find(r => r.test_id === test.id)
                    return (
                      <div key={test.id} style={{ background: '#fff', borderRadius: 14, border: '1px solid #E2E8F0', padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 14, color: '#0D1E4A', marginBottom: 4 }}>{test.title}</div>
                          {test.time_limit_minutes && <div style={{ fontSize: 12, color: '#94A3B8' }}>⏱ {test.time_limit_minutes} мин</div>}
                        </div>
                        {res && (
                          <div style={{ textAlign: 'center', flexShrink: 0 }}>
                            <div style={{ fontWeight: 800, fontSize: 16, color: res.passed ? '#10B981' : '#F59E0B' }}>{Math.round((res.score / res.total) * 100)}%</div>
                            <div style={{ fontSize: 10, color: res.passed ? '#10B981' : '#F59E0B', fontWeight: 700 }}>{res.passed ? 'Өттү' : 'Кайра'}</div>
                          </div>
                        )}
                        <button onClick={() => startPracticeTest(test)}
                          style={{ background: res ? '#F8FAFF' : BLUE, color: res ? BLUE : '#fff', border: res ? `1.5px solid ${BLUE}` : 'none', borderRadius: 10, padding: '9px 16px', fontWeight: 700, fontSize: 13, cursor: 'pointer', flexShrink: 0 }}>
                          {res ? 'Кайра' : 'Баштоо →'}
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {practiceTests.length === 0 && (
              <div style={{ background: '#F8FAFF', borderRadius: 14, border: '1px solid #E2E8F0', padding: '24px', textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>
                Бул сабак үчүн тест кошулган жок
              </div>
            )}
          </div>
        )}

        {/* ── PRACTICE TEST ── */}
        {view === 'practice_test' && activePTest && (
          <div className="fade">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: 17, fontWeight: 900, margin: 0 }}>{activePTest.title}</h2>
              <div style={{ fontWeight: 700, fontSize: 13, color: BLUE, background: '#EEF2FF', padding: '4px 12px', borderRadius: 20 }}>
                {Object.keys(pAnswers).length}/{pQuestions.length}
              </div>
            </div>
            <div style={{ background: '#E2E8F0', borderRadius: 999, height: 6, marginBottom: 20, overflow: 'hidden' }}>
              <div style={{ width: `${(Object.keys(pAnswers).length / pQuestions.length) * 100}%`, height: '100%', background: BLUE, borderRadius: 999, transition: 'width 0.3s' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {pQuestions.map((q, qi) => (
                <div key={q.id} style={{ background: '#fff', borderRadius: 14, border: `1px solid ${pAnswers[q.id] ? '#BFDBFE' : '#E2E8F0'}`, padding: '16px 18px' }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#0D1E4A', marginBottom: 12, lineHeight: 1.5 }}>
                    <span style={{ color: BLUE, marginRight: 6, fontWeight: 800 }}>#{qi + 1}</span>
                    {q.image_url ? <img src={q.image_url} alt="q" style={{ maxHeight: 80, borderRadius: 8, display: 'block', marginTop: 6 }} /> : q.question_text}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                    {['A', 'B', 'C', 'D'].map(opt => {
                      const text = (q as any)[`option_${opt.toLowerCase()}`]
                      const selected = pAnswers[q.id] === opt
                      return (
                        <button key={opt} onClick={() => setPAnswers(p => ({ ...p, [q.id]: opt }))}
                          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 13px', borderRadius: 10, border: `2px solid ${selected ? BLUE : '#E2E8F0'}`, background: selected ? '#EEF2FF' : '#FAFBFF', cursor: 'pointer', textAlign: 'left', fontFamily: 'Inter, sans-serif', width: '100%' }}>
                          <div style={{ width: 20, height: 20, borderRadius: '50%', border: `2px solid ${selected ? BLUE : '#CBD5E1'}`, background: selected ? BLUE : 'transparent', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {selected && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />}
                          </div>
                          <span style={{ fontSize: 13, color: selected ? BLUE : '#475569', fontWeight: selected ? 600 : 400, lineHeight: 1.4 }}>{text}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
            <button onClick={submitPractice} disabled={submitting || Object.keys(pAnswers).length < pQuestions.length}
              style={{ width: '100%', marginTop: 18, background: Object.keys(pAnswers).length < pQuestions.length ? '#E2E8F0' : BLUE, color: Object.keys(pAnswers).length < pQuestions.length ? '#94A3B8' : '#fff', border: 'none', borderRadius: 14, padding: '14px', fontWeight: 900, fontSize: 15, cursor: Object.keys(pAnswers).length < pQuestions.length ? 'not-allowed' : 'pointer' }}>
              {submitting ? 'Жөнөтүлүүдө...' : Object.keys(pAnswers).length < pQuestions.length ? `${pQuestions.length - Object.keys(pAnswers).length} суроо калды` : '✓ Тапшыруу'}
            </button>
          </div>
        )}

        {/* ── PRACTICE RESULT ── */}
        {view === 'practice_result' && pResult && (
          <div className="fade" style={{ maxWidth: 520, margin: '0 auto', textAlign: 'center' }}>
            <div style={{ background: '#fff', borderRadius: 22, border: `2px solid ${pResult.passed ? '#BBF7D0' : '#FECACA'}`, padding: '32px 22px' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>{pResult.passed ? '🎉' : '💪'}</div>
              <div style={{ fontWeight: 900, fontSize: 44, color: pResult.passed ? '#10B981' : '#EF4444', letterSpacing: '-2px', marginBottom: 8 }}>
                {Math.round((pResult.score / pResult.total) * 100)}%
              </div>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#0D1E4A', marginBottom: 5 }}>{pResult.score} / {pResult.total} туура жооп</div>
              <div style={{ fontWeight: 800, fontSize: 13, color: pResult.passed ? '#10B981' : '#F59E0B', marginBottom: 22 }}>
                {pResult.passed ? '✓ Тема өттүңүз!' : 'Кайра аракет кылыңыз'}
              </div>
              {!pResult.passed && pResult.wrong.length > 0 && (
                <div style={{ background: '#FEF2F2', borderRadius: 12, padding: '14px 16px', textAlign: 'left', marginBottom: 20 }}>
                  <div style={{ fontWeight: 700, fontSize: 12, color: '#EF4444', marginBottom: 8 }}>Каталар:</div>
                  {pResult.wrong.slice(0, 5).map(wi => (
                    <div key={wi} style={{ fontSize: 12, color: '#64748B', marginBottom: 5, lineHeight: 1.5 }}>
                      <span style={{ color: '#EF4444', fontWeight: 700 }}>#{wi + 1}</span> {pQuestions[wi]?.question_text} —{' '}
                      <span style={{ color: '#10B981', fontWeight: 600 }}>{(pQuestions[wi] as any)?.[`option_${pQuestions[wi]?.correct_answer?.toLowerCase()}`]}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="result-btns" style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                <button onClick={() => setView('lesson')} style={{ background: '#F1F5F9', color: '#0D1E4A', border: 'none', borderRadius: 11, padding: '11px 18px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>← Сабак</button>
                <button onClick={() => setView('practice')} style={{ background: '#F1F5F9', color: '#0D1E4A', border: 'none', borderRadius: 11, padding: '11px 18px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>📚 Практика</button>
                {!pResult.passed && activePTest && (
                  <button onClick={() => startPracticeTest(activePTest)} style={{ background: BLUE, color: '#fff', border: 'none', borderRadius: 11, padding: '11px 18px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>🔄 Кайра</button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── BOTTOM NAV (mobile) ── */}
      <div className="bottom-nav" style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', borderTop: '1px solid #E2E8F0', display: 'none', zIndex: 200, paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {[
          { id: 'dashboard', icon: '🏠', label: 'Башкы' },
          { id: 'mock_list', icon: '📋', label: 'Тесттер' },
          { id: 'practice', icon: '🎯', label: 'Практика' },
        ].map(tab => (
          <button key={tab.id} onClick={() => {
            setView(tab.id as View)
            if (tab.id === 'practice') fetchLessons(practiceSubject)
          }} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '8px 4px', border: 'none', background: 'transparent', cursor: 'pointer', color: view === tab.id || (tab.id === 'mock_list' && ['mock_intro','mock_test','mock_result'].includes(view)) || (tab.id === 'practice' && ['lesson','practice_test','practice_result'].includes(view)) ? BLUE : '#94A3B8' }}>
            <div style={{ fontSize: 20 }}>{tab.icon}</div>
            <div style={{ fontSize: 10, fontWeight: 600, marginTop: 3 }}>{tab.label}</div>
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Mock Test View (with timer) ─────────────────────────────────────────────
function MockTestView({ test, questions, answers, setAnswers, onSubmit, submitting }: {
  test: MockTest
  questions: Question[]
  answers: Record<string, string>
  setAnswers: (a: Record<string, string>) => void
  onSubmit: () => void
  submitting: boolean
}) {
  const totalSecs = test.time_limit_minutes * 60
  const { left, start } = useTimer(totalSecs, onSubmit)
  const [activeQ, setActiveQ] = useState(0)

  useEffect(() => { start() }, [])

  const answered = Object.keys(answers).length
  const q = questions[activeQ]
  const BLUE = '#1B4FD8'

  return (
    <div>
      {/* Header */}
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', padding: '14px 18px', marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#0D1E4A' }}>{test.title}</div>
          <div style={{ fontWeight: 700, fontSize: 13, color: BLUE }}>{answered}/{questions.length}</div>
        </div>
        <TimerBar left={left} total={totalSecs} />
      </div>

      {/* Question navigator */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
        {questions.map((q, i) => (
          <button key={i} onClick={() => setActiveQ(i)}
            style={{ width: 34, height: 34, borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700,
              background: answers[q.id] ? '#1B4FD8' : i === activeQ ? '#EEF2FF' : '#F1F5F9',
              color: answers[q.id] ? '#fff' : i === activeQ ? '#1B4FD8' : '#64748B',
              outline: i === activeQ ? '2px solid #1B4FD8' : 'none' }}>
            {i + 1}
          </button>
        ))}
      </div>

      {/* Question card */}
      {q && (
        <div style={{ background: '#fff', borderRadius: 16, border: `1px solid ${answers[q.id] ? '#BFDBFE' : '#E2E8F0'}`, padding: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ fontWeight: 800, fontSize: 13, color: BLUE }}>#{activeQ + 1}</span>
            {q.section && q.section !== 'general' && (
              <span style={{ background: '#EEF2FF', color: BLUE, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>
                {q.section === 'comparison' ? 'Салыштыруу' : q.section === 'math' ? 'Математика' : q.section === 'analogy' ? 'Аналогия' : q.section === 'reading' ? 'Окуу' : 'Грамматика'}
              </span>
            )}
          </div>
          {q.image_url
            ? <img src={q.image_url} alt="question" style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 10, marginBottom: 14, display: 'block' }} />
            : <div style={{ fontWeight: 700, fontSize: 14, color: '#0D1E4A', marginBottom: 14, lineHeight: 1.6 }}>{q.question_text}</div>
          }
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {['A', 'B', 'C', 'D'].map(opt => {
              const text = (q as any)[`option_${opt.toLowerCase()}`]
              const selected = answers[q.id] === opt
              return (
                <button key={opt} onClick={() => setAnswers({ ...answers, [q.id]: opt })}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderRadius: 10, border: `2px solid ${selected ? BLUE : '#E2E8F0'}`, background: selected ? '#EEF2FF' : '#FAFBFF', cursor: 'pointer', textAlign: 'left', fontFamily: 'Inter, sans-serif', width: '100%' }}>
                  <div style={{ width: 22, height: 22, borderRadius: '50%', border: `2px solid ${selected ? BLUE : '#CBD5E1'}`, background: selected ? BLUE : 'transparent', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {selected && <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#fff' }} />}
                  </div>
                  <span style={{ fontSize: 13, color: selected ? BLUE : '#475569', fontWeight: selected ? 600 : 400, lineHeight: 1.4 }}>{text}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
        {activeQ > 0 && (
          <button onClick={() => setActiveQ(p => p - 1)} style={{ flex: 1, background: '#F1F5F9', color: '#64748B', border: 'none', borderRadius: 12, padding: 12, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>← Артка</button>
        )}
        {activeQ < questions.length - 1 ? (
          <button onClick={() => setActiveQ(p => p + 1)} style={{ flex: 1, background: BLUE, color: '#fff', border: 'none', borderRadius: 12, padding: 12, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Кийинки →</button>
        ) : (
          <button onClick={onSubmit} disabled={submitting}
            style={{ flex: 1, background: answered === questions.length ? '#10B981' : '#F59E0B', color: '#fff', border: 'none', borderRadius: 12, padding: 12, fontWeight: 900, fontSize: 13, cursor: 'pointer' }}>
            {submitting ? 'Жөнөтүлүүдө...' : answered < questions.length ? `⚠️ ${questions.length - answered} жооп жок — тапшыруу` : '✓ Тест тапшыруу'}
          </button>
        )}
      </div>
    </div>
  )
}