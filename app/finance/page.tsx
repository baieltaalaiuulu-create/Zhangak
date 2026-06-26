'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import Navbar from '@/components/Navbar'

function Animate({ children, delay = 0 }: { children: React.ReactNode, delay?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [v, setV] = useState(false)
  useEffect(() => {
    const o = new IntersectionObserver(([e]) => { if (e.isIntersecting) setV(true) }, { threshold: 0.05 })
    if (ref.current) o.observe(ref.current)
    return () => o.disconnect()
  }, [])
  return (
    <div ref={ref} style={{ opacity: v ? 1 : 0, transform: v ? 'translateY(0)' : 'translateY(16px)', transition: `opacity 0.4s ease ${delay}ms, transform 0.4s ease ${delay}ms` }}>
      {children}
    </div>
  )
}

const BLUE = '#0071E3'
const BG = '#F5F5F7'
const WHITE = '#ffffff'
const BORDER = '#E5E5EA'
const TEXT = '#1D1D1F'
const MUTED = '#6B6B6B'
const LIGHT = '#8A8A8E'

const expenseCategories = [
  { id: 'salary',   label: 'Зарплата',      color: '#0071E3', icon: '👥' },
  { id: 'marketing',label: 'Маркетинг',     color: '#FF6B9D', icon: '📱' },
  { id: 'trainer',  label: 'Тренер/Ментор', color: '#A259FF', icon: '🎓' },
  { id: 'office',   label: 'Офис',          color: '#F5A623', icon: '🏢' },
  { id: 'other',    label: 'Башка',         color: '#8A8A8E', icon: '📦' },
]

const incomeSources = [
  { id: 'B1', label: 'B1 Курс' },
  { id: 'B2', label: 'B2 Курс' },
  { id: 'intensive', label: 'Жайкы интенсив' },
  { id: 'online', label: 'Онлайн' },
  { id: 'other', label: 'Башка' },
]

const tabs = [
  { id: 'cashflow', label: ' CashFlow' },
  { id: 'income',   label: ' Киреше' },
  { id: 'expenses', label: ' Чыгаша' },
  { id: 'salary',   label: ' Зарплата' },
  { id: 'payments', label: ' Оплаталар' },
]

const avatarColors = ['#5856D6','#AF52DE','#FF6B9D','#F5A623','#34C759','#0071E3','#FF9500','#FF3B30']

function Avatar({ name, size = 28 }: { name: string, size?: number }) {
  const initials = name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase()
  const color = avatarColors[name.charCodeAt(0) % avatarColors.length]
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.36, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
      {initials}
    </div>
  )
}

function Pill({ status }: { status: string }) {
  const map: Record<string, { bg: string, color: string, label: string }> = {
    paid:  { bg: '#E8F8EF', color: '#00874A', label: '✅ Төлөдү' },
    debt:  { bg: '#FFF0F0', color: '#D92F2F', label: '⚠️ Карыз' },
    partial:{ bg: '#FFF8E6', color: '#B25000', label: '🔶 Жарым' },
  }
  const s = map[status] || map.debt
  return (
    <span style={{ background: s.bg, color: s.color, fontSize: 10, padding: '3px 10px', borderRadius: 20, fontWeight: 600 }}>
      {s.label}
    </span>
  )
}

export default function FinancePage() {
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('cashflow')
  const [income, setIncome] = useState<any[]>([])
  const [expenses, setExpenses] = useState<any[]>([])
  const [payments, setPayments] = useState<any[]>([])
  const [filterMonth, setFilterMonth] = useState(new Date().toISOString().slice(0, 7))
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [newIncome, setNewIncome] = useState({ source: 'B1', amount: '', month: new Date().toISOString().slice(0, 7), note: '' })
  const [newExpense, setNewExpense] = useState({ category: 'salary', subcategory: '', amount: '', month: new Date().toISOString().slice(0, 7), note: '' })
  const router = useRouter()

  useEffect(() => { checkAuth() }, [])

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (!profile || profile.role !== 'finance') { await supabase.auth.signOut(); router.push('/'); return }
    fetchAll()
  }

  const fetchAll = async () => {
    const [i, e, p] = await Promise.all([
      supabase.from('income').select('*').order('month'),
      supabase.from('expenses').select('*').order('month'),
      supabase.from('payments').select('*, profiles(full_name)').order('created_at', { ascending: false }),
    ])
    setIncome(i.data || [])
    setExpenses(e.data || [])
    setPayments(p.data || [])
    setLoading(false)
  }

  const addIncome = async () => {
    if (!newIncome.amount) return
    setSaving(true)
    await supabase.from('income').insert({ ...newIncome, amount: Number(newIncome.amount) })
    setNewIncome({ source: 'B1', amount: '', month: filterMonth, note: '' })
    setShowForm(false)
    fetchAll(); setSaving(false)
  }

  const addExpense = async () => {
    if (!newExpense.amount) return
    setSaving(true)
    await supabase.from('expenses').insert({ ...newExpense, amount: Number(newExpense.amount) })
    setNewExpense({ category: 'salary', subcategory: '', amount: '', month: filterMonth, note: '' })
    setShowForm(false)
    fetchAll(); setSaving(false)
  }

  const deleteIncome = async (id: number) => { await supabase.from('income').delete().eq('id', id); fetchAll() }
  const deleteExpense = async (id: number) => { await supabase.from('expenses').delete().eq('id', id); fetchAll() }

  const monthsOptions = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(); d.setMonth(d.getMonth() - i)
    return d.toISOString().slice(0, 7)
  })

  const allMonths = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(); d.setMonth(d.getMonth() - 11 + i)
    return d.toISOString().slice(0, 7)
  })

  const getInc = (m: string) =>
    income.filter(i => i.month === m).reduce((s, i) => s + i.amount, 0) +
    payments.filter(p => p.month === m && p.status === 'paid').reduce((s, p) => s + p.amount, 0)

  const getExp = (m: string) => expenses.filter(e => e.month === m).reduce((s, e) => s + e.amount, 0)

  const mInc = getInc(filterMonth)
  const mExp = getExp(filterMonth)
  const mProfit = mInc - mExp

  const cashflowData = allMonths.map(m => ({
    name: m.slice(5) + '/' + m.slice(2, 4),
    Киреше: getInc(m),
    Чыгаша: getExp(m),
  }))

  const pieData = expenseCategories.map(c => ({
    name: c.label,
    value: expenses.filter(e => e.month === filterMonth && e.category === c.id).reduce((s, e) => s + e.amount, 0),
    color: c.color,
  })).filter(e => e.value > 0)

  const salaryData = expenses.filter(e => e.month === filterMonth && e.category === 'salary')

  // ── STYLES ──────────────────────────────────────────────
  const S: Record<string, React.CSSProperties> = {
    page:    { minHeight: '100vh', background: BG, fontFamily: '-apple-system, BlinkMacSystemFont, Inter, sans-serif' },
    nav:     { background: BLUE, padding: '0 28px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 },
    logoBox: { width: 32, height: 32, background: 'rgba(255,255,255,0.2)', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#fff' },
    logoText:{ color: '#fff', fontWeight: 700, fontSize: 16 },
    tabBar:  { display: 'flex', gap: 2, background: 'rgba(255,255,255,0.12)', padding: 4, borderRadius: 10 },
    tabBtn:  { padding: '6px 16px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500, background: 'transparent', color: 'rgba(255,255,255,0.65)', transition: 'all 0.15s' },
    tabActive:{ background: 'rgba(255,255,255,0.22)', color: '#fff' },
    badge:   { background: 'rgba(255,255,255,0.2)', color: '#fff', fontSize: 11, padding: '4px 12px', borderRadius: 20, fontWeight: 600 },
    exitBtn: { background: '#FFF0F0', color: '#D92F2F', border: 'none', borderRadius: 7, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' },
    body:    { padding: 28, maxWidth: 1400, margin: '0 auto' },
    topBar:  { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap' as const, gap: 12 },
    kpiRow:  { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 },
    kpiCard: { background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '16px 18px' },
    kpiLbl:  { fontSize: 11, color: LIGHT, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.4px', marginBottom: 6 },
    kpiVal:  { fontSize: 22, fontWeight: 700, letterSpacing: '-0.5px' },
    kpiSub:  { fontSize: 11, color: LIGHT, marginTop: 3 },
    grid2:   { display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 14, marginBottom: 16 },
    card:    { background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 18 },
    cardTtl: { fontSize: 13, color: TEXT, fontWeight: 600, marginBottom: 14 },
    table:   { background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, overflow: 'hidden' as const },
    tHead:   { background: '#F9F9F9', borderBottom: `1px solid ${BORDER}`, padding: '10px 18px', display: 'grid' },
    tTh:     { fontSize: 10, color: LIGHT, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.4px' },
    tRow:    { padding: '12px 18px', display: 'grid', borderBottom: `1px solid #F2F2F7`, alignItems: 'center' },
    cell:    { fontSize: 13, color: MUTED },
    cellAmt: { fontSize: 13, color: BLUE, fontWeight: 700 },
    input:   { padding: '9px 12px', border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 13, background: WHITE, color: TEXT, outline: 'none', width: '100%', boxSizing: 'border-box' as const },
    select:  { padding: '9px 12px', border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 13, background: WHITE, color: TEXT, outline: 'none' },
    btnGreen:{ background: '#00874A', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 22px', fontWeight: 700, fontSize: 13, cursor: 'pointer' },
    btnRed:  { background: '#FFF0F0', color: '#D92F2F', border: 'none', borderRadius: 8, padding: '10px 22px', fontWeight: 700, fontSize: 13, cursor: 'pointer' },
    btnBlue: { background: BLUE, color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontWeight: 600, fontSize: 13, cursor: 'pointer' },
    btnDel:  { background: '#FFF0F0', color: '#D92F2F', border: 'none', borderRadius: 6, padding: '4px 9px', cursor: 'pointer', fontSize: 12 },
    monthSel:{ padding: '7px 12px', border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 12, background: WHITE, color: TEXT },
    searchBox:{ padding: '7px 12px', border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 12, background: WHITE, color: TEXT, outline: 'none', width: 180 },
    formCard:{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 20, marginBottom: 16 },
    formGrid:{ display: 'grid', gap: 12, marginBottom: 14 },
  }

  if (loading) return (
    <div style={{ ...S.page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ ...S.logoBox, margin: '0 auto 12px', width: 48, height: 48, fontSize: 20 }}>Ж</div>
        <div style={{ color: MUTED, fontSize: 14 }}>Жүктөлүүдө...</div>
      </div>
    </div>
  )

  return (
    <div style={S.page}>
      {/* NAVBAR */}
      <Navbar
  tabs={tabs}
  activeTab={activeTab}
  onTabChange={(id) => { setActiveTab(id); setShowForm(false) }}
  role="💰 Финансист"
/>

      <div style={S.body}>
        {/* TOP BAR */}
        <div style={S.topBar}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' as const }}>
            {[
              { label: 'Киреше', val: mInc, color: '#00874A' },
              { label: 'Чыгаша', val: mExp, color: '#D92F2F' },
              { label: 'Пайда',  val: mProfit, color: mProfit >= 0 ? '#00874A' : '#D92F2F' },
            ].map(s => (
              <div key={s.label} style={{ ...S.kpiCard, padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ fontSize: 11, color: LIGHT, fontWeight: 600 }}>{s.label}</div>
                <div style={{ fontSize: 17, fontWeight: 800, color: s.color }}>
                  {(s.val > 0 ? '+' : '') + s.val.toLocaleString()} сом
                </div>
              </div>
            ))}
          </div>
          <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} style={S.monthSel}>
            {monthsOptions.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        {/* ── CASHFLOW ── */}
        {activeTab === 'cashflow' && (
          <div>
            <div style={S.grid2}>
              <Animate>
                <div style={S.card}>
                  <div style={S.cardTtl}>📊 CashFlow — 12 ай</div>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={cashflowData} barSize={10}>
                      <XAxis dataKey="name" tick={{ fill: LIGHT, fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: LIGHT, fontSize: 10 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 12 }} formatter={(v: any) => v.toLocaleString() + ' сом'} />
                      <Bar dataKey="Киреше" fill="#BBEAD4" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Чыгаша" fill="#FFC5C5" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Animate>
              <Animate delay={80}>
                <div style={S.card}>
                  <div style={S.cardTtl}>🥧 Чыгашалар — {filterMonth}</div>
                  {pieData.length > 0 ? (
                    <div>
                      <PieChart width={160} height={140} style={{ margin: '0 auto' }}>
                        <Pie data={pieData} cx={76} cy={66} innerRadius={38} outerRadius={62} dataKey="value" paddingAngle={3}>
                          {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                        </Pie>
                        <Tooltip contentStyle={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 12 }} formatter={(v: any) => v.toLocaleString() + ' сом'} />
                      </PieChart>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                        {pieData.map((e, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <div style={{ width: 8, height: 8, borderRadius: 2, background: e.color }} />
                              <span style={{ fontSize: 11, color: MUTED }}>{e.name}</span>
                            </div>
                            <span style={{ fontSize: 11, fontWeight: 700, color: TEXT }}>{e.value.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : <div style={{ height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', color: LIGHT, fontSize: 13 }}>Маалымат жок</div>}
                </div>
              </Animate>
            </div>

            <Animate delay={120}>
              <div style={S.table}>
                <div style={{ ...S.tHead, gridTemplateColumns: 'repeat(5,1fr)' }}>
                  {['Ай','Киреше','Чыгаша','Пайда','Маржа'].map(h => <div key={h} style={S.tTh}>{h}</div>)}
                </div>
                {allMonths.map(m => {
                  const inc = getInc(m), exp = getExp(m), profit = inc - exp
                  const margin = inc > 0 ? Math.round(profit / inc * 100) : 0
                  return (
                    <div key={m} onClick={() => setFilterMonth(m)}
                      style={{ ...S.tRow, gridTemplateColumns: 'repeat(5,1fr)', background: m === filterMonth ? '#EEF5FF' : WHITE, cursor: 'pointer' }}>
                      <div style={{ fontSize: 13, fontWeight: m === filterMonth ? 700 : 500, color: m === filterMonth ? BLUE : TEXT }}>{m}</div>
                      <div style={{ ...S.cell, color: '#00874A', fontWeight: 600 }}>{inc > 0 ? inc.toLocaleString() + ' сом' : '—'}</div>
                      <div style={{ ...S.cell, color: '#D92F2F', fontWeight: 600 }}>{exp > 0 ? exp.toLocaleString() + ' сом' : '—'}</div>
                      <div style={{ ...S.cell, color: profit >= 0 ? '#00874A' : '#D92F2F', fontWeight: 700 }}>
                        {inc > 0 || exp > 0 ? (profit > 0 ? '+' : '') + profit.toLocaleString() + ' сом' : '—'}
                      </div>
                      <div>
                        {inc > 0 && <span style={{ background: margin >= 0 ? '#E8F8EF' : '#FFF0F0', color: margin >= 0 ? '#00874A' : '#D92F2F', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6 }}>{margin}%</span>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </Animate>
          </div>
        )}

        {/* ── INCOME ── */}
        {activeTab === 'income' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 17, fontWeight: 700, color: TEXT }}> Киреше — {filterMonth}</h3>
              <button onClick={() => setShowForm(p => !p)} style={S.btnGreen}>+ Киреше кошуу</button>
            </div>
            {showForm && (
              <Animate>
                <div style={{ ...S.formCard, borderColor: '#BBEAD4' }}>
                  <div style={{ ...S.formGrid, gridTemplateColumns: 'repeat(4,1fr)' }}>
                    {[
                      { label: 'Булак', el: <select value={newIncome.source} onChange={e => setNewIncome(p => ({ ...p, source: e.target.value }))} style={S.select}>{incomeSources.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select> },
                      { label: 'Сумма (сом) *', el: <input value={newIncome.amount} onChange={e => setNewIncome(p => ({ ...p, amount: e.target.value }))} type="number" placeholder="50000" style={S.input} /> },
                      { label: 'Ай', el: <input value={newIncome.month} onChange={e => setNewIncome(p => ({ ...p, month: e.target.value }))} type="month" style={S.input} /> },
                      { label: 'Эскертүү', el: <input value={newIncome.note} onChange={e => setNewIncome(p => ({ ...p, note: e.target.value }))} placeholder="..." style={S.input} /> },
                    ].map(f => (
                      <div key={f.label}>
                        <div style={{ fontSize: 11, color: LIGHT, fontWeight: 600, marginBottom: 6 }}>{f.label}</div>
                        {f.el}
                      </div>
                    ))}
                  </div>
                  <button onClick={addIncome} disabled={saving} style={S.btnGreen}>{saving ? '...' : '+ Кошуу'}</button>
                </div>
              </Animate>
            )}
            <Animate>
              <div style={S.table}>
                <div style={{ ...S.tHead, gridTemplateColumns: '2fr 1fr 1fr 1fr 50px' }}>
                  {['Булак','Сумма','Ай','Эскертүү',''].map(h => <div key={h} style={S.tTh}>{h}</div>)}
                </div>
                {income.filter(i => i.month === filterMonth).map(item => (
                  <div key={item.id} style={{ ...S.tRow, gridTemplateColumns: '2fr 1fr 1fr 1fr 50px', background: WHITE }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: TEXT }}>{incomeSources.find(s => s.id === item.source)?.label || item.source}</div>
                    <div style={S.cellAmt}>{item.amount.toLocaleString()} сом</div>
                    <div style={S.cell}>{item.month}</div>
                    <div style={{ ...S.cell, fontSize: 12 }}>{item.note || '—'}</div>
                    <button onClick={() => deleteIncome(item.id)} style={S.btnDel}>🗑</button>
                  </div>
                ))}
                {income.filter(i => i.month === filterMonth).length === 0 &&
                  <div style={{ padding: 32, textAlign: 'center', color: LIGHT, fontSize: 13 }}>Маалымат жок</div>}
                <div style={{ padding: '12px 18px', background: '#F9F9F9', borderTop: `1px solid ${BORDER}`, display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>ЖАЛПЫ</span>
                  <span style={{ fontSize: 16, fontWeight: 800, color: '#00874A' }}>{mInc.toLocaleString()} сом</span>
                </div>
              </div>
            </Animate>
          </div>
        )}

        {/* ── EXPENSES ── */}
        {activeTab === 'expenses' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 17, fontWeight: 700, color: TEXT }}> Чыгаша — {filterMonth}</h3>
              <button onClick={() => setShowForm(p => !p)} style={{ ...S.btnGreen, background: '#D92F2F' }}>+ Чыгаша кошуу</button>
            </div>
            {showForm && (
              <Animate>
                <div style={{ ...S.formCard, borderColor: '#FFC5C5' }}>
                  <div style={{ ...S.formGrid, gridTemplateColumns: 'repeat(5,1fr)' }}>
                    {[
                      { label: 'Категория', el: <select value={newExpense.category} onChange={e => setNewExpense(p => ({ ...p, category: e.target.value }))} style={S.select}>{expenseCategories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</select> },
                      { label: 'Аталышы', el: <input value={newExpense.subcategory} onChange={e => setNewExpense(p => ({ ...p, subcategory: e.target.value }))} placeholder="Аренда..." style={S.input} /> },
                      { label: 'Сумма *', el: <input value={newExpense.amount} onChange={e => setNewExpense(p => ({ ...p, amount: e.target.value }))} type="number" placeholder="10000" style={S.input} /> },
                      { label: 'Ай', el: <input value={newExpense.month} onChange={e => setNewExpense(p => ({ ...p, month: e.target.value }))} type="month" style={S.input} /> },
                      { label: 'Эскертүү', el: <input value={newExpense.note} onChange={e => setNewExpense(p => ({ ...p, note: e.target.value }))} placeholder="..." style={S.input} /> },
                    ].map(f => (
                      <div key={f.label}>
                        <div style={{ fontSize: 11, color: LIGHT, fontWeight: 600, marginBottom: 6 }}>{f.label}</div>
                        {f.el}
                      </div>
                    ))}
                  </div>
                  <button onClick={addExpense} disabled={saving} style={{ ...S.btnGreen, background: '#D92F2F' }}>{saving ? '...' : '+ Кошуу'}</button>
                </div>
              </Animate>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10, marginBottom: 16 }}>
              {expenseCategories.map((cat, i) => {
                const total = expenses.filter(e => e.month === filterMonth && e.category === cat.id).reduce((s, e) => s + e.amount, 0)
                return (
                  <Animate key={cat.id} delay={i * 50}>
                    <div style={S.kpiCard}>
                      <div style={{ fontSize: 20, marginBottom: 6 }}>{cat.icon}</div>
                      <div style={{ fontSize: 17, fontWeight: 800, color: cat.color, marginBottom: 2 }}>{total.toLocaleString()}</div>
                      <div style={{ fontSize: 11, color: LIGHT, fontWeight: 600 }}>{cat.label}</div>
                    </div>
                  </Animate>
                )
              })}
            </div>
            <Animate>
              <div style={S.table}>
                <div style={{ ...S.tHead, gridTemplateColumns: '1.5fr 1.5fr 1fr 1.5fr 50px' }}>
                  {['Категория','Аталышы','Сумма','Эскертүү',''].map(h => <div key={h} style={S.tTh}>{h}</div>)}
                </div>
                {expenses.filter(e => e.month === filterMonth).map(item => {
                  const cat = expenseCategories.find(c => c.id === item.category)
                  return (
                    <div key={item.id} style={{ ...S.tRow, gridTemplateColumns: '1.5fr 1.5fr 1fr 1.5fr 50px', background: WHITE }}>
                      <div><span style={{ background: cat?.color + '20', color: cat?.color, fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 6 }}>{cat?.label}</span></div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: TEXT }}>{item.subcategory || '—'}</div>
                      <div style={{ ...S.cell, color: '#D92F2F', fontWeight: 700 }}>{item.amount.toLocaleString()} сом</div>
                      <div style={{ ...S.cell, fontSize: 12 }}>{item.note || '—'}</div>
                      <button onClick={() => deleteExpense(item.id)} style={S.btnDel}>🗑</button>
                    </div>
                  )
                })}
                {expenses.filter(e => e.month === filterMonth).length === 0 &&
                  <div style={{ padding: 32, textAlign: 'center', color: LIGHT, fontSize: 13 }}>Маалымат жок</div>}
                <div style={{ padding: '12px 18px', background: '#F9F9F9', borderTop: `1px solid ${BORDER}`, display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>ЖАЛПЫ</span>
                  <span style={{ fontSize: 16, fontWeight: 800, color: '#D92F2F' }}>{mExp.toLocaleString()} сом</span>
                </div>
              </div>
            </Animate>
          </div>
        )}

        {/* ── SALARY ── */}
        {activeTab === 'salary' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 17, fontWeight: 700, color: TEXT }}>👥 Зарплата — {filterMonth}</h3>
              <button onClick={() => setShowForm(p => !p)} style={S.btnBlue}>+ Зарплата кошуу</button>
            </div>
            {showForm && (
              <Animate>
                <div style={{ ...S.formCard, borderColor: '#B3D4F7' }}>
                  <div style={{ ...S.formGrid, gridTemplateColumns: 'repeat(4,1fr)' }}>
                    {[
                      { label: 'Кызматкер аты', el: <input value={newExpense.subcategory} onChange={e => setNewExpense(p => ({ ...p, subcategory: e.target.value, category: 'salary' }))} placeholder="Байэл..." style={S.input} /> },
                      { label: 'Сумма (сом) *', el: <input value={newExpense.amount} onChange={e => setNewExpense(p => ({ ...p, amount: e.target.value }))} type="number" placeholder="24000" style={S.input} /> },
                      { label: 'Ай', el: <input value={newExpense.month} onChange={e => setNewExpense(p => ({ ...p, month: e.target.value }))} type="month" style={S.input} /> },
                      { label: 'Эскертүү', el: <input value={newExpense.note} onChange={e => setNewExpense(p => ({ ...p, note: e.target.value }))} placeholder="Аванс..." style={S.input} /> },
                    ].map(f => (
                      <div key={f.label}>
                        <div style={{ fontSize: 11, color: LIGHT, fontWeight: 600, marginBottom: 6 }}>{f.label}</div>
                        {f.el}
                      </div>
                    ))}
                  </div>
                  <button onClick={addExpense} disabled={saving} style={S.btnBlue}>{saving ? '...' : '+ Кошуу'}</button>
                </div>
              </Animate>
            )}
            <Animate>
              <div style={S.table}>
                <div style={{ padding: '10px 18px', background: '#F0F7FF', borderBottom: `1px solid ${BORDER}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>Зарплаталар — {filterMonth}</span>
                  <span style={{ fontSize: 17, fontWeight: 800, color: BLUE }}>{salaryData.reduce((s, e) => s + e.amount, 0).toLocaleString()} сом</span>
                </div>
                <div style={{ ...S.tHead, gridTemplateColumns: '2fr 1fr 1fr 60px', background: '#F9F9F9' }}>
                  {['Кызматкер','Сумма','Эскертүү',''].map(h => <div key={h} style={S.tTh}>{h}</div>)}
                </div>
                {salaryData.map(item => (
                  <div key={item.id} style={{ ...S.tRow, gridTemplateColumns: '2fr 1fr 1fr 60px', background: WHITE }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Avatar name={item.subcategory || '?'} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>{item.subcategory || '—'}</span>
                    </div>
                    <div style={{ ...S.cellAmt }}>{item.amount.toLocaleString()} сом</div>
                    <div style={{ ...S.cell, fontSize: 12 }}>{item.note || '—'}</div>
                    <button onClick={() => deleteExpense(item.id)} style={S.btnDel}>🗑</button>
                  </div>
                ))}
                {salaryData.length === 0 &&
                  <div style={{ padding: 32, textAlign: 'center', color: LIGHT, fontSize: 13 }}>Зарплаталар кошулган жок</div>}
              </div>
            </Animate>
          </div>
        )}

        {/* ── PAYMENTS ── */}
        {activeTab === 'payments' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 17, fontWeight: 700, color: TEXT }}>💳 Оплаталар — {filterMonth}</h3>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Окуучу издөө..." style={S.searchBox} />
            </div>
            <Animate>
              <div style={S.table}>
                <div style={{ padding: '10px 18px', background: '#F0F7FF', borderBottom: `1px solid ${BORDER}`, display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>Оплаталар</span>
                  <span style={{ fontSize: 17, fontWeight: 800, color: '#00874A' }}>
                    {payments.filter(p => p.month === filterMonth && p.status === 'paid').reduce((s, p) => s + p.amount, 0).toLocaleString()} сом
                  </span>
                </div>
                <div style={{ ...S.tHead, gridTemplateColumns: '2fr 1fr 1fr 1fr 100px' }}>
                  {['Окуучу','Сумма','Статус','Эскертүү','Күн'].map(h => <div key={h} style={S.tTh}>{h}</div>)}
                </div>
                {payments
                  .filter(p => p.month === filterMonth)
                  .filter(p => !search || p.profiles?.full_name?.toLowerCase().includes(search.toLowerCase()))
                  .map(p => (
                    <div key={p.id} style={{ ...S.tRow, gridTemplateColumns: '2fr 1fr 1fr 1fr 100px', background: WHITE }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Avatar name={p.profiles?.full_name || '?'} size={26} />
                        <span style={{ fontSize: 13, fontWeight: 500, color: TEXT }}>{p.profiles?.full_name}</span>
                      </div>
                      <div style={{ ...S.cell, color: p.status === 'paid' ? '#00874A' : '#D92F2F', fontWeight: 700 }}>{p.amount.toLocaleString()} сом</div>
                      <div><Pill status={p.status} /></div>
                      <div style={{ ...S.cell, fontSize: 12 }}>{p.note || '—'}</div>
                      <div style={{ fontSize: 11, color: LIGHT }}>{new Date(p.created_at).toLocaleDateString('ru')}</div>
                    </div>
                  ))}
                {payments.filter(p => p.month === filterMonth).length === 0 &&
                  <div style={{ padding: 32, textAlign: 'center', color: LIGHT, fontSize: 13 }}>Оплаталар жок</div>}
              </div>
            </Animate>
          </div>
        )}
      </div>
    </div>
  )
}