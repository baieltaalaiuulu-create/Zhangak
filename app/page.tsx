'use client'
export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function LandingPage() {
  const [showLogin, setShowLogin] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

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

  return (
    <div style={{background:'#fff', minHeight:'100vh', fontFamily:'Inter, sans-serif', color:'#1E293B'}}>

      {/* NAVBAR */}
      <nav style={{background:'#fff', borderBottom:'1px solid #E8ECF4', padding:'0 60px', height:'68px', display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:100, boxShadow:'0 1px 12px rgba(0,0,0,0.06)'}}>
        <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
  <img src="/images/logo.png" alt="Zhangak" style={{width:'40px', height:'40px', objectFit:'contain'}} />
  <span style={{fontWeight:'900', fontSize:'20px', color:'#1B4FD8', letterSpacing:'-0.5px'}}>Zhangak</span>
</div>
        <div style={{display:'flex', gap:'28px', alignItems:'center'}}>
          {[
            {label:'Курстар', href:'#courses'},
            {label:'Программа', href:'#program'},
            {label:'Мугалимдер', href:'#teachers'},
            {label:'Натыйжалар', href:'#results'},
          ].map(item => (
            <a key={item.label} href={item.href} style={{color:'#64748B', fontSize:'14px', textDecoration:'none', fontWeight:'500'}}>
              {item.label}
            </a>
          ))}
        </div>
        <div style={{display:'flex', gap:'10px'}}>
          <button onClick={() => setShowLogin(true)}
            style={{background:'#F1F5F9', color:'#1E293B', border:'none', borderRadius:'8px', padding:'10px 20px', fontWeight:'600', fontSize:'14px', cursor:'pointer'}}>
            Кирүү
          </button>
          <a href={whatsapp} target="_blank" rel="noopener noreferrer"
            style={{background:'#1B4FD8', color:'#fff', border:'none', borderRadius:'8px', padding:'10px 20px', fontWeight:'700', fontSize:'14px', cursor:'pointer', textDecoration:'none', display:'flex', alignItems:'center', gap:'6px'}}>
            📲 Жазылуу
          </a>
        </div>
      </nav>

      {/* HERO */}
      <div style={{background:'linear-gradient(135deg,#1B4FD8 0%,#2563EB 60%,#1D4ED8 100%)', padding:'80px 60px 0', display:'flex', alignItems:'flex-end', gap:'60px', minHeight:'500px', overflow:'hidden'}}>
        <div style={{flex:'1', paddingBottom:'80px'}}>
          <div style={{background:'rgba(255,255,255,0.15)', borderRadius:'20px', padding:'6px 14px', display:'inline-flex', alignItems:'center', gap:'6px', marginBottom:'24px'}}>
            <span style={{fontSize:'16px'}}>🏆</span>
            <span style={{color:'#fff', fontSize:'13px', fontWeight:'600'}}>220+ ЖРТ жеңүүчүлөрү</span>
          </div>
          <h1 style={{color:'#fff', fontSize:'clamp(30px,4vw,52px)', fontWeight:'900', lineHeight:'1.1', marginBottom:'20px', letterSpacing:'-1px'}}>
            ЖРТдан жогорку<br/>балл — сенин<br/>келечегиндин<br/>ачкычы.
          </h1>
          <p style={{color:'rgba(255,255,255,0.85)', fontSize:'16px', lineHeight:'1.7', marginBottom:'36px', maxWidth:'460px'}}>
            Zhangak өзү бурбагу 10-11-класстын окуучуларын ЖРТга даярлайт, инновациялык методика менен.
          </p>
          <div style={{display:'flex', gap:'12px', flexWrap:'wrap'}}>
            <a href={whatsapp} target="_blank" rel="noopener noreferrer"
              style={{background:'#fff', color:'#1B4FD8', border:'none', borderRadius:'12px', padding:'16px 32px', fontWeight:'800', fontSize:'15px', cursor:'pointer', textDecoration:'none', display:'inline-block'}}>
              📲 Жазылуу
            </a>
            <button onClick={() => setShowLogin(true)}
              style={{background:'rgba(255,255,255,0.15)', color:'#fff', border:'1px solid rgba(255,255,255,0.3)', borderRadius:'12px', padding:'16px 32px', fontWeight:'600', fontSize:'15px', cursor:'pointer'}}>
              Кирүү →
            </button>
          </div>
        </div>

        <div style={{flex:'1', display:'flex', justifyContent:'flex-end', alignItems:'flex-end', gap:'16px'}}>
          <div style={{background:'rgba(255,255,255,0.12)', backdropFilter:'blur(10px)', borderRadius:'20px 20px 0 0', padding:'32px', textAlign:'center', minWidth:'220px'}}>
            <div style={{fontSize:'72px', marginBottom:'8px'}}>👨‍🎓👩‍🎓</div>
            <div style={{color:'rgba(255,255,255,0.7)', fontSize:'13px'}}>Жангак студенттери</div>
          </div>
          <div style={{display:'flex', flexDirection:'column', gap:'12px', paddingBottom:'24px'}}>
            {[
              {n:'4.5', l:'ЖРТ орто балл'},
              {n:'Туз', l:'Тажрыйбалуу'},
              {n:'21', l:'Мугалимдер'},
            ].map(s => (
              <div key={s.l} style={{background:'rgba(255,255,255,0.15)', backdropFilter:'blur(10px)', borderRadius:'14px', padding:'14px 24px', textAlign:'center', minWidth:'120px'}}>
                <div style={{color:'#fff', fontWeight:'900', fontSize:'24px'}}>{s.n}</div>
                <div style={{color:'rgba(255,255,255,0.7)', fontSize:'11px', marginTop:'3px'}}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* SUBJECTS */}
      <div id="courses" style={{padding:'72px 60px', background:'#F8FAFF'}}>
        <div style={{textAlign:'center', marginBottom:'48px'}}>
          <h2 style={{fontSize:'32px', fontWeight:'900', color:'#1E293B', marginBottom:'10px'}}>Субъекти</h2>
          <p style={{color:'#64748B', fontSize:'15px'}}>ЖРТнын бардык бөлүмдөрү боюнча даярдык</p>
        </div>
        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:'16px', maxWidth:'960px', margin:'0 auto'}}>
          {[
            {icon:'📐', name:'Математика', desc:'Арифметика, алгебра, геометрия', color:'#EFF6FF'},
            {icon:'🔤', name:'Аналогиялар', desc:'Окшоштуктар, сүйлөмдөр', color:'#F5F3FF'},
            {icon:'📖', name:'Текст түшүнүү', desc:'Окуу жана түшүнүү', color:'#F0FDF4'},
            {icon:'✍️', name:'Кыргыз тили', desc:'Грамматика жана пунктуация', color:'#FFF7ED'},
            {icon:'🧠', name:'Орус тили', desc:'Орус тили боюнча даярдык', color:'#FEF2F2'},
            {icon:'⚡', name:'Логикалык ой', desc:'Логика жана жалпы жөндөм', color:'#F0F9FF'},
          ].map(s => (
            <div key={s.name} style={{background:'#fff', borderRadius:'16px', padding:'24px 20px', textAlign:'center', border:'1px solid #E8ECF4', cursor:'pointer'}}>
              <div style={{width:'52px', height:'52px', background:s.color, borderRadius:'14px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'24px', margin:'0 auto 14px'}}>{s.icon}</div>
              <div style={{fontWeight:'700', fontSize:'14px', color:'#1E293B', marginBottom:'6px'}}>{s.name}</div>
              <div style={{fontSize:'12px', color:'#94A3B8', lineHeight:'1.5'}}>{s.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* COURSES */}
      <div id="program" style={{padding:'72px 60px'}}>
        <div style={{textAlign:'center', marginBottom:'48px'}}>
          <h2 style={{fontSize:'32px', fontWeight:'900', color:'#1E293B', marginBottom:'10px'}}>Курстар</h2>
          <p style={{color:'#64748B', fontSize:'15px'}}>3 деңгээл — башталгычтан финалга чейин</p>
        </div>
        <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'24px', maxWidth:'960px', margin:'0 auto'}}>
          {[
            {level:'B1', name:'Базовый курс', month:'1-ай', color:'#1B4FD8', bg:'#EFF6FF', topics:['Арифметика', 'Лексика жана морфология', 'Базалык аналогиялар', 'Чтение негиздери'], price:'4 500 сом'},
            {level:'B2', name:'Продвинутый курс', month:'2-ай', color:'#7C3AED', bg:'#F5F3FF', topics:['Алгебра', 'Синтаксис жана аналогия', 'Функциялар', 'Окуу жана түшүнүү'], price:'5 000 сом'},
            {level:'C1', name:'Финальный курс', month:'3-ай', color:'#059669', bg:'#F0FDF4', topics:['Геометрия', 'Грамматика жана чтение', 'Татаал аналогиялар', 'Толук ЖРТ форматы'], price:'5 500 сом'},
          ].map(c => (
            <div key={c.level} style={{background:'#fff', borderRadius:'20px', border:'1px solid #E8ECF4', overflow:'hidden'}}>
              <div style={{background:c.bg, padding:'24px', textAlign:'center'}}>
                <div style={{display:'inline-block', background:c.color, color:'#fff', borderRadius:'8px', padding:'4px 12px', fontSize:'12px', fontWeight:'800', marginBottom:'10px'}}>{c.level}</div>
                <div style={{fontWeight:'900', fontSize:'20px', color:'#1E293B', marginBottom:'4px'}}>{c.name}</div>
                <div style={{color:'#64748B', fontSize:'13px'}}>{c.month}</div>
              </div>
              <div style={{padding:'24px'}}>
                {c.topics.map(t => (
                  <div key={t} style={{display:'flex', alignItems:'center', gap:'8px', marginBottom:'10px'}}>
                    <div style={{width:'6px', height:'6px', borderRadius:'50%', background:c.color, flexShrink:0}}></div>
                    <span style={{fontSize:'13px', color:'#475569'}}>{t}</span>
                  </div>
                ))}
                <div style={{marginTop:'20px', paddingTop:'20px', borderTop:'1px solid #F1F5F9', display:'flex', alignItems:'center', justifyContent:'space-between'}}>
                  <span style={{fontWeight:'900', fontSize:'18px', color:c.color}}>{c.price}</span>
                  <a href={whatsapp} target="_blank" rel="noopener noreferrer"
                    style={{background:c.color, color:'#fff', borderRadius:'8px', padding:'8px 16px', fontSize:'13px', fontWeight:'700', textDecoration:'none'}}>
                    Жазылуу
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* WHY ZHANGAK */}
      <div style={{padding:'72px 60px', background:'#F8FAFF'}}>
        <div style={{textAlign:'center', marginBottom:'48px'}}>
          <h2 style={{fontSize:'32px', fontWeight:'900', color:'#1E293B', marginBottom:'10px'}}>Why Zhangak</h2>
          <p style={{color:'#64748B', fontSize:'15px'}}>Эмне үчүн биз менен?</p>
        </div>
        <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'20px', maxWidth:'960px', margin:'0 auto'}}>
          {[
            {icon:'👨‍🏫', title:'Тажрыйбалуу мугалимдер', desc:'Жогорку балл алган мугалимдер менен иштейсиз'},
            {icon:'🚀', title:'Заманбап методика', desc:'Инновациялык окутуу методдору менен тез өсүүсү'},
            {icon:'📊', title:'80% Практика', desc:'Реалдуу ЖРТ тесттери менен даярдыкт'},
            {icon:'👥', title:'Жеке ментордор', desc:'Ар бир окуучуга жеке мамиле жана план'},
            {icon:'📈', title:'Прогресс мониторинг', desc:'Ар бир занятиеден кийин прогрессти байкоо'},
            {icon:'🎯', title:'Натыйжага багыт', desc:'Максатка жетүү үчүн конкреттүү план'},
          ].map(w => (
            <div key={w.title} style={{display:'flex', gap:'16px', alignItems:'flex-start', padding:'24px', borderRadius:'16px', background:'#fff', border:'1px solid #E8ECF4'}}>
              <div style={{width:'48px', height:'48px', background:'#EFF6FF', borderRadius:'14px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'22px', flexShrink:0}}>{w.icon}</div>
              <div>
                <div style={{fontWeight:'700', fontSize:'14px', color:'#1E293B', marginBottom:'6px'}}>{w.title}</div>
                <div style={{fontSize:'13px', color:'#94A3B8', lineHeight:'1.6'}}>{w.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ONLINE TESTS */}
      <div style={{padding:'72px 60px'}}>
        <div style={{maxWidth:'960px', margin:'0 auto', display:'flex', gap:'60px', alignItems:'center'}}>
          <div style={{flex:1}}>
            <div style={{background:'#EFF6FF', borderRadius:'12px', padding:'6px 14px', display:'inline-block', marginBottom:'20px'}}>
              <span style={{color:'#1B4FD8', fontSize:'13px', fontWeight:'700'}}>🔥 Жаңы Онлайн Продукт</span>
            </div>
            <h2 style={{fontSize:'32px', fontWeight:'900', color:'#1E293B', marginBottom:'16px', lineHeight:'1.2'}}>
              Практикалык<br/>тесттер онлайн
            </h2>
            <p style={{color:'#64748B', fontSize:'15px', lineHeight:'1.7', marginBottom:'28px'}}>
              Реалдуу ЖРТ форматындагы тесттерди онлайн чеч. Туура жооптор жана баллдар дароо берилет.
            </p>
            <div style={{display:'flex', flexDirection:'column', gap:'12px', marginBottom:'32px'}}>
              {[
                '✅ Автоматтык баллдоо системасы',
                '✅ Математика, Аналогия, Чтение, Грамматика',
                '✅ Ар бир суроого түшүндүрмө',
                '✅ Прогрессти байкоо жана статистика',
              ].map(f => (
                <div key={f} style={{fontSize:'14px', color:'#475569'}}>{f}</div>
              ))}
            </div>
            <button onClick={() => setShowLogin(true)}
              style={{background:'#1B4FD8', color:'#fff', border:'none', borderRadius:'12px', padding:'16px 32px', fontWeight:'800', fontSize:'15px', cursor:'pointer'}}>
              Кирүү жана баштоо →
            </button>
          </div>
          <div style={{flex:1}}>
            <div style={{background:'linear-gradient(135deg,#1B4FD8,#7C3AED)', borderRadius:'24px', padding:'32px', color:'#fff'}}>
              <div style={{marginBottom:'20px', fontWeight:'700', fontSize:'14px', opacity:0.8}}>📝 Мисал суроо</div>
              <div style={{background:'rgba(255,255,255,0.1)', borderRadius:'14px', padding:'20px', marginBottom:'16px'}}>
                <div style={{fontWeight:'600', marginBottom:'16px', fontSize:'15px'}}>апта : күн — ?</div>
                <div style={{display:'flex', flexDirection:'column', gap:'10px'}}>
                  {['А) жыл : ай', 'Б) роман : сюжет', 'В) метр : сантиметр', 'Г) кылым : доор'].map((opt, i) => (
                    <div key={opt} style={{background: i===0 ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.08)', borderRadius:'8px', padding:'10px 14px', fontSize:'13px', cursor:'pointer', border: i===0 ? '1px solid rgba(255,255,255,0.5)' : '1px solid transparent'}}>
                      {opt} {i===0 ? '✓' : ''}
                    </div>
                  ))}
                </div>
              </div>
              <div style={{background:'rgba(52,199,123,0.2)', borderRadius:'10px', padding:'12px 16px', fontSize:'13px', color:'#6EE7A0'}}>
                ✅ Туура жооп: А) жыл : ай — 2 балл
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div style={{background:'linear-gradient(135deg,#1B4FD8,#2563EB)', padding:'72px 60px', textAlign:'center'}}>
        <h2 style={{color:'#fff', fontSize:'36px', fontWeight:'900', marginBottom:'14px', letterSpacing:'-0.5px'}}>Келечегиңди бүгүн баштагыз</h2>
        <p style={{color:'rgba(255,255,255,0.8)', marginBottom:'36px', fontSize:'16px'}}>Биз менен ЖРТга даяр болуңуз</p>
        <div style={{display:'flex', gap:'12px', justifyContent:'center'}}>
          <a href={whatsapp} target="_blank" rel="noopener noreferrer"
            style={{background:'#fff', color:'#1B4FD8', border:'none', borderRadius:'12px', padding:'16px 36px', fontWeight:'800', fontSize:'16px', cursor:'pointer', textDecoration:'none', display:'inline-block'}}>
            📲 Жазылуу
          </a>
          <button onClick={() => setShowLogin(true)}
            style={{background:'rgba(255,255,255,0.15)', color:'#fff', border:'1px solid rgba(255,255,255,0.4)', borderRadius:'12px', padding:'16px 36px', fontWeight:'700', fontSize:'16px', cursor:'pointer'}}>
            Кирүү →
          </button>
        </div>
      </div>

      {/* FOOTER */}
      <div style={{background:'#1E293B', padding:'40px 60px', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'16px'}}>
        <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
          <div style={{width:'32px', height:'32px', background:'linear-gradient(135deg,#1B4FD8,#3B82F6)', borderRadius:'8px', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:'900', fontSize:'14px'}}>Ж</div>
          <span style={{color:'#fff', fontWeight:'800', fontSize:'16px'}}>Zhangak</span>
        </div>
        <div style={{color:'#94A3B8', fontSize:'13px'}}>© 2025 Жангак. Бардык укуктар корголгон.</div>
        <a href={whatsapp} target="_blank" rel="noopener noreferrer"
          style={{color:'#3B82F6', fontSize:'13px', textDecoration:'none', fontWeight:'600'}}>
          📲 +996 502 077 326
        </a>
      </div>

      {/* LOGIN MODAL */}
      {showLogin && (
        <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, backdropFilter:'blur(4px)'}}
          onClick={e => { if(e.target === e.currentTarget) setShowLogin(false) }}>
          <div style={{background:'#fff', borderRadius:'24px', padding:'44px', width:'100%', maxWidth:'420px', position:'relative', boxShadow:'0 25px 60px rgba(0,0,0,0.2)'}}>
            <button onClick={() => setShowLogin(false)}
              style={{position:'absolute', top:'18px', right:'18px', background:'#F1F5F9', border:'none', width:'32px', height:'32px', borderRadius:'50%', fontSize:'16px', cursor:'pointer', color:'#64748B', display:'flex', alignItems:'center', justifyContent:'center'}}>✕</button>
            
            <div style={{textAlign:'center', marginBottom:'32px'}}>
              <div style={{width:'52px', height:'52px', background:'linear-gradient(135deg,#1B4FD8,#3B82F6)', borderRadius:'14px', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:'900', fontSize:'22px', margin:'0 auto 14px'}}>Ж</div>
              <div style={{fontWeight:'900', fontSize:'24px', color:'#1E293B'}}>Кирүү</div>
              <div style={{color:'#94A3B8', fontSize:'14px', marginTop:'6px'}}>Жангак системасына кирүү</div>
            </div>

            <form onSubmit={handleLogin} style={{display:'flex', flexDirection:'column', gap:'18px'}}>
              <div>
                <label style={{fontSize:'13px', fontWeight:'600', color:'#475569', display:'block', marginBottom:'8px'}}>Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="email@gmail.com" required
                  style={{width:'100%', padding:'14px 16px', borderRadius:'12px', border:'1.5px solid #E2E8F0', fontSize:'15px', outline:'none', color:'#1E293B', background:'#F8FAFF', boxSizing:'border-box'}} />
              </div>
              <div>
                <label style={{fontSize:'13px', fontWeight:'600', color:'#475569', display:'block', marginBottom:'8px'}}>Сырсөз</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" required
                  style={{width:'100%', padding:'14px 16px', borderRadius:'12px', border:'1.5px solid #E2E8F0', fontSize:'15px', outline:'none', color:'#1E293B', background:'#F8FAFF', boxSizing:'border-box'}} />
              </div>
              {error && (
                <div style={{background:'#FEF2F2', color:'#EF4444', padding:'12px 16px', borderRadius:'10px', fontSize:'14px', textAlign:'center', border:'1px solid #FEE2E2'}}>
                  {error}
                </div>
              )}
              <button type="submit" disabled={loading}
                style={{background:'linear-gradient(135deg,#1B4FD8,#2563EB)', color:'#fff', border:'none', borderRadius:'12px', padding:'16px', fontWeight:'800', fontSize:'16px', cursor:loading?'not-allowed':'pointer', opacity:loading?0.7:1}}>
                {loading ? 'Кирүүдө...' : 'Кирүү →'}
              </button>
            </form>

            <div style={{textAlign:'center', marginTop:'20px'}}>
              <span style={{color:'#94A3B8', fontSize:'13px'}}>Аккаунт жокпу? </span>
              <a href={whatsapp} target="_blank" rel="noopener noreferrer"
                style={{color:'#1B4FD8', fontSize:'13px', fontWeight:'700', textDecoration:'none'}}>
                📲 Жазылуу
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}