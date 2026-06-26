'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'
import Navbar from '@/components/Navbar'

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
const DARK = '#F5F5F7'
const SURFACE = '#ffffff'
const BORDER = '#E5E5EA'

const stages = [
  { id: 'new', label: 'Жаңы заявка', color: '#6B7280' },
  { id: 'call', label: 'Биринчи чалуу', color: '#3B82F6' },
  { id: 'consult', label: 'Консультация', color: '#8B5CF6' },
  { id: 'trial', label: 'Сынак сабак', color: '#F59E0B' },
  { id: 'payment', label: 'Оплата', color: '#EF4444' },
  { id: 'studying', label: 'Окуп жатат', color: '#10B981' },
  { id: 'graduate', label: 'Бүтүрүүчү', color: '#F0C040' },
]

const sources = [
  { id: 'instagram', label: 'Instagram' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'friend', label: 'Сарафан' },
  { id: 'tiktok', label: 'TikTok' },
  { id: 'other', label: 'Башка' },
]

const tabs = [
  { id: 'dashboard', label: '📊 Дашборд' },
  { id: 'crm', label: '🎯 CRM' },
]

export default function ManagerPage() {
  const [leads, setLeads] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('dashboard')
  const [showForm, setShowForm] = useState(false)
  const [selectedLead, setSelectedLead] = useState<any>(null)
  const [search, setSearch] = useState('')
  const [filterStage, setFilterStage] = useState('all')
  const [newLead, setNewLead] = useState({ full_name: '', phone: '', course: 'B1', stage: 'new', note: '', source: 'instagram' })
  const [saving, setSaving] = useState(false)
  const [note, setNote] = useState('')
  const router = useRouter()

  useEffect(() => { checkAuth() }, [])

  const checkAuth = async () => {
    await supabase.auth.getSession()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (!profile || profile.role !== 'manager') { await supabase.auth.signOut(); router.push('/'); return }
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
    setNewLead({ full_name: '', phone: '', course: 'B1', stage: 'new', note: '', source: 'instagram' })
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

  // ANALYTICS
  const total = leads.length
  const studying = leads.filter(l => l.stage === 'studying' || l.stage === 'graduate').length
  const conversion = total > 0 ? Math.round((studying / total) * 100) : 0

  const stageData = stages.map(s => ({
    name: s.label,
    value: leads.filter(l => l.stage === s.id).length,
    color: s.color,
  })).filter(s => s.value > 0)

  const sourceData = sources.map(s => ({
    name: s.label,
    value: leads.filter(l => l.source === s.id).length,
    color: s.id === 'instagram' ? '#E1306C' : s.id === 'whatsapp' ? '#25D366' : s.id === 'tiktok' ? '#69C9D0' : s.id === 'friend' ? '#F59E0B' : '#6B7280',
  })).filter(s => s.value > 0)

  const monthData = (() => {
    const months: Record<string, number> = {}
    leads.forEach(l => {
      const month = new Date(l.created_at).toLocaleDateString('ru', { month: 'short', year: '2-digit' })
      months[month] = (months[month] || 0) + 1
    })
    return Object.entries(months).map(([name, value]) => ({ name, value })).slice(-6)
  })()

  const courseData = ['B1', 'B2', 'C1', 'Жайкы интенсив'].map(c => ({
    name: c,
    value: leads.filter(l => l.course === c).length,
  })).filter(c => c.value > 0)

  const filtered = leads.filter(l => {
    const matchSearch = l.full_name?.toLowerCase().includes(search.toLowerCase()) || l.phone?.includes(search)
    const matchStage = filterStage === 'all' || l.stage === filterStage
    return matchSearch && matchStage
  })

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#F5F5F7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ textAlign: 'center' }}>
        <img src="/images/logo.png" alt="Zhangak" style={{ width: '48px', filter: 'brightness(0) invert(1)', marginBottom: '16px' }} />
        <div style={{ color: '#6B6B6B', fontSize: '14px' }}>Жүктөлүүдө...</div>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#F5F5F7', fontFamily: 'Inter, sans-serif', color: '#fff' }}>

      {/* NAVBAR */}
     <Navbar
  tabs={tabs}
  activeTab={activeTab}
  onTabChange={(id) => setActiveTab(id)}
  role="🎯 Менеджер"
/>
      <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>

        {/* DASHBOARD TAB */}
        {activeTab === 'dashboard' && (
          <div>
            {/* WELCOME */}
            <Animate>
              <div style={{ marginBottom: '24px' }}>
                <h1 style={{ fontSize: '24px', fontWeight: '900', marginBottom: '4px', color: '#1D1D1F' }}>Кош келиңиз! 👋</h1>
                <div style={{ color: '#6B6B6B', fontSize: '14px' }}>
                  Бүгүн {leads.filter(l => {
                    const today = new Date().toDateString()
                    return new Date(l.created_at).toDateString() === today
                  }).length} жаңы заявка келди
                </div>
              </div>
            </Animate>

            {/* TOP STATS */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '16px', marginBottom: '24px' }}>
              {[
                { label: 'Жалпы лид', value: total, icon: '👥', color: '#60A5FA', bg: 'rgba(96,165,250,0.1)', change: '+' + leads.filter(l => new Date(l.created_at) > new Date(Date.now() - 7*24*60*60*1000)).length + ' бул жума' },
                { label: 'Окуп жатат', value: studying, icon: '🎓', color: '#34D399', bg: 'rgba(52,211,153,0.1)', change: Math.round(studying/Math.max(total,1)*100) + '% конверсия' },
                { label: 'Конверсия', value: conversion + '%', icon: '📈', color: '#A78BFA', bg: 'rgba(167,139,250,0.1)', change: 'Заявка → Окуучу' },
                { label: 'Жаңы заявка', value: leads.filter(l => l.stage === 'new').length, icon: '🔔', color: '#FCD34D', bg: 'rgba(252,211,77,0.1)', change: 'Иштетүү керек' },
              ].map((s, i) => (
                <Animate key={i} delay={i * 80}>
                  <div style={{ background: '#ffffff', border: `1px solid ${BORDER}`, borderRadius: '16px', padding: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                      <div style={{ width: '40px', height: '40px', background: s.bg, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>{s.icon}</div>
                    </div>
                    <div style={{ fontWeight: '900', fontSize: '28px', color: s.color, marginBottom: '4px' }}>{s.value}</div>
                    <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', marginBottom: '4px' }}>{s.label}</div>
                    <div style={{ fontSize: '11px', color: '#AEAEB2' }}>{s.change}</div>
                  </div>
                </Animate>
              ))}
            </div>

            {/* CHARTS ROW 1 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>

              {/* LINE CHART */}
              <Animate delay={100}>
                <div style={{ background: '#ffffff', border: `1px solid ${BORDER}`, borderRadius: '16px', padding: '20px' }}>
                  <div style={{ fontWeight: '700', fontSize: '14px', marginBottom: '4px' }}>📈 Заявкалар динамикасы</div>
                  <div style={{ fontSize: '12px', color: '#8A8A8E', marginBottom: '16px' }}>Акыркы 6 ай</div>
                  {monthData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={monthData}>
                        <XAxis dataKey="name" tick={{ fill: '#8A8A8E', fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: '#8A8A8E', fontSize: 11 }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ background: '#ffffff', border: `1px solid ${BORDER}`, borderRadius: '8px', color: '#fff' }} />
                        <Line type="monotone" dataKey="value" stroke={BLUE} strokeWidth={2} dot={{ fill: BLUE, r: 4 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#AEAEB2', fontSize: '13px' }}>
                      Маалымат жок
                    </div>
                  )}
                </div>
              </Animate>

              {/* FUNNEL */}
              <Animate delay={150}>
                <div style={{ background: '#ffffff', border: `1px solid ${BORDER}`, borderRadius: '16px', padding: '20px' }}>
                  <div style={{ fontWeight: '700', fontSize: '14px', marginBottom: '4px' }}>🎯 Воронка</div>
                  <div style={{ fontSize: '12px', color: '#8A8A8E', marginBottom: '16px' }}>Этаптар боюнча</div>
                  {stageData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={stageData} layout="vertical">
                        <XAxis type="number" tick={{ fill: '#8A8A8E', fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis type="category" dataKey="name" tick={{ fill: '#8A8A8E', fontSize: 10 }} axisLine={false} tickLine={false} width={90} />
                        <Tooltip contentStyle={{ background: '#ffffff', border: `1px solid ${BORDER}`, borderRadius: '8px', color: '#fff' }} />
                        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                          {stageData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#AEAEB2', fontSize: '13px' }}>
                      Маалымат жок
                    </div>
                  )}
                </div>
              </Animate>
            </div>

            {/* CHARTS ROW 2 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>

              {/* SOURCE PIE */}
              <Animate delay={200}>
                <div style={{ background: '#ffffff', border: `1px solid ${BORDER}`, borderRadius: '16px', padding: '20px' }}>
                  <div style={{ fontWeight: '700', fontSize: '14px', marginBottom: '4px' }}>📱 Булактар</div>
                  <div style={{ fontSize: '12px', color: '#8A8A8E', marginBottom: '16px' }}>Кайдан келишет</div>
                  {sourceData.length > 0 ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                      <PieChart width={160} height={160}>
                        <Pie data={sourceData} cx={75} cy={75} innerRadius={45} outerRadius={70} dataKey="value" paddingAngle={3}>
                          {sourceData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                        </Pie>
                        <Tooltip contentStyle={{ background: '#ffffff', border: `1px solid ${BORDER}`, borderRadius: '8px', color: '#fff' }} />
                      </PieChart>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {sourceData.map((s, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                            <span style={{ fontSize: '12px', color: '#6B6B6B' }}>{s.name}</span>
                            <span style={{ fontSize: '12px', fontWeight: '700', color: '#fff', marginLeft: 'auto' }}>{s.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div style={{ height: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#AEAEB2', fontSize: '13px' }}>
                      Маалымат жок
                    </div>
                  )}
                </div>
              </Animate>

              {/* COURSE BAR */}
              <Animate delay={250}>
                <div style={{ background: '#ffffff', border: `1px solid ${BORDER}`, borderRadius: '16px', padding: '20px' }}>
                  <div style={{ fontWeight: '700', fontSize: '14px', marginBottom: '4px' }}>📚 Курстар</div>
                  <div style={{ fontSize: '12px', color: '#8A8A8E', marginBottom: '16px' }}>Кайсы курска жазылышат</div>
                  {courseData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={160}>
                      <BarChart data={courseData}>
                        <XAxis dataKey="name" tick={{ fill: '#8A8A8E', fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: '#8A8A8E', fontSize: 11 }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ background: '#ffffff', border: `1px solid ${BORDER}`, borderRadius: '8px', color: '#fff' }} />
                        <Bar dataKey="value" fill={BLUE} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div style={{ height: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#AEAEB2', fontSize: '13px' }}>
                      Маалымат жок
                    </div>
                  )}
                </div>
              </Animate>
            </div>

            {/* RECENT LEADS */}
            <Animate delay={300}>
              <div style={{ background: '#ffffff', border: `1px solid ${BORDER}`, borderRadius: '16px', overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontWeight: '700', fontSize: '14px' }}>🕐 Акыркы заявкалар</div>
                  <button onClick={() => setActiveTab('crm')} style={{ background: 'rgba(37,99,235,0.15)', color: '#60A5FA', border: 'none', borderRadius: '8px', padding: '5px 12px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
                    Баарын көрүү →
                  </button>
                </div>
                <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                      {['Аты-жөнү', 'Телефон', 'Курс', 'Булак', 'Этап', 'Күн'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '10px 16px', color: '#8A8A8E', fontWeight: '600', fontSize: '11px' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {leads.slice(0, 8).map((l, i) => {
                      const stage = stages.find(s => s.id === l.stage)
                      const source = sources.find(s => s.id === l.source)
                      return (
                        <tr key={l.id} style={{ borderBottom: i < 7 ? `1px solid ${BORDER}` : 'none', cursor: 'pointer' }}
                          onClick={() => { setActiveTab('crm'); setSelectedLead(l); setNote(l.note || '') }}>
                          <td style={{ padding: '10px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{ width: '28px', height: '28px', background: BLUE, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '700', flexShrink: 0 }}>{l.full_name?.[0]}</div>
                              <span style={{ fontWeight: '600' }}>{l.full_name}</span>
                            </div>
                          </td>
                          <td style={{ padding: '10px 16px', color: '#6B6B6B' }}>{l.phone}</td>
                          <td style={{ padding: '10px 16px' }}>
                            <span style={{ background: 'rgba(37,99,235,0.15)', color: '#60A5FA', borderRadius: '6px', padding: '2px 8px', fontSize: '11px', fontWeight: '600' }}>{l.course}</span>
                          </td>
                          <td style={{ padding: '10px 16px', color: '#6B6B6B', fontSize: '12px' }}>{source?.label || '—'}</td>
                          <td style={{ padding: '10px 16px' }}>
                            <span style={{ background: `${stage?.color}22`, color: stage?.color, borderRadius: '6px', padding: '2px 8px', fontSize: '11px', fontWeight: '600' }}>{stage?.label}</span>
                          </td>
                          <td style={{ padding: '10px 16px', color: '#8A8A8E', fontSize: '11px' }}>{new Date(l.created_at).toLocaleDateString('ru')}</td>
                        </tr>
                      )
                    })}
                    {leads.length === 0 && (
                      <tr><td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: '#AEAEB2' }}>Заявкалар жок</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Animate>
          </div>
        )}

        {/* CRM TAB */}
        {activeTab === 'crm' && (
          <div style={{ display: 'grid', gridTemplateColumns: selectedLead ? '1fr 360px' : '1fr', gap: '24px' }}>
            <div>
              {/* TOOLBAR */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="🔍 Издөө..."
                  style={{ flex: 1, minWidth: '200px', padding: '10px 14px', borderRadius: '10px', border: `1px solid ${BORDER}`, background: '#ffffff', color: '#1D1D1F', fontSize: '14px', outline: 'none' }} />
                <select value={filterStage} onChange={e => setFilterStage(e.target.value)}
                  style={{ padding: '10px 14px', borderRadius: '10px', border: `1px solid ${BORDER}`, background: '#ffffff', color: '#1D1D1F', fontSize: '13px' }}>
                  <option value="all">Бардык этап</option>
                  {stages.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
                <button onClick={() => setShowForm(p => !p)}
                  style={{ background: BLUE, color: '#fff', border: 'none', borderRadius: '10px', padding: '10px 20px', fontWeight: '700', fontSize: '14px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  + Жаңы клиент
                </button>
              </div>

              {/* ADD FORM */}
              {showForm && (
                <Animate>
                  <div style={{ background: '#ffffff', border: `1px solid ${BORDER}`, borderRadius: '16px', padding: '20px', marginBottom: '20px' }}>
                    <div style={{ fontWeight: '700', fontSize: '15px', marginBottom: '16px' }}>Жаңы клиент</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px', marginBottom: '12px' }}>
                      {[
                        { label: 'Аты-жөнү *', key: 'full_name', placeholder: 'Иванов Айбек' },
                        { label: 'Телефон *', key: 'phone', placeholder: '+996 700 000 000' },
                      ].map(f => (
                        <div key={f.key}>
                          <div style={{ fontSize: '12px', color: '#8A8A8E', marginBottom: '6px' }}>{f.label}</div>
                          <input value={(newLead as any)[f.key]} onChange={e => setNewLead(p => ({ ...p, [f.key]: e.target.value }))}
                            placeholder={f.placeholder}
                            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${BORDER}`, background: '#F5F5F7', color: '#1D1D1F', fontSize: '13px', boxSizing: 'border-box' as const }} />
                        </div>
                      ))}
                      <div>
                        <div style={{ fontSize: '12px', color: '#8A8A8E', marginBottom: '6px' }}>Курс</div>
                        <select value={newLead.course} onChange={e => setNewLead(p => ({ ...p, course: e.target.value }))}
                          style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${BORDER}`, background: '#F5F5F7', color: '#fff', fontSize: '13px', boxSizing: 'border-box' as const }}>
                          {['B1', 'B2', 'C1', 'Жайкы интенсив'].map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div>
                        <div style={{ fontSize: '12px', color: '#8A8A8E', marginBottom: '6px' }}>Булак</div>
                        <select value={newLead.source} onChange={e => setNewLead(p => ({ ...p, source: e.target.value }))}
                          style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${BORDER}`, background: '#F5F5F7', color: '#fff', fontSize: '13px', boxSizing: 'border-box' as const }}>
                          {sources.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <div style={{ fontSize: '12px', color: '#8A8A8E', marginBottom: '6px' }}>Этап</div>
                        <select value={newLead.stage} onChange={e => setNewLead(p => ({ ...p, stage: e.target.value }))}
                          style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${BORDER}`, background: '#F5F5F7', color: '#fff', fontSize: '13px', boxSizing: 'border-box' as const }}>
                          {stages.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                        </select>
                      </div>
                    </div>
                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ fontSize: '12px', color: '#8A8A8E', marginBottom: '6px' }}>Эскертүү</div>
                      <input value={newLead.note} onChange={e => setNewLead(p => ({ ...p, note: e.target.value }))}
                        placeholder="Кошумча маалымат..."
                        style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${BORDER}`, background: '#F5F5F7', color: '#1D1D1F', fontSize: '13px', boxSizing: 'border-box' as const }} />
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button onClick={createLead} disabled={saving}
                        style={{ background: BLUE, color: '#fff', border: 'none', borderRadius: '10px', padding: '10px 24px', fontWeight: '700', fontSize: '14px', cursor: 'pointer' }}>
                        {saving ? '...' : '+ Кошуу'}
                      </button>
                      <button onClick={() => setShowForm(false)}
                        style={{ background: 'rgba(255,255,255,0.05)', color: '#6B6B6B', border: `1px solid ${BORDER}`, borderRadius: '10px', padding: '10px 20px', fontWeight: '600', fontSize: '14px', cursor: 'pointer' }}>
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
                    <div key={stage.id} style={{ minWidth: '140px' }}>
                      <div style={{ background: `${stage.color}22`, border: `1px solid ${stage.color}44`, borderRadius: '10px', padding: '7px 10px', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ fontSize: '10px', fontWeight: '700', color: stage.color }}>{stage.label}</div>
                        <div style={{ background: stage.color, color: '#fff', borderRadius: '50%', width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: '800' }}>{stageLeads.length}</div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {stageLeads.map(lead => (
                          <div key={lead.id} onClick={() => { setSelectedLead(lead); setNote(lead.note || '') }}
                            style={{ background: selectedLead?.id === lead.id ? 'rgba(37,99,235,0.2)' : '#ffffff', border: `1px solid ${selectedLead?.id === lead.id ? BLUE : BORDER}`, borderRadius: '10px', padding: '10px', cursor: 'pointer', transition: 'all 0.15s' }}>
                            <div style={{ fontWeight: '700', fontSize: '12px', marginBottom: '3px', color: '#1D1D1F' }}>{lead.full_name}</div>
                            <div style={{ fontSize: '10px', color: '#8A8A8E', marginBottom: '5px' }}>{lead.phone}</div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <div style={{ fontSize: '10px', background: 'rgba(37,99,235,0.15)', color: '#60A5FA', borderRadius: '4px', padding: '1px 6px' }}>{lead.course}</div>
                              {lead.note && <span style={{ fontSize: '10px' }}>📝</span>}
                            </div>
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
              <div style={{ background: '#ffffff', border: `1px solid ${BORDER}`, borderRadius: '20px', padding: '24px', height: 'fit-content', position: 'sticky', top: '88px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                  <div style={{ fontWeight: '800', fontSize: '15px' }}>Клиент карточкасы</div>
                  <button onClick={() => setSelectedLead(null)} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', width: '26px', height: '26px', borderRadius: '50%', color: '#6B6B6B', cursor: 'pointer', fontSize: '13px' }}>✕</button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                  <div style={{ width: '44px', height: '44px', background: BLUE, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900', fontSize: '16px' }}>{selectedLead.full_name?.[0]}</div>
                  <div>
                    <div style={{ fontWeight: '800', fontSize: '15px' }}>{selectedLead.full_name}</div>
                    <div style={{ fontSize: '12px', color: '#6B6B6B', marginTop: '2px' }}>{selectedLead.phone}</div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
                  {[
                    { label: 'Курс', value: selectedLead.course },
                    { label: 'Булак', value: sources.find(s => s.id === selectedLead.source)?.label || '—' },
                    { label: 'Катталган', value: new Date(selectedLead.created_at).toLocaleDateString('ru') },
                  ].map(item => (
                    <div key={item.label} style={{ background: '#F5F5F7', borderRadius: '8px', padding: '10px' }}>
                      <div style={{ fontSize: '10px', color: '#8A8A8E', marginBottom: '3px' }}>{item.label}</div>
                      <div style={{ fontWeight: '600', fontSize: '13px' }}>{item.value}</div>
                    </div>
                  ))}
                </div>
                <div style={{ marginBottom: '14px' }}>
                  <div style={{ fontSize: '12px', color: '#8A8A8E', marginBottom: '6px' }}>Этап</div>
                  <select value={selectedLead.stage} onChange={e => updateStage(selectedLead.id, e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: `1px solid ${BORDER}`, background: '#F5F5F7', color: '#fff', fontSize: '13px', boxSizing: 'border-box' as const }}>
                    {stages.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                </div>
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '12px', color: '#8A8A8E', marginBottom: '6px' }}>Эскертүү</div>
                  <textarea value={note} onChange={e => setNote(e.target.value)} rows={3}
                    placeholder="Комментарий..."
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: `1px solid ${BORDER}`, background: '#F5F5F7', color: '#1D1D1F', fontSize: '13px', resize: 'none', boxSizing: 'border-box' as const }} />
                  <button onClick={updateNote} style={{ marginTop: '6px', background: BLUE, color: '#fff', border: 'none', borderRadius: '8px', padding: '7px 16px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>Сактоо</button>
                </div>
                <button onClick={() => deleteLead(selectedLead.id)}
                  style={{ width: '100%', background: 'rgba(239,68,68,0.1)', color: '#FCA5A5', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '10px', padding: '9px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>
                  🗑 Өчүрүү
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}