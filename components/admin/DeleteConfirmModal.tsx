'use client'

interface Props {
  title: string
  message: string
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function DeleteConfirmModal({ title, message, loading, onConfirm, onCancel }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onCancel}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-[#191B23]">{title}</h2>
        <p className="mt-2 text-sm text-gray-500">{message}</p>
        <div className="mt-5 flex gap-2">
          <button type="button" onClick={onConfirm} disabled={loading}
            className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-red-700 disabled:opacity-60">
            {loading ? 'Удаление...' : 'Удалить'}
          </button>
          <button type="button" onClick={onCancel}
            className="rounded-xl bg-gray-100 px-5 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-200">
            Отмена
          </button>
        </div>
      </div>
    </div>
  )
}
