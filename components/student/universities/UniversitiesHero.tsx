'use client'

import { Search } from 'lucide-react'

interface Props {
  query: string
  onQueryChange: (v: string) => void
  showFavoritesOnly: boolean
  onToggleFavoritesOnly: () => void
}

export default function UniversitiesHero({ query, onQueryChange, showFavoritesOnly, onToggleFavoritesOnly }: Props) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl p-6 text-white sm:p-8"
      style={{ background: 'linear-gradient(135deg, #6C3DE0 0%, #4338CA 100%)' }}
    >
      <div className="pointer-events-none absolute inset-0 opacity-10"
        style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '22px 22px' }} />

      <div className="relative">
        <h1 className="text-2xl font-bold sm:text-3xl">🎓 Найдите университет своей мечты</h1>
        <p className="mt-2 max-w-xl text-sm font-medium text-white/80 sm:text-base">
          Исследуйте университеты Кыргызстана, сравнивайте специальности и узнайте, сколько баллов ОРТ нужно для поступления.
        </p>

        <div className="relative mt-5 max-w-lg">
          <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={e => onQueryChange(e.target.value)}
            placeholder="Поиск университета или специальности..."
            className="w-full rounded-full bg-white py-3 pl-11 pr-4 text-sm text-gray-800 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-white/50"
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <a
            href="#catalog"
            className="rounded-full bg-white px-5 py-2.5 text-sm font-bold text-[#4338CA] shadow-md transition-colors hover:bg-white/90"
          >
            Найти университет
          </a>
          <button
            type="button"
            onClick={onToggleFavoritesOnly}
            className={`rounded-full px-5 py-2.5 text-sm font-bold transition-colors ${
              showFavoritesOnly ? 'bg-white text-[#4338CA]' : 'bg-white/15 text-white hover:bg-white/25'
            }`}
          >
            ♥ Мои университеты
          </button>
        </div>
      </div>
    </div>
  )
}
