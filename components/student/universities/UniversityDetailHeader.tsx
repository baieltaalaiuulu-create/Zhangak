import { Heart, ExternalLink } from 'lucide-react'
import type { University } from '@/lib/universities-data'
import { UniversityTypeIcon } from './UniversityVisuals'

interface Props {
  university: University
  isFavorite: boolean
  onToggleFavorite: () => void
}

function formatCost(cost: number | null): string {
  if (cost == null) return 'Не указано'
  return cost === 0 ? 'Бесплатно' : `от ${cost.toLocaleString('ru')} сом/год`
}

export default function UniversityDetailHeader({ university: u, isFavorite, onToggleFavorite }: Props) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          {u.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- admin-entered external logo URL, no next/image domain config
            <img src={u.logoUrl} alt={u.shortName} className="h-16 w-16 shrink-0 rounded-2xl object-cover" />
          ) : (
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-[#6C3DE0]"><UniversityTypeIcon type={u.type} size={30} /></span>
          )}
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">{u.name}</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <span className="text-sm text-gray-400">{u.city}</span>
              <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${u.type === 'state' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'}`}>
                {u.type === 'state' ? 'Государственный' : 'Частный'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={onToggleFavorite}
            aria-pressed={isFavorite}
            className={`flex min-h-11 items-center gap-1.5 rounded-xl border px-4 py-2 text-sm font-bold transition-colors ${
              isFavorite ? 'border-red-200 bg-red-50 text-red-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Heart size={15} fill={isFavorite ? '#EF4444' : 'none'} aria-hidden="true" /> {isFavorite ? 'В избранном' : 'В избранное'}
          </button>
          {u.website && (
            <a
              href={u.website}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-11 items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold text-white shadow-sm transition-opacity hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #6C3DE0 0%, #4338CA 100%)' }}
            >
              Перейти на сайт <ExternalLink size={14} />
            </a>
          )}
        </div>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-gray-600">{u.description}</p>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl bg-gray-50/70 p-3 text-center">
          <div className="text-lg font-extrabold text-gray-900">{u.specialtyCount}</div>
          <div className="text-[11px] text-gray-400">Специальностей</div>
        </div>
        <div className="rounded-xl bg-gray-50/70 p-3 text-center">
          <div className="text-lg font-extrabold text-gray-900">{u.minScore ?? '—'}</div>
          <div className="text-[11px] text-gray-400">Минимальный балл</div>
        </div>
        <div className="rounded-xl bg-gray-50/70 p-3 text-center">
          <div className="truncate text-lg font-extrabold text-gray-900">{formatCost(u.costFrom)}</div>
          <div className="text-[11px] text-gray-400">Стоимость</div>
        </div>
        <div className="rounded-xl bg-gray-50/70 p-3 text-center">
          <div className="text-lg font-extrabold text-gray-900">{u.hasDormitory ? 'Есть' : 'Нет'}</div>
          <div className="text-[11px] text-gray-400">Общежитие</div>
        </div>
      </div>
    </div>
  )
}
