'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef } from 'react'
import {
  Clock3,
  Flame,
  LogIn,
  MonitorSmartphone,
  Map,
  MapPin,
  MessageCircle,
  Phone,
  Rocket,
  Star,
  Trophy,
  Users,
} from 'lucide-react'
import { PLATFORM_ORIGIN } from '@/lib/site-hosts'
import MarketingFooter from '@/components/marketing/MarketingFooter'

const PLATFORM_LOGIN_HREF = process.env.NODE_ENV === 'production' ? `${PLATFORM_ORIGIN}/login` : '/login'
const MATH_HREF = '/math'

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
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [scrollY, setScrollY] = useState(0)
  const [activeResult, setActiveResult] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => { setScrollY(window.scrollY); if (window.scrollY > 10) setMenuOpen(false) }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Confirmed by the current public contact link provided by Zhangak.
  const wa = 'https://wa.me/996502245245'
  const navScrolled = scrollY > 40

  const faqs = [
    { q: 'Кайсы предметтер курска кирет?', a: 'Математика, Аналогиялар, Текст түшүнүү, Кыргыз тили грамматикасы — ЖРТнын бардык 4 бөлүмү.' },
    { q: 'Жангактын жетишкендиктери кандай?', a: '9000+ ийгиликтүү бүтүрүүчү. Эң жогорку натыйжа — 221 балл.' },
    { q: 'Кайсы класстын окуучулары жазыла алат?', a: '10 жана 11-класстын окуучулары. ЖРТга кайра даярданып жаткандар да жазыла алат.' },
    { q: 'Курс канча турат?', a: 'Баа жөнүндө WhatsAppта сурасаңыз болот.' },
    { q: 'Курс онлайн же оффлайн?', a: 'Эки формат тең бар. Жакынкы топтун форматы жана дареги боюнча WhatsApp аркылуу тактап коюңуз.' },
    { q: 'Бир сабак канча убакыт?', a: '3 саат: Математика 50 мин + Кыргыз тили 50 мин + Чтение 50 мин + 20 мин оюн.' },
  ]

  const courses = [
    { level: 'B1', name: 'Базовый', month: '1-ай', color: '#60A5FA', glow: 'rgba(96,165,250,0.2)', topics: ['Арифметика', 'Лексика жана морфология', 'Базалык аналогиялар', 'Чтение негиздери'] },
    { level: 'B2', name: 'Продвинутый', month: '2-ай', color: '#1B3F92', glow: 'rgba(27,63,146,0.3)', topics: ['Алгебра', 'Синтаксис жана аналогия', 'Функциялар', 'Окуу жана түшүнүү'], featured: true },
    { level: 'C1', name: 'Финальный', month: '3-ай', color: '#F59E0B', glow: 'rgba(245,158,11,0.25)', topics: ['Геометрия', 'Грамматика жана чтение', 'Татаал аналогиялар', 'Толук ЖРТ форматы'] },
  ]

  return (
    <main id="top" lang="ky" style={{ background: '#fff', minHeight: '100vh', fontFamily: 'Inter, -apple-system, sans-serif', color: '#0D1E4A', overflowX: 'hidden' }}>
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
        @media(hover:hover){.course-card:hover{transform:translateY(-6px)!important;box-shadow:0 20px 56px rgba(27,63,146,0.14)!important}}
        @media(hover:hover){.result-thumb:hover{transform:scale(1.05)!important}}
        @media(hover:hover){.faq-row:hover{background:#F8FAFF!important}}
        @media(prefers-reduced-motion:reduce){
          *,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;scroll-behavior:auto!important;transition-duration:.01ms!important}
        }
        @media(min-width:641px) and (max-width:1050px){.nav-anchor-links{display:none!important}}

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
      <div style={{ background: 'linear-gradient(90deg,#1B3F92,#2563EB,#3B82F6,#1B3F92)', backgroundSize: '300% 100%', animation: 'gradientShift 4s ease infinite', padding: '9px 16px', textAlign: 'center', fontSize: '12px', fontWeight: '700', color: '#fff' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><Flame size={14} aria-hidden="true" /> ЖРТ 2027 — ЖАҢЫ ТОПТОРГО КАБЫЛ АЛУУ</span>
        <span className="banner-extra"> · Онлайн жана Бишкекте</span>
        <a href={wa} target="_blank" rel="noopener noreferrer" style={{ color: '#fff', marginLeft: '10px', textDecoration: 'none', background: 'rgba(255,255,255,0.22)', padding: '3px 10px', borderRadius: '20px', fontWeight: '800', fontSize: '11px' }}>Жазылуу →</a>
      </div>

      {/* NAVBAR */}
      <nav style={{ background: navScrolled ? 'rgba(255,255,255,0.97)' : 'transparent', backdropFilter: navScrolled ? 'blur(20px)' : 'none', borderBottom: navScrolled ? '1px solid #E2E8F0' : 'none', position: 'sticky', top: 0, zIndex: 200, transition: 'all 0.3s ease' }}>
        <div className="nav-inner" style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 32px', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <div style={{ width: '34px', height: '34px', background: '#1B3F92', borderRadius: '8px', overflow: 'hidden', flexShrink: 0 }}>
              <img src="/images/logo.png" alt="Z" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <span style={{ fontWeight: '900', fontSize: '17px', color: '#0D1E4A' }}>Zhangak</span>
          </div>

          {/* Desktop */}
          <div className="nav-desktop" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="nav-anchor-links" style={{ display: 'flex', alignItems: 'center', gap: '18px', marginRight: '4px' }}>
              <a href="#courses" style={{ color: '#475569', fontSize: '13px', fontWeight: '700', textDecoration: 'none' }}>Программалар</a>
              <a href="#results" style={{ color: '#475569', fontSize: '13px', fontWeight: '700', textDecoration: 'none' }}>Жыйынтыктар</a>
              <a href="#office" style={{ color: '#475569', fontSize: '13px', fontWeight: '700', textDecoration: 'none' }}>Байланыш</a>
            </div>
            <div style={{ display: 'flex', background: '#F1F5F9', borderRadius: '12px', padding: '4px', gap: '4px' }}>
              <button style={{ padding: '6px 14px', borderRadius: '9px', border: 'none', fontSize: '13px', fontWeight: '700', cursor: 'pointer', background: '#1B3F92', color: '#fff' }}>ЖРТ</button>
              <a href={MATH_HREF} style={{ padding: '6px 14px', borderRadius: '9px', border: 'none', fontSize: '13px', fontWeight: '600', cursor: 'pointer', background: 'transparent', color: '#64748B', textDecoration: 'none' }}>Math</a>
            </div>
            <a href={PLATFORM_LOGIN_HREF} style={{ background: '#F8FAFF', color: '#0D1E4A', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '8px 16px', fontWeight: '600', fontSize: '13px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}><LogIn size={15} aria-hidden="true" /> Кирүү</a>
            <a href={wa} target="_blank" rel="noopener noreferrer" className="cta-btn" style={{ background: '#1B3F92', color: '#fff', borderRadius: '10px', padding: '8px 16px', fontWeight: '800', fontSize: '13px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '5px', transition: 'all 0.2s', boxShadow: '0 4px 14px rgba(27,63,146,0.3)' }}><MessageCircle size={15} aria-hidden="true" /> Жазылуу</a>
          </div>

          {/* Mobile burger */}
          <button className="nav-mob-btn" type="button" onClick={() => setMenuOpen(p => !p)}
            aria-label={menuOpen ? 'Менюну жабуу' : 'Менюну ачуу'} aria-expanded={menuOpen}
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
              <button style={{ flex: 1, padding: '9px', borderRadius: '9px', border: 'none', fontSize: '14px', fontWeight: '700', cursor: 'pointer', background: '#1B3F92', color: '#fff' }}>ЖРТ</button>
              <a href={MATH_HREF} onClick={() => setMenuOpen(false)} style={{ flex: 1, padding: '9px', borderRadius: '9px', border: 'none', fontSize: '14px', fontWeight: '600', cursor: 'pointer', background: 'transparent', color: '#64748B', textAlign: 'center', textDecoration: 'none' }}>Math</a>
            </div>
            <a href="#courses" onClick={() => setMenuOpen(false)} style={{ padding: '7px 4px', color: '#334155', fontWeight: '700', fontSize: '14px', textDecoration: 'none' }}>Программалар</a>
            <a href="#results" onClick={() => setMenuOpen(false)} style={{ padding: '7px 4px', color: '#334155', fontWeight: '700', fontSize: '14px', textDecoration: 'none' }}>Жыйынтыктар</a>
            <a href="#office" onClick={() => setMenuOpen(false)} style={{ padding: '7px 4px', color: '#334155', fontWeight: '700', fontSize: '14px', textDecoration: 'none' }}>Дарек жана байланыш</a>
            <a href={PLATFORM_LOGIN_HREF} onClick={() => setMenuOpen(false)} style={{ width: '100%', background: '#F8FAFF', color: '#0D1E4A', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '13px', fontWeight: '600', fontSize: '14px', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px' }}><LogIn size={17} aria-hidden="true" /> Кирүү</a>
            <a href={wa} target="_blank" rel="noopener noreferrer" className="cta-btn" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', textAlign: 'center', background: '#1B3F92', color: '#fff', borderRadius: '12px', padding: '13px', fontWeight: '800', fontSize: '14px', textDecoration: 'none', boxShadow: '0 4px 14px rgba(27,63,146,0.3)' }}><MessageCircle size={17} aria-hidden="true" /> Жазылуу</a>
          </div>
        )}
      </nav>

      {/* HERO */}
      <div style={{ position: 'relative', overflow: 'hidden', background: 'linear-gradient(160deg,#fff 0%,#F0F5FF 60%,#E8F0FF 100%)', paddingBottom: '0' }}>
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
          {Array.from({ length: 10 }, (_, i) => (
            <div key={i} style={{ position: 'absolute', bottom: '-20px', left: `${(i * 10) % 100}%`, width: 3 + (i % 3) * 2, height: 3 + (i % 3) * 2, background: i % 2 === 0 ? '#1B3F92' : '#60A5FA', borderRadius: '50%', opacity: 0.08, animation: `floatUp ${8 + i}s ${i * 0.5}s infinite linear` }} />
          ))}
        </div>

        <div className="hero-wrap s-pad" style={{ maxWidth: '1200px', margin: '0 auto', padding: '76px 32px 40px', display: 'flex', alignItems: 'center', gap: '48px', position: 'relative', zIndex: 1 }}>
          {/* Left */}
          <div style={{ flex: 1 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#EEF2FF', border: '1px solid #BFDBFE', borderRadius: '20px', padding: '7px 14px', marginBottom: '20px' }}>
              <Trophy size={15} aria-hidden="true" style={{ color: '#1B3F92' }} />
              <span style={{ color: '#1B3F92', fontSize: '12px', fontWeight: '700' }}>9000+ Ийгиликтүү бүтүрүүчү</span>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10B981', animation: 'pulse 2s ease infinite', flexShrink: 0 }} />
            </div>
            <h1 className="hero-title" style={{ fontSize: 'clamp(32px,5vw,60px)', fontWeight: '900', lineHeight: '1.04', marginBottom: '18px', letterSpacing: '-2px', color: '#0D1E4A' }}>
              ЖРТдан <span style={{ color: '#1B3F92' }}>жогорку балл</span> —{' '}
              сенин <span style={{ color: '#1B3F92' }}>келечегиңдин ачкычы.</span>
            </h1>
            <p className="hero-desc" style={{ color: '#64748B', fontSize: '15px', lineHeight: '1.8', marginBottom: '28px', maxWidth: '460px' }}>
              Жангак 10-11-класстын окуучуларын ЖРТга инновациялык методика менен даярдайт.
            </p>
            <div className="hero-btns" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <a href={wa} target="_blank" rel="noopener noreferrer" className="cta-btn" style={{ background: '#1B3F92', color: '#fff', borderRadius: '14px', padding: '14px 28px', fontWeight: '900', fontSize: '15px', textDecoration: 'none', boxShadow: '0 8px 28px rgba(27,63,146,0.32)', transition: 'all 0.2s', display: 'inline-flex', alignItems: 'center', gap: '8px' }}><MessageCircle size={18} aria-hidden="true" /> Жазылуу</a>
              <a href={PLATFORM_LOGIN_HREF} className="cta-btn" style={{ background: '#F8FAFF', color: '#0D1E4A', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '14px 28px', fontWeight: '700', fontSize: '15px', textDecoration: 'none', transition: 'all 0.2s', display: 'inline-flex', alignItems: 'center', gap: '8px' }}><LogIn size={18} aria-hidden="true" /> Кирүү</a>
            </div>
            <div className="hero-stats" style={{ display: 'flex', gap: '28px', marginTop: '36px', paddingTop: '28px', borderTop: '1px solid #E2E8F0', flexWrap: 'wrap' }}>
              {[{ n: '9000+', l: 'Ийгиликтүү бүтүрүүчү', c: '#1B3F92' }, { n: '221', l: 'Эң жогорку балл', c: '#1B3F92' }, { n: '3', l: 'Деңгээл', c: '#F59E0B' }].map(s => (
                <div key={s.l}>
                  <div style={{ fontWeight: '900', fontSize: '22px', color: s.c, letterSpacing: '-0.5px' }}>{s.n}</div>
                  <div style={{ color: '#94A3B8', fontSize: '11px', marginTop: '3px' }}>{s.l}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right — gallery */}
          <div className="hero-right" style={{ flex: '0 0 420px' }}>
            <div style={{ position: 'relative', borderRadius: '22px', overflow: 'hidden', aspectRatio: '3/4', marginBottom: '10px', background: 'linear-gradient(135deg,#050C1F,#0D1E4A,#1B3F92)', boxShadow: '0 20px 56px rgba(27,63,146,0.28)' }}>
              <img key={activeResult} src={ALL_RESULTS[activeResult].img} alt={ALL_RESULTS[activeResult].name} style={{ width: '100%', height: '100%', objectFit: 'cover', animation: 'fadeScale 0.5s ease both' }} />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top,rgba(5,12,31,0.97) 0%,transparent 50%)' }} />
              <div style={{ position: 'absolute', bottom: '18px', left: '18px', right: '18px' }}>
                <div style={{ fontWeight: '900', fontSize: '44px', color: '#fff', letterSpacing: '-2px', lineHeight: 1 }}>{ALL_RESULTS[activeResult].score}</div>
                <div style={{ fontWeight: '700', fontSize: '12px', color: 'rgba(255,255,255,0.8)', marginTop: '5px' }}>балл · {ALL_RESULTS[activeResult].name}</div>
              </div>
              <div style={{ position: 'absolute', top: '14px', left: '14px', background: 'rgba(27,63,146,0.88)', backdropFilter: 'blur(8px)', borderRadius: '7px', padding: '4px 10px', fontSize: '10px', fontWeight: '800', color: '#fff' }}>ЖРТ</div>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              {ALL_RESULTS.map((r, i) => (
                <button key={i} type="button" onClick={() => setActiveResult(i)} aria-label={`${r.name}: ${r.score} балл`} aria-pressed={activeResult === i} className="result-thumb" style={{ flex: 1, aspectRatio: '1', padding: 0, borderRadius: '10px', overflow: 'hidden', cursor: 'pointer', border: activeResult === i ? '2px solid #1B3F92' : '2px solid transparent', transition: 'all 0.2s', opacity: activeResult === i ? 1 : 0.6, background: '#0D1E4A' }}>
                  <img src={r.img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '5px', marginTop: '10px' }}>
              {ALL_RESULTS.map((_, i) => (
                <button key={i} type="button" onClick={() => setActiveResult(i)} aria-label={`Жыйынтык ${i + 1}`} aria-current={activeResult === i ? 'true' : undefined} style={{ width: activeResult === i ? '24px' : '12px', height: '12px', padding: 0, border: 'none', borderRadius: '999px', background: activeResult === i ? '#1B3F92' : '#BFDBFE', cursor: 'pointer', transition: 'all 0.3s' }} />
              ))}
            </div>
          </div>
        </div>

        {/* Marquee */}
        <div style={{ overflow: 'hidden', borderTop: '1px solid #E2E8F0', borderBottom: '1px solid #E2E8F0', padding: '12px 0', background: 'rgba(255,255,255,0.85)' }}>
          <div style={{ display: 'flex', animation: 'marquee 22s linear infinite', width: 'max-content' }}>
            {[...ALL_RESULTS, ...ALL_RESULTS].map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 24px', whiteSpace: 'nowrap' }}>
                <span style={{ fontWeight: '900', fontSize: '16px', color: '#1B3F92' }}>{r.score}</span>
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
          <StatCard value={9000} suffix="+" label="Ийгиликтүү бүтүрүүчү" color="#1B3F92" delay={0} />
          <StatCard value={221} label="Эң жогорку балл" color="#1B3F92" delay={100} />
          <StatCard value={80} suffix="%" label="Университетке кирди" color="#F59E0B" delay={200} />
          <StatCard value={3} label="Курс деңгээли" color="#1B3F92" delay={300} />
        </div>
      </div>

      {/* INTENSIVE */}
      <div className="s-pad" style={{ padding: '0 32px 48px', background: '#F5F8FF' }}>
        <Reveal>
          <div className="intensive-wrap" style={{ maxWidth: '1200px', margin: '0 auto', background: 'linear-gradient(135deg,#FEF3C7,#FEF9E7)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '22px', padding: '28px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '20px', flexWrap: 'wrap' }}>
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '20px', padding: '5px 12px', marginBottom: '14px' }}>
                <span style={{ color: '#D97706', fontSize: '12px', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '6px' }}><Flame size={14} aria-hidden="true" /> ЖРТ 2027 · ЖАҢЫ ТОПТОР</span>
              </div>
              <h2 style={{ fontSize: 'clamp(16px,2.5vw,22px)', fontWeight: '900', marginBottom: '14px', lineHeight: '1.3', color: '#0D1E4A' }}>
                Өз деңгээлиңе ылайык топ менен <span style={{ color: '#D97706' }}>системалуу даярдан</span>
              </h2>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {[{ Icon: Users, text: '10–11 класс' }, { Icon: MonitorSmartphone, text: 'Онлайн/оффлайн' }, { Icon: MapPin, text: 'Дарек WhatsAppта' }].map(({ Icon, text }) => (
                  <div key={text} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: '#64748B', background: '#fff', borderRadius: '9px', padding: '5px 10px', border: '1px solid #E2E8F0' }}>
                    <Icon size={14} aria-hidden="true" /><span>{text}</span>
                  </div>
                ))}
              </div>
            </div>
            <a href={wa} target="_blank" rel="noopener noreferrer" className="cta-btn intensive-btn"
              style={{ background: 'linear-gradient(135deg,#F59E0B,#EF4444)', color: '#fff', borderRadius: '14px', padding: '15px 28px', fontWeight: '900', fontSize: '15px', textDecoration: 'none', textAlign: 'center', flexShrink: 0, boxShadow: '0 8px 28px rgba(245,158,11,0.28)', transition: 'all 0.2s', whiteSpace: 'nowrap' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '7px' }}><MessageCircle size={17} aria-hidden="true" /> Азыр жазылуу</span><br /><span style={{ fontSize: '10px', opacity: 0.9 }}>Орундар чектелүү!</span>
            </a>
          </div>
        </Reveal>
      </div>

      {/* ENROLLMENT CTA — no unverified exam-date countdown. */}
      <div className="s-pad section-pad-lg" style={{ padding: '48px 32px', background: '#EEF4FF', borderTop: '1px solid #BFDBFE', borderBottom: '1px solid #BFDBFE' }}>
        <Reveal>
          <div style={{ textAlign: 'center', maxWidth: '640px', margin: '0 auto' }}>
            <p style={{ color: '#1B3F92', fontSize: '11px', fontWeight: '700', letterSpacing: '2px', textTransform: 'uppercase' as const, marginBottom: '12px' }}>ЖРТ 2027</p>
            <h2 style={{ color: '#0D1E4A', fontSize: 'clamp(24px, 4vw, 36px)', fontWeight: '900', letterSpacing: '-0.8px', lineHeight: 1.15 }}>
              Даярдыкты бүгүн башта
            </h2>
            <p style={{ maxWidth: '520px', margin: '14px auto 0', color: '#475569', fontSize: '15px', lineHeight: 1.6 }}>
              Өзүңө ылайыктуу онлайн же оффлайн топту WhatsApp аркылуу тактап, каттал.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginTop: '22px', flexWrap: 'wrap' }}>
              {[
                { Icon: Users, text: '10–11-класстар үчүн' },
                { Icon: MonitorSmartphone, text: 'Онлайн жана оффлайн' },
                { Icon: MessageCircle, text: 'Ыңгайлуу байланыш' },
              ].map(({ Icon, text }) => (
                <span key={text} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 11px', borderRadius: '999px', background: '#fff', border: '1px solid #BFDBFE', color: '#475569', fontSize: '12px', fontWeight: '700' }}>
                  <Icon size={15} aria-hidden="true" style={{ color: '#1B3F92' }} />
                  {text}
                </span>
              ))}
            </div>
            <a href={wa} target="_blank" rel="noopener noreferrer" className="cta-btn"
              style={{ display: 'inline-block', marginTop: '28px', background: '#1B3F92', color: '#fff', borderRadius: '13px', padding: '13px 32px', fontWeight: '900', fontSize: '14px', textDecoration: 'none', boxShadow: '0 8px 28px rgba(27,63,146,0.28)', transition: 'all 0.2s' }}>
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
                3 деңгээл — башталгычтан <span style={{ color: '#1B3F92' }}>финалга чейин</span>
              </h2>
            </div>
          </Reveal>
          <div className="courses-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '16px' }}>
            {courses.map((c, i) => (
              <Reveal key={c.level} delay={i * 90}>
                <div className="course-card" style={{ background: c.featured ? '#F0F5FF' : '#FAFBFF', border: c.featured ? `2px solid ${c.color}` : '1px solid #E2E8F0', borderRadius: '22px', overflow: 'hidden', height: '100%', transition: 'all 0.3s', position: 'relative', boxShadow: c.featured ? `0 6px 28px ${c.glow}` : 'none' }}>
                  {c.featured && <div style={{ position: 'absolute', top: '14px', right: '14px', background: c.color, color: '#fff', fontSize: '10px', fontWeight: '900', padding: '3px 10px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '5px' }}><Star size={11} aria-hidden="true" /> Эң популярдуу</div>}
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
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '7px' }}><MessageCircle size={16} aria-hidden="true" /> Баа жөнүндө сурануу</span>
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
                Реалдуу <span style={{ color: '#1B3F92' }}>натыйжалар</span>
              </h2>
            </div>
          </Reveal>
          <div className="results-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: '12px' }}>
            {ALL_RESULTS.map((r, i) => (
              <Reveal key={i} delay={i * 60}>
                <div style={{ position: 'relative', borderRadius: '16px', overflow: 'hidden', aspectRatio: '3/4', border: i === 0 ? '2px solid #1B3F92' : '1px solid #E2E8F0', background: '#0D1E4A', transition: 'transform 0.3s ease', cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.03)')}
                  onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}>
                  <img src={r.img} alt={r.name} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.9 }} />
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top,rgba(5,12,31,1) 0%,transparent 55%)' }} />
                  {i === 0 && <div style={{ position: 'absolute', top: '10px', left: '10px', background: '#1B3F92', color: '#fff', fontSize: '9px', fontWeight: '900', padding: '3px 8px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '4px' }}><Trophy size={10} aria-hidden="true" /> Эң жогорку</div>}
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
              Биздин <span style={{ color: '#1B3F92' }}>офис</span>
            </h2>
          </Reveal>
          <Reveal delay={80}>
            <div className="office-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: '16px' }}>
              <div style={{ borderRadius: '18px', overflow: 'hidden', border: '1px solid #BFDBFE', minHeight: '260px', background: 'linear-gradient(145deg,#F8FBFF,#E8F0FF)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '28px', textAlign: 'center' }}>
                <div>
                  <MapPin size={32} aria-hidden="true" style={{ color: '#1B3F92', margin: '0 auto 12px' }} />
                  <div style={{ color: '#0D1E4A', fontWeight: 900, fontSize: '17px' }}>Даректи жаңыртып жатабыз</div>
                  <p style={{ color: '#64748B', fontSize: '13px', lineHeight: 1.6, marginTop: '8px' }}>Жакынкы топтун дарегин жана жол картасын WhatsApp аркылуу жөнөтөбүз.</p>
                  <a href={wa} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', marginTop: '16px', borderRadius: '10px', background: '#1B3F92', color: '#fff', padding: '10px 14px', textDecoration: 'none', fontSize: '12px', fontWeight: 800 }}>Даректи суроо</a>
                </div>
              </div>
              <div style={{ background: '#fff', border: '1px solid #BFDBFE', borderRadius: '18px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <div style={{ fontWeight: '900', fontSize: '16px', color: '#0D1E4A', marginBottom: '3px' }}>Жангак офиси</div>
                  <div style={{ color: '#94A3B8', fontSize: '12px' }}>Бишкек, Кыргызстан</div>
                </div>
                {[{ Icon: MapPin, label: 'Дарек', value: 'WhatsApp аркылуу тактаңыз' }, { Icon: Clock3, label: 'Байланыш', value: 'WhatsApp аркылуу' }, { Icon: Phone, label: 'WhatsApp', value: '+996 502 245 245' }].map(({ Icon, label, value }) => (
                  <div key={label} style={{ display: 'flex', gap: '10px' }}>
                    <div style={{ width: '32px', height: '32px', background: '#EEF2FF', borderRadius: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1B3F92', flexShrink: 0 }}><Icon size={16} aria-hidden="true" /></div>
                    <div>
                      <div style={{ fontSize: '10px', color: '#94A3B8', marginBottom: '1px' }}>{label}</div>
                      <div style={{ fontSize: '12px', fontWeight: '600', color: '#0D1E4A' }}>{value}</div>
                    </div>
                  </div>
                ))}
                <a href={wa} target="_blank" rel="noopener noreferrer" className="cta-btn"
                  style={{ background: '#1B3F92', color: '#fff', borderRadius: '11px', padding: '11px', fontWeight: '700', fontSize: '12px', textDecoration: 'none', textAlign: 'center', marginTop: 'auto', transition: 'all 0.2s' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><Map size={15} aria-hidden="true" /> Даректи WhatsAppта суроо</span>
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
                <div className="faq-row" style={{ background: openFaq === i ? '#F0F5FF' : '#FAFBFF', border: `1px solid ${openFaq === i ? '#BFDBFE' : '#E2E8F0'}`, borderRadius: '14px', overflow: 'hidden', transition: 'all 0.2s' }}>
                  <button type="button" onClick={() => setOpenFaq(openFaq === i ? null : i)} aria-expanded={openFaq === i} aria-controls={`faq-answer-${i}`} style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px', gap: '12px', border: 'none', background: 'transparent', textAlign: 'left', cursor: 'pointer' }}>
                    <span className="faq-q-text" style={{ fontWeight: '600', fontSize: '14px', color: '#0D1E4A', lineHeight: '1.4' }}>{faq.q}</span>
                    <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: openFaq === i ? '#1B3F92' : '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.2s', transform: openFaq === i ? 'rotate(45deg)' : 'none', color: openFaq === i ? '#fff' : '#1B3F92', fontSize: '17px' }}>+</div>
                  </button>
                  {openFaq === i && (
                    <div id={`faq-answer-${i}`} style={{ padding: '0 18px 16px', color: '#64748B', fontSize: '14px', lineHeight: '1.7', borderTop: '1px solid #E2E8F0' }}>
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
                style={{ display: 'inline-block', background: '#1B3F92', color: '#fff', borderRadius: '13px', padding: '13px 28px', fontWeight: '800', fontSize: '14px', textDecoration: 'none', boxShadow: '0 8px 28px rgba(27,63,146,0.24)', transition: 'all 0.2s' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '7px' }}><MessageCircle size={17} aria-hidden="true" /> WhatsAppта суроо берүү</span>
              </a>
            </div>
          </Reveal>
        </div>
      </div>

      {/* FINAL CTA */}
      <div className="s-pad section-pad-lg" style={{ padding: '72px 32px', background: '#1B3F92', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '500px', height: '500px', background: 'radial-gradient(circle,rgba(255,255,255,0.07) 0%,transparent 70%)', pointerEvents: 'none' }} />
        <Reveal>
          <div style={{ maxWidth: '560px', margin: '0 auto', textAlign: 'center', position: 'relative', zIndex: 1 }}>
            <div style={{ marginBottom: '20px', animation: 'wobble 3s ease infinite', display: 'flex', justifyContent: 'center' }}><Rocket size={48} strokeWidth={1.8} aria-hidden="true" style={{ color: '#fff' }} /></div>
            <h2 style={{ fontSize: 'clamp(26px,4vw,44px)', fontWeight: '900', letterSpacing: '-1.5px', marginBottom: '14px', lineHeight: '1.1', color: '#fff' }}>
              Келечегиңди<br /><span style={{ color: '#BFDBFE' }}>бүгүн баштагыз</span>
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.72)', marginBottom: '28px', fontSize: '15px', lineHeight: '1.7' }}>
              Биз менен ЖРТга даяр болуңуз. Орундар чектелүү.
            </p>
            <div className="cta-final-btns" style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <a href={wa} target="_blank" rel="noopener noreferrer" className="cta-btn"
                style={{ background: '#fff', color: '#1B3F92', borderRadius: '14px', padding: '15px 36px', fontWeight: '900', fontSize: '15px', textDecoration: 'none', boxShadow: '0 10px 36px rgba(0,0,0,0.18)', transition: 'all 0.2s', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                <MessageCircle size={18} aria-hidden="true" /> Жазылуу
              </a>
              <a href={PLATFORM_LOGIN_HREF} className="cta-btn"
                style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '14px', padding: '15px 36px', fontWeight: '700', fontSize: '15px', textDecoration: 'none', transition: 'all 0.2s', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                <LogIn size={18} aria-hidden="true" /> Кирүү
              </a>
            </div>
          </div>
        </Reveal>
      </div>

      <MarketingFooter />
    </main>
  )
}
