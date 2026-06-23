'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

function useInView() {
  const ref = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setInView(true) }, { threshold: 0.1 })
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [])
  return [ref, inView] as const
}

function Animate({ children, delay = 0 }: { children: React.ReactNode, delay?: number }) {
  const [ref, inView] = useInView()
  return (
    <div ref={ref} style={{
      opacity: inView ? 1 : 0,
      transform: inView ? 'translateY(0)' : 'translateY(32px)',
      transition: `opacity 0.6s ease ${delay}ms, transform 0.6s ease ${delay}ms`
    }}>
      {children}
    </div>
  )
}

export default function LandingPage() {
  const [showLogin, setShowLogin] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 })
  const router = useRouter()

  useEffect(() => {
    const target = new Date('2027-05-17T09:00:00')
    const interval = setInterval(() => {
      const now = new Date()
      const diff = target.getTime() - now.getTime()
      if (diff <= 0) { clearInterval(interval); return }
      setTimeLeft({
        days: Math.floor(diff / (1000 * 60 * 60 * 24 * 30)),
        hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000),
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError('Неверный email или пароль'); setLoading(false); return }
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).single()
    if (!profile) { router.push('/admin'); return }
    if (profile.role === 'admin') router.push('/admin')
    else if (profile.role === 'teacher') router.push('/teacher')
    else router.push('/student')
  }

  const whatsapp = 'https://wa.me/996502077326'
  const BLUE = '#2563EB'
  const DARK = '#0D1E4A'

  const results = [
    { img: '/images/result4.png', name: 'Уланбекова Каныкей', score: 221 },
    { img: '/images/result3.png', name: 'Тилекова Акмарал', score: 211 },
    { img: '/images/result1.png', name: 'Шарифжанов Мухаммадзаир', score: 204 },
    { img: '/images/result2.png', name: 'Журсунова Нурзат', score: 202 },
  ]

  const reviews = [
    { name: 'Айбек С.', score: 180, before: 110, text: 'Курска чейин математиканы такыр түшүнбөй, 110 балл алчумун. Жангакта 3 ай окугандан кийин 180 балл алдым.', emoji: '🎯' },
    { name: 'Нурайым К.', score: 195, before: 140, text: 'Аналогияларды эч качан түшүнбөй келдим. Жангакта конкреттүү стратегияларды үйрөндүм. 195 балл алдым!', emoji: '⭐' },
    { name: 'Тимур А.', score: 188, before: 125, text: '3 сааттык сабак чарчатпайт, анткени аралыкта оюн убактысы бар. Менин баллым 125тен 188ге чыкты.', emoji: '🚀' },
    { name: 'Зарина М.', score: 204, before: 155, text: 'Геометрия темасы мен үчүн абдан кыйын болчу. Жангактын мугалими толук түшүндүрдү. 204 балл алдым!', emoji: '💪' },
    { name: 'Бекзат Р.', score: 176, before: 108, text: 'Башында деңгээлим абдан начар болчу. B1 курсунан баштап акырындап өстүм. 176 балл алып медицинага кирдим.', emoji: '🏆' },
    { name: 'Айгерим Т.', score: 192, before: 148, text: 'Жангактагы онлайн тесттер абдан пайдалуу! Үйдө да машыгып прогрессими байкап отурдум. 192 балл!', emoji: '✨' },
  ]

  const faqs = [
    { q: '📚 Кайсы предметтер курска кирет?', a: 'Математика, Аналогиялар, Текст түшүнүү, Кыргыз тили грамматикасы — ЖРТнын бардык 4 бөлүмү.' },
    { q: '🏆 Жангактын жетишкендиктери кандай?', a: '220+ окуучу 190 балдан ашык алды. Эң жогорку натыйжа — 221 балл. Окуучулардын 80%ы максаттуу университетке кирди.' },
    { q: '🎓 Кайсы класстын окуучулары жазыла алат?', a: '10 жана 11-класстын окуучулары. ЖРТга кайра даярданып жаткандар да жазыла алат.' },
    { q: '💰 Курс канча турат?', a: 'B1 — 4 500 сом/ай, B2 — 5 000 сом/ай, C1 — 5 500 сом/ай. Жайкы интенсив — 7 000 сом.' },
    { q: '📍 Курс онлайн же оффлайн?', a: 'Оффлайн — Бишкек, Горький көчөсү 108. Онлайн платформа жакында ишке киргизилет.' },
    { q: '⏱ Бир сабак канча убакыт?', a: '3 саат: Математика 50 мин + Кыргыз тили 50 мин + Чтение 50 мин + 20 мин оюн убактысы.' },
  ]

  const pains = [
    { icon: '🚀', title: 'ЖРТдан жогорку балл алгың келеби?', desc: 'Бирок кантип жана кайда даярданууну билбейсиңби?' },
    { icon: '🧮', title: 'Математиканы түшүнбөйсүңбү?', desc: 'Маселелерди чече албай жооптарды туш-тушка белгилейсиңби?' },
    { icon: '❗', title: 'Аналогияларды чечкенде?', desc: 'Бир нече туура жооп бардай сезилеби?' },
    { icon: '⏳', title: 'Убакытты туура пайдалана билбейсиңби?', desc: 'Убакыт абдан тез өтөт жана үлгүрбөйсүңбү?' },
    { icon: '🤔', title: 'Кайсы курсту тандоону билбейсиңби?', desc: 'Курстар көп, кайсынысы чынында жогорку балл берет?' },
    { icon: '😔', title: 'Деңгээлим начар деп ойлойсуңбу?', desc: 'Жана жогорку балл алууга үмүтүңдү үздүңбү?' },
  ]

  return (
    <div style={{background:DARK, minHeight:'100vh', fontFamily:'Inter, sans-serif', color:'#fff', overflowX:'hidden'}}>

      {/* SUMMER BANNER */}
      <div style={{background:'linear-gradient(90deg,#F59E0B,#EF4444)', padding:'10px 20px', textAlign:'center', fontSize:'13px', fontWeight:'700'}}>
        🔥 ЖАЙКЫ ЖРТ ИНТЕНСИВИ 2026 — 1-июлдан башталат · Баасы 7 000 сом · Белек: Алматыга саякат ✈️
        <a href={whatsapp} target="_blank" rel="noopener noreferrer" style={{color:'#fff', marginLeft:'12px', textDecoration:'underline', fontWeight:'800'}}>Жазылуу →</a>
      </div>

      {/* NAVBAR */}
      <nav className="nav-pad" style={{background:DARK, borderBottom:'1px solid rgba(255,255,255,0.08)', padding:'0 60px', height:'68px', display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:100}}>
        <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
          <img src="/images/logo.png" alt="Zhangak" style={{width:'36px', height:'36px', objectFit:'contain', filter:'brightness(0) invert(1)'}} />
          <span style={{fontWeight:'900', fontSize:'20px', letterSpacing:'-0.5px'}}>Zhangak</span>
        </div>
        <div className="nav-links" style={{display:'flex', gap:'28px'}}>
          {[{l:'Курстар',h:'#courses'},{l:'Натыйжалар',h:'#results'},{l:'Программа',h:'#program'},{l:'FAQ',h:'#faq'},{l:'Офис',h:'#office'}].map(i=>(
            <a key={i.l} href={i.h} style={{color:'rgba(255,255,255,0.6)',fontSize:'14px',textDecoration:'none',fontWeight:'500'}}>{i.l}</a>
          ))}
        </div>
        <div style={{display:'flex', gap:'8px'}}>
          <button onClick={()=>setShowLogin(true)} style={{background:'rgba(255,255,255,0.08)',color:'#fff',border:'1px solid rgba(255,255,255,0.15)',borderRadius:'10px',padding:'9px 18px',fontWeight:'600',fontSize:'13px',cursor:'pointer'}}>
            Кирүү
          </button>
          <a href={whatsapp} target="_blank" rel="noopener noreferrer" style={{background:BLUE,color:'#fff',borderRadius:'10px',padding:'9px 18px',fontWeight:'800',fontSize:'13px',textDecoration:'none',display:'flex',alignItems:'center',gap:'5px'}}>
            📲 Жазылуу
          </a>
        </div>
      </nav>

      {/* SUMMER INTENSIVE CARD */}
      <div className="section-pad" style={{padding:'32px 60px', background:DARK}}>
        <Animate>
          <div style={{maxWidth:'1200px', margin:'0 auto', background:'linear-gradient(135deg,#F59E0B22,#EF444422)', border:'1px solid rgba(245,158,11,0.4)', borderRadius:'24px', padding:'32px 40px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:'24px', flexWrap:'wrap'}}>
            <div>
              <div style={{display:'inline-flex', alignItems:'center', gap:'8px', background:'rgba(245,158,11,0.2)', border:'1px solid rgba(245,158,11,0.4)', borderRadius:'20px', padding:'6px 14px', marginBottom:'16px'}}>
                <span style={{color:'#F59E0B', fontSize:'13px', fontWeight:'700'}}>🔥 ЖАЙКЫ ИНТЕНСИВ 2026</span>
              </div>
              <h3 style={{fontSize:'clamp(18px,3vw,26px)', fontWeight:'900', marginBottom:'12px', lineHeight:'1.2'}}>
                1 айда ЖРТга даярдан жана<br/>
                <span style={{color:'#F59E0B'}}>Алматыга 1 күндүк саякатка бар! ✈️🇰🇿</span>
              </h3>
              <div style={{display:'flex', gap:'20px', flexWrap:'wrap'}}>
                {[
                  {icon:'📅', text:'1-июлдан'},
                  {icon:'🕙', text:'10:00–12:50'},
                  {icon:'📍', text:'Горький 108'},
                  {icon:'💰', text:'7 000 сом'},
                ].map(i=>(
                  <div key={i.text} style={{display:'flex', alignItems:'center', gap:'6px', fontSize:'13px', color:'rgba(255,255,255,0.8)'}}>
                    <span>{i.icon}</span><span>{i.text}</span>
                  </div>
                ))}
              </div>
              <div style={{display:'flex', gap:'12px', marginTop:'20px', flexWrap:'wrap'}}>
                {['✅ 20% теория, 80% практика', '🎮 KAHOOT жана оюндар', '📝 Сынамык ЖРТ'].map(f=>(
                  <div key={f} style={{fontSize:'12px', color:'rgba(255,255,255,0.7)', background:'rgba(255,255,255,0.06)', borderRadius:'8px', padding:'5px 10px'}}>{f}</div>
                ))}
              </div>
            </div>
            <a href={whatsapp} target="_blank" rel="noopener noreferrer"
              style={{background:'linear-gradient(135deg,#F59E0B,#EF4444)', color:'#fff', borderRadius:'14px', padding:'16px 32px', fontWeight:'900', fontSize:'16px', textDecoration:'none', display:'inline-block', flexShrink:0, textAlign:'center', whiteSpace:'nowrap'}}>
              📲 Азыр жазылуу<br/>
              <span style={{fontSize:'12px', fontWeight:'600', opacity:0.9}}>Орундар чектелүү!</span>
            </a>
          </div>
        </Animate>
      </div>

      {/* HERO */}
      <div className="section-pad hero-grid" style={{padding:'80px 60px 60px', maxWidth:'1200px', margin:'0 auto', display:'flex', alignItems:'center', gap:'60px'}}>
        <div style={{flex:'1'}}>
          <Animate>
            <div style={{display:'inline-flex',alignItems:'center',gap:'8px',background:'rgba(37,99,235,0.25)',border:'1px solid rgba(37,99,235,0.5)',borderRadius:'20px',padding:'8px 16px',marginBottom:'24px'}}>
              <span>🏆</span>
              <span style={{color:'#93C5FD',fontSize:'13px',fontWeight:'700'}}>220+ ЖРТ жеңүүчүлөрү</span>
            </div>
          </Animate>
          <Animate delay={100}>
            <h1 className="hero-title" style={{fontSize:'clamp(36px,5vw,62px)',fontWeight:'900',lineHeight:'1.05',marginBottom:'20px',letterSpacing:'-2px'}}>
              ЖРТдан<br/>
              <span style={{color:'#60A5FA'}}>жогорку балл</span><br/>
              — сенин<br/>келечегиңдин<br/>ачкычы.
            </h1>
          </Animate>
          <Animate delay={200}>
            <p style={{color:'rgba(255,255,255,0.6)',fontSize:'16px',lineHeight:'1.8',marginBottom:'32px',maxWidth:'480px'}}>
              Жангак 10-11-класстын окуучуларын ЖРТга инновациялык методика менен даярдайт.
            </p>
            <div style={{display:'flex',gap:'12px',flexWrap:'wrap'}}>
              <a href={whatsapp} target="_blank" rel="noopener noreferrer" style={{background:BLUE,color:'#fff',borderRadius:'14px',padding:'15px 30px',fontWeight:'900',fontSize:'15px',textDecoration:'none',display:'inline-block'}}>
                📲 Жазылуу
              </a>
              <button onClick={()=>setShowLogin(true)} style={{background:'rgba(255,255,255,0.06)',color:'#fff',border:'1px solid rgba(255,255,255,0.15)',borderRadius:'14px',padding:'15px 30px',fontWeight:'600',fontSize:'15px',cursor:'pointer'}}>
                Кирүү →
              </button>
            </div>
          </Animate>
          <Animate delay={300}>
            <div style={{display:'flex',gap:'32px',marginTop:'40px',paddingTop:'40px',borderTop:'1px solid rgba(255,255,255,0.08)',flexWrap:'wrap'}}>
              {[{n:'220+',l:'ЖРТ жеңүүчүлөрү'},{n:'221',l:'Эң жогорку балл'},{n:'3',l:'Курс деңгээли'}].map(s=>(
                <div key={s.l}>
                  <div style={{fontWeight:'900',fontSize:'28px',color:'#60A5FA'}}>{s.n}</div>
                  <div style={{color:'rgba(255,255,255,0.5)',fontSize:'12px',marginTop:'4px'}}>{s.l}</div>
                </div>
              ))}
            </div>
          </Animate>
        </div>
        <div className="hero-images" style={{flex:'1'}}>
          <Animate delay={200}>
            <div style={{background:'rgba(37,99,235,0.15)',border:'1px solid rgba(37,99,235,0.3)',borderRadius:'24px',padding:'16px',display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px'}}>
              {results.map((r,i)=>(
                <div key={i} style={{position:'relative',borderRadius:'16px',overflow:'hidden',aspectRatio:'3/4'}}>
                  <img src={r.img} alt={r.name} style={{width:'100%',height:'100%',objectFit:'cover'}} />
                  <div style={{position:'absolute',bottom:0,left:0,right:0,background:'linear-gradient(to top,rgba(13,30,74,0.98) 0%,transparent 70%)',padding:'12px 10px 10px'}}>
                    <div style={{color:'#60A5FA',fontWeight:'900',fontSize:'16px'}}>{r.score} балл</div>
                    <div style={{color:'rgba(255,255,255,0.75)',fontSize:'10px',marginTop:'2px'}}>{r.name}</div>
                  </div>
                </div>
              ))}
            </div>
          </Animate>
        </div>
      </div>

      {/* TIMER */}
      <div className="section-pad" style={{background:DARK,padding:'56px 60px',textAlign:'center'}}>
        <Animate>
          <h2 style={{fontSize:'20px',fontWeight:'800',marginBottom:'32px',color:'rgba(255,255,255,0.9)'}}>⏰ ЖРТга чейин калды</h2>
          <div className="timer-grid" style={{display:'flex',gap:'12px',justifyContent:'center',flexWrap:'wrap',alignItems:'center'}}>
            {[
              {n:timeLeft.days,l:'Ай'},
              {n:timeLeft.hours,l:'Саат'},
              {n:timeLeft.minutes,l:'Мүнөт'},
              {n:timeLeft.seconds,l:'Секунд'},
            ].map((t,i)=>(
              <div key={i} style={{display:'flex',alignItems:'center',gap:'10px'}}>
                <div className="timer-box" style={{background:'rgba(255,255,255,0.15)',border:'1px solid rgba(255,255,255,0.25)',borderRadius:'16px',padding:'18px 24px',minWidth:'85px',textAlign:'center'}}>
                  <div className="timer-num" style={{fontWeight:'900',fontSize:'40px',lineHeight:'1',fontVariantNumeric:'tabular-nums'}}>
                    {String(t.n).padStart(2,'0')}
                  </div>
                  <div style={{color:'rgba(255,255,255,0.7)',fontSize:'11px',marginTop:'6px',fontWeight:'600'}}>{t.l}</div>
                </div>
                {i<3 && <span style={{fontSize:'24px',fontWeight:'900',opacity:0.5}}>:</span>}
              </div>
            ))}
          </div>
          <a href={whatsapp} target="_blank" rel="noopener noreferrer" style={{display:'inline-block',marginTop:'28px',background:'#fff',color:BLUE,borderRadius:'12px',padding:'12px 32px',fontWeight:'900',fontSize:'15px',textDecoration:'none'}}>
            Азыр жазылуу →
          </a>
        </Animate>
      </div>

      {/* PAINS — WHITE */}
      <div className="section-pad" style={{padding:'80px 60px',background:'#fff'}}>
        <div style={{maxWidth:'1200px',margin:'0 auto'}}>
          <Animate>
            <div style={{textAlign:'center',marginBottom:'48px'}}>
              <h2 style={{fontSize:'32px',fontWeight:'900',color:DARK,letterSpacing:'-1px',marginBottom:'10px'}}>
                Сен так натыйжа аласың —<br/>
                <span style={{color:BLUE}}>эгер сенде...</span>
              </h2>
            </div>
          </Animate>
          <div className="pains-grid" style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'16px'}}>
            {pains.map((p,i)=>(
              <Animate key={i} delay={i*80}>
                <div style={{background:'#F8FAFF',border:'1px solid #E8ECF4',borderRadius:'16px',padding:'24px',height:'100%'}}>
                  <div style={{fontSize:'28px',marginBottom:'12px'}}>{p.icon}</div>
                  <div style={{fontWeight:'700',fontSize:'15px',color:DARK,marginBottom:'8px',lineHeight:'1.4'}}>{p.title}</div>
                  <div style={{fontSize:'13px',color:'#64748B',lineHeight:'1.6'}}>{p.desc}</div>
                </div>
              </Animate>
            ))}
          </div>
          <Animate delay={200}>
            <div style={{textAlign:'center',marginTop:'36px'}}>
              <a href={whatsapp} target="_blank" rel="noopener noreferrer" style={{background:BLUE,color:'#fff',borderRadius:'14px',padding:'15px 40px',fontWeight:'900',fontSize:'16px',textDecoration:'none',display:'inline-block'}}>
                📲 Биз менен чечебиз →
              </a>
            </div>
          </Animate>
        </div>
      </div>

      {/* RESULTS */}
      <div id="results" className="section-pad" style={{padding:'80px 60px',background:DARK}}>
        <div style={{maxWidth:'1200px',margin:'0 auto'}}>
          <Animate>
            <div style={{textAlign:'center',marginBottom:'48px'}}>
              <div style={{display:'inline-flex',alignItems:'center',gap:'8px',background:'rgba(37,99,235,0.25)',border:'1px solid rgba(37,99,235,0.5)',borderRadius:'20px',padding:'8px 16px',marginBottom:'16px'}}>
                <span style={{color:'#93C5FD',fontSize:'13px',fontWeight:'700'}}>🏆 Биздин жеңүүчүлөр</span>
              </div>
              <h2 style={{fontSize:'32px',fontWeight:'900',letterSpacing:'-1px',marginBottom:'10px'}}>Натыйжалар</h2>
              <p style={{color:'rgba(255,255,255,0.5)',fontSize:'15px'}}>Биздин окуучулардын реалдуу ЖРТ баллдары</p>
            </div>
          </Animate>
          <div className="results-grid" style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'16px'}}>
            {results.map((r,i)=>(
              <Animate key={i} delay={i*100}>
                <div style={{position:'relative',borderRadius:'20px',overflow:'hidden',aspectRatio:'3/4'}}>
                  <img src={r.img} alt={r.name} style={{width:'100%',height:'100%',objectFit:'cover'}} />
                  <div style={{position:'absolute',bottom:0,left:0,right:0,background:'linear-gradient(to top,rgba(13,30,74,1) 0%,rgba(13,30,74,0.4) 60%,transparent 100%)',padding:'20px 14px 14px'}}>
                    <div style={{color:'#60A5FA',fontWeight:'900',fontSize:'20px'}}>{r.score} балл</div>
                    <div style={{color:'rgba(255,255,255,0.85)',fontSize:'11px',marginTop:'3px',fontWeight:'500'}}>{r.name}</div>
                  </div>
                </div>
              </Animate>
            ))}
          </div>
        </div>
      </div>

      {/* REVIEWS — WHITE */}
      <div className="section-pad" style={{padding:'80px 60px',background:'#fff'}}>
        <div style={{maxWidth:'1200px',margin:'0 auto'}}>
          <Animate>
            <div style={{textAlign:'center',marginBottom:'48px'}}>
              <div style={{display:'inline-flex',alignItems:'center',gap:'8px',background:'#EFF6FF',border:'1px solid #BFDBFE',borderRadius:'20px',padding:'8px 16px',marginBottom:'16px'}}>
                <span style={{color:BLUE,fontSize:'13px',fontWeight:'700'}}>⭐ Окуучулардын пикири</span>
              </div>
              <h2 style={{fontSize:'32px',fontWeight:'900',color:DARK,letterSpacing:'-1px',marginBottom:'10px'}}>Отзывдар</h2>
              <p style={{color:'#64748B',fontSize:'15px'}}>Биздин окуучулар эмне дейт</p>
            </div>
          </Animate>
          <div className="reviews-grid" style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'20px'}}>
            {reviews.map((r,i)=>(
              <Animate key={i} delay={i*80}>
                <div style={{background:'#F8FAFF',border:'1px solid #E8ECF4',borderRadius:'20px',padding:'24px',display:'flex',flexDirection:'column',gap:'14px',height:'100%'}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                    <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
                      <div style={{width:'42px',height:'42px',background:BLUE,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:'900',fontSize:'15px'}}>
                        {r.name[0]}
                      </div>
                      <div>
                        <div style={{fontWeight:'700',fontSize:'14px',color:DARK}}>{r.name}</div>
                        <div style={{fontSize:'12px',color:'#64748B',marginTop:'2px'}}>{r.before} → <span style={{color:BLUE,fontWeight:'700'}}>{r.score} балл</span></div>
                      </div>
                    </div>
                    <div style={{fontSize:'22px'}}>{r.emoji}</div>
                  </div>
                  <div style={{color:'#475569',fontSize:'13px',lineHeight:'1.7',fontStyle:'italic',flex:1}}>"{r.text}"</div>
                  <div>{'★★★★★'.split('').map((s,j)=><span key={j} style={{color:'#F59E0B',fontSize:'14px'}}>{s}</span>)}</div>
                </div>
              </Animate>
            ))}
          </div>
        </div>
      </div>

      {/* COURSES */}
      <div id="courses" className="section-pad" style={{padding:'80px 60px',background:DARK}}>
        <div style={{maxWidth:'1200px',margin:'0 auto'}}>
          <Animate>
            <div style={{textAlign:'center',marginBottom:'48px'}}>
              <h2 style={{fontSize:'32px',fontWeight:'900',letterSpacing:'-1px',marginBottom:'10px'}}>Курстар</h2>
              <p style={{color:'rgba(255,255,255,0.5)',fontSize:'15px'}}>3 деңгээл — башталгычтан финалга чейин</p>
            </div>
          </Animate>
          <div className="courses-grid" style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'20px'}}>
            {[
              {level:'B1',name:'Базовый курс',month:'1-ай',color:'#3B82F6',topics:['Арифметика','Лексика жана морфология','Базалык аналогиялар','Чтение негиздери'],price:'4 500 сом'},
              {level:'B2',name:'Продвинутый курс',month:'2-ай',color:'#60A5FA',topics:['Алгебра','Синтаксис жана аналогия','Функциялар','Окуу жана түшүнүү'],price:'5 000 сом'},
              {level:'C1',name:'Финальный курс',month:'3-ай',color:'#10B981',topics:['Геометрия','Грамматика жана чтение','Татаал аналогиялар','Толук ЖРТ форматы'],price:'5 500 сом'},
            ].map((c,i)=>(
              <Animate key={c.level} delay={i*100}>
                <div style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'20px',overflow:'hidden',height:'100%'}}>
                  <div style={{height:'3px',background:c.color}}></div>
                  <div style={{padding:'24px'}}>
                    <div style={{display:'inline-block',background:`${c.color}22`,color:c.color,borderRadius:'8px',padding:'4px 12px',fontSize:'12px',fontWeight:'800',marginBottom:'12px'}}>{c.level}</div>
                    <div style={{fontWeight:'900',fontSize:'20px',marginBottom:'4px'}}>{c.name}</div>
                    <div style={{color:'rgba(255,255,255,0.4)',fontSize:'13px',marginBottom:'20px'}}>{c.month}</div>
                    {c.topics.map(t=>(
                      <div key={t} style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'10px'}}>
                        <div style={{width:'5px',height:'5px',borderRadius:'50%',background:c.color,flexShrink:0}}></div>
                        <span style={{fontSize:'13px',color:'rgba(255,255,255,0.7)'}}>{t}</span>
                      </div>
                    ))}
                    <div style={{marginTop:'20px',paddingTop:'20px',borderTop:'1px solid rgba(255,255,255,0.06)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                      <span style={{fontWeight:'900',fontSize:'20px',color:c.color}}>{c.price}</span>
                      <a href={whatsapp} target="_blank" rel="noopener noreferrer" style={{background:c.color,color:'#fff',borderRadius:'10px',padding:'10px 18px',fontSize:'13px',fontWeight:'700',textDecoration:'none'}}>
                        Жазылуу
                      </a>
                    </div>
                  </div>
                </div>
              </Animate>
            ))}
          </div>
        </div>
      </div>

      {/* SUBJECTS — WHITE */}
      <div id="program" className="section-pad" style={{padding:'80px 60px',background:'#fff'}}>
        <div style={{maxWidth:'1200px',margin:'0 auto'}}>
          <Animate>
            <div style={{textAlign:'center',marginBottom:'48px'}}>
              <h2 style={{fontSize:'32px',fontWeight:'900',color:DARK,letterSpacing:'-1px',marginBottom:'10px'}}>Субъекттер</h2>
              <p style={{color:'#64748B',fontSize:'15px'}}>ЖРТнын бардык бөлүмдөрү боюнча даярдык</p>
            </div>
          </Animate>
          <div className="subjects-grid" style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(170px,1fr))',gap:'16px'}}>
            {[
              {icon:'📐',name:'Математика',desc:'Арифметика, алгебра, геометрия',color:'#2563EB'},
              {icon:'🔤',name:'Аналогиялар',desc:'Окшоштуктар, сүйлөмдөр',color:'#7C3AED'},
              {icon:'📖',name:'Текст түшүнүү',desc:'Окуу жана түшүнүү',color:'#059669'},
              {icon:'✍️',name:'Кыргыз тили',desc:'Грамматика жана пунктуация',color:'#D97706'},
              {icon:'🧠',name:'Орус тили',desc:'Орус тили боюнча даярдык',color:'#DC2626'},
              {icon:'⚡',name:'Логикалык ой',desc:'Логика жана жалпы жөндөм',color:'#7C3AED'},
            ].map((s,i)=>(
              <Animate key={s.name} delay={i*60}>
                <div style={{background:'#F8FAFF',border:'1px solid #E8ECF4',borderRadius:'16px',padding:'20px',textAlign:'center',height:'100%'}}>
                  <div style={{width:'48px',height:'48px',background:`${s.color}15`,borderRadius:'12px',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'22px',margin:'0 auto 12px'}}>{s.icon}</div>
                  <div style={{fontWeight:'700',fontSize:'13px',color:DARK,marginBottom:'6px'}}>{s.name}</div>
                  <div style={{fontSize:'11px',color:'#94A3B8',lineHeight:'1.5'}}>{s.desc}</div>
                </div>
              </Animate>
            ))}
          </div>
        </div>
      </div>

      {/* OFFICE — 2GIS MAP */}
  <div style={{display:'grid', gridTemplateColumns:'1fr 300px', gap:'20px', alignItems:'stretch'}}>
  {/* КАРТА */}
  <div style={{borderRadius:'20px', overflow:'hidden', border:'1px solid rgba(255,255,255,0.1)', minHeight:'300px'}}>
    <iframe
      src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d749.8!2d74.6048!3d42.8716!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x389ec85d12345678%3A0x0!2z0JPQvtGA0YzQutC40Lkg0YPQu9C40YbQsCwgMTA4LCDQkdC40YjQutC10Lo!5e0!3m2!1sru!2skg!4v1234567890!5m2!1sru!2skg"
      width="100%"
      height="300"
      style={{border:'none', display:'block'}}
      allowFullScreen
      loading="lazy"
      title="Жангак офиси"
    />
  </div>

  {/* ИНФО */}
  <div style={{background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'20px', padding:'28px', display:'flex', flexDirection:'column', gap:'20px'}}>
    <div>
      <div style={{fontWeight:'900', fontSize:'18px', marginBottom:'6px'}}>Жангак офиси</div>
      <div style={{color:'rgba(255,255,255,0.5)', fontSize:'13px'}}>Бишкек, Кыргызстан</div>
    </div>
    {[
      {icon:'📍', label:'Дарек', value:'Горький көчөсү, 108'},
      {icon:'🕙', label:'Иштөө убактысы', value:'Дүй–Иш: 9:00–19:00'},
      {icon:'📲', label:'Телефон', value:'+996 502 077 326'},
    ].map(i=>(
      <div key={i.label} style={{display:'flex', gap:'12px', alignItems:'flex-start'}}>
        <div style={{width:'36px', height:'36px', background:'rgba(37,99,235,0.2)', borderRadius:'10px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'16px', flexShrink:0}}>{i.icon}</div>
        <div>
          <div style={{fontSize:'11px', color:'rgba(255,255,255,0.4)', marginBottom:'2px'}}>{i.label}</div>
          <div style={{fontSize:'14px', fontWeight:'600'}}>{i.value}</div>
        </div>
      </div>
    ))}
    <a href="https://go.2gis.com/VQjcS" target="_blank" rel="noopener noreferrer"
      style={{background:BLUE, color:'#fff', borderRadius:'12px', padding:'12px 20px', fontWeight:'700', fontSize:'14px', textDecoration:'none', textAlign:'center', marginTop:'auto'}}>
      🗺 2GIS-те ачуу →
    </a>
  </div>
</div>
      {/* FAQ */}
      <div id="faq" className="section-pad" style={{padding:'80px 60px',background:'#fff'}}>
        <div style={{maxWidth:'900px',margin:'0 auto'}}>
          <div className="faq-layout" style={{display:'flex',gap:'60px',alignItems:'flex-start'}}>
            <Animate>
              <div style={{flex:'0 0 260px'}}>
                <h2 style={{fontSize:'32px',fontWeight:'900',lineHeight:'1.15',letterSpacing:'-1px',color:DARK}}>
                  Көп<br/>берилүүчү<br/>суроолор
                </h2>
                <p style={{color:'#64748B',fontSize:'14px',marginTop:'14px',lineHeight:'1.7'}}>Дагы суроолор барбы?</p>
                <a href={whatsapp} target="_blank" rel="noopener noreferrer" style={{display:'inline-block',marginTop:'16px',background:BLUE,color:'#fff',borderRadius:'10px',padding:'12px 24px',fontWeight:'700',fontSize:'14px',textDecoration:'none'}}>
                  📲 Суроо берүү
                </a>
              </div>
            </Animate>
            <div style={{flex:1}}>
              {faqs.map((faq,i)=>(
                <Animate key={i} delay={i*60}>
                  <div style={{borderBottom:'1px solid #E8ECF4'}}>
                    <button onClick={()=>setOpenFaq(openFaq===i?null:i)}
                      style={{width:'100%',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'18px 0',background:'none',border:'none',color:DARK,cursor:'pointer',textAlign:'left',gap:'16px'}}>
                      <span style={{fontWeight:'600',fontSize:'14px'}}>{faq.q}</span>
                      <span style={{fontSize:'20px',flexShrink:0,color:BLUE,transform:openFaq===i?'rotate(45deg)':'rotate(0)',transition:'transform 0.2s',display:'block'}}>+</span>
                    </button>
                    {openFaq===i && (
                      <div style={{paddingBottom:'18px',color:'#64748B',fontSize:'14px',lineHeight:'1.7'}}>{faq.a}</div>
                    )}
                  </div>
                </Animate>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="section-pad" style={{padding:'80px 60px',background:DARK}}>
        <Animate>
          <div style={{maxWidth:'600px',margin:'0 auto',textAlign:'center'}}>
            <h2 style={{fontSize:'36px',fontWeight:'900',letterSpacing:'-1px',marginBottom:'14px'}}>
              Келечегиңди<br/>бүгүн баштагыз
            </h2>
            <p style={{color:'rgba(255,255,255,0.75)',marginBottom:'32px',fontSize:'16px'}}>Биз менен ЖРТга даяр болуңуз</p>
            <div style={{display:'flex',gap:'12px',justifyContent:'center',flexWrap:'wrap'}}>
              <a href={whatsapp} target="_blank" rel="noopener noreferrer" style={{background:'#fff',color:BLUE,borderRadius:'14px',padding:'15px 36px',fontWeight:'900',fontSize:'16px',textDecoration:'none',display:'inline-block'}}>
                📲 Жазылуу
              </a>
              <button onClick={()=>setShowLogin(true)} style={{background:'rgba(255,255,255,0.15)',color:'#fff',border:'1px solid rgba(255,255,255,0.3)',borderRadius:'14px',padding:'15px 36px',fontWeight:'700',fontSize:'16px',cursor:'pointer'}}>
                Кирүү →
              </button>
            </div>
          </div>
        </Animate>
      </div>

      {/* FOOTER */}
      <div className="nav-pad" style={{background:'#060E24',borderTop:'1px solid rgba(255,255,255,0.05)',padding:'28px 60px',display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:'12px'}}>
        <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
          <img src="/images/logo.png" alt="Zhangak" style={{width:'30px',height:'30px',objectFit:'contain',filter:'brightness(0) invert(1)'}} />
          <span style={{fontWeight:'900',fontSize:'15px'}}>Zhangak</span>
        </div>
        <div style={{color:'rgba(255,255,255,0.3)',fontSize:'12px'}}>© 2025 Жангак. Бардык укуктар корголгон.</div>
        <a href={whatsapp} target="_blank" rel="noopener noreferrer" style={{color:'#60A5FA',fontSize:'13px',textDecoration:'none',fontWeight:'600'}}>
          📲 +996 502 077 326
        </a>
      </div>

      {/* LOGIN MODAL */}
      {showLogin && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,backdropFilter:'blur(8px)',padding:'20px'}}
          onClick={e=>{if(e.target===e.currentTarget)setShowLogin(false)}}>
          <div style={{background:'#0F1E35',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'24px',padding:'40px',width:'100%',maxWidth:'420px',position:'relative'}}>
            <button onClick={()=>setShowLogin(false)} style={{position:'absolute',top:'16px',right:'16px',background:'rgba(255,255,255,0.08)',border:'none',width:'32px',height:'32px',borderRadius:'50%',fontSize:'16px',cursor:'pointer',color:'rgba(255,255,255,0.5)'}}>✕</button>
            <div style={{textAlign:'center',marginBottom:'28px'}}>
              <img src="/images/logo.png" alt="Zhangak" style={{width:'44px',height:'44px',objectFit:'contain',filter:'brightness(0) invert(1)',marginBottom:'12px'}} />
              <div style={{fontWeight:'900',fontSize:'22px'}}>Кирүү</div>
              <div style={{color:'rgba(255,255,255,0.4)',fontSize:'13px',marginTop:'4px'}}>Жангак системасына кирүү</div>
            </div>
            <form onSubmit={handleLogin} style={{display:'flex',flexDirection:'column',gap:'14px'}}>
              <div>
                <label style={{fontSize:'12px',fontWeight:'600',color:'rgba(255,255,255,0.5)',display:'block',marginBottom:'6px'}}>Email</label>
                <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="email@gmail.com" required
                  style={{width:'100%',padding:'13px 16px',borderRadius:'12px',border:'1px solid rgba(255,255,255,0.1)',fontSize:'15px',outline:'none',color:'#fff',background:'rgba(255,255,255,0.05)',boxSizing:'border-box'}} />
              </div>
              <div>
                <label style={{fontSize:'12px',fontWeight:'600',color:'rgba(255,255,255,0.5)',display:'block',marginBottom:'6px'}}>Сырсөз</label>
                <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" required
                  style={{width:'100%',padding:'13px 16px',borderRadius:'12px',border:'1px solid rgba(255,255,255,0.1)',fontSize:'15px',outline:'none',color:'#fff',background:'rgba(255,255,255,0.05)',boxSizing:'border-box'}} />
              </div>
              {error && <div style={{background:'rgba(239,68,68,0.15)',color:'#FCA5A5',padding:'10px 14px',borderRadius:'10px',fontSize:'13px',textAlign:'center'}}>{error}</div>}
              <button type="submit" disabled={loading} style={{background:BLUE,color:'#fff',border:'none',borderRadius:'12px',padding:'15px',fontWeight:'900',fontSize:'16px',cursor:loading?'not-allowed':'pointer',opacity:loading?0.7:1}}>
                {loading?'Кирүүдө...':'Кирүү →'}
              </button>
            </form>
            <div style={{textAlign:'center',marginTop:'18px'}}>
              <span style={{color:'rgba(255,255,255,0.4)',fontSize:'13px'}}>Аккаунт жокпу? </span>
              <a href={whatsapp} target="_blank" rel="noopener noreferrer" style={{color:'#60A5FA',fontSize:'13px',fontWeight:'700',textDecoration:'none'}}>📲 Жазылуу</a>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
