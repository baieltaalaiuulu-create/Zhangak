'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

function Animate({ children, delay = 0 }: { children: React.ReactNode, delay?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setInView(true) }, { threshold: 0.05 })
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [])
  return (
    <div ref={ref} style={{ opacity: inView ? 1 : 0, transform: inView ? 'translateY(0)' : 'translateY(20px)', transition: `opacity 0.5s ease ${delay}ms, transform 0.5s ease ${delay}ms` }}>
      {children}
    </div>
  )
}

const BLUE = '#2563EB'
const DARK = '#0D1E4A'
const SURFACE = '#0F1E35'
const BORDER = 'rgba(255,255,255,0.08)'

const stages = [
  { id: 'new', label: 'Жаңы заявка', color: '#6B7280', bg: 'rgba(107,114,128,0.15)' },
  { id: 'call', label: 'Биринчи чалуу', color: '#3B82F6', bg: 'rgba(59,130,246,0.15)' },
  { id: 'consult', label: 'Консультация', color: '#8B5CF6', bg: 'rgba(139,92,246,0.15)' },
  { id: 'trial', label: 'Сынак сабак', color: '#F59E0B', bg: 'rgba(245,158,11,0.15)' },
  { id: 'payment', label: 'Оплата', color: '#EF4444', bg: 'rgba(239,68,68,0.15)' },
  { id: 'studying', label: 'Окуп жатат', color: '#10B981', bg: 'rgba(16,185,129,0.15)' },
  { id: 'graduate', label: 'Бүтүрүүчү', color: '#F0C040', bg: 'rgba(240,192,64,0.15)' },
]

export default function ManagerPage() {
  const [leads, setLeads] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [selectedLead, setSelectedLead] = useState<any>(null)
  const [search, setSearch] = useState('')
  const [newLead, setNewLead] = useState({ full_name: '', phone: '', course: 'B1', stage: 'new', note: '' })
  const [saving, setSaving] = useState(false)
  const [note, setNote] = useState('')
  const router = useRouter()

  useEffect(() => { checkAuth() }, [])

  const checkAuth = async () => {
    await supabase.auth.getSession()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (!profile || profile.role !== 'manager') {
      await supabase.auth.signOut()
      router.push('/')
      return
    }
    fetchLeads()
  }

  const fetchLeads = async () => {
    const { data } = await supabase.from('crm_leads').select('*').order('created_at', { ascending: false })
    setLeads(data || [])
    setLoading(false)
  }

  const createLead = async () => {
    if (!newLead.full_name || !newLead.phone) return
    setSaving(true)
    await supabase.from('crm_leads').insert(newLead)
    setNewLead({ full_name: '', phone: '', course: 'B1', stage: 'new', note: '' })
    setShowForm(false)
    fetchLeads()
    setSaving(false)
  }

  const updateStage = async (id: number, stage: string) => {
    await supabase.from('crm_leads').update({ stage }).eq('id', id)
    fetchLeads()
    if (selectedLead?.id === id) setSelectedLead((p: any) => ({ ...p, stage }))
  }

  const updateNote = async () => {
    if (!selectedLead) return
    await supabase.from('crm_leads').update({ note }).eq('id', selectedLead.id)
    fetchLeads()
    setSelectedLead((p: any) => ({ ...p, note }))
  }

  const deleteLead = async (id: number) => {
    if (!confirm('Клиентти өчүрөсүзбү?')) return
    await supabase.from('crm_leads').delete().eq('id', id)
    setSelectedLead(null)
    fetchLeads()
  }

  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/') }

  const filtered = leads.filter(l =>
    l.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    l.phone?.includes(search)
  )

  if (loading) return (
    <div style={{ minHeight: '100vh', background: DARK, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ textAlign: 'center' }}>
        <img src="/images/logo.png" alt="Zhangak" style={{ width: '48px', filter: 'brightness(0) invert(1)', marginBottom: '16px' }} />
        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px' }}>Жүктөлүүдө...</div>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: DARK, fontFamily: 'Inter, sans-serif', color: '#fff' }}>

      {/* NAVBAR */}
      <div style={{ background: SURFACE, borderBottom: `1px solid ${BORDER}`, padding: '0 24px', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img src="/images/logo.png" alt="Zhangak" style={{ width: '32px', filter: 'brightness(0) invert(1)' }} />
          <div>
            <div style={{ fontWeight: '900', fontSize: '16px' }}>Zhangak</div>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>Менеджер панели</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ background: 'rgba(37,99,235,0.15)', border: '1px solid rgba(37,99,235,0.3)', borderRadius: '20px', padding: '6px 14px', fontSize: '12px', color: '#60A5FA', fontWeight: '600' }}>
            🎯 Менеджер
          </div>
          <button onClick={handleLogout} style={{ background: 'rgba(239,68,68,0.1)', color: '#FCA5A5', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
            Чыгуу
          </button>
        </div>
      </div>

      <div style={{ padding: '24px', display: 'grid', gridTemplateColumns: selectedLead ? '1fr 360px' : '1fr', gap: '24px', maxWidth: '1400px', margin: '0 auto' }}>

        {/* MAIN */}
        <div>
          {/* STATS */}
          <Animate>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px', marginBottom: '24px' }}>
              {[
                { label: 'Жалпы клиент', value: leads.length, color: '#60A5FA' },
                { label: 'Жаңы заявка', value: leads.filter(l => l.stage === 'new').length, color: '#6B7280' },
                { label: 'Окуп жатат', value: leads.filter(l => l.stage === 'studying').length, color: '#10B981' },
                { label: 'Бүтүрүүчү', value: leads.filter(l => l.stage === 'graduate').length, color: '#F0C040' },
              ].map((s, i) => (
                <div key={i} style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: '14px', padding: '16px 20px' }}>
                  <div style={{ fontWeight: '900', fontSize: '28px', color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>{s.label}</div>
                </div>
              ))}
            </div>
          </Animate>

          {/* TOOLBAR */}
          <Animate delay={100}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="🔍 Издөө — аты же телефон..."
                style={{ flex: 1, padding: '10px 14px', borderRadius: '10px', border: `1px solid ${BORDER}`, background: SURFACE, color: '#fff', fontSize: '14px', outline: 'none' }} />
              <button onClick={() => setShowForm(p => !p)}
                style={{ background: BLUE, color: '#fff', border: 'none', borderRadius: '10px', padding: '10px 20px', fontWeight: '700', fontSize: '14px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                + Жаңы клиент
              </button>
            </div>
          </Animate>

          {/* ADD FORM */}
          {showForm && (
            <Animate>
              <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: '16px', padding: '20px', marginBottom: '20px' }}>
                <div style={{ fontWeight: '700', fontSize: '15px', marginBottom: '16px' }}>Жаңы клиент кошуу</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                  <div>
                    <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginBottom: '6px' }}>Аты-жөнү *</div>
                    <input value={newLead.full_name} onChange={e => setNewLead(p => ({ ...p, full_name: e.target.value }))}
                      placeholder="Иванов Айбек"
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${BORDER}`, background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: '13px', boxSizing: 'border-box' as const }} />
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginBottom: '6px' }}>Телефон *</div>
                    <input value={newLead.phone} onChange={e => setNewLead(p => ({ ...p, phone: e.target.value }))}
                      placeholder="+996 700 000 000"
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${BORDER}`, background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: '13px', boxSizing: 'border-box' as const }} />
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginBottom: '6px' }}>Курс</div>
                    <select value={newLead.course} onChange={e => setNewLead(p => ({ ...p, course: e.target.value }))}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${BORDER}`, background: DARK, color: '#fff', fontSize: '13px', boxSizing: 'border-box' as const }}>
                      {['B1', 'B2', 'C1', 'Жайкы интенсив'].map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginBottom: '6px' }}>Эскертүү</div>
                  <input value={newLead.note} onChange={e => setNewLead(p => ({ ...p, note: e.target.value }))}
                    placeholder="Кошумча маалымат..."
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${BORDER}`, background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: '13px', boxSizing: 'border-box' as const }} />
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={createLead} disabled={saving}
                    style={{ background: BLUE, color: '#fff', border: 'none', borderRadius: '10px', padding: '10px 24px', fontWeight: '700', fontSize: '14px', cursor: 'pointer' }}>
                    {saving ? 'Кошулууда...' : '+ Кошуу'}
                  </button>
                  <button onClick={() => setShowForm(false)}
                    style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)', border: `1px solid ${BORDER}`, borderRadius: '10px', padding: '10px 20px', fontWeight: '600', fontSize: '14px', cursor: 'pointer' }}>
                    Жокко чыгаруу
                  </button>
                </div>
              </div>
            </Animate>
          )}

          {/* KANBAN */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '10px', overflowX: 'auto' }}>
            {stages.map(stage => {
              const stageLeads = filtered.filter(l => l.stage === stage.id)
              return (
                <div key={stage.id} style={{ minWidth: '150px' }}>
                  <div style={{ background: stage.bg, border: `1px solid ${stage.color}44`, borderRadius: '10px', padding: '8px 10px', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: '11px', fontWeight: '700', color: stage.color }}>{stage.label}</div>
                    <div style={{ background: stage.color, color: '#fff', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: '800' }}>{stageLeads.length}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {stageLeads.map(lead => (
                      <div key={lead.id}
                        onClick={() => { setSelectedLead(lead); setNote(lead.note || '') }}
                        style={{ background: selectedLead?.id === lead.id ? 'rgba(37,99,235,0.2)' : SURFACE, border: `1px solid ${selectedLead?.id === lead.id ? BLUE : BORDER}`, borderRadius: '10px', padding: '10px', cursor: 'pointer' }}>
                        <div style={{ fontWeight: '700', fontSize: '12px', marginBottom: '3px' }}>{lead.full_name}</div>
                        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginBottom: '6px' }}>{lead.phone}</div>
                        <div style={{ fontSize: '10px', background: 'rgba(37,99,235,0.15)', color: '#60A5FA', borderRadius: '4px', padding: '2px 6px', display: 'inline-block' }}>{lead.course}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* LEAD DETAIL */}
        {selectedLead && (
          <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: '20px', padding: '24px', height: 'fit-content', position: 'sticky', top: '88px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div style={{ fontWeight: '800', fontSize: '16px' }}>Клиент карточкасы</div>
              <button onClick={() => setSelectedLead(null)}
                style={{ background: 'rgba(255,255,255,0.08)', border: 'none', width: '28px', height: '28px', borderRadius: '50%', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '14px' }}>✕</button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              <div style={{ width: '48px', height: '48px', background: BLUE, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900', fontSize: '18px' }}>
                {selectedLead.full_name?.[0]}
              </div>
              <div>
                <div style={{ fontWeight: '800', fontSize: '16px' }}>{selectedLead.full_name}</div>
                <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', marginTop: '2px' }}>{selectedLead.phone}</div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
              <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '10px', padding: '12px' }}>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginBottom: '4px' }}>Курс</div>
                <div style={{ fontWeight: '600', fontSize: '14px' }}>{selectedLead.course}</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '10px', padding: '12px' }}>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginBottom: '4px' }}>Катталган күн</div>
                <div style={{ fontWeight: '600', fontSize: '14px' }}>{new Date(selectedLead.created_at).toLocaleDateString('ru')}</div>
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginBottom: '8px' }}>Этап</div>
              <select value={selectedLead.stage} onChange={e => updateStage(selectedLead.id, e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: `1px solid ${BORDER}`, background: DARK, color: '#fff', fontSize: '13px', boxSizing: 'border-box' as const }}>
                {stages.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginBottom: '8px' }}>Эскертүү</div>
              <textarea value={note} onChange={e => setNote(e.target.value)}
                placeholder="Комментарий жазыңыз..."
                rows={3}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: `1px solid ${BORDER}`, background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: '13px', resize: 'none', boxSizing: 'border-box' as const }} />
              <button onClick={updateNote}
                style={{ marginTop: '8px', background: BLUE, color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>
                Сактоо
              </button>
            </div>

            <button onClick={() => deleteLead(selectedLead.id)}
              style={{ width: '100%', background: 'rgba(239,68,68,0.1)', color: '#FCA5A5', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '10px', padding: '10px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>
              🗑 Клиентти өчүрүү
            </button>
          </div>
        )}
      </div>
    </div>
  )
}