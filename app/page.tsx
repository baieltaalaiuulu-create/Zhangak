'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef } from 'react'
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

function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const [ref, inView] = useInView()
  return (
    <div ref={ref} style={{ opacity: inView ? 1 : 0, transform: inView ? 'translateY(0)' : 'translateY(28px)', transition: `opacity 0.65s cubic-bezier(.22,1,.36,1) ${delay}ms, transform 0.65s cubic-bezier(.22,1,.36,1) ${delay}ms` }}>
      {children}
    </div>
  )
}

function StatCard({ value, suffix = '', label, color, delay }: { value: number; suffix?: string; label: string; color: string; delay: number }) {
  const [ref, inView] = useInView()
  const count = useCounter(value, 1800, inView)
  return (
    <div ref={ref} style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '18px', textAlign: 'center', opacity: inView ? 1 : 0, transform: inView ? 'translateY(0)' : 'translateY(24px)', transition: `opacity 0.5s ease ${delay}ms, transform 0.5s ease ${delay}ms` }}>
      <div style={{ fontWeight: '900', fontSize: '28px', color, letterSpacing: '-1px' }}>{count}{suffix}</div>
      <div style={{ color: '#94A3B8', fontSize: '11px', marginTop: '4px', fontWeight: '500' }}>{label}</div>
    </div>
  )
}

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
  const [menuOpen, setMenuOpen] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const target = new Date('2027-05-17T09:00:00')
    const tick = () => {
      const diff = target.getTime() - Date.now()
      if (diff <= 0) return
      setTimeLeft({ months: Math.floor(diff / (1000 * 60 * 60 * 24 * 30)), hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)), minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)), seconds: Math.floor((diff % (1000 * 60)) / 1000) })
    }
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const id = setInterval(() => setActiveResult(p => (p + 1) % ALL_RESULTS.length), 3000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const onScroll = () => { setScrollY(window.scrollY); if (window.scrollY > 10) setMenuOpen(false) }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

 const handleLogin = async (e: React.FormEvent) => {
  e.preventDefault(); setLoading(true); setError('')
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) { setError('Туура эмес email же сырсөз'); setLoading(false); return }
  const { data: profile } = await supabase.from('profiles').select('role, student_type').eq('id', data.user.id).single()
  const role = profile?.role
  const type = profile?.student_type
  if (role === 'admin') router.push('/admin')
  else if (role === 'super_admin') router.push('/admin')
  else if (role === 'teacher') router.push('/teacher')
  else if (role === 'manager') router.push('/manager')
  else if (role === 'director') router.push('/director')
  else if (role === 'finance') router.push('/finance')
  else if (role === 'math_admin') router.push('/math/admin')
  else if (role === 'math_student') router.push('/math/student')
  else if (role === 'math_parent') router.push('/math/parent')
  else if (role === 'student' && type === 'online') router.push('/student/online')
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
    <div style={{ background: '#fff', minHeight: '100vh', fontFamily: 'Inter, -apple-system, sans-serif', color: '#0D1E4A', overflowX: 'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        *{box-sizing:border-box}
        @keyframes floatUp{0%{transform:translateY(100vh) rotate(0deg);opacity:0}10%{opacity:.12}90%{opacity:.12}100%{transform:translateY(-20vh) rotate(360deg);opacity:0}}
        @keyframes gradientShift{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}
        @keyframes marquee{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
        @keyframes fadeScale{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:scale(1)}}
        @keyframes wobble{0%,100%{transform:rotate(-2deg)}50%{transform:rotate(2deg)}}
        @keyframes bounceIn{0%{transform:scale(.3);opacity:0}50%{transform:scale(1.05)}70%{transform:scale(.95)}100%{transform:scale(1);opacity:1}}
        @keyframes slideDown{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}
        @media(hover:hover){.cta-btn:hover{transform:scale(1.04)!important;filter:brightness(1.07)!important}}
        .cta-btn:active{transform:scale(.97)!important}
        @media(hover:hover){.course-card:hover{transform:translateY(-6px)!important;box-shadow:0 20px 56px rgba(27,79,216,0.14)!important}}
        @media(hover:hover){.result-thumb:hover{transform:scale(1.05)!important}}
        @media(hover:hover){.faq-row:hover{background:#F8FAFF!important}}

        /* ── MOBILE ── */
        @media(max-width:640px){
          .banner-extra{display:none}
          .nav-inner{padding:0 16px!important;height:58px!important}
          .nav-desktop{display:none!important}
          .nav-mob-btn{display:flex!important}
          .hero-wrap{padding:52px 20px 32px!important;flex-direction:column!important;gap:28px!important}
          .hero-right{display:none!important}
          .hero-title{font-size:34px!important;letter-spacing:-1px!important}
          .hero-desc{font-size:14px!important;margin-bottom:20px!important}
          .hero-btns{flex-direction:column!important;gap:10px!important}
          .hero-btns a,.hero-btns button{width:100%!important;justify-content:center!important;text-align:center!important}
          .hero-stats{gap:16px!important;margin-top:24px!important;padding-top:20px!important}
          .s-pad{padding-left:16px!important;padding-right:16px!important}
          .stats-row{grid-template-columns:1fr 1fr!important;gap:10px!important}
          .intensive-wrap{flex-direction:column!important;gap:16px!important;padding:22px 18px!important}
          .intensive-btn{width:100%!important}
          .timer-grid{gap:6px!important}
          .timer-box{padding:10px 14px!important;min-width:64px!important}
          .timer-num{font-size:28px!important}
          .courses-grid{grid-template-columns:1fr!important}
          .results-grid{grid-template-columns:1fr 1fr!important;gap:10px!important}
          .office-grid{grid-template-columns:1fr!important}
          .footer-inner{flex-direction:column!important;align-items:flex-start!important;gap:10px!important;padding:18px 16px!important}
          .cta-final-btns{flex-direction:column!important;gap:10px!important}
          .cta-final-btns a,.cta-final-btns button{width:100%!important;text-align:center!important}
          .section-pad-lg{padding-top:56px!important;padding-bottom:56px!important}
          .faq-q-text{font-size:13px!important}
        }
        @media(min-width:641px){
          .nav-mob-btn{display:none!important}
          .mobile-menu{display:none!important}
          .hero-right{display:block!important}
        }
        @media(min-width:641px) and (max-width:900px){
          .hero-wrap{padding:64px 28px 40px!important}
          .hero-right{display:none!important}
          .s-pad{padding-left:28px!important;padding-right:28px!important}
          .courses-grid{grid-template-columns:1fr!important}
          .results-grid{grid-template-columns:1fr 1fr 1fr!important}
        }
      `}</style>

      {/* BANNER */}
      <div style={{ background: 'linear-gradient(90deg,#1B4FD8,#2563EB,#3B82F6,#1B4FD8)', backgroundSize: '300% 100%', animation: 'gradientShift 4s ease infinite', padding: '9px 16px', textAlign: 'center', fontSize: '12px', fontWeight: '700', color: '#fff' }}>
        🔥 ЖАЙКЫ ЖРТ ИНТЕНСИВИ — 1-июлдан · 7 000 сом
        <span className="banner-extra"> · Белек: Алматыга саякат ✈️</span>
        <a href={wa} target="_blank" rel="noopener noreferrer" style={{ color: '#fff', marginLeft: '10px', textDecoration: 'none', background: 'rgba(255,255,255,0.22)', padding: '3px 10px', borderRadius: '20px', fontWeight: '800', fontSize: '11px' }}>Жазылуу →</a>
      </div>

      {/* NAVBAR */}
      <nav style={{ background: navScrolled ? 'rgba(255,255,255,0.97)' : 'transparent', backdropFilter: navScrolled ? 'blur(20px)' : 'none', borderBottom: navScrolled ? '1px solid #E2E8F0' : 'none', position: 'sticky', top: 0, zIndex: 200, transition: 'all 0.3s ease' }}>
        <div className="nav-inner" style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 32px', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <div style={{ width: '34px', height: '34px', background: '#1B4FD8', borderRadius: '8px', overflow: 'hidden', flexShrink: 0 }}>
              <img src="/images/logo.png" alt="Z" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <span style={{ fontWeight: '900', fontSize: '17px', color: '#0D1E4A' }}>Zhangak</span>
          </div>

          {/* Desktop */}
          <div className="nav-desktop" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ display: 'flex', background: '#F1F5F9', borderRadius: '12px', padding: '4px', gap: '4px' }}>
              <button style={{ padding: '6px 14px', borderRadius: '9px', border: 'none', fontSize: '13px', fontWeight: '700', cursor: 'pointer', background: '#1B4FD8', color: '#fff' }}>ЖРТ</button>
              <button onClick={() => router.push('/math')} style={{ padding: '6px 14px', borderRadius: '9px', border: 'none', fontSize: '13px', fontWeight: '600', cursor: 'pointer', background: 'transparent', color: '#64748B' }}>Math</button>
            </div>
            <button onClick={() => setShowLogin(true)} style={{ background: '#F8FAFF', color: '#0D1E4A', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '8px 16px', fontWeight: '600', fontSize: '13px', cursor: 'pointer' }}>Кирүү</button>
            <a href={wa} target="_blank" rel="noopener noreferrer" className="cta-btn" style={{ background: '#1B4FD8', color: '#fff', borderRadius: '10px', padding: '8px 16px', fontWeight: '800', fontSize: '13px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '5px', transition: 'all 0.2s', boxShadow: '0 4px 14px rgba(27,79,216,0.3)' }}>📲 Жазылуу</a>
          </div>

          {/* Mobile burger */}
          <button className="nav-mob-btn" onClick={() => setMenuOpen(p => !p)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'none', flexDirection: 'column', gap: '5px', padding: '8px' }}>
            <div style={{ width: '22px', height: '2px', background: '#0D1E4A', borderRadius: '2px', transition: 'all 0.2s', transform: menuOpen ? 'rotate(45deg) translateY(7px)' : 'none' }} />
            <div style={{ width: '22px', height: '2px', background: '#0D1E4A', borderRadius: '2px', opacity: menuOpen ? 0 : 1, transition: 'opacity 0.2s' }} />
            <div style={{ width: '22px', height: '2px', background: '#0D1E4A', borderRadius: '2px', transition: 'all 0.2s', transform: menuOpen ? 'rotate(-45deg) translateY(-7px)' : 'none' }} />
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="mobile-menu" style={{ background: '#fff', borderTop: '1px solid #E2E8F0', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px', animation: 'slideDown 0.2s ease' }}>
            <div style={{ display: 'flex', background: '#F1F5F9', borderRadius: '12px', padding: '4px', gap: '4px' }}>
              <button style={{ flex: 1, padding: '9px', borderRadius: '9px', border: 'none', fontSize: '14px', fontWeight: '700', cursor: 'pointer', background: '#1B4FD8', color: '#fff' }}>ЖРТ</button>
              <button onClick={() => { router.push('/math'); setMenuOpen(false) }} style={{ flex: 1, padding: '9px', borderRadius: '9px', border: 'none', fontSize: '14px', fontWeight: '600', cursor: 'pointer', background: 'transparent', color: '#64748B' }}>Math</button>
            </div>
            <button onClick={() => { setShowLogin(true); setMenuOpen(false) }} style={{ width: '100%', background: '#F8FAFF', color: '#0D1E4A', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '13px', fontWeight: '600', fontSize: '14px', cursor: 'pointer' }}>Кирүү</button>
            <a href={wa} target="_blank" rel="noopener noreferrer" className="cta-btn" style={{ display: 'block', textAlign: 'center', background: '#1B4FD8', color: '#fff', borderRadius: '12px', padding: '13px', fontWeight: '800', fontSize: '14px', textDecoration: 'none', boxShadow: '0 4px 14px rgba(27,79,216,0.3)' }}>📲 Жазылуу</a>
          </div>
        )}
      </nav>

      {/* HERO */}
      <div style={{ position: 'relative', overflow: 'hidden', background: 'linear-gradient(160deg,#fff 0%,#F0F5FF 60%,#E8F0FF 100%)', paddingBottom: '0' }}>
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
          {Array.from({ length: 10 }, (_, i) => (
            <div key={i} style={{ position: 'absolute', bottom: '-20px', left: `${(i * 10) % 100}%`, width: 3 + (i % 3) * 2, height: 3 + (i % 3) * 2, background: i % 2 === 0 ? '#1B4FD8' : '#60A5FA', borderRadius: '50%', opacity: 0.08, animation: `floatUp ${8 + i}s ${i * 0.5}s infinite linear` }} />
          ))}
        </div>

        <div className="hero-wrap s-pad" style={{ maxWidth: '1200px', margin: '0 auto', padding: '76px 32px 40px', display: 'flex', alignItems: 'center', gap: '48px', position: 'relative', zIndex: 1 }}>
          {/* Left */}
          <div style={{ flex: 1 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#EEF2FF', border: '1px solid #BFDBFE', borderRadius: '20px', padding: '7px 14px', marginBottom: '20px' }}>
              <span style={{ fontSize: '13px' }}>🏆</span>
              <span style={{ color: '#1B4FD8', fontSize: '12px', fontWeight: '700' }}>9000+ Ийгиликтүү бүтүрүүчү</span>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10B981', animation: 'pulse 2s ease infinite', flexShrink: 0 }} />
            </div>
            <h1 className="hero-title" style={{ fontSize: 'clamp(32px,5vw,60px)', fontWeight: '900', lineHeight: '1.04', marginBottom: '18px', letterSpacing: '-2px', color: '#0D1E4A' }}>
              ЖРТдан <span style={{ color: '#1B4FD8' }}>жогорку балл</span> —{' '}
              сенин <span style={{ color: '#1B4FD8' }}>келечегиңдин ачкычы.</span>
            </h1>
            <p className="hero-desc" style={{ color: '#64748B', fontSize: '15px', lineHeight: '1.8', marginBottom: '28px', maxWidth: '460px' }}>
              Жангак 10-11-класстын окуучуларын ЖРТга инновациялык методика менен даярдайт.
            </p>
            <div className="hero-btns" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <a href={wa} target="_blank" rel="noopener noreferrer" className="cta-btn" style={{ background: '#1B4FD8', color: '#fff', borderRadius: '14px', padding: '14px 28px', fontWeight: '900', fontSize: '15px', textDecoration: 'none', boxShadow: '0 8px 28px rgba(27,79,216,0.32)', transition: 'all 0.2s', display: 'inline-block' }}>📲 Жазылуу</a>
              <button onClick={() => setShowLogin(true)} className="cta-btn" style={{ background: '#F8FAFF', color: '#0D1E4A', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '14px 28px', fontWeight: '700', fontSize: '15px', cursor: 'pointer', transition: 'all 0.2s' }}>Кирүү →</button>
            </div>
            <div className="hero-stats" style={{ display: 'flex', gap: '28px', marginTop: '36px', paddingTop: '28px', borderTop: '1px solid #E2E8F0', flexWrap: 'wrap' }}>
              {[{ n: '9000+', l: 'Ийгиликтүү бүтүрүүчү', c: '#1B4FD8' }, { n: '221', l: 'Эң жогорку балл', c: '#1B4FD8' }, { n: '3', l: 'Деңгээл', c: '#F59E0B' }].map(s => (
                <div key={s.l}>
                  <div style={{ fontWeight: '900', fontSize: '22px', color: s.c, letterSpacing: '-0.5px' }}>{s.n}</div>
                  <div style={{ color: '#94A3B8', fontSize: '11px', marginTop: '3px' }}>{s.l}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right — gallery */}
          <div className="hero-right" style={{ flex: '0 0 420px' }}>
            <div style={{ position: 'relative', borderRadius: '22px', overflow: 'hidden', aspectRatio: '3/4', marginBottom: '10px', background: 'linear-gradient(135deg,#050C1F,#0D1E4A,#1B4FD8)', boxShadow: '0 20px 56px rgba(27,79,216,0.28)' }}>
              <img key={activeResult} src={ALL_RESULTS[activeResult].img} alt={ALL_RESULTS[activeResult].name} style={{ width: '100%', height: '100%', objectFit: 'cover', animation: 'fadeScale 0.5s ease both' }} />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top,rgba(5,12,31,0.97) 0%,transparent 50%)' }} />
              <div style={{ position: 'absolute', bottom: '18px', left: '18px', right: '18px' }}>
                <div style={{ fontWeight: '900', fontSize: '44px', color: '#fff', letterSpacing: '-2px', lineHeight: 1 }}>{ALL_RESULTS[activeResult].score}</div>
                <div style={{ fontWeight: '700', fontSize: '12px', color: 'rgba(255,255,255,0.8)', marginTop: '5px' }}>балл · {ALL_RESULTS[activeResult].name}</div>
              </div>
              <div style={{ position: 'absolute', top: '14px', left: '14px', background: 'rgba(27,79,216,0.88)', backdropFilter: 'blur(8px)', borderRadius: '7px', padding: '4px 10px', fontSize: '10px', fontWeight: '800', color: '#fff' }}>ЖРТ</div>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              {ALL_RESULTS.map((r, i) => (
                <div key={i} onClick={() => setActiveResult(i)} style={{ flex: 1, aspectRatio: '1', borderRadius: '10px', overflow: 'hidden', cursor: 'pointer', border: activeResult === i ? '2px solid #1B4FD8' : '2px solid transparent', transition: 'all 0.2s', opacity: activeResult === i ? 1 : 0.6, background: '#0D1E4A' }}>
                  <img src={r.img} alt={r.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '5px', marginTop: '10px' }}>
              {ALL_RESULTS.map((_, i) => (
                <div key={i} onClick={() => setActiveResult(i)} style={{ width: activeResult === i ? '18px' : '5px', height: '5px', borderRadius: '999px', background: activeResult === i ? '#1B4FD8' : '#BFDBFE', cursor: 'pointer', transition: 'all 0.3s' }} />
              ))}
            </div>
          </div>
        </div>

        {/* Marquee */}
        <div style={{ overflow: 'hidden', borderTop: '1px solid #E2E8F0', borderBottom: '1px solid #E2E8F0', padding: '12px 0', background: 'rgba(255,255,255,0.85)' }}>
          <div style={{ display: 'flex', animation: 'marquee 22s linear infinite', width: 'max-content' }}>
            {[...ALL_RESULTS, ...ALL_RESULTS].map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 24px', whiteSpace: 'nowrap' }}>
                <span style={{ fontWeight: '900', fontSize: '16px', color: '#1B4FD8' }}>{r.score}</span>
                <span style={{ fontSize: '12px', color: '#64748B', fontWeight: '500' }}>{r.name}</span>
                <span style={{ color: '#BFDBFE', fontSize: '14px' }}>·</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* STATS */}
      <div className="s-pad section-pad-lg" style={{ padding: '48px 32px', background: '#F5F8FF' }}>
        <div className="stats-row" style={{ maxWidth: '1200px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '14px' }}>
          <StatCard value={9000} suffix="+" label="Ийгиликтүү бүтүрүүчү" color="#1B4FD8" delay={0} />
          <StatCard value={221} label="Эң жогорку балл" color="#1B4FD8" delay={100} />
          <StatCard value={80} suffix="%" label="Университетке кирди" color="#F59E0B" delay={200} />
          <StatCard value={3} label="Курс деңгээли" color="#1B4FD8" delay={300} />
        </div>
      </div>

      {/* INTENSIVE */}
      <div className="s-pad" style={{ padding: '0 32px 48px', background: '#F5F8FF' }}>
        <Reveal>
          <div className="intensive-wrap" style={{ maxWidth: '1200px', margin: '0 auto', background: 'linear-gradient(135deg,#FEF3C7,#FEF9E7)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '22px', padding: '28px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '20px', flexWrap: 'wrap' }}>
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '20px', padding: '5px 12px', marginBottom: '14px' }}>
                <span style={{ color: '#D97706', fontSize: '12px', fontWeight: '700' }}>🔥 ЖАЙКЫ ИНТЕНСИВ 2026</span>
              </div>
              <h3 style={{ fontSize: 'clamp(16px,2.5vw,22px)', fontWeight: '900', marginBottom: '14px', lineHeight: '1.3', color: '#0D1E4A' }}>
                1 айда ЖРТга даярдан жана <span style={{ color: '#D97706' }}>Алматыга бар! ✈️</span>
              </h3>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {[['📅', '1-июлдан'], ['💰', '7 000 сом'], ['📍', 'Горький 108']].map(([icon, text]) => (
                  <div key={text} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: '#64748B', background: '#fff', borderRadius: '9px', padding: '5px 10px', border: '1px solid #E2E8F0' }}>
                    <span>{icon}</span><span>{text}</span>
                  </div>
                ))}
              </div>
            </div>
            <a href={wa} target="_blank" rel="noopener noreferrer" className="cta-btn intensive-btn"
              style={{ background: 'linear-gradient(135deg,#F59E0B,#EF4444)', color: '#fff', borderRadius: '14px', padding: '15px 28px', fontWeight: '900', fontSize: '15px', textDecoration: 'none', textAlign: 'center', flexShrink: 0, boxShadow: '0 8px 28px rgba(245,158,11,0.28)', transition: 'all 0.2s', whiteSpace: 'nowrap' }}>
              📲 Азыр жазылуу<br /><span style={{ fontSize: '10px', opacity: 0.9 }}>Орундар чектелүү!</span>
            </a>
          </div>
        </Reveal>
      </div>

      {/* TIMER */}
      <div className="s-pad section-pad-lg" style={{ padding: '48px 32px', background: '#EEF4FF', borderTop: '1px solid #BFDBFE', borderBottom: '1px solid #BFDBFE' }}>
        <Reveal>
          <div style={{ textAlign: 'center', maxWidth: '640px', margin: '0 auto' }}>
            <p style={{ color: '#1B4FD8', fontSize: '11px', fontWeight: '700', letterSpacing: '2px', textTransform: 'uppercase' as const, marginBottom: '18px' }}>ЖРТга чейин калды</p>
            <div className="timer-grid" style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap', alignItems: 'center' }}>
              {[{ n: timeLeft.months, l: 'Ай' }, { n: timeLeft.hours, l: 'Саат' }, { n: timeLeft.minutes, l: 'Мүнөт' }, { n: timeLeft.seconds, l: 'Секунд' }].map((t, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div className="timer-box" style={{ background: '#fff', border: '1px solid #BFDBFE', borderRadius: '14px', padding: '14px 20px', minWidth: '80px', textAlign: 'center', boxShadow: '0 4px 12px rgba(27,79,216,0.07)' }}>
                    <div className="timer-num" style={{ fontWeight: '900', fontSize: '36px', lineHeight: 1, fontVariantNumeric: 'tabular-nums' as const, color: '#1B4FD8' }}>{String(t.n).padStart(2, '0')}</div>
                    <div style={{ color: '#94A3B8', fontSize: '10px', marginTop: '5px', fontWeight: '600' }}>{t.l}</div>
                  </div>
                  {i < 3 && <span style={{ fontSize: '24px', fontWeight: '900', color: '#BFDBFE' }}>:</span>}
                </div>
              ))}
            </div>
            <a href={wa} target="_blank" rel="noopener noreferrer" className="cta-btn"
              style={{ display: 'inline-block', marginTop: '28px', background: '#1B4FD8', color: '#fff', borderRadius: '13px', padding: '13px 32px', fontWeight: '900', fontSize: '14px', textDecoration: 'none', boxShadow: '0 8px 28px rgba(27,79,216,0.28)', transition: 'all 0.2s' }}>
              Азыр жазылуу →
            </a>
          </div>
        </Reveal>
      </div>

      {/* COURSES */}
      <div id="courses" className="s-pad section-pad-lg" style={{ padding: '72px 32px', background: '#fff' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <Reveal>
            <div style={{ textAlign: 'center', marginBottom: '44px' }}>
              <p style={{ color: '#94A3B8', fontSize: '11px', fontWeight: '700', letterSpacing: '2px', textTransform: 'uppercase' as const, marginBottom: '12px' }}>Программа</p>
              <h2 style={{ fontSize: 'clamp(24px,4vw,42px)', fontWeight: '900', letterSpacing: '-1px', color: '#0D1E4A' }}>
                3 деңгээл — башталгычтан <span style={{ color: '#1B4FD8' }}>финалга чейин</span>
              </h2>
            </div>
          </Reveal>
          <div className="courses-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '16px' }}>
            {courses.map((c, i) => (
              <Reveal key={c.level} delay={i * 90}>
                <div className="course-card" style={{ background: c.featured ? '#F0F5FF' : '#FAFBFF', border: c.featured ? `2px solid ${c.color}` : '1px solid #E2E8F0', borderRadius: '22px', overflow: 'hidden', height: '100%', transition: 'all 0.3s', position: 'relative', boxShadow: c.featured ? `0 6px 28px ${c.glow}` : 'none' }}>
                  {c.featured && <div style={{ position: 'absolute', top: '14px', right: '14px', background: c.color, color: '#fff', fontSize: '10px', fontWeight: '900', padding: '3px 10px', borderRadius: '20px' }}>⭐ Эң популярдуу</div>}
                  <div style={{ height: '4px', background: `linear-gradient(90deg,${c.color},transparent)` }} />
                  <div style={{ padding: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                      <span style={{ background: `${c.color}22`, color: c.color, borderRadius: '7px', padding: '3px 11px', fontSize: '12px', fontWeight: '900' }}>{c.level}</span>
                      <span style={{ color: '#94A3B8', fontSize: '12px' }}>{c.month}</span>
                    </div>
                    <div style={{ fontWeight: '900', fontSize: '20px', marginBottom: '16px', color: '#0D1E4A' }}>{c.name}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '22px' }}>
                      {c.topics.map((t, j) => (
                        <div key={j} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '16px', height: '16px', background: `${c.color}20`, borderRadius: '5px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: c.color }} />
                          </div>
                          <span style={{ fontSize: '13px', color: '#64748B' }}>{t}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '18px' }}>
                      <a href={wa} target="_blank" rel="noopener noreferrer" className="cta-btn"
                        style={{ display: 'block', textAlign: 'center', background: c.color, color: '#fff', borderRadius: '11px', padding: '12px', fontSize: '13px', fontWeight: '800', textDecoration: 'none', transition: 'all 0.2s', boxShadow: `0 4px 14px ${c.glow}` }}>
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

      {/* RESULTS */}
      <div id="results" className="s-pad section-pad-lg" style={{ padding: '72px 32px', background: '#F5F8FF' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <Reveal>
            <div style={{ textAlign: 'center', marginBottom: '40px' }}>
              <p style={{ color: '#94A3B8', fontSize: '11px', fontWeight: '700', letterSpacing: '2px', textTransform: 'uppercase' as const, marginBottom: '12px' }}>Далил</p>
              <h2 style={{ fontSize: 'clamp(24px,4vw,42px)', fontWeight: '900', letterSpacing: '-1px', color: '#0D1E4A' }}>
                Реалдуу <span style={{ color: '#1B4FD8' }}>натыйжалар</span>
              </h2>
            </div>
          </Reveal>
          <div className="results-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: '12px' }}>
            {ALL_RESULTS.map((r, i) => (
              <Reveal key={i} delay={i * 60}>
                <div style={{ position: 'relative', borderRadius: '16px', overflow: 'hidden', aspectRatio: '3/4', border: i === 0 ? '2px solid #1B4FD8' : '1px solid #E2E8F0', background: '#0D1E4A', transition: 'transform 0.3s ease', cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.03)')}
                  onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}>
                  <img src={r.img} alt={r.name} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.9 }} />
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top,rgba(5,12,31,1) 0%,transparent 55%)' }} />
                  {i === 0 && <div style={{ position: 'absolute', top: '10px', left: '10px', background: '#1B4FD8', color: '#fff', fontSize: '9px', fontWeight: '900', padding: '3px 8px', borderRadius: '20px' }}>🏆 Эң жогорку</div>}
                  <div style={{ position: 'absolute', bottom: '10px', left: '10px', right: '10px' }}>
                    <div style={{ fontWeight: '900', fontSize: '24px', color: '#fff', letterSpacing: '-1px', lineHeight: 1 }}>{r.score}</div>
                    <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.7)', marginTop: '3px', fontWeight: '500' }}>{r.name}</div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>

      {/* OFFICE */}
      <div id="office" className="s-pad section-pad-lg" style={{ padding: '72px 32px', background: '#EEF4FF' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <Reveal>
            <h2 style={{ fontSize: 'clamp(22px,3.5vw,36px)', fontWeight: '900', marginBottom: '32px', color: '#0D1E4A' }}>
              Биздин <span style={{ color: '#1B4FD8' }}>офис</span>
            </h2>
          </Reveal>
          <Reveal delay={80}>
            <div className="office-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: '16px' }}>
              <div style={{ borderRadius: '18px', overflow: 'hidden', border: '1px solid #BFDBFE', minHeight: '260px' }}>
                <iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d749.8!2d74.6048!3d42.8716!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x389ec85d12345678%3A0x0!2z0JPQvtGA0YzQutC40Lkg0YPQu9C40YbQsCwgMTA4LCDQkdC40YjQutC10Lo!5e0!3m2!1sru!2skg!4v1234567890!5m2!1sru!2skg"
                  width="100%" height="260" style={{ border: 'none', display: 'block' }} allowFullScreen loading="lazy" title="Жангак офиси" />
              </div>
              <div style={{ background: '#fff', border: '1px solid #BFDBFE', borderRadius: '18px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <div style={{ fontWeight: '900', fontSize: '16px', color: '#0D1E4A', marginBottom: '3px' }}>Жангак офиси</div>
                  <div style={{ color: '#94A3B8', fontSize: '12px' }}>Бишкек, Кыргызстан</div>
                </div>
                {[['📍', 'Дарек', 'Горький 108'], ['🕙', 'Убакыт', 'Дүй–Жума: 9–19'], ['📲', 'Телефон', '+996 502 077 326']].map(([icon, label, value]) => (
                  <div key={label} style={{ display: 'flex', gap: '10px' }}>
                    <div style={{ width: '32px', height: '32px', background: '#EEF2FF', borderRadius: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', flexShrink: 0 }}>{icon}</div>
                    <div>
                      <div style={{ fontSize: '10px', color: '#94A3B8', marginBottom: '1px' }}>{label}</div>
                      <div style={{ fontSize: '12px', fontWeight: '600', color: '#0D1E4A' }}>{value}</div>
                    </div>
                  </div>
                ))}
                <a href="https://go.2gis.com/VQjcS" target="_blank" rel="noopener noreferrer" className="cta-btn"
                  style={{ background: '#1B4FD8', color: '#fff', borderRadius: '11px', padding: '11px', fontWeight: '700', fontSize: '12px', textDecoration: 'none', textAlign: 'center', marginTop: 'auto', transition: 'all 0.2s' }}>
                  🗺 2GIS-те ачуу →
                </a>
              </div>
            </div>
          </Reveal>
        </div>
      </div>

      {/* FAQ */}
      <div id="faq" className="s-pad section-pad-lg" style={{ padding: '72px 32px', background: '#fff' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <Reveal>
            <div style={{ textAlign: 'center', marginBottom: '40px' }}>
              <h2 style={{ fontSize: 'clamp(22px,4vw,42px)', fontWeight: '900', letterSpacing: '-1px', color: '#0D1E4A' }}>
                Көп берилүүчү <span style={{ color: '#F59E0B' }}>суроолор</span>
              </h2>
            </div>
          </Reveal>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {faqs.map((faq, i) => (
              <Reveal key={i} delay={i * 40}>
                <div className="faq-row" style={{ background: openFaq === i ? '#F0F5FF' : '#FAFBFF', border: `1px solid ${openFaq === i ? '#BFDBFE' : '#E2E8F0'}`, borderRadius: '14px', overflow: 'hidden', transition: 'all 0.2s', cursor: 'pointer' }} onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px', gap: '12px' }}>
                    <span className="faq-q-text" style={{ fontWeight: '600', fontSize: '14px', color: '#0D1E4A', lineHeight: '1.4' }}>{faq.q}</span>
                    <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: openFaq === i ? '#1B4FD8' : '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.2s', transform: openFaq === i ? 'rotate(45deg)' : 'none', color: openFaq === i ? '#fff' : '#1B4FD8', fontSize: '17px' }}>+</div>
                  </div>
                  {openFaq === i && (
                    <div style={{ padding: '0 18px 16px', color: '#64748B', fontSize: '14px', lineHeight: '1.7', borderTop: '1px solid #E2E8F0' }}>
                      <div style={{ paddingTop: '12px' }}>{faq.a}</div>
                    </div>
                  )}
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal delay={200}>
            <div style={{ textAlign: 'center', marginTop: '32px' }}>
              <a href={wa} target="_blank" rel="noopener noreferrer" className="cta-btn"
                style={{ display: 'inline-block', background: '#1B4FD8', color: '#fff', borderRadius: '13px', padding: '13px 28px', fontWeight: '800', fontSize: '14px', textDecoration: 'none', boxShadow: '0 8px 28px rgba(27,79,216,0.24)', transition: 'all 0.2s' }}>
                📲 WhatsAppта суроо берүү
              </a>
            </div>
          </Reveal>
        </div>
      </div>

      {/* FINAL CTA */}
      <div className="s-pad section-pad-lg" style={{ padding: '72px 32px', background: '#1B4FD8', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '500px', height: '500px', background: 'radial-gradient(circle,rgba(255,255,255,0.07) 0%,transparent 70%)', pointerEvents: 'none' }} />
        <Reveal>
          <div style={{ maxWidth: '560px', margin: '0 auto', textAlign: 'center', position: 'relative', zIndex: 1 }}>
            <div style={{ fontSize: '44px', marginBottom: '20px', animation: 'wobble 3s ease infinite' }}>🚀</div>
            <h2 style={{ fontSize: 'clamp(26px,4vw,44px)', fontWeight: '900', letterSpacing: '-1.5px', marginBottom: '14px', lineHeight: '1.1', color: '#fff' }}>
              Келечегиңди<br /><span style={{ color: '#BFDBFE' }}>бүгүн баштагыз</span>
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.72)', marginBottom: '28px', fontSize: '15px', lineHeight: '1.7' }}>
              Биз менен ЖРТга даяр болуңуз. Орундар чектелүү.
            </p>
            <div className="cta-final-btns" style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <a href={wa} target="_blank" rel="noopener noreferrer" className="cta-btn"
                style={{ background: '#fff', color: '#1B4FD8', borderRadius: '14px', padding: '15px 36px', fontWeight: '900', fontSize: '15px', textDecoration: 'none', boxShadow: '0 10px 36px rgba(0,0,0,0.18)', transition: 'all 0.2s', display: 'inline-block' }}>
                📲 Жазылуу
              </a>
              <button onClick={() => setShowLogin(true)} className="cta-btn"
                style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '14px', padding: '15px 36px', fontWeight: '700', fontSize: '15px', cursor: 'pointer', transition: 'all 0.2s' }}>
                Кирүү →
              </button>
            </div>
          </div>
        </Reveal>
      </div>

      {/* FOOTER */}
      <div style={{ background: '#0D3BAE', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="footer-inner s-pad" style={{ maxWidth: '1200px', margin: '0 auto', padding: '22px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '26px', height: '26px', background: 'rgba(255,255,255,0.15)', borderRadius: '6px', overflow: 'hidden' }}>
              <img src="/images/logo.png" alt="Z" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <span style={{ fontWeight: '900', fontSize: '14px', color: '#fff' }}>Zhangak</span>
          </div>
          <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px' }}>© 2025 Жангак. Бардык укуктар корголгон.</div>
          <a href={wa} target="_blank" rel="noopener noreferrer" style={{ color: '#93C5FD', fontSize: '13px', textDecoration: 'none', fontWeight: '600' }}>📲 +996 502 077 326</a>
        </div>
      </div>

      {/* LOGIN MODAL */}
      {showLogin && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.68)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(14px)', padding: '16px' }}
          onClick={e => { if (e.target === e.currentTarget) setShowLogin(false) }}>
          <div style={{ background: '#fff', borderRadius: '24px', padding: '36px 28px', width: '100%', maxWidth: '400px', position: 'relative', boxShadow: '0 20px 72px rgba(0,0,0,0.2)', animation: 'bounceIn 0.35s cubic-bezier(.22,1,.36,1) both' }}>
            <button onClick={() => setShowLogin(false)} style={{ position: 'absolute', top: '16px', right: '16px', background: '#F8FAFF', border: '1px solid #E2E8F0', width: '30px', height: '30px', borderRadius: '50%', fontSize: '14px', cursor: 'pointer', color: '#64748B' }}>✕</button>
            <div style={{ textAlign: 'center', marginBottom: '28px' }}>
              <div style={{ width: '42px', height: '42px', background: '#1B4FD8', borderRadius: '11px', margin: '0 auto 12px', overflow: 'hidden' }}>
                <img src="/images/logo.png" alt="Z" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              <div style={{ fontWeight: '900', fontSize: '20px', color: '#0D1E4A' }}>Кирүү</div>
              <div style={{ color: '#94A3B8', fontSize: '13px', marginTop: '4px' }}>Жангак системасына кирүү</div>
            </div>
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: '600', color: '#64748B', display: 'block', marginBottom: '6px' }}>Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@gmail.com" required
                  style={{ width: '100%', padding: '13px 14px', borderRadius: '11px', border: '1px solid #E2E8F0', fontSize: '15px', outline: 'none', color: '#0D1E4A', background: '#FAFBFF', boxSizing: 'border-box' as const }}
                  onFocus={e => (e.target.style.borderColor = '#1B4FD8')} onBlur={e => (e.target.style.borderColor = '#E2E8F0')} />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: '600', color: '#64748B', display: 'block', marginBottom: '6px' }}>Сырсөз</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required
                  style={{ width: '100%', padding: '13px 14px', borderRadius: '11px', border: '1px solid #E2E8F0', fontSize: '15px', outline: 'none', color: '#0D1E4A', background: '#FAFBFF', boxSizing: 'border-box' as const }}
                  onFocus={e => (e.target.style.borderColor = '#1B4FD8')} onBlur={e => (e.target.style.borderColor = '#E2E8F0')} />
              </div>
              {error && <div style={{ background: '#FEF2F2', color: '#EF4444', padding: '10px 14px', borderRadius: '10px', fontSize: '13px', textAlign: 'center', border: '1px solid #FECACA' }}>{error}</div>}
              <button type="submit" disabled={loading} className="cta-btn"
                style={{ background: '#1B4FD8', color: '#fff', border: 'none', borderRadius: '11px', padding: '14px', fontWeight: '900', fontSize: '15px', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, transition: 'all 0.2s', marginTop: '4px' }}>
                {loading ? 'Кирүүдө...' : 'Кирүү →'}
              </button>
            </form>
            <div style={{ textAlign: 'center', marginTop: '18px' }}>
              <span style={{ color: '#94A3B8', fontSize: '13px' }}>Аккаунт жокпу? </span>
              <a href={wa} target="_blank" rel="noopener noreferrer" style={{ color: '#1B4FD8', fontSize: '13px', fontWeight: '700', textDecoration: 'none' }}>📲 Жазылуу</a>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}