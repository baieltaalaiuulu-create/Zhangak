'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, ImagePlus, Palette, RefreshCw, TimerReset } from 'lucide-react'

import {
  DAILY_STUDY_GOAL_MINUTES,
  PROFILE_COLOR_IDS,
  PROFILE_COLOR_OPTIONS,
  type DailyStudyGoalMinutes,
  type ProfileColor,
} from '@/lib/profile-preferences'
import {
  getPlatformProfile,
  type PlatformProfile,
  updatePlatformProfile,
} from '@/lib/platform-profile'
import { useStudentProfileUpdate } from '@/components/student/StudentSessionContext'

function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase() ?? '').join('') || '?'
}

function isSafeAvatarUrl(value: string): boolean {
  if (!value) return true
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password
  } catch {
    return false
  }
}

export default function PersonalizationSettings() {
  const applyProfileUpdate = useStudentProfileUpdate()
  const [profile, setProfile] = useState<PlatformProfile | null>(null)
  const [avatarUrl, setAvatarUrl] = useState('')
  const [profileColor, setProfileColor] = useState<ProfileColor>('blue')
  const [dailyStudyGoalMinutes, setDailyStudyGoalMinutes] = useState<DailyStudyGoalMinutes>(30)
  const [loading, setLoading] = useState(true)
  const [loadingError, setLoadingError] = useState(false)
  const [savingAvatar, setSavingAvatar] = useState(false)
  const [savingPreferences, setSavingPreferences] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [reloadNonce, setReloadNonce] = useState(0)

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const nextProfile = await getPlatformProfile()
        if (!active) return
        setProfile(nextProfile)
        setAvatarUrl(nextProfile.avatarUrl ?? '')
        setProfileColor(nextProfile.profileColor)
        setDailyStudyGoalMinutes(nextProfile.dailyStudyGoalMinutes)
        setLoadingError(false)
      } catch {
        if (active) setLoadingError(true)
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => { active = false }
  }, [reloadNonce])

  const applyUpdatedProfile = (updated: PlatformProfile) => {
    setProfile(updated)
    setAvatarUrl(updated.avatarUrl ?? '')
    setProfileColor(updated.profileColor)
    setDailyStudyGoalMinutes(updated.dailyStudyGoalMinutes)
    applyProfileUpdate(updated)
  }

  const saveAvatar = async () => {
    const trimmed = avatarUrl.trim()
    if (!isSafeAvatarUrl(trimmed)) {
      setSuccess(null)
      setError('Укажите безопасную HTTPS-ссылку на изображение.')
      return
    }
    setSavingAvatar(true)
    setError(null)
    setSuccess(null)
    try {
      const updated = await updatePlatformProfile({ avatarUrl: trimmed || null })
      applyUpdatedProfile(updated)
      setSuccess(trimmed ? 'Фото профиля сохранено.' : 'Фото профиля удалено.')
    } catch {
      setError('Не удалось сохранить фото. Проверьте ссылку и соединение.')
    } finally {
      setSavingAvatar(false)
    }
  }

  const savePreferences = async () => {
    setSavingPreferences(true)
    setError(null)
    setSuccess(null)
    try {
      const updated = await updatePlatformProfile({ profileColor, dailyStudyGoalMinutes })
      applyUpdatedProfile(updated)
      setSuccess('Оформление и ежедневная цель сохранены.')
    } catch {
      setError('Не удалось сохранить настройки. Повторите попытку.')
    } finally {
      setSavingPreferences(false)
    }
  }

  if (loading) {
    return (
      <section aria-busy="true" className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className="h-5 w-48 animate-pulse rounded bg-gray-100" />
        <div className="mt-4 h-24 animate-pulse rounded-xl bg-gray-50" />
      </section>
    )
  }

  if (loadingError || !profile) {
    return (
      <section className="rounded-2xl border border-red-100 bg-white p-5">
        <h2 className="text-sm font-bold text-[#191B23]">Оформление профиля</h2>
        <p className="mt-2 text-xs leading-5 text-gray-500">Не удалось загрузить настройки профиля.</p>
        <button
          type="button"
          onClick={() => { setLoading(true); setLoadingError(false); setReloadNonce(value => value + 1) }}
          className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#1B3F92] px-4 text-xs font-bold text-white"
        >
          <RefreshCw size={15} aria-hidden="true" />
          Повторить
        </button>
      </section>
    )
  }

  const accent = PROFILE_COLOR_OPTIONS[profileColor]

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EEF2FF] text-[#1B3F92]">
          <Palette size={18} aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-sm font-bold text-[#191B23]">Профиль и ритм учёбы</h2>
          <p className="mt-1 text-xs leading-5 text-gray-500">Настройте фото, цвет профиля и реалистичную цель на каждый день.</p>
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-gray-100 bg-gray-50 p-4">
        <div className="flex items-center gap-3">
          <span
            className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full text-base font-extrabold text-white"
            style={{ backgroundColor: accent.color }}
          >
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- user-controlled HTTPS URL is validated on both client and API
              <img src={avatarUrl} alt="Текущее фото профиля" className="h-full w-full object-cover" />
            ) : initials(profile.fullName)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-[#191B23]">{profile.fullName}</p>
            <p className="mt-0.5 text-xs text-gray-500">Так профиль виден только в вашем учебном кабинете.</p>
          </div>
        </div>

        <label htmlFor="settings-avatar-url" className="mt-4 block text-xs font-bold text-gray-700">Ссылка на фото профиля</label>
        <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
          <input
            id="settings-avatar-url"
            type="url"
            value={avatarUrl}
            onChange={event => setAvatarUrl(event.target.value)}
            placeholder="https://example.com/my-photo.jpg"
            autoComplete="url"
            className="min-h-11 min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 text-sm text-[#191B23] outline-none focus:ring-2 focus:ring-[#1B3F92]/25"
          />
          <button
            type="button"
            onClick={() => void saveAvatar()}
            disabled={savingAvatar}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#1B3F92] bg-white px-4 text-sm font-bold text-[#1B3F92] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <ImagePlus size={16} aria-hidden="true" />
            {savingAvatar ? 'Сохраняем…' : 'Сохранить фото'}
          </button>
        </div>
        <p className="mt-2 text-[11px] leading-4 text-gray-500">Допускается только безопасная HTTPS-ссылка. Чтобы удалить фото, очистите поле и сохраните. Загрузка файла с устройства появится после подключения собственного хранилища изображений.</p>
      </div>

      <fieldset className="mt-5">
        <legend className="text-xs font-bold text-gray-700">Цвет профиля</legend>
        <div role="radiogroup" aria-label="Выберите цвет профиля" className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {PROFILE_COLOR_IDS.map(color => {
            const option = PROFILE_COLOR_OPTIONS[color]
            const selected = profileColor === color
            return (
              <button
                key={color}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setProfileColor(color)}
                className={`flex min-h-12 items-center gap-2 rounded-xl border px-3 text-left text-xs font-bold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#1B3F92]/40 ${selected ? 'border-[#1B3F92] bg-[#F8FAFF]' : 'border-gray-200 bg-white hover:border-gray-300'}`}
              >
                <span className="h-5 w-5 rounded-full" style={{ backgroundColor: option.color }} aria-hidden="true" />
                {option.label}
              </button>
            )
          })}
        </div>
      </fieldset>

      <label htmlFor="daily-study-goal" className="mt-5 flex items-center gap-2 text-xs font-bold text-gray-700">
        <TimerReset size={15} className="text-[#1B3F92]" aria-hidden="true" />
        Ежедневная цель учёбы
      </label>
      <select
        id="daily-study-goal"
        value={dailyStudyGoalMinutes}
        onChange={event => setDailyStudyGoalMinutes(Number(event.target.value) as DailyStudyGoalMinutes)}
        className="mt-2 min-h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-[#191B23] outline-none focus:ring-2 focus:ring-[#1B3F92]/25"
      >
        {DAILY_STUDY_GOAL_MINUTES.map(minutes => <option key={minutes} value={minutes}>{minutes} минут в день</option>)}
      </select>
      <p className="mt-2 text-[11px] leading-4 text-gray-500">Цель появится на главной странице кабинета как ориентир, а не как обещание уже учтённых минут.</p>

      {error && <p role="alert" className="mt-4 text-xs font-semibold text-red-600">{error}</p>}
      {success && <p role="status" className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700"><CheckCircle2 size={15} aria-hidden="true" />{success}</p>}

      <button
        type="button"
        onClick={() => void savePreferences()}
        disabled={savingPreferences}
        className="mt-5 flex min-h-11 w-full items-center justify-center rounded-xl bg-[#1B3F92] px-4 text-sm font-bold text-white transition-colors hover:bg-[#17377f] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {savingPreferences ? 'Сохраняем…' : 'Сохранить оформление и цель'}
      </button>
    </section>
  )
}
