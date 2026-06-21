'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

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
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
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
  const BLUE = '#1B3FA0'
  const DARK = '#0D1E4A'

  const results = [
    { img: '/images/result4.png', name: 'Уланбекова Каныкей', score: 221 },
    { img: '/images/result3.png', name: 'Тилекова Акмарал', score: 211 },
    { img: '/images/result1.png', name: 'Шарифжанов Мухаммадзаир', score: 204 },
    { img: '/images/result2.png', name: 'Журсунова Нурзат', score: 202 },
  ]

  const faqs = [
    { q: '📚 Кайсы предметтер курска кирет?', a: 'Математика, Аналогиялар, Текст түшүнүү, Кыргыз тили грамматикасы — ЖРТнын бардык 4 бөлүмү.' },
    { q: '🏆 Жангактын жетишкендиктери кандай?', a: '220+ окуучу 190 балдан ашык алды. Эң жогорку натыйжа — 221 балл. Окуучулардын 80%ы максаттуу университетке кирди.' },
    { q: '🎓 Кайсы класстын окуучулары жазыла алат?', a: '10 жана 11-класстын окуучулары. Ошондой эле ЖРТга кайра даярданып жаткандар да жазыла алат.' },
    { q: '💰 Курс канча турат?', a: 'B1 — 4 500 сом/ай, B2 — 5 000 сом/ай, C1 — 5 500 сом/ай. Толук программа үчүн WhatsAppка жазыңыз.' },
    { q: '📍 Курс онлайн же оффлайн?', a: 'Азырынча оффлайн — Бишкек шаарында. Онлайн платформа иштеп жатат — жакында ишке киргизилет.' },
    { q: '⏱ Бир сабак канча убакыт?', a: 'Бир сабак 3 саат: Математика 50 мин + Кыргыз тили 50 мин + Чтение 50 мин + 20 мин оюн убактысы.' },
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
    <div style={{background:DARK, minHeight:'100vh', fontFamily:'Inter, sans-serif', color:'#fff'}}>

      {/* NAVBAR */}
      <nav style={{background:DARK, borderBottom:'1px solid rgba(255,255,255,0.08)', padding:'0 60px', height:'70px', display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:100}}>
        <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
          <img src="/images/logo.png" alt="Zhangak" style={{width:'38px', height:'38px', objectFit:'contain', filter:'brightness(0) invert(1)'}} />
          <span style={{fontWeight:'900', fontSize:'20px', letterSpacing:'-0.5px'}}>Zhangak</span>
        </div>
        <div style={{display:'flex', gap:'28px'}}>
          {[{l:'Курстар', h:'#courses'},{l:'Натыйжалар', h:'#results'},{l:'Программа', h:'#program'},{l:'FAQ', h:'#faq'}].map(i => (
            <a key={i.l} href={i.h} style={{color:'rgba(255,255,255,0.6)', fontSize:'14px', textDecoration:'none', fontWeight:'500'}}>{i.l}</a>
          ))}
        </div>
        <div style={{display:'flex', gap:'10px'}}>
          <button onClick={() => setShowLogin(true)} style={{background:'rgba(255,255,255,0.08)', color:'#fff', border:'1px solid rgba(255,255,255,0.15)', borderRadius:'10px', padding:'10px 22px', fontWeight:'600', fontSize:'14px', cursor:'pointer'}}>
            Кирүү
          </button>
          <a href={whatsapp} target="_blank" rel="noopener noreferrer" style={{background:BLUE, color:'#fff', borderRadius:'10px', padding:'10px 22px', fontWeight:'800', fontSize:'14px', textDecoration:'none', display:'flex', alignItems:'center', gap:'6px'}}>
            📲 Жазылуу
          </a>
        </div>
      </nav>

      {/* HERO */}
      <div style={{padding:'100px 60px 80px', maxWidth:'1200px', margin:'0 auto', display:'flex', alignItems:'center', gap:'60px'}}>
        <div style={{flex:'1'}}>
          <div style={{display:'inline-flex', alignItems:'center', gap:'8px', background:'rgba(27,63,160,0.3)', border:'1px solid rgba(27,63,160,0.5)', borderRadius:'20px', padding:'8px 16px', marginBottom:'28px'}}>
            <span>🏆</span>
            <span style={{color:'#7EB3FF', fontSize:'13px', fontWeight:'700'}}>220+ ЖРТ жеңүүчүлөрү</span>
          </div>
          <h1 style={{fontSize:'clamp(36px,5vw,62px)', fontWeight:'900', lineHeight:'1.05', marginBottom:'24px', letterSpacing:'-2px'}}>
            ЖРТдан<br/>
            <span style={{color:'#7EB3FF'}}>жогорку балл</span><br/>
            — сенин<br/>келечегиңдин<br/>ачкычы.
          </h1>
          <p style={{color:'rgba(255,255,255,0.6)', fontSize:'16px', lineHeight:'1.8', marginBottom:'40px', maxWidth:'480px'}}>
            Zhangak 10-11-класстын окуучуларын ЖРТга инновациялык методика менен даярдайт.
          </p>
          <div style={{display:'flex', gap:'14px'}}>
            <a href={whatsapp} target="_blank" rel="noopener noreferrer" style={{background:BLUE, color:'#fff', borderRadius:'14px', padding:'18px 36px', fontWeight:'900', fontSize:'16px', textDecoration:'none', display:'inline-block'}}>
              📲 Жазылуу
            </a>
            <button onClick={() => setShowLogin(true)} style={{background:'rgba(255,255,255,0.06)', color:'#fff', border:'1px solid rgba(255,255,255,0.15)', borderRadius:'14px', padding:'18px 36px', fontWeight:'600', fontSize:'16px', cursor:'pointer'}}>
              Кирүү →
            </button>
          </div>
          <div style={{display:'flex', gap:'40px', marginTop:'48px', paddingTop:'48px', borderTop:'1px solid rgba(255,255,255,0.08)'}}>
            {[{n:'220+', l:'ЖРТ жеңүүчүлөрү'},{n:'221', l:'Эң жогорку балл'},{n:'3', l:'Курс деңгээли'}].map(s => (
              <div key={s.l}>
                <div style={{fontWeight:'900', fontSize:'28px', color:'#7EB3FF'}}>{s.n}</div>
                <div style={{color:'rgba(255,255,255,0.5)', fontSize:'13px', marginTop:'4px'}}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{flex:'1'}}>
          <div style={{background:'rgba(27,63,160,0.15)', border:'1px solid rgba(27,63,160,0.3)', borderRadius:'24px', padding:'20px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px'}}>
            {results.map((r, i) => (
              <div key={i} style={{position:'relative', borderRadius:'16px', overflow:'hidden', aspectRatio:'3/4'}}>
                <img src={r.img} alt={r.name} style={{width:'100%', height:'100%', objectFit:'cover'}} />
                <div style={{position:'absolute', bottom:0, left:0, right:0, background:'linear-gradient(to top, rgba(13,30,74,0.98) 0%, transparent 70%)', padding:'14px 10px 10px'}}>
                  <div style={{color:'#7EB3FF', fontWeight:'900', fontSize:'17px'}}>{r.score} балл</div>
                  <div style={{color:'rgba(255,255,255,0.75)', fontSize:'10px', marginTop:'2px'}}>{r.name}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* TIMER */}
      <div style={{background:BLUE, padding:'60px', textAlign:'center'}}>
        <h2 style={{fontSize:'24px', fontWeight:'800', marginBottom:'40px', color:'rgba(255,255,255,0.9)'}}>ЖРТга чейин калды</h2>
        <div style={{display:'flex', gap:'16px', justifyContent:'center', flexWrap:'wrap'}}>
          {[
            {n: timeLeft.days, l:'Күн'},
            {n: timeLeft.hours, l:'Саат'},
            {n: timeLeft.minutes, l:'Мүнөт'},
            {n: timeLeft.seconds, l:'Секунд'},
          ].map((t, i) => (
            <div key={i}>
              <div style={{display:'flex', alignItems:'center', gap:'8px'}}>
                <div style={{background:'rgba(255,255,255,0.15)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:'16px', padding:'24px 32px', minWidth:'100px'}}>
                  <div style={{fontWeight:'900', fontSize:'48px', lineHeight:'1', fontVariantNumeric:'tabular-nums'}}>
                    {String(t.n).padStart(2,'0')}
                  </div>
                  <div style={{color:'rgba(255,255,255,0.7)', fontSize:'13px', marginTop:'8px', fontWeight:'600'}}>{t.l}</div>
                </div>
                {i < 3 && <span style={{fontSize:'32px', fontWeight:'900', opacity:0.5}}>:</span>}
              </div>
            </div>
          ))}
        </div>
        <a href={whatsapp} target="_blank" rel="noopener noreferrer" style={{display:'inline-block', marginTop:'36px', background:'#fff', color:BLUE, borderRadius:'12px', padding:'14px 36px', fontWeight:'900', fontSize:'15px', textDecoration:'none'}}>
          Азыр жазылуу →
        </a>
      </div>

      {/* PAINS */}
      <div style={{padding:'80px 60px', background:DARK}}>
        <div style={{maxWidth:'1200px', margin:'0 auto'}}>
          <div style={{display:'flex', gap:'60px', alignItems:'flex-start'}}>
            <div style={{flex:'0 0 320px'}}>
              <h2 style={{fontSize:'36px', fontWeight:'900', lineHeight:'1.15', letterSpacing:'-1px'}}>
                Сен так<br/>натыйжа<br/>аласың —<br/>
                <span style={{color:'#7EB3FF'}}>эгер сенде...</span>
              </h2>
              <p style={{color:'rgba(255,255,255,0.5)', fontSize:'14px', marginTop:'16px', lineHeight:'1.7'}}>
                Биздин 220+ окуучуларыбыздын баарысы ушул суроолор менен келди. Биз чечтик.
              </p>
            </div>
            <div style={{flex:1, display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'16px'}}>
              {pains.map((p, i) => (
                <div key={i} style={{background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'16px', padding:'20px'}}>
                  <div style={{fontSize:'28px', marginBottom:'12px'}}>{p.icon}</div>
                  <div style={{fontWeight:'700', fontSize:'14px', marginBottom:'8px', lineHeight:'1.4'}}>{p.title}</div>
                  <div style={{fontSize:'12px', color:'rgba(255,255,255,0.5)', lineHeight:'1.6'}}>{p.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* RESULTS */}
      <div id="results" style={{padding:'80px 60px', background:'rgba(255,255,255,0.02)', borderTop:'1px solid rgba(255,255,255,0.05)'}}>
        <div style={{maxWidth:'1200px', margin:'0 auto'}}>
          <div style={{textAlign:'center', marginBottom:'56px'}}>
            <div style={{display:'inline-flex', alignItems:'center', gap:'8px', background:'rgba(27,63,160,0.3)', border:'1px solid rgba(27,63,160,0.5)', borderRadius:'20px', padding:'8px 16px', marginBottom:'20px'}}>
              <span style={{color:'#7EB3FF', fontSize:'13px', fontWeight:'700'}}>🏆 Биздин жеңүүчүлөр</span>
            </div>
            <h2 style={{fontSize:'36px', fontWeight:'900', letterSpacing:'-1px', marginBottom:'12px'}}>Натыйжалар</h2>
            <p style={{color:'rgba(255,255,255,0.5)', fontSize:'15px'}}>Биздин окуучулардын реалдуу ЖРТ баллдары</p>
          </div>
          <div style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'20px'}}>
            {results.map((r, i) => (
              <div key={i} style={{position:'relative', borderRadius:'20px', overflow:'hidden', aspectRatio:'3/4'}}>
                <img src={r.img} alt={r.name} style={{width:'100%', height:'100%', objectFit:'cover'}} />
                <div style={{position:'absolute', bottom:0, left:0, right:0, background:'linear-gradient(to top, rgba(13,30,74,1) 0%, rgba(13,30,74,0.5) 50%, transparent 100%)', padding:'20px 16px 16px'}}>
                  <div style={{color:'#7EB3FF', fontWeight:'900', fontSize:'22px'}}>{r.score} балл</div>
                  <div style={{color:'rgba(255,255,255,0.85)', fontSize:'12px', marginTop:'4px', fontWeight:'500'}}>{r.name}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{textAlign:'center', marginTop:'32px'}}>
            <a href={whatsapp} target="_blank" rel="noopener noreferrer" style={{display:'inline-flex', alignItems:'center', gap:'8px', color:'#7EB3FF', fontSize:'14px', fontWeight:'700', textDecoration:'none', border:'1px solid rgba(27,63,160,0.5)', borderRadius:'10px', padding:'12px 24px'}}>
              Дагы натыйжаларды көрүү →
            </a>
          </div>
        </div>
      </div>

      {/* COURSES */}
      <div id="courses" style={{padding:'80px 60px', background:DARK}}>
        <div style={{maxWidth:'1200px', margin:'0 auto'}}>
          <div style={{textAlign:'center', marginBottom:'56px'}}>
            <h2 style={{fontSize:'36px', fontWeight:'900', letterSpacing:'-1px', marginBottom:'12px'}}>Курстар</h2>
            <p style={{color:'rgba(255,255,255,0.5)', fontSize:'15px'}}>3 деңгээл — башталгычтан финалга чейин</p>
          </div>
          <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'20px'}}>
            {[
              {level:'B1', name:'Базовый курс', month:'1-ай', color:'#3B82F6', topics:['Арифметика', 'Лексика жана морфология', 'Базалык аналогиялар', 'Чтение негиздери'], price:'4 500 сом'},
              {level:'B2', name:'Продвинутый курс', month:'2-ай', color:'#7EB3FF', topics:['Алгебра', 'Синтаксис жана аналогия', 'Функциялар', 'Окуу жана түшүнүү'], price:'5 000 сом'},
              {level:'C1', name:'Финальный курс', month:'3-ай', color:'#10B981', topics:['Геометрия', 'Грамматика жана чтение', 'Татаал аналогиялар', 'Толук ЖРТ форматы'], price:'5 500 сом'},
            ].map(c => (
              <div key={c.level} style={{background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'20px', overflow:'hidden'}}>
                <div style={{height:'3px', background:c.color}}></div>
                <div style={{padding:'28px'}}>
                  <div style={{display:'inline-block', background:`${c.color}22`, color:c.color, borderRadius:'8px', padding:'4px 12px', fontSize:'12px', fontWeight:'800', marginBottom:'14px'}}>{c.level}</div>
                  <div style={{fontWeight:'900', fontSize:'22px', marginBottom:'4px'}}>{c.name}</div>
                  <div style={{color:'rgba(255,255,255,0.4)', fontSize:'13px', marginBottom:'24px'}}>{c.month}</div>
                  {c.topics.map(t => (
                    <div key={t} style={{display:'flex', alignItems:'center', gap:'10px', marginBottom:'12px'}}>
                      <div style={{width:'6px', height:'6px', borderRadius:'50%', background:c.color, flexShrink:0}}></div>
                      <span style={{fontSize:'14px', color:'rgba(255,255,255,0.7)'}}>{t}</span>
                    </div>
                  ))}
                  <div style={{marginTop:'24px', paddingTop:'24px', borderTop:'1px solid rgba(255,255,255,0.06)', display:'flex', alignItems:'center', justifyContent:'space-between'}}>
                    <span style={{fontWeight:'900', fontSize:'20px', color:c.color}}>{c.price}</span>
                    <a href={whatsapp} target="_blank" rel="noopener noreferrer" style={{background:c.color, color:'#fff', borderRadius:'10px', padding:'10px 20px', fontSize:'13px', fontWeight:'700', textDecoration:'none'}}>
                      Жазылуу
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* SUBJECTS */}
      <div id="program" style={{padding:'80px 60px', background:'rgba(255,255,255,0.02)', borderTop:'1px solid rgba(255,255,255,0.05)'}}>
        <div style={{maxWidth:'1200px', margin:'0 auto'}}>
          <div style={{textAlign:'center', marginBottom:'56px'}}>
            <h2 style={{fontSize:'36px', fontWeight:'900', letterSpacing:'-1px', marginBottom:'12px'}}>Субъекттер</h2>
            <p style={{color:'rgba(255,255,255,0.5)', fontSize:'15px'}}>ЖРТнын бардык бөлүмдөрү боюнча даярдык</p>
          </div>
          <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:'16px'}}>
            {[
              {icon:'📐', name:'Математика', desc:'Арифметика, алгебра, геометрия', color:'#3B82F6'},
              {icon:'🔤', name:'Аналогиялар', desc:'Окшоштуктар, сүйлөмдөр', color:'#7EB3FF'},
              {icon:'📖', name:'Текст түшүнүү', desc:'Окуу жана түшүнүү', color:'#10B981'},
              {icon:'✍️', name:'Кыргыз тили', desc:'Грамматика жана пунктуация', color:'#F59E0B'},
              {icon:'🧠', name:'Орус тили', desc:'Орус тили боюнча даярдык', color:'#EF4444'},
              {icon:'⚡', name:'Логикалык ой', desc:'Логика жана жалпы жөндөм', color:'#8B5CF6'},
            ].map(s => (
              <div key={s.name} style={{background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:'16px', padding:'24px 20px', textAlign:'center'}}>
                <div style={{width:'52px', height:'52px', background:`${s.color}22`, borderRadius:'14px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'24px', margin:'0 auto 14px'}}>{s.icon}</div>
                <div style={{fontWeight:'700', fontSize:'14px', marginBottom:'6px'}}>{s.name}</div>
                <div style={{fontSize:'12px', color:'rgba(255,255,255,0.4)', lineHeight:'1.5'}}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* FAQ */}
      <div id="faq" style={{padding:'80px 60px', background:DARK}}>
        <div style={{maxWidth:'900px', margin:'0 auto'}}>
          <div style={{display:'flex', gap:'60px', alignItems:'flex-start'}}>
            <div style={{flex:'0 0 280px'}}>
              <h2 style={{fontSize:'36px', fontWeight:'900', lineHeight:'1.15', letterSpacing:'-1px'}}>
                Көп<br/>берилүүчү<br/>суроолор
              </h2>
              <p style={{color:'rgba(255,255,255,0.5)', fontSize:'14px', marginTop:'16px', lineHeight:'1.7'}}>
                Дагы суроолор барбы? WhatsAppка жазыңыз.
              </p>
              <a href={whatsapp} target="_blank" rel="noopener noreferrer" style={{display:'inline-block', marginTop:'20px', background:BLUE, color:'#fff', borderRadius:'10px', padding:'12px 24px', fontWeight:'700', fontSize:'14px', textDecoration:'none'}}>
                📲 Суроо берүү
              </a>
            </div>
            <div style={{flex:1}}>
              {faqs.map((faq, i) => (
                <div key={i} style={{borderBottom:'1px solid rgba(255,255,255,0.07)', overflow:'hidden'}}>
                  <button onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    style={{width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'20px 0', background:'none', border:'none', color:'#fff', cursor:'pointer', textAlign:'left', gap:'16px'}}>
                    <span style={{fontWeight:'600', fontSize:'15px'}}>{faq.q}</span>
                    <span style={{fontSize:'20px', flexShrink:0, color:'#7EB3FF', transition:'transform 0.2s', transform: openFaq === i ? 'rotate(45deg)' : 'rotate(0)'}}>+</span>
                  </button>
                  {openFaq === i && (
                    <div style={{paddingBottom:'20px', color:'rgba(255,255,255,0.6)', fontSize:'14px', lineHeight:'1.7'}}>
                      {faq.a}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div style={{padding:'80px 60px', background:BLUE}}>
        <div style={{maxWidth:'600px', margin:'0 auto', textAlign:'center'}}>
          <h2 style={{fontSize:'40px', fontWeight:'900', letterSpacing:'-1px', marginBottom:'16px'}}>
            Келечегиңди<br/>бүгүн баштагыз
          </h2>
          <p style={{color:'rgba(255,255,255,0.7)', marginBottom:'36px', fontSize:'16px'}}>
            Биз менен ЖРТга даяр болуңуз
          </p>
          <div style={{display:'flex', gap:'12px', justifyContent:'center'}}>
            <a href={whatsapp} target="_blank" rel="noopener noreferrer" style={{background:'#fff', color:BLUE, borderRadius:'14px', padding:'18px 40px', fontWeight:'900', fontSize:'16px', textDecoration:'none', display:'inline-block'}}>
              📲 Жазылуу
            </a>
            <button onClick={() => setShowLogin(true)} style={{background:'rgba(255,255,255,0.15)', color:'#fff', border:'1px solid rgba(255,255,255,0.3)', borderRadius:'14px', padding:'18px 40px', fontWeight:'700', fontSize:'16px', cursor:'pointer'}}>
              Кирүү →
            </button>
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <div style={{background:'rgba(0,0,0,0.4)', borderTop:'1px solid rgba(255,255,255,0.05)', padding:'32px 60px', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'16px'}}>
        <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
          <img src="/images/logo.png" alt="Zhangak" style={{width:'32px', height:'32px', objectFit:'contain', filter:'brightness(0) invert(1)'}} />
          <span style={{fontWeight:'900', fontSize:'16px'}}>Zhangak</span>
        </div>
        <div style={{color:'rgba(255,255,255,0.3)', fontSize:'13px'}}>© 2025 Жангак. Бардык укуктар корголгон.</div>
        <a href={whatsapp} target="_blank" rel="noopener noreferrer" style={{color:'#7EB3FF', fontSize:'13px', textDecoration:'none', fontWeight:'600'}}>
          📲 +996 502 077 326
        </a>
      </div>

      {/* LOGIN MODAL */}
      {showLogin && (
        <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, backdropFilter:'blur(8px)'}}
          onClick={e => { if(e.target === e.currentTarget) setShowLogin(false) }}>
          <div style={{background:'#0F1E35', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'24px', padding:'44px', width:'100%', maxWidth:'420px', position:'relative'}}>
            <button onClick={() => setShowLogin(false)} style={{position:'absolute', top:'18px', right:'18px', background:'rgba(255,255,255,0.08)', border:'none', width:'32px', height:'32px', borderRadius:'50%', fontSize:'16px', cursor:'pointer', color:'rgba(255,255,255,0.5)'}}>✕</button>
            <div style={{textAlign:'center', marginBottom:'32px'}}>
              <img src="/images/logo.png" alt="Zhangak" style={{width:'48px', height:'48px', objectFit:'contain', filter:'brightness(0) invert(1)', marginBottom:'14px'}} />
              <div style={{fontWeight:'900', fontSize:'24px'}}>Кирүү</div>
              <div style={{color:'rgba(255,255,255,0.4)', fontSize:'14px', marginTop:'6px'}}>Жангак системасына кирүү</div>
            </div>
            <form onSubmit={handleLogin} style={{display:'flex', flexDirection:'column', gap:'16px'}}>
              <div>
                <label style={{fontSize:'13px', fontWeight:'600', color:'rgba(255,255,255,0.5)', display:'block', marginBottom:'8px'}}>Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@gmail.com" required
                  style={{width:'100%', padding:'14px 16px', borderRadius:'12px', border:'1px solid rgba(255,255,255,0.1)', fontSize:'15px', outline:'none', color:'#fff', background:'rgba(255,255,255,0.05)', boxSizing:'border-box'}} />
              </div>
              <div>
                <label style={{fontSize:'13px', fontWeight:'600', color:'rgba(255,255,255,0.5)', display:'block', marginBottom:'8px'}}>Сырсөз</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required
                  style={{width:'100%', padding:'14px 16px', borderRadius:'12px', border:'1px solid rgba(255,255,255,0.1)', fontSize:'15px', outline:'none', color:'#fff', background:'rgba(255,255,255,0.05)', boxSizing:'border-box'}} />
              </div>
              {error && (
                <div style={{background:'rgba(239,68,68,0.15)', color:'#FCA5A5', padding:'12px 16px', borderRadius:'10px', fontSize:'14px', textAlign:'center'}}>
                  {error}
                </div>
              )}
              <button type="submit" disabled={loading} style={{background:BLUE, color:'#fff', border:'none', borderRadius:'12px', padding:'16px', fontWeight:'900', fontSize:'16px', cursor:loading?'not-allowed':'pointer', opacity:loading?0.7:1}}>
                {loading ? 'Кирүүдө...' : 'Кирүү →'}
              </button>
            </form>
            <div style={{textAlign:'center', marginTop:'20px'}}>
              <span style={{color:'rgba(255,255,255,0.4)', fontSize:'13px'}}>Аккаунт жокпу? </span>
              <a href={whatsapp} target="_blank" rel="noopener noreferrer" style={{color:'#7EB3FF', fontSize:'13px', fontWeight:'700', textDecoration:'none'}}>📲 Жазылуу</a>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}