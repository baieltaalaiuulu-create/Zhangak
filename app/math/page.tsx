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
    <div ref={ref} style={{
      opacity: inView ? 1 : 0,
      transform: inView ? 'translateY(0)' : 'translateY(32px)',
      transition: `opacity 0.7s cubic-bezier(.22,1,.36,1) ${delay}ms, transform 0.7s cubic-bezier(.22,1,.36,1) ${delay}ms`,
    }}>
      {children}
    </div>
  )
}

const GRADES = [
  {
    grade: '6-класс',
    color: '#3B82F6',
    bg: '#EFF6FF',
    topics: ['Бөлчөктөр жана аралаш сандар', 'Пайыздар', 'Координаттык түз сызык', 'Теңдемелер', 'Геометрия негиздери'],
  },
  {
    grade: '7-класс',
    color: '#1B4FD8',
    bg: '#EEF2FF',
    topics: ['Алгебралык туюнтмалар', 'Сызыктуу теңдемелер', 'Статистика', 'Үчбурчтук', 'Параллель түз сызыктар'],
    featured: true,
  },
  {
    grade: '8-класс',
    color: '#7C3AED',
    bg: '#F5F3FF',
    topics: ['Квадраттык теңдемелер', 'Функциялар жана графиктер', 'Квадраттык тамыр', 'Теорема Пифагора', 'Координаттык плоскость'],
  },
]

const WHY = [
  { icon: '🏗️', title: 'Күчтүү фундамент', desc: 'Математиканын базасын бекем өздөштүрүү — жогорку класстарда жана ЖРТда жеңүүнүн ачкычы.' },
  { icon: '🧠', title: 'Логикалык ой жүгүртүү', desc: 'Математика болгону эсептөө эмес — ал дүйнөнү туура талдоого үйрөтөт.' },
  { icon: '📈', title: 'Мектептеги баалар', desc: 'Курстан кийин окуучулардын математикадан баалары жогорулайт.' },
  { icon: '🎯', title: 'ЖРТга даярдык', desc: '8-класстан баштап ЖРТнын математика бөлүмүнө даярдануу — убакытты туура пайдалануу.' },
]

const HOW = [
  { n: '01', title: 'Деңгээлди аныктайбыз', desc: 'Башталганда кичинекей тест аркылуу балдардын учурдагы деңгээлин аныктайбыз.' },
  { n: '02', title: 'Топко бөлөбүз', desc: 'Класска жана деңгээлге жараша — кыргыз же орус тилинде топтор бар.' },
  { n: '03', title: 'Практика 80%', desc: 'Теория аз — практика көп. Ар бир сабакта маселелерди чечүүгө машыгабыз.' },
  { n: '04', title: 'Прогрессти байкайбыз', desc: 'Ата-эне ар дайым баланын прогрессин биле алат — биз туруктуу байланышта болобуз.' },
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

  const wa = 'https://wa.me/708584613'
  const navScrolled = scrollY > 40

  return (
    <div style={{ background: '#FFFFFF', minHeight: '100vh', fontFamily: 'Inter, -apple-system, sans-serif', color: '#0D1E4A', overflowX: 'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; }
        @keyframes slideUp { from{opacity:0;transform:translateY(40px)} to{opacity:1;transform:translateY(0)} }
        @keyframes gradientShift { 0%,100%{background-position:0% 50%} 50%{background-position:100% 50%} }
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
        @keyframes bounceIn { 0%{transform:scale(0.3);opacity:0} 50%{transform:scale(1.05)} 70%{transform:scale(0.95)} 100%{transform:scale(1);opacity:1} }
        .cta-btn:hover { transform:scale(1.04) !important; filter:brightness(1.08) !important; }
        .grade-card:hover { transform:translateY(-6px) !important; box-shadow:0 20px 48px rgba(27,79,216,0.12) !important; }
        .nav-link:hover { color:#1B4FD8 !important; }
        .faq-row:hover { background:#F8FAFF !important; }
        .why-card:hover { border-color:#BFDBFE !important; transform:translateY(-4px) !important; }
        @media(max-width:768px){
          .nav-links{display:none !important}
          .section-pad{padding-left:20px !important;padding-right:20px !important}
          .hero-title{font-size:36px !important}
          .grades-grid{grid-template-columns:1fr !important}
          .why-grid{grid-template-columns:1fr 1fr !important}
          .how-grid{grid-template-columns:1fr !important}
        }
      `}</style>

      {/* BANNER */}
      <div style={{ background: 'linear-gradient(90deg,#1B4FD8,#3B82F6,#7C3AED,#1B4FD8)', backgroundSize: '300% 100%', animation: 'gradientShift 5s ease infinite', padding: '10px 20px', textAlign: 'center', fontSize: '13px', fontWeight: '700', color: '#fff' }}>
        📐 Жаңгак Math — 6-7-8 класстар үчүн математика курсу · Бишкек · Онлайн/Оффлайн
        <a href={wa} target="_blank" rel="noopener noreferrer" style={{ color: '#fff', marginLeft: '14px', background: 'rgba(255,255,255,0.2)', padding: '3px 12px', borderRadius: '20px', fontWeight: '800', textDecoration: 'none' }}>Жазылуу →</a>
      </div>

      {/* NAVBAR */}
      <nav className="section-pad" style={{ background: navScrolled ? 'rgba(255,255,255,0.97)' : 'transparent', backdropFilter: navScrolled ? 'blur(20px)' : 'none', borderBottom: navScrolled ? '1px solid #E2E8F0' : 'none', padding: '0 60px', height: '68px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 200, transition: 'all 0.3s ease' }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '36px', height: '36px', background: '#1B4FD8', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <img src="/images/logo.png" alt="Zhangak" style={{ width: '36px', height: '36px', objectFit: 'cover', borderRadius: '8px' }} />
          </div>
          <div>
            <span style={{ fontWeight: '900', fontSize: '18px', color: '#0D1E4A', letterSpacing: '-0.5px' }}>Zhangak</span>
            <span style={{ fontWeight: '800', fontSize: '13px', color: '#1B4FD8', marginLeft: '6px', background: '#EEF2FF', padding: '2px 8px', borderRadius: '6px' }}>Math</span>
          </div>
        </div>

        {/* Product switcher */}
        <div style={{ display: 'flex', background: '#F1F5F9', borderRadius: '12px', padding: '4px', gap: '4px' }}>
          <button onClick={() => router.push('/')}
            style={{ padding: '7px 16px', borderRadius: '9px', border: 'none', fontSize: '13px', fontWeight: '600', cursor: 'pointer', background: 'transparent', color: '#64748B' }}>
            ЖРТ
          </button>
          <button style={{ padding: '7px 16px', borderRadius: '9px', border: 'none', fontSize: '13px', fontWeight: '700', cursor: 'pointer', background: '#1B4FD8', color: '#fff' }}>
            Math
          </button>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => setShowLogin(true)} style={{ background: '#F8FAFF', color: '#0D1E4A', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '9px 18px', fontWeight: '600', fontSize: '13px', cursor: 'pointer' }}>Кирүү</button>
          <a href={wa} target="_blank" rel="noopener noreferrer" className="cta-btn"
            style={{ background: '#1B4FD8', color: '#fff', borderRadius: '10px', padding: '9px 18px', fontWeight: '800', fontSize: '13px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.25s', boxShadow: '0 4px 16px rgba(27,79,216,0.3)' }}>
            📲 Жазылуу
          </a>
        </div>
      </nav>

      {/* HERO */}
      <div style={{ position: 'relative', overflow: 'hidden', background: 'linear-gradient(160deg,#FFFFFF 0%,#EFF6FF 50%,#EEF2FF 100%)', padding: '100px 60px 80px' }}>
        {/* Декоративные элементы */}
        <div style={{ position: 'absolute', top: '10%', right: '5%', fontSize: '120px', opacity: 0.04, fontWeight: '900', color: '#1B4FD8', pointerEvents: 'none', animation: 'float 6s ease infinite' }}>∑</div>
        <div style={{ position: 'absolute', bottom: '10%', left: '3%', fontSize: '80px', opacity: 0.04, fontWeight: '900', color: '#7C3AED', pointerEvents: 'none', animation: 'float 8s 2s ease infinite' }}>π</div>
        <div style={{ position: 'absolute', top: '40%', right: '15%', fontSize: '60px', opacity: 0.04, fontWeight: '900', color: '#1B4FD8', pointerEvents: 'none', animation: 'float 7s 1s ease infinite' }}>√</div>

        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '60px', alignItems: 'center', position: 'relative', zIndex: 1 }}>
          {/* LEFT */}
          <div style={{ animation: 'slideUp 0.8s cubic-bezier(.22,1,.36,1) both' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#EEF2FF', border: '1px solid #BFDBFE', borderRadius: '20px', padding: '8px 16px', marginBottom: '28px' }}>
              <span>📐</span>
              <span style={{ color: '#1B4FD8', fontSize: '13px', fontWeight: '700' }}>6 · 7 · 8-класстар үчүн</span>
            </div>
            <h1 className="hero-title" style={{ fontSize: 'clamp(36px,4.5vw,60px)', fontWeight: '900', lineHeight: '1.05', marginBottom: '24px', letterSpacing: '-2px', color: '#0D1E4A' }}>
              Математика —<br />
              <span style={{ color: '#1B4FD8' }}>келечектин</span><br />
              <span style={{ color: '#7C3AED' }}>тили.</span>
            </h1>
            <p style={{ color: '#64748B', fontSize: '16px', lineHeight: '1.8', marginBottom: '36px', maxWidth: '440px' }}>
              Жаңгак Math — 6-7-8 класс окуучулары үчүн математиканын бекем фундаментин куруучу курс. Жаңыча методика, практика 80%, кыргыз жана орус тилдеринде.
            </p>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <a href={wa} target="_blank" rel="noopener noreferrer" className="cta-btn"
                style={{ background: '#1B4FD8', color: '#fff', borderRadius: '14px', padding: '15px 32px', fontWeight: '900', fontSize: '15px', textDecoration: 'none', boxShadow: '0 8px 32px rgba(27,79,216,0.3)', transition: 'all 0.25s' }}>
                📲 Жазылуу
              </a>
              <a href="#grades" className="cta-btn"
                style={{ background: '#F8FAFF', color: '#0D1E4A', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '15px 32px', fontWeight: '700', fontSize: '15px', textDecoration: 'none', transition: 'all 0.25s' }}>
                Курстар →
              </a>
            </div>
            {/* Mini stats */}
            <div style={{ display: 'flex', gap: '32px', marginTop: '44px', paddingTop: '36px', borderTop: '1px solid #E2E8F0', flexWrap: 'wrap' }}>
              {[{ n: '6–8', l: 'Класстар' }, { n: '80%', l: 'Практика' }, { n: '2', l: 'Тил' }].map(s => (
                <div key={s.l}>
                  <div style={{ fontWeight: '900', fontSize: '24px', color: '#1B4FD8', letterSpacing: '-0.5px' }}>{s.n}</div>
                  <div style={{ color: '#94A3B8', fontSize: '11px', marginTop: '4px' }}>{s.l}</div>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT — visual */}
          <div style={{ animation: 'slideUp 0.8s 0.2s cubic-bezier(.22,1,.36,1) both' }}>
            <div style={{ background: 'linear-gradient(135deg,#050C1F,#0D1E4A)', borderRadius: '28px', padding: '40px', position: 'relative', overflow: 'hidden', boxShadow: '0 32px 80px rgba(27,79,216,0.25)' }}>
              {/* Glow */}
              <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: '200px', height: '200px', background: 'radial-gradient(circle,rgba(27,79,216,0.4) 0%,transparent 70%)', pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', bottom: '-40px', left: '-40px', width: '150px', height: '150px', background: 'radial-gradient(circle,rgba(124,58,237,0.3) 0%,transparent 70%)', pointerEvents: 'none' }} />

              <div style={{ position: 'relative', zIndex: 1 }}>
                <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', fontWeight: '600', marginBottom: '24px', letterSpacing: '1px', textTransform: 'uppercase' }}>Бир сабак ичинде</div>

                {[
                  { step: '01', text: 'Теориялык блок — 20 мин', done: true },
                  { step: '02', text: 'Мисалдарды чогуу чечебиз', done: true },
                  { step: '03', text: 'Өз алдынча практика', done: true },
                  { step: '04', text: 'Тест жана жыйынтык', done: false },
                ].map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: item.done ? '#1B4FD8' : 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '800', color: '#fff', flexShrink: 0 }}>
                      {item.done ? '✓' : item.step}
                    </div>
                    <span style={{ fontSize: '14px', color: item.done ? '#fff' : 'rgba(255,255,255,0.5)', fontWeight: item.done ? '600' : '400' }}>{item.text}</span>
                  </div>
                ))}

                <div style={{ marginTop: '28px', padding: '16px', background: 'rgba(27,79,216,0.3)', borderRadius: '14px', border: '1px solid rgba(27,79,216,0.5)' }}>
                  <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginBottom: '8px' }}>Ар бир сабак боюнча тема</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {['Алгебра', 'Геометрия', 'Статистика', 'Функциялар'].map(t => (
                      <span key={t} style={{ background: 'rgba(255,255,255,0.1)', color: '#93C5FD', fontSize: '12px', fontWeight: '600', padding: '4px 10px', borderRadius: '8px' }}>{t}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* WHY MATH */}
      <div className="section-pad" style={{ padding: '80px 60px', background: '#F8FAFF' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <Reveal>
            <div style={{ textAlign: 'center', marginBottom: '56px' }}>
              <p style={{ color: '#94A3B8', fontSize: '12px', fontWeight: '700', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '16px' }}>Эмүчүн</p>
              <h2 style={{ fontSize: 'clamp(26px,3.5vw,40px)', fontWeight: '900', letterSpacing: '-1.5px', color: '#0D1E4A' }}>
                Математика — бул <span style={{ color: '#1B4FD8' }}>инвестиция</span>
              </h2>
            </div>
          </Reveal>
          <div className="why-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '16px' }}>
            {WHY.map((w, i) => (
              <Reveal key={i} delay={i * 80}>
                <div className="why-card" style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '20px', padding: '24px', height: '100%', transition: 'all 0.3s ease' }}>
                  <div style={{ fontSize: '32px', marginBottom: '16px' }}>{w.icon}</div>
                  <div style={{ fontWeight: '800', fontSize: '15px', color: '#0D1E4A', marginBottom: '10px', lineHeight: '1.3' }}>{w.title}</div>
                  <div style={{ fontSize: '13px', color: '#64748B', lineHeight: '1.7' }}>{w.desc}</div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>

      {/* GRADES */}
      <div id="grades" className="section-pad" style={{ padding: '80px 60px', background: '#fff' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <Reveal>
            <div style={{ textAlign: 'center', marginBottom: '56px' }}>
              <p style={{ color: '#94A3B8', fontSize: '12px', fontWeight: '700', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '16px' }}>Программа</p>
              <h2 style={{ fontSize: 'clamp(26px,3.5vw,40px)', fontWeight: '900', letterSpacing: '-1.5px', color: '#0D1E4A' }}>
                Ар бир класс үчүн <span style={{ color: '#1B4FD8' }}>өзүнчө программа</span>
              </h2>
            </div>
          </Reveal>
          <div className="grades-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '20px' }}>
            {GRADES.map((g, i) => (
              <Reveal key={i} delay={i * 100}>
                <div className="grade-card" style={{ background: g.featured ? g.bg : '#FAFBFF', border: g.featured ? `2px solid ${g.color}` : '1px solid #E2E8F0', borderRadius: '24px', overflow: 'hidden', height: '100%', transition: 'all 0.35s ease', boxShadow: g.featured ? `0 8px 32px ${g.color}22` : 'none', position: 'relative' }}>
                  {g.featured && <div style={{ position: 'absolute', top: '16px', right: '16px', background: g.color, color: '#fff', fontSize: '10px', fontWeight: '900', padding: '4px 12px', borderRadius: '20px' }}>⭐ Популярдуу</div>}
                  <div style={{ height: '4px', background: `linear-gradient(90deg,${g.color},transparent)` }} />
                  <div style={{ padding: '28px' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                      <span style={{ background: `${g.color}22`, color: g.color, borderRadius: '10px', padding: '6px 16px', fontSize: '14px', fontWeight: '900' }}>{g.grade}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '28px' }}>
                      {g.topics.map((t, j) => (
                        <div key={j} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ width: '20px', height: '20px', background: `${g.color}18`, borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: g.color }} />
                          </div>
                          <span style={{ fontSize: '13px', color: '#475569' }}>{t}</span>
                        </div>
                      ))}
                    </div>
                    <a href={wa} target="_blank" rel="noopener noreferrer" className="cta-btn"
                      style={{ display: 'block', textAlign: 'center', background: g.color, color: '#fff', borderRadius: '12px', padding: '13px 22px', fontSize: '13px', fontWeight: '800', textDecoration: 'none', transition: 'all 0.25s', boxShadow: `0 4px 16px ${g.color}33` }}>
                      📲 Жазылуу
                    </a>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>

      {/* HOW IT WORKS */}
      <div className="section-pad" style={{ padding: '80px 60px', background: '#F8FAFF' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <Reveal>
            <div style={{ textAlign: 'center', marginBottom: '56px' }}>
              <p style={{ color: '#94A3B8', fontSize: '12px', fontWeight: '700', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '16px' }}>Процесс</p>
              <h2 style={{ fontSize: 'clamp(26px,3.5vw,40px)', fontWeight: '900', letterSpacing: '-1.5px', color: '#0D1E4A' }}>
                Кантип иштейбиз
              </h2>
            </div>
          </Reveal>
          <div className="how-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '20px' }}>
            {HOW.map((h, i) => (
              <Reveal key={i} delay={i * 80}>
                <div style={{ position: 'relative' }}>
                  {i < HOW.length - 1 && (
                    <div style={{ position: 'absolute', top: '20px', left: 'calc(100% - 10px)', width: '20px', height: '2px', background: '#BFDBFE', zIndex: 0 }} />
                  )}
                  <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '20px', padding: '24px', position: 'relative', zIndex: 1 }}>
                    <div style={{ width: '40px', height: '40px', background: '#1B4FD8', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: '900', fontSize: '14px', marginBottom: '16px' }}>{h.n}</div>
                    <div style={{ fontWeight: '800', fontSize: '15px', color: '#0D1E4A', marginBottom: '8px' }}>{h.title}</div>
                    <div style={{ fontSize: '13px', color: '#64748B', lineHeight: '1.7' }}>{h.desc}</div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>

      {/* FAQ */}
      <div className="section-pad" style={{ padding: '80px 60px', background: '#fff' }}>
        <div style={{ maxWidth: '860px', margin: '0 auto' }}>
          <Reveal>
            <div style={{ textAlign: 'center', marginBottom: '48px' }}>
              <h2 style={{ fontSize: 'clamp(26px,3.5vw,40px)', fontWeight: '900', letterSpacing: '-1.5px', color: '#0D1E4A' }}>
                Көп берилүүчү <span style={{ color: '#F59E0B' }}>суроолор</span>
              </h2>
            </div>
          </Reveal>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {FAQS.map((faq, i) => (
              <Reveal key={i} delay={i * 50}>
                <div className="faq-row" style={{ background: openFaq === i ? '#F0F5FF' : '#FAFBFF', border: openFaq === i ? '1px solid #BFDBFE' : '1px solid #E2E8F0', borderRadius: '16px', overflow: 'hidden', transition: 'all 0.25s', cursor: 'pointer' }} onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', gap: '16px' }}>
                    <span style={{ fontWeight: '600', fontSize: '14px', color: '#0D1E4A' }}>{faq.q}</span>
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
        </div>
      </div>

      {/* CTA */}
      <div className="section-pad" style={{ padding: '100px 60px', background: '#1B4FD8', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '500px', height: '500px', background: 'radial-gradient(circle,rgba(255,255,255,0.06) 0%,transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: '10%', right: '5%', fontSize: '200px', opacity: 0.04, fontWeight: '900', color: '#fff', pointerEvents: 'none' }}>∑</div>
        <Reveal>
          <div style={{ maxWidth: '600px', margin: '0 auto', textAlign: 'center', position: 'relative', zIndex: 1 }}>
            <div style={{ fontSize: '48px', marginBottom: '20px' }}>📐</div>
            <h2 style={{ fontSize: 'clamp(28px,4vw,44px)', fontWeight: '900', letterSpacing: '-1.5px', marginBottom: '16px', color: '#fff', lineHeight: '1.1' }}>
              Балаңыздын<br />
              <span style={{ color: '#BFDBFE' }}>математикасын бекемдейли</span>
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.7)', marginBottom: '36px', fontSize: '15px', lineHeight: '1.7' }}>
              Жазылуу үчүн WhatsAppка жазыңыз — биз байланышып, бардык маалыматты беребиз.
            </p>
            <a href={wa} target="_blank" rel="noopener noreferrer" className="cta-btn"
              style={{ display: 'inline-block', background: '#fff', color: '#1B4FD8', borderRadius: '16px', padding: '17px 48px', fontWeight: '900', fontSize: '16px', textDecoration: 'none', boxShadow: '0 12px 40px rgba(0,0,0,0.2)', transition: 'all 0.25s' }}>
              📲 WhatsAppка жазуу
            </a>
          </div>
        </Reveal>
      </div>

      {/* FOOTER */}
      <div className="section-pad" style={{ background: '#0D3BAE', padding: '24px 60px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '28px', height: '28px', background: 'rgba(255,255,255,0.15)', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img src="/images/logo.png" alt="Zhangak" style={{ width: '28px', height: '28px', objectFit: 'cover', borderRadius: '6px' }} />
          </div>
          <span style={{ fontWeight: '900', fontSize: '14px', color: '#fff' }}>Zhangak</span>
          <span style={{ fontWeight: '800', fontSize: '12px', color: '#93C5FD', background: 'rgba(147,197,253,0.15)', padding: '2px 8px', borderRadius: '6px' }}>Math</span>
        </div>
        <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: '12px' }}>© 2025 Жангак Math</div>
        <a href={wa} target="_blank" rel="noopener noreferrer" style={{ color: '#93C5FD', fontSize: '13px', textDecoration: 'none', fontWeight: '600' }}>📲 +996 708 584 613</a>
      </div>{showLogin && (
  <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(16px)', padding: '20px' }}
    onClick={e => { if (e.target === e.currentTarget) setShowLogin(false) }}>
    <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '28px', padding: '44px', width: '100%', maxWidth: '420px', position: 'relative', boxShadow: '0 24px 80px rgba(0,0,0,0.2)' }}>
      <button onClick={() => setShowLogin(false)} style={{ position: 'absolute', top: '18px', right: '18px', background: '#F8FAFF', border: '1px solid #E2E8F0', width: '32px', height: '32px', borderRadius: '50%', fontSize: '15px', cursor: 'pointer', color: '#64748B' }}>✕</button>
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <div style={{ width: '44px', height: '44px', background: '#1B4FD8', borderRadius: '12px', margin: '0 auto 14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <img src="/images/logo.png" alt="Z" style={{ width: '44px', height: '44px', objectFit: 'cover', borderRadius: '12px' }} />
        </div>
        <div style={{ fontWeight: '900', fontSize: '22px', color: '#0D1E4A' }}>Кирүү</div>
        <div style={{ color: '#94A3B8', fontSize: '13px', marginTop: '6px' }}>Жангак Math системасына</div>
      </div>
      <form onSubmit={async e => {
        e.preventDefault(); setLoginLoading(true); setLoginError('')
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
      }} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div>
          <label style={{ fontSize: '12px', fontWeight: '600', color: '#64748B', display: 'block', marginBottom: '7px' }}>Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@gmail.com" required style={{ width: '100%', padding: '13px 16px', borderRadius: '12px', border: '1px solid #E2E8F0', fontSize: '15px', outline: 'none', color: '#0D1E4A', background: '#FAFBFF', boxSizing: 'border-box' as const }} />
        </div>
        <div>
          <label style={{ fontSize: '12px', fontWeight: '600', color: '#64748B', display: 'block', marginBottom: '7px' }}>Сырсөз</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required style={{ width: '100%', padding: '13px 16px', borderRadius: '12px', border: '1px solid #E2E8F0', fontSize: '15px', outline: 'none', color: '#0D1E4A', background: '#FAFBFF', boxSizing: 'border-box' as const }} />
        </div>
        {loginError && <div style={{ background: '#FEF2F2', color: '#EF4444', padding: '11px 14px', borderRadius: '10px', fontSize: '13px', textAlign: 'center' }}>{loginError}</div>}
        <button type="submit" disabled={loginLoading} style={{ background: '#1B4FD8', color: '#fff', border: 'none', borderRadius: '12px', padding: '15px', fontWeight: '900', fontSize: '16px', cursor: 'pointer', marginTop: '4px' }}>
          {loginLoading ? 'Кирүүдө...' : 'Кирүү →'}
        </button>
      </form>
    </div>
  </div>
)}
    </div>
  )
}