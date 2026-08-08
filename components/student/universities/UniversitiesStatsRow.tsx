import { CATALOG_STATS } from '@/lib/universities-data'

export default function UniversitiesStatsRow() {
  const items = [
    { icon: '🏛', value: String(CATALOG_STATS.totalUniversities), label: 'Университета в каталоге' },
    { icon: '📚', value: CATALOG_STATS.totalSpecialties, label: 'Активных специальностей' },
    { icon: '🏫', value: String(CATALOG_STATS.stateUniversities), label: 'Государственных ВУЗов' },
    { icon: '🏢', value: String(CATALOG_STATS.privateUniversities), label: 'Частных заведений' },
    { icon: '📊', value: String(CATALOG_STATS.averagePassingScore), label: 'Средний проходной балл' },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {items.map(item => (
        <div key={item.label} className="rounded-2xl border border-gray-100 bg-white p-4 text-center shadow-sm">
          <div className="text-xl">{item.icon}</div>
          <div className="mt-1 text-lg font-extrabold text-gray-900">{item.value}</div>
          <div className="text-[11px] font-medium leading-tight text-gray-400">{item.label}</div>
        </div>
      ))}
    </div>
  )
}
