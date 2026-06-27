'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

// ─── Hooks ────────────────────────────────────────────────────────────────────
function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setInView(true) }, { threshold })
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [threshold])
  return [ref, inView] as const
}

function useCounter(target: number, duration = 1800, active = false) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (!active) return
    const start = performance.now()
    const frame = (now: number) => {
      const p = Math.min((now - start) / duration, 1)
      const ease = 1 - Math.pow(1 - p, 3)
      setVal(Math.round(ease * target))
      if (p < 1) requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
  }, [active, target, duration])
  return val
}

// ─── Animated wrapper ─────────────────────────────────────────────────────────
function Reveal({ children, delay = 0, y = 40 }: { children: React.ReactNode; delay?: number; y?: number }) {
  const [ref, inView] = useInView()
  return (
    <div ref={ref} style={{
      opacity: inView ? 1 : 0,
      transform: inView ? 'translateY(0) scale(1)' : `translateY(${y}px) scale(0.97)`,
      transition: `opacity 0.7s cubic-bezier(.22,1,.36,1) ${delay}ms, transform 0.7s cubic-bezier(.22,1,.36,1) ${delay}ms`,
    }}>
      {children}
    </div>
  )
}

// ─── Floating particles background ────────────────────────────────────────────
function Particles() {
  const particles = Array.from({ length: 18 }, (_, i) => ({
    id: i,
    size: 4 + Math.random() * 8,
    x: Math.random() * 100,
    delay: Math.random() * 6,
    duration: 8 + Math.random() * 8,
    opacity: 0.12 + Math.random() * 0.18,
  }))
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      <style>{`
        @keyframes floatUp {
          0% { transform: translateY(100vh) rotate(0deg); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(-20vh) rotate(360deg); opacity: 0; }
        }
        @keyframes pulseGlow {
          0%, 100% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.08); opacity: 1; }
        }
        @keyframes slideInLeft {
          from { opacity: 0; transform: translateX(-60px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(60px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes bounceIn {
          0% { transform: scale(0.3); opacity: 0; }
          50% { transform: scale(1.05); }
          70% { transform: scale(0.95); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes countUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes gradientShift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        @keyframes wobble {
          0%, 100% { transform: rotate(-2deg); }
          50% { transform: rotate(2deg); }
        }
        .course-card:hover {
          transform: translateY(-8px) scale(1.02) !important;
          box-shadow: 0 24px 60px rgba(0,0,0,0.25) !important;
        }
        .stat-card:hover {
          transform: translateY(-4px) scale(1.03) !important;
        }
        .cta-btn:hover {
          transform: scale(1.04) !important;
          filter: brightness(1.1) !important;
        }
        .review-card:hover {
          transform: translateY(-6px) !important;
          border-color: rgba(27,79,216,0.5) !important;
        }
        .nav-link:hover { color: #fff !important; }
        @media (max-width: 768px) {
          .hero-grid { flex-direction: column !important; }
          .hero-images { display: none !important; }
          .courses-grid { grid-template-columns: 1fr !important; }
          .reviews-grid { grid-template-columns: 1fr !important; }
          .pains-grid { grid-template-columns: 1fr 1fr !important; }
          .stats-row { grid-template-columns: 1fr 1fr !important; }
          .nav-links { display: none !important; }
          .section-pad { padding-left: 20px !important; padding-right: 20px !important; }
          .hero-title { font-size: 38px !important; }
          .timer-grid { gap: 8px !important; }
          .timer-box { padding: 12px 16px !important; min-width: 68px !important; }
          .timer-num { font-size: 28px !important; }
        }
      `}</style>
      {particles.map(p => (
        <div key={p.id} style={{
          position: 'absolute', bottom: '-20px', left: `${p.x}%`,
          width: p.size, height: p.size,
          background: p.id % 3 === 0 ? '#1B4FD8' : p.id % 3 === 1 ? '#2563EB' : '#F59E0B',
          borderRadius: '50%', opacity: p.opacity,
          animation: `floatUp ${p.duration}s ${p.delay}s infinite linear`,
        }} />
      ))}
    </div>
  )
}

// ─── Stat counter card ────────────────────────────────────────────────────────
function StatCard({ value, suffix = '', label, color, delay }: {
  value: number; suffix?: string; label: string; color: string; delay: number
}) {
  const [ref, inView] = useInView()
  const count = useCounter(value, 1800, inView)
  return (
    <div ref={ref} className="stat-card" style={{
      background: '#FFFFFF', border: '1px solid #E2E8F0',
      borderRadius: '20px', padding: '24px 20px', textAlign: 'center',
      transition: 'all 0.3s cubic-bezier(.22,1,.36,1)',
      opacity: inView ? 1 : 0,
      transform: inView ? 'translateY(0)' : 'translateY(30px)',
      transitionDelay: `${delay}ms`,
    }}>
      <div style={{
        fontWeight: '900', fontSize: '36px', letterSpacing: '-1.5px',
        color, fontVariantNumeric: 'tabular-nums',
        textShadow: `0 0 30px ${color}60`,
        animation: inView ? `countUp 0.5s ${delay + 200}ms both` : 'none',
      }}>{count}{suffix}</div>
      <div style={{ color: '#64748B', fontSize: '12px', marginTop: '6px', fontWeight: '500' }}>{label}</div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const [showLogin, setShowLogin] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [timeLeft, setTimeLeft] = useState({ months: 0, hours: 0, minutes: 0, seconds: 0 })
  const [scrollY, setScrollY] = useState(0)
  const router = useRouter()

  useEffect(() => {
    const target = new Date('2027-05-17T09:00:00')
    const tick = () => {
      const diff = target.getTime() - Date.now()
      if (diff <= 0) return
      setTimeLeft({
        months: Math.floor(diff / (1000 * 60 * 60 * 24 * 30)),
        hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000),
      })
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError('')
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError('Туура эмес email же сырсөз'); setLoading(false); return }
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).single()
    const role = profile?.role
    if (role === 'admin') router.push('/admin')
    else if (role === 'teacher') router.push('/teacher')
    else if (role === 'manager') router.push('/manager')
    else if (role === 'director') router.push('/director')
    else if (role === 'finance') router.push('/finance')
    else router.push('/student')
  }

  const wa = 'https://wa.me/996502077326'
  const navScrolled = scrollY > 40

  const results = [
    { img: '/images/result4.png', name: 'Уланбекова Каныкей', score: 221 },
    { img: '/images/result3.png', name: 'Тилекова Акмарал', score: 211 },
    { img: '/images/result1.png', name: 'Шарифжанов Мухаммадзаир', score: 204 },
    { img: '/images/result2.png', name: 'Журсунова Нурзат', score: 202 },
  ]

  const reviews = [
    { name: 'Айбек С.', score: 180, before: 110, text: 'Математиканы такыр түшүнбөй 110 алчумун. 3 айда 180 балл алдым.', emoji: '🎯' },
    { name: 'Нурайым К.', score: 195, before: 140, text: 'Аналогияларды конкреттүү стратегиялар менен үйрөндүм. 195 балл!', emoji: '⭐' },
    { name: 'Тимур А.', score: 188, before: 125, text: 'KAHOOT жана оюндар менен убакыт тез өтөт. 188ге жеттим.', emoji: '🚀' },
    { name: 'Зарина М.', score: 204, before: 155, text: 'Геометрия боюнча толук түшүндүрдү. Натыйжам — 204 балл!', emoji: '💪' },
    { name: 'Бекзат Р.', score: 176, before: 108, text: 'B1дан баштап акырындап өстүм. 176 менен медицинага кирдим.', emoji: '🏆' },
    { name: 'Айгерим Т.', score: 192, before: 148, text: 'Онлайн тесттер үйдө да машыгууга жардам берди. 192 балл!', emoji: '✨' },
  ]

  const faqs = [
    { q: 'Кайсы предметтер курска кирет?', a: 'Математика, Аналогиялар, Текст түшүнүү, Кыргыз тили грамматикасы — ЖРТнын бардык 4 бөлүмү.' },
    { q: 'Жангактын жетишкендиктери кандай?', a: '9000+ окуучу 190 балдан ашык алды. Эң жогорку натыйжа — 221 балл. Окуучулардын 80%ы максаттуу университетке кирди.' },
    { q: 'Кайсы класстын окуучулары жазыла алат?', a: '10 жана 11-класстын окуучулары. ЖРТга кайра даярданып жаткандар да жазыла алат.' },
    { q: 'Курс канча турат?', a: 'B1 — 6 300 сом/ай, B2 — 6 300 сом/ай, C1 — 6 300 сом/ай. Жайкы интенсив — 7 000 сом.' },
    { q: 'Курс онлайн же оффлайн?', a: 'Оффлайн — Бишкек, Горький көчөсү 108. Онлайн платформа жакында ишке киргизилет.' },
    { q: 'Бир сабак канча убакыт?', a: '3 саат: Математика 50 мин + Кыргыз тили 50 мин + Чтение 50 мин + 20 мин оюн убактысы.' },
  ]

  const courses = [
    {
      level: 'B1', name: 'Базовый', month: '1-ай', price: '6 300',
      color: '#1B4FD8', glow: 'rgba(96,165,250,0.25)',
      topics: ['Арифметика', 'Лексика жана морфология', 'Базалык аналогиялар', 'Чтение негиздери'],
      badge: 'Башталгычтар үчүн',
    },
    {
      level: 'B2', name: 'Продвинутый', month: '2-ай', price: '6 300',
      color: '#1B4FD8', glow: 'rgba(27,79,216,0.4)',
      topics: ['Алгебра', 'Синтаксис жана аналогия', 'Функциялар', 'Окуу жана түшүнүү'],
      badge: 'Эң популярдуу',
      featured: true,
    },
    {
      level: 'C1', name: 'Финальный', month: '3-ай', price: '6 300',
      color: '#F59E0B', glow: 'rgba(245,158,11,0.3)',
      topics: ['Геометрия', 'Грамматика жана чтение', 'Татаал аналогиялар', 'Толук ЖРТ форматы'],
      badge: 'Максималдуу натыйжа',
    },
  ]

  return (
    <div style={{ background: '#FFFFFF', minHeight: '100vh', fontFamily: 'Inter, -apple-system, sans-serif', color: '#0D1E4A', overflowX: 'hidden' }}>

      {/* ── ANNOUNCEMENT BANNER ──────────────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(90deg, #1B4FD8, #1E63E8, #3B82F6, #1B4FD8)',
        backgroundSize: '300% 100%',
        animation: 'gradientShift 4s ease infinite',
        padding: '10px 20px', textAlign: 'center', fontSize: '13px', fontWeight: '700',
      }}>
        🔥 ЖАЙКЫ ЖРТ ИНТЕНСИВИ — 1-июлдан · 7 000 сом · Белек: Алматыга саякат ✈️
        <a href={wa} target="_blank" rel="noopener noreferrer"
          style={{ color: '#0D1E4A', marginLeft: '14px', textDecoration: 'none', background: 'rgba(255,255,255,0.2)', padding: '3px 12px', borderRadius: '20px', fontWeight: '800' }}>
          Жазылуу →
        </a>
      </div>

      {/* ── NAVBAR ───────────────────────────────────────────────────────────── */}
      <nav className="section-pad" style={{
        background: navScrolled ? 'rgba(255,255,255,0.97)' : 'linear-gradient(180deg, rgba(27,79,216,0.08) 0%, transparent 100%)',
        backdropFilter: navScrolled ? 'blur(20px)' : 'none',
        borderBottom: navScrolled ? '1px solid rgba(255,255,255,0.07)' : 'none',
        padding: '0 60px', height: '68px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 200,
        transition: 'all 0.3s ease',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <img src="/images/logo.png" alt="Zhangak" style={{ width: '36px', height: '36px', objectFit: 'cover', borderRadius: '8px' }} />
          <span style={{ fontWeight: '900', fontSize: '20px', letterSpacing: '-0.5px', background: 'linear-gradient(135deg,#fff,rgba(255,255,255,0.7))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Zhangak
          </span>
        </div>
        <div className="nav-links" style={{ display: 'flex', gap: '28px' }}>
          {[['Курстар', '#courses'], ['Натыйжалар', '#results'], ['FAQ', '#faq'], ['Офис', '#office']].map(([l, h]) => (
            <a key={l} href={h} className="nav-link" style={{ color: '#64748B', fontSize: '14px', textDecoration: 'none', fontWeight: '500', transition: 'color 0.2s' }}>{l}</a>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => setShowLogin(true)}
            style={{ background: '#F1F5FF', color: '#0D1E4A', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '9px 18px', fontWeight: '600', fontSize: '13px', cursor: 'pointer', transition: 'all 0.2s' }}>
            Кирүү
          </button>
          <a href={wa} target="_blank" rel="noopener noreferrer" className="cta-btn"
            style={{ background: 'linear-gradient(135deg,#1B4FD8,#1E63E8)', color: '#0D1E4A', borderRadius: '10px', padding: '9px 18px', fontWeight: '800', fontSize: '13px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.25s', boxShadow: '0 4px 20px rgba(27,79,216,0.4)' }}>
            📲 Жазылуу
          </a>
        </div>
      </nav>

      {/* ── HERO ─────────────────────────────────────────────────────────────── */}
      <div style={{ position: 'relative', overflow: 'hidden', minHeight: '100vh', display: 'flex', alignItems: 'center' }}>
        <Particles />
        {/* Glow orbs */}
        <div style={{ position: 'absolute', top: '10%', left: '5%', width: '500px', height: '500px', background: 'radial-gradient(circle,rgba(27,79,216,0.15) 0%,transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '10%', right: '5%', width: '400px', height: '400px', background: 'radial-gradient(circle,rgba(27,79,216,0.08) 0%,transparent 70%)', pointerEvents: 'none' }} />

        <div className="section-pad hero-grid" style={{ padding: '80px 60px', maxWidth: '1200px', margin: '0 auto', width: '100%', display: 'flex', alignItems: 'center', gap: '60px', position: 'relative', zIndex: 1 }}>
          {/* LEFT */}
          <div style={{ flex: 1 }}>
            <div style={{ animation: 'slideInLeft 0.8s cubic-bezier(.22,1,.36,1) both' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(27,79,216,0.2)', border: '1px solid rgba(27,79,216,0.4)', borderRadius: '20px', padding: '8px 16px', marginBottom: '28px' }}>
                <span style={{ fontSize: '14px' }}>🏆</span>
                <span style={{ color: '#1B4FD8', fontSize: '13px', fontWeight: '700' }}>9000+ Ийгиликтүү бүтүрүүчү</span>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#2563EB', animation: 'pulseGlow 2s ease infinite' }} />
              </div>
            </div>

            <div style={{ animation: 'slideInLeft 0.8s 0.1s cubic-bezier(.22,1,.36,1) both' }}>
              <h1 className="hero-title" style={{
                fontSize: 'clamp(40px,5.5vw,68px)', fontWeight: '900', lineHeight: '1.02',
                marginBottom: '24px', letterSpacing: '-2.5px',
              }}>
                ЖРТдан{' '}
                <span style={{
                  background: 'linear-gradient(135deg,#1B4FD8,#1E63E8,#3B82F6)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                  backgroundSize: '200% 200%', animation: 'gradientShift 3s ease infinite',
                }}>
                  жогорку балл
                </span>
                {' '}—{'\n'}сенин{'\n'}келечегиңдин{'\n'}
                <span style={{ color: '#2563EB' }}>ачкычы.</span>
              </h1>
            </div>

            <div style={{ animation: 'slideInLeft 0.8s 0.2s cubic-bezier(.22,1,.36,1) both' }}>
              <p style={{ color: '#64748B', fontSize: '16px', lineHeight: '1.8', marginBottom: '36px', maxWidth: '460px' }}>
                Жангак 10-11-класстын окуучуларын ЖРТга инновациялык методика менен даярдайт.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', animation: 'slideInLeft 0.8s 0.3s cubic-bezier(.22,1,.36,1) both' }}>
              <a href={wa} target="_blank" rel="noopener noreferrer" className="cta-btn"
                style={{ background: 'linear-gradient(135deg,#1B4FD8,#1E63E8)', color: '#0D1E4A', borderRadius: '14px', padding: '15px 32px', fontWeight: '900', fontSize: '15px', textDecoration: 'none', display: 'inline-block', boxShadow: '0 8px 32px rgba(27,79,216,0.45)', transition: 'all 0.25s' }}>
                📲 Жазылуу
              </a>
              <button onClick={() => setShowLogin(true)} className="cta-btn"
                style={{ background: '#F1F5FF', color: '#0D1E4A', border: '1px solid #CBD5E1', borderRadius: '14px', padding: '15px 32px', fontWeight: '700', fontSize: '15px', cursor: 'pointer', transition: 'all 0.25s' }}>
                Кирүү →
              </button>
            </div>

            {/* Stats */}
            <div style={{ display: 'flex', gap: '36px', marginTop: '44px', paddingTop: '36px', borderTop: '1px solid #E2E8F0', flexWrap: 'wrap', animation: 'slideInLeft 0.8s 0.4s cubic-bezier(.22,1,.36,1) both' }}>
              {[{ n: '9000+', l: 'Ийгиликтүү бүтүрүүчү', c: '#93C5FD' }, { n: '221', l: 'Эң жогорку', c: '#93C5FD' }, { n: '3', l: 'Деңгээл', c: '#F59E0B' }].map(s => (
                <div key={s.l}>
                  <div style={{ fontWeight: '900', fontSize: '26px', color: s.c, letterSpacing: '-1px' }}>{s.n}</div>
                  <div style={{ color: '#94A3B8', fontSize: '11px', marginTop: '4px' }}>{s.l}</div>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT — result photos */}
          <div className="hero-images" style={{ flex: '0 0 440px', animation: 'slideInRight 0.8s 0.2s cubic-bezier(.22,1,.36,1) both' }}>
            <div style={{
  display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px',
  background: 'linear-gradient(135deg, #1B4FD8 0%, #3B82F6 50%, #1B4FD8 100%)',
  borderRadius: '28px', padding: '16px',
  boxShadow: '0 20px 60px rgba(27,79,216,0.3)',
}}>              {results.map((r, i) => (
                <div key={i} style={{
                  position: 'relative', borderRadius: '20px', overflow: 'hidden',
                  aspectRatio: '3/4', border: '1px solid #E2E8F0',
                  transform: i % 2 === 0 ? 'translateY(-8px)' : 'translateY(8px)',
                  transition: 'transform 0.3s ease',
                }}>
                  <img src={r.img} alt={r.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top,rgba(8,12,26,0.97) 0%,transparent 55%)' }} />
                  <div style={{ position: 'absolute', bottom: '12px', left: '12px', right: '12px' }}>
                    <div style={{ fontWeight: '900', fontSize: '18px', color: '#1B4FD8', letterSpacing: '-0.5px' }}>{r.score}</div>
                    <div style={{ fontSize: '10px', color: '#475569', marginTop: '2px' }}>{r.name}</div>
                  </div>
                  {/* score badge */}
                  <div style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(99,102,241,0.9)', backdropFilter: 'blur(8px)', borderRadius: '8px', padding: '4px 10px', fontSize: '11px', fontWeight: '800' }}>
                    балл
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── SUMMER INTENSIVE ─────────────────────────────────────────────────── */}
      <div className="section-pad" style={{ padding: '0 60px 60px', background: '#EEF4FF' }}>
        <Reveal>
          <div style={{
            maxWidth: '1200px', margin: '0 auto',
            background: 'linear-gradient(135deg,rgba(245,158,11,0.15),rgba(239,68,68,0.1))',
            border: '1px solid rgba(245,158,11,0.3)', borderRadius: '28px', padding: '36px 44px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '28px', flexWrap: 'wrap',
            position: 'relative', overflow: 'hidden',
          }}>
            <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: '200px', height: '200px', background: 'radial-gradient(circle,rgba(245,158,11,0.15) 0%,transparent 70%)', pointerEvents: 'none' }} />
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(245,158,11,0.2)', border: '1px solid rgba(245,158,11,0.4)', borderRadius: '20px', padding: '6px 14px', marginBottom: '16px' }}>
                <span style={{ color: '#FCD34D', fontSize: '13px', fontWeight: '700', animation: 'wobble 2s ease infinite' }}>🔥</span>
                <span style={{ color: '#FCD34D', fontSize: '13px', fontWeight: '700' }}>ЖАЙКЫ ИНТЕНСИВ 2026</span>
              </div>
              <h3 style={{ fontSize: 'clamp(18px,2.5vw,26px)', fontWeight: '900', marginBottom: '16px', lineHeight: '1.25' }}>
                1 айда ЖРТга даярдан жана<br />
                <span style={{ color: '#FCD34D' }}>Алматыга 1 күндүк саякатка бар! ✈️</span>
              </h3>
              <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                {[['📅', '1-июлдан'], ['🕙', '10:00–12:50'], ['📍', 'Горький 108'], ['💰', '7 000 сом']].map(([icon, text]) => (
                  <div key={text} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#334155', background: 'rgba(255,255,255,0.06)', borderRadius: '10px', padding: '6px 12px' }}>
                    <span>{icon}</span><span>{text}</span>
                  </div>
                ))}
              </div>
            </div>
            <a href={wa} target="_blank" rel="noopener noreferrer" className="cta-btn"
              style={{ background: 'linear-gradient(135deg,#F59E0B,#EF4444)', color: '#0D1E4A', borderRadius: '16px', padding: '18px 36px', fontWeight: '900', fontSize: '16px', textDecoration: 'none', textAlign: 'center', flexShrink: 0, boxShadow: '0 8px 32px rgba(245,158,11,0.4)', transition: 'all 0.25s', whiteSpace: 'nowrap' }}>
              📲 Азыр жазылуу<br />
              <span style={{ fontSize: '11px', opacity: 0.85, fontWeight: '600' }}>Орундар чектелүү!</span>
            </a>
          </div>
        </Reveal>
      </div>

      {/* ── STATS ROW ─────────────────────────────────────────────────────────── */}
      <div className="section-pad" style={{ padding: '0 60px 80px', background: '#F5F8FF' }}>
        <div className="stats-row" style={{ maxWidth: '1200px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '16px' }}>
          <StatCard value={220} suffix="+" label="Ийгиликтүү бүтүрүүчү" color="#93C5FD" delay={0} />
          <StatCard value={221} label="Эң жогорку балл" color="#93C5FD" delay={100} />
          <StatCard value={80} suffix="%" label="Университетке кирди" color="#FCD34D" delay={200} />
          <StatCard value={3} label="Курс деңгээли" color="#BFDBFE" delay={300} />
        </div>
      </div>

      {/* ── TIMER ─────────────────────────────────────────────────────────────── */}
      <div className="section-pad" style={{ padding: '60px 60px', background: '#E8F0FF', borderTop: 'none', borderBottom: 'none' }}>
        <Reveal>
          <div style={{ textAlign: 'center', maxWidth: '700px', margin: '0 auto' }}>
            <p style={{ color: '#94A3B8', fontSize: '12px', fontWeight: '700', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '20px' }}>ЖРТга чейин калды</p>
            <div className="timer-grid" style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap', alignItems: 'center' }}>
              {[
                { n: timeLeft.months, l: 'Ай' },
                { n: timeLeft.hours, l: 'Саат' },
                { n: timeLeft.minutes, l: 'Мүнөт' },
                { n: timeLeft.seconds, l: 'Секунд' },
              ].map((t, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div className="timer-box" style={{
                    background: '#EEF2FF', border: '1px solid #BFDBFE',
                    borderRadius: '16px', padding: '18px 28px', minWidth: '90px', textAlign: 'center',
                  }}>
                    <div className="timer-num" style={{ fontWeight: '900', fontSize: '42px', lineHeight: 1, fontVariantNumeric: 'tabular-nums', color: '#1B4FD8' }}>
                      {String(t.n).padStart(2, '0')}
                    </div>
                    <div style={{ color: '#94A3B8', fontSize: '11px', marginTop: '6px', fontWeight: '600' }}>{t.l}</div>
                  </div>
                  {i < 3 && <span style={{ fontSize: '28px', fontWeight: '900', color: '#CBD5E1' }}>:</span>}
                </div>
              ))}
            </div>
            <a href={wa} target="_blank" rel="noopener noreferrer" className="cta-btn"
              style={{ display: 'inline-block', marginTop: '32px', background: 'linear-gradient(135deg,#1B4FD8,#1E63E8)', color: '#0D1E4A', borderRadius: '14px', padding: '14px 36px', fontWeight: '900', fontSize: '15px', textDecoration: 'none', boxShadow: '0 8px 32px rgba(27,79,216,0.4)', transition: 'all 0.25s' }}>
              Азыр жазылуу →
            </a>
          </div>
        </Reveal>
      </div>

      {/* ── COURSES ───────────────────────────────────────────────────────────── */}
      <div id="courses" className="section-pad" style={{ padding: '100px 60px', background: '#F5F8FF' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <Reveal>
            <div style={{ textAlign: 'center', marginBottom: '64px' }}>
              <p style={{ color: '#94A3B8', fontSize: '12px', fontWeight: '700', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '16px' }}>Программа</p>
              <h2 style={{ fontSize: 'clamp(28px,4vw,44px)', fontWeight: '900', letterSpacing: '-1.5px', marginBottom: '12px' }}>
                3 деңгээл — башталгычтан{' '}
                <span style={{ color: '#1B4FD8' }}>финалга чейин</span>
              </h2>
              <p style={{ color: '#94A3B8', fontSize: '15px' }}>Каждый находит свой уровень и растёт</p>
            </div>
          </Reveal>

          <div className="courses-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '20px' }}>
            {courses.map((c, i) => (
              <Reveal key={c.level} delay={i * 120}>
                <div className="course-card" style={{
                  background: c.featured ? `linear-gradient(160deg,rgba(27,79,216,0.08),rgba(16,185,129,0.04))` : 'rgba(255,255,255,0.03)',
                  border: c.featured ? `2px solid rgba(16,185,129,0.5)` : '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '24px', overflow: 'hidden', height: '100%',
                  transition: 'all 0.35s cubic-bezier(.22,1,.36,1)',
                  position: 'relative',
                  boxShadow: c.featured ? `0 0 40px ${c.glow}` : 'none',
                }}>
                  {c.featured && (
                    <div style={{ position: 'absolute', top: '16px', right: '16px', background: c.color, color: '#0D1E4A', fontSize: '10px', fontWeight: '900', padding: '4px 12px', borderRadius: '20px', letterSpacing: '0.5px' }}>
                      ⭐ {c.badge}
                    </div>
                  )}
                  {/* Color bar */}
                  <div style={{ height: '4px', background: `linear-gradient(90deg,${c.color},transparent)` }} />
                  <div style={{ padding: '28px' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                      <span style={{ background: `${c.color}22`, color: c.color, borderRadius: '8px', padding: '4px 12px', fontSize: '12px', fontWeight: '900' }}>{c.level}</span>
                      <span style={{ color: '#94A3B8', fontSize: '12px' }}>{c.month}</span>
                    </div>
                    <div style={{ fontWeight: '900', fontSize: '22px', marginBottom: '20px', letterSpacing: '-0.5px' }}>{c.name}</div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '28px' }}>
                      {c.topics.map((t, j) => (
                        <div key={j} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ width: '20px', height: '20px', background: `${c.color}22`, borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: c.color }} />
                          </div>
                          <span style={{ fontSize: '13px', color: '#475569' }}>{t}</span>
                        </div>
                      ))}
                    </div>

                    <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontWeight: '900', fontSize: '22px', color: c.color }}>{c.price}</div>
                        <div style={{ fontSize: '11px', color: '#94A3B8' }}>сом / ай</div>
                      </div>
                      <a href={wa} target="_blank" rel="noopener noreferrer" className="cta-btn"
                        style={{ background: c.color, color: '#0D1E4A', borderRadius: '12px', padding: '11px 22px', fontSize: '13px', fontWeight: '800', textDecoration: 'none', transition: 'all 0.25s', boxShadow: `0 4px 20px ${c.glow}` }}>
                        Жазылуу
                      </a>
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>

      {/* ── RESULTS ───────────────────────────────────────────────────────────── */}
      <div id="results" className="section-pad" style={{ padding: '100px 60px', background: '#D6E4FF' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <Reveal>
            <div style={{ textAlign: 'center', marginBottom: '64px' }}>
              <p style={{ color: '#94A3B8', fontSize: '12px', fontWeight: '700', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '16px' }}>Далил</p>
              <h2 style={{ fontSize: 'clamp(28px,4vw,44px)', fontWeight: '900', letterSpacing: '-1.5px', marginBottom: '12px' }}>
                Реалдуу{' '}
                <span style={{ color: '#1B4FD8' }}>натыйжалар</span>
              </h2>
            </div>
          </Reveal>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '16px' }}>
            {results.map((r, i) => (
              <Reveal key={i} delay={i * 100}>
                <div style={{ position: 'relative', borderRadius: '20px', overflow: 'hidden', aspectRatio: '3/4', border: '1px solid #E2E8F0', cursor: 'pointer', transition: 'transform 0.3s ease' }}
                  onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.03)')}
                  onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}>
                  <img src={r.img} alt={r.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top,rgba(8,12,26,1) 0%,rgba(8,12,26,0.3) 60%,transparent 100%)' }} />
                  <div style={{ position: 'absolute', bottom: '14px', left: '14px', right: '14px' }}>
                    <div style={{ fontWeight: '900', fontSize: '22px', color: '#1B4FD8', letterSpacing: '-0.5px' }}>{r.score} балл</div>
                    <div style={{ color: '#334155', fontSize: '11px', marginTop: '3px', fontWeight: '500' }}>{r.name}</div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>

      {/* ── REVIEWS ───────────────────────────────────────────────────────────── */}
      <div className="section-pad" style={{ padding: '100px 60px', background: '#EEF4FF' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <Reveal>
            <div style={{ textAlign: 'center', marginBottom: '64px' }}>
              <p style={{ color: '#94A3B8', fontSize: '12px', fontWeight: '700', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '16px' }}>Пикирлер</p>
              <h2 style={{ fontSize: 'clamp(28px,4vw,44px)', fontWeight: '900', letterSpacing: '-1.5px' }}>
                Алар айтат — биз{' '}
                <span style={{ color: '#2563EB' }}>далилдейбиз</span>
              </h2>
            </div>
          </Reveal>
          <div className="reviews-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '20px' }}>
            {reviews.map((r, i) => (
              <Reveal key={i} delay={i * 80}>
                <div className="review-card" style={{
                  background: '#FFFFFF', border: '1px solid #E2E8F0',
                  borderRadius: '20px', padding: '24px', height: '100%',
                  transition: 'all 0.3s cubic-bezier(.22,1,.36,1)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '40px', height: '40px', background: 'linear-gradient(135deg,#1B4FD8,#1E63E8)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900', fontSize: '15px' }}>
                        {r.name[0]}
                      </div>
                      <div>
                        <div style={{ fontWeight: '700', fontSize: '14px' }}>{r.name}</div>
                        <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '1px' }}>
                          {r.before} → <span style={{ color: '#1B4FD8', fontWeight: '700' }}>{r.score} балл</span>
                        </div>
                      </div>
                    </div>
                    <span style={{ fontSize: '22px' }}>{r.emoji}</span>
                  </div>
                  <p style={{ color: '#475569', fontSize: '13px', lineHeight: '1.75', fontStyle: 'italic', margin: 0 }}>"{r.text}"</p>
                  <div style={{ marginTop: '14px', display: 'flex', gap: '2px' }}>
                    {'★★★★★'.split('').map((s, j) => <span key={j} style={{ color: '#FCD34D', fontSize: '13px' }}>{s}</span>)}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>

      {/* ── OFFICE ────────────────────────────────────────────────────────────── */}
      <div id="office" className="section-pad" style={{ padding: '100px 60px', background: '#D6E4FF' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <Reveal>
            <h2 style={{ fontSize: 'clamp(24px,3.5vw,36px)', fontWeight: '900', marginBottom: '40px', letterSpacing: '-1px' }}>
              Биздин <span style={{ color: '#1B4FD8' }}>офис</span>
            </h2>
          </Reveal>
          <Reveal delay={100}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '20px' }}>
              <div style={{ borderRadius: '20px', overflow: 'hidden', border: '1px solid #E2E8F0', minHeight: '300px' }}>
                <iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d749.8!2d74.6048!3d42.8716!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x389ec85d12345678%3A0x0!2z0JPQvtGA0YzQutC40Lkg0YPQu9C40YbQsCwgMTA4LCDQkdC40YjQutC10Lo!5e0!3m2!1sru!2skg!4v1234567890!5m2!1sru!2skg"
                  width="100%" height="300" style={{ border: 'none', display: 'block' }} allowFullScreen loading="lazy" title="Жангак офиси" />
              </div>
              <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '20px', padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                  <div style={{ fontWeight: '900', fontSize: '17px', marginBottom: '4px' }}>Жангак офиси</div>
                  <div style={{ color: '#94A3B8', fontSize: '13px' }}>Бишкек, Кыргызстан</div>
                </div>
                {[['📍', 'Дарек', 'Горький көчөсү, 108'], ['🕙', 'Убакыт', 'Дүй–Жума: 9:00–19:00'], ['📲', 'Телефон', '+996 502 077 326']].map(([icon, label, value]) => (
                  <div key={label} style={{ display: 'flex', gap: '12px' }}>
                    <div style={{ width: '36px', height: '36px', background: 'rgba(27,79,216,0.2)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', flexShrink: 0 }}>{icon}</div>
                    <div>
                      <div style={{ fontSize: '10px', color: '#94A3B8', marginBottom: '2px' }}>{label}</div>
                      <div style={{ fontSize: '13px', fontWeight: '600' }}>{value}</div>
                    </div>
                  </div>
                ))}
                <a href="https://go.2gis.com/VQjcS" target="_blank" rel="noopener noreferrer" className="cta-btn"
                  style={{ background: 'linear-gradient(135deg,#1B4FD8,#1E63E8)', color: '#0D1E4A', borderRadius: '12px', padding: '12px 20px', fontWeight: '700', fontSize: '13px', textDecoration: 'none', textAlign: 'center', marginTop: 'auto', transition: 'all 0.25s' }}>
                  🗺 2GIS-те ачуу →
                </a>
              </div>
            </div>
          </Reveal>
        </div>
      </div>

      {/* ── FAQ ───────────────────────────────────────────────────────────────── */}
      <div id="faq" className="section-pad" style={{ padding: '100px 60px', background: '#F5F8FF' }}>
        <div style={{ maxWidth: '860px', margin: '0 auto' }}>
          <Reveal>
            <div style={{ textAlign: 'center', marginBottom: '56px' }}>
              <h2 style={{ fontSize: 'clamp(28px,4vw,44px)', fontWeight: '900', letterSpacing: '-1.5px' }}>
                Көп берилүүчү <span style={{ color: '#FCD34D' }}>суроолор</span>
              </h2>
            </div>
          </Reveal>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {faqs.map((faq, i) => (
              <Reveal key={i} delay={i * 60}>
                <div style={{
                  background: openFaq === i ? 'rgba(27,79,216,0.08)' : 'rgba(255,255,255,0.03)',
                  border: openFaq === i ? '1px solid rgba(27,79,216,0.3)' : '1px solid rgba(255,255,255,0.07)',
                  borderRadius: '16px', overflow: 'hidden', transition: 'all 0.3s ease',
                }}>
                  <button onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', background: 'none', border: 'none', color: '#0D1E4A', cursor: 'pointer', textAlign: 'left', gap: '16px' }}>
                    <span style={{ fontWeight: '600', fontSize: '14px', lineHeight: '1.5' }}>{faq.q}</span>
                    <div style={{
                      width: '28px', height: '28px', borderRadius: '50%',
                      background: openFaq === i ? '#1B4FD8' : 'rgba(255,255,255,0.08)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0, transition: 'all 0.3s ease',
                      transform: openFaq === i ? 'rotate(45deg)' : 'rotate(0)',
                      fontSize: '18px', lineHeight: 1,
                    }}>+</div>
                  </button>
                  {openFaq === i && (
                    <div style={{ padding: '0 24px 20px', color: '#475569', fontSize: '14px', lineHeight: '1.75', borderTop: '1px solid #E2E8F0' }}>
                      <div style={{ paddingTop: '16px' }}>{faq.a}</div>
                    </div>
                  )}
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal delay={200}>
            <div style={{ textAlign: 'center', marginTop: '40px' }}>
              <p style={{ color: '#94A3B8', marginBottom: '16px', fontSize: '14px' }}>Дагы суроо барбы?</p>
              <a href={wa} target="_blank" rel="noopener noreferrer" className="cta-btn"
                style={{ display: 'inline-block', background: 'linear-gradient(135deg,#1B4FD8,#1E63E8)', color: '#0D1E4A', borderRadius: '14px', padding: '14px 32px', fontWeight: '800', fontSize: '14px', textDecoration: 'none', boxShadow: '0 8px 32px rgba(27,79,216,0.35)', transition: 'all 0.25s' }}>
                📲 WhatsAppта суроо берүү
              </a>
            </div>
          </Reveal>
        </div>
      </div>

      {/* ── FINAL CTA ─────────────────────────────────────────────────────────── */}
      <div className="section-pad" style={{ padding: '100px 60px', position: 'relative', overflow: 'hidden', background: '#1B4FD8' }}>
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '600px', height: '600px', background: 'radial-gradient(circle,rgba(255,255,255,0.1) 0%,transparent 70%)', pointerEvents: 'none' }} />
        <Reveal>
          <div style={{ maxWidth: '600px', margin: '0 auto', textAlign: 'center', position: 'relative', zIndex: 1 }}>
            <div style={{ fontSize: '48px', marginBottom: '24px', animation: 'wobble 3s ease infinite' }}>🚀</div>
            <h2 style={{ fontSize: 'clamp(28px,4vw,48px)', fontWeight: '900', letterSpacing: '-2px', marginBottom: '16px', lineHeight: '1.1', color: '#fff' }}>
              Келечегиңди<br />
              <span style={{ color: '#BFDBFE' }}>
                бүгүн баштагыз
              </span>
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.75)', marginBottom: '36px', fontSize: '16px', lineHeight: '1.7' }}>
              Биз менен ЖРТга даяр болуңуз.<br />Орундар чектелүү.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <a href={wa} target="_blank" rel="noopener noreferrer" className="cta-btn"
                style={{ background: '#fff', color: '#1B4FD8', borderRadius: '16px', padding: '17px 40px', fontWeight: '900', fontSize: '16px', textDecoration: 'none', boxShadow: '0 12px 40px rgba(0,0,0,0.2)', transition: 'all 0.25s' }}>
                📲 Жазылуу
              </a>
              <button onClick={() => setShowLogin(true)} className="cta-btn"
                style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '16px', padding: '17px 40px', fontWeight: '700', fontSize: '16px', cursor: 'pointer', transition: 'all 0.25s' }}>
                Кирүү →
              </button>
            </div>
          </div>
        </Reveal>
      </div>

      {/* ── FOOTER ────────────────────────────────────────────────────────────── */}
      <div className="section-pad" style={{ background: '#1B4FD8', borderTop: 'none', padding: '28px 60px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img src="/images/logo.png" alt="Zhangak" style={{ width: '28px', height: '28px', objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
          <span style={{ fontWeight: '900', fontSize: '15px' }}>Zhangak</span>
        </div>
        <div style={{ color: '#CBD5E1', fontSize: '12px' }}>© 2025 Жангак. Бардык укуктар корголгон.</div>
        <a href={wa} target="_blank" rel="noopener noreferrer" style={{ color: '#1B4FD8', fontSize: '13px', textDecoration: 'none', fontWeight: '600' }}>
          📲 +996 502 077 326
        </a>
      </div>

      {/* ── LOGIN MODAL ───────────────────────────────────────────────────────── */}
      {showLogin && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(16px)', padding: '20px' }}
          onClick={e => { if (e.target === e.currentTarget) setShowLogin(false) }}>
          <div style={{ background: '#FFFFFF', border: '1px solid #BFDBFE', borderRadius: '28px', padding: '44px', width: '100%', maxWidth: '420px', position: 'relative', boxShadow: '0 24px 80px rgba(27,79,216,0.3)', animation: 'bounceIn 0.4s cubic-bezier(.22,1,.36,1) both' }}>
            {/* Glow */}
            <div style={{ position: 'absolute', top: '-60px', left: '50%', transform: 'translateX(-50%)', width: '200px', height: '200px', background: 'radial-gradient(circle,rgba(27,79,216,0.2) 0%,transparent 70%)', pointerEvents: 'none' }} />
            <button onClick={() => setShowLogin(false)} style={{ position: 'absolute', top: '18px', right: '18px', background: '#F1F5FF', border: 'none', width: '32px', height: '32px', borderRadius: '50%', fontSize: '15px', cursor: 'pointer', color: '#64748B', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
              <img src="/images/logo.png" alt="Zhangak" style={{ width: '44px', height: '44px', objectFit: 'contain', filter: 'brightness(0) invert(1)', marginBottom: '14px' }} />
              <div style={{ fontWeight: '900', fontSize: '22px', letterSpacing: '-0.5px' }}>Кирүү</div>
              <div style={{ color: '#94A3B8', fontSize: '13px', marginTop: '6px' }}>Жангак системасына кирүү</div>
            </div>
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {[
                { label: 'Email', type: 'email', val: email, setter: setEmail, placeholder: 'email@gmail.com' },
                { label: 'Сырсөз', type: 'password', val: password, setter: setPassword, placeholder: '••••••••' },
              ].map(f => (
                <div key={f.label}>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: '#94A3B8', display: 'block', marginBottom: '7px' }}>{f.label}</label>
                  <input type={f.type} value={f.val} onChange={e => f.setter(e.target.value)} placeholder={f.placeholder} required
                    style={{ width: '100%', padding: '13px 16px', borderRadius: '12px', border: '1px solid #E2E8F0', fontSize: '15px', outline: 'none', color: '#0D1E4A', background: '#FFFFFF', boxSizing: 'border-box', transition: 'border-color 0.2s' }}
                    onFocus={e => (e.target.style.borderColor = 'rgba(99,102,241,0.6)')}
                    onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')} />
                </div>
              ))}
              {error && <div style={{ background: 'rgba(239,68,68,0.15)', color: '#FCA5A5', padding: '11px 14px', borderRadius: '10px', fontSize: '13px', textAlign: 'center', border: '1px solid rgba(239,68,68,0.3)' }}>{error}</div>}
              <button type="submit" disabled={loading} className="cta-btn"
                style={{ background: 'linear-gradient(135deg,#1B4FD8,#1E63E8)', color: '#0D1E4A', border: 'none', borderRadius: '12px', padding: '15px', fontWeight: '900', fontSize: '16px', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, transition: 'all 0.25s', boxShadow: '0 8px 24px rgba(27,79,216,0.4)', marginTop: '4px' }}>
                {loading ? 'Кирүүдө...' : 'Кирүү →'}
              </button>
            </form>
            <div style={{ textAlign: 'center', marginTop: '20px' }}>
              <span style={{ color: '#94A3B8', fontSize: '13px' }}>Аккаунт жокпу? </span>
              <a href={wa} target="_blank" rel="noopener noreferrer" style={{ color: '#1B4FD8', fontSize: '13px', fontWeight: '700', textDecoration: 'none' }}>📲 Жазылуу</a>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}