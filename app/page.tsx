'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef, type ReactElement } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

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
      setVal(Math.round((1 - Math.pow(1 - p, 3)) * target))
      if (p < 1) requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
  }, [active, target, duration])
  return val
}

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

function StatCard({ value, suffix = '', label, color, delay }: { value: number; suffix?: string; label: string; color: string; delay: number }) {
  const [ref, inView] = useInView()
  const count = useCounter(value, 1800, inView)
  return (
    <div ref={ref} style={{
      background: '#fff', border: '1px solid #E2E8F0', borderRadius: '20px', padding: '20px',
      textAlign: 'center', transition: 'all 0.3s ease',
      opacity: inView ? 1 : 0, transform: inView ? 'translateY(0)' : 'translateY(30px)',
      transitionDelay: `${delay}ms`,
    }}>
      <div style={{ fontWeight: '900', fontSize: '32px', color, letterSpacing: '-1px' }}>{count}{suffix}</div>
      <div style={{ color: '#94A3B8', fontSize: '12px', marginTop: '4px', fontWeight: '500' }}>{label}</div>
    </div>
  )
}

function ProgressBar({ value, max, color = '#1B4FD8' }: { value: number; max: number; color?: string }) {
  return (
    <div style={{ background: '#E8ECF4', borderRadius: '999px', height: '6px', overflow: 'hidden' }}>
      <div style={{ width: `${Math.min((value / max) * 100, 100)}%`, height: '100%', background: color, borderRadius: '999px', transition: 'width 0.6s ease' }} />
    </div>
  )
}

function EmptyState({ emoji, title, subtitle }: { emoji: string; title: string; subtitle: string }) {
  return (
    <div style={{ background: '#fff', borderRadius: '20px', border: '1px solid #E2E8F0', padding: '56px 32px', textAlign: 'center' }}>
      <div style={{ fontSize: '48px', marginBottom: '16px' }}>{emoji}</div>
      <div style={{ fontWeight: '700', fontSize: '17px', color: '#0D1E4A', marginBottom: '8px' }}>{title}</div>
      <div style={{ color: '#94A3B8', fontSize: '14px', maxWidth: '280px', margin: '0 auto' }}>{subtitle}</div>
    </div>
  )
}

// ─── All 7 students ───────────────────────────────────────────────────────────
const ALL_RESULTS = [
  { img: '/images/result3.png', name: 'Уланбекова Каныкей', score: 221 },
  { img: '/images/result7.png', name: 'Рашидова Айдай', score: 220 },
  { img: '/images/result4.png', name: 'Тилекова Акмарал', score: 211 },
  { img: '/images/result5.png', name: 'Жанжигитова Нуржамал', score: 211 },
  { img: '/images/result1.png', name: 'Шарифжанов Мухаммадзаир', score: 204 },
  { img: '/images/result6.png', name: 'Замиркулова Аяна', score: 203 },
  { img: '/images/result2.png', name: 'Журсунова Нурзат', score: 202 },
]

export default function LandingPage() {
  const [showLogin, setShowLogin] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [timeLeft, setTimeLeft] = useState({ months: 0, hours: 0, minutes: 0, seconds: 0 })
  const [scrollY, setScrollY] = useState(0)
  const [activeResult, setActiveResult] = useState(0)
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
    const id = setInterval(() => setActiveResult(p => (p + 1) % ALL_RESULTS.length), 3000)
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

  const faqs = [
    { q: 'Кайсы предметтер курска кирет?', a: 'Математика, Аналогиялар, Текст түшүнүү, Кыргыз тили грамматикасы — ЖРТнын бардык 4 бөлүмү.' },
    { q: 'Жангактын жетишкендиктери кандай?', a: '9000+ ийгиликтүү бүтүрүүчү. Эң жогорку натыйжа — 221 балл.' },
    { q: 'Кайсы класстын окуучулары жазыла алат?', a: '10 жана 11-класстын окуучулары. ЖРТга кайра даярданып жаткандар да жазыла алат.' },
    { q: 'Курс канча турат?', a: 'Баа жөнүндө WhatsAppта сурасаңыз болот.' },
    { q: 'Курс онлайн же оффлайн?', a: 'Оффлайн — Бишкек, Горький көчөсү 108. Онлайн платформа жакында.' },
    { q: 'Бир сабак канча убакыт?', a: '3 саат: Математика 50 мин + Кыргыз тили 50 мин + Чтение 50 мин + 20 мин оюн.' },
  ]

  const courses = [
    { level: 'B1', name: 'Базовый', month: '1-ай', color: '#60A5FA', glow: 'rgba(96,165,250,0.2)', topics: ['Арифметика', 'Лексика жана морфология', 'Базалык аналогиялар', 'Чтение негиздери'] },
    { level: 'B2', name: 'Продвинутый', month: '2-ай', color: '#1B4FD8', glow: 'rgba(27,79,216,0.3)', topics: ['Алгебра', 'Синтаксис жана аналогия', 'Функциялар', 'Окуу жана түшүнүү'], featured: true },
    { level: 'C1', name: 'Финальный', month: '3-ай', color: '#F59E0B', glow: 'rgba(245,158,11,0.25)', topics: ['Геометрия', 'Грамматика жана чтение', 'Татаал аналогиялар', 'Толук ЖРТ форматы'] },
  ]

  return (
    <div style={{ background: '#FFFFFF', minHeight: '100vh', fontFamily: 'Inter, -apple-system, sans-serif', color: '#0D1E4A', overflowX: 'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; }
        @keyframes floatUp { 0%{transform:translateY(100vh) rotate(0deg);opacity:0} 10%{opacity:0.15} 90%{opacity:0.15} 100%{transform:translateY(-20vh) rotate(360deg);opacity:0} }
        @keyframes gradientShift { 0%,100%{background-position:0% 50%} 50%{background-position:100% 50%} }
        @keyframes slideInLeft { from{opacity:0;transform:translateX(-50px)} to{opacity:1;transform:translateX(0)} }
        @keyframes slideInRight { from{opacity:0;transform:translateX(50px)} to{opacity:1;transform:translateX(0)} }
        @keyframes bounceIn { 0%{transform:scale(0.3);opacity:0} 50%{transform:scale(1.05)} 70%{transform:scale(0.95)} 100%{transform:scale(1);opacity:1} }
        @keyframes wobble { 0%,100%{transform:rotate(-2deg)} 50%{transform:rotate(2deg)} }
        @keyframes marquee { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
        @keyframes fadeScale { from{opacity:0;transform:scale(0.95)} to{opacity:1;transform:scale(1)} }
        @keyframes pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.05)} }
        .cta-btn:hover { transform:scale(1.04) !important; filter:brightness(1.08) !important; }
        .course-card:hover { transform:translateY(-8px) !important; box-shadow:0 24px 60px rgba(27,79,216,0.15) !important; }
        .result-thumb:hover { transform:scale(1.05) !important; }
        .faq-row:hover { background:#F8FAFF !important; }
        .nav-link:hover { color:#1B4FD8 !important; }
        @media(max-width:768px){
          .hero-grid{flex-direction:column !important}
          .hero-right{display:none !important}
          .courses-grid{grid-template-columns:1fr !important}
          .reviews-grid{grid-template-columns:1fr !important}
          .stats-row{grid-template-columns:1fr 1fr !important}
          .nav-links{display:none !important}
          .section-pad{padding-left:20px !important;padding-right:20px !important}
          .hero-title{font-size:38px !important}
          .timer-grid{gap:6px !important}
        }
      `}</style>

      {/* BANNER */}
      <div style={{ background: 'linear-gradient(90deg,#1B4FD8,#2563EB,#3B82F6,#1B4FD8)', backgroundSize: '300% 100%', animation: 'gradientShift 4s ease infinite', padding: '10px 20px', textAlign: 'center', fontSize: '13px', fontWeight: '700', color: '#fff' }}>
        🔥 ЖАЙКЫ ЖРТ ИНТЕНСИВИ — 1-июлдан · 7 000 сом · Белек: Алматыга саякат ✈️
        <a href={wa} target="_blank" rel="noopener noreferrer" style={{ color: '#fff', marginLeft: '14px', textDecoration: 'none', background: 'rgba(255,255,255,0.2)', padding: '3px 12px', borderRadius: '20px', fontWeight: '800' }}>Жазылуу →</a>
      </div>

      {/* NAVBAR */}
      <nav className="section-pad" style={{ background: navScrolled ? 'rgba(255,255,255,0.97)' : 'transparent', backdropFilter: navScrolled ? 'blur(20px)' : 'none', borderBottom: navScrolled ? '1px solid #E2E8F0' : 'none', padding: '0 60px', height: '68px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 200, transition: 'all 0.3s ease' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '36px', height: '36px', background: '#1B4FD8', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <img src="/images/logo.png" alt="Zhangak" style={{ width: '36px', height: '36px', objectFit: 'cover', borderRadius: '8px' }} />
          </div>
          <span style={{ fontWeight: '900', fontSize: '20px', letterSpacing: '-0.5px', color: '#0D1E4A' }}>Zhangak</span>
        </div>
        <div className="nav-links" style={{ display: 'flex', gap: '28px' }}>
          {[['Курстар', '#courses'], ['Натыйжалар', '#results'], ['FAQ', '#faq'], ['Офис', '#office']].map(([l, h]) => (
            <a key={l} href={h} className="nav-link" style={{ color: '#64748B', fontSize: '14px', textDecoration: 'none', fontWeight: '500', transition: 'color 0.2s' }}>{l}</a>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => setShowLogin(true)} style={{ background: '#F8FAFF', color: '#0D1E4A', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '9px 18px', fontWeight: '600', fontSize: '13px', cursor: 'pointer' }}>Кирүү</button>
          <a href={wa} target="_blank" rel="noopener noreferrer" className="cta-btn" style={{ background: '#1B4FD8', color: '#fff', borderRadius: '10px', padding: '9px 18px', fontWeight: '800', fontSize: '13px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.25s', boxShadow: '0 4px 16px rgba(27,79,216,0.3)' }}>📲 Жазылуу</a>
        </div>
      </nav>

      {/* HERO */}
      <div style={{ position: 'relative', overflow: 'hidden', background: 'linear-gradient(160deg,#FFFFFF 0%,#F0F5FF 60%,#E8F0FF 100%)', paddingBottom: '80px' }}>
        {/* Floating particles */}
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
          {Array.from({ length: 12 }, (_, i) => (
            <div key={i} style={{ position: 'absolute', bottom: '-20px', left: `${(i * 8.3) % 100}%`, width: 4 + (i % 3) * 3, height: 4 + (i % 3) * 3, background: i % 2 === 0 ? '#1B4FD8' : '#60A5FA', borderRadius: '50%', opacity: 0.1, animation: `floatUp ${8 + i}s ${i * 0.5}s infinite linear` }} />
          ))}
        </div>
        {/* Glow */}
        <div style={{ position: 'absolute', top: '-100px', right: '-100px', width: '500px', height: '500px', background: 'radial-gradient(circle,rgba(27,79,216,0.08) 0%,transparent 70%)', pointerEvents: 'none' }} />

        <div className="section-pad hero-grid" style={{ padding: '80px 60px 40px', maxWidth: '1200px', margin: '0 auto', display: 'flex', alignItems: 'center', gap: '60px', position: 'relative', zIndex: 1 }}>
          {/* LEFT */}
          <div style={{ flex: 1, animation: 'slideInLeft 0.8s cubic-bezier(.22,1,.36,1) both' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#EEF2FF', border: '1px solid #BFDBFE', borderRadius: '20px', padding: '8px 16px', marginBottom: '28px' }}>
              <span style={{ fontSize: '14px' }}>🏆</span>
              <span style={{ color: '#1B4FD8', fontSize: '13px', fontWeight: '700' }}>9000+ Ийгиликтүү бүтүрүүчү</span>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10B981', animation: 'pulse 2s ease infinite' }} />
            </div>
            <h1 className="hero-title" style={{ fontSize: 'clamp(40px,5vw,64px)', fontWeight: '900', lineHeight: '1.02', marginBottom: '24px', letterSpacing: '-2px', color: '#0D1E4A' }}>
              ЖРТдан{' '}
              <span style={{ color: '#1B4FD8' }}>жогорку балл</span>
              {' '}—{'\n'}сенин{'\n'}
              <span style={{ color: '#1B4FD8' }}>келечегиңдин ачкычы.</span>
            </h1>
            <p style={{ color: '#64748B', fontSize: '16px', lineHeight: '1.8', marginBottom: '36px', maxWidth: '460px' }}>
              Жангак 10-11-класстын окуучуларын ЖРТга инновациялык методика менен даярдайт.
            </p>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <a href={wa} target="_blank" rel="noopener noreferrer" className="cta-btn" style={{ background: '#1B4FD8', color: '#fff', borderRadius: '14px', padding: '15px 32px', fontWeight: '900', fontSize: '15px', textDecoration: 'none', boxShadow: '0 8px 32px rgba(27,79,216,0.35)', transition: 'all 0.25s' }}>📲 Жазылуу</a>
              <button onClick={() => setShowLogin(true)} className="cta-btn" style={{ background: '#F8FAFF', color: '#0D1E4A', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '15px 32px', fontWeight: '700', fontSize: '15px', cursor: 'pointer', transition: 'all 0.25s' }}>Кирүү →</button>
            </div>
            <div style={{ display: 'flex', gap: '32px', marginTop: '44px', paddingTop: '36px', borderTop: '1px solid #E2E8F0', flexWrap: 'wrap' }}>
              {[{ n: '9000+', l: 'Ийгиликтүү бүтүрүүчү', c: '#1B4FD8' }, { n: '221', l: 'Эң жогорку балл', c: '#1B4FD8' }, { n: '3', l: 'Деңгээл', c: '#F59E0B' }].map(s => (
                <div key={s.l}>
                  <div style={{ fontWeight: '900', fontSize: '24px', color: s.c, letterSpacing: '-0.5px' }}>{s.n}</div>
                  <div style={{ color: '#94A3B8', fontSize: '11px', marginTop: '4px' }}>{s.l}</div>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT — Winners gallery */}
          <div className="hero-right" style={{ flex: '0 0 460px', animation: 'slideInRight 0.8s 0.2s cubic-bezier(.22,1,.36,1) both' }}>
            {/* Main active photo */}
            <div style={{ position: 'relative', borderRadius: '24px', overflow: 'hidden', aspectRatio: '3/4', marginBottom: '12px', background: 'linear-gradient(135deg,#050C1F,#0D1E4A,#1B4FD8)', boxShadow: '0 24px 60px rgba(27,79,216,0.3)' }}>
              <img
                key={activeResult}
                src={ALL_RESULTS[activeResult].img}
                alt={ALL_RESULTS[activeResult].name}
                style={{ width: '100%', height: '100%', objectFit: 'cover', animation: 'fadeScale 0.5s ease both' }}
              />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top,rgba(5,12,31,0.98) 0%,transparent 50%)' }} />
              <div style={{ position: 'absolute', bottom: '20px', left: '20px', right: '20px' }}>
                <div style={{ fontWeight: '900', fontSize: '48px', color: '#fff', letterSpacing: '-2px', lineHeight: 1, textShadow: '0 2px 20px rgba(0,0,0,0.5)' }}>
                  {ALL_RESULTS[activeResult].score}
                </div>
                <div style={{ fontWeight: '700', fontSize: '13px', color: 'rgba(255,255,255,0.8)', marginTop: '6px' }}>балл · {ALL_RESULTS[activeResult].name}</div>
              </div>
              {/* ЖРТ badge */}
              <div style={{ position: 'absolute', top: '16px', left: '16px', background: 'rgba(27,79,216,0.9)', backdropFilter: 'blur(8px)', borderRadius: '8px', padding: '5px 12px', fontSize: '11px', fontWeight: '800', color: '#fff' }}>ЖРТ</div>
            </div>

            {/* Thumbnails row */}
            <div style={{ display: 'flex', gap: '8px' }}>
              {ALL_RESULTS.map((r, i) => (
                <div key={i} className="result-thumb" onClick={() => setActiveResult(i)}
                  style={{ flex: 1, aspectRatio: '1', borderRadius: '12px', overflow: 'hidden', cursor: 'pointer', border: activeResult === i ? '2px solid #1B4FD8' : '2px solid transparent', transition: 'all 0.2s', opacity: activeResult === i ? 1 : 0.65, background: '#0D1E4A' }}>
                  <img src={r.img} alt={r.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              ))}
            </div>

            {/* Dots */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginTop: '12px' }}>
              {ALL_RESULTS.map((_, i) => (
                <div key={i} onClick={() => setActiveResult(i)} style={{ width: activeResult === i ? '20px' : '6px', height: '6px', borderRadius: '999px', background: activeResult === i ? '#1B4FD8' : '#BFDBFE', cursor: 'pointer', transition: 'all 0.3s ease' }} />
              ))}
            </div>
          </div>
        </div>

        {/* MARQUEE — running scores */}
        <div style={{ overflow: 'hidden', borderTop: '1px solid #E2E8F0', borderBottom: '1px solid #E2E8F0', padding: '14px 0', background: 'rgba(255,255,255,0.8)' }}>
          <div style={{ display: 'flex', animation: 'marquee 20s linear infinite', width: 'max-content' }}>
            {[...ALL_RESULTS, ...ALL_RESULTS].map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '0 32px', whiteSpace: 'nowrap' }}>
                <span style={{ fontWeight: '900', fontSize: '18px', color: '#1B4FD8' }}>{r.score}</span>
                <span style={{ fontSize: '13px', color: '#64748B', fontWeight: '500' }}>{r.name}</span>
                <span style={{ color: '#BFDBFE', fontSize: '16px' }}>·</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* STATS */}
      <div className="section-pad" style={{ padding: '60px 60px', background: '#F5F8FF' }}>
        <div className="stats-row" style={{ maxWidth: '1200px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '16px' }}>
          <StatCard value={9000} suffix="+" label="Ийгиликтүү бүтүрүүчү" color="#1B4FD8" delay={0} />
          <StatCard value={221} label="Эң жогорку балл" color="#1B4FD8" delay={100} />
          <StatCard value={80} suffix="%" label="Университетке кирди" color="#F59E0B" delay={200} />
          <StatCard value={3} label="Курс деңгээли" color="#1B4FD8" delay={300} />
        </div>
      </div>

      {/* SUMMER INTENSIVE */}
      <div className="section-pad" style={{ padding: '0 60px 60px', background: '#F5F8FF' }}>
        <Reveal>
          <div style={{ maxWidth: '1200px', margin: '0 auto', background: 'linear-gradient(135deg,#FEF3C7,#FEF9E7)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '24px', padding: '32px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '24px', flexWrap: 'wrap' }}>
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '20px', padding: '6px 14px', marginBottom: '16px' }}>
                <span style={{ color: '#D97706', fontSize: '13px', fontWeight: '700' }}>🔥 ЖАЙКЫ ИНТЕНСИВ 2026</span>
              </div>
              <h3 style={{ fontSize: 'clamp(18px,2.5vw,24px)', fontWeight: '900', marginBottom: '16px', lineHeight: '1.3', color: '#0D1E4A' }}>
                1 айда ЖРТга даярдан жана<br />
                <span style={{ color: '#D97706' }}>Алматыга 1 күндүк саякатка бар! ✈️</span>
              </h3>
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                {[['📅', '1-июлдан'], ['🕙', '10:00–12:50'], ['📍', 'Горький 108'], ['💰', '7 000 сом']].map(([icon, text]) => (
                  <div key={text} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#64748B', background: '#fff', borderRadius: '10px', padding: '6px 12px', border: '1px solid #E2E8F0' }}>
                    <span>{icon}</span><span>{text}</span>
                  </div>
                ))}
              </div>
            </div>
            <a href={wa} target="_blank" rel="noopener noreferrer" className="cta-btn"
              style={{ background: 'linear-gradient(135deg,#F59E0B,#EF4444)', color: '#fff', borderRadius: '16px', padding: '18px 36px', fontWeight: '900', fontSize: '16px', textDecoration: 'none', textAlign: 'center', flexShrink: 0, boxShadow: '0 8px 32px rgba(245,158,11,0.3)', transition: 'all 0.25s', whiteSpace: 'nowrap' }}>
              📲 Азыр жазылуу<br /><span style={{ fontSize: '11px', opacity: 0.9 }}>Орундар чектелүү!</span>
            </a>
          </div>
        </Reveal>
      </div>

      {/* TIMER */}
      <div className="section-pad" style={{ padding: '60px 60px', background: '#EEF4FF', borderTop: '1px solid #BFDBFE', borderBottom: '1px solid #BFDBFE' }}>
        <Reveal>
          <div style={{ textAlign: 'center', maxWidth: '700px', margin: '0 auto' }}>
            <p style={{ color: '#1B4FD8', fontSize: '12px', fontWeight: '700', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '20px' }}>ЖРТга чейин калды</p>
            <div className="timer-grid" style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap', alignItems: 'center' }}>
              {[{ n: timeLeft.months, l: 'Ай' }, { n: timeLeft.hours, l: 'Саат' }, { n: timeLeft.minutes, l: 'Мүнөт' }, { n: timeLeft.seconds, l: 'Секунд' }].map((t, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ background: '#fff', border: '1px solid #BFDBFE', borderRadius: '16px', padding: '16px 24px', minWidth: '88px', textAlign: 'center', boxShadow: '0 4px 12px rgba(27,79,216,0.08)' }}>
                    <div style={{ fontWeight: '900', fontSize: '40px', lineHeight: 1, fontVariantNumeric: 'tabular-nums', color: '#1B4FD8' }}>{String(t.n).padStart(2, '0')}</div>
                    <div style={{ color: '#94A3B8', fontSize: '11px', marginTop: '6px', fontWeight: '600' }}>{t.l}</div>
                  </div>
                  {i < 3 && <span style={{ fontSize: '28px', fontWeight: '900', color: '#BFDBFE' }}>:</span>}
                </div>
              ))}
            </div>
            <a href={wa} target="_blank" rel="noopener noreferrer" className="cta-btn"
              style={{ display: 'inline-block', marginTop: '32px', background: '#1B4FD8', color: '#fff', borderRadius: '14px', padding: '14px 36px', fontWeight: '900', fontSize: '15px', textDecoration: 'none', boxShadow: '0 8px 32px rgba(27,79,216,0.3)', transition: 'all 0.25s' }}>
              Азыр жазылуу →
            </a>
          </div>
        </Reveal>
      </div>

      {/* COURSES */}
      <div id="courses" className="section-pad" style={{ padding: '100px 60px', background: '#fff' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <Reveal>
            <div style={{ textAlign: 'center', marginBottom: '64px' }}>
              <p style={{ color: '#94A3B8', fontSize: '12px', fontWeight: '700', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '16px' }}>Программа</p>
              <h2 style={{ fontSize: 'clamp(28px,4vw,44px)', fontWeight: '900', letterSpacing: '-1.5px', marginBottom: '12px', color: '#0D1E4A' }}>
                3 деңгээл — башталгычтан <span style={{ color: '#1B4FD8' }}>финалга чейин</span>
              </h2>
              <p style={{ color: '#94A3B8', fontSize: '15px' }}>Деңгээлиңди тандап, бизге жаз</p>
            </div>
          </Reveal>
          <div className="courses-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '20px' }}>
            {courses.map((c, i) => (
              <Reveal key={c.level} delay={i * 100}>
                <div className="course-card" style={{ background: c.featured ? '#F0F5FF' : '#FAFBFF', border: c.featured ? `2px solid ${c.color}` : '1px solid #E2E8F0', borderRadius: '24px', overflow: 'hidden', height: '100%', transition: 'all 0.35s cubic-bezier(.22,1,.36,1)', position: 'relative', boxShadow: c.featured ? `0 8px 32px ${c.glow}` : 'none' }}>
                  {c.featured && <div style={{ position: 'absolute', top: '16px', right: '16px', background: c.color, color: '#fff', fontSize: '10px', fontWeight: '900', padding: '4px 12px', borderRadius: '20px' }}>⭐ Эң популярдуу</div>}
                  <div style={{ height: '4px', background: `linear-gradient(90deg,${c.color},transparent)` }} />
                  <div style={{ padding: '28px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                      <span style={{ background: `${c.color}22`, color: c.color, borderRadius: '8px', padding: '4px 12px', fontSize: '12px', fontWeight: '900' }}>{c.level}</span>
                      <span style={{ color: '#94A3B8', fontSize: '12px' }}>{c.month}</span>
                    </div>
                    <div style={{ fontWeight: '900', fontSize: '22px', marginBottom: '20px', color: '#0D1E4A' }}>{c.name}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '28px' }}>
                      {c.topics.map((t, j) => (
                        <div key={j} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ width: '18px', height: '18px', background: `${c.color}22`, borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: c.color }} />
                          </div>
                          <span style={{ fontSize: '13px', color: '#64748B' }}>{t}</span>
                        </div>
                      ))}
                    </div>
 <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '20px' }}>
                      <a href={wa} target="_blank" rel="noopener noreferrer" className="cta-btn"
                        style={{ display: 'block', textAlign: 'center', background: c.color, color: '#fff', borderRadius: '12px', padding: '13px 22px', fontSize: '13px', fontWeight: '800', textDecoration: 'none', transition: 'all 0.25s', boxShadow: `0 4px 16px ${c.glow}` }}>
                        📲 Баа жөнүндө сурануу
                      </a>
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>

      {/* RESULTS — full 7 */}
      <div id="results" className="section-pad" style={{ padding: '100px 60px', background: '#F5F8FF' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <Reveal>
            <div style={{ textAlign: 'center', marginBottom: '56px' }}>
              <p style={{ color: '#94A3B8', fontSize: '12px', fontWeight: '700', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '16px' }}>Далил</p>
              <h2 style={{ fontSize: 'clamp(28px,4vw,44px)', fontWeight: '900', letterSpacing: '-1.5px', color: '#0D1E4A' }}>
                Реалдуу <span style={{ color: '#1B4FD8' }}>натыйжалар</span>
              </h2>
            </div>
          </Reveal>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '16px' }}>
            {/* Featured — top scorer */}
            <Reveal delay={0}>
              <div style={{ gridColumn: 'span 2', position: 'relative', borderRadius: '24px', overflow: 'hidden', aspectRatio: '16/9', border: '2px solid #1B4FD8', background: '#0D1E4A' }}
                onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.02)')}
                onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}>
                <img src={ALL_RESULTS[0].img} alt={ALL_RESULTS[0].name} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.85 }} />
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top,rgba(5,12,31,1) 0%,transparent 60%)' }} />
                <div style={{ position: 'absolute', top: '16px', left: '16px', background: '#1B4FD8', color: '#fff', fontSize: '11px', fontWeight: '900', padding: '5px 14px', borderRadius: '20px' }}>🏆 Эң жогорку балл</div>
                <div style={{ position: 'absolute', bottom: '20px', left: '20px' }}>
                  <div style={{ fontWeight: '900', fontSize: '52px', color: '#fff', letterSpacing: '-2px', lineHeight: 1 }}>{ALL_RESULTS[0].score}</div>
                  <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.8)', marginTop: '6px', fontWeight: '600' }}>{ALL_RESULTS[0].name}</div>
                </div>
              </div>
            </Reveal>
            {ALL_RESULTS.slice(1).map((r, i) => (
              <Reveal key={i} delay={(i + 1) * 80}>
                <div style={{ position: 'relative', borderRadius: '20px', overflow: 'hidden', aspectRatio: i < 2 ? '3/4' : '1', border: '1px solid #E2E8F0', background: '#0D1E4A', transition: 'transform 0.3s ease' }}
                  onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.03)')}
                  onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}>
                  <img src={r.img} alt={r.name} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.85 }} />
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top,rgba(5,12,31,1) 0%,transparent 60%)' }} />
                  <div style={{ position: 'absolute', bottom: '12px', left: '12px', right: '12px' }}>
                    <div style={{ fontWeight: '900', fontSize: i < 2 ? '28px' : '20px', color: '#fff', letterSpacing: '-0.5px', lineHeight: 1 }}>{r.score}</div>
                    <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.7)', marginTop: '3px', fontWeight: '500' }}>{r.name}</div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>

      {/* OFFICE */}
      <div id="office" className="section-pad" style={{ padding: '100px 60px', background: '#EEF4FF' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <Reveal>
            <h2 style={{ fontSize: 'clamp(24px,3.5vw,36px)', fontWeight: '900', marginBottom: '40px', color: '#0D1E4A' }}>
              Биздин <span style={{ color: '#1B4FD8' }}>офис</span>
            </h2>
          </Reveal>
          <Reveal delay={100}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '20px' }}>
              <div style={{ borderRadius: '20px', overflow: 'hidden', border: '1px solid #BFDBFE', minHeight: '300px' }}>
                <iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d749.8!2d74.6048!3d42.8716!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x389ec85d12345678%3A0x0!2z0JPQvtGA0YzQutC40Lkg0YPQu9C40YbQsCwgMTA4LCDQkdC40YjQutC10Lo!5e0!3m2!1sru!2skg!4v1234567890!5m2!1sru!2skg"
                  width="100%" height="300" style={{ border: 'none', display: 'block' }} allowFullScreen loading="lazy" title="Жангак офиси" />
              </div>
              <div style={{ background: '#fff', border: '1px solid #BFDBFE', borderRadius: '20px', padding: '28px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
                <div>
                  <div style={{ fontWeight: '900', fontSize: '17px', color: '#0D1E4A', marginBottom: '4px' }}>Жангак офиси</div>
                  <div style={{ color: '#94A3B8', fontSize: '13px' }}>Бишкек, Кыргызстан</div>
                </div>
                {[['📍', 'Дарек', 'Горький көчөсү, 108'], ['🕙', 'Убакыт', 'Дүй–Жума: 9:00–19:00'], ['📲', 'Телефон', '+996 502 077 326']].map(([icon, label, value]) => (
                  <div key={label} style={{ display: 'flex', gap: '12px' }}>
                    <div style={{ width: '36px', height: '36px', background: '#EEF2FF', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', flexShrink: 0 }}>{icon}</div>
                    <div>
                      <div style={{ fontSize: '10px', color: '#94A3B8', marginBottom: '2px' }}>{label}</div>
                      <div style={{ fontSize: '13px', fontWeight: '600', color: '#0D1E4A' }}>{value}</div>
                    </div>
                  </div>
                ))}
                <a href="https://go.2gis.com/VQjcS" target="_blank" rel="noopener noreferrer" className="cta-btn"
                  style={{ background: '#1B4FD8', color: '#fff', borderRadius: '12px', padding: '12px 20px', fontWeight: '700', fontSize: '13px', textDecoration: 'none', textAlign: 'center', marginTop: 'auto', transition: 'all 0.25s' }}>
                  🗺 2GIS-те ачуу →
                </a>
              </div>
            </div>
          </Reveal>
        </div>
      </div>

      {/* FAQ */}
      <div id="faq" className="section-pad" style={{ padding: '100px 60px', background: '#fff' }}>
        <div style={{ maxWidth: '860px', margin: '0 auto' }}>
          <Reveal>
            <div style={{ textAlign: 'center', marginBottom: '56px' }}>
              <h2 style={{ fontSize: 'clamp(28px,4vw,44px)', fontWeight: '900', letterSpacing: '-1.5px', color: '#0D1E4A' }}>
                Көп берилүүчү <span style={{ color: '#F59E0B' }}>суроолор</span>
              </h2>
            </div>
          </Reveal>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {faqs.map((faq, i) => (
              <Reveal key={i} delay={i * 50}>
                <div className="faq-row" style={{ background: openFaq === i ? '#F0F5FF' : '#FAFBFF', border: openFaq === i ? '1px solid #BFDBFE' : '1px solid #E2E8F0', borderRadius: '16px', overflow: 'hidden', transition: 'all 0.25s ease', cursor: 'pointer' }} onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', gap: '16px' }}>
                    <span style={{ fontWeight: '600', fontSize: '14px', color: '#0D1E4A', lineHeight: '1.5' }}>{faq.q}</span>
                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: openFaq === i ? '#1B4FD8' : '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.25s', transform: openFaq === i ? 'rotate(45deg)' : 'none', color: openFaq === i ? '#fff' : '#1B4FD8', fontSize: '18px' }}>+</div>
                  </div>
                  {openFaq === i && (
                    <div style={{ padding: '0 24px 20px', color: '#64748B', fontSize: '14px', lineHeight: '1.75', borderTop: '1px solid #E2E8F0' }}>
                      <div style={{ paddingTop: '16px' }}>{faq.a}</div>
                    </div>
                  )}
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal delay={200}>
            <div style={{ textAlign: 'center', marginTop: '40px' }}>
              <a href={wa} target="_blank" rel="noopener noreferrer" className="cta-btn"
                style={{ display: 'inline-block', background: '#1B4FD8', color: '#fff', borderRadius: '14px', padding: '14px 32px', fontWeight: '800', fontSize: '14px', textDecoration: 'none', boxShadow: '0 8px 32px rgba(27,79,216,0.25)', transition: 'all 0.25s' }}>
                📲 WhatsAppта суроо берүү
              </a>
            </div>
          </Reveal>
        </div>
      </div>

      {/* FINAL CTA */}
      <div className="section-pad" style={{ padding: '100px 60px', background: '#1B4FD8', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '600px', height: '600px', background: 'radial-gradient(circle,rgba(255,255,255,0.08) 0%,transparent 70%)', pointerEvents: 'none' }} />
        <Reveal>
          <div style={{ maxWidth: '600px', margin: '0 auto', textAlign: 'center', position: 'relative', zIndex: 1 }}>
            <div style={{ fontSize: '48px', marginBottom: '24px', animation: 'wobble 3s ease infinite' }}>🚀</div>
            <h2 style={{ fontSize: 'clamp(28px,4vw,48px)', fontWeight: '900', letterSpacing: '-2px', marginBottom: '16px', lineHeight: '1.1', color: '#fff' }}>
              Келечегиңди<br />
              <span style={{ color: '#BFDBFE' }}>бүгүн баштагыз</span>
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

      {/* FOOTER */}
      <div className="section-pad" style={{ background: '#0D3BAE', borderTop: '1px solid rgba(255,255,255,0.1)', padding: '28px 60px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '28px', height: '28px', background: 'rgba(255,255,255,0.15)', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img src="/images/logo.png" alt="Zhangak" style={{ width: '28px', height: '28px', objectFit: 'cover', borderRadius: '6px' }} />
          </div>
          <span style={{ fontWeight: '900', fontSize: '15px', color: '#fff' }}>Zhangak</span>
        </div>
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>© 2025 Жангак. Бардык укуктар корголгон.</div>
        <a href={wa} target="_blank" rel="noopener noreferrer" style={{ color: '#93C5FD', fontSize: '13px', textDecoration: 'none', fontWeight: '600' }}>📲 +996 502 077 326</a>
      </div>

      {/* LOGIN MODAL */}
      {showLogin && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(16px)', padding: '20px' }}
          onClick={e => { if (e.target === e.currentTarget) setShowLogin(false) }}>
          <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '28px', padding: '44px', width: '100%', maxWidth: '420px', position: 'relative', boxShadow: '0 24px 80px rgba(0,0,0,0.2)', animation: 'bounceIn 0.4s cubic-bezier(.22,1,.36,1) both' }}>
            <button onClick={() => setShowLogin(false)} style={{ position: 'absolute', top: '18px', right: '18px', background: '#F8FAFF', border: '1px solid #E2E8F0', width: '32px', height: '32px', borderRadius: '50%', fontSize: '15px', cursor: 'pointer', color: '#64748B', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
              <div style={{ width: '44px', height: '44px', background: '#1B4FD8', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                <img src="/images/logo.png" alt="Zhangak" style={{ width: '44px', height: '44px', objectFit: 'cover', borderRadius: '12px' }} />
              </div>
              <div style={{ fontWeight: '900', fontSize: '22px', color: '#0D1E4A' }}>Кирүү</div>
              <div style={{ color: '#94A3B8', fontSize: '13px', marginTop: '6px' }}>Жангак системасына кирүү</div>
            </div>
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {[{ label: 'Email', type: 'email', val: email, setter: setEmail, placeholder: 'email@gmail.com' }, { label: 'Сырсөз', type: 'password', val: password, setter: setPassword, placeholder: '••••••••' }].map(f => (
                <div key={f.label}>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: '#64748B', display: 'block', marginBottom: '7px' }}>{f.label}</label>
                  <input type={f.type} value={f.val} onChange={e => f.setter(e.target.value)} placeholder={f.placeholder} required
                    style={{ width: '100%', padding: '13px 16px', borderRadius: '12px', border: '1px solid #E2E8F0', fontSize: '15px', outline: 'none', color: '#0D1E4A', background: '#FAFBFF', boxSizing: 'border-box', transition: 'border-color 0.2s' }}
                    onFocus={e => (e.target.style.borderColor = '#1B4FD8')}
                    onBlur={e => (e.target.style.borderColor = '#E2E8F0')} />
                </div>
              ))}
              {error && <div style={{ background: '#FEF2F2', color: '#EF4444', padding: '11px 14px', borderRadius: '10px', fontSize: '13px', textAlign: 'center', border: '1px solid #FECACA' }}>{error}</div>}
              <button type="submit" disabled={loading} className="cta-btn"
                style={{ background: '#1B4FD8', color: '#fff', border: 'none', borderRadius: '12px', padding: '15px', fontWeight: '900', fontSize: '16px', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, transition: 'all 0.25s', marginTop: '4px' }}>
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