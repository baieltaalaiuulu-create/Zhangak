'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useRef, useState } from 'react'
import { UploadCloud, RefreshCw, Loader2, CheckCircle2, XCircle } from 'lucide-react'
import AdminTopbar from '@/components/admin/AdminTopbar'
import { supabase } from '@/lib/supabase'
import { authenticatedFetch } from '@/lib/authenticated-fetch'

interface KnowledgeFile {
  id: string
  filename: string
  subject: string | null
  file_url: string | null
  file_size: number | null
  status: 'processing' | 'ready' | 'error'
  questions_generated: number
  processed_at: string | null
  created_at: string
}

const SUBJECT_LABELS: Record<string, string> = { math: 'Математика', kyr: 'Кыргыз тили', analogy: 'Аналогии', reading: 'Окуу' }

const STATUS_META: Record<KnowledgeFile['status'], { label: string; className: string }> = {
  ready: { label: 'Готов', className: 'bg-green-50 text-green-600' },
  processing: { label: 'Обрабатывается', className: 'bg-blue-50 text-blue-600' },
  error: { label: 'Ошибка', className: 'bg-red-50 text-red-600' },
}

function formatSize(bytes: number | null): string {
  if (!bytes) return '—'
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`
}

export default function AdminKnowledgeBasePage() {
  const [files, setFiles] = useState<KnowledgeFile[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [reprocessingId, setReprocessingId] = useState<string | null>(null)
  const [subject, setSubject] = useState('math')
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const load = async () => {
    const { data } = await supabase.from('ai_knowledge_files').select('*').order('created_at', { ascending: false })
    setFiles((data ?? []) as KnowledgeFile[])
    setLoading(false)
  }

  useEffect(() => {
    const init = async () => { await load() }
    init()
  }, [])

  const totalFiles = files.length
  const readyFiles = files.filter(f => f.status === 'ready')
  const accuracyPct = totalFiles > 0 ? Math.round((readyFiles.length / totalFiles) * 100) : 0
  const totalQuestions = files.reduce((sum, f) => sum + (f.questions_generated ?? 0), 0)

  const uploadFile = async (file: File) => {
    setUploading(true)
    setError(null)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('subject', subject)
      const res = await authenticatedFetch('/api/admin/knowledge-base', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Не удалось загрузить файл')
      if (data.error) setError(data.error)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Неизвестная ошибка')
    } finally {
      setUploading(false)
    }
  }

  const handleFileSelect = (fileList: FileList | null) => {
    const file = fileList?.[0]
    if (file) uploadFile(file)
  }

  const handleReprocess = async (id: string) => {
    setReprocessingId(id)
    try {
      await authenticatedFetch('/api/admin/knowledge-base', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      await load()
    } finally {
      setReprocessingId(null)
    }
  }

  return (
    <div className="min-h-screen bg-[#FAF8FF]">
      <AdminTopbar title="База знаний AI" />

      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
        {/* Stats */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-gray-100 bg-white p-5">
            <p className="text-xs font-semibold text-gray-400">Всего файлов</p>
            <p className="mt-1 text-2xl font-extrabold text-[#191B23]">{totalFiles} {totalFiles === 1 ? 'документ' : 'документов'}</p>
          </div>
          <div className="rounded-2xl border border-gray-100 bg-white p-5">
            <p className="text-xs font-semibold text-gray-400">Обработано AI</p>
            <p className="mt-1 text-2xl font-extrabold text-[#191B23]">{readyFiles.length} {readyFiles.length === 1 ? 'файл' : 'файлов'}</p>
            <p className="mt-1 text-xs text-gray-400">Точность: {accuracyPct}%</p>
          </div>
          <div className="rounded-2xl border border-gray-100 bg-white p-5">
            <p className="text-xs font-semibold text-gray-400">Создано вопросов</p>
            <p className="mt-1 text-2xl font-extrabold text-[#191B23]">{totalQuestions.toLocaleString('ru')}</p>
          </div>
        </div>

        {error && <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">{error}</div>}

        {/* Upload area */}
        <div>
          <div className="mb-3 flex items-center gap-3">
            <label className="text-sm font-semibold text-gray-600">Предмет файла:</label>
            <select
              value={subject}
              onChange={e => setSubject(e.target.value)}
              className="rounded-xl border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4FD8]/20"
            >
              {Object.entries(SUBJECT_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </div>

          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); handleFileSelect(e.dataTransfer.files) }}
            className={`flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed p-10 text-center transition-colors ${
              dragOver ? 'border-[#1B4FD8] bg-blue-50/50' : 'border-gray-200 bg-white'
            }`}
          >
            {uploading ? (
              <Loader2 size={28} className="animate-spin text-[#1B4FD8]" />
            ) : (
              <UploadCloud size={28} className="text-gray-400" />
            )}
            <div>
              <p className="text-sm font-bold text-gray-700">
                {uploading ? 'Загрузка и обработка файла...' : 'Перетащите учебники или конспекты сюда'}
              </p>
              <p className="mt-1 text-xs text-gray-400">Поддерживаемые форматы: PDF, DOCX, TXT (до 50 MB)</p>
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="rounded-xl bg-[#1B4FD8] px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
            >
              Выбрать файлы на компьютере
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.txt"
              className="hidden"
              onChange={e => { handleFileSelect(e.target.files); e.target.value = '' }}
            />
          </div>
        </div>

        {/* Files table */}
        {loading ? (
          <div className="rounded-2xl border border-gray-100 bg-white p-10 text-center text-sm text-gray-400">Загрузка...</div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white">
            <table className="w-full min-w-[760px] border-collapse">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs font-semibold text-gray-400">
                  <th className="px-4 py-3">Название файла</th>
                  <th className="px-4 py-3">Предмет</th>
                  <th className="px-4 py-3">Размер</th>
                  <th className="px-4 py-3">Загружено</th>
                  <th className="px-4 py-3">Статус</th>
                  <th className="px-4 py-3">Вопросов создано</th>
                  <th className="px-4 py-3">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {files.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">Файлов пока нет</td></tr>
                ) : files.map(f => {
                  const status = STATUS_META[f.status]
                  return (
                    <tr key={f.id} className="hover:bg-gray-50">
                      <td className="max-w-[220px] truncate px-4 py-3 text-sm font-semibold text-[#191B23]">{f.filename}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{f.subject ? SUBJECT_LABELS[f.subject] ?? f.subject : '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{formatSize(f.file_size)}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{new Date(f.created_at).toLocaleDateString('ru', { day: '2-digit', month: 'short' })}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${status.className}`}>
                          {f.status === 'processing' && <Loader2 size={11} className="animate-spin" />}
                          {f.status === 'ready' && <CheckCircle2 size={11} />}
                          {f.status === 'error' && <XCircle size={11} />}
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">{f.questions_generated}</td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => handleReprocess(f.id)}
                          disabled={reprocessingId === f.id}
                          className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-60"
                        >
                          {reprocessingId === f.id ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                          Обновить
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
