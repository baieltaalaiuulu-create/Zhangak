'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area } from 'recharts'

function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
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

const expenseCategories = [
  { id: 'salary',    label: 'Зарплата',      color: '#1B4FD8' },
  { id: 'marketing', label: 'Маркетинг',     color: '#EC4899' },
  { id: 'trainer',   label: 'Тренер',        color: '#8B5CF6' },
  { id: 'office',    label: 'Офис',          color: '#F59E0B' },
  { id: 'other',     label: 'Башка',         color: '#6B7280' },
]

type Tab = 'dashboard' | 'finance' | 'crm'

export default function DirectorPage() {
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('dashboard')
  const [income, setIncome] = useState<any[]>([])
  const [expenses, setExpenses] = useState<any[]>([])
  const [payments, setPayments] = useState<any[]>([])
  const [leads, setLeads] = useState<any[]>([])
  const [students, setStudents] = useState<any[]>([])
  const [showIncomeForm, setShowIncomeForm] = useState(false)
  const [showExpenseForm, setShowExpenseForm] = useState(false)
  const [newIncome, setNewIncome] = useState({ source: 'B1', amount: '', month: new Date().toISOString().slice(0,7), note: '' })
  const [newExpense, setNewExpense] = useState({ category: 'salary', subcategory: '', amount: '', month: new Date().toISOString().slice(0,7), note: '' })
  const [filterMonth, setFilterMonth] = useState(new Date().toISOString().slice(0,7))
  const [saving, setSaving] = useState(false)
  const router = useRouter()

  useEffect(() => { checkAuth() }, [])

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (!profile || profile.role !== 'director') { await supabase.auth.signOut(); router.push('/'); return }
    fetchAll()
  }

  const fetchAll = async () => {
    const [i, e, p, l, s] = await Promise.all([
      supabase.from('income').select('*').order('month'),
      supabase.from('expenses').select('*').order('month'),
      supabase.from('payments').select('*, profiles(full_name)').order('created_at', { ascending: false }),
      supabase.from('crm_leads').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('*').eq('role', 'student'),
    ])
    setIncome(i.data || [])
    setExpenses(e.data || [])
    setPayments(p.data || [])
    setLeads(l.data || [])
    setStudents(s.data || [])
    setLoading(false)
  }

  const addIncome = async () => {
    if (!newIncome.amount) return
    setSaving(true)
    await supabase.from('income').insert({ ...newIncome, amount: Number(newIncome.amount) })
    setNewIncome({ source: 'B1', amount: '', month: new Date().toISOString().slice(0,7), note: '' })
    setShowIncomeForm(false)
    fetchAll(); setSaving(false)
  }

  const addExpense = async () => {
    if (!newExpense.amount) return
    setSaving(true)
    await supabase.from('expenses').insert({ ...newExpense, amount: Number(newExpense.amount) })
    setNewExpense({ category: 'salary', subcategory: '', amount: '', month: new Date().toISOString().slice(0,7), note: '' })
    setShowExpenseForm(false)
    fetchAll(); setSaving(false)
  }

  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/') }

  // Analytics
  const months = (() => {
    const m = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i)
      m.push(d.toISOString().slice(0,7))
    }
    return m
  })()

  const cashflowData = months.map(month => {
    const totalIncome = income.filter(i => i.month === month).reduce((s, i) => s + i.amount, 0)
      + payments.filter(p => p.month === month && p.status === 'paid').reduce((s, p) => s + p.amount, 0)
    const totalExpense = expenses.filter(e => e.month === month).reduce((s, e) => s + e.amount, 0)
    return {
      name: month.slice(5) + '/' + month.slice(2,4),
      Киреше: totalIncome,
      Чыгаша: totalExpense,
      Пайда: totalIncome - totalExpense,
    }
  })

  const monthIncome = income.filter(i => i.month === filterMonth).reduce((s, i) => s + i.amount, 0)
    + payments.filter(p => p.month === filterMonth && p.status === 'paid').reduce((s, p) => s + p.amount, 0)
  const monthExpense = expenses.filter(e => e.month === filterMonth).reduce((s, e) => s + e.amount, 0)
  const monthProfit = monthIncome - monthExpense

  const expensePieData = expenseCategories.map(cat => ({
    name: cat.label,
    value: expenses.filter(e => e.month === filterMonth && e.category === cat.id).reduce((s, e) => s + e.amount, 0),
    color: cat.color,
  })).filter(e => e.value > 0)

  const totalLeads = leads.length
  const studyingLeads = leads.filter(l => l.stage === 'studying' || l.stage === 'graduate').length
  const conversion = totalLeads > 0 ? Math.round((studyingLeads / totalLeads) * 100) : 0

  const monthsOptions = []
  for (let i = 0; i < 12; i++) {
    const d = new Date(); d.setMonth(d.getMonth() - i)
    monthsOptions.push(d.toISOString().slice(0,7))
  }

  const inpStyle = { width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #E2E8F0', background: '#F8FAFF', color: '#0D1E4A', fontSize: '13px', boxSizing: 'border-box' as const, outline: 'none' }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8FAFF', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid #E2E8F0', borderTopColor: '#1B4FD8', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <div style={{ color: '#94A3B8', fontSize: '14px' }}>Жүктөлүүдө...</div>
      </div>
    </div>
  )

  const tabs: { id: Tab; label: string }[] = [
    { id: 'dashboard', label: '📊 Дашборд' },
    { id: 'finance',   label: '💰 Финансы' },
    { id: 'crm',       label: '🎯 CRM' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFF', fontFamily: 'Inter, -apple-system, sans-serif', color: '#0D1E4A' }}>

      {/* NAVBAR */}
      <nav style={{ background: '#fff', borderBottom: '1px solid #E2E8F0', padding: '0 32px', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 200 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '34px', height: '34px', background: '#1B4FD8', borderRadius: '8px', overflow: 'hidden' }}>
              <img src="/images/logo.png" alt="Z" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <span style={{ fontWeight: '900', fontSize: '17px', color: '#0D1E4A' }}>Zhangak</span>
          </div>
          <div style={{ display: 'flex', gap: '4px', background: '#F1F5F9', borderRadius: '12px', padding: '4px' }}>
            {tabs.map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                style={{ padding: '7px 16px', borderRadius: '9px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '600', background: activeTab === t.id ? '#fff' : 'transparent', color: activeTab === t.id ? '#0D1E4A' : '#94A3B8', boxShadow: activeTab === t.id ? '0 1px 4px rgba(0,0,0,0.08)' : 'none', transition: 'all 0.15s' }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: '20px', padding: '5px 12px', fontSize: '12px', color: '#D97706', fontWeight: '700' }}>
            👑 Директор
          </div>
          <button onClick={handleLogout} style={{ background: 'none', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '6px 14px', fontSize: '13px', color: '#64748B', cursor: 'pointer' }}>
            Чыгуу
          </button>
        </div>
      </nav>

      <div style={{ padding: '28px 32px', maxWidth: '1400px', margin: '0 auto' }}>

        {/* ── DASHBOARD ── */}
        {activeTab === 'dashboard' && (
          <div>
            <Reveal>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h1 style={{ fontSize: '24px', fontWeight: '900', margin: 0 }}>Жалпы көрүнүш 👑</h1>
                  <p style={{ color: '#94A3B8', fontSize: '14px', margin: '4px 0 0' }}>Бизнестин толук аналитикасы</p>
                </div>
                <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)}
                  style={{ padding: '9px 14px', borderRadius: '10px', border: '1px solid #E2E8F0', background: '#fff', color: '#0D1E4A', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                  {monthsOptions.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </Reveal>

            {/* KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '16px', marginBottom: '24px' }}>
              {[
                { label: 'Айлык киреше', value: monthIncome.toLocaleString() + ' сом', icon: '💰', color: '#10B981', bg: '#F0FDF4', border: '#BBF7D0', sub: filterMonth },
                { label: 'Айлык чыгаша', value: monthExpense.toLocaleString() + ' сом', icon: '📤', color: '#EF4444', bg: '#FEF2F2', border: '#FECACA', sub: filterMonth },
                { label: 'Пайда', value: (monthProfit > 0 ? '+' : '') + monthProfit.toLocaleString() + ' сом', icon: monthProfit >= 0 ? '📈' : '📉', color: monthProfit >= 0 ? '#10B981' : '#EF4444', bg: monthProfit >= 0 ? '#F0FDF4' : '#FEF2F2', border: monthProfit >= 0 ? '#BBF7D0' : '#FECACA', sub: 'Киреше − Чыгаша' },
                { label: 'Окуучулар', value: students.length + ' адам', icon: '🎓', color: '#1B4FD8', bg: '#EEF2FF', border: '#C7D2FE', sub: 'Жалпы' },
              ].map((s, i) => (
                <Reveal key={i} delay={i * 80}>
                  <div style={{ background: '#fff', borderRadius: '20px', padding: '22px', border: `1px solid ${s.border}`, position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: '-12px', right: '-8px', fontSize: '56px', opacity: 0.06 }}>{s.icon}</div>
                    <div style={{ width: '40px', height: '40px', background: s.bg, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', marginBottom: '14px' }}>{s.icon}</div>
                    <div style={{ fontWeight: '900', fontSize: '22px', color: s.color, letterSpacing: '-0.5px', marginBottom: '4px' }}>{s.value}</div>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: '#0D1E4A', marginBottom: '2px' }}>{s.label}</div>
                    <div style={{ fontSize: '11px', color: '#94A3B8' }}>{s.sub}</div>
                  </div>
                </Reveal>
              ))}
            </div>

            {/* Charts row 1 */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <Reveal delay={100}>
                <div style={{ background: '#fff', borderRadius: '20px', padding: '22px', border: '1px solid #E2E8F0' }}>
                  <div style={{ fontWeight: '700', fontSize: '15px', color: '#0D1E4A', marginBottom: '4px' }}>📊 Cashflow — акыркы 6 ай</div>
                  <div style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '20px' }}>Киреше, Чыгаша, Пайда</div>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={cashflowData} barGap={4}>
                      <XAxis dataKey="name" tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '10px', color: '#0D1E4A', fontSize: 12 }} />
                      <Bar dataKey="Киреше" fill="#10B981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Чыгаша" fill="#FCA5A5" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Пайда" fill="#1B4FD8" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Reveal>

              <Reveal delay={150}>
                <div style={{ background: '#fff', borderRadius: '20px', padding: '22px', border: '1px solid #E2E8F0' }}>
                  <div style={{ fontWeight: '700', fontSize: '15px', color: '#0D1E4A', marginBottom: '4px' }}>🥧 Чыгашалар</div>
                  <div style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '16px' }}>Категория боюнча — {filterMonth}</div>
                  {expensePieData.length > 0 ? (
                    <>
                      <PieChart width={180} height={140} style={{ margin: '0 auto', display: 'block' }}>
                        <Pie data={expensePieData} cx={85} cy={65} innerRadius={35} outerRadius={60} dataKey="value" paddingAngle={3}>
                          {expensePieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                        </Pie>
                        <Tooltip contentStyle={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '8px', color: '#0D1E4A', fontSize: 12 }} formatter={(v: any) => v.toLocaleString() + ' сом'} />
                      </PieChart>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '10px' }}>
                        {expensePieData.map((e, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: e.color, flexShrink: 0 }} />
                              <span style={{ fontSize: '12px', color: '#64748B' }}>{e.name}</span>
                            </div>
                            <span style={{ fontSize: '12px', fontWeight: '700', color: '#0D1E4A' }}>{e.value.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontSize: '13px' }}>Маалымат жок</div>
                  )}
                </div>
              </Reveal>
            </div>

            {/* Charts row 2 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <Reveal delay={200}>
                <div style={{ background: '#fff', borderRadius: '20px', padding: '22px', border: '1px solid #E2E8F0' }}>
                  <div style={{ fontWeight: '700', fontSize: '15px', color: '#0D1E4A', marginBottom: '4px' }}>🎯 CRM Статистика</div>
                  <div style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '20px' }}>Лиддер жана конверсия</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    {[
                      { label: 'Жалпы лид', value: totalLeads, color: '#1B4FD8', bg: '#EEF2FF' },
                      { label: 'Конверсия', value: conversion + '%', color: '#10B981', bg: '#F0FDF4' },
                      { label: 'Окуп жатат', value: studyingLeads, color: '#7C3AED', bg: '#F5F3FF' },
                      { label: 'Жаңы заявка', value: leads.filter(l => l.stage === 'new').length, color: '#F59E0B', bg: '#FFF7ED' },
                    ].map((s, i) => (
                      <div key={i} style={{ background: s.bg, borderRadius: '14px', padding: '16px', textAlign: 'center' }}>
                        <div style={{ fontWeight: '900', fontSize: '28px', color: s.color, letterSpacing: '-1px' }}>{s.value}</div>
                        <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </Reveal>

              <Reveal delay={250}>
                <div style={{ background: '#fff', borderRadius: '20px', padding: '22px', border: '1px solid #E2E8F0' }}>
                  <div style={{ fontWeight: '700', fontSize: '15px', color: '#0D1E4A', marginBottom: '4px' }}>📋 Акыркы оплаталар</div>
                  <div style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '16px' }}>Студенттердин төлөмдөрү</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {payments.slice(0, 5).map((p, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#F8FAFF', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ width: '30px', height: '30px', background: '#1B4FD8', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '700', color: '#fff', flexShrink: 0 }}>
                            {p.profiles?.full_name?.[0]}
                          </div>
                          <span style={{ fontSize: '13px', fontWeight: '600', color: '#0D1E4A' }}>{p.profiles?.full_name}</span>
                        </div>
                        <span style={{ fontSize: '14px', fontWeight: '800', color: '#10B981' }}>{p.amount?.toLocaleString()} сом</span>
                      </div>
                    ))}
                    {payments.length === 0 && <div style={{ color: '#94A3B8', fontSize: '13px', textAlign: 'center', padding: '24px' }}>Оплаталар жок</div>}
                  </div>
                </div>
              </Reveal>
            </div>

            {/* Recent leads */}
            <Reveal delay={300}>
              <div style={{ background: '#fff', borderRadius: '20px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
                <div style={{ padding: '16px 22px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontWeight: '700', fontSize: '15px', color: '#0D1E4A' }}>🕐 Акыркы заявкалар</div>
                  <button onClick={() => setActiveTab('crm')} style={{ background: '#EEF2FF', color: '#1B4FD8', border: 'none', borderRadius: '8px', padding: '5px 12px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>Баарын көрүү →</button>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#F8FAFF' }}>
                        {['Аты-жөнү', 'Телефон', 'Курс', 'Этап', 'Күн'].map(h => (
                          <th key={h} style={{ textAlign: 'left', padding: '10px 16px', color: '#94A3B8', fontWeight: '600', fontSize: '11px', textTransform: 'uppercase' as const, borderBottom: '1px solid #E2E8F0' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {leads.slice(0, 8).map((l, i) => (
                        <tr key={l.id} style={{ borderBottom: i < 7 ? '1px solid #F1F5F9' : 'none' }}>
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{ width: '28px', height: '28px', background: '#1B4FD8', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '700', color: '#fff', flexShrink: 0 }}>{l.full_name?.[0]}</div>
                              <span style={{ fontWeight: '600', color: '#0D1E4A' }}>{l.full_name}</span>
                            </div>
                          </td>
                          <td style={{ padding: '12px 16px', color: '#64748B' }}>{l.phone}</td>
                          <td style={{ padding: '12px 16px' }}><span style={{ background: '#EEF2FF', color: '#1B4FD8', borderRadius: '6px', padding: '2px 8px', fontSize: '11px', fontWeight: '600' }}>{l.course}</span></td>
                          <td style={{ padding: '12px 16px', color: '#64748B', fontSize: '12px' }}>{l.stage}</td>
                          <td style={{ padding: '12px 16px', color: '#94A3B8', fontSize: '11px' }}>{new Date(l.created_at).toLocaleDateString('ru')}</td>
                        </tr>
                      ))}
                      {leads.length === 0 && <tr><td colSpan={5} style={{ padding: 32, textAlign: 'center', color: '#94A3B8' }}>Заявкалар жок</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </Reveal>
          </div>
        )}

        {/* ── FINANCE ── */}
        {activeTab === 'finance' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h2 style={{ fontSize: '22px', fontWeight: '900', margin: 0 }}>💰 Финансылык отчёт</h2>
                <p style={{ color: '#94A3B8', fontSize: '13px', margin: '4px 0 0' }}>Киреше жана чыгашалар</p>
              </div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)}
                  style={{ padding: '9px 14px', borderRadius: '10px', border: '1px solid #E2E8F0', background: '#fff', color: '#0D1E4A', fontSize: '13px', cursor: 'pointer' }}>
                  {monthsOptions.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <button onClick={() => setShowIncomeForm(p => !p)}
                  style={{ background: '#F0FDF4', color: '#10B981', border: '1px solid #BBF7D0', borderRadius: '10px', padding: '9px 16px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}>
                  + Киреше
                </button>
                <button onClick={() => setShowExpenseForm(p => !p)}
                  style={{ background: '#FEF2F2', color: '#EF4444', border: '1px solid #FECACA', borderRadius: '10px', padding: '9px 16px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}>
                  + Чыгаша
                </button>
              </div>
            </div>

            {/* Summary */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '16px', marginBottom: '24px' }}>
              {[
                { label: 'Киреше', value: monthIncome, color: '#10B981', bg: '#F0FDF4', border: '#BBF7D0', icon: '💚' },
                { label: 'Чыгаша', value: monthExpense, color: '#EF4444', bg: '#FEF2F2', border: '#FECACA', icon: '❤️' },
                { label: 'Пайда', value: monthProfit, color: monthProfit >= 0 ? '#10B981' : '#EF4444', bg: monthProfit >= 0 ? '#F0FDF4' : '#FEF2F2', border: monthProfit >= 0 ? '#BBF7D0' : '#FECACA', icon: monthProfit >= 0 ? '📈' : '📉' },
              ].map((s, i) => (
                <div key={i} style={{ background: s.bg, borderRadius: '20px', padding: '22px', border: `1px solid ${s.border}` }}>
                  <div style={{ fontSize: '20px', marginBottom: '10px' }}>{s.icon}</div>
                  <div style={{ fontWeight: '900', fontSize: '24px', color: s.color, marginBottom: '4px' }}>
                    {s.value > 0 ? '+' : ''}{s.value.toLocaleString()} сом
                  </div>
                  <div style={{ fontSize: '13px', color: '#64748B' }}>{s.label} — {filterMonth}</div>
                </div>
              ))}
            </div>

            {/* Forms */}
            {showIncomeForm && (
              <div style={{ background: '#fff', border: '1px solid #BBF7D0', borderRadius: '16px', padding: '20px', marginBottom: '16px' }}>
                <div style={{ fontWeight: '700', fontSize: '14px', color: '#10B981', marginBottom: '14px' }}>+ Жаңы киреше</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px', marginBottom: '14px' }}>
                  <div>
                    <div style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '6px', fontWeight: '600' }}>Булак</div>
                    <select value={newIncome.source} onChange={e => setNewIncome(p => ({ ...p, source: e.target.value }))} style={inpStyle}>
                      {['B1', 'B2', 'C1', 'Жайкы интенсив', 'Онлайн', 'Башка'].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '6px', fontWeight: '600' }}>Сумма (сом) *</div>
                    <input value={newIncome.amount} onChange={e => setNewIncome(p => ({ ...p, amount: e.target.value }))} type="number" placeholder="50000" style={inpStyle} />
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '6px', fontWeight: '600' }}>Ай</div>
                    <input value={newIncome.month} onChange={e => setNewIncome(p => ({ ...p, month: e.target.value }))} type="month" style={inpStyle} />
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '6px', fontWeight: '600' }}>Эскертүү</div>
                    <input value={newIncome.note} onChange={e => setNewIncome(p => ({ ...p, note: e.target.value }))} placeholder="..." style={inpStyle} />
                  </div>
                </div>
                <button onClick={addIncome} disabled={saving} style={{ background: '#10B981', color: '#fff', border: 'none', borderRadius: '10px', padding: '10px 24px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}>
                  {saving ? '...' : '+ Кошуу'}
                </button>
              </div>
            )}

            {showExpenseForm && (
              <div style={{ background: '#fff', border: '1px solid #FECACA', borderRadius: '16px', padding: '20px', marginBottom: '16px' }}>
                <div style={{ fontWeight: '700', fontSize: '14px', color: '#EF4444', marginBottom: '14px' }}>+ Жаңы чыгаша</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px', marginBottom: '14px' }}>
                  <div>
                    <div style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '6px', fontWeight: '600' }}>Категория</div>
                    <select value={newExpense.category} onChange={e => setNewExpense(p => ({ ...p, category: e.target.value }))} style={inpStyle}>
                      {expenseCategories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '6px', fontWeight: '600' }}>Аталышы</div>
                    <input value={newExpense.subcategory} onChange={e => setNewExpense(p => ({ ...p, subcategory: e.target.value }))} placeholder="Аренда, Таргет..." style={inpStyle} />
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '6px', fontWeight: '600' }}>Сумма (сом) *</div>
                    <input value={newExpense.amount} onChange={e => setNewExpense(p => ({ ...p, amount: e.target.value }))} type="number" placeholder="10000" style={inpStyle} />
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '6px', fontWeight: '600' }}>Ай</div>
                    <input value={newExpense.month} onChange={e => setNewExpense(p => ({ ...p, month: e.target.value }))} type="month" style={inpStyle} />
                  </div>
                </div>
                <button onClick={addExpense} disabled={saving} style={{ background: '#EF4444', color: '#fff', border: 'none', borderRadius: '10px', padding: '10px 24px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}>
                  {saving ? '...' : '+ Кошуу'}
                </button>
              </div>
            )}

            {/* Tables */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div style={{ background: '#fff', borderRadius: '20px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: '700', fontSize: '14px', color: '#10B981' }}>💚 Киреше — {filterMonth}</div>
                  <div style={{ fontWeight: '800', fontSize: '14px', color: '#10B981' }}>{monthIncome.toLocaleString()} сом</div>
                </div>
                <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#F8FAFF' }}>
                      {['Булак', 'Сумма', 'Эскертүү'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '10px 16px', color: '#94A3B8', fontWeight: '600', fontSize: '11px', borderBottom: '1px solid #E2E8F0' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {income.filter(i => i.month === filterMonth).map((item) => (
                      <tr key={item.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '10px 16px', fontWeight: '600', color: '#0D1E4A' }}>{item.source}</td>
                        <td style={{ padding: '10px 16px', color: '#10B981', fontWeight: '700' }}>{item.amount.toLocaleString()} сом</td>
                        <td style={{ padding: '10px 16px', color: '#94A3B8', fontSize: '12px' }}>{item.note || '—'}</td>
                      </tr>
                    ))}
                    {payments.filter(p => p.month === filterMonth && p.status === 'paid').map((p) => (
                      <tr key={p.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '10px 16px', fontWeight: '600', color: '#0D1E4A' }}>Оплата — {p.profiles?.full_name}</td>
                        <td style={{ padding: '10px 16px', color: '#10B981', fontWeight: '700' }}>{p.amount?.toLocaleString()} сом</td>
                        <td style={{ padding: '10px 16px', color: '#94A3B8', fontSize: '12px' }}>{p.note || '—'}</td>
                      </tr>
                    ))}
                    {income.filter(i => i.month === filterMonth).length === 0 && payments.filter(p => p.month === filterMonth).length === 0 && (
                      <tr><td colSpan={3} style={{ padding: '28px', textAlign: 'center', color: '#94A3B8' }}>Маалымат жок</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div style={{ background: '#fff', borderRadius: '20px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: '700', fontSize: '14px', color: '#EF4444' }}>❤️ Чыгаша — {filterMonth}</div>
                  <div style={{ fontWeight: '800', fontSize: '14px', color: '#EF4444' }}>{monthExpense.toLocaleString()} сом</div>
                </div>
                <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#F8FAFF' }}>
                      {['Категория', 'Аталышы', 'Сумма'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '10px 16px', color: '#94A3B8', fontWeight: '600', fontSize: '11px', borderBottom: '1px solid #E2E8F0' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.filter(e => e.month === filterMonth).map((item) => {
                      const cat = expenseCategories.find(c => c.id === item.category)
                      return (
                        <tr key={item.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                          <td style={{ padding: '10px 16px' }}>
                            <span style={{ background: `${cat?.color}18`, color: cat?.color, borderRadius: '6px', padding: '2px 8px', fontSize: '11px', fontWeight: '600' }}>{cat?.label}</span>
                          </td>
                          <td style={{ padding: '10px 16px', fontWeight: '600', color: '#0D1E4A' }}>{item.subcategory || '—'}</td>
                          <td style={{ padding: '10px 16px', color: '#EF4444', fontWeight: '700' }}>{item.amount.toLocaleString()} сом</td>
                        </tr>
                      )
                    })}
                    {expenses.filter(e => e.month === filterMonth).length === 0 && (
                      <tr><td colSpan={3} style={{ padding: '28px', textAlign: 'center', color: '#94A3B8' }}>Маалымат жок</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── CRM ── */}
        {activeTab === 'crm' && (
          <div>
            <div style={{ marginBottom: '24px' }}>
              <h2 style={{ fontSize: '22px', fontWeight: '900', margin: 0 }}>🎯 CRM Аналитика</h2>
              <p style={{ color: '#94A3B8', fontSize: '13px', margin: '4px 0 0' }}>Заявкалар жана конверсия</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '16px', marginBottom: '24px' }}>
              {[
                { label: 'Жалпы лид', value: totalLeads, color: '#1B4FD8', bg: '#EEF2FF' },
                { label: 'Конверсия', value: conversion + '%', color: '#10B981', bg: '#F0FDF4' },
                { label: 'Окуп жатат', value: studyingLeads, color: '#7C3AED', bg: '#F5F3FF' },
                { label: 'Жаңы заявка', value: leads.filter(l => l.stage === 'new').length, color: '#F59E0B', bg: '#FFF7ED' },
              ].map((s, i) => (
                <Reveal key={i} delay={i * 80}>
                  <div style={{ background: s.bg, borderRadius: '18px', padding: '20px', textAlign: 'center' }}>
                    <div style={{ fontWeight: '900', fontSize: '32px', color: s.color, letterSpacing: '-1px' }}>{s.value}</div>
                    <div style={{ fontSize: '13px', color: '#64748B', marginTop: '6px' }}>{s.label}</div>
                  </div>
                </Reveal>
              ))}
            </div>

            <Reveal delay={100}>
              <div style={{ background: '#fff', borderRadius: '20px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
                <div style={{ padding: '16px 22px', borderBottom: '1px solid #E2E8F0' }}>
                  <div style={{ fontWeight: '700', fontSize: '15px', color: '#0D1E4A' }}>Акыркы заявкалар</div>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#F8FAFF' }}>
                        {['Аты-жөнү', 'Телефон', 'Курс', 'Этап', 'Күн'].map(h => (
                          <th key={h} style={{ textAlign: 'left', padding: '10px 16px', color: '#94A3B8', fontWeight: '600', fontSize: '11px', textTransform: 'uppercase' as const, borderBottom: '1px solid #E2E8F0' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {leads.slice(0, 20).map((l, i) => (
                        <tr key={l.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{ width: '28px', height: '28px', background: '#1B4FD8', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '700', color: '#fff', flexShrink: 0 }}>{l.full_name?.[0]}</div>
                              <span style={{ fontWeight: '600', color: '#0D1E4A' }}>{l.full_name}</span>
                            </div>
                          </td>
                          <td style={{ padding: '12px 16px', color: '#64748B' }}>{l.phone}</td>
                          <td style={{ padding: '12px 16px' }}><span style={{ background: '#EEF2FF', color: '#1B4FD8', borderRadius: '6px', padding: '2px 8px', fontSize: '11px', fontWeight: '600' }}>{l.course}</span></td>
                          <td style={{ padding: '12px 16px', color: '#64748B', fontSize: '12px' }}>{l.stage}</td>
                          <td style={{ padding: '12px 16px', color: '#94A3B8', fontSize: '11px' }}>{new Date(l.created_at).toLocaleDateString('ru')}</td>
                        </tr>
                      ))}
                      {leads.length === 0 && <tr><td colSpan={5} style={{ padding: 32, textAlign: 'center', color: '#94A3B8' }}>Заявкалар жок</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </Reveal>
          </div>
        )}

      </div>
    </div>
  )
}