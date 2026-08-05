import { User, Phone } from 'lucide-react'

interface Props {
  fullName: string
  phone: string | null
}

export default function ProfileInfoCard({ fullName, phone }: Props) {
  const fields = [
    { icon: User, label: 'Полное имя', value: fullName },
    { icon: Phone, label: 'Телефон', value: phone || 'Не указан' },
  ]

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <h2 className="text-sm font-bold text-[#191B23]">Личные данные</h2>
      <div className="mt-3 space-y-3">
        {fields.map(f => {
          const Icon = f.icon
          return (
            <div key={f.label} className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-50 text-gray-400">
                <Icon size={15} />
              </span>
              <div className="min-w-0">
                <div className="text-[11px] text-gray-400">{f.label}</div>
                <div className="truncate text-sm font-semibold text-[#191B23]">{f.value}</div>
              </div>
            </div>
          )
        })}
      </div>
      <p className="mt-3 text-[11px] text-gray-400">Изменение личных данных пока недоступно</p>
    </div>
  )
}
