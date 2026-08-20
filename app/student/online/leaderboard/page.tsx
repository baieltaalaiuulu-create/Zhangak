'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

import { useStudentSession } from '@/components/student/StudentSessionContext'
import StudentVisualIcon from '@/components/student/StudentVisualIcon'
import { getOverallLeaderboard, type LeaderboardResponse } from '@/lib/platform-community'

export default function LeaderboardPage() {
  useStudentSession()
  const [ranking, setRanking] = useState<LeaderboardResponse | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let active = true
    void getOverallLeaderboard()
      .then(value => { if (active) setRanking(value) })
      .catch(() => { if (active) setError(true) })
    return () => { active = false }
  }, [])

  const podium = ranking?.items.slice(0, 3) ?? []
  const rest = ranking?.items.slice(3) ?? []
  return <main className="px-4 pb-28 pt-5 sm:mx-auto sm:max-w-2xl sm:pb-10">
    <header><p className="text-[11px] font-extrabold uppercase tracking-[.12em] text-[var(--student-warning)]">Общий рейтинг</p><h1 className="mt-1 text-2xl font-black tracking-tight">Лига Zhangak</h1><p className="mt-1 text-[13px] text-[var(--student-ink-2)]">Top-100 активных учеников по подтверждённому XP за всё время.</p></header>

    {!ranking && !error && <div className="mt-6 space-y-3">{[1, 2, 3, 4].map(item => <div key={item} className="h-16 animate-pulse rounded-2xl bg-white" />)}</div>}
    {error && <p role="alert" className="mt-5 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">Не удалось загрузить рейтинг. Попробуй обновить страницу.</p>}
    {ranking && <>
      <section className="mt-5 rounded-[24px] bg-gradient-to-br from-[#1B3F92] to-[#6C3DE0] px-3 pb-4 pt-6 text-white">
        <div className="flex items-end justify-center gap-2">
          {[podium[1], podium[0], podium[2]].map((item, index) => item ? <Link href={`/student/online/community/${item.publicProfileId}`} key={item.rank} className={`flex min-w-0 flex-1 flex-col items-center rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-white ${index === 1 ? 'pb-4' : ''}`}><span className={`flex items-center justify-center rounded-full border-2 border-white/70 bg-white/20 font-black ${index === 1 ? 'h-16 w-16 text-xl' : 'h-13 w-13 text-base'}`}>{item.displayName.trim().slice(0, 1).toUpperCase()}</span><p className="mt-2 max-w-full truncate text-center text-xs font-extrabold">{item.displayName}</p><p className="text-[11px] text-white/75">{item.xp} XP</p><span className="mt-2 flex h-7 w-7 items-center justify-center rounded-full bg-white font-black text-[var(--student-brand)]">{item.rank}</span></Link> : <div key={`empty-${index}`} className="min-w-0 flex-1" />)}
        </div>
      </section>
      <section className="mt-3 overflow-hidden rounded-[22px] border border-[var(--student-line)] bg-white">
        {ranking.items.length === 0 && <div className="p-6 text-center"><StudentVisualIcon name="emoji_events" size={35} color="var(--student-warning)" /><h2 className="mt-2 font-extrabold">Рейтинг пока пуст</h2><p className="mt-1 text-sm text-[var(--student-ink-2)]">Получи XP за задания и появись первым.</p></div>}
        {rest.map((item, index) => <Link href={`/student/online/community/${item.publicProfileId}`} key={`${item.rank}-${item.publicProfileId}`} className={`flex min-h-16 items-center gap-3 px-4 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--student-brand)] ${index ? 'border-t border-[var(--student-line)]' : ''} ${item.isMe ? 'bg-[var(--student-brand-50)]' : ''}`}><span className="w-7 text-center text-sm font-black text-[var(--student-ink-3)]">{item.rank}</span><span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--student-surface-2)] text-sm font-black text-[var(--student-brand)]">{item.displayName.trim().slice(0, 1).toUpperCase()}</span><span className="min-w-0 flex-1 truncate text-sm font-bold">{item.displayName}{item.isMe ? ' · ты' : ''}</span><span className="shrink-0 text-sm font-black text-[var(--student-brand)]">{item.xp} XP</span></Link>)}
      </section>
      {ranking.me && !ranking.items.some(item => item.publicProfileId === ranking.me?.publicProfileId) && <section className="mt-3 flex items-center gap-3 rounded-2xl border border-[var(--student-brand)] bg-[var(--student-brand-50)] p-4"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-white font-black text-[var(--student-brand)]">{ranking.me.rank}</span><p className="min-w-0 flex-1 text-sm font-bold">Твоё место: {ranking.me.rank}</p><span className="shrink-0 text-sm font-black text-[var(--student-brand)]">{ranking.me.xp} XP</span></section>}
      <div className="mt-3 flex items-center gap-3 rounded-2xl bg-[var(--student-warning-50)] p-4"><StudentVisualIcon name="shield" size={22} color="var(--student-warning)" /><p className="text-xs font-semibold leading-5 text-[var(--student-ink-2)]">XP начисляется сервером за новые достижения. Сброс тренажёра не уменьшает уже полученные очки.</p></div>
    </>}
  </main>
}
