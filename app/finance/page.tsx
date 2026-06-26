'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts'

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
const GREEN = '#34D399'
const RED = '#FCA5A5'

const expenseCategories = [
  { id: 'salary', label: 'Зарплата', color: '#3B82F6', icon: '👥' },
  { id: 'marketing', label: 'Маркетинг', color: '#EC4899', icon: '📱' },
  { id: 'trainer', label: 'Тренер/Ментор', color: '#8B5CF6', icon: '🎓' },
  { id: 'office', label: 'Офис', color: '#F59E0B', icon: '🏢' },
  { id: 'other', label: 'Башка', color: '#6B7280', icon: '📦' },
]

const incomeSources = [
  { id: 'B1', label: 'B1 Курс' },
  { id: 'B2', label: 'B2 Курс' },
  { id: 'C1', label: 'C1 Курс' },
  { id: 'intensive', label: 'Жайкы интенсив' },
  { id: 'online', label: 'Онлайн' },
  { id: 'other', label: 'Башка' },
]

const tabs = [
  { id: 'cashflow', label: '📊 CashFlow' },
  { id: 'income', label: '💚 Киреше' },
  { id: 'expenses', label: '❤️ Чыгаша' },
  { id: 'salary', label: '👥 Зарплата' },
  { id: 'payments', label: '💳 Оплаталар' },
]

export default function FinancePage() {
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('cashflow')
  const [income, setIncome] = useState<any[]>([])
  const [expenses, setExpenses] = useState<any[]>([])
  const [payments, setPayments] = useState<any[]>([])
  const [students, setStudents] = useState<any[]>([])
  const [filterMonth, setFilterMonth] = useState(new Date().toISOString().slice(0, 7))
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [newIncome, setNewIncome] = useState({ source: 'B1', amount: '', month: new Date().toISOString().slice(0, 7), note: '' })
  const [newExpense, setNewExpense] = useState({ category: 'salary', subcategory: '', amount: '', month: new Date().toISOString().slice(0, 7), note: '' })
  const router = useRouter()

  useEffect(() => { checkAuth() }, [])

  const checkAuth = async () => {
    await supabase.auth.getSession()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (!profile || profile.role !== 'finance') { await supabase.auth.signOut(); router.push('/'); return }
    fetchAll()
  }

  const fetchAll = async () => {
    const [i, e, p, s] = await Promise.all([
      supabase.from('income').select('*').order('month'),
      supabase.from('expenses').select('*').order('month'),
      supabase.from('payments').select('*, profiles(full_name)').order('created_at', { ascending: false }),
      supabase.from('profiles').select('*').eq('role', 'student'),
    ])
    setIncome(i.data || [])
    setExpenses(e.data || [])
    setPayments(p.data || [])
    setStudents(s.data || [])
    setLoading(false)
  }

  const addIncome = async () => {
    if (!newIncome.amount) return
    setSaving(true)
    await supabase.from('income').insert({ ...newIncome, amount: Number(newIncome.amount) })
    setNewIncome({ source: 'B1', amount: '', month: new Date().toISOString().slice(0, 7), note: '' })
    setShowForm(false)
    fetchAll()
    setSaving(false)
  }

  const addExpense = async () => {
    if (!newExpense.amount) return
    setSaving(true)
    await supabase.from('expenses').insert({ ...newExpense, amount: Number(newExpense.amount) })
    setNewExpense({ category: 'salary', subcategory: '', amount: '', month: new Date().toISOString().slice(0, 7), note: '' })
    setShowForm(false)
    fetchAll()
    setSaving(false)
  }

  const deleteIncome = async (id: number) => {
    await supabase.from('income').delete().eq('id', id)
    fetchAll()
  }

  const deleteExpense = async (id: number) => {
    await supabase.from('expenses').delete().eq('id', id)
    fetchAll()
  }

  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/') }

  // MONTHS
  const monthsOptions = []
  for (let i = 0; i < 12; i++) {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    monthsOptions.push(d.toISOString().slice(0, 7))
  }

  const allMonths = (() => {
    const m = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date()
      d.setMonth(d.getMonth() - i)
      m.push(d.toISOString().slice(0, 7))
    }
    return m
  })()

  // CALCULATIONS
  const getMonthIncome = (month: string) =>
    income.filter(i => i.month === month).reduce((s, i) => s + i.amount, 0) +
    payments.filter(p => p.month === month && p.status === 'paid').reduce((s, p) => s + p.amount, 0)

  const getMonthExpense = (month: string) =>
    expenses.filter(e => e.month === month).reduce((s, e) => s + e.amount, 0)

  const monthIncome = getMonthIncome(filterMonth)
  const monthExpense = getMonthExpense(filterMonth)
  const monthProfit = monthIncome - monthExpense

  const cashflowData = allMonths.map(month => ({
    name: month.slice(5) + '/' + month.slice(2, 4),
    Киреше: getMonthIncome(month),
    Чыгаша: getMonthExpense(month),
    Пайда: getMonthIncome(month) - getMonthExpense(month),
  }))

  const expensePieData = expenseCategories.map(cat => ({
    name: cat.label,
    value: expenses.filter(e => e.month === filterMonth && e.category === cat.id).reduce((s, e) => s + e.amount, 0),
    color: cat.color,
  })).filter(e => e.value > 0)

  const salaryData = expenses.filter(e => e.month === filterMonth && e.category === 'salary')
  const totalSalary = salaryData.reduce((s, e) => s + e.amount, 0)

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
            {tabs.map(tab => (
              <button key={tab.id} onClick={() => { setActiveTab(tab.id); setShowForm(false) }}
                style={{ padding: '6px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '600',
                  background: activeTab === tab.id ? 'rgba(37,99,235,0.2)' : 'transparent',
                  color: activeTab === tab.id ? '#60A5FA' : 'rgba(255,255,255,0.5)' }}>
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.3)', borderRadius: '20px', padding: '5px 12px', fontSize: '12px', color: GREEN, fontWeight: '600' }}>
            💰 Финансист
          </div>
          <button onClick={handleLogout} style={{ background: 'rgba(239,68,68,0.1)', color: RED, border: 'none', borderRadius: '8px', padding: '7px 14px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
            Чыгуу
          </button>
        </div>
      </div>

      <div style={{ padding: '28px', maxWidth: '1400px', margin: '0 auto' }}>

        {/* MONTH FILTER + SUMMARY */}
        <Animate>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              {[
                { label: 'Киреше', value: monthIncome, color: GREEN },
                { label: 'Чыгаша', value: monthExpense, color: RED },
                { label: 'Пайда', value: monthProfit, color: monthProfit >= 0 ? GREEN : RED },
              ].map(s => (
                <div key={s.label} style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>{s.label}</div>
                  <div style={{ fontWeight: '900', fontSize: '18px', color: s.color }}>{(s.value > 0 ? '+' : '') + s.value.toLocaleString()} сом</div>
                </div>
              ))}
            </div>
            <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)}
              style={{ padding: '10px 16px', borderRadius: '10px', border: `1px solid ${BORDER}`, background: SURFACE, color: '#fff', fontSize: '14px' }}>
              {monthsOptions.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </Animate>

        {/* CASHFLOW TAB */}
        {activeTab === 'cashflow' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px', marginBottom: '20px' }}>
              <Animate>
                <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: '16px', padding: '20px' }}>
                  <div style={{ fontWeight: '700', fontSize: '15px', marginBottom: '4px' }}>📊 CashFlow — 12 ай</div>
                  <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginBottom: '16px' }}>Киреше, Чыгаша, Пайда</div>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={cashflowData}>
                      <XAxis dataKey="name" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: '8px', color: '#fff' }} formatter={(v: any) => v.toLocaleString() + ' сом'} />
                      <Bar dataKey="Киреше" fill={GREEN} radius={[3, 3, 0, 0]} />
                      <Bar dataKey="Чыгаша" fill="#FCA5A5" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="Пайда" fill={BLUE} radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Animate>

              <Animate delay={100}>
                <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: '16px', padding: '20px' }}>
                  <div style={{ fontWeight: '700', fontSize: '15px', marginBottom: '4px' }}>🥧 Чыгашалар</div>
                  <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginBottom: '12px' }}>Категория — {filterMonth}</div>
                  {expensePieData.length > 0 ? (
                    <div>
                      <PieChart width={180} height={150} style={{ margin: '0 auto' }}>
                        <Pie data={expensePieData} cx={85} cy={70} innerRadius={35} outerRadius={65} dataKey="value" paddingAngle={3}>
                          {expensePieData.map((e, i) => <Cell key={i} fill={e.color} />)}
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
                    <div style={{ height: '150px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)', fontSize: '13px' }}>Маалымат жок</div>
                  )}
                </div>
              </Animate>
            </div>

            {/* MONTHLY TABLE */}
            <Animate delay={150}>
              <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: '16px', overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: `1px solid ${BORDER}` }}>
                  <div style={{ fontWeight: '700', fontSize: '14px' }}>📋 Айлык жыйынтык</div>
                </div>
                <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                      {['Ай', 'Киреше', 'Чыгаша', 'Пайда', 'Маржа'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '10px 16px', color: 'rgba(255,255,255,0.4)', fontWeight: '600', fontSize: '11px' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {allMonths.map((month, i) => {
                      const inc = getMonthIncome(month)
                      const exp = getMonthExpense(month)
                      const profit = inc - exp
                      const margin = inc > 0 ? Math.round((profit / inc) * 100) : 0
                      return (
                        <tr key={month} style={{ borderBottom: `1px solid ${BORDER}`, background: month === filterMonth ? 'rgba(37,99,235,0.08)' : 'transparent', cursor: 'pointer' }}
                          onClick={() => setFilterMonth(month)}>
                          <td style={{ padding: '12px 16px', fontWeight: month === filterMonth ? '700' : '400', color: month === filterMonth ? '#60A5FA' : '#fff' }}>{month}</td>
                          <td style={{ padding: '12px 16px', color: GREEN, fontWeight: '600' }}>{inc > 0 ? inc.toLocaleString() + ' сом' : '—'}</td>
                          <td style={{ padding: '12px 16px', color: RED, fontWeight: '600' }}>{exp > 0 ? exp.toLocaleString() + ' сом' : '—'}</td>
                          <td style={{ padding: '12px 16px', fontWeight: '700', color: profit >= 0 ? GREEN : RED }}>
                            {inc > 0 || exp > 0 ? (profit > 0 ? '+' : '') + profit.toLocaleString() + ' сом' : '—'}
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            {inc > 0 && (
                              <span style={{ background: margin >= 0 ? 'rgba(52,211,153,0.15)' : 'rgba(239,68,68,0.15)', color: margin >= 0 ? GREEN : RED, borderRadius: '6px', padding: '2px 8px', fontSize: '11px', fontWeight: '600' }}>
                                {margin}%
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </Animate>
          </div>
        )}

        {/* INCOME TAB */}
        {activeTab === 'income' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h3 style={{ fontWeight: '800', fontSize: '18px', color: GREEN }}>💚 Киреше — {filterMonth}</h3>
              <button onClick={() => setShowForm(p => !p)}
                style={{ background: GREEN, color: '#0D1E4A', border: 'none', borderRadius: '10px', padding: '10px 20px', fontWeight: '700', fontSize: '14px', cursor: 'pointer' }}>
                + Киреше кошуу
              </button>
            </div>
            {showForm && (
              <Animate>
                <div style={{ background: SURFACE, border: '1px solid rgba(52,211,153,0.3)', borderRadius: '16px', padding: '20px', marginBottom: '20px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px', marginBottom: '12px' }}>
                    <div>
                      <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginBottom: '6px' }}>Булак</div>
                      <select value={newIncome.source} onChange={e => setNewIncome(p => ({ ...p, source: e.target.value }))}
                        style={{ width: '100%', padding: '10px', borderRadius: '8px', border: `1px solid ${BORDER}`, background: DARK, color: '#fff', fontSize: '13px', boxSizing: 'border-box' as const }}>
                        {incomeSources.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
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
                    style={{ background: GREEN, color: '#0D1E4A', border: 'none', borderRadius: '8px', padding: '10px 24px', fontWeight: '700', fontSize: '14px', cursor: 'pointer' }}>
                    {saving ? '...' : '+ Кошуу'}
                  </button>
                </div>
              </Animate>
            )}
            <Animate>
              <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: '16px', overflow: 'hidden' }}>
                <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                      {['Булак', 'Сумма', 'Ай', 'Эскертүү', ''].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '12px 16px', color: 'rgba(255,255,255,0.4)', fontWeight: '600', fontSize: '11px' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {income.filter(i => i.month === filterMonth).map((item, i) => (
                      <tr key={item.id} style={{ borderBottom: `1px solid ${BORDER}` }}>
                        <td style={{ padding: '12px 16px', fontWeight: '600' }}>{incomeSources.find(s => s.id === item.source)?.label || item.source}</td>
                        <td style={{ padding: '12px 16px', color: GREEN, fontWeight: '700' }}>{item.amount.toLocaleString()} сом</td>
                        <td style={{ padding: '12px 16px', color: 'rgba(255,255,255,0.5)' }}>{item.month}</td>
                        <td style={{ padding: '12px 16px', color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>{item.note || '—'}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <button onClick={() => deleteIncome(item.id)}
                            style={{ background: 'rgba(239,68,68,0.1)', color: RED, border: 'none', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', fontSize: '11px' }}>🗑</button>
                        </td>
                      </tr>
                    ))}
                    {/* Payments as income */}
                    {payments.filter(p => p.month === filterMonth && p.status === 'paid').map((p, i) => (
                      <tr key={'p' + p.id} style={{ borderBottom: `1px solid ${BORDER}`, background: 'rgba(52,211,153,0.03)' }}>
                        <td style={{ padding: '12px 16px', fontWeight: '600' }}>💳 {p.profiles?.full_name}</td>
                        <td style={{ padding: '12px 16px', color: GREEN, fontWeight: '700' }}>{p.amount.toLocaleString()} сом</td>
                        <td style={{ padding: '12px 16px', color: 'rgba(255,255,255,0.5)' }}>{p.month}</td>
                        <td style={{ padding: '12px 16px', color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>Окуучу оплатасы</td>
                        <td></td>
                      </tr>
                    ))}
                    {income.filter(i => i.month === filterMonth).length === 0 && payments.filter(p => p.month === filterMonth && p.status === 'paid').length === 0 && (
                      <tr><td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: 'rgba(255,255,255,0.3)' }}>Маалымат жок</td></tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: `2px solid ${BORDER}` }}>
                      <td style={{ padding: '12px 16px', fontWeight: '800' }}>ЖАЛПЫ</td>
                      <td style={{ padding: '12px 16px', color: GREEN, fontWeight: '900', fontSize: '16px' }}>{monthIncome.toLocaleString()} сом</td>
                      <td colSpan={3}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Animate>
          </div>
        )}

        {/* EXPENSES TAB */}
        {activeTab === 'expenses' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h3 style={{ fontWeight: '800', fontSize: '18px', color: RED }}>❤️ Чыгаша — {filterMonth}</h3>
              <button onClick={() => setShowForm(p => !p)}
                style={{ background: RED, color: '#0D1E4A', border: 'none', borderRadius: '10px', padding: '10px 20px', fontWeight: '700', fontSize: '14px', cursor: 'pointer' }}>
                + Чыгаша кошуу
              </button>
            </div>
            {showForm && (
              <Animate>
                <div style={{ background: SURFACE, border: '1px solid rgba(239,68,68,0.3)', borderRadius: '16px', padding: '20px', marginBottom: '20px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: '12px', marginBottom: '12px' }}>
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
                      <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginBottom: '6px' }}>Сумма *</div>
                      <input value={newExpense.amount} onChange={e => setNewExpense(p => ({ ...p, amount: e.target.value }))} type="number" placeholder="10000"
                        style={{ width: '100%', padding: '10px', borderRadius: '8px', border: `1px solid ${BORDER}`, background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: '13px', boxSizing: 'border-box' as const }} />
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginBottom: '6px' }}>Ай</div>
                      <input value={newExpense.month} onChange={e => setNewExpense(p => ({ ...p, month: e.target.value }))} type="month"
                        style={{ width: '100%', padding: '10px', borderRadius: '8px', border: `1px solid ${BORDER}`, background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: '13px', boxSizing: 'border-box' as const }} />
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginBottom: '6px' }}>Эскертүү</div>
                      <input value={newExpense.note} onChange={e => setNewExpense(p => ({ ...p, note: e.target.value }))} placeholder="..."
                        style={{ width: '100%', padding: '10px', borderRadius: '8px', border: `1px solid ${BORDER}`, background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: '13px', boxSizing: 'border-box' as const }} />
                    </div>
                  </div>
                  <button onClick={addExpense} disabled={saving}
                    style={{ background: RED, color: '#0D1E4A', border: 'none', borderRadius: '8px', padding: '10px 24px', fontWeight: '700', fontSize: '14px', cursor: 'pointer' }}>
                    {saving ? '...' : '+ Кошуу'}
                  </button>
                </div>
              </Animate>
            )}

            {/* BY CATEGORY */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: '12px', marginBottom: '20px' }}>
              {expenseCategories.map((cat, i) => {
                const total = expenses.filter(e => e.month === filterMonth && e.category === cat.id).reduce((s, e) => s + e.amount, 0)
                return (
                  <Animate key={cat.id} delay={i * 60}>
                    <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '14px' }}>
                      <div style={{ fontSize: '20px', marginBottom: '8px' }}>{cat.icon}</div>
                      <div style={{ fontWeight: '900', fontSize: '16px', color: cat.color, marginBottom: '3px' }}>{total.toLocaleString()} сом</div>
                      <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>{cat.label}</div>
                    </div>
                  </Animate>
                )
              })}
            </div>

            <Animate>
              <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: '16px', overflow: 'hidden' }}>
                <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                      {['Категория', 'Аталышы', 'Сумма', 'Эскертүү', ''].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '12px 16px', color: 'rgba(255,255,255,0.4)', fontWeight: '600', fontSize: '11px' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.filter(e => e.month === filterMonth).map((item, i) => {
                      const cat = expenseCategories.find(c => c.id === item.category)
                      return (
                        <tr key={item.id} style={{ borderBottom: `1px solid ${BORDER}` }}>
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{ background: `${cat?.color}22`, color: cat?.color, borderRadius: '6px', padding: '3px 10px', fontSize: '11px', fontWeight: '600' }}>{cat?.label}</span>
                          </td>
                          <td style={{ padding: '12px 16px', fontWeight: '600' }}>{item.subcategory || '—'}</td>
                          <td style={{ padding: '12px 16px', color: RED, fontWeight: '700' }}>{item.amount.toLocaleString()} сом</td>
                          <td style={{ padding: '12px 16px', color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>{item.note || '—'}</td>
                          <td style={{ padding: '12px 16px' }}>
                            <button onClick={() => deleteExpense(item.id)}
                              style={{ background: 'rgba(239,68,68,0.1)', color: RED, border: 'none', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', fontSize: '11px' }}>🗑</button>
                          </td>
                        </tr>
                      )
                    })}
                    {expenses.filter(e => e.month === filterMonth).length === 0 && (
                      <tr><td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: 'rgba(255,255,255,0.3)' }}>Маалымат жок</td></tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: `2px solid ${BORDER}` }}>
                      <td colSpan={2} style={{ padding: '12px 16px', fontWeight: '800' }}>ЖАЛПЫ</td>
                      <td style={{ padding: '12px 16px', color: RED, fontWeight: '900', fontSize: '16px' }}>{monthExpense.toLocaleString()} сом</td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Animate>
          </div>
        )}

        {/* SALARY TAB */}
        {activeTab === 'salary' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h3 style={{ fontWeight: '800', fontSize: '18px' }}>👥 Зарплата — {filterMonth}</h3>
              <button onClick={() => setShowForm(p => !p)}
                style={{ background: '#3B82F6', color: '#fff', border: 'none', borderRadius: '10px', padding: '10px 20px', fontWeight: '700', fontSize: '14px', cursor: 'pointer' }}>
                + Зарплата кошуу
              </button>
            </div>
            {showForm && (
              <Animate>
                <div style={{ background: SURFACE, border: '1px solid rgba(59,130,246,0.3)', borderRadius: '16px', padding: '20px', marginBottom: '20px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px', marginBottom: '12px' }}>
                    <div>
                      <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginBottom: '6px' }}>Кызматкер аты</div>
                      <input value={newExpense.subcategory} onChange={e => setNewExpense(p => ({ ...p, subcategory: e.target.value, category: 'salary' }))} placeholder="Байэл, Sezim eje..."
                        style={{ width: '100%', padding: '10px', borderRadius: '8px', border: `1px solid ${BORDER}`, background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: '13px', boxSizing: 'border-box' as const }} />
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginBottom: '6px' }}>Сумма (сом) *</div>
                      <input value={newExpense.amount} onChange={e => setNewExpense(p => ({ ...p, amount: e.target.value }))} type="number" placeholder="24000"
                        style={{ width: '100%', padding: '10px', borderRadius: '8px', border: `1px solid ${BORDER}`, background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: '13px', boxSizing: 'border-box' as const }} />
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginBottom: '6px' }}>Ай</div>
                      <input value={newExpense.month} onChange={e => setNewExpense(p => ({ ...p, month: e.target.value }))} type="month"
                        style={{ width: '100%', padding: '10px', borderRadius: '8px', border: `1px solid ${BORDER}`, background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: '13px', boxSizing: 'border-box' as const }} />
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginBottom: '6px' }}>Эскертүү</div>
                      <input value={newExpense.note} onChange={e => setNewExpense(p => ({ ...p, note: e.target.value }))} placeholder="Аванс, бонус..."
                        style={{ width: '100%', padding: '10px', borderRadius: '8px', border: `1px solid ${BORDER}`, background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: '13px', boxSizing: 'border-box' as const }} />
                    </div>
                  </div>
                  <button onClick={addExpense} disabled={saving}
                    style={{ background: '#3B82F6', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 24px', fontWeight: '700', fontSize: '14px', cursor: 'pointer' }}>
                    {saving ? '...' : '+ Кошуу'}
                  </button>
                </div>
              </Animate>
            )}
            <Animate>
              <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: '16px', overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontWeight: '700', fontSize: '14px' }}>Зарплаталар — {filterMonth}</div>
                  <div style={{ fontWeight: '800', color: '#3B82F6', fontSize: '16px' }}>{totalSalary.toLocaleString()} сом</div>
                </div>
                <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                      {['Кызматкер', 'Сумма', 'Эскертүү', ''].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '12px 16px', color: 'rgba(255,255,255,0.4)', fontWeight: '600', fontSize: '11px' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {salaryData.map((item, i) => (
                      <tr key={item.id} style={{ borderBottom: `1px solid ${BORDER}` }}>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ width: '32px', height: '32px', background: '#3B82F6', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '13px' }}>
                              {item.subcategory?.[0] || '?'}
                            </div>
                            <span style={{ fontWeight: '600' }}>{item.subcategory || '—'}</span>
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px', color: '#60A5FA', fontWeight: '700', fontSize: '15px' }}>{item.amount.toLocaleString()} сом</td>
                        <td style={{ padding: '12px 16px', color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>{item.note || '—'}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <button onClick={() => deleteExpense(item.id)}
                            style={{ background: 'rgba(239,68,68,0.1)', color: RED, border: 'none', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', fontSize: '11px' }}>🗑</button>
                        </td>
                      </tr>
                    ))}
                    {salaryData.length === 0 && (
                      <tr><td colSpan={4} style={{ padding: '32px', textAlign: 'center', color: 'rgba(255,255,255,0.3)' }}>Зарплаталар кошулган жок</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Animate>
          </div>
        )}

        {/* PAYMENTS TAB */}
        {activeTab === 'payments' && (
          <div>
            <h3 style={{ fontWeight: '800', fontSize: '18px', marginBottom: '20px' }}>💳 Окуучулардын оплаталары — {filterMonth}</h3>
            <Animate>
              <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: '16px', overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontWeight: '700', fontSize: '14px' }}>Оплаталар</div>
                  <div style={{ fontWeight: '800', color: GREEN, fontSize: '16px' }}>
                    {payments.filter(p => p.month === filterMonth && p.status === 'paid').reduce((s, p) => s + p.amount, 0).toLocaleString()} сом
                  </div>
                </div>
                <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                      {['Окуучу', 'Сумма', 'Статус', 'Эскертүү', 'Күн'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '12px 16px', color: 'rgba(255,255,255,0.4)', fontWeight: '600', fontSize: '11px' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {payments.filter(p => p.month === filterMonth).map((p, i) => (
                      <tr key={p.id} style={{ borderBottom: `1px solid ${BORDER}` }}>
                        <td style={{ padding: '12px 16px', fontWeight: '600' }}>{p.profiles?.full_name}</td>
                        <td style={{ padding: '12px 16px', color: p.status === 'paid' ? GREEN : RED, fontWeight: '700' }}>{p.amount.toLocaleString()} сом</td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{
                            background: p.status === 'paid' ? 'rgba(52,211,153,0.15)' : 'rgba(239,68,68,0.15)',
                            color: p.status === 'paid' ? GREEN : RED,
                            borderRadius: '6px', padding: '3px 8px', fontSize: '11px', fontWeight: '600'
                          }}>
                            {p.status === 'paid' ? '✅ Төлөдү' : p.status === 'debt' ? '⚠️ Карыз' : '🔶 Жарым'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>{p.note || '—'}</td>
                        <td style={{ padding: '12px 16px', color: 'rgba(255,255,255,0.4)', fontSize: '11px' }}>{new Date(p.created_at).toLocaleDateString('ru')}</td>
                      </tr>
                    ))}
                    {payments.filter(p => p.month === filterMonth).length === 0 && (
                      <tr><td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: 'rgba(255,255,255,0.3)' }}>Оплаталар жок</td></tr>
                    )}
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