'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { CalendarDays, CheckCircle2, Flame, Gift, RefreshCw, Sparkles, Trophy } from 'lucide-react'

import { useStudentSession } from '@/components/student/StudentSessionContext'
import { claimQuestReward, getGamificationSummary, type GamificationSummary, type QuestProgress } from '@/lib/platform-community'

function timeLeft(periodEnd: string): string {
  const remaining = Math.max(0, new Date(periodEnd).getTime() - Date.now())
  const hours = Math.floor(remaining / 3_600_000)
  const minutes = Math.floor((remaining % 3_600_000) / 60_000)
  if (hours >= 24) return `${Math.floor(hours / 24)} д. ${hours % 24} ч.`
  return `${hours} ч. ${minutes} мин.`
}

function QuestCard({ quest, busy, onClaim }: { quest: QuestProgress; busy: boolean; onClaim: () => void }) {
  const complete = quest.completedAt !== null
  const percent = Math.min(100, Math.round((quest.currentCount / Math.max(1, quest.targetCount)) * 100))
  return (
    <article className={`rounded-2xl border p-4 transition-transform duration-300 motion-reduce:transition-none ${complete ? 'border-emerald-200 bg-emerald-50/70' : quest.claimable ? 'border-red-300 bg-red-50 shadow-[0_8px_22px_rgba(220,38,38,.12)]' : 'border-[#E4E1F8] bg-white hover:-translate-y-0.5 motion-reduce:hover:translate-y-0'}`}>
      <div className="flex items-start gap-3">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${complete ? 'bg-emerald-500 text-white' : 'bg-violet-100 text-violet-700'}`}>
          {complete ? <CheckCircle2 size={23} aria-hidden="true" /> : quest.claimable ? <Gift size={22} aria-hidden="true" /> : <Sparkles size={22} aria-hidden="true" />}
        </span>
        <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><h2 className="min-w-0 flex-1 truncate text-[15px] font-extrabold text-[#191B23]">{quest.title}</h2><span className="shrink-0 text-xs font-black text-violet-700">+{quest.xpReward} XP</span></div><p className="mt-1 text-xs leading-5 text-slate-500">{quest.description}</p></div>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 text-xs font-bold"><span className={complete ? 'text-emerald-700' : quest.claimable ? 'text-red-700' : 'text-slate-600'}>{complete ? 'Квест выполнен' : quest.claimable ? 'Награда готова' : `${quest.currentCount} из ${quest.targetCount}`}</span><span className="text-slate-400">{complete ? 'Награда начислена' : `Осталось ${timeLeft(quest.periodEnd)}`}</span></div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-violet-100"><div className={`h-full rounded-full transition-all duration-500 motion-reduce:transition-none ${complete ? 'bg-emerald-500' : 'bg-violet-600'}`} style={{ width: `${percent}%` }} /></div>
      {quest.claimable && <button type="button" disabled={busy} onClick={onClaim} className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 text-sm font-black text-white shadow-[0_3px_0_#991B1B] disabled:opacity-60"><Gift size={18} aria-hidden="true" />{busy ? 'Получаем…' : `Забрать +${quest.xpReward} XP`}</button>}
    </article>
  )
}

export default function QuestsPage() {
  useStudentSession()
  const [summary, setSummary] = useState<GamificationSummary | null>(null)
  const [period, setPeriod] = useState<'daily' | 'weekly'>('daily')
  const [error, setError] = useState(false)
  const [retry, setRetry] = useState(0)
  const [claiming, setClaiming] = useState<number | null>(null)

  useEffect(() => {
    let active = true
    void getGamificationSummary()
      .then(value => { if (active) { setSummary(value); setError(false) } })
      .catch(() => { if (active) setError(true) })
    return () => { active = false }
  }, [retry])

  const quests = useMemo(() => summary?.quests.filter(item => item.period === period) ?? [], [period, summary])
  const completed = quests.filter(item => item.completedAt).length
  const claim = async (quest: QuestProgress) => {
    if (!quest.progressId || !quest.claimable) return
    setClaiming(quest.progressId)
    try {
      const result = await claimQuestReward(quest.progressId)
      setSummary(result.summary)
      window.dispatchEvent(new CustomEvent('zhangak:quest-rewards', { detail: { pending: result.summary.pendingQuestRewards } }))
    } catch { setError(true) } finally { setClaiming(null) }
  }

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-4 pb-28 pt-5 sm:px-6 md:pb-10">
      <header className="rounded-[26px] bg-gradient-to-br from-[#1B3F92] to-[#6C3DE0] p-5 text-white shadow-[0_10px_24px_rgba(40,45,120,0.2)]">
        <div className="flex items-start gap-3"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15"><Trophy size={26} aria-hidden="true" /></span><div className="min-w-0"><p className="text-[11px] font-extrabold uppercase tracking-[.12em] text-white/70">Твой игровой прогресс</p><h1 className="mt-1 text-2xl font-black">Квесты Zhangak</h1><p className="mt-1 text-sm text-white/80">Выполняй задания и забирай готовые награды.</p></div></div>
        <div className="mt-5 grid grid-cols-3 gap-2 rounded-2xl bg-white/10 p-3"><div><p className="text-[10px] font-bold uppercase text-white/65">XP</p><p className="mt-0.5 text-lg font-black">{summary?.xp ?? '—'}</p></div><div><p className="text-[10px] font-bold uppercase text-white/65">Уровень</p><p className="mt-0.5 text-lg font-black">{summary?.level ?? '—'}</p></div><div><p className="text-[10px] font-bold uppercase text-white/65">Серия</p><p className="mt-0.5 text-lg font-black">{summary?.streak ?? '—'} дн.</p></div></div>
      </header>

      <div className="mt-5 grid grid-cols-2 rounded-2xl bg-[#EEF0FA] p-1" role="tablist" aria-label="Период квестов">
        <button type="button" role="tab" aria-selected={period === 'daily'} onClick={() => setPeriod('daily')} className={`flex min-h-11 items-center justify-center gap-2 rounded-xl text-sm font-bold transition-colors ${period === 'daily' ? 'bg-white text-[#1B3F92] shadow-sm' : 'text-slate-500'}`}><CalendarDays size={17} aria-hidden="true" />Сегодня</button>
        <button type="button" role="tab" aria-selected={period === 'weekly'} onClick={() => setPeriod('weekly')} className={`flex min-h-11 items-center justify-center gap-2 rounded-xl text-sm font-bold transition-colors ${period === 'weekly' ? 'bg-white text-[#1B3F92] shadow-sm' : 'text-slate-500'}`}><Flame size={17} aria-hidden="true" />Неделя</button>
      </div>

      {error && <section role="alert" className="mt-5 rounded-2xl border border-red-100 bg-red-50 p-4"><p className="text-sm font-semibold text-red-700">Не удалось загрузить квесты.</p><button type="button" onClick={() => { setError(false); setRetry(value => value + 1) }} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-3 text-sm font-bold text-red-700"><RefreshCw size={16} aria-hidden="true" />Повторить</button></section>}
      {!summary && !error && <div aria-busy="true" className="mt-5 space-y-3">{[1, 2, 3].map(item => <div key={item} className="h-32 animate-pulse rounded-2xl bg-white" />)}</div>}
      {summary && <><div className="mt-5 flex items-center justify-between"><div><h2 className="text-lg font-black text-[#191B23]">{period === 'daily' ? 'Квесты дня' : 'Квесты недели'}</h2><p className="mt-0.5 text-xs text-slate-500">Выполнено {completed} из {quests.length}</p></div><Link href="/student/online/leaderboard" className="inline-flex min-h-11 items-center gap-1 text-sm font-bold text-[#1B3F92]">Рейтинг <span aria-hidden="true">→</span></Link></div><section className="mt-3 space-y-3">{quests.map(quest => <QuestCard key={quest.code} quest={quest} busy={claiming === quest.progressId} onClaim={() => void claim(quest)} />)}</section></>}
    </main>
  )
}
