'use client'

import { useEffect, useMemo, useState } from 'react'
import { BadgeCheck, Eye, Palette, RefreshCw, ShieldCheck, Users } from 'lucide-react'
import Link from 'next/link'

import {
  getProfileCustomization,
  updateCommunitySettings,
  updateFeaturedAchievements,
  updateProfileLoadout,
  type CommunityProfileVisibility,
  type ProfileCustomization,
} from '@/lib/platform-profile'

const visibilityOptions: ReadonlyArray<{ value: CommunityProfileVisibility; label: string; hint: string }> = [
  { value: 'private', label: 'Только я', hint: 'Профиль и рейтинг скрыты.' },
  { value: 'community', label: 'Сообщество', hint: 'Карточку смогут открыть ученики, но в рейтинг она не попадёт.' },
  { value: 'leaderboard', label: 'Рейтинг', hint: 'Карточка может появиться в Top-100.' },
]

export default function CommunityProfileSettings() {
  const [data, setData] = useState<ProfileCustomization | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [visibility, setVisibility] = useState<CommunityProfileVisibility>('leaderboard')
  const [showXp, setShowXp] = useState(true)
  const [showAchievements, setShowAchievements] = useState(true)
  const [showStreak, setShowStreak] = useState(true)
  const [discoverable, setDiscoverable] = useState(true)
  const [frameCode, setFrameCode] = useState('frame_classic')
  const [backgroundCode, setBackgroundCode] = useState('background_clear')
  const [titleCode, setTitleCode] = useState('title_student')
  const [featuredIds, setFeaturedIds] = useState<number[]>([])

  const hydrate = (value: ProfileCustomization) => {
    setData(value)
    setDisplayName(value.community.displayName ?? '')
    setVisibility(value.community.visibility)
    setShowXp(value.community.showXp)
    setShowAchievements(value.community.showAchievements)
    setShowStreak(value.community.showStreak)
    setDiscoverable(value.community.discoverable)
    setFrameCode(value.loadout.frameCode)
    setBackgroundCode(value.loadout.backgroundCode)
    setTitleCode(value.loadout.titleCode)
    setFeaturedIds(value.featuredAchievementIds)
  }

  const load = async () => {
    setLoading(true)
    setError(null)
    try { hydrate(await getProfileCustomization()) } catch { setError('Не удалось загрузить настройки профиля сообщества.') } finally { setLoading(false) }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(timer)
    // Initial fetch intentionally happens once; saving explicitly refreshes it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const cosmetics = useMemo(() => ({
    frame: data?.cosmetics.filter(item => item.category === 'frame') ?? [],
    background: data?.cosmetics.filter(item => item.category === 'background') ?? [],
    title: data?.cosmetics.filter(item => item.category === 'title') ?? [],
  }), [data])

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      await Promise.all([
        updateCommunitySettings({ displayName: displayName.trim() || null, visibility, showXp, showAchievements, showStreak, discoverable }),
        updateProfileLoadout({ frameCode, backgroundCode, titleCode }),
        updateFeaturedAchievements(featuredIds),
      ])
      await load()
    } catch { setError('Не удалось сохранить настройки. Проверьте соединение и выбранные достижения.') } finally { setSaving(false) }
  }

  const toggleAchievement = (id: number) => {
    setFeaturedIds(current => current.includes(id) ? current.filter(value => value !== id) : current.length < 3 ? [...current, id] : current)
  }

  if (loading) return <section aria-busy="true" className="rounded-2xl border border-gray-200 bg-white p-5"><div className="h-5 w-52 animate-pulse rounded bg-gray-100" /><div className="mt-4 h-28 animate-pulse rounded-xl bg-gray-50" /></section>
  if (!data) return <section className="rounded-2xl border border-red-100 bg-white p-5"><h2 className="font-bold text-[#191B23]">Профиль сообщества</h2><p role="alert" className="mt-2 text-sm text-red-700">{error ?? 'Настройки недоступны.'}</p><button type="button" onClick={() => void load()} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#1B3F92] px-4 text-sm font-bold text-white"><RefreshCw size={16} aria-hidden="true" />Повторить</button></section>

  return <section className="rounded-2xl border border-gray-200 bg-white p-5">
    <div className="flex items-start gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-700"><Users size={18} aria-hidden="true" /></span><div><h2 className="text-sm font-bold text-[#191B23]">Профиль сообщества</h2><p className="mt-1 text-xs leading-5 text-gray-500">Покажите только то, чем готовы делиться. Настоящее имя, фото, контакты и курс всегда остаются закрыты.</p></div></div>

    <label htmlFor="community-display-name" className="mt-5 block text-xs font-bold text-gray-700">Псевдоним</label>
    <input id="community-display-name" value={displayName} onChange={event => setDisplayName(event.target.value)} maxLength={24} placeholder="Например, Математик_01" className="mt-1.5 min-h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:ring-2 focus:ring-[#1B3F92]/25" />
    <p className="mt-1 text-[11px] text-gray-500">Если оставить пустым, будет показан нейтральный псевдоним.</p>

    <fieldset className="mt-5"><legend className="text-xs font-bold text-gray-700">Видимость</legend><div className="mt-2 grid gap-2">{visibilityOptions.map(option => <label key={option.value} className={`flex cursor-pointer gap-3 rounded-xl border p-3 ${visibility === option.value ? 'border-[#1B3F92] bg-[#F8FAFF]' : 'border-gray-200'}`}><input type="radio" name="community-visibility" checked={visibility === option.value} onChange={() => setVisibility(option.value)} className="mt-0.5" /><span><span className="block text-xs font-bold text-[#191B23]">{option.label}</span><span className="mt-0.5 block text-[11px] leading-4 text-gray-500">{option.hint}</span></span></label>)}</div></fieldset>

    <div className="mt-5 grid gap-2 sm:grid-cols-3">{[[showXp, setShowXp, 'Показывать XP'], [showAchievements, setShowAchievements, 'Показывать достижения'], [showStreak, setShowStreak, 'Показывать серию']].map(([checked, setChecked, label]) => <label key={String(label)} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 text-xs font-semibold text-gray-700"><input type="checkbox" checked={Boolean(checked)} onChange={event => (setChecked as (value: boolean) => void)(event.target.checked)} />{String(label)}</label>)}</div>
    <label className="mt-2 flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 text-xs font-semibold text-gray-700"><input type="checkbox" checked={discoverable} onChange={event => setDiscoverable(event.target.checked)} /><Eye size={15} aria-hidden="true" />Разрешить открывать карточку из рейтинга</label>

    <div className="mt-6 border-t border-gray-100 pt-5"><div className="flex items-center gap-2"><Palette size={16} className="text-[#1B3F92]" aria-hidden="true" /><h3 className="text-xs font-bold text-gray-700">Оформление витрины</h3></div><p className="mt-1 text-[11px] leading-4 text-gray-500">Только темы, выданные сервером. Нельзя загрузить произвольный фон или код.</p><div className="mt-3 grid gap-3 sm:grid-cols-3">{([['Рамка', 'frame', frameCode, setFrameCode], ['Фон', 'background', backgroundCode, setBackgroundCode], ['Титул', 'title', titleCode, setTitleCode]] as const).map(([label, category, value, setValue]) => <label key={category} className="text-xs font-bold text-gray-700">{label}<select value={value} onChange={event => setValue(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-[#191B23]">{cosmetics[category].map(item => <option key={item.code} value={item.code}>{item.title}</option>)}</select></label>)}</div></div>

    <div className="mt-6 border-t border-gray-100 pt-5"><div className="flex items-center gap-2"><BadgeCheck size={16} className="text-violet-700" aria-hidden="true" /><h3 className="text-xs font-bold text-gray-700">Витрина достижений</h3></div><p className="mt-1 text-[11px] leading-4 text-gray-500">Выберите до трёх уже полученных достижений.</p>{data.achievements.length === 0 ? <p className="mt-3 rounded-xl bg-gray-50 p-3 text-xs text-gray-500">Пока нет разблокированных достижений.</p> : <div className="mt-3 grid gap-2 sm:grid-cols-2">{data.achievements.map(item => <label key={item.id} className={`flex cursor-pointer gap-3 rounded-xl border p-3 ${featuredIds.includes(item.id) ? 'border-violet-400 bg-violet-50' : 'border-gray-200'}`}><input type="checkbox" checked={featuredIds.includes(item.id)} onChange={() => toggleAchievement(item.id)} disabled={!featuredIds.includes(item.id) && featuredIds.length >= 3} /><span><span className="block text-xs font-bold text-[#191B23]">{item.title}</span><span className="mt-0.5 block text-[11px] leading-4 text-gray-500">{item.description}</span></span></label>)}</div>}</div>

    <div className="mt-5 flex items-start gap-2 rounded-xl bg-[#EEF2FF] p-3 text-[11px] leading-4 text-[#1B3F92]"><ShieldCheck size={16} className="mt-0.5 shrink-0" aria-hidden="true" />В первой версии нет личных сообщений, комментариев, подписок или произвольных медиа — это защита учебного сообщества.</div>
    <Link href="/student/online/friends" className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-[#1B3F92]">Открыть друзей <Users size={16} aria-hidden="true" /></Link>
    {error && <p role="alert" className="mt-4 text-xs font-semibold text-red-600">{error}</p>}
    <button type="button" onClick={() => void save()} disabled={saving} className="mt-5 flex min-h-11 w-full items-center justify-center rounded-xl bg-[#1B3F92] px-4 text-sm font-bold text-white disabled:opacity-60">{saving ? 'Сохраняем…' : 'Сохранить профиль сообщества'}</button>
  </section>
}
