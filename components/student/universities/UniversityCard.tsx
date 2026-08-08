import Link from 'next/link'
import { Star, Heart } from 'lucide-react'
import { getProbability, type University } from '@/lib/universities-data'

interface Props {
  university: University
  studentScore: number
  isFavorite: boolean
  onToggleFavorite: (id: string) => void
}

const PROBABILITY_META: Record<'high' | 'medium' | 'low', { emoji: string; className: string }> = {
  high: { emoji: '🟢', className: 'bg-green-50 text-green-700' },
  medium: { emoji: '🟡', className: 'bg-amber-50 text-amber-700' },
  low: { emoji: '🔴', className: 'bg-red-50 text-red-700' },
}

function formatCost(cost: number | null): string {
  return cost == null ? 'Бесплатно' : `${cost.toLocaleString('ru')} сом`
}

export default function UniversityCard({ university: u, studentScore, isFavorite, onToggleFavorite }: Props) {
  const probability = getProbability(studentScore, u.minScore)
  const probabilityMeta = PROBABILITY_META[probability.level]
  const probabilityText = probability.level === 'high'
    ? 'Высокая вероятность поступить'
    : probability.level === 'medium'
      ? 'Средняя вероятность поступить'
      : `Низкая вероятность (нужно +${probability.pointsNeeded} балла)`

  return (
    <div className="relative flex flex-col rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <button
        type="button"
        onClick={() => onToggleFavorite(u.id)}
        aria-label={isFavorite ? 'Убрать из избранного' : 'Добавить в избранное'}
        className="absolute right-4 top-4 rounded-full p-1.5 text-gray-300 transition-colors hover:bg-gray-50 hover:text-red-500"
      >
        <Heart size={16} fill={isFavorite ? '#EF4444' : 'none'} className={isFavorite ? 'text-red-500' : ''} />
      </button>

      <div className="flex items-start gap-3 pr-8">
        {u.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- admin-entered external logo URL, no next/image domain config
          <img src={u.logoUrl} alt={u.shortName} className="h-11 w-11 shrink-0 rounded-xl object-cover" />
        ) : (
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gray-50 text-2xl">{u.emoji}</span>
        )}
        <div className="min-w-0">
          <h3 className="truncate text-sm font-bold text-gray-900">{u.shortName}</h3>
          <p className="text-xs text-gray-400">{u.city}</p>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${u.type === 'state' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'}`}>
          {u.type === 'state' ? 'Государственный' : 'Частный'}
        </span>
        <span className="flex items-center gap-0.5 text-xs font-semibold text-amber-500">
          <Star size={13} fill="#F59E0B" strokeWidth={0} /> {u.rating.toFixed(1)}
        </span>
      </div>

      <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-gray-500">{u.description}</p>

      <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-gray-50/70 p-3 text-center">
        <div>
          <div className="text-sm font-extrabold text-gray-900">{u.specialtyCount}</div>
          <div className="text-[10px] text-gray-400">Специальностей</div>
        </div>
        <div>
          <div className="text-sm font-extrabold text-gray-900">{u.minScore}</div>
          <div className="text-[10px] text-gray-400">Балл от</div>
        </div>
        <div>
          <div className="truncate text-sm font-extrabold text-gray-900">{formatCost(u.costFrom)}</div>
          <div className="text-[10px] text-gray-400">В год</div>
        </div>
      </div>

      <div className={`mt-3 inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${probabilityMeta.className}`}>
        {probabilityMeta.emoji} {probabilityText}
      </div>

      <div className="mt-4 flex items-center gap-2">
        <Link
          href={`/student/online/universities/${u.id}#comparison`}
          className="flex-1 rounded-xl border border-gray-200 py-2 text-center text-xs font-bold text-gray-600 transition-colors hover:bg-gray-50"
        >
          Сравнить
        </Link>
        <Link
          href={`/student/online/universities/${u.id}`}
          className="flex-1 rounded-xl py-2 text-center text-xs font-bold text-white shadow-sm transition-opacity hover:opacity-90"
          style={{ background: 'linear-gradient(135deg, #6C3DE0 0%, #4338CA 100%)' }}
        >
          Подробнее →
        </Link>
      </div>
    </div>
  )
}
