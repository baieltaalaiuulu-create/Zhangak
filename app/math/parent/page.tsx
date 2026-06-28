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
  const pct = lessons.length > 0 ? Math.round((passedCount / lessons.length) * 100) : 0

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8FAFF', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ color: '#64748B', fontSize: '14px' }}>Жүктөлүүдө...</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFF', fontFamily: 'Inter, -apple-system, sans-serif' }}>
      <style>{`
        *{box-sizing:border-box}
        @media(max-width:640px){
          .nav-inner{padding:0 14px!important;height:54px!important}
          .nav-name{display:none!important}
          .page-pad{padding:16px 14px!important}
          .page-title{font-size:19px!important}
          .stats-grid{grid-template-columns:1fr 1fr!important;gap:10px!important}
          .stat-val{font-size:24px!important}
          .stat-third{grid-column:span 2!important}
          .lesson-item{padding:11px 13px!important;gap:10px!important}
          .lesson-num{width:32px!important;height:32px!important;font-size:12px!important;border-radius:8px!important}
          .lesson-title{font-size:13px!important}
          .lesson-meta{font-size:10px!important}
          .lesson-pct{font-size:15px!important}
          .result-item{padding:11px 13px!important}
          .result-title{font-size:13px!important}
          .result-date{font-size:10px!important}
          .result-pct{font-size:15px!important}
          .student-btn{padding:7px 14px!important;font-size:12px!important}
          .section-card{padding:18px 16px!important;border-radius:16px!important}
        }
      `}</style>

      {/* NAVBAR */}
      <nav style={{ background: '#fff', borderBottom: '1px solid #E2E8F0', position: 'sticky', top: 0, zIndex: 100 }}>
        <div className="nav-inner" style={{ maxWidth: '1000px', margin: '0 auto', padding: '0 24px', height: '58px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '30px', height: '30px', background: '#1B4FD8', borderRadius: '7px', overflow: 'hidden', flexShrink: 0 }}>
              <img src="/images/logo.png" alt="Z" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <span style={{ fontWeight: '900', fontSize: '15px', color: '#0D1E4A' }}>Zhangak</span>
            <span style={{ fontWeight: '800', fontSize: '10px', color: '#1B4FD8', background: '#EEF2FF', padding: '2px 7px', borderRadius: '5px' }}>Math</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="nav-name" style={{ fontSize: '13px', color: '#64748B' }}>{profile?.full_name}</span>
            <button onClick={handleLogout} style={{ background: 'none', border: '1px solid #E2E8F0', borderRadius: '7px', padding: '5px 11px', fontSize: '12px', color: '#64748B', cursor: 'pointer' }}>Чыгуу</button>
          </div>
        </div>
      </nav>

      <div className="page-pad" style={{ maxWidth: '1000px', margin: '0 auto', padding: '24px 20px' }}>

        {/* Header */}
        <div style={{ marginBottom: '20px' }}>
          <h1 className="page-title" style={{ fontSize: '22px', fontWeight: '900', color: '#0D1E4A', margin: 0 }}>
            Балаңыздын прогрессу 👨‍👩‍👧
          </h1>
          <p style={{ color: '#64748B', fontSize: '13px', margin: '4px 0 0' }}>Ар бир сабак боюнча натыйжаларды көрүңүз</p>
        </div>

        {/* Student selector */}
        {students.length > 1 && (
          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
            {students.map(s => (
              <button key={s.id} className="student-btn" onClick={() => selectStudent(s)}
                style={{ padding: '8px 16px', borderRadius: '10px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', border: 'none', background: activeStudent?.id === s.id ? '#1B4FD8' : '#fff', color: activeStudent?.id === s.id ? '#fff' : '#64748B', boxShadow: activeStudent?.id === s.id ? '0 4px 12px rgba(27,79,216,0.25)' : '0 0 0 1px #E2E8F0' }}>
                {s.full_name.split(' ')[0]}
              </button>
            ))}
          </div>
        )}

        {students.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: '20px', border: '1px solid #E2E8F0', padding: '48px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>👨‍👩‍👧</div>
            <div style={{ fontWeight: '700', color: '#0D1E4A', fontSize: '15px' }}>Бала байланышпаган</div>
            <div style={{ color: '#94A3B8', fontSize: '13px', marginTop: '4px' }}>Администратор баланы байланыштырышы керек</div>
          </div>
        ) : activeStudent && (
          <div>
            {/* Stats */}
            <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '14px', marginBottom: '20px' }}>
              <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #E2E8F0', padding: '18px', textAlign: 'center' }}>
                <div className="stat-val" style={{ fontWeight: '900', fontSize: '28px', color: '#1B4FD8' }}>{passedCount}</div>
                <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '3px' }}>Сабак өттү</div>
                <div style={{ fontSize: '10px', color: '#CBD5E1', marginTop: '1px' }}>/ {lessons.length} жалпы</div>
              </div>
              <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #E2E8F0', padding: '18px', textAlign: 'center' }}>
                <div className="stat-val" style={{ fontWeight: '900', fontSize: '28px', color: avgScore >= 95 ? '#10B981' : avgScore >= 70 ? '#F59E0B' : '#EF4444' }}>{avgScore}%</div>
                <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '3px' }}>Орточо балл</div>
              </div>
              <div className="stat-third" style={{ background: '#fff', borderRadius: '14px', border: '1px solid #E2E8F0', padding: '18px', textAlign: 'center' }}>
                <div className="stat-val" style={{ fontWeight: '900', fontSize: '28px', color: '#1B4FD8' }}>{results.length}</div>
                <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '3px' }}>Жалпы аракет</div>
              </div>
            </div>

            {/* Progress bar */}
            <div className="section-card" style={{ background: '#fff', borderRadius: '18px', border: '1px solid #E2E8F0', padding: '18px 20px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div>
                  <span style={{ fontWeight: '700', fontSize: '14px', color: '#0D1E4A' }}>{activeStudent.full_name}</span>
                  <span style={{ fontSize: '12px', color: '#94A3B8', marginLeft: '8px' }}>{activeStudent.class_number}-класс</span>
                </div>
                <span style={{ fontWeight: '800', fontSize: '14px', color: '#1B4FD8' }}>{passedCount}/{lessons.length}</span>
              </div>
              <div style={{ background: '#E8ECF4', borderRadius: '999px', height: '9px', overflow: 'hidden', marginBottom: '6px' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: '#1B4FD8', borderRadius: '999px', transition: 'width 0.6s ease' }} />
              </div>
              <div style={{ fontSize: '12px', color: '#94A3B8', textAlign: 'right' }}>{pct}% аяктады</div>
            </div>

            {/* Lessons */}
            <div className="section-card" style={{ background: '#fff', borderRadius: '18px', border: '1px solid #E2E8F0', padding: '20px', marginBottom: '16px' }}>
              <h3 style={{ fontWeight: '800', fontSize: '15px', color: '#0D1E4A', margin: '0 0 14px' }}>Сабактар боюнча прогресс</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {lessons.map((l, i) => {
                  const best = getBestResult(l.id)
                  const lpct = best ? Math.round((best.score / best.total) * 100) : null
                  const attempts = results.filter(r => r.lesson_id === l.id).length
                  return (
                    <div key={l.id} className="lesson-item" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', background: '#F8FAFF', borderRadius: '12px', border: `1px solid ${best?.passed ? '#BBF7D0' : '#E2E8F0'}` }}>
                      <div className="lesson-num" style={{ width: '34px', height: '34px', borderRadius: '9px', background: best?.passed ? '#F0FDF4' : '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900', fontSize: '13px', color: best?.passed ? '#10B981' : '#1B4FD8', flexShrink: 0 }}>
                        {best?.passed ? '✓' : i + 1}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="lesson-title" style={{ fontWeight: '600', fontSize: '14px', color: '#0D1E4A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.title}</div>
                        <div className="lesson-meta" style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>
                          {attempts > 0 ? `${attempts} аракет` : 'Баштаган жок'}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        {lpct !== null ? (
                          <>
                            <div className="lesson-pct" style={{ fontWeight: '800', fontSize: '16px', color: best?.passed ? '#10B981' : '#F59E0B' }}>{lpct}%</div>
                            <div style={{ fontSize: '10px', color: best?.passed ? '#10B981' : '#F59E0B', fontWeight: '700' }}>{best?.passed ? 'Өттү ✓' : 'Өтпөдү'}</div>
                          </>
                        ) : (
                          <div style={{ fontSize: '12px', color: '#CBD5E1' }}>—</div>
                        )}
                      </div>
                    </div>
                  )
                })}
                {lessons.length === 0 && (
                  <div style={{ padding: '28px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>Сабак жок</div>
                )}
              </div>
            </div>

            {/* Recent results */}
            <div className="section-card" style={{ background: '#fff', borderRadius: '18px', border: '1px solid #E2E8F0', padding: '20px' }}>
              <h3 style={{ fontWeight: '800', fontSize: '15px', color: '#0D1E4A', margin: '0 0 14px' }}>Акыркы натыйжалар</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {results.slice(0, 10).map(r => (
                  <div key={r.id} className="result-item" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: '#F8FAFF', borderRadius: '11px', border: `1px solid ${r.passed ? '#BBF7D0' : '#E2E8F0'}`, gap: '12px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="result-title" style={{ fontWeight: '600', fontSize: '14px', color: '#0D1E4A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.math_lessons?.title}</div>
                      <div className="result-date" style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>
                        {new Date(r.created_at).toLocaleDateString('ru', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div className="result-pct" style={{ fontWeight: '800', fontSize: '16px', color: r.passed ? '#10B981' : '#EF4444' }}>{Math.round((r.score / r.total) * 100)}%</div>
                      <div style={{ fontSize: '10px', color: r.passed ? '#10B981' : '#EF4444', fontWeight: '700' }}>{r.passed ? '✓ Өттү' : '✗ Өтпөдү'}</div>
                    </div>
                  </div>
                ))}
                {results.length === 0 && (
                  <div style={{ padding: '28px', textAlign: 'center', color: '#94A3B8', fontSize: '14px' }}>Натыйжа жок</div>
                )}
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  )
}