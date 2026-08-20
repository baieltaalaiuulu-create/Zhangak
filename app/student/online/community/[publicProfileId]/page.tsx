'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Award, RefreshCw, Trophy } from 'lucide-react'
import { useParams } from 'next/navigation'

import { useStudentSession } from '@/components/student/StudentSessionContext'
import { getCommunityProfile, type CommunityProfile } from '@/lib/platform-community'
import { PROFILE_COLOR_OPTIONS } from '@/lib/profile-preferences'

export default function CommunityProfilePage() {
  useStudentSession()
  const params = useParams<{ publicProfileId: string }>()
  const [profile, setProfile] = useState<CommunityProfile | null>(null)
  const [error, setError] = useState(false)
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    let active = true
    void getCommunityProfile(params.publicProfileId)
      .then(value => { if (active) { setProfile(value); setError(false) } })
      .catch(() => { if (active) setError(true) })
    return () => { active = false }
  }, [params.publicProfileId, retry])

  if (error) return <main className="mx-auto min-h-screen max-w-xl px-4 pb-28 pt-5 sm:px-6"><Link href="/student/online/leaderboard" className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-[#1B3F92]"><ArrowLeft size={18} aria-hidden="true" />К рейтингу</Link><section role="alert" className="mt-5 rounded-2xl border border-red-100 bg-red-50 p-5"><h1 className="font-black text-red-800">Профиль недоступен</h1><p className="mt-1 text-sm text-red-700">Участник мог скрыть профиль или он больше не участвует в рейтинге.</p><button type="button" onClick={() => { setError(false); setRetry(value => value + 1) }} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 text-sm font-bold text-red-700"><RefreshCw size={16} aria-hidden="true" />Повторить</button></section></main>
  if (!profile) return <main className="mx-auto min-h-screen max-w-xl px-4 pb-28 pt-5 sm:px-6"><div className="h-11 w-28 animate-pulse rounded-xl bg-white" /><div className="mt-5 h-56 animate-pulse rounded-3xl bg-white" /></main>

  const color = PROFILE_COLOR_OPTIONS[profile.profileColor].color
  return <main className="mx-auto min-h-screen max-w-xl px-4 pb-28 pt-5 sm:px-6 md:pb-10"><Link href="/student/online/leaderboard" className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-[#1B3F92]"><ArrowLeft size={18} aria-hidden="true" />К рейтингу</Link><section className="mt-4 rounded-[28px] border border-slate-100 bg-white p-6 text-center shadow-sm"><span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full text-2xl font-black text-white" style={{ background: color }}>{profile.displayName.slice(-1)}</span><p className="mt-4 text-[11px] font-extrabold uppercase tracking-[.13em] text-slate-400">Участник сообщества</p><h1 className="mt-1 text-2xl font-black text-[#191B23]">{profile.displayName}</h1><div className="mt-5 grid grid-cols-2 gap-3"><div className="rounded-2xl bg-[#EEF2FF] p-3"><Trophy className="mx-auto text-[#1B3F92]" size={20} aria-hidden="true" /><p className="mt-1 text-lg font-black text-[#1B3F92]">{profile.xp}</p><p className="text-[11px] font-semibold text-slate-500">Подтверждённый XP</p></div><div className="rounded-2xl bg-violet-50 p-3"><Award className="mx-auto text-violet-700" size={20} aria-hidden="true" /><p className="mt-1 text-lg font-black text-violet-700">Ур. {profile.level}</p><p className="text-[11px] font-semibold text-slate-500">Уровень</p></div></div></section><section className="mt-4 rounded-3xl border border-slate-100 bg-white p-5"><h2 className="text-lg font-black text-[#191B23]">Достижения</h2>{profile.achievements.length === 0 ? <p className="mt-3 text-sm text-slate-500">Первые достижения появятся после учебных действий.</p> : <div className="mt-4 grid gap-3 sm:grid-cols-2">{profile.achievements.map(item => <article key={item.code} className="rounded-2xl bg-[#F8F7FF] p-4"><Award size={20} className="text-violet-700" aria-hidden="true" /><h3 className="mt-2 font-extrabold text-[#191B23]">{item.title}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{item.description}</p></article>)}</div>}</section><p className="mt-4 text-center text-[11px] leading-5 text-slate-400">В профиле сообщества не показываются настоящее имя, контакты, курс, цель ОРТ или фото ученика.</p></main>
}
