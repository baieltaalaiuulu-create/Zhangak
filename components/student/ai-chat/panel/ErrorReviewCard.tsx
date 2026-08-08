import type { ErrorReviewItem } from '@/lib/ai-chat-panel-data'

interface Props {
  items: ErrorReviewItem[]
  onReview: (item: ErrorReviewItem) => void
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ru', { day: 'numeric', month: 'short' })
}

export default function ErrorReviewCard({ items, onReview }: Props) {
  if (items.length === 0) return null

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <p className="mb-2.5 text-[11px] font-bold uppercase tracking-wide text-gray-400">Работа над ошибками</p>
      <div className="space-y-2">
        {items.map(item => (
          <div key={item.section} className="flex items-center justify-between gap-2 rounded-xl bg-gray-50/70 px-3 py-2">
            <div className="min-w-0">
              <p className="text-xs font-bold text-gray-800">{item.count} {item.label}</p>
              <p className="text-[10px] text-gray-400">{formatDate(item.lastDate)}</p>
            </div>
            <button
              type="button"
              onClick={() => onReview(item)}
              className="shrink-0 rounded-lg bg-white px-2.5 py-1 text-[11px] font-bold text-[#4338CA] shadow-sm transition-colors hover:bg-[#F5F3FF]"
            >
              Разобрать
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
