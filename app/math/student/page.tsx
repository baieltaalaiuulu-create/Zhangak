'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

interface Lesson {
  id: string; title: string; class_number: number
  video_url: string; description: string; order_number: number
}
interface Question {
  id: string; question: string; options: string[]; correct_answer: number; order_number: number
}
interface Result {
  id: string; lesson_id: string; score: number; total: number; passed: boolean; created_at: string
}

type View = 'lessons' | 'lesson' | 'test' | 'result'

export default function MathStudentPage() {
  const [profile, setProfile] = useState<any>(null)
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [results, setResults] = useState<Result[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<View>('lessons')
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
    fetchData(user.id, prof.class_number || 6)
  }

  const fetchData = async (uid: string, classNum: number) => {
    const [{ data: l }, { data: r }] = await Promise.all([
      supabase.from('math_lessons').select('*').eq('class_number', classNum).order('order_number'),
      supabase.from('math_results').select('*').eq('student_id', uid).order('created_at', { ascending: false }),
    ])
    setLessons(l || [])
    setResults(r || [])
    setLoading(false)
  }

  const openLesson = async (lesson: Lesson) => {
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

    await supabase.from('math_results').insert({
      student_id: profile.id,
      lesson_id: activeLesson.id,
      score,
      total,
      passed,
    })

    setTestResult({ score, total, passed, wrong })
    setView('result')

    // Refresh results
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

  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/') }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8FAFF' }}>
      <div style={{ textAlign: 'center', color: '#64748B' }}>Жүктөлүүдө...</div>
    </div>
  )

  const passedCount = lessons.filter(l => getBestResult(l.id)?.passed).length

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFF', fontFamily: 'Inter, sans-serif' }}>
      {/* NAVBAR */}
      <nav style={{ background: '#fff', borderBottom: '1px solid #E2E8F0', padding: '0 32px', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {view !== 'lessons' && (
            <button onClick={() => { setView('lessons'); setActiveLesson(null); setTestResult(null) }}
              style={{ background: '#F8FAFF', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '6px 12px', fontSize: '13px', cursor: 'pointer', marginRight: '8px', color: '#64748B' }}>
              ← Артка
            </button>
          )}
          <div style={{ width: '32px', height: '32px', background: '#1B4FD8', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img src="/images/logo.png" alt="Z" style={{ width: '32px', height: '32px', objectFit: 'cover', borderRadius: '8px' }} />
          </div>
          <span style={{ fontWeight: '900', fontSize: '16px', color: '#0D1E4A' }}>Zhangak</span>
          <span style={{ fontWeight: '800', fontSize: '12px', color: '#1B4FD8', background: '#EEF2FF', padding: '2px 8px', borderRadius: '6px' }}>Math</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#F1F5F9', borderRadius: '10px', padding: '6px 12px' }}>
            <div style={{ width: '24px', height: '24px', background: '#1B4FD8', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: '700', fontSize: '11px' }}>
              {profile?.full_name?.[0]}
            </div>
            <span style={{ fontSize: '13px', fontWeight: '600', color: '#0D1E4A' }}>{profile?.full_name}</span>
          </div>
          <button onClick={handleLogout} style={{ background: 'none', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '6px 14px', fontSize: '13px', color: '#64748B', cursor: 'pointer' }}>Чыгуу</button>
        </div>
      </nav>

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '32px 24px' }}>

        {/* LESSONS LIST */}
        {view === 'lessons' && (
          <div>
            {/* Header */}
            <div style={{ marginBottom: '28px' }}>
              <h1 style={{ fontSize: '24px', fontWeight: '900', color: '#0D1E4A', margin: 0 }}>
                Саламатсызбы, {profile?.full_name?.split(' ')[0]} 👋
              </h1>
              <p style={{ color: '#64748B', fontSize: '14px', margin: '6px 0 0' }}>
                {profile?.class_number || 6}-класс · Математика курсу
              </p>
            </div>

            {/* Progress */}
            <div style={{ background: '#fff', borderRadius: '20px', border: '1px solid #E2E8F0', padding: '20px 24px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '20px' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontWeight: '700', fontSize: '14px', color: '#0D1E4A' }}>Прогресс</span>
                  <span style={{ fontWeight: '700', fontSize: '14px', color: '#1B4FD8' }}>{passedCount}/{lessons.length}</span>
                </div>
                <div style={{ background: '#E8ECF4', borderRadius: '999px', height: '8px', overflow: 'hidden' }}>
                  <div style={{ width: lessons.length > 0 ? `${(passedCount / lessons.length) * 100}%` : '0%', height: '100%', background: '#1B4FD8', borderRadius: '999px', transition: 'width 0.6s ease' }} />
                </div>
                <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '6px' }}>
                  {passedCount === lessons.length && lessons.length > 0 ? '🎉 Бардык сабактар аяктады!' : `${lessons.length - passedCount} сабак калды`}
                </div>
              </div>
              <div style={{ textAlign: 'center', flexShrink: 0 }}>
                <div style={{ fontWeight: '900', fontSize: '28px', color: '#1B4FD8' }}>{passedCount}</div>
                <div style={{ fontSize: '11px', color: '#94A3B8' }}>Өттү</div>
              </div>
            </div>

            {/* Lessons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {lessons.map((l, i) => {
                const best = getBestResult(l.id)
                const pct = best ? Math.round((best.score / best.total) * 100) : null
                return (
                  <div key={l.id} onClick={() => openLesson(l)}
                    style={{ background: '#fff', borderRadius: '16px', border: `1px solid ${best?.passed ? '#BBF7D0' : '#E2E8F0'}`, padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer', transition: 'all 0.2s' }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = '#1B4FD8')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = best?.passed ? '#BBF7D0' : '#E2E8F0')}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: best?.passed ? '#F0FDF4' : '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900', fontSize: '14px', color: best?.passed ? '#10B981' : '#1B4FD8', flexShrink: 0 }}>
                      {best?.passed ? '✓' : i + 1}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: '700', fontSize: '15px', color: '#0D1E4A' }}>{l.title}</div>
                      {l.description && <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '2px' }}>{l.description}</div>}
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      {pct !== null ? (
                        <>
                          <div style={{ fontWeight: '800', fontSize: '16px', color: best?.passed ? '#10B981' : '#F59E0B' }}>{pct}%</div>
                          <div style={{ fontSize: '10px', color: best?.passed ? '#10B981' : '#F59E0B', fontWeight: '700' }}>{best?.passed ? 'Өттү' : 'Кайра'}</div>
                        </>
                      ) : (
                        <div style={{ fontSize: '12px', color: '#94A3B8' }}>Баштоо →</div>
                      )}
                    </div>
                  </div>
                )
              })}
              {lessons.length === 0 && (
                <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '48px', textAlign: 'center' }}>
                  <div style={{ fontSize: '40px', marginBottom: '12px' }}>📚</div>
                  <div style={{ fontWeight: '700', color: '#0D1E4A' }}>Сабак жок</div>
                  <div style={{ color: '#94A3B8', fontSize: '13px', marginTop: '4px' }}>Администратор сабак кошкондон кийин пайда болот</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* LESSON VIEW */}
        {view === 'lesson' && activeLesson && (
          <div>
            <h2 style={{ fontSize: '22px', fontWeight: '900', color: '#0D1E4A', marginBottom: '8px' }}>{activeLesson.title}</h2>
            {activeLesson.description && <p style={{ color: '#64748B', fontSize: '14px', marginBottom: '24px' }}>{activeLesson.description}</p>}

            {/* Video */}
            {activeLesson.video_url && (
              <div style={{ borderRadius: '20px', overflow: 'hidden', marginBottom: '24px', background: '#000', aspectRatio: '16/9' }}>
                <iframe
                  src={getYoutubeEmbed(activeLesson.video_url)}
                  style={{ width: '100%', height: '100%', border: 'none' }}
                  allowFullScreen
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  title={activeLesson.title}
                />
              </div>
            )}

            {/* Previous results */}
            {results.filter(r => r.lesson_id === activeLesson.id).length > 0 && (
              <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '20px', marginBottom: '20px' }}>
                <div style={{ fontWeight: '700', fontSize: '14px', color: '#0D1E4A', marginBottom: '12px' }}>Мурунку натыйжалар:</div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {results.filter(r => r.lesson_id === activeLesson.id).slice(0, 5).map(r => (
                    <div key={r.id} style={{ background: r.passed ? '#F0FDF4' : '#FEF2F2', border: `1px solid ${r.passed ? '#BBF7D0' : '#FECACA'}`, borderRadius: '10px', padding: '8px 14px', textAlign: 'center' }}>
                      <div style={{ fontWeight: '800', fontSize: '16px', color: r.passed ? '#10B981' : '#EF4444' }}>{Math.round((r.score / r.total) * 100)}%</div>
                      <div style={{ fontSize: '10px', color: '#94A3B8' }}>{new Date(r.created_at).toLocaleDateString('ru')}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Start test button */}
            <button onClick={startTest} style={{ width: '100%', background: '#1B4FD8', color: '#fff', border: 'none', borderRadius: '14px', padding: '16px', fontWeight: '900', fontSize: '16px', cursor: 'pointer', boxShadow: '0 8px 24px rgba(27,79,216,0.3)' }}>
              📝 Тестти баштоо → (95% өтүш керек)
            </button>
          </div>
        )}

        {/* TEST VIEW */}
        {view === 'test' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: '900', color: '#0D1E4A', margin: 0 }}>Тест</h2>
              <div style={{ fontWeight: '700', fontSize: '14px', color: '#1B4FD8' }}>
                {answers.filter(a => a !== -1).length}/{questions.length} жооп берилди
              </div>
            </div>

            {/* Progress bar */}
            <div style={{ background: '#E8ECF4', borderRadius: '999px', height: '6px', marginBottom: '28px', overflow: 'hidden' }}>
              <div style={{ width: `${(answers.filter(a => a !== -1).length / questions.length) * 100}%`, height: '100%', background: '#1B4FD8', transition: 'width 0.3s ease', borderRadius: '999px' }} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {questions.map((q, qi) => (
                <div key={q.id} style={{ background: '#fff', borderRadius: '16px', border: `1px solid ${answers[qi] !== -1 ? '#BFDBFE' : '#E2E8F0'}`, padding: '20px 24px' }}>
                  <div style={{ fontWeight: '700', fontSize: '15px', color: '#0D1E4A', marginBottom: '16px', lineHeight: '1.5' }}>
                    <span style={{ color: '#1B4FD8', marginRight: '8px' }}>#{qi + 1}</span>{q.question}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {(q.options as string[]).map((opt, oi) => (
                      <button key={oi} onClick={() => { const a = [...answers]; a[qi] = oi; setAnswers(a) }}
                        style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderRadius: '10px', border: `2px solid ${answers[qi] === oi ? '#1B4FD8' : '#E2E8F0'}`, background: answers[qi] === oi ? '#EEF2FF' : '#FAFBFF', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s', fontFamily: 'Inter, sans-serif' }}>
                        <div style={{ width: '24px', height: '24px', borderRadius: '50%', border: `2px solid ${answers[qi] === oi ? '#1B4FD8' : '#CBD5E1'}`, background: answers[qi] === oi ? '#1B4FD8' : 'transparent', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {answers[qi] === oi && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#fff' }} />}
                        </div>
                        <span style={{ fontSize: '14px', color: answers[qi] === oi ? '#1B4FD8' : '#475569', fontWeight: answers[qi] === oi ? '600' : '400' }}>{opt}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <button onClick={submitTest} disabled={submitting || answers.some(a => a === -1)}
              style={{ width: '100%', marginTop: '24px', background: answers.some(a => a === -1) ? '#E2E8F0' : '#1B4FD8', color: answers.some(a => a === -1) ? '#94A3B8' : '#fff', border: 'none', borderRadius: '14px', padding: '16px', fontWeight: '900', fontSize: '16px', cursor: answers.some(a => a === -1) ? 'not-allowed' : 'pointer', transition: 'all 0.2s' }}>
              {submitting ? 'Жөнөтүлүүдө...' : answers.some(a => a === -1) ? `${questions.length - answers.filter(a => a !== -1).length} суроо калды` : '✓ Тапшыруу'}
            </button>
          </div>
        )}

        {/* RESULT VIEW */}
        {view === 'result' && testResult && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ background: '#fff', borderRadius: '24px', border: `2px solid ${testResult.passed ? '#BBF7D0' : '#FECACA'}`, padding: '48px 32px', marginBottom: '24px' }}>
              <div style={{ fontSize: '64px', marginBottom: '16px' }}>{testResult.passed ? '🎉' : '💪'}</div>
              <div style={{ fontWeight: '900', fontSize: '48px', color: testResult.passed ? '#10B981' : '#EF4444', letterSpacing: '-2px', marginBottom: '8px' }}>
                {Math.round((testResult.score / testResult.total) * 100)}%
              </div>
              <div style={{ fontWeight: '700', fontSize: '18px', color: '#0D1E4A', marginBottom: '8px' }}>
                {testResult.score} / {testResult.total} туура жооп
              </div>
              <div style={{ fontWeight: '800', fontSize: '16px', color: testResult.passed ? '#10B981' : '#F59E0B', marginBottom: '24px' }}>
                {testResult.passed ? '✓ Сабак өттүңүз!' : '95% керек — кайра аракет кылыңыз'}
              </div>

              {!testResult.passed && testResult.wrong.length > 0 && (
                <div style={{ background: '#FEF2F2', borderRadius: '12px', padding: '16px', textAlign: 'left', marginBottom: '24px' }}>
                  <div style={{ fontWeight: '700', fontSize: '13px', color: '#EF4444', marginBottom: '8px' }}>Каталар:</div>
                  {testResult.wrong.map(wi => (
                    <div key={wi} style={{ fontSize: '13px', color: '#64748B', marginBottom: '4px' }}>
                      #{wi + 1} {questions[wi]?.question} — туура: <span style={{ color: '#10B981', fontWeight: '600' }}>{questions[wi]?.options[questions[wi]?.correct_answer]}</span>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                <button onClick={() => setView('lessons')} style={{ background: '#F8FAFF', color: '#0D1E4A', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '12px 24px', fontWeight: '700', fontSize: '14px', cursor: 'pointer' }}>
                  ← Сабактарга кайтуу
                </button>
                {!testResult.passed && (
                  <button onClick={startTest} style={{ background: '#1B4FD8', color: '#fff', border: 'none', borderRadius: '12px', padding: '12px 24px', fontWeight: '700', fontSize: '14px', cursor: 'pointer' }}>
                    🔄 Кайра аракет
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