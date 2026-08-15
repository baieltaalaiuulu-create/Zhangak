'use client'

import { FormEvent, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2, FileText, LoaderCircle, Upload, Video, XCircle } from 'lucide-react'

import AdminTopbar from '@/components/admin/AdminTopbar'
import {
  createAdminTextMaterial,
  listAdminLessonMaterials,
  reviewAdminLessonMaterial,
  type AdminLessonMaterial,
  uploadAdminLessonMaterial,
} from '@/lib/admin-learning-client'

function message(error: unknown): string {
  return error instanceof Error ? error.message : 'Не удалось выполнить операцию'
}

function statusLabel(status: AdminLessonMaterial['scanStatus']): string {
  return status === 'pending' ? 'Ожидает проверки' : status === 'clean' ? 'Подтверждён' : 'Отклонён'
}

export default function AdminLessonMaterialsPage({ params }: { params: Promise<{ id: string }> }) {
  const [lessonId, setLessonId] = useState<number | null>(null)
  const [items, setItems] = useState<AdminLessonMaterial[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [kind, setKind] = useState<'rich_text' | 'video' | 'document' | 'image'>('rich_text')
  const [title, setTitle] = useState('')
  const [position, setPosition] = useState('1')
  const [body, setBody] = useState('')
  const [url, setUrl] = useState('')
  const [file, setFile] = useState<File | null>(null)

  const load = useCallback(async (id: number) => {
    setLoading(true); setError(null)
    try { setItems(await listAdminLessonMaterials(id)) } catch (cause) { setError(message(cause)) } finally { setLoading(false) }
  }, [])

  useEffect(() => {
    let active = true
    void params.then(value => {
      const id = Number(value.id)
      if (!Number.isSafeInteger(id) || id < 1) throw new Error('Некорректный урок')
      if (!active) return
      setLessonId(id)
      void load(id)
    }).catch(cause => { if (active) { setError(message(cause)); setLoading(false) } })
    return () => { active = false }
  }, [load, params])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!lessonId || saving) return
    const ordinal = Number(position)
    if (!Number.isSafeInteger(ordinal) || ordinal < 1) { setError('Укажите позицию материала (целое число от 1).'); return }
    setSaving(true); setError(null)
    try {
      if (kind === 'rich_text') await createAdminTextMaterial(lessonId, { materialType: kind, title, position: ordinal, bodyMarkdown: body, isPublished: false })
      else if (kind === 'video') await createAdminTextMaterial(lessonId, { materialType: kind, title, position: ordinal, externalUrl: url, isPublished: false })
      else {
        if (!file) throw new Error('Выберите файл')
        await uploadAdminLessonMaterial(lessonId, { materialType: kind, title, position: ordinal }, file)
      }
      setTitle(''); setBody(''); setUrl(''); setFile(null)
      await load(lessonId)
    } catch (cause) { setError(message(cause)) } finally { setSaving(false) }
  }

  const review = async (material: AdminLessonMaterial, status: 'clean' | 'rejected') => {
    if (saving || !lessonId) return
    setSaving(true); setError(null)
    try { await reviewAdminLessonMaterial(material.id, status, status === 'clean'); await load(lessonId) } catch (cause) { setError(message(cause)) } finally { setSaving(false) }
  }

  return (
    <div className="min-h-screen bg-[#F4F6FA]">
      <AdminTopbar title="Материалы урока" />
      <main className="mx-auto max-w-4xl px-4 py-7 sm:px-6">
        <Link href="/admin/lessons" className="inline-flex min-h-10 items-center gap-1.5 text-sm font-bold text-gray-500 hover:text-[#1B3F92]"><ArrowLeft size={16} /> К урокам</Link>
        <section className="mt-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
          <h1 className="text-xl font-black text-[#191B23]">Добавить материал</h1>
          <p className="mt-1 text-sm text-gray-500">PDF до 200 MiB, изображения до 30 MiB. Файлы видны ученикам только после подтверждения.</p>
          <form onSubmit={event => void submit(event)} className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-bold text-gray-700">Тип<select value={kind} onChange={event => setKind(event.target.value as typeof kind)} className="mt-1.5 min-h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm"><option value="rich_text">Текст / LaTeX</option><option value="video">Видео YouTube</option><option value="document">PDF-документ</option><option value="image">Изображение</option></select></label>
            <label className="block text-sm font-bold text-gray-700">Позиция<input value={position} onChange={event => setPosition(event.target.value)} inputMode="numeric" className="mt-1.5 min-h-11 w-full rounded-xl border border-gray-200 px-3 text-sm" /></label>
            <label className="block text-sm font-bold text-gray-700 sm:col-span-2">Название<input value={title} onChange={event => setTitle(event.target.value)} required maxLength={300} className="mt-1.5 min-h-11 w-full rounded-xl border border-gray-200 px-3 text-sm" /></label>
            {kind === 'rich_text' && <label className="block text-sm font-bold text-gray-700 sm:col-span-2">Текст (формулы можно писать в LaTeX)<textarea value={body} onChange={event => setBody(event.target.value)} required maxLength={500000} rows={8} className="mt-1.5 w-full rounded-xl border border-gray-200 p-3 text-sm" /></label>}
            {kind === 'video' && <label className="block text-sm font-bold text-gray-700 sm:col-span-2">Ссылка YouTube<input type="url" value={url} onChange={event => setUrl(event.target.value)} required className="mt-1.5 min-h-11 w-full rounded-xl border border-gray-200 px-3 text-sm" /></label>}
            {(kind === 'document' || kind === 'image') && <label className="block text-sm font-bold text-gray-700 sm:col-span-2">Файл<input type="file" accept={kind === 'document' ? 'application/pdf' : 'image/png,image/jpeg,image/webp'} onChange={event => setFile(event.target.files?.[0] ?? null)} required className="mt-1.5 block w-full text-sm" /></label>}
            <button disabled={saving} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#1B3F92] px-4 text-sm font-bold text-white disabled:opacity-60 sm:col-span-2">{saving ? <LoaderCircle className="animate-spin" size={17} /> : <Upload size={17} />}{saving ? 'Сохраняем…' : 'Сохранить материал'}</button>
          </form>
          {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
        </section>
        <section className="mt-5 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6"><h2 className="text-base font-black text-[#191B23]">Материалы</h2>{loading ? <p className="mt-4 flex items-center gap-2 text-sm text-gray-500"><LoaderCircle className="animate-spin" size={17} />Загружаем…</p> : items.length === 0 ? <p className="mt-4 text-sm text-gray-500">Материалов пока нет.</p> : <div className="mt-4 space-y-3">{items.map(item => <article key={item.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-gray-50 p-4"><span className="rounded-lg bg-white p-2 text-[#1B3F92]">{item.materialType === 'video' ? <Video size={18} /> : <FileText size={18} />}</span><div className="min-w-0 flex-1"><p className="font-bold text-gray-800">{item.position}. {item.title}</p><p className="mt-1 text-xs text-gray-500">{statusLabel(item.scanStatus)} · {item.isPublished ? 'опубликован' : 'скрыт'}</p></div>{item.scanStatus === 'pending' && <div className="flex gap-2"><button onClick={() => void review(item, 'clean')} disabled={saving} className="inline-flex min-h-10 items-center gap-1 rounded-lg bg-emerald-600 px-3 text-xs font-bold text-white"><CheckCircle2 size={15} />Подтвердить и опубликовать</button><button onClick={() => void review(item, 'rejected')} disabled={saving} className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-red-200 px-3 text-xs font-bold text-red-700"><XCircle size={15} />Отклонить</button></div>}</article>)}</div>}</section>
      </main>
    </div>
  )
}
