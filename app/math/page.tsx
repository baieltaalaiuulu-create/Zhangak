'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

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

function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const [ref, inView] = useInView()
  return (
    <div ref={ref} style={{ opacity: inView ? 1 : 0, transform: inView ? 'translateY(0)' : 'translateY(24px)', transition: `opacity 0.6s cubic-bezier(.22,1,.36,1) ${delay}ms, transform 0.6s cubic-bezier(.22,1,.36,1) ${delay}ms` }}>
      {children}
    </div>
  )
}

const GRADES = [
  { grade: '6-класс', color: '#3B82F6', bg: '#EFF6FF', topics: ['Бөлчөктөр жана аралаш сандар', 'Пайыздар', 'Координаттык түз сызык', 'Теңдемелер', 'Геометрия негиздери'] },
  { grade: '7-класс', color: '#1B4FD8', bg: '#EEF2FF', topics: ['Алгебралык туюнтмалар', 'Сызыктуу теңдемелер', 'Статистика', 'Үчбурчтук', 'Параллель түз сызыктар'], featured: true },
  { grade: '8-класс', color: '#7C3AED', bg: '#F5F3FF', topics: ['Квадраттык теңдемелер', 'Функциялар жана графиктер', 'Квадраттык тамыр', 'Теорема Пифагора', 'Координаттык плоскость'] },
]

const WHY = [
  { icon: '🏗️', title: 'Күчтүү фундамент', desc: 'Математиканын базасын бекем өздөштүрүү — жогорку класстарда жеңүүнүн ачкычы.' },
  { icon: '🧠', title: 'Логикалык ой', desc: 'Математика болгону эсептөө эмес — дүйнөнү туура талдоого үйрөтөт.' },
  { icon: '📈', title: 'Мектептеги баалар', desc: 'Курстан кийин математикадан баалары жогорулайт.' },
  { icon: '🎯', title: 'ЖРТга даярдык', desc: '8-класстан баштап ЖРТнын математика бөлүмүнө даярдануу.' },
]

const HOW = [
  { n: '01', title: 'Деңгээлди аныктайбыз', desc: 'Кичинекей тест аркылуу балдардын деңгээлин аныктайбыз.' },
  { n: '02', title: 'Топко бөлөбүз', desc: 'Класска жана деңгээлге жараша — кыргыз же орус тилинде.' },
  { n: '03', title: 'Практика 80%', desc: 'Теория аз — практика көп. Ар бир сабакта масележерди чечебиз.' },
  { n: '04', title: 'Прогрессти байкайбыз', desc: 'Ата-эне баланын прогрессин ар дайым биле алат.' },
]

const FAQS = [
  { q: 'Кайсы класстар үчүн?', a: '6, 7 жана 8-класстын окуучулары үчүн.' },
  { q: 'Онлайн же оффлайн?', a: 'Эки форматта тең: оффлайн — Бишкек, онлайн — Кыргызстандын каалаган жеринен.' },
  { q: 'Кыргыз тилинде сабак барбы?', a: 'Ооба, кыргыз жана орус тилдеринде топтор бар.' },
  { q: 'Курс канча убакытка созулат?', a: 'Академиялык жыл бою — сентябрдан майга чейин. Жайкы интенсив да бар.' },
  { q: 'Баа канча?', a: 'Баа жөнүндө WhatsAppта сурасаңыз болот — топко жана форматка жараша айырмаланат.' },
]

export default function MathPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [showLogin, setShowLogin] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  const [loginError, setLoginError] = useState('')
  const [scrollY, setScrollY] = useState(0)
  const router = useRouter()

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => { if (scrollY > 10) setMenuOpen(false) }, [scrollY])

  const wa = 'https://wa.me/996708584613'
  const navScrolled = scrollY > 40

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginLoading(true); setLoginError('')
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setLoginError('Туура эмес email же сырсөз'); setLoginLoading(false); return }
    const { data: prof } = await supabase.from('profiles').select('role').eq('id', data.user.id).single()
    const role = prof?.role
    if (role === 'math_admin') router.push('/math/admin')
    else if (role === 'math_parent') router.push('/math/parent')
    else if (role === 'math_student') router.push('/math/student')
    else if (role === 'admin') router.push('/admin')
    else if (role === 'student') router.push('/student')
    else router.push('/math/student')
  }

  return (
    <div style={{ background: '#fff', minHeight: '100vh', fontFamily: 'Inter, -apple-system, sans-serif', color: '#0D1E4A', overflowX: 'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        @keyframes gradientShift{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}
        @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
        @keyframes slideDown{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}
        .cta-btn:active{transform:scale(0.97)!important}
        @media(hover:hover){.cta-btn:hover{transform:scale(1.03)!important;filter:brightness(1.06)!important}}
        @media(hover:hover){.grade-card:hover{transform:translateY(-4px)!important;box-shadow:0 16px 40px rgba(27,79,216,0.12)!important}}
        @media(hover:hover){.why-card:hover{border-color:#BFDBFE!important}}
        @media(hover:hover){.faq-row:hover{background:#F8FAFF!important}}

        @media(max-width:640px){
          .banner-text-extra{display:none}
          .hero-grid{grid-template-columns:1fr!important;gap:32px!important;padding:60px 20px 48px!important}
          .hero-right{display:none!important}
          .hero-title{font-size:36px!important;letter-spacing:-1px!important}
          .hero-desc{font-size:15px!important}
          .hero-btns{flex-direction:column!important;gap:10px!important}
          .hero-btns a,.hero-btns button{width:100%!important;text-align:center!important;justify-content:center!important}
          .mini-stats{gap:20px!important;margin-top:28px!important;padding-top:24px!important}
          .section-inner{padding:56px 20px!important}
          .why-grid{grid-template-columns:1fr 1fr!important;gap:12px!important}
          .why-card{padding:18px!important}
          .why-icon{font-size:24px!important;margin-bottom:10px!important}
          .why-title{font-size:13px!important}
          .why-desc{font-size:12px!important}
          .grades-grid{grid-template-columns:1fr!important;gap:14px!important}
          .how-grid{grid-template-columns:1fr 1fr!important;gap:12px!important}
          .how-card{padding:18px!important}
          .how-connector{display:none!important}
          .faq-q{font-size:13px!important;padding:16px 18px!important}
          .faq-a{padding:0 18px 16px!important;font-size:13px!important}
          .cta-section{padding:64px 20px!important}
          .cta-title{font-size:28px!important}
          .footer-inner{flex-direction:column!important;align-items:flex-start!important;gap:10px!important;padding:20px!important}
          .nav-desktop{display:none!important}
          .nav-mobile-btn{display:flex!important}
          .nav-inner{padding:0 16px!important;height:60px!important}
          .switcher{display:none!important}
        }
        @media(min-width:641px){
          .nav-mobile-btn{display:none!important}
          .mobile-menu{display:none!important}
          .hero-right{display:block!important}
        }
        @media(min-width:641px) and (max-width:900px){
          .hero-grid{grid-template-columns:1fr!important;gap:32px!important;padding:72px 32px 56px!important}
          .hero-right{display:none!important}
          .section-inner{padding:64px 32px!important}
          .why-grid{grid-template-columns:1fr 1fr!important}
          .how-grid{grid-template-columns:1fr 1fr!important}
          .grades-grid{grid-template-columns:1fr!important}
        }
      `}</style>

      {/* BANNER */}
      <div style={{ background: 'linear-gradient(90deg,#1B4FD8,#3B82F6,#7C3AED,#1B4FD8)', backgroundSize: '300% 100%', animation: 'gradientShift 5s ease infinite', padding: '9px 16px', textAlign: 'center', fontSize: '12px', fontWeight: '700', color: '#fff' }}>
        📐 Жаңгак Math — 6-7-8 класстар үчүн
        <span className="banner-text-extra"> · Бишкек · Онлайн/Оффлайн</span>
        <a href={wa} target="_blank" rel="noopener noreferrer" style={{ color: '#fff', marginLeft: '10px', background: 'rgba(255,255,255,0.22)', padding: '3px 10px', borderRadius: '20px', fontWeight: '800', textDecoration: 'none', fontSize: '11px' }}>Жазылуу →</a>
      </div>

      {/* NAVBAR */}
      <nav style={{ background: navScrolled ? 'rgba(255,255,255,0.97)' : 'transparent', backdropFilter: navScrolled ? 'blur(20px)' : 'none', borderBottom: navScrolled ? '1px solid #E2E8F0' : 'none', position: 'sticky', top: 0, zIndex: 200, transition: 'all 0.3s ease' }}>
        <div className="nav-inner" style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 32px', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <div style={{ width: '34px', height: '34px', background: '#1B4FD8', borderRadius: '8px', overflow: 'hidden', flexShrink: 0 }}>
              <img src="/images/logo.png" alt="Z" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <span style={{ fontWeight: '900', fontSize: '17px', color: '#0D1E4A' }}>Zhangak</span>
            <span style={{ fontWeight: '800', fontSize: '12px', color: '#1B4FD8', background: '#EEF2FF', padding: '2px 7px', borderRadius: '6px' }}>Math</span>
          </div>

          <div className="nav-desktop" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="switcher" style={{ display: 'flex', background: '#F1F5F9', borderRadius: '12px', padding: '4px', gap: '4px' }}>
              <button onClick={() => router.push('/')} style={{ padding: '6px 14px', borderRadius: '9px', border: 'none', fontSize: '13px', fontWeight: '600', cursor: 'pointer', background: 'transparent', color: '#64748B' }}>ЖРТ</button>
              <button style={{ padding: '6px 14px', borderRadius: '9px', border: 'none', fontSize: '13px', fontWeight: '700', cursor: 'pointer', background: '#1B4FD8', color: '#fff' }}>Math</button>
            </div>
            <button onClick={() => setShowLogin(true)} style={{ background: '#F8FAFF', color: '#0D1E4A', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '8px 16px', fontWeight: '600', fontSize: '13px', cursor: 'pointer' }}>Кирүү</button>
            <a href={wa} target="_blank" rel="noopener noreferrer" className="cta-btn" style={{ background: '#1B4FD8', color: '#fff', borderRadius: '10px', padding: '8px 16px', fontWeight: '800', fontSize: '13px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '5px', transition: 'all 0.2s', boxShadow: '0 4px 14px rgba(27,79,216,0.3)' }}>
              📲 Жазылуу
            </a>
          </div>

          <button className="nav-mobile-btn" onClick={() => setMenuOpen(p => !p)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'none', flexDirection: 'column', gap: '5px', padding: '8px' }}>
            <div style={{ width: '22px', height: '2px', background: '#0D1E4A', borderRadius: '2px', transition: 'all 0.2s', transform: menuOpen ? 'rotate(45deg) translateY(7px)' : 'none' }} />
            <div style={{ width: '22px', height: '2px', background: '#0D1E4A', borderRadius: '2px', opacity: menuOpen ? 0 : 1, transition: 'all 0.2s' }} />
            <div style={{ width: '22px', height: '2px', background: '#0D1E4A', borderRadius: '2px', transition: 'all 0.2s', transform: menuOpen ? 'rotate(-45deg) translateY(-7px)' : 'none' }} />
          </button>
        </div>

        {menuOpen && (
          <div className="mobile-menu" style={{ background: '#fff', borderTop: '1px solid #E2E8F0', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '10px', animation: 'slideDown 0.2s ease' }}>
            <div style={{ display: 'flex', background: '#F1F5F9', borderRadius: '12px', padding: '4px', gap: '4px' }}>
              <button onClick={() => { router.push('/'); setMenuOpen(false) }} style={{ flex: 1, padding: '9px', borderRadius: '9px', border: 'none', fontSize: '14px', fontWeight: '600', cursor: 'pointer', background: 'transparent', color: '#64748B' }}>ЖРТ</button>
              <button style={{ flex: 1, padding: '9px', borderRadius: '9px', border: 'none', fontSize: '14px', fontWeight: '700', cursor: 'pointer', background: '#1B4FD8', color: '#fff' }}>Math</button>
            </div>
            <button onClick={() => { setShowLogin(true); setMenuOpen(false) }} style={{ width: '100%', background: '#F8FAFF', color: '#0D1E4A', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '13px', fontWeight: '600', fontSize: '14px', cursor: 'pointer' }}>Кирүү</button>
            <a href={wa} target="_blank" rel="noopener noreferrer" className="cta-btn" style={{ display: 'block', textAlign: 'center', background: '#1B4FD8', color: '#fff', borderRadius: '12px', padding: '13px', fontWeight: '800', fontSize: '14px', textDecoration: 'none', boxShadow: '0 4px 14px rgba(27,79,216,0.3)' }}>
              📲 WhatsAppка жазылуу
            </a>
          </div>
        )}
      </nav>

      {/* HERO */}
      <div style={{ background: 'linear-gradient(160deg,#fff 0%,#EFF6FF 50%,#EEF2FF 100%)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '8%', right: '4%', fontSize: '100px', opacity: 0.04, fontWeight: '900', color: '#1B4FD8', pointerEvents: 'none', animation: 'float 6s ease infinite' }}>∑</div>
        <div style={{ position: 'absolute', bottom: '8%', left: '2%', fontSize: '70px', opacity: 0.04, fontWeight: '900', color: '#7C3AED', pointerEvents: 'none', animation: 'float 8s 2s ease infinite' }}>π</div>

        <div className="hero-grid section-inner" style={{ maxWidth: '1200px', margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '48px', alignItems: 'center', padding: '88px 32px 72px', position: 'relative', zIndex: 1 }}>
          {/* Left */}
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#EEF2FF', border: '1px solid #BFDBFE', borderRadius: '20px', padding: '7px 14px', marginBottom: '24px' }}>
              <span style={{ fontSize: '14px' }}>📐</span>
              <span style={{ color: '#1B4FD8', fontSize: '13px', fontWeight: '700' }}>6 · 7 · 8-класстар үчүн</span>
            </div>
            <h1 className="hero-title" style={{ fontSize: 'clamp(32px,5vw,58px)', fontWeight: '900', lineHeight: '1.07', marginBottom: '20px', letterSpacing: '-2px', color: '#0D1E4A' }}>
              Математика —<br />
              <span style={{ color: '#1B4FD8' }}>келечектин</span><br />
              <span style={{ color: '#7C3AED' }}>тили.</span>
            </h1>
            <p className="hero-desc" style={{ color: '#64748B', fontSize: '16px', lineHeight: '1.8', marginBottom: '28px' }}>
              Жаңгак Math — 6-7-8 класс окуучулары үчүн математиканын бекем фундаментин куруучу курс. Жаңыча методика, практика 80%, кыргыз жана орус тилдеринде.
            </p>
            <div className="hero-btns" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <a href={wa} target="_blank" rel="noopener noreferrer" className="cta-btn"
                style={{ background: '#1B4FD8', color: '#fff', borderRadius: '14px', padding: '14px 28px', fontWeight: '900', fontSize: '15px', textDecoration: 'none', boxShadow: '0 8px 28px rgba(27,79,216,0.3)', transition: 'all 0.2s', display: 'inline-block' }}>
                📲 Жазылуу
              </a>
              <a href="#grades" className="cta-btn"
                style={{ background: '#F8FAFF', color: '#0D1E4A', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '14px 28px', fontWeight: '700', fontSize: '15px', textDecoration: 'none', transition: 'all 0.2s', display: 'inline-block' }}>
                Курстар →
              </a>
            </div>
            <div className="mini-stats" style={{ display: 'flex', gap: '28px', marginTop: '36px', paddingTop: '28px', borderTop: '1px solid #E2E8F0', flexWrap: 'wrap' }}>
              {[{ n: '6–8', l: 'Класстар' }, { n: '80%', l: 'Практика' }, { n: '2', l: 'Тил' }].map(s => (
                <div key={s.l}>
                  <div style={{ fontWeight: '900', fontSize: '22px', color: '#1B4FD8', letterSpacing: '-0.5px' }}>{s.n}</div>
                  <div style={{ color: '#94A3B8', fontSize: '11px', marginTop: '3px' }}>{s.l}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right — dark card */}
          <div className="hero-right">
            <div style={{ background: 'linear-gradient(135deg,#050C1F,#0D1E4A)', borderRadius: '24px', padding: '36px', position: 'relative', overflow: 'hidden', boxShadow: '0 28px 72px rgba(27,79,216,0.22)' }}>
              <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: '180px', height: '180px', background: 'radial-gradient(circle,rgba(27,79,216,0.4) 0%,transparent 70%)', pointerEvents: 'none' }} />
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', fontWeight: '600', marginBottom: '20px', letterSpacing: '1px', textTransform: 'uppercase' as const }}>Бир сабак ичинде</div>
                {[
                  { step: '01', text: 'Теориялык блок — 20 мин', done: true },
                  { step: '02', text: 'Мисалдарды чогуу чечебиз', done: true },
                  { step: '03', text: 'Өз алдынча практика', done: true },
                  { step: '04', text: 'Тест жана жыйынтык', done: false },
                ].map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                    <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: item.done ? '#1B4FD8' : 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '800', color: '#fff', flexShrink: 0 }}>
                      {item.done ? '✓' : item.step}
                    </div>
                    <span style={{ fontSize: '13px', color: item.done ? '#fff' : 'rgba(255,255,255,0.45)', fontWeight: item.done ? '600' : '400' }}>{item.text}</span>
                  </div>
                ))}
                <div style={{ marginTop: '24px', padding: '14px', background: 'rgba(27,79,216,0.3)', borderRadius: '12px', border: '1px solid rgba(27,79,216,0.5)' }}>
                  <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.55)', marginBottom: '8px' }}>Ар бир сабак боюнча тема</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {['Алгебра', 'Геометрия', 'Статистика', 'Функциялар'].map(t => (
                      <span key={t} style={{ background: 'rgba(255,255,255,0.1)', color: '#93C5FD', fontSize: '11px', fontWeight: '600', padding: '3px 9px', borderRadius: '7px' }}>{t}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* WHY */}
      <div style={{ background: '#F8FAFF' }}>
        <div className="section-inner" style={{ maxWidth: '1200px', margin: '0 auto', padding: '72px 32px' }}>
          <Reveal>
            <div style={{ textAlign: 'center', marginBottom: '44px' }}>
              <p style={{ color: '#94A3B8', fontSize: '11px', fontWeight: '700', letterSpacing: '2px', textTransform: 'uppercase' as const, marginBottom: '12px' }}>Эмүчүн</p>
              <h2 style={{ fontSize: 'clamp(24px,3.5vw,38px)', fontWeight: '900', letterSpacing: '-1px', color: '#0D1E4A' }}>
                Математика — бул <span style={{ color: '#1B4FD8' }}>инвестиция</span>
              </h2>
            </div>
          </Reveal>
          <div className="why-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '14px' }}>
            {WHY.map((w, i) => (
              <Reveal key={i} delay={i * 70}>
                <div className="why-card" style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '18px', padding: '22px', height: '100%', transition: 'all 0.3s' }}>
                  <div className="why-icon" style={{ fontSize: '28px', marginBottom: '12px' }}>{w.icon}</div>
                  <div className="why-title" style={{ fontWeight: '800', fontSize: '14px', color: '#0D1E4A', marginBottom: '8px', lineHeight: '1.3' }}>{w.title}</div>
                  <div className="why-desc" style={{ fontSize: '13px', color: '#64748B', lineHeight: '1.65' }}>{w.desc}</div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>

      {/* GRADES */}
      <div id="grades" style={{ background: '#fff' }}>
        <div className="section-inner" style={{ maxWidth: '1200px', margin: '0 auto', padding: '72px 32px' }}>
          <Reveal>
            <div style={{ textAlign: 'center', marginBottom: '44px' }}>
              <p style={{ color: '#94A3B8', fontSize: '11px', fontWeight: '700', letterSpacing: '2px', textTransform: 'uppercase' as const, marginBottom: '12px' }}>Программа</p>
              <h2 style={{ fontSize: 'clamp(24px,3.5vw,38px)', fontWeight: '900', letterSpacing: '-1px', color: '#0D1E4A' }}>
                Ар бир класс үчүн <span style={{ color: '#1B4FD8' }}>өзүнчө программа</span>
              </h2>
            </div>
          </Reveal>
          <div className="grades-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '16px' }}>
            {GRADES.map((g, i) => (
              <Reveal key={i} delay={i * 90}>
                <div className="grade-card" style={{ background: g.featured ? g.bg : '#FAFBFF', border: g.featured ? `2px solid ${g.color}` : '1px solid #E2E8F0', borderRadius: '22px', overflow: 'hidden', height: '100%', transition: 'all 0.3s', boxShadow: g.featured ? `0 6px 28px ${g.color}22` : 'none', position: 'relative' }}>
                  {g.featured && <div style={{ position: 'absolute', top: '14px', right: '14px', background: g.color, color: '#fff', fontSize: '10px', fontWeight: '900', padding: '3px 10px', borderRadius: '20px' }}>⭐ Популярдуу</div>}
                  <div style={{ height: '4px', background: `linear-gradient(90deg,${g.color},transparent)` }} />
                  <div style={{ padding: '24px' }}>
                    <span style={{ background: `${g.color}22`, color: g.color, borderRadius: '8px', padding: '5px 14px', fontSize: '13px', fontWeight: '900', display: 'inline-block', marginBottom: '18px' }}>{g.grade}</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '9px', marginBottom: '22px' }}>
                      {g.topics.map((t, j) => (
                        <div key={j} style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                          <div style={{ width: '18px', height: '18px', background: `${g.color}18`, borderRadius: '5px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: g.color }} />
                          </div>
                          <span style={{ fontSize: '13px', color: '#475569' }}>{t}</span>
                        </div>
                      ))}
                    </div>
                    <a href={wa} target="_blank" rel="noopener noreferrer" className="cta-btn"
                      style={{ display: 'block', textAlign: 'center', background: g.color, color: '#fff', borderRadius: '11px', padding: '12px', fontSize: '13px', fontWeight: '800', textDecoration: 'none', transition: 'all 0.2s', boxShadow: `0 4px 14px ${g.color}33` }}>
                      📲 Жазылуу
                    </a>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>

      {/* HOW */}
      <div style={{ background: '#F8FAFF' }}>
        <div className="section-inner" style={{ maxWidth: '1200px', margin: '0 auto', padding: '72px 32px' }}>
          <Reveal>
            <div style={{ textAlign: 'center', marginBottom: '44px' }}>
              <p style={{ color: '#94A3B8', fontSize: '11px', fontWeight: '700', letterSpacing: '2px', textTransform: 'uppercase' as const, marginBottom: '12px' }}>Процесс</p>
              <h2 style={{ fontSize: 'clamp(24px,3.5vw,38px)', fontWeight: '900', letterSpacing: '-1px', color: '#0D1E4A' }}>Кантип иштейбиз</h2>
            </div>
          </Reveal>
          <div className="how-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '14px' }}>
            {HOW.map((h, i) => (
              <Reveal key={i} delay={i * 70}>
                <div style={{ position: 'relative' }}>
                  {i < HOW.length - 1 && (
                    <div className="how-connector" style={{ position: 'absolute', top: '20px', left: 'calc(100% - 7px)', width: '14px', height: '2px', background: '#BFDBFE', zIndex: 0 }} />
                  )}
                  <div className="how-card" style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '18px', padding: '22px', position: 'relative', zIndex: 1 }}>
                    <div style={{ width: '38px', height: '38px', background: '#1B4FD8', borderRadius: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: '900', fontSize: '13px', marginBottom: '14px' }}>{h.n}</div>
                    <div style={{ fontWeight: '800', fontSize: '14px', color: '#0D1E4A', marginBottom: '7px' }}>{h.title}</div>
                    <div style={{ fontSize: '12px', color: '#64748B', lineHeight: '1.65' }}>{h.desc}</div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>

      {/* FAQ */}
      <div style={{ background: '#fff' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '72px 20px' }}>
          <Reveal>
            <div style={{ textAlign: 'center', marginBottom: '40px' }}>
              <h2 style={{ fontSize: 'clamp(24px,3.5vw,38px)', fontWeight: '900', letterSpacing: '-1px', color: '#0D1E4A' }}>
                Көп берилүүчү <span style={{ color: '#F59E0B' }}>суроолор</span>
              </h2>
            </div>
          </Reveal>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {FAQS.map((faq, i) => (
              <Reveal key={i} delay={i * 40}>
                <div className="faq-row" style={{ background: openFaq === i ? '#F0F5FF' : '#FAFBFF', border: `1px solid ${openFaq === i ? '#BFDBFE' : '#E2E8F0'}`, borderRadius: '14px', overflow: 'hidden', transition: 'all 0.2s', cursor: 'pointer' }} onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                  <div className="faq-q" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px', gap: '12px' }}>
                    <span style={{ fontWeight: '600', fontSize: '14px', color: '#0D1E4A' }}>{faq.q}</span>
                    <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: openFaq === i ? '#1B4FD8' : '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.2s', transform: openFaq === i ? 'rotate(45deg)' : 'none', color: openFaq === i ? '#fff' : '#1B4FD8', fontSize: '17px' }}>+</div>
                  </div>
                  {openFaq === i && (
                    <div className="faq-a" style={{ padding: '0 20px 18px', color: '#64748B', fontSize: '14px', lineHeight: '1.7', borderTop: '1px solid #E2E8F0' }}>
                      <div style={{ paddingTop: '14px' }}>{faq.a}</div>
                    </div>
                  )}
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="cta-section" style={{ background: '#1B4FD8', padding: '88px 20px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '10%', right: '5%', fontSize: '160px', opacity: 0.04, fontWeight: '900', color: '#fff', pointerEvents: 'none' }}>∑</div>
        <Reveal>
          <div style={{ maxWidth: '560px', margin: '0 auto', textAlign: 'center', position: 'relative', zIndex: 1 }}>
            <div style={{ fontSize: '44px', marginBottom: '16px' }}>📐</div>
            <h2 className="cta-title" style={{ fontSize: 'clamp(26px,4vw,42px)', fontWeight: '900', letterSpacing: '-1px', marginBottom: '14px', color: '#fff', lineHeight: '1.1' }}>
              Балаңыздын<br /><span style={{ color: '#BFDBFE' }}>математикасын бекемдейли</span>
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.7)', marginBottom: '28px', fontSize: '15px', lineHeight: '1.7' }}>
              Жазылуу үчүн WhatsAppка жазыңыз — биз байланышып, бардык маалыматты беребиз.
            </p>
            <a href={wa} target="_blank" rel="noopener noreferrer" className="cta-btn"
              style={{ display: 'inline-block', background: '#fff', color: '#1B4FD8', borderRadius: '14px', padding: '15px 40px', fontWeight: '900', fontSize: '15px', textDecoration: 'none', boxShadow: '0 10px 36px rgba(0,0,0,0.18)', transition: 'all 0.2s' }}>
              📲 WhatsAppка жазуу
            </a>
          </div>
        </Reveal>
      </div>

      {/* FOOTER */}
      <div style={{ background: '#0D3BAE' }}>
        <div className="footer-inner" style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '26px', height: '26px', background: 'rgba(255,255,255,0.15)', borderRadius: '6px', overflow: 'hidden' }}>
              <img src="/images/logo.png" alt="Z" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <span style={{ fontWeight: '900', fontSize: '14px', color: '#fff' }}>Zhangak</span>
            <span style={{ fontWeight: '800', fontSize: '11px', color: '#93C5FD', background: 'rgba(147,197,253,0.15)', padding: '2px 7px', borderRadius: '5px' }}>Math</span>
          </div>
          <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>© 2025 Жангак Math</div>
          <a href={wa} target="_blank" rel="noopener noreferrer" style={{ color: '#93C5FD', fontSize: '13px', textDecoration: 'none', fontWeight: '600' }}>📲 +996 708 584 613</a>
        </div>
      </div>

      {/* LOGIN MODAL */}
      {showLogin && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(12px)', padding: '16px' }}
          onClick={e => { if (e.target === e.currentTarget) setShowLogin(false) }}>
          <div style={{ background: '#fff', borderRadius: '24px', padding: '36px 28px', width: '100%', maxWidth: '400px', position: 'relative', boxShadow: '0 20px 72px rgba(0,0,0,0.2)' }}>
            <button onClick={() => setShowLogin(false)} style={{ position: 'absolute', top: '16px', right: '16px', background: '#F8FAFF', border: '1px solid #E2E8F0', width: '30px', height: '30px', borderRadius: '50%', fontSize: '14px', cursor: 'pointer', color: '#64748B' }}>✕</button>
            <div style={{ textAlign: 'center', marginBottom: '28px' }}>
              <div style={{ width: '42px', height: '42px', background: '#1B4FD8', borderRadius: '11px', margin: '0 auto 12px', overflow: 'hidden' }}>
                <img src="/images/logo.png" alt="Z" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              <div style={{ fontWeight: '900', fontSize: '20px', color: '#0D1E4A' }}>Кирүү</div>
              <div style={{ color: '#94A3B8', fontSize: '13px', marginTop: '4px' }}>Жангак Math системасына</div>
            </div>
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: '600', color: '#64748B', display: 'block', marginBottom: '6px' }}>Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@gmail.com" required
                  style={{ width: '100%', padding: '13px 14px', borderRadius: '11px', border: '1px solid #E2E8F0', fontSize: '15px', outline: 'none', color: '#0D1E4A', background: '#FAFBFF', boxSizing: 'border-box' as const }} />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: '600', color: '#64748B', display: 'block', marginBottom: '6px' }}>Сырсөз</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required
                  style={{ width: '100%', padding: '13px 14px', borderRadius: '11px', border: '1px solid #E2E8F0', fontSize: '15px', outline: 'none', color: '#0D1E4A', background: '#FAFBFF', boxSizing: 'border-box' as const }} />
              </div>
              {loginError && <div style={{ background: '#FEF2F2', color: '#EF4444', padding: '10px 14px', borderRadius: '10px', fontSize: '13px', textAlign: 'center' }}>{loginError}</div>}
              <button type="submit" disabled={loginLoading}
                style={{ background: '#1B4FD8', color: '#fff', border: 'none', borderRadius: '12px', padding: '14px', fontWeight: '900', fontSize: '15px', cursor: 'pointer', marginTop: '4px' }}>
                {loginLoading ? 'Кирүүдө...' : 'Кирүү →'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}