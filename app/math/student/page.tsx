'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

interface Lesson { id: string; title: string; class_number: number; video_url: string; description: string; order_number: number }
interface Question { id: string; question: string; options: string[]; correct_answer: number; order_number: number }
interface Result { id: string; lesson_id: string; score: number; total: number; passed: boolean; created_at: string }

type View = 'classes' | 'lessons' | 'lesson' | 'test' | 'result'

const CLASS_COLORS: Record<number, { color: string; bg: string; light: string; emoji: string }> = {
  6: { color: '#3B82F6', bg: '#EFF6FF', light: '#DBEAFE', emoji: '📐' },
  7: { color: '#1B4FD8', bg: '#EEF2FF', light: '#C7D2FE', emoji: '📊' },
  8: { color: '#7C3AED', bg: '#F5F3FF', light: '#DDD6FE', emoji: '🔢' },
}

export default function MathStudentPage() {
  const [profile, setProfile] = useState<any>(null)
  const [allLessons, setAllLessons] = useState<Lesson[]>([])
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [results, setResults] = useState<Result[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<View>('classes')
  const [activeClass, setActiveClass] = useState<number | null>(null)
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [answers, setAnswers] = useState<number[]>([])
  const [testResult, setTestResult] = useState<{ score: number; total: number; passed: boolean; wrong: number[] } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const router = useRouter()

  useEffect(() => { checkAuth() }, [])

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (prof?.role !== 'math_student') { router.push('/'); return }
    setProfile(prof)
    await fetchData(user.id)
  }

  const fetchData = async (uid: string) => {
    const [{ data: l }, { data: r }] = await Promise.all([
      supabase.from('math_lessons').select('*').order('class_number').order('order_number'),
      supabase.from('math_results').select('*').eq('student_id', uid).order('created_at', { ascending: false }),
    ])
    setAllLessons(l || [])
    setResults(r || [])
    setLoading(false)
  }

  const openClass = (classNum: number) => {
    setActiveClass(classNum)
    setLessons(allLessons.filter(l => l.class_number === classNum))
    setView('lessons')
  }

  const openLesson = (lesson: Lesson) => {
    setActiveLesson(lesson)
    setView('lesson')
    setTestResult(null)
    setAnswers([])
  }

  const startTest = async () => {
    if (!activeLesson) return
    const { data } = await supabase.from('math_questions').select('*').eq('lesson_id', activeLesson.id).order('order_number')
    setQuestions(data || [])
    setAnswers(new Array((data || []).length).fill(-1))
    setView('test')
  }

  const submitTest = async () => {
    if (!activeLesson || !profile) return
    if (answers.some(a => a === -1)) { alert('Бардык суроолорго жооп бериңиз'); return }
    setSubmitting(true)
    let score = 0
    const wrong: number[] = []
    questions.forEach((q, i) => {
      if (answers[i] === q.correct_answer) score++
      else wrong.push(i)
    })
    const total = questions.length
    const passed = score / total >= 0.95
    await supabase.from('math_results').insert({ student_id: profile.id, lesson_id: activeLesson.id, score, total, passed })
    setTestResult({ score, total, passed, wrong })
    setView('result')
    const { data: r } = await supabase.from('math_results').select('*').eq('student_id', profile.id).order('created_at', { ascending: false })
    setResults(r || [])
    setSubmitting(false)
  }

  const getYoutubeEmbed = (url: string) => {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/)
    return match ? `https://www.youtube.com/embed/${match[1]}` : url
  }

  const getBestResult = (lessonId: string) => {
    const r = results.filter(r => r.lesson_id === lessonId)
    if (r.length === 0) return null
    return r.reduce((best, cur) => cur.score > best.score ? cur : best)
  }

  const getClassProgress = (classNum: number) => {
    const cls = allLessons.filter(l => l.class_number === classNum)
    const passed = cls.filter(l => getBestResult(l.id)?.passed).length
    return { total: cls.length, passed }
  }

  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/') }

  const goBack = () => {
    if (view === 'result' || view === 'test') setView('lesson')
    else if (view === 'lesson') setView('lessons')
    else if (view === 'lessons') setView('classes')
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8FAFF', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ color: '#64748B', fontSize: '14px' }}>Жүктөлүүдө...</div>
    </div>
  )

  const totalPassed = allLessons.filter(l => getBestResult(l.id)?.passed).length

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFF', fontFamily: 'Inter, -apple-system, sans-serif' }}>
      <style>{`
        *{box-sizing:border-box}
        @media(max-width:640px){
          .nav-inner{padding:0 14px!important;height:54px!important}
          .nav-name{display:none!important}
          .page-pad{padding:18px 14px!important}
          .classes-grid{grid-template-columns:1fr!important;gap:12px!important}
          .class-card{padding:18px!important}
          .lesson-item{padding:14px 16px!important;gap:12px!important}
          .lesson-num{width:34px!important;height:34px!important;font-size:12px!important}
          .test-progress{margin-bottom:18px!important}
          .q-card{padding:16px!important}
          .q-text{font-size:13px!important}
          .opt-btn{padding:10px 12px!important;gap:10px!important}
          .opt-text{font-size:13px!important}
          .result-card{padding:28px 18px!important}
          .result-score{font-size:40px!important}
          .result-btns{flex-direction:column!important}
          .result-btns button{width:100%!important}
          .prev-results{gap:6px!important}
          .prev-result-item{padding:7px 11px!important}
        }
        @media(hover:hover){
          .lesson-item:hover{border-color:#1B4FD8!important;background:#FAFBFF!important}
          .class-card:hover{transform:translateY(-4px)!important}
          .opt-btn:hover{background:#EEF2FF!important;border-color:#BFDBFE!important}
        }
        .opt-btn:active{transform:scale(0.98)!important}
      `}</style>

      {/* NAVBAR */}
      <nav style={{ background: '#fff', borderBottom: '1px solid #E2E8F0', position: 'sticky', top: 0, zIndex: 100 }}>
        <div className="nav-inner" style={{ maxWidth: '860px', margin: '0 auto', padding: '0 20px', height: '58px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {view !== 'classes' && (
              <button onClick={goBack} style={{ background: '#F8FAFF', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '6px 11px', fontSize: '13px', cursor: 'pointer', color: '#64748B', flexShrink: 0 }}>← Артка</button>
            )}
            <div style={{ width: '30px', height: '30px', background: '#1B4FD8', borderRadius: '7px', overflow: 'hidden', flexShrink: 0 }}>
              <img src="/images/logo.png" alt="Z" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <span style={{ fontWeight: '900', fontSize: '15px', color: '#0D1E4A' }}>Zhangak</span>
            <span style={{ fontWeight: '800', fontSize: '10px', color: '#1B4FD8', background: '#EEF2FF', padding: '2px 7px', borderRadius: '5px' }}>Math</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px', background: '#F1F5F9', borderRadius: '9px', padding: '4px 10px' }}>
              <div style={{ width: '22px', height: '22px', background: '#1B4FD8', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: '700', fontSize: '10px', flexShrink: 0 }}>
                {profile?.full_name?.[0]}
              </div>
              <span className="nav-name" style={{ fontSize: '12px', fontWeight: '600', color: '#0D1E4A' }}>{profile?.full_name}</span>
            </div>
            <button onClick={handleLogout} style={{ background: 'none', border: '1px solid #E2E8F0', borderRadius: '7px', padding: '5px 10px', fontSize: '12px', color: '#64748B', cursor: 'pointer' }}>Чыгуу</button>
          </div>
        </div>
      </nav>

      <div className="page-pad" style={{ maxWidth: '860px', margin: '0 auto', padding: '24px 20px' }}>

        {/* ── CLASSES ── */}
        {view === 'classes' && (
          <div>
            <div style={{ marginBottom: '22px' }}>
              <h1 style={{ fontSize: 'clamp(20px,5vw,24px)', fontWeight: '900', color: '#0D1E4A', margin: 0 }}>
                Саламатсызбы, {profile?.full_name?.split(' ')[0]} 👋
              </h1>
              <p style={{ color: '#64748B', fontSize: '13px', margin: '5px 0 0' }}>Математика курсу · Класс тандаңыз</p>
            </div>

            {/* Overall progress */}
            <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '18px 20px', marginBottom: '22px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ fontWeight: '700', fontSize: '13px', color: '#0D1E4A' }}>Жалпы прогресс</span>
                <span style={{ fontWeight: '700', fontSize: '13px', color: '#1B4FD8' }}>{totalPassed}/{allLessons.length} сабак</span>
              </div>
              <div style={{ background: '#E8ECF4', borderRadius: '999px', height: '8px', overflow: 'hidden' }}>
                <div style={{ width: allLessons.length > 0 ? `${(totalPassed / allLessons.length) * 100}%` : '0%', height: '100%', background: '#1B4FD8', borderRadius: '999px', transition: 'width 0.6s ease' }} />
              </div>
              <div style={{ display: 'flex', gap: '16px', marginTop: '14px' }}>
                {[
                  { label: 'Жалпы', val: allLessons.length, color: '#64748B' },
                  { label: 'Өттүм', val: totalPassed, color: '#10B981' },
                  { label: 'Калды', val: allLessons.length - totalPassed, color: '#F59E0B' },
                ].map(s => (
                  <div key={s.label}>
                    <div style={{ fontWeight: '800', fontSize: '18px', color: s.color }}>{s.val}</div>
                    <div style={{ fontSize: '11px', color: '#94A3B8' }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Class cards */}
            <div className="classes-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '14px' }}>
              {[6, 7, 8].map(cls => {
                const c = CLASS_COLORS[cls]
                const { total, passed } = getClassProgress(cls)
                const pct = total > 0 ? Math.round((passed / total) * 100) : 0
                const isMyClass = profile?.class_number === cls
                return (
                  <div key={cls} className="class-card" onClick={() => openClass(cls)}
                    style={{ background: '#fff', borderRadius: '18px', border: `${isMyClass ? '2px' : '1px'} solid ${isMyClass ? c.color : '#E2E8F0'}`, padding: '22px', cursor: 'pointer', transition: 'all 0.2s', position: 'relative', overflow: 'hidden', boxShadow: isMyClass ? `0 4px 18px ${c.color}22` : 'none' }}>
                    {isMyClass && (
                      <div style={{ position: 'absolute', top: '10px', right: '10px', background: c.color, color: '#fff', fontSize: '9px', fontWeight: '800', padding: '3px 8px', borderRadius: '20px' }}>
                        Менин класс
                      </div>
                    )}
                    <div style={{ width: '44px', height: '44px', background: c.bg, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', marginBottom: '14px' }}>
                      {c.emoji}
                    </div>
                    <div style={{ fontWeight: '900', fontSize: '20px', color: '#0D1E4A', marginBottom: '3px' }}>{cls}-класс</div>
                    <div style={{ fontSize: '11px', color: '#94A3B8', marginBottom: '14px' }}>{total} сабак</div>
                    <div style={{ background: '#E8ECF4', borderRadius: '999px', height: '5px', overflow: 'hidden', marginBottom: '7px' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: c.color, borderRadius: '999px', transition: 'width 0.6s ease' }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', color: '#94A3B8' }}>{passed}/{total} өттү</span>
                      <span style={{ fontSize: '12px', fontWeight: '700', color: c.color }}>{pct}%</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── LESSONS ── */}
        {view === 'lessons' && activeClass && (
          <div>
            <div style={{ marginBottom: '20px' }}>
              <h2 style={{ fontSize: 'clamp(18px,5vw,22px)', fontWeight: '900', color: '#0D1E4A', margin: 0 }}>
                {CLASS_COLORS[activeClass].emoji} {activeClass}-класс сабактары
              </h2>
              <p style={{ color: '#64748B', fontSize: '13px', margin: '4px 0 0' }}>{lessons.length} сабак</p>
            </div>

            {/* Progress bar */}
            <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #E2E8F0', padding: '14px 18px', marginBottom: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontWeight: '700', fontSize: '13px', color: '#0D1E4A' }}>Прогресс</span>
                <span style={{ fontWeight: '700', fontSize: '13px', color: CLASS_COLORS[activeClass].color }}>
                  {lessons.filter(l => getBestResult(l.id)?.passed).length}/{lessons.length}
                </span>
              </div>
              <div style={{ background: '#E8ECF4', borderRadius: '999px', height: '5px', overflow: 'hidden' }}>
                <div style={{ width: lessons.length > 0 ? `${(lessons.filter(l => getBestResult(l.id)?.passed).length / lessons.length) * 100}%` : '0%', height: '100%', background: CLASS_COLORS[activeClass].color, borderRadius: '999px' }} />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
              {lessons.map((l, i) => {
                const best = getBestResult(l.id)
                const pct = best ? Math.round((best.score / best.total) * 100) : null
                const c = CLASS_COLORS[activeClass]
                return (
                  <div key={l.id} className="lesson-item" onClick={() => openLesson(l)}
                    style={{ background: '#fff', borderRadius: '13px', border: `1px solid ${best?.passed ? '#BBF7D0' : '#E2E8F0'}`, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', transition: 'all 0.15s' }}>
                    <div className="lesson-num" style={{ width: '36px', height: '36px', borderRadius: '10px', background: best?.passed ? '#F0FDF4' : c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900', fontSize: '13px', color: best?.passed ? '#10B981' : c.color, flexShrink: 0 }}>
                      {best?.passed ? '✓' : i + 1}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: '700', fontSize: '14px', color: '#0D1E4A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.title}</div>
                      {l.description && <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.description}</div>}
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      {pct !== null ? (
                        <>
                          <div style={{ fontWeight: '800', fontSize: '14px', color: best?.passed ? '#10B981' : '#F59E0B' }}>{pct}%</div>
                          <div style={{ fontSize: '10px', fontWeight: '700', color: best?.passed ? '#10B981' : '#F59E0B' }}>{best?.passed ? 'Өттү' : 'Кайра'}</div>
                        </>
                      ) : (
                        <div style={{ fontSize: '12px', color: '#94A3B8' }}>→</div>
                      )}
                    </div>
                  </div>
                )
              })}
              {lessons.length === 0 && (
                <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '40px 20px', textAlign: 'center' }}>
                  <div style={{ fontSize: '32px', marginBottom: '10px' }}>📚</div>
                  <div style={{ fontWeight: '700', color: '#0D1E4A', fontSize: '14px' }}>Сабак жок</div>
                  <div style={{ color: '#94A3B8', fontSize: '12px', marginTop: '4px' }}>Администратор кошкондон кийин пайда болот</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── LESSON ── */}
        {view === 'lesson' && activeLesson && (
          <div>
            <h2 style={{ fontSize: 'clamp(17px,5vw,20px)', fontWeight: '900', color: '#0D1E4A', marginBottom: '6px', lineHeight: '1.3' }}>{activeLesson.title}</h2>
            {activeLesson.description && <p style={{ color: '#64748B', fontSize: '13px', marginBottom: '18px' }}>{activeLesson.description}</p>}

            {activeLesson.video_url && (
              <div style={{ borderRadius: '16px', overflow: 'hidden', marginBottom: '18px', background: '#000', aspectRatio: '16/9' }}>
                <iframe src={getYoutubeEmbed(activeLesson.video_url)} style={{ width: '100%', height: '100%', border: 'none' }} allowFullScreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" title={activeLesson.title} />
              </div>
            )}

            {results.filter(r => r.lesson_id === activeLesson.id).length > 0 && (
              <div style={{ background: '#fff', borderRadius: '13px', border: '1px solid #E2E8F0', padding: '14px 16px', marginBottom: '14px' }}>
                <div style={{ fontWeight: '700', fontSize: '12px', color: '#0D1E4A', marginBottom: '10px' }}>Мурунку натыйжалар:</div>
                <div className="prev-results" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {results.filter(r => r.lesson_id === activeLesson.id).slice(0, 5).map(r => (
                    <div key={r.id} className="prev-result-item" style={{ background: r.passed ? '#F0FDF4' : '#FEF2F2', border: `1px solid ${r.passed ? '#BBF7D0' : '#FECACA'}`, borderRadius: '10px', padding: '8px 12px', textAlign: 'center' }}>
                      <div style={{ fontWeight: '800', fontSize: '14px', color: r.passed ? '#10B981' : '#EF4444' }}>{Math.round((r.score / r.total) * 100)}%</div>
                      <div style={{ fontSize: '10px', color: '#94A3B8' }}>{new Date(r.created_at).toLocaleDateString('ru')}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button onClick={startTest} style={{ width: '100%', background: '#1B4FD8', color: '#fff', border: 'none', borderRadius: '14px', padding: '15px', fontWeight: '900', fontSize: '15px', cursor: 'pointer', boxShadow: '0 8px 24px rgba(27,79,216,0.28)' }}>
              📝 Тестти баштоо → (95% өтүш керек)
            </button>
          </div>
        )}

        {/* ── TEST ── */}
        {view === 'test' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h2 style={{ fontSize: '17px', fontWeight: '900', color: '#0D1E4A', margin: 0 }}>Тест</h2>
              <div style={{ fontWeight: '700', fontSize: '13px', color: '#1B4FD8', background: '#EEF2FF', padding: '4px 12px', borderRadius: '20px' }}>
                {answers.filter(a => a !== -1).length}/{questions.length}
              </div>
            </div>

            {/* Progress */}
            <div className="test-progress" style={{ background: '#E8ECF4', borderRadius: '999px', height: '6px', marginBottom: '20px', overflow: 'hidden' }}>
              <div style={{ width: `${(answers.filter(a => a !== -1).length / questions.length) * 100}%`, height: '100%', background: '#1B4FD8', borderRadius: '999px', transition: 'width 0.3s' }} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {questions.map((q, qi) => (
                <div key={q.id} className="q-card" style={{ background: '#fff', borderRadius: '14px', border: `1px solid ${answers[qi] !== -1 ? '#BFDBFE' : '#E2E8F0'}`, padding: '16px 18px' }}>
                  <div className="q-text" style={{ fontWeight: '700', fontSize: '14px', color: '#0D1E4A', marginBottom: '12px', lineHeight: '1.5' }}>
                    <span style={{ color: '#1B4FD8', marginRight: '6px', fontWeight: '800' }}>#{qi + 1}</span>{q.question}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                    {(q.options as string[]).map((opt, oi) => (
                      <button key={oi} className="opt-btn" onClick={() => { const a = [...answers]; a[qi] = oi; setAnswers(a) }}
                        style={{ display: 'flex', alignItems: 'center', gap: '11px', padding: '11px 13px', borderRadius: '10px', border: `2px solid ${answers[qi] === oi ? '#1B4FD8' : '#E2E8F0'}`, background: answers[qi] === oi ? '#EEF2FF' : '#FAFBFF', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s', fontFamily: 'Inter, sans-serif', width: '100%' }}>
                        <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: `2px solid ${answers[qi] === oi ? '#1B4FD8' : '#CBD5E1'}`, background: answers[qi] === oi ? '#1B4FD8' : 'transparent', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {answers[qi] === oi && <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#fff' }} />}
                        </div>
                        <span className="opt-text" style={{ fontSize: '14px', color: answers[qi] === oi ? '#1B4FD8' : '#475569', fontWeight: answers[qi] === oi ? '600' : '400', lineHeight: '1.4' }}>{opt}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <button onClick={submitTest} disabled={submitting || answers.some(a => a === -1)}
              style={{ width: '100%', marginTop: '18px', background: answers.some(a => a === -1) ? '#E2E8F0' : '#1B4FD8', color: answers.some(a => a === -1) ? '#94A3B8' : '#fff', border: 'none', borderRadius: '14px', padding: '15px', fontWeight: '900', fontSize: '15px', cursor: answers.some(a => a === -1) ? 'not-allowed' : 'pointer', transition: 'all 0.2s' }}>
              {submitting ? 'Жөнөтүлүүдө...' : answers.some(a => a === -1) ? `${questions.length - answers.filter(a => a !== -1).length} суроо калды` : '✓ Тапшыруу'}
            </button>
          </div>
        )}

        {/* ── RESULT ── */}
        {view === 'result' && testResult && (
          <div style={{ textAlign: 'center' }}>
            <div className="result-card" style={{ background: '#fff', borderRadius: '22px', border: `2px solid ${testResult.passed ? '#BBF7D0' : '#FECACA'}`, padding: '36px 22px', marginBottom: '16px' }}>
              <div style={{ fontSize: '52px', marginBottom: '12px' }}>{testResult.passed ? '🎉' : '💪'}</div>
              <div className="result-score" style={{ fontWeight: '900', fontSize: '48px', color: testResult.passed ? '#10B981' : '#EF4444', letterSpacing: '-2px', marginBottom: '8px' }}>
                {Math.round((testResult.score / testResult.total) * 100)}%
              </div>
              <div style={{ fontWeight: '700', fontSize: '15px', color: '#0D1E4A', marginBottom: '5px' }}>{testResult.score} / {testResult.total} туура жооп</div>
              <div style={{ fontWeight: '800', fontSize: '14px', color: testResult.passed ? '#10B981' : '#F59E0B', marginBottom: '22px' }}>
                {testResult.passed ? '✓ Сабак өттүңүз!' : '95% керек — кайра аракет кылыңыз'}
              </div>

              {!testResult.passed && testResult.wrong.length > 0 && (
                <div style={{ background: '#FEF2F2', borderRadius: '12px', padding: '14px 16px', textAlign: 'left', marginBottom: '20px' }}>
                  <div style={{ fontWeight: '700', fontSize: '12px', color: '#EF4444', marginBottom: '10px' }}>Каталар:</div>
                  {testResult.wrong.map(wi => (
                    <div key={wi} style={{ fontSize: '13px', color: '#64748B', marginBottom: '6px', lineHeight: '1.5' }}>
                      <span style={{ color: '#EF4444', fontWeight: '700' }}>#{wi + 1}</span> {questions[wi]?.question} —{' '}
                      <span style={{ color: '#10B981', fontWeight: '600' }}>{questions[wi]?.options[questions[wi]?.correct_answer]}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="result-btns" style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
                <button onClick={() => setView('classes')} style={{ background: '#F8FAFF', color: '#0D1E4A', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '12px 20px', fontWeight: '700', fontSize: '14px', cursor: 'pointer' }}>
                  ← Класстарга
                </button>
                <button onClick={() => setView('lessons')} style={{ background: '#F1F5F9', color: '#0D1E4A', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '12px 20px', fontWeight: '700', fontSize: '14px', cursor: 'pointer' }}>
                  📚 Сабактар
                </button>
                {!testResult.passed && (
                  <button onClick={startTest} style={{ background: '#1B4FD8', color: '#fff', border: 'none', borderRadius: '12px', padding: '12px 20px', fontWeight: '700', fontSize: '14px', cursor: 'pointer' }}>
                    🔄 Кайра
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}