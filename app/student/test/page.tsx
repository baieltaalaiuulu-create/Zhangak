'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'

export default function TestPage() {
  const [test, setTest] = useState<any>(null)
  const [questions, setQuestions] = useState<any[]>([])
  const [current, setCurrent] = useState(0)
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [selected, setSelected] = useState<string | null>(null)
  const [timeLeft, setTimeLeft] = useState(0)
  const [finished, setFinished] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string>('')
  const router = useRouter()
  const searchParams = useSearchParams()
  const testId = searchParams.get('id')

  const BLUE = '#2563EB'
  const DARK = '#0D1E4A'

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }
    setUserId(user.id)
    if (testId) fetchTest(Number(testId))
  }

  const fetchTest = async (id: number) => {
    const { data: t } = await supabase.from('practice_tests').select('*').eq('id', id).single()
    const { data: q } = await supabase.from('questions').select('*').eq('practice_test_id', id).order('order_num')
    setTest(t)
    setQuestions(q || [])
    setTimeLeft((q?.length || 10) * 60) // 1 минута на вопрос
    setLoading(false)
  }

  const finish = useCallback(async (finalAnswers: Record<number, string>) => {
    if (finished) return
    setFinished(true)
    let correct = 0
    questions.forEach(q => {
      if (finalAnswers[q.id] === q.correct_answer) correct++
    })
    const score = Math.round((correct / questions.length) * 100)
    await supabase.from('practice_results').upsert({
      test_id: Number(testId),
      student_id: userId,
      answers: finalAnswers,
      score,
    }, { onConflict: 'test_id,student_id' })
    setResult({ correct, total: questions.length, score })
  }, [finished, questions, testId, userId])

  useEffect(() => {
    if (loading || finished || timeLeft <= 0) return
    if (timeLeft === 0) { finish(answers); return }
    const t = setTimeout(() => setTimeLeft(p => p - 1), 1000)
    return () => clearTimeout(t)
  }, [timeLeft, loading, finished, answers, finish])

  const handleAnswer = () => {
    if (!selected) return
    const q = questions[current]
    const newAnswers = { ...answers, [q.id]: selected }
    setAnswers(newAnswers)
    setSelected(null)
    if (current + 1 >= questions.length) {
      finish(newAnswers)
    } else {
      setCurrent(p => p + 1)
    }
  }

  const goToQuestion = (idx: number) => {
    if (idx === current) return
    if (selected) {
      const q = questions[current]
      setAnswers(p => ({ ...p, [q.id]: selected }))
    }
    setSelected(answers[questions[idx]?.id] || null)
    setCurrent(idx)
  }

  const mins = Math.floor(timeLeft / 60)
  const secs = timeLeft % 60
  const timerColor = timeLeft < 60 ? '#EF4444' : timeLeft < 180 ? '#F59E0B' : '#fff'

  if (loading) return (
    <div style={{ minHeight: '100vh', background: DARK, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ color: '#fff', fontSize: '16px' }}>Жүктөлүүдө...</div>
    </div>
  )

  if (!test || questions.length === 0) return (
    <div style={{ minHeight: '100vh', background: DARK, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ color: '#fff', textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>📝</div>
        <div style={{ fontSize: '18px', fontWeight: '700' }}>Тест табылган жок</div>
        <button onClick={() => router.back()} style={{ marginTop: '20px', background: BLUE, color: '#fff', border: 'none', borderRadius: '10px', padding: '12px 24px', cursor: 'pointer', fontWeight: '700' }}>
          Артка
        </button>
      </div>
    </div>
  )

  // RESULT PAGE
  if (result) return (
    <div style={{ minHeight: '100vh', background: DARK, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif', padding: '20px' }}>
      <div style={{ background: '#0F1E35', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '24px', padding: '48px', maxWidth: '500px', width: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: '64px', marginBottom: '16px' }}>
          {result.score >= 80 ? '🏆' : result.score >= 60 ? '👍' : '📚'}
        </div>
        <h2 style={{ fontSize: '28px', fontWeight: '900', marginBottom: '8px', color: '#fff' }}>Тест аяктады!</h2>
        <div style={{ color: 'rgba(255,255,255,0.5)', marginBottom: '32px', fontSize: '15px' }}>{test.title}</div>

        <div style={{ background: 'rgba(37,99,235,0.15)', border: '1px solid rgba(37,99,235,0.3)', borderRadius: '16px', padding: '24px', marginBottom: '24px' }}>
          <div style={{ fontSize: '56px', fontWeight: '900', color: '#60A5FA', lineHeight: '1' }}>{result.score}%</div>
          <div style={{ color: 'rgba(255,255,255,0.6)', marginTop: '8px', fontSize: '14px' }}>
            {result.correct} туура / {result.total} суроо
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '28px' }}>
          <div style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '12px', padding: '16px' }}>
            <div style={{ color: '#10B981', fontWeight: '900', fontSize: '24px' }}>{result.correct}</div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', marginTop: '4px' }}>✅ Туура</div>
          </div>
          <div style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '12px', padding: '16px' }}>
            <div style={{ color: '#EF4444', fontWeight: '900', fontSize: '24px' }}>{result.total - result.correct}</div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', marginTop: '4px' }}>❌ Туура эмес</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <button onClick={() => router.push('/student')}
            style={{ background: BLUE, color: '#fff', border: 'none', borderRadius: '12px', padding: '14px 28px', fontWeight: '700', fontSize: '15px', cursor: 'pointer' }}>
            Кабинетке кайтуу
          </button>
        </div>
      </div>
    </div>
  )

  const q = questions[current]

  return (
    <div style={{ minHeight: '100vh', background: '#0A0F1E', fontFamily: 'Inter, sans-serif', color: '#fff' }}>

      {/* TOP BAR */}
      <div style={{ background: '#0D1E4A', borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '0 24px', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ fontWeight: '800', fontSize: '15px' }}>{test.title}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: timeLeft < 60 ? 'rgba(239,68,68,0.2)' : BLUE, borderRadius: '10px', padding: '8px 16px' }}>
          <span style={{ fontSize: '18px' }}>⏱</span>
          <span style={{ fontWeight: '900', fontSize: '20px', color: timerColor, fontVariantNumeric: 'tabular-nums' }}>
            {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
          </span>
        </div>
      </div>

      {/* QUESTION NAVIGATOR */}
      <div style={{ background: '#0D1E4A', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '12px 24px', overflowX: 'auto' }}>
        <div style={{ display: 'flex', gap: '6px', minWidth: 'max-content' }}>
          {questions.map((q, i) => {
            const answered = answers[q.id]
            const isCurrent = i === current
            return (
              <button key={i} onClick={() => goToQuestion(i)}
                style={{
                  width: '36px', height: '36px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                  fontWeight: '700', fontSize: '13px',
                  background: isCurrent ? '#fff' : answered ? BLUE : 'rgba(255,255,255,0.1)',
                  color: isCurrent ? DARK : answered ? '#fff' : 'rgba(255,255,255,0.5)',
                  flexShrink: 0,
                }}>
                {i + 1}
              </button>
            )
          })}
        </div>
      </div>

      {/* MAIN */}
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '32px 24px', display: 'grid', gridTemplateColumns: '1fr 380px', gap: '24px', alignItems: 'start' }}>

        {/* QUESTION */}
        <div style={{ background: '#0D1E4A', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ background: BLUE, color: '#fff', borderRadius: '8px', padding: '4px 12px', fontSize: '13px', fontWeight: '700' }}>
              {current + 1} / {questions.length}
            </span>
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>{test.subject === 'math' ? 'Математика' : test.subject === 'kyr' ? 'Кыргыз тили' : 'Тест'}</span>
          </div>
          <div style={{ padding: '40px 24px', minHeight: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {q.image_url ? (
              <img src={q.image_url} alt="question" style={{ maxWidth: '100%', borderRadius: '12px' }} />
            ) : (
              <div style={{ fontSize: '18px', fontWeight: '600', lineHeight: '1.6', textAlign: 'center', color: '#fff' }}>
                {q.question_text}
              </div>
            )}
          </div>
        </div>

        {/* OPTIONS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {[
            { key: 'A', label: q.option_a },
            { key: 'B', label: q.option_b },
            { key: 'C', label: q.option_c },
            { key: 'D', label: q.option_d },
          ].map(opt => (
            <button key={opt.key} onClick={() => setSelected(opt.key)}
              style={{
                background: selected === opt.key ? 'rgba(37,99,235,0.3)' : 'rgba(255,255,255,0.04)',
                border: selected === opt.key ? '2px solid #2563EB' : '1px solid rgba(255,255,255,0.08)',
                borderRadius: '14px', padding: '16px 20px', cursor: 'pointer', textAlign: 'left',
                display: 'flex', alignItems: 'center', gap: '14px', transition: 'all 0.15s',
                color: '#fff',
              }}>
              <div style={{
                width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
                background: selected === opt.key ? BLUE : 'rgba(255,255,255,0.08)',
                border: selected === opt.key ? 'none' : '1px solid rgba(255,255,255,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: '800', fontSize: '13px',
                color: selected === opt.key ? '#fff' : 'rgba(255,255,255,0.5)',
              }}>
                {opt.key}
              </div>
              <span style={{ fontSize: '15px', fontWeight: '500', lineHeight: '1.4' }}>{opt.label}</span>
            </button>
          ))}

          <button onClick={handleAnswer} disabled={!selected}
            style={{
              marginTop: '8px', background: selected ? BLUE : 'rgba(255,255,255,0.05)',
              color: selected ? '#fff' : 'rgba(255,255,255,0.3)',
              border: 'none', borderRadius: '14px', padding: '16px', fontWeight: '900',
              fontSize: '16px', cursor: selected ? 'pointer' : 'not-allowed', transition: 'all 0.15s',
            }}>
            {current + 1 >= questions.length ? 'Аяктоо ✓' : 'Жооп берүү →'}
          </button>

          <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: '12px', marginTop: '4px' }}>
            {Object.keys(answers).length} / {questions.length} суроого жооп берилди
          </div>
        </div>
      </div>
    </div>
  )
}