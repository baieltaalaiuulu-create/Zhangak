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
    if (view === 'result' || view === 'test') { setView('lesson') }
    else if (view === 'lesson') { setView('lessons') }
    else if (view === 'lessons') { setView('classes') }
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8FAFF' }}>
      <div style={{ color: '#64748B', fontSize: '14px' }}>Жүктөлүүдө...</div>
    </div>
  )

  const totalPassed = allLessons.filter(l => getBestResult(l.id)?.passed).length

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFF', fontFamily: 'Inter, sans-serif' }}>

      {/* NAVBAR */}
      <nav style={{ background: '#fff', borderBottom: '1px solid #E2E8F0', padding: '0 24px', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {view !== 'classes' && (
            <button onClick={goBack} style={{ background: '#F8FAFF', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '6px 12px', fontSize: '13px', cursor: 'pointer', color: '#64748B' }}>← Артка</button>
          )}
          <div style={{ width: '32px', height: '32px', background: '#1B4FD8', borderRadius: '8px', overflow: 'hidden' }}>
            <img src="/images/logo.png" alt="Z" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <span style={{ fontWeight: '900', fontSize: '16px', color: '#0D1E4A' }}>Zhangak</span>
          <span style={{ fontWeight: '800', fontSize: '11px', color: '#1B4FD8', background: '#EEF2FF', padding: '2px 8px', borderRadius: '6px' }}>Math</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#F1F5F9', borderRadius: '10px', padding: '5px 12px' }}>
            <div style={{ width: '24px', height: '24px', background: '#1B4FD8', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: '700', fontSize: '11px' }}>
              {profile?.full_name?.[0]}
            </div>
            <span style={{ fontSize: '13px', fontWeight: '600', color: '#0D1E4A' }}>{profile?.full_name}</span>
          </div>
          <button onClick={handleLogout} style={{ background: 'none', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '6px 12px', fontSize: '13px', color: '#64748B', cursor: 'pointer' }}>Чыгуу</button>
        </div>
      </nav>

      <div style={{ maxWidth: '860px', margin: '0 auto', padding: '32px 24px' }}>

        {/* ── CLASSES VIEW ── */}
        {view === 'classes' && (
          <div>
            <div style={{ marginBottom: '28px' }}>
              <h1 style={{ fontSize: '24px', fontWeight: '900', color: '#0D1E4A', margin: 0 }}>
                Саламатсызбы, {profile?.full_name?.split(' ')[0]} 👋
              </h1>
              <p style={{ color: '#64748B', fontSize: '14px', margin: '6px 0 0' }}>Математика курсу · Класс тандаңыз</p>
            </div>

            {/* Overall progress */}
            <div style={{ background: '#fff', borderRadius: '20px', border: '1px solid #E2E8F0', padding: '20px 24px', marginBottom: '28px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ fontWeight: '700', fontSize: '14px', color: '#0D1E4A' }}>Жалпы прогресс</span>
                <span style={{ fontWeight: '700', fontSize: '14px', color: '#1B4FD8' }}>{totalPassed}/{allLessons.length} сабак</span>
              </div>
              <div style={{ background: '#E8ECF4', borderRadius: '999px', height: '8px', overflow: 'hidden' }}>
                <div style={{ width: allLessons.length > 0 ? `${(totalPassed / allLessons.length) * 100}%` : '0%', height: '100%', background: '#1B4FD8', borderRadius: '999px', transition: 'width 0.6s ease' }} />
              </div>
            </div>

            {/* Class cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '16px' }}>
              {[6, 7, 8].map(cls => {
                const c = CLASS_COLORS[cls]
                const { total, passed } = getClassProgress(cls)
                const pct = total > 0 ? Math.round((passed / total) * 100) : 0
                const isMyClass = profile?.class_number === cls
                return (
                  <div key={cls} onClick={() => openClass(cls)}
                    style={{ background: '#fff', borderRadius: '20px', border: `${isMyClass ? '2px' : '1px'} solid ${isMyClass ? c.color : '#E2E8F0'}`, padding: '24px', cursor: 'pointer', transition: 'all 0.2s', position: 'relative', overflow: 'hidden', boxShadow: isMyClass ? `0 4px 20px ${c.color}22` : 'none' }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = `0 8px 24px ${c.color}22` }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = isMyClass ? `0 4px 20px ${c.color}22` : 'none' }}>
                    {isMyClass && (
                      <div style={{ position: 'absolute', top: '12px', right: '12px', background: c.color, color: '#fff', fontSize: '10px', fontWeight: '800', padding: '3px 8px', borderRadius: '20px' }}>
                        Менин класс
                      </div>
                    )}
                    <div style={{ width: '48px', height: '48px', background: c.bg, borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', marginBottom: '16px' }}>
                      {c.emoji}
                    </div>
                    <div style={{ fontWeight: '900', fontSize: '22px', color: '#0D1E4A', marginBottom: '4px' }}>{cls}-класс</div>
                    <div style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '16px' }}>{total} сабак</div>
                    <div style={{ background: '#E8ECF4', borderRadius: '999px', height: '6px', overflow: 'hidden', marginBottom: '8px' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: c.color, borderRadius: '999px', transition: 'width 0.6s ease' }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', color: '#94A3B8' }}>{passed}/{total} өттү</span>
                      <span style={{ fontSize: '13px', fontWeight: '700', color: c.color }}>{pct}%</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── LESSONS VIEW ── */}
        {view === 'lessons' && activeClass && (
          <div>
            <div style={{ marginBottom: '24px' }}>
              <h2 style={{ fontSize: '22px', fontWeight: '900', color: '#0D1E4A', margin: 0 }}>
                {CLASS_COLORS[activeClass].emoji} {activeClass}-класс сабактары
              </h2>
              <p style={{ color: '#64748B', fontSize: '13px', margin: '4px 0 0' }}>{lessons.length} сабак</p>
            </div>

            {/* Progress */}
            <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '16px 20px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontWeight: '700', fontSize: '13px', color: '#0D1E4A' }}>Прогресс</span>
                <span style={{ fontWeight: '700', fontSize: '13px', color: CLASS_COLORS[activeClass].color }}>
                  {lessons.filter(l => getBestResult(l.id)?.passed).length}/{lessons.length}
                </span>
              </div>
              <div style={{ background: '#E8ECF4', borderRadius: '999px', height: '6px', overflow: 'hidden' }}>
                <div style={{ width: lessons.length > 0 ? `${(lessons.filter(l => getBestResult(l.id)?.passed).length / lessons.length) * 100}%` : '0%', height: '100%', background: CLASS_COLORS[activeClass].color, borderRadius: '999px' }} />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {lessons.map((l, i) => {
                const best = getBestResult(l.id)
                const pct = best ? Math.round((best.score / best.total) * 100) : null
                const c = CLASS_COLORS[activeClass]
                return (
                  <div key={l.id} onClick={() => openLesson(l)}
                    style={{ background: '#fff', borderRadius: '14px', border: `1px solid ${best?.passed ? '#BBF7D0' : '#E2E8F0'}`, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: '14px', cursor: 'pointer', transition: 'all 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = c.color}
                    onMouseLeave={e => e.currentTarget.style.borderColor = best?.passed ? '#BBF7D0' : '#E2E8F0'}>
                    <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: best?.passed ? '#F0FDF4' : c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900', fontSize: '13px', color: best?.passed ? '#10B981' : c.color, flexShrink: 0 }}>
                      {best?.passed ? '✓' : i + 1}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: '700', fontSize: '14px', color: '#0D1E4A' }}>{l.title}</div>
                      {l.description && <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '2px' }}>{l.description}</div>}
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      {pct !== null ? (
                        <>
                          <div style={{ fontWeight: '800', fontSize: '15px', color: best?.passed ? '#10B981' : '#F59E0B' }}>{pct}%</div>
                          <div style={{ fontSize: '10px', fontWeight: '700', color: best?.passed ? '#10B981' : '#F59E0B' }}>{best?.passed ? 'Өттү' : 'Кайра'}</div>
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
                  <div style={{ fontSize: '36px', marginBottom: '12px' }}>📚</div>
                  <div style={{ fontWeight: '700', color: '#0D1E4A', fontSize: '15px' }}>Сабак жок</div>
                  <div style={{ color: '#94A3B8', fontSize: '13px', marginTop: '4px' }}>Администратор кошкондон кийин пайда болот</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── LESSON VIEW ── */}
        {view === 'lesson' && activeLesson && (
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: '900', color: '#0D1E4A', marginBottom: '6px' }}>{activeLesson.title}</h2>
            {activeLesson.description && <p style={{ color: '#64748B', fontSize: '14px', marginBottom: '20px' }}>{activeLesson.description}</p>}
            {activeLesson.video_url && (
              <div style={{ borderRadius: '20px', overflow: 'hidden', marginBottom: '20px', background: '#000', aspectRatio: '16/9' }}>
                <iframe src={getYoutubeEmbed(activeLesson.video_url)} style={{ width: '100%', height: '100%', border: 'none' }} allowFullScreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" title={activeLesson.title} />
              </div>
            )}
            {results.filter(r => r.lesson_id === activeLesson.id).length > 0 && (
              <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #E2E8F0', padding: '16px 20px', marginBottom: '16px' }}>
                <div style={{ fontWeight: '700', fontSize: '13px', color: '#0D1E4A', marginBottom: '10px' }}>Мурунку натыйжалар:</div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {results.filter(r => r.lesson_id === activeLesson.id).slice(0, 5).map(r => (
                    <div key={r.id} style={{ background: r.passed ? '#F0FDF4' : '#FEF2F2', border: `1px solid ${r.passed ? '#BBF7D0' : '#FECACA'}`, borderRadius: '10px', padding: '8px 14px', textAlign: 'center' }}>
                      <div style={{ fontWeight: '800', fontSize: '15px', color: r.passed ? '#10B981' : '#EF4444' }}>{Math.round((r.score / r.total) * 100)}%</div>
                      <div style={{ fontSize: '10px', color: '#94A3B8' }}>{new Date(r.created_at).toLocaleDateString('ru')}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <button onClick={startTest} style={{ width: '100%', background: '#1B4FD8', color: '#fff', border: 'none', borderRadius: '14px', padding: '15px', fontWeight: '900', fontSize: '15px', cursor: 'pointer', boxShadow: '0 8px 24px rgba(27,79,216,0.3)' }}>
              📝 Тестти баштоо → (95% өтүш керек)
            </button>
          </div>
        )}

        {/* ── TEST VIEW ── */}
        {view === 'test' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '900', color: '#0D1E4A', margin: 0 }}>Тест</h2>
              <div style={{ fontWeight: '700', fontSize: '13px', color: '#1B4FD8' }}>{answers.filter(a => a !== -1).length}/{questions.length}</div>
            </div>
            <div style={{ background: '#E8ECF4', borderRadius: '999px', height: '6px', marginBottom: '24px', overflow: 'hidden' }}>
              <div style={{ width: `${(answers.filter(a => a !== -1).length / questions.length) * 100}%`, height: '100%', background: '#1B4FD8', borderRadius: '999px', transition: 'width 0.3s' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {questions.map((q, qi) => (
                <div key={q.id} style={{ background: '#fff', borderRadius: '14px', border: `1px solid ${answers[qi] !== -1 ? '#BFDBFE' : '#E2E8F0'}`, padding: '18px 20px' }}>
                  <div style={{ fontWeight: '700', fontSize: '14px', color: '#0D1E4A', marginBottom: '14px', lineHeight: '1.5' }}>
                    <span style={{ color: '#1B4FD8', marginRight: '8px' }}>#{qi + 1}</span>{q.question}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {(q.options as string[]).map((opt, oi) => (
                      <button key={oi} onClick={() => { const a = [...answers]; a[qi] = oi; setAnswers(a) }}
                        style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 14px', borderRadius: '10px', border: `2px solid ${answers[qi] === oi ? '#1B4FD8' : '#E2E8F0'}`, background: answers[qi] === oi ? '#EEF2FF' : '#FAFBFF', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s', fontFamily: 'Inter, sans-serif' }}>
                        <div style={{ width: '22px', height: '22px', borderRadius: '50%', border: `2px solid ${answers[qi] === oi ? '#1B4FD8' : '#CBD5E1'}`, background: answers[qi] === oi ? '#1B4FD8' : 'transparent', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {answers[qi] === oi && <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#fff' }} />}
                        </div>
                        <span style={{ fontSize: '14px', color: answers[qi] === oi ? '#1B4FD8' : '#475569', fontWeight: answers[qi] === oi ? '600' : '400' }}>{opt}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <button onClick={submitTest} disabled={submitting || answers.some(a => a === -1)}
              style={{ width: '100%', marginTop: '20px', background: answers.some(a => a === -1) ? '#E2E8F0' : '#1B4FD8', color: answers.some(a => a === -1) ? '#94A3B8' : '#fff', border: 'none', borderRadius: '14px', padding: '15px', fontWeight: '900', fontSize: '15px', cursor: answers.some(a => a === -1) ? 'not-allowed' : 'pointer' }}>
              {submitting ? 'Жөнөтүлүүдө...' : answers.some(a => a === -1) ? `${questions.length - answers.filter(a => a !== -1).length} суроо калды` : '✓ Тапшыруу'}
            </button>
          </div>
        )}

        {/* ── RESULT VIEW ── */}
        {view === 'result' && testResult && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ background: '#fff', borderRadius: '24px', border: `2px solid ${testResult.passed ? '#BBF7D0' : '#FECACA'}`, padding: '44px 28px', marginBottom: '20px' }}>
              <div style={{ fontSize: '56px', marginBottom: '14px' }}>{testResult.passed ? '🎉' : '💪'}</div>
              <div style={{ fontWeight: '900', fontSize: '48px', color: testResult.passed ? '#10B981' : '#EF4444', letterSpacing: '-2px', marginBottom: '8px' }}>
                {Math.round((testResult.score / testResult.total) * 100)}%
              </div>
              <div style={{ fontWeight: '700', fontSize: '16px', color: '#0D1E4A', marginBottom: '6px' }}>{testResult.score} / {testResult.total} туура жооп</div>
              <div style={{ fontWeight: '800', fontSize: '15px', color: testResult.passed ? '#10B981' : '#F59E0B', marginBottom: '24px' }}>
                {testResult.passed ? '✓ Сабак өттүңүз!' : '95% керек — кайра аракет кылыңыз'}
              </div>
              {!testResult.passed && testResult.wrong.length > 0 && (
                <div style={{ background: '#FEF2F2', borderRadius: '12px', padding: '14px', textAlign: 'left', marginBottom: '20px' }}>
                  <div style={{ fontWeight: '700', fontSize: '12px', color: '#EF4444', marginBottom: '8px' }}>Каталар:</div>
                  {testResult.wrong.map(wi => (
                    <div key={wi} style={{ fontSize: '13px', color: '#64748B', marginBottom: '4px' }}>
                      #{wi + 1} {questions[wi]?.question} — <span style={{ color: '#10B981', fontWeight: '600' }}>{questions[wi]?.options[questions[wi]?.correct_answer]}</span>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
                <button onClick={() => setView('classes')} style={{ background: '#F8FAFF', color: '#0D1E4A', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '11px 20px', fontWeight: '700', fontSize: '14px', cursor: 'pointer' }}>
                  ← Класстарга кайтуу
                </button>
                {!testResult.passed && (
                  <button onClick={startTest} style={{ background: '#1B4FD8', color: '#fff', border: 'none', borderRadius: '12px', padding: '11px 20px', fontWeight: '700', fontSize: '14px', cursor: 'pointer' }}>
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