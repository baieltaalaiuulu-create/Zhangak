'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

interface Student { id: string; full_name: string; class_number: number }
interface Result { id: string; lesson_id: string; score: number; total: number; passed: boolean; created_at: string; math_lessons: { title: string; class_number: number } }
interface Lesson { id: string; title: string; class_number: number; order_number: number }

export default function MathParentPage() {
  const [profile, setProfile] = useState<any>(null)
  const [students, setStudents] = useState<Student[]>([])
  const [activeStudent, setActiveStudent] = useState<Student | null>(null)
  const [results, setResults] = useState<Result[]>([])
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => { checkAuth() }, [])

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (prof?.role !== 'math_parent') { router.push('/'); return }
    setProfile(prof)
    fetchStudents(user.id)
  }

  const fetchStudents = async (parentId: string) => {
    const { data: links } = await supabase.from('math_parent_student').select('student_id').eq('parent_id', parentId)
    if (!links || links.length === 0) { setLoading(false); return }

    const ids = links.map(l => l.student_id)
    const { data: studs } = await supabase.from('profiles').select('id, full_name, class_number').in('id', ids)
    setStudents(studs || [])
    if (studs && studs.length > 0) selectStudent(studs[0])
    setLoading(false)
  }

  const selectStudent = async (student: Student) => {
    setActiveStudent(student)
    const [{ data: r }, { data: l }] = await Promise.all([
      supabase.from('math_results').select('*, math_lessons(title, class_number)').eq('student_id', student.id).order('created_at', { ascending: false }),
      supabase.from('math_lessons').select('*').eq('class_number', student.class_number || 6).order('order_number'),
    ])
    setResults(r || [])
    setLessons(l || [])
  }

  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/') }

  const getBestResult = (lessonId: string) => {
    const r = results.filter(r => r.lesson_id === lessonId)
    if (r.length === 0) return null
    return r.reduce((best, cur) => cur.score > best.score ? cur : best)
  }

  const passedCount = lessons.filter(l => getBestResult(l.id)?.passed).length
  const avgScore = results.length > 0 ? Math.round(results.reduce((s, r) => s + (r.score / r.total) * 100, 0) / results.length) : 0

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8FAFF' }}>
      <div style={{ color: '#64748B' }}>Жүктөлүүдө...</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFF', fontFamily: 'Inter, sans-serif' }}>
      {/* NAVBAR */}
      <nav style={{ background: '#fff', borderBottom: '1px solid #E2E8F0', padding: '0 32px', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '32px', height: '32px', background: '#1B4FD8', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img src="/images/logo.png" alt="Z" style={{ width: '32px', height: '32px', objectFit: 'cover', borderRadius: '8px' }} />
          </div>
          <span style={{ fontWeight: '900', fontSize: '16px', color: '#0D1E4A' }}>Zhangak</span>
          <span style={{ fontWeight: '800', fontSize: '12px', color: '#1B4FD8', background: '#EEF2FF', padding: '2px 8px', borderRadius: '6px' }}>Math</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '13px', color: '#64748B' }}>{profile?.full_name}</span>
          <button onClick={handleLogout} style={{ background: 'none', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '6px 14px', fontSize: '13px', color: '#64748B', cursor: 'pointer' }}>Чыгуу</button>
        </div>
      </nav>

      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '32px 24px' }}>
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '22px', fontWeight: '900', color: '#0D1E4A', margin: 0 }}>Балаңыздын прогрессу 👨‍👩‍👧</h1>
          <p style={{ color: '#64748B', fontSize: '14px', margin: '4px 0 0' }}>Ар бир сабак боюнча натыйжаларды көрүңүз</p>
        </div>

        {/* Student selector */}
        {students.length > 1 && (
          <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
            {students.map(s => (
              <button key={s.id} onClick={() => selectStudent(s)}
style={{ padding: '8px 18px', borderRadius: '10px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', background: activeStudent?.id === s.id ? '#1B4FD8' : '#fff', color: activeStudent?.id === s.id ? '#fff' : '#64748B', border: activeStudent?.id === s.id ? 'none' : '1px solid #E2E8F0' } as any}>                {s.full_name}
              </button>
            ))}
          </div>
        )}

        {students.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: '20px', border: '1px solid #E2E8F0', padding: '48px', textAlign: 'center' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>👨‍👩‍👧</div>
            <div style={{ fontWeight: '700', color: '#0D1E4A' }}>Бала байланышпаган</div>
            <div style={{ color: '#94A3B8', fontSize: '13px', marginTop: '4px' }}>Администратор баланы байланыштырышы керек</div>
          </div>
        ) : activeStudent && (
          <div>
            {/* Student info + stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '16px', marginBottom: '24px' }}>
              <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '20px', textAlign: 'center' }}>
                <div style={{ fontWeight: '900', fontSize: '28px', color: '#1B4FD8' }}>{passedCount}</div>
                <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '4px' }}>Сабак өттү</div>
                <div style={{ fontSize: '11px', color: '#CBD5E1', marginTop: '2px' }}>/ {lessons.length} жалпы</div>
              </div>
              <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '20px', textAlign: 'center' }}>
                <div style={{ fontWeight: '900', fontSize: '28px', color: avgScore >= 95 ? '#10B981' : avgScore >= 70 ? '#F59E0B' : '#EF4444' }}>{avgScore}%</div>
                <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '4px' }}>Орточо натыйжа</div>
              </div>
              <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '20px', textAlign: 'center' }}>
                <div style={{ fontWeight: '900', fontSize: '28px', color: '#1B4FD8' }}>{results.length}</div>
                <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '4px' }}>Жалпы аракет</div>
              </div>
            </div>

            {/* Progress bar */}
            <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '20px', marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ fontWeight: '700', fontSize: '14px', color: '#0D1E4A' }}>Курс прогрессу — {activeStudent.full_name}</span>
                <span style={{ fontWeight: '700', fontSize: '14px', color: '#1B4FD8' }}>{passedCount}/{lessons.length}</span>
              </div>
              <div style={{ background: '#E8ECF4', borderRadius: '999px', height: '10px', overflow: 'hidden' }}>
                <div style={{ width: lessons.length > 0 ? `${(passedCount / lessons.length) * 100}%` : '0%', height: '100%', background: '#1B4FD8', borderRadius: '999px', transition: 'width 0.6s ease' }} />
              </div>
            </div>

            {/* Lessons list */}
            <div style={{ background: '#fff', borderRadius: '20px', border: '1px solid #E2E8F0', padding: '24px', marginBottom: '24px' }}>
              <h3 style={{ fontWeight: '800', fontSize: '16px', color: '#0D1E4A', marginBottom: '16px' }}>Сабактар боюнча прогресс</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {lessons.map((l, i) => {
                  const best = getBestResult(l.id)
                  const pct = best ? Math.round((best.score / best.total) * 100) : null
                  const attempts = results.filter(r => r.lesson_id === l.id).length
                  return (
                    <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '12px 16px', background: '#F8FAFF', borderRadius: '12px', border: `1px solid ${best?.passed ? '#BBF7D0' : '#E2E8F0'}` }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: best?.passed ? '#F0FDF4' : '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900', fontSize: '13px', color: best?.passed ? '#10B981' : '#1B4FD8', flexShrink: 0 }}>
                        {best?.passed ? '✓' : i + 1}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: '600', fontSize: '14px', color: '#0D1E4A' }}>{l.title}</div>
                        <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>
                          {attempts > 0 ? `${attempts} аракет` : 'Баштаган жок'}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        {pct !== null ? (
                          <>
                            <div style={{ fontWeight: '800', fontSize: '16px', color: best?.passed ? '#10B981' : '#F59E0B' }}>{pct}%</div>
                            <div style={{ fontSize: '10px', color: best?.passed ? '#10B981' : '#F59E0B', fontWeight: '700' }}>{best?.passed ? 'Өттү ✓' : 'Өтпөдү'}</div>
                          </>
                        ) : (
                          <div style={{ fontSize: '12px', color: '#CBD5E1' }}>—</div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Recent results */}
            <div style={{ background: '#fff', borderRadius: '20px', border: '1px solid #E2E8F0', padding: '24px' }}>
              <h3 style={{ fontWeight: '800', fontSize: '16px', color: '#0D1E4A', marginBottom: '16px' }}>Акыркы натыйжалар</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {results.slice(0, 10).map(r => (
                  <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#F8FAFF', borderRadius: '10px', border: `1px solid ${r.passed ? '#BBF7D0' : '#E2E8F0'}` }}>
                    <div>
                      <div style={{ fontWeight: '600', fontSize: '14px', color: '#0D1E4A' }}>{r.math_lessons?.title}</div>
                      <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>{new Date(r.created_at).toLocaleDateString('ru', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: '800', fontSize: '16px', color: r.passed ? '#10B981' : '#EF4444' }}>{Math.round((r.score / r.total) * 100)}%</div>
                      <div style={{ fontSize: '10px', color: r.passed ? '#10B981' : '#EF4444', fontWeight: '700' }}>{r.passed ? '✓ Өттү' : '✗ Өтпөдү'}</div>
                    </div>
                  </div>
                ))}
                {results.length === 0 && <div style={{ color: '#94A3B8', fontSize: '14px', textAlign: 'center', padding: '32px' }}>Натыйжа жок</div>}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}