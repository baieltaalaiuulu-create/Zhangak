'use client'

import { useEffect, useState } from 'react'

import { useStudentSession } from '@/components/student/StudentSessionContext'
import StudentVisualIcon from '@/components/student/StudentVisualIcon'
import { zhangakApiRequest } from '@/lib/zhangak-api-client'

interface RankingItem { rank: number; displayName: string; xp: number; isMe: boolean }
interface RankingResponse { items: RankingItem[]; myRank: number | null }

export default function LeaderboardPage() {
  useStudentSession()
  const [ranking, setRanking] = useState<RankingResponse | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let active = true
    void zhangakApiRequest<RankingResponse>('/v1/platform/leaderboard')
      .then(value => { if (active) setRanking(value) })
      .catch(() => { if (active) setError(true) })
    return () => { active = false }
  }, [])

  const podium = ranking?.items.slice(0, 3) ?? []
  const rest = ranking?.items.slice(3) ?? []
  return <main className="px-4 pb-28 pt-5 sm:mx-auto sm:max-w-2xl sm:pb-10">
    <header><p className="text-[11px] font-extrabold uppercase tracking-[.12em] text-[var(--student-warning)]">Недельный рейтинг</p><h1 className="mt-1 text-2xl font-black tracking-tight">Лига Zhangak</h1><p className="mt-1 text-[13px] text-[var(--student-ink-2)]">Место определяется только подтверждённым XP.</p></header>

    {!ranking && !error && <div className="mt-6 space-y-3">{[1, 2, 3, 4].map(item => <div key={item} className="h-16 animate-pulse rounded-2xl bg-white" />)}</div>}
    {error && <p role="alert" className="mt-5 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">Не удалось загрузить рейтинг. Попробуй обновить страницу.</p>}
    {ranking && <>
      <section className="mt-5 rounded-[24px] bg-gradient-to-br from-[#1B3F92] to-[#6C3DE0] px-3 pb-4 pt-6 text-white">
        <div className="flex items-end justify-center gap-2">
          {[podium[1], podium[0], podium[2]].map((item, index) => item ? <div key={item.rank} className={`flex min-w-0 flex-1 flex-col items-center ${index === 1 ? 'pb-4' : ''}`}><span className={`flex items-center justify-center rounded-full border-2 border-white/70 bg-white/20 font-black ${index === 1 ? 'h-16 w-16 text-xl' : 'h-13 w-13 text-base'}`}>{item.displayName.trim().slice(0, 1).toUpperCase()}</span><p className="mt-2 max-w-full truncate text-center text-xs font-extrabold">{item.displayName}</p><p className="text-[11px] text-white/75">{item.xp} XP</p><span className="mt-2 flex h-7 w-7 items-center justify-center rounded-full bg-white font-black text-[var(--student-brand)]">{item.rank}</span></div> : <div key={`empty-${index}`} className="min-w-0 flex-1" />)}
        </div>
      </section>
      <section className="mt-3 overflow-hidden rounded-[22px] border border-[var(--student-line)] bg-white">
        {ranking.items.length === 0 && <div className="p-6 text-center"><StudentVisualIcon name="emoji_events" size={35} color="var(--student-warning)" /><h2 className="mt-2 font-extrabold">Рейтинг пока пуст</h2><p className="mt-1 text-sm text-[var(--student-ink-2)]">Получи XP за задания и появись первым.</p></div>}
        {rest.map((item, index) => <article key={`${item.rank}-${item.displayName}`} className={`flex min-h-16 items-center gap-3 px-4 ${index ? 'border-t border-[var(--student-line)]' : ''} ${item.isMe ? 'bg-[var(--student-brand-50)]' : ''}`}><span className="w-7 text-center text-sm font-black text-[var(--student-ink-3)]">{item.rank}</span><span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--student-surface-2)] text-sm font-black text-[var(--student-brand)]">{item.displayName.trim().slice(0, 1).toUpperCase()}</span><span className="min-w-0 flex-1 truncate text-sm font-bold">{item.displayName}{item.isMe ? ' · ты' : ''}</span><span className="shrink-0 text-sm font-black text-[var(--student-brand)]">{item.xp} XP</span></article>)}
      </section>
      <div className="mt-3 flex items-center gap-3 rounded-2xl bg-[var(--student-warning-50)] p-4"><StudentVisualIcon name="shield" size={22} color="var(--student-warning)" /><p className="text-xs font-semibold leading-5 text-[var(--student-ink-2)]">XP начисляется сервером за новые достижения. Сброс тренажёра не уменьшает уже полученные очки.</p></div>
    </>}
  </main>
}
