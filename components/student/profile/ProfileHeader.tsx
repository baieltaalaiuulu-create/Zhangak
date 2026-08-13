'use client'

import { useState, type FormEvent } from 'react'
import { LogOut, Pencil, Check, X, Camera } from 'lucide-react'

interface Props {
  fullName: string
  avatarUrl: string | null
  studentType: string
  latestScore: number | null
  streak: number
  level: number
  onSignOut: () => void
  onNameUpdate: (name: string) => Promise<void>
  onAvatarUpdate: (url: string | null) => Promise<void>
}

function initials(name: string): string {
  const letters = name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '')
  return letters.join('') || '?'
}

export default function ProfileHeader({
  fullName, avatarUrl, studentType, latestScore, streak, level,
  onSignOut, onNameUpdate, onAvatarUpdate,
}: Props) {
  const isOnline = studentType !== 'offline'

  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState(fullName)
  const [savingName, setSavingName] = useState(false)
  const [nameError, setNameError] = useState<string | null>(null)

  const [editingAvatar, setEditingAvatar] = useState(false)
  const [avatarInput, setAvatarInput] = useState(avatarUrl ?? '')
  const [savingAvatar, setSavingAvatar] = useState(false)
  const [avatarError, setAvatarError] = useState<string | null>(null)

  const startEditingName = () => {
    setNameInput(fullName)
    setNameError(null)
    setEditingName(true)
  }

  const cancelEditingName = () => {
    setNameInput(fullName)
    setNameError(null)
    setEditingName(false)
  }

  const handleSaveName = async (e: FormEvent) => {
    e.preventDefault()
    const trimmed = nameInput.trim()
    if (!trimmed) { setNameError('Имя не может быть пустым'); return }

    setSavingName(true)
    setNameError(null)
    try {
      await onNameUpdate(trimmed)
    } catch {
      setNameError('Не удалось сохранить')
      setSavingName(false)
      return
    }
    setSavingName(false)
    setEditingName(false)
  }

  const handleAvatarClick = () => {
    if (savingAvatar) return
    setAvatarInput(avatarUrl ?? '')
    setAvatarError(null)
    setEditingAvatar(true)
  }

  const handleSaveAvatar = async (event: FormEvent) => {
    event.preventDefault()
    const raw = avatarInput.trim()
    if (raw) {
      try {
        const url = new URL(raw)
        if (url.protocol !== 'https:' || url.username || url.password) throw new Error('invalid')
      } catch {
        setAvatarError('Укажите безопасную ссылку HTTPS на фото')
        return
      }
    }

    setSavingAvatar(true)
    setAvatarError(null)
    try {
      await onAvatarUpdate(raw || null)
    } catch {
      setAvatarError('Не удалось сохранить фото')
      setSavingAvatar(false)
      return
    }
    setSavingAvatar(false)
    setEditingAvatar(false)
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center">
      <button
        type="button"
        onClick={handleAvatarClick}
        disabled={savingAvatar}
        aria-label="Изменить фото профиля"
        className="group relative mx-auto flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-[#1B3F92] text-2xl font-extrabold text-white"
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- user-provided HTTPS avatar domains are not known at build time
          <img src={avatarUrl} alt={fullName} className="h-full w-full object-cover" />
        ) : (
          initials(fullName)
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
          <Camera size={18} />
        </span>
      </button>
      {savingAvatar && <p className="mt-1.5 text-[11px] text-gray-400">Сохранение...</p>}
      {avatarError && <p className="mt-1.5 text-[11px] font-semibold text-red-500">{avatarError}</p>}

      {editingAvatar && (
        <form onSubmit={handleSaveAvatar} className="mt-3 rounded-xl bg-gray-50 p-3 text-left">
          <label htmlFor="avatar-url" className="block text-[11px] font-semibold text-gray-500">Ссылка на фото</label>
          <input
            id="avatar-url"
            type="url"
            value={avatarInput}
            onChange={event => setAvatarInput(event.target.value)}
            placeholder="https://..."
            autoComplete="url"
            className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-[#191B23] focus:outline-none focus:ring-2 focus:ring-[#1B3F92]/20"
          />
          <p className="mt-1.5 text-[10px] leading-4 text-gray-400">Загрузка с устройства появится после переноса собственного хранилища. Пустое поле удалит текущее фото.</p>
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              disabled={savingAvatar}
              onClick={() => { setEditingAvatar(false); setAvatarError(null) }}
              className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-gray-500 hover:bg-white"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={savingAvatar}
              className="rounded-lg bg-[#1B3F92] px-2.5 py-1.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Сохранить
            </button>
          </div>
        </form>
      )}

      {editingName ? (
        <form onSubmit={handleSaveName} className="mt-4 flex items-center justify-center gap-1.5">
          <input
            type="text"
            value={nameInput}
            onChange={e => setNameInput(e.target.value)}
            autoFocus
            className="w-40 rounded-lg border border-gray-200 px-2 py-1 text-center text-sm font-bold text-[#191B23] focus:outline-none focus:ring-2 focus:ring-[#1B3F92]/20"
          />
          <button type="submit" disabled={savingName} aria-label="Сохранить" className="rounded-lg p-1.5 text-green-600 hover:bg-green-50 disabled:opacity-50">
            <Check size={16} />
          </button>
          <button type="button" onClick={cancelEditingName} disabled={savingName} aria-label="Отмена" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-50">
            <X size={16} />
          </button>
        </form>
      ) : (
        <div className="mt-4 flex items-center justify-center gap-1.5">
          <h1 className="text-lg font-bold text-[#191B23]">{fullName}</h1>
          <button type="button" onClick={startEditingName} aria-label="Изменить имя" className="rounded-lg p-1 text-gray-400 hover:bg-gray-50 hover:text-[#1B3F92]">
            <Pencil size={13} />
          </button>
        </div>
      )}
      {nameError && <p className="mt-1 text-[11px] font-semibold text-red-500">{nameError}</p>}

      <span className={`mt-1 inline-block rounded-full px-2.5 py-1 text-xs font-bold ${isOnline ? 'bg-[#EEF2FF] text-[#1B3F92]' : 'bg-gray-100 text-gray-500'}`}>
        {isOnline ? 'Онлайн' : 'Оффлайн'}
      </span>

      <div className="mt-5 grid grid-cols-3 gap-2 border-t border-gray-100 pt-5">
        <div>
          <div className="text-lg font-extrabold text-[#191B23]">{latestScore ?? '—'}</div>
          <div className="text-[11px] text-gray-400">Балл ОРТ</div>
        </div>
        <div>
          <div className="text-lg font-extrabold text-[#191B23]">{streak}</div>
          <div className="text-[11px] text-gray-400">Дней подряд</div>
        </div>
        <div>
          <div className="text-lg font-extrabold text-[#191B23]">{level}</div>
          <div className="text-[11px] text-gray-400">Уровень</div>
        </div>
      </div>

      <button
        type="button"
        onClick={onSignOut}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-red-500 transition-colors hover:bg-red-50"
      >
        <LogOut size={16} /> Выйти
      </button>
    </div>
  )
}
