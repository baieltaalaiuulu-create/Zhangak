'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area } from 'recharts'

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

const expenseCategories = [
  { id: 'salary', label: 'Зарплата', color: '#3B82F6' },
  { id: 'marketing', label: 'Маркетинг', color: '#EC4899' },
  { id: 'trainer', label: 'Тренер/Ментор', color: '#8B5CF6' },
  { id: 'office', label: 'Офис', color: '#F59E0B' },
  { id: 'other', label: 'Башка', color: '#6B7280' },
]

export default function DirectorPage() {
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('dashboard')
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
    await supabase.auth.getSession()
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
    fetchAll()
    setSaving(false)
  }

  const addExpense = async () => {
    if (!newExpense.amount) return
    setSaving(true)
    await supabase.from('expenses').insert({ ...newExpense, amount: Number(newExpense.amount) })
    setNewExpense({ category: 'salary', subcategory: '', amount: '', month: new Date().toISOString().slice(0,7), note: '' })
    setShowExpenseForm(false)
    fetchAll()
    setSaving(false)
  }

  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/') }

  // ANALYTICS
  const months = (() => {
    const m = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date()
      d.setMonth(d.getMonth() - i)
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
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    monthsOptions.push(d.toISOString().slice(0,7))
  }

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
      <div style={{ background: SURFACE, borderBottom: `1px solid ${BORDER}`, padding: '0 28px', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img src="/images/logo.png" alt="Zhangak" style={{ width: '30px', filter: 'brightness(0) invert(1)' }} />
            <span style={{ fontWeight: '900', fontSize: '16px' }}>Zhangak</span>
          </div>
          <div style={{ display: 'flex', gap: '4px' }}>
            {[
              { id: 'dashboard', label: '📊 Дашборд' },
              { id: 'finance', label: '💰 Финансы' },
              { id: 'crm', label: '🎯 CRM' },
            ].map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                style={{ padding: '6px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '600',
                  background: activeTab === tab.id ? 'rgba(37,99,235,0.2)' : 'transparent',
                  color: activeTab === tab.id ? '#60A5FA' : 'rgba(255,255,255,0.5)' }}>
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ background: 'rgba(240,192,64,0.15)', border: '1px solid rgba(240,192,64,0.3)', borderRadius: '20px', padding: '5px 12px', fontSize: '12px', color: '#F0C040', fontWeight: '600' }}>
            👑 Директор
          </div>
          <button onClick={handleLogout} style={{ background: 'rgba(239,68,68,0.1)', color: '#FCA5A5', border: 'none', borderRadius: '8px', padding: '7px 14px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
            Чыгуу
          </button>
        </div>
      </div>

      <div style={{ padding: '28px', maxWidth: '1400px', margin: '0 auto' }}>

        {/* DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div>
            <Animate>
              <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <h1 style={{ fontSize: '24px', fontWeight: '900', marginBottom: '4px' }}>Жалпы көрүнүш 👑</h1>
                  <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px' }}>Жангак платформасынын аналитикасы</div>
                </div>
                <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)}
                  style={{ padding: '8px 14px', borderRadius: '10px', border: `1px solid ${BORDER}`, background: SURFACE, color: '#fff', fontSize: '13px' }}>
                  {monthsOptions.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </Animate>

            {/* TOP KPI */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '16px', marginBottom: '24px' }}>
              {[
                { label: 'Айлык киреше', value: monthIncome.toLocaleString() + ' сом', icon: '💰', color: '#34D399', bg: 'rgba(52,211,153,0.1)', sub: filterMonth },
                { label: 'Айлык чыгаша', value: monthExpense.toLocaleString() + ' сом', icon: '📤', color: '#FCA5A5', bg: 'rgba(239,68,68,0.1)', sub: filterMonth },
                { label: 'Пайда', value: (monthProfit > 0 ? '+' : '') + monthProfit.toLocaleString() + ' сом', icon: monthProfit >= 0 ? '📈' : '📉', color: monthProfit >= 0 ? '#34D399' : '#FCA5A5', bg: monthProfit >= 0 ? 'rgba(52,211,153,0.1)' : 'rgba(239,68,68,0.1)', sub: 'Киреше - Чыгаша' },
                { label: 'Окуучулар', value: students.length + ' адам', icon: '🎓', color: '#60A5FA', bg: 'rgba(96,165,250,0.1)', sub: 'Жалпы' },
              ].map((s, i) => (
                <Animate key={i} delay={i * 80}>
                  <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: '16px', padding: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                      <div style={{ width: '40px', height: '40px', background: s.bg, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>{s.icon}</div>
                    </div>
                    <div style={{ fontWeight: '900', fontSize: '24px', color: s.color, marginBottom: '4px' }}>{s.value}</div>
                    <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', marginBottom: '2px' }}>{s.label}</div>
                    <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>{s.sub}</div>
                  </div>
                </Animate>
              ))}
            </div>

            {/* CASHFLOW CHART */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <Animate delay={100}>
                <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: '16px', padding: '20px' }}>
                  <div style={{ fontWeight: '700', fontSize: '14px', marginBottom: '4px' }}>📊 Cashflow — акыркы 6 ай</div>
                  <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginBottom: '16px' }}>Киреше, Чыгаша, Пайда</div>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={cashflowData}>
                      <XAxis dataKey="name" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: '8px', color: '#fff' }} />
                      <Bar dataKey="Киреше" fill="#34D399" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Чыгаша" fill="#FCA5A5" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Пайда" fill={BLUE} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Animate>

              <Animate delay={150}>
                <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: '16px', padding: '20px' }}>
                  <div style={{ fontWeight: '700', fontSize: '14px', marginBottom: '4px' }}>🥧 Чыгашалар</div>
                  <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginBottom: '16px' }}>Категория боюнча — {filterMonth}</div>
                  {expensePieData.length > 0 ? (
                    <div>
                      <PieChart width={200} height={160} style={{ margin: '0 auto' }}>
                        <Pie data={expensePieData} cx={95} cy={75} innerRadius={40} outerRadius={70} dataKey="value" paddingAngle={3}>
                          {expensePieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                        </Pie>
                        <Tooltip contentStyle={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: '8px', color: '#fff' }} formatter={(v: any) => v.toLocaleString() + ' сом'} />
                      </PieChart>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
                        {expensePieData.map((e, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: e.color }} />
                              <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)' }}>{e.name}</span>
                            </div>
                            <span style={{ fontSize: '11px', fontWeight: '700' }}>{e.value.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div style={{ height: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)', fontSize: '13px' }}>Маалымат жок</div>
                  )}
                </div>
              </Animate>
            </div>

            {/* CRM + STUDENTS */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <Animate delay={200}>
                <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: '16px', padding: '20px' }}>
                  <div style={{ fontWeight: '700', fontSize: '14px', marginBottom: '16px' }}>🎯 CRM Статистика</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    {[
                      { label: 'Жалпы лид', value: totalLeads, color: '#60A5FA' },
                      { label: 'Конверсия', value: conversion + '%', color: '#34D399' },
                      { label: 'Окуп жатат', value: studyingLeads, color: '#A78BFA' },
                      { label: 'Жаңы заявка', value: leads.filter(l => l.stage === 'new').length, color: '#FCD34D' },
                    ].map((s, i) => (
                      <div key={i} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '10px', padding: '14px' }}>
                        <div style={{ fontWeight: '900', fontSize: '22px', color: s.color }}>{s.value}</div>
                        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '3px' }}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </Animate>

              <Animate delay={250}>
                <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: '16px', padding: '20px' }}>
                  <div style={{ fontWeight: '700', fontSize: '14px', marginBottom: '16px' }}>📋 Акыркы оплаталар</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {payments.slice(0, 5).map((p, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '28px', height: '28px', background: BLUE, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '700' }}>
                            {p.profiles?.full_name?.[0]}
                          </div>
                          <span style={{ fontSize: '13px', fontWeight: '600' }}>{p.profiles?.full_name}</span>
                        </div>
                        <span style={{ fontSize: '13px', fontWeight: '700', color: '#34D399' }}>{p.amount?.toLocaleString()} сом</span>
                      </div>
                    ))}
                    {payments.length === 0 && <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '13px', textAlign: 'center', padding: '16px' }}>Оплаталар жок</div>}
                  </div>
                </div>
              </Animate>
            </div>
          </div>
        )}

        {/* FINANCE TAB */}
        {activeTab === 'finance' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: '900' }}>💰 Финансылык отчёт</h2>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)}
                  style={{ padding: '8px 14px', borderRadius: '10px', border: `1px solid ${BORDER}`, background: SURFACE, color: '#fff', fontSize: '13px' }}>
                  {monthsOptions.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <button onClick={() => setShowIncomeForm(p => !p)}
                  style={{ background: '#34D399', color: '#0D1E4A', border: 'none', borderRadius: '10px', padding: '8px 16px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}>
                  + Киреше
                </button>
                <button onClick={() => setShowExpenseForm(p => !p)}
                  style={{ background: '#FCA5A5', color: '#0D1E4A', border: 'none', borderRadius: '10px', padding: '8px 16px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}>
                  + Чыгаша
                </button>
              </div>
            </div>

            {/* FORMS */}
            {showIncomeForm && (
              <Animate>
                <div style={{ background: SURFACE, border: '1px solid rgba(52,211,153,0.3)', borderRadius: '16px', padding: '20px', marginBottom: '16px' }}>
                  <div style={{ fontWeight: '700', fontSize: '14px', marginBottom: '14px', color: '#34D399' }}>+ Жаңы киреше</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px', marginBottom: '12px' }}>
                    <div>
                      <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginBottom: '6px' }}>Булак</div>
                      <select value={newIncome.source} onChange={e => setNewIncome(p => ({ ...p, source: e.target.value }))}
                        style={{ width: '100%', padding: '10px', borderRadius: '8px', border: `1px solid ${BORDER}`, background: DARK, color: '#fff', fontSize: '13px', boxSizing: 'border-box' as const }}>
                        {['B1', 'B2', 'C1', 'Жайкы интенсив', 'Онлайн', 'Башка'].map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginBottom: '6px' }}>Сумма (сом) *</div>
                      <input value={newIncome.amount} onChange={e => setNewIncome(p => ({ ...p, amount: e.target.value }))} type="number" placeholder="50000"
                        style={{ width: '100%', padding: '10px', borderRadius: '8px', border: `1px solid ${BORDER}`, background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: '13px', boxSizing: 'border-box' as const }} />
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginBottom: '6px' }}>Ай</div>
                      <input value={newIncome.month} onChange={e => setNewIncome(p => ({ ...p, month: e.target.value }))} type="month"
                        style={{ width: '100%', padding: '10px', borderRadius: '8px', border: `1px solid ${BORDER}`, background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: '13px', boxSizing: 'border-box' as const }} />
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginBottom: '6px' }}>Эскертүү</div>
                      <input value={newIncome.note} onChange={e => setNewIncome(p => ({ ...p, note: e.target.value }))} placeholder="..."
                        style={{ width: '100%', padding: '10px', borderRadius: '8px', border: `1px solid ${BORDER}`, background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: '13px', boxSizing: 'border-box' as const }} />
                    </div>
                  </div>
                  <button onClick={addIncome} disabled={saving}
                    style={{ background: '#34D399', color: '#0D1E4A', border: 'none', borderRadius: '8px', padding: '10px 24px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}>
                    {saving ? '...' : '+ Кошуу'}
                  </button>
                </div>
              </Animate>
            )}

            {showExpenseForm && (
              <Animate>
                <div style={{ background: SURFACE, border: '1px solid rgba(239,68,68,0.3)', borderRadius: '16px', padding: '20px', marginBottom: '16px' }}>
                  <div style={{ fontWeight: '700', fontSize: '14px', marginBottom: '14px', color: '#FCA5A5' }}>+ Жаңы чыгаша</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px', marginBottom: '12px' }}>
                    <div>
                      <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginBottom: '6px' }}>Категория</div>
                      <select value={newExpense.category} onChange={e => setNewExpense(p => ({ ...p, category: e.target.value }))}
                        style={{ width: '100%', padding: '10px', borderRadius: '8px', border: `1px solid ${BORDER}`, background: DARK, color: '#fff', fontSize: '13px', boxSizing: 'border-box' as const }}>
                        {expenseCategories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginBottom: '6px' }}>Аталышы</div>
                      <input value={newExpense.subcategory} onChange={e => setNewExpense(p => ({ ...p, subcategory: e.target.value }))} placeholder="Аренда, Таргет..."
                        style={{ width: '100%', padding: '10px', borderRadius: '8px', border: `1px solid ${BORDER}`, background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: '13px', boxSizing: 'border-box' as const }} />
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginBottom: '6px' }}>Сумма (сом) *</div>
                      <input value={newExpense.amount} onChange={e => setNewExpense(p => ({ ...p, amount: e.target.value }))} type="number" placeholder="10000"
                        style={{ width: '100%', padding: '10px', borderRadius: '8px', border: `1px solid ${BORDER}`, background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: '13px', boxSizing: 'border-box' as const }} />
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginBottom: '6px' }}>Ай</div>
                      <input value={newExpense.month} onChange={e => setNewExpense(p => ({ ...p, month: e.target.value }))} type="month"
                        style={{ width: '100%', padding: '10px', borderRadius: '8px', border: `1px solid ${BORDER}`, background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: '13px', boxSizing: 'border-box' as const }} />
                    </div>
                  </div>
                  <button onClick={addExpense} disabled={saving}
                    style={{ background: '#FCA5A5', color: '#0D1E4A', border: 'none', borderRadius: '8px', padding: '10px 24px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}>
                    {saving ? '...' : '+ Кошуу'}
                  </button>
                </div>
              </Animate>
            )}

            {/* TABLES */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <Animate>
                <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: '16px', overflow: 'hidden' }}>
                  <div style={{ padding: '14px 20px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontWeight: '700', fontSize: '14px', color: '#34D399' }}>💚 Киреше — {filterMonth}</div>
                    <div style={{ fontWeight: '800', color: '#34D399' }}>{monthIncome.toLocaleString()} сом</div>
                  </div>
                  <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                        {['Булак', 'Сумма', 'Эскертүү'].map(h => (
                          <th key={h} style={{ textAlign: 'left', padding: '10px 16px', color: 'rgba(255,255,255,0.4)', fontWeight: '600', fontSize: '11px' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {income.filter(i => i.month === filterMonth).map((item, i) => (
                        <tr key={item.id} style={{ borderBottom: `1px solid ${BORDER}` }}>
                          <td style={{ padding: '10px 16px', fontWeight: '600' }}>{item.source}</td>
                          <td style={{ padding: '10px 16px', color: '#34D399', fontWeight: '700' }}>{item.amount.toLocaleString()} сом</td>
                          <td style={{ padding: '10px 16px', color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>{item.note || '—'}</td>
                        </tr>
                      ))}
                      {payments.filter(p => p.month === filterMonth && p.status === 'paid').map((p, i) => (
                        <tr key={p.id} style={{ borderBottom: `1px solid ${BORDER}` }}>
                          <td style={{ padding: '10px 16px', fontWeight: '600' }}>Оплата — {p.profiles?.full_name}</td>
                          <td style={{ padding: '10px 16px', color: '#34D399', fontWeight: '700' }}>{p.amount.toLocaleString()} сом</td>
                          <td style={{ padding: '10px 16px', color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>{p.note || '—'}</td>
                        </tr>
                      ))}
                      {income.filter(i => i.month === filterMonth).length === 0 && payments.filter(p => p.month === filterMonth).length === 0 && (
                        <tr><td colSpan={3} style={{ padding: '24px', textAlign: 'center', color: 'rgba(255,255,255,0.3)' }}>Маалымат жок</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Animate>

              <Animate delay={100}>
                <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: '16px', overflow: 'hidden' }}>
                  <div style={{ padding: '14px 20px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontWeight: '700', fontSize: '14px', color: '#FCA5A5' }}>❤️ Чыгаша — {filterMonth}</div>
                    <div style={{ fontWeight: '800', color: '#FCA5A5' }}>{monthExpense.toLocaleString()} сом</div>
                  </div>
                  <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                        {['Категория', 'Аталышы', 'Сумма'].map(h => (
                          <th key={h} style={{ textAlign: 'left', padding: '10px 16px', color: 'rgba(255,255,255,0.4)', fontWeight: '600', fontSize: '11px' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {expenses.filter(e => e.month === filterMonth).map((item, i) => {
                        const cat = expenseCategories.find(c => c.id === item.category)
                        return (
                          <tr key={item.id} style={{ borderBottom: `1px solid ${BORDER}` }}>
                            <td style={{ padding: '10px 16px' }}>
                              <span style={{ background: `${cat?.color}22`, color: cat?.color, borderRadius: '6px', padding: '2px 8px', fontSize: '11px', fontWeight: '600' }}>{cat?.label}</span>
                            </td>
                            <td style={{ padding: '10px 16px', fontWeight: '600' }}>{item.subcategory || '—'}</td>
                            <td style={{ padding: '10px 16px', color: '#FCA5A5', fontWeight: '700' }}>{item.amount.toLocaleString()} сом</td>
                          </tr>
                        )
                      })}
                      {expenses.filter(e => e.month === filterMonth).length === 0 && (
                        <tr><td colSpan={3} style={{ padding: '24px', textAlign: 'center', color: 'rgba(255,255,255,0.3)' }}>Маалымат жок</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Animate>
            </div>
          </div>
        )}

        {/* CRM TAB — READ ONLY */}
        {activeTab === 'crm' && (
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: '900', marginBottom: '24px' }}>🎯 CRM Аналитика</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '16px', marginBottom: '24px' }}>
              {[
                { label: 'Жалпы лид', value: totalLeads, color: '#60A5FA' },
                { label: 'Конверсия', value: conversion + '%', color: '#34D399' },
                { label: 'Окуп жатат', value: studyingLeads, color: '#A78BFA' },
                { label: 'Жаңы заявка', value: leads.filter(l => l.stage === 'new').length, color: '#FCD34D' },
              ].map((s, i) => (
                <Animate key={i} delay={i * 80}>
                  <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: '16px', padding: '20px' }}>
                    <div style={{ fontWeight: '900', fontSize: '28px', color: s.color, marginBottom: '4px' }}>{s.value}</div>
                    <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}>{s.label}</div>
                  </div>
                </Animate>
              ))}
            </div>
            <Animate delay={100}>
              <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: '16px', overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: `1px solid ${BORDER}` }}>
                  <div style={{ fontWeight: '700', fontSize: '14px' }}>Акыркы заявкалар</div>
                </div>
                <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                      {['Аты-жөнү', 'Телефон', 'Курс', 'Этап', 'Күн'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '10px 16px', color: 'rgba(255,255,255,0.4)', fontWeight: '600', fontSize: '11px' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {leads.slice(0, 20).map((l, i) => (
                      <tr key={l.id} style={{ borderBottom: `1px solid ${BORDER}` }}>
                        <td style={{ padding: '10px 16px', fontWeight: '600' }}>{l.full_name}</td>
                        <td style={{ padding: '10px 16px', color: 'rgba(255,255,255,0.5)' }}>{l.phone}</td>
                        <td style={{ padding: '10px 16px' }}>
                          <span style={{ background: 'rgba(37,99,235,0.15)', color: '#60A5FA', borderRadius: '6px', padding: '2px 8px', fontSize: '11px' }}>{l.course}</span>
                        </td>
                        <td style={{ padding: '10px 16px', color: 'rgba(255,255,255,0.5)', fontSize: '12px' }}>{l.stage}</td>
                        <td style={{ padding: '10px 16px', color: 'rgba(255,255,255,0.4)', fontSize: '11px' }}>{new Date(l.created_at).toLocaleDateString('ru')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Animate>
          </div>
        )}
      </div>
    </div>
  )
}