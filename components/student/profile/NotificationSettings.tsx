import { Bell } from 'lucide-react'

interface ToggleDef {
  key: string
  label: string
  sub: string
}

const TOGGLES: ToggleDef[] = [
  { key: 'daily', label: 'Ежедневное напоминание', sub: 'Напомнить заниматься каждый день' },
  { key: 'mock', label: 'Новый пробный ОРТ', sub: 'Когда открывается регистрация' },
  { key: 'results', label: 'Результаты', sub: 'Когда доступны результаты теста' },
]

export default function NotificationSettings() {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Bell size={16} className="text-[#1B3F92]" />
          <h2 className="text-sm font-bold text-[#191B23]">Уведомления</h2>
        </div>
        <span className="rounded-full bg-gray-100 px-2 py-1 text-[10px] font-bold text-gray-500">Скоро</span>
      </div>
      <p className="mt-2 text-xs leading-5 text-gray-400">Настройки появятся здесь после запуска собственной системы уведомлений.</p>
      <div className="mt-3 space-y-3">
        {TOGGLES.map(t => (
          <div key={t.key} className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-[#191B23]">{t.label}</div>
              <div className="text-xs text-gray-400">{t.sub}</div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={false}
              disabled
              aria-label={`${t.label}: пока недоступно`}
              className="relative h-6 w-11 shrink-0 cursor-not-allowed rounded-full bg-gray-100"
            >
              <span className="absolute top-0.5 h-5 w-5 translate-x-0.5 rounded-full bg-white shadow" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
