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

const BLUE = '#1B4FD8'
const BG = '#F8FAFF'
const WHITE = '#ffffff'
const BORDER = '#E2E8F0'
const TEXT = '#0D1E4A'
const MUTED = '#64748B'
const LIGHT = '#94A3B8'

const stages = [
  { id: 'new',      label: 'Жаңы заявка',   color: '#6B7280' },
  { id: 'call',     label: 'Биринчи чалуу', color: '#3B82F6' },
  { id: 'consult',  label: 'Консультация',  color: '#8B5CF6' },
  { id: 'trial',    label: 'Сынак сабак',   color: '#F59E0B' },
  { id: 'payment',  label: 'Оплата',        color: '#EF4444' },
  { id: 'studying', label: 'Окуп жатат',    color: '#10B981' },
  { id: 'graduate', label: 'Бүтүрүүчү',    color: '#F0C040' },
]

const sources = [
  { id: 'instagram', label: 'Instagram' },
  { id: 'whatsapp',  label: 'WhatsApp' },
  { id: 'friend',    label: 'Сарафан' },
  { id: 'tiktok',    label: 'TikTok' },
  { id: 'other',     label: 'Башка' },
]

const tabs = [
  { id: 'dashboard', label: '📊 Дашборд' },
  { id: 'crm',       label: '🎯 CRM' },
]

const inp: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 8,
  border: `1px solid ${BORDER}`, background: BG,
  color: TEXT, fontSize: 13, boxSizing: 'border-box', outline: 'none',
}

// ─── AI Assistant Component ────────────────────────────────────────────────────
function AIAssistant({ lead }: { lead: any }) {
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const quickPrompts = [
    '💬 Чалуу скрипти жаз',
    '📧 WhatsApp кат жаз',
    '🎯 Кантип конвертациялоо?',
    '❓ Каршылыкты кантип иштетүү?',
  ]

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (text?: string) => {
    const userMsg = text || input
    if (!userMsg.trim()) return
    setInput('')
    setLoading(true)

    const newMessages = [...messages, { role: 'user', content: userMsg }]
    setMessages(newMessages)

    const systemPrompt = `Сен Жаңгак окуу борборунун AI помощниги — менеджерге жардам берүүчү. 
Азыркы лид жөнүндө маалымат:
- Аты: ${lead.full_name}
- Телефон: ${lead.phone}
- Курс: ${lead.course}
- Этап: ${stages.find(s => s.id === lead.stage)?.label}
- Булак: ${sources.find(s => s.id === lead.source)?.label}
- Эскертүү: ${lead.note || 'жок'}

Кыргыз тилинде жооп бер. Конкреттүү, практикалуу жардам бер. Скрипт сурасаң — даяр текст жаз.`

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1000,
          system: systemPrompt,
          messages: newMessages,
        }),
      })
      const data = await response.json()
      const aiMsg = data.content?.[0]?.text || 'Жооп алынган жок'
      setMessages([...newMessages, { role: 'assistant', content: aiMsg }])
    } catch {
      setMessages([...newMessages, { role: 'assistant', content: 'Ката чыкты. Кайра аракет кылыңыз.' }])
    }
    setLoading(false)
  }

  if (!open) return (
    <button onClick={() => setOpen(true)}
      style={{ width: '100%', background: 'linear-gradient(135deg,#1B4FD8,#7C3AED)', color: '#fff', border: 'none', borderRadius: '12px', padding: '11px', fontWeight: '700', fontSize: '14px', cursor: 'pointer', marginTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
      ✨ AI Помощник
    </button>
  )

  return (
    <div style={{ marginTop: '12px', border: '1px solid #C7D2FE', borderRadius: '16px', overflow: 'hidden', background: '#fff' }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg,#1B4FD8,#7C3AED)', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '16px' }}>✨</span>
          <span style={{ color: '#fff', fontWeight: '700', fontSize: '14px' }}>AI Помощник</span>
        </div>
        <button onClick={() => setOpen(false)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '6px', padding: '3px 8px', color: '#fff', cursor: 'pointer', fontSize: '12px' }}>✕</button>
      </div>

      {/* Quick prompts */}
      {messages.length === 0 && (
        <div style={{ padding: '12px', borderBottom: '1px solid #E2E8F0' }}>
          <div style={{ fontSize: '11px', color: LIGHT, marginBottom: '8px', fontWeight: '600' }}>Тез суроолор:</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {quickPrompts.map(p => (
              <button key={p} onClick={() => sendMessage(p)}
                style={{ background: '#EEF2FF', color: BLUE, border: '1px solid #C7D2FE', borderRadius: '8px', padding: '5px 10px', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}>
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div style={{ height: '240px', overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', color: LIGHT, fontSize: '13px', marginTop: '60px' }}>
            Суроо бериңиз — жардам берем
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{
              maxWidth: '85%', padding: '8px 12px', borderRadius: m.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
              background: m.role === 'user' ? BLUE : '#F8FAFF',
              color: m.role === 'user' ? '#fff' : TEXT,
              fontSize: '12px', lineHeight: '1.6',
              border: m.role === 'assistant' ? '1px solid #E2E8F0' : 'none',
              whiteSpace: 'pre-wrap',
            }}>
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{ background: '#F8FAFF', border: '1px solid #E2E8F0', borderRadius: '12px 12px 12px 2px', padding: '8px 14px', fontSize: '18px' }}>
              <span style={{ animation: 'pulse 1s ease infinite', display: 'inline-block' }}>•••</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '10px 12px', borderTop: '1px solid #E2E8F0', display: 'flex', gap: '8px' }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
          placeholder="Суроо жазыңыз..."
          style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '12px', outline: 'none', color: TEXT, background: '#F8FAFF' }}
        />
        <button onClick={() => sendMessage()} disabled={loading || !input.trim()}
          style={{ background: loading || !input.trim() ? '#E2E8F0' : BLUE, color: loading || !input.trim() ? LIGHT : '#fff', border: 'none', borderRadius: '8px', padding: '8px 14px', fontWeight: '700', fontSize: '12px', cursor: loading || !input.trim() ? 'not-allowed' : 'pointer' }}>
          →
        </button>
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
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

  const total = leads.length
  const studying = leads.filter(l => l.stage === 'studying' || l.stage === 'graduate').length
  const conversion = total > 0 ? Math.round((studying / total) * 100) : 0

  const stageData = stages.map(s => ({ name: s.label, value: leads.filter(l => l.stage === s.id).length, color: s.color })).filter(s => s.value > 0)
  const sourceData = sources.map(s => ({ name: s.label, value: leads.filter(l => l.source === s.id).length, color: s.id === 'instagram' ? '#E1306C' : s.id === 'whatsapp' ? '#25D366' : s.id === 'tiktok' ? '#69C9D0' : s.id === 'friend' ? '#F59E0B' : '#6B7280' })).filter(s => s.value > 0)
  const monthData = (() => {
    const months: Record<string, number> = {}
    leads.forEach(l => { const month = new Date(l.created_at).toLocaleDateString('ru', { month: 'short', year: '2-digit' }); months[month] = (months[month] || 0) + 1 })
    return Object.entries(months).map(([name, value]) => ({ name, value })).slice(-6)
  })()
  const courseData = ['B1', 'B2', 'C1', 'Жайкы интенсив'].map(c => ({ name: c, value: leads.filter(l => l.course === c).length })).filter(c => c.value > 0)
  const filtered = leads.filter(l => {
    const matchSearch = l.full_name?.toLowerCase().includes(search.toLowerCase()) || l.phone?.includes(search)
    const matchStage = filterStage === 'all' || l.stage === filterStage
    return matchSearch && matchStage
  })

  if (loading) return (
    <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 48, height: 48, background: BLUE, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 800, color: WHITE, margin: '0 auto 12px' }}>Ж</div>
        <div style={{ color: MUTED, fontSize: 14 }}>Жүктөлүүдө...</div>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: BG, fontFamily: 'Inter, -apple-system, sans-serif', color: TEXT }}>
      <style>{`@keyframes pulse { 0%,100%{opacity:0.4} 50%{opacity:1} }`}</style>

      <Navbar tabs={tabs} activeTab={activeTab} onTabChange={(id) => { setActiveTab(id); setShowForm(false) }} role="🎯 Менеджер" />

      <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>

        {/* ── DASHBOARD ── */}
        {activeTab === 'dashboard' && (
          <div>
            <Animate>
              <div style={{ marginBottom: 24 }}>
                <h1 style={{ fontSize: 24, fontWeight: 900, marginBottom: 4, color: TEXT }}>Кош келиңиз! 👋</h1>
                <div style={{ color: MUTED, fontSize: 14 }}>
                  Бүгүн {leads.filter(l => new Date(l.created_at).toDateString() === new Date().toDateString()).length} жаңы заявка келди
                </div>
              </div>
            </Animate>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 24 }}>
              {[
                { label: 'Жалпы лид', value: total, icon: '👥', color: '#3B82F6', bg: '#EFF6FF', change: '+' + leads.filter(l => new Date(l.created_at) > new Date(Date.now() - 7*24*60*60*1000)).length + ' бул жума' },
                { label: 'Окуп жатат', value: studying, icon: '🎓', color: '#10B981', bg: '#ECFDF5', change: Math.round(studying/Math.max(total,1)*100) + '% конверсия' },
                { label: 'Конверсия', value: conversion + '%', icon: '📈', color: '#8B5CF6', bg: '#F5F3FF', change: 'Заявка → Окуучу' },
                { label: 'Жаңы заявка', value: leads.filter(l => l.stage === 'new').length, icon: '🔔', color: '#F59E0B', bg: '#FFFBEB', change: 'Иштетүү керек' },
              ].map((s, i) => (
                <Animate key={i} delay={i * 80}>
                  <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 20 }}>
                    <div style={{ width: 40, height: 40, background: s.bg, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, marginBottom: 12 }}>{s.icon}</div>
                    <div style={{ fontWeight: 900, fontSize: 28, color: s.color, marginBottom: 4 }}>{s.value}</div>
                    <div style={{ fontSize: 13, color: TEXT, fontWeight: 600, marginBottom: 4 }}>{s.label}</div>
                    <div style={{ fontSize: 11, color: LIGHT }}>{s.change}</div>
                  </div>
                </Animate>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <Animate delay={100}>
                <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 20 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: TEXT, marginBottom: 4 }}>📈 Заявкалар динамикасы</div>
                  <div style={{ fontSize: 12, color: LIGHT, marginBottom: 16 }}>Акыркы 6 ай</div>
                  {monthData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={monthData}>
                        <XAxis dataKey="name" tick={{ fill: LIGHT, fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: LIGHT, fontSize: 11 }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 8, color: TEXT, fontSize: 12 }} />
                        <Line type="monotone" dataKey="value" stroke={BLUE} strokeWidth={2} dot={{ fill: BLUE, r: 4 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: LIGHT, fontSize: 13 }}>Маалымат жок</div>}
                </div>
              </Animate>

              <Animate delay={150}>
                <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 20 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: TEXT, marginBottom: 4 }}>🎯 Воронка</div>
                  <div style={{ fontSize: 12, color: LIGHT, marginBottom: 16 }}>Этаптар боюнча</div>
                  {stageData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={stageData} layout="vertical">
                        <XAxis type="number" tick={{ fill: LIGHT, fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis type="category" dataKey="name" tick={{ fill: LIGHT, fontSize: 10 }} axisLine={false} tickLine={false} width={90} />
                        <Tooltip contentStyle={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 8, color: TEXT, fontSize: 12 }} />
                        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                          {stageData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: LIGHT, fontSize: 13 }}>Маалымат жок</div>}
                </div>
              </Animate>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <Animate delay={200}>
                <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 20 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: TEXT, marginBottom: 4 }}>📱 Булактар</div>
                  <div style={{ fontSize: 12, color: LIGHT, marginBottom: 16 }}>Кайдан келишет</div>
                  {sourceData.length > 0 ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                      <PieChart width={160} height={160}>
                        <Pie data={sourceData} cx={75} cy={75} innerRadius={45} outerRadius={70} dataKey="value" paddingAngle={3}>
                          {sourceData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                        </Pie>
                        <Tooltip contentStyle={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 8, color: TEXT, fontSize: 12 }} />
                      </PieChart>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {sourceData.map((s, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 10, height: 10, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                            <span style={{ fontSize: 12, color: MUTED }}>{s.name}</span>
                            <span style={{ fontSize: 12, fontWeight: 700, color: TEXT, marginLeft: 'auto' }}>{s.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', color: LIGHT, fontSize: 13 }}>Маалымат жок</div>}
                </div>
              </Animate>

              <Animate delay={250}>
                <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 20 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: TEXT, marginBottom: 4 }}>📚 Курстар</div>
                  <div style={{ fontSize: 12, color: LIGHT, marginBottom: 16 }}>Кайсы курска жазылышат</div>
                  {courseData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={160}>
                      <BarChart data={courseData}>
                        <XAxis dataKey="name" tick={{ fill: LIGHT, fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: LIGHT, fontSize: 11 }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 8, color: TEXT, fontSize: 12 }} />
                        <Bar dataKey="value" fill={BLUE} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', color: LIGHT, fontSize: 13 }}>Маалымат жок</div>}
                </div>
              </Animate>
            </div>

            <Animate delay={300}>
              <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 16, overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: TEXT }}>🕐 Акыркы заявкалар</div>
                  <button onClick={() => setActiveTab('crm')} style={{ background: '#EFF6FF', color: BLUE, border: 'none', borderRadius: 8, padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Баарын көрүү →</button>
                </div>
                <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${BORDER}`, background: '#F9FAFB' }}>
                      {['Аты-жөнү', 'Телефон', 'Курс', 'Булак', 'Этап', 'Күн'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '10px 16px', color: LIGHT, fontWeight: 600, fontSize: 11, textTransform: 'uppercase' as const }}>{h}</th>
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
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ width: 28, height: 28, background: BLUE, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: WHITE, flexShrink: 0 }}>{l.full_name?.[0]}</div>
                              <span style={{ fontWeight: 600, color: TEXT }}>{l.full_name}</span>
                            </div>
                          </td>
                          <td style={{ padding: '10px 16px', color: MUTED }}>{l.phone}</td>
                          <td style={{ padding: '10px 16px' }}><span style={{ background: '#EFF6FF', color: BLUE, borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>{l.course}</span></td>
                          <td style={{ padding: '10px 16px', color: MUTED, fontSize: 12 }}>{source?.label || '—'}</td>
                          <td style={{ padding: '10px 16px' }}><span style={{ background: `${stage?.color}22`, color: stage?.color, borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>{stage?.label}</span></td>
                          <td style={{ padding: '10px 16px', color: LIGHT, fontSize: 11 }}>{new Date(l.created_at).toLocaleDateString('ru')}</td>
                        </tr>
                      )
                    })}
                    {leads.length === 0 && <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', color: LIGHT }}>Заявкалар жок</td></tr>}
                  </tbody>
                </table>
              </div>
            </Animate>
          </div>
        )}

        {/* ── CRM ── */}
        {activeTab === 'crm' && (
          <div style={{ display: 'grid', gridTemplateColumns: selectedLead ? '1fr 380px' : '1fr', gap: 24 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' as const }}>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Издөө..."
                  style={{ flex: 1, minWidth: 200, padding: '10px 14px', borderRadius: 10, border: `1px solid ${BORDER}`, background: WHITE, color: TEXT, fontSize: 14, outline: 'none' }} />
                <select value={filterStage} onChange={e => setFilterStage(e.target.value)}
                  style={{ padding: '10px 14px', borderRadius: 10, border: `1px solid ${BORDER}`, background: WHITE, color: TEXT, fontSize: 13 }}>
                  <option value="all">Бардык этап</option>
                  {stages.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
                <button onClick={() => setShowForm(p => !p)}
                  style={{ background: BLUE, color: WHITE, border: 'none', borderRadius: 10, padding: '10px 20px', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                  + Жаңы клиент
                </button>
              </div>

              {showForm && (
                <Animate>
                  <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 20, marginBottom: 20 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: TEXT, marginBottom: 16 }}>Жаңы клиент</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 12 }}>
                      <div>
                        <div style={{ fontSize: 12, color: LIGHT, marginBottom: 6, fontWeight: 600 }}>Аты-жөнү *</div>
                        <input value={newLead.full_name} onChange={e => setNewLead(p => ({ ...p, full_name: e.target.value }))} placeholder="Иванов Айбек" style={inp} />
                      </div>
                      <div>
                        <div style={{ fontSize: 12, color: LIGHT, marginBottom: 6, fontWeight: 600 }}>Телефон *</div>
                        <input value={newLead.phone} onChange={e => setNewLead(p => ({ ...p, phone: e.target.value }))} placeholder="+996 700 000 000" style={inp} />
                      </div>
                      <div>
                        <div style={{ fontSize: 12, color: LIGHT, marginBottom: 6, fontWeight: 600 }}>Курс</div>
                        <select value={newLead.course} onChange={e => setNewLead(p => ({ ...p, course: e.target.value }))} style={inp as React.CSSProperties}>
                          {['B1', 'B2', 'C1', 'Жайкы интенсив'].map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div>
                        <div style={{ fontSize: 12, color: LIGHT, marginBottom: 6, fontWeight: 600 }}>Булак</div>
                        <select value={newLead.source} onChange={e => setNewLead(p => ({ ...p, source: e.target.value }))} style={inp as React.CSSProperties}>
                          {sources.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <div style={{ fontSize: 12, color: LIGHT, marginBottom: 6, fontWeight: 600 }}>Этап</div>
                        <select value={newLead.stage} onChange={e => setNewLead(p => ({ ...p, stage: e.target.value }))} style={inp as React.CSSProperties}>
                          {stages.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <div style={{ fontSize: 12, color: LIGHT, marginBottom: 6, fontWeight: 600 }}>Эскертүү</div>
                        <input value={newLead.note} onChange={e => setNewLead(p => ({ ...p, note: e.target.value }))} placeholder="Кошумча маалымат..." style={inp} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button onClick={createLead} disabled={saving} style={{ background: BLUE, color: WHITE, border: 'none', borderRadius: 10, padding: '10px 24px', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                        {saving ? '...' : '+ Кошуу'}
                      </button>
                      <button onClick={() => setShowForm(false)} style={{ background: BG, color: MUTED, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '10px 20px', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
                        Жокко чыгаруу
                      </button>
                    </div>
                  </div>
                </Animate>
              )}

              {/* Kanban */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 10, overflowX: 'auto' }}>
                {stages.map(stage => {
                  const stageLeads = filtered.filter(l => l.stage === stage.id)
                  return (
                    <div key={stage.id} style={{ minWidth: 140 }}>
                      <div style={{ background: `${stage.color}18`, border: `1px solid ${stage.color}44`, borderRadius: 10, padding: '7px 10px', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: stage.color }}>{stage.label}</div>
                        <div style={{ background: stage.color, color: WHITE, borderRadius: '50%', width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800 }}>{stageLeads.length}</div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {stageLeads.map(lead => (
                          <div key={lead.id} onClick={() => { setSelectedLead(lead); setNote(lead.note || '') }}
                            style={{ background: selectedLead?.id === lead.id ? '#EFF6FF' : WHITE, border: `1px solid ${selectedLead?.id === lead.id ? BLUE : BORDER}`, borderRadius: 10, padding: 10, cursor: 'pointer', transition: 'all 0.15s' }}>
                            <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 3, color: TEXT }}>{lead.full_name}</div>
                            <div style={{ fontSize: 10, color: LIGHT, marginBottom: 5 }}>{lead.phone}</div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <div style={{ fontSize: 10, background: '#EFF6FF', color: BLUE, borderRadius: 4, padding: '1px 6px' }}>{lead.course}</div>
                              {lead.note && <span style={{ fontSize: 10 }}>📝</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Lead card */}
            {selectedLead && (
              <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 20, padding: 24, height: 'fit-content', position: 'sticky', top: 88, maxHeight: 'calc(100vh - 120px)', overflowY: 'auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                  <div style={{ fontWeight: 800, fontSize: 15, color: TEXT }}>Клиент карточкасы</div>
                  <button onClick={() => setSelectedLead(null)} style={{ background: BG, border: `1px solid ${BORDER}`, width: 28, height: 28, borderRadius: '50%', color: MUTED, cursor: 'pointer', fontSize: 13 }}>✕</button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <div style={{ width: 44, height: 44, background: BLUE, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 16, color: WHITE }}>{selectedLead.full_name?.[0]}</div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 15, color: TEXT }}>{selectedLead.full_name}</div>
                    <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>{selectedLead.phone}</div>
                  </div>
                </div>

                {/* WhatsApp button */}
                <a href={`https://wa.me/${selectedLead.phone?.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%', background: '#25D366', color: '#fff', borderRadius: '10px', padding: '10px', fontWeight: '700', fontSize: '13px', textDecoration: 'none', marginBottom: '12px' }}>
                  💬 WhatsApp менен жазуу
                </a>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                  {[
                    { label: 'Курс', value: selectedLead.course },
                    { label: 'Булак', value: sources.find(s => s.id === selectedLead.source)?.label || '—' },
                    { label: 'Катталган', value: new Date(selectedLead.created_at).toLocaleDateString('ru') },
                  ].map(item => (
                    <div key={item.label} style={{ background: BG, borderRadius: 8, padding: 10, border: `1px solid ${BORDER}` }}>
                      <div style={{ fontSize: 10, color: LIGHT, marginBottom: 3, fontWeight: 600, textTransform: 'uppercase' as const }}>{item.label}</div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: TEXT }}>{item.value}</div>
                    </div>
                  ))}
                </div>

                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 12, color: LIGHT, marginBottom: 6, fontWeight: 600 }}>Этап</div>
                  <select value={selectedLead.stage} onChange={e => updateStage(selectedLead.id, e.target.value)} style={{ ...inp, width: '100%' } as React.CSSProperties}>
                    {stages.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, color: LIGHT, marginBottom: 6, fontWeight: 600 }}>Эскертүү</div>
                  <textarea value={note} onChange={e => setNote(e.target.value)} rows={3} placeholder="Комментарий..."
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${BORDER}`, background: BG, color: TEXT, fontSize: 13, resize: 'none' as const, boxSizing: 'border-box' as const, outline: 'none' }} />
                  <button onClick={updateNote} style={{ marginTop: 6, background: BLUE, color: WHITE, border: 'none', borderRadius: 8, padding: '7px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Сактоо</button>
                </div>

                {/* AI Assistant */}
                <AIAssistant lead={selectedLead} />

                <button onClick={() => deleteLead(selectedLead.id)}
                  style={{ width: '100%', background: '#FFF0F0', color: '#D92F2F', border: '1px solid #FFCDD2', borderRadius: 10, padding: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer', marginTop: '12px' }}>
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