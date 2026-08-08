'use client'

interface QuickStartItem {
  icon: string
  label: string
  action: () => void
}

interface Props {
  items: QuickStartItem[]
}

export default function QuickStartGrid({ items }: Props) {
  return (
    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
      {items.map(item => (
        <button
          key={item.label}
          type="button"
          onClick={item.action}
          className="flex items-center gap-2.5 rounded-xl border border-gray-100 bg-white px-4 py-3 text-left text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:border-[#6C3DE0]/30 hover:bg-[#F5F3FF]"
        >
          <span className="text-base">{item.icon}</span>
          {item.label}
        </button>
      ))}
    </div>
  )
}
