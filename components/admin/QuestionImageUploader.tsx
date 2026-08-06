'use client'

import { useRef, useState, type ChangeEvent } from 'react'
import { ImagePlus, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface Props {
  imageUrl: string | null
  onChange: (url: string | null) => void
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024

// Shared across every admin question form (lesson-tied, bank, mock) — upload
// goes straight to Storage via the anon client (bucket policies are wide
// open, same convention as the 'avatars' bucket), the resulting public URL
// is handed back to the parent form to include in its own save payload.
export default function QuestionImageUploader({ imageUrl, onChange }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleClick = () => {
    if (!uploading) fileInputRef.current?.click()
  }

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    if (!file.type.startsWith('image/')) { setError('Выберите файл изображения'); return }
    if (file.size > MAX_IMAGE_BYTES) { setError('Файл слишком большой (макс. 5 МБ)'); return }

    setUploading(true)
    setError(null)

    const ext = file.name.split('.').pop() ?? 'jpg'
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

    const { error: uploadError } = await supabase.storage.from('question-images').upload(path, file)
    setUploading(false)

    if (uploadError) { setError('Не удалось загрузить изображение'); return }

    const { data } = supabase.storage.from('question-images').getPublicUrl(path)
    onChange(data.publicUrl)
  }

  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-gray-500">Изображение</label>
      {imageUrl ? (
        <div className="relative inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element -- external Supabase Storage URL, no next/image domain config in this project */}
          <img src={imageUrl} alt="" className="max-h-40 rounded-lg border border-gray-200 object-contain" />
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label="Удалить изображение"
            className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white shadow hover:bg-red-600"
          >
            <X size={13} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleClick}
          disabled={uploading}
          className="flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm font-semibold text-gray-500 transition-colors hover:border-[#1B4FD8] hover:text-[#1B4FD8] disabled:opacity-60"
        >
          <ImagePlus size={16} /> {uploading ? 'Загрузка...' : 'Добавить изображение'}
        </button>
      )}
      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
      {error && <p className="mt-1 text-xs font-semibold text-red-500">{error}</p>}
    </div>
  )
}
