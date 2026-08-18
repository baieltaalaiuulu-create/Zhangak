import type { CatalogStats } from '@/lib/universities-data'
import { BarChart3, BookOpenCheck, Building2, School, University, type LucideIcon } from 'lucide-react'

interface Props {
  stats: CatalogStats
}

export default function UniversitiesStatsRow({ stats }: Props) {
  const items: { icon: LucideIcon; value: string; label: string }[] = [
    { icon: University, value: String(stats.totalUniversities), label: 'Университетов в каталоге' },
    { icon: BookOpenCheck, value: String(stats.totalSpecialties), label: 'Активных специальностей' },
    { icon: School, value: String(stats.stateUniversities), label: 'Государственных вузов' },
    { icon: Building2, value: String(stats.privateUniversities), label: 'Частных заведений' },
    { icon: BarChart3, value: stats.averagePassingScore > 0 ? String(stats.averagePassingScore) : '—', label: 'Средний проходной балл' },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {items.map(item => {
        const Icon = item.icon
        return (
          <div key={item.label} className="rounded-2xl border border-gray-100 bg-white p-4 text-center shadow-sm">
            <span className="mx-auto flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 text-[#6C3DE0]"><Icon size={18} aria-hidden="true" /></span>
            <div className="mt-2 text-lg font-extrabold text-gray-900">{item.value}</div>
            <div className="text-[11px] font-medium leading-tight text-gray-400">{item.label}</div>
          </div>
        )
      })}
    </div>
  )
}
