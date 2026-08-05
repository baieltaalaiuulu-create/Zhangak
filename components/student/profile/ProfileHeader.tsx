'use client'

import { useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { LogOut, Pencil, Check, X, Camera } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface Props {
  studentId: string
  fullName: string
  avatarUrl: string | null
  studentType: string
  latestScore: number | null
  streak: number
  level: number
  onSignOut: () => void
  onNameUpdate: (name: string) => void
  onAvatarUpdate: (url: string) => void
}

const MAX_AVATAR_BYTES = 5 * 1024 * 1024

function initials(name: string): string {
  const letters = name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '')
  return letters.join('') || '?'
}

export default function ProfileHeader({
  studentId, fullName, avatarUrl, studentType, latestScore, streak, level,
  onSignOut, onNameUpdate, onAvatarUpdate,
}: Props) {
  const isOnline = studentType !== 'offline'
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState(fullName)
  const [savingName, setSavingName] = useState(false)
  const [nameError, setNameError] = useState<string | null>(null)

  const [uploadingAvatar, setUploadingAvatar] = useState(false)
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
    const { error } = await supabase.from('profiles').update({ full_name: trimmed }).eq('id', studentId)
    setSavingName(false)

    if (error) { setNameError('Не удалось сохранить'); return }
    onNameUpdate(trimmed)
    setEditingName(false)
  }

  const handleAvatarClick = () => {
    if (!uploadingAvatar) fileInputRef.current?.click()
  }

  const handleAvatarChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    if (!file.type.startsWith('image/')) { setAvatarError('Выберите файл изображения'); return }
    if (file.size > MAX_AVATAR_BYTES) { setAvatarError('Файл слишком большой (макс. 5 МБ)'); return }

    setUploadingAvatar(true)
    setAvatarError(null)

    const ext = file.name.split('.').pop() ?? 'jpg'
    const path = `${studentId}/avatar.${ext}`

    const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    if (uploadError) {
      setUploadingAvatar(false)
      setAvatarError('Не удалось загрузить фото')
      return
    }

    const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(path)
    // Cache-bust so the browser doesn't keep serving the previous cached image
    // at the same URL after an upsert overwrite.
    const url = `${publicUrlData.publicUrl}?t=${Date.now()}`

    const { error: updateError } = await supabase.from('profiles').update({ avatar_url: url }).eq('id', studentId)
    setUploadingAvatar(false)

    if (updateError) { setAvatarError('Не удалось сохранить фото'); return }
    onAvatarUpdate(url)
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center">
      <button
        type="button"
        onClick={handleAvatarClick}
        disabled={uploadingAvatar}
        aria-label="Изменить фото профиля"
        className="group relative mx-auto flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-[#1B4FD8] text-2xl font-extrabold text-white"
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- external Supabase Storage URL, no next/image domain config in this project
          <img src={avatarUrl} alt={fullName} className="h-full w-full object-cover" />
        ) : (
          initials(fullName)
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
          <Camera size={18} />
        </span>
      </button>
      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
      {uploadingAvatar && <p className="mt-1.5 text-[11px] text-gray-400">Загрузка...</p>}
      {avatarError && <p className="mt-1.5 text-[11px] font-semibold text-red-500">{avatarError}</p>}

      {editingName ? (
        <form onSubmit={handleSaveName} className="mt-4 flex items-center justify-center gap-1.5">
          <input
            type="text"
            value={nameInput}
            onChange={e => setNameInput(e.target.value)}
            autoFocus
            className="w-40 rounded-lg border border-gray-200 px-2 py-1 text-center text-sm font-bold text-[#191B23] focus:outline-none focus:ring-2 focus:ring-[#1B4FD8]/20"
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
          <button type="button" onClick={startEditingName} aria-label="Изменить имя" className="rounded-lg p-1 text-gray-400 hover:bg-gray-50 hover:text-[#1B4FD8]">
            <Pencil size={13} />
          </button>
        </div>
      )}
      {nameError && <p className="mt-1 text-[11px] font-semibold text-red-500">{nameError}</p>}

      <span className={`mt-1 inline-block rounded-full px-2.5 py-1 text-xs font-bold ${isOnline ? 'bg-[#EEF2FF] text-[#1B4FD8]' : 'bg-gray-100 text-gray-500'}`}>
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
