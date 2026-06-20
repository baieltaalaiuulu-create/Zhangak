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

  return (
    <div style={{background:'#fff', minHeight:'100vh', fontFamily:'Inter, sans-serif'}}>

      {/* NAVBAR */}
      <nav style={{background:'#fff', borderBottom:'1px solid #E8ECF4', padding:'0 40px', height:'64px', display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:100}}>
        <div style={{display:'flex', alignItems:'center', gap:'8px'}}>
          <div style={{width:'32px', height:'32px', background:'linear-gradient(135deg,#1B4FD8,#3B82F6)', borderRadius:'8px', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:'900', fontSize:'14px'}}>Ж</div>
          <span style={{fontWeight:'800', fontSize:'18px', color:'#1B4FD8'}}>Zhangak</span>
        </div>
        <div style={{display:'flex', gap:'32px', alignItems:'center'}}>
          {['Бир нурсы', 'Программа', 'Мугалимдер', 'Натыйжалар', 'FAQ'].map(item => (
            <a key={item} href="#" style={{color:'#64748B', fontSize:'14px', textDecoration:'none', fontWeight:'500'}}>{item}</a>
          ))}
        </div>
        <button onClick={() => setShowLogin(true)}
          style={{background:'#1B4FD8', color:'#fff', border:'none', borderRadius:'8px', padding:'10px 24px', fontWeight:'700', fontSize:'14px', cursor:'pointer'}}>
          Жазылуу
        </button>
      </nav>

      {/* HERO */}
      <div style={{background:'linear-gradient(135deg,#1B4FD8 0%,#2563EB 50%,#1D4ED8 100%)', padding:'80px 80px 0', display:'flex', alignItems:'flex-end', gap:'40px', overflow:'hidden', minHeight:'480px', position:'relative'}}>
        <div style={{flex:1, paddingBottom:'60px'}}>
          <div style={{background:'rgba(255,255,255,0.15)', borderRadius:'20px', padding:'4px 12px', display:'inline-block', marginBottom:'20px'}}>
            <span style={{color:'#fff', fontSize:'12px', fontWeight:'600'}}>🏆 220+ ЖРТ жеңүүчүлөрү</span>
          </div>
          <h1 style={{color:'#fff', fontSize:'clamp(28px,4vw,48px)', fontWeight:'900', lineHeight:'1.15', marginBottom:'16px'}}>
            ЖРТдан жогорку<br/>балл — сенин<br/>келечегиндин<br/>ачкычы.
          </h1>
          <p style={{color:'rgba(255,255,255,0.85)', fontSize:'15px', lineHeight:'1.7', marginBottom:'32px', maxWidth:'440px'}}>
            Zhangak өзү бурбагу 10-11-класстын окуучуларын ЖРТга даярлайт, инновациялык методика менен ЖРТга даярдайт.
          </p>
          <div style={{display:'flex', gap:'12px'}}>
            <button onClick={() => setShowLogin(true)}
              style={{background:'#fff', color:'#1B4FD8', border:'none', borderRadius:'10px', padding:'14px 28px', fontWeight:'800', fontSize:'15px', cursor:'pointer'}}>
              Жазылуу
            </button>
            <button style={{background:'rgba(255,255,255,0.15)', color:'#fff', border:'1px solid rgba(255,255,255,0.3)', borderRadius:'10px', padding:'14px 28px', fontWeight:'600', fontSize:'15px', cursor:'pointer'}}>
              Бекер консультация
            </button>
          </div>
        </div>

        <div style={{flex:1, display:'flex', justifyContent:'center', alignItems:'flex-end', gap:'16px', paddingBottom:'0'}}>
          {/* Cartoon students placeholder */}
          <div style={{width:'280px', height:'300px', background:'rgba(255,255,255,0.1)', borderRadius:'20px 20px 0 0', display:'flex', alignItems:'center', justifyContent:'center'}}>
            <div style={{textAlign:'center'}}>
              <div style={{fontSize:'80px'}}>👨‍🎓👩‍🎓</div>
              <div style={{color:'rgba(255,255,255,0.7)', fontSize:'13px', marginTop:'8px'}}>Жангак студенттери</div>
            </div>
          </div>
          <div style={{display:'flex', flexDirection:'column', gap:'12px', paddingBottom:'20px'}}>
            {[
              {n:'4.5', l:'ЖРТ орто балл'},
              {n:'Туз', l:'Тажрыйбалуу'},
              {n:'21', l:'Мугалимдер'},
            ].map(s => (
              <div key={s.l} style={{background:'rgba(255,255,255,0.15)', backdropFilter:'blur(10px)', borderRadius:'12px', padding:'12px 20px', textAlign:'center'}}>
                <div style={{color:'#fff', fontWeight:'900', fontSize:'22px'}}>{s.n}</div>
                <div style={{color:'rgba(255,255,255,0.7)', fontSize:'11px', marginTop:'2px'}}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* SUBJECTS */}
      <div style={{padding:'64px 80px', background:'#F8FAFF'}}>
        <h2 style={{textAlign:'center', fontSize:'28px', fontWeight:'900', color:'#1E293B', marginBottom:'8px'}}>Субъекти</h2>
        <p style={{textAlign:'center', color:'#64748B', marginBottom:'40px', fontSize:'15px'}}>ЖРТнын бардык бөлүмдөрү боюнча даярдык</p>
        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:'16px', maxWidth:'900px', margin:'0 auto'}}>
          {[
            {icon:'📐', name:'Математика', desc:'Арифметика, алгебра, геометрия'},
            {icon:'🔤', name:'Аналогиялар', desc:'Окшоштуктар, сүйлөмдөр'},
            {icon:'📖', name:'Текст түшүнүү', desc:'Окуу жана түшүнүү'},
            {icon:'✍️', name:'Кыргыз тили', desc:'Грамматика жана пунктуация'},
            {icon:'🧠', name:'Бруc тили', desc:'Орус тили боюнча даярдык'},
            {icon:'⚡', name:'Логикалык ой', desc:'Логика жана жалпы жөндөм'},
          ].map(s => (
            <div key={s.name} style={{background:'#fff', borderRadius:'16px', padding:'20px', textAlign:'center', border:'1px solid #E8ECF4', cursor:'pointer', transition:'all 0.2s'}}>
              <div style={{fontSize:'32px', marginBottom:'10px'}}>{s.icon}</div>
              <div style={{fontWeight:'700', fontSize:'14px', color:'#1E293B', marginBottom:'4px'}}>{s.name}</div>
              <div style={{fontSize:'11px', color:'#94A3B8'}}>{s.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* WHY ZHANGAK */}
      <div style={{padding:'64px 80px'}}>
        <h2 style={{textAlign:'center', fontSize:'28px', fontWeight:'900', color:'#1E293B', marginBottom:'40px'}}>Why Zhangak</h2>
        <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'24px', maxWidth:'900px', margin:'0 auto'}}>
          {[
            {icon:'👨‍🏫', title:'Тажрыйбалуу мугалимдер', desc:'Жогорку балл алган мугалимдер менен'},
            {icon:'🚀', title:'Заманбап методика', desc:'Инновациялык окутуу методдору'},
            {icon:'📊', title:'80% Практика', desc:'Реалдуу ЖРТ тесттери менен'},
            {icon:'👥', title:'Жеке ментордор', desc:'Ар бир окуучуга жеке мамиле'},
            {icon:'📈', title:'Жетишкиликти мониторинг', desc:'Прогрессти байкап туруу'},
            {icon:'🎯', title:'Бүгүн чиресуу', desc:'Натыйжага багытталган план'},
          ].map(w => (
            <div key={w.title} style={{display:'flex', gap:'16px', alignItems:'flex-start', padding:'20px', borderRadius:'16px', border:'1px solid #E8ECF4'}}>
              <div style={{width:'44px', height:'44px', background:'#EFF6FF', borderRadius:'12px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'20px', flexShrink:0}}>{w.icon}</div>
              <div>
                <div style={{fontWeight:'700', fontSize:'14px', color:'#1E293B', marginBottom:'4px'}}>{w.title}</div>
                <div style={{fontSize:'12px', color:'#94A3B8'}}>{w.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div style={{background:'linear-gradient(135deg,#1B4FD8,#2563EB)', padding:'64px 80px', textAlign:'center'}}>
        <h2 style={{color:'#fff', fontSize:'32px', fontWeight:'900', marginBottom:'12px'}}>Келечегиңди бүгүн баштагыз</h2>
        <p style={{color:'rgba(255,255,255,0.8)', marginBottom:'32px', fontSize:'15px'}}>Биз менен ЖРТга даяр болуңуз</p>
        <button onClick={() => setShowLogin(true)}
          style={{background:'#fff', color:'#1B4FD8', border:'none', borderRadius:'10px', padding:'16px 40px', fontWeight:'800', fontSize:'16px', cursor:'pointer'}}>
          Жазылуу →
        </button>
      </div>

      {/* FOOTER */}
      <div style={{background:'#1E293B', padding:'32px 80px', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
        <div style={{color:'#fff', fontWeight:'800', fontSize:'16px'}}>Zhangak</div>
        <div style={{color:'#64748B', fontSize:'13px'}}>© 2025 Жангак. Бардык укуктар корголгон.</div>
      </div>

      {/* LOGIN MODAL */}
      {showLogin && (
        <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000}}
          onClick={e => { if(e.target === e.currentTarget) setShowLogin(false) }}>
          <div style={{background:'#fff', borderRadius:'20px', padding:'40px', width:'100%', maxWidth:'420px', position:'relative'}}>
            <button onClick={() => setShowLogin(false)}
              style={{position:'absolute', top:'16px', right:'16px', background:'none', border:'none', fontSize:'20px', cursor:'pointer', color:'#94A3B8'}}>✕</button>
            
            <div style={{textAlign:'center', marginBottom:'28px'}}>
              <div style={{width:'48px', height:'48px', background:'linear-gradient(135deg,#1B4FD8,#3B82F6)', borderRadius:'12px', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:'900', fontSize:'20px', margin:'0 auto 12px'}}>Ж</div>
              <div style={{fontWeight:'900', fontSize:'22px', color:'#1E293B'}}>Кирүү</div>
              <div style={{color:'#94A3B8', fontSize:'13px', marginTop:'4px'}}>Жангак системасына кирүү</div>
            </div>

            <form onSubmit={handleLogin} style={{display:'flex', flexDirection:'column', gap:'16px'}}>
              <div>
                <label style={{fontSize:'12px', fontWeight:'600', color:'#64748B', display:'block', marginBottom:'6px'}}>Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="email@gmail.com" required
                  style={{width:'100%', padding:'12px 16px', borderRadius:'10px', border:'1.5px solid #E2E8F0', fontSize:'14px', outline:'none', color:'#1E293B', background:'#F8FAFF'}} />
              </div>
              <div>
                <label style={{fontSize:'12px', fontWeight:'600', color:'#64748B', display:'block', marginBottom:'6px'}}>Сырсөз</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" required
                  style={{width:'100%', padding:'12px 16px', borderRadius:'10px', border:'1.5px solid #E2E8F0', fontSize:'14px', outline:'none', color:'#1E293B', background:'#F8FAFF'}} />
              </div>
              {error && (
                <div style={{background:'#FEF2F2', color:'#EF4444', padding:'10px 16px', borderRadius:'8px', fontSize:'13px', textAlign:'center'}}>
                  {error}
                </div>
              )}
              <button type="submit" disabled={loading}
                style={{background:'linear-gradient(135deg,#1B4FD8,#2563EB)', color:'#fff', border:'none', borderRadius:'10px', padding:'14px', fontWeight:'800', fontSize:'15px', cursor:loading?'not-allowed':'pointer', opacity:loading?0.7:1}}>
                {loading ? 'Кирүүдө...' : 'Кирүү →'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}