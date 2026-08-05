import { LogOut } from 'lucide-react'

interface Props {
  fullName: string
  studentType: string
  latestScore: number | null
  streak: number
  level: number
  onSignOut: () => void
}

function initials(name: string): string {
  const letters = name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '')
  return letters.join('') || '?'
}

export default function ProfileHeader({ fullName, studentType, latestScore, streak, level, onSignOut }: Props) {
  const isOnline = studentType !== 'offline'

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#1B4FD8] text-2xl font-extrabold text-white">
        {initials(fullName)}
      </div>
      <h1 className="mt-4 text-lg font-bold text-[#191B23]">{fullName}</h1>
      <span className={`mt-1 inline-block rounded-full px-2.5 py-1 text-xs font-bold ${isOnline ? 'bg-[#EEF2FF] text-[#1B4FD8]' : 'bg-gray-100 text-gray-500'}`}>
        {isOnline ? 'Онлайн' : 'Оффлайн'}
      </span>

      <div className="mt-5 grid grid-cols-3 gap-2 border-t border-gray-100 pt-5">
        <div>
          <div className="text-lg font-extrabold text-[#191B23]">{latestScore ?? '—'}</div>
          <div className="text-[11px] text-gray-400">Балл ОРТ</div>
        </div>
        <div>
          <div className="text-lg font-extrabold text-[#191B23]">{streak}</div>
          <div className="text-[11px] text-gray-400">Дней подряд</div>
        </div>
        <div>
          <div className="text-lg font-extrabold text-[#191B23]">{level}</div>
          <div className="text-[11px] text-gray-400">Уровень</div>
        </div>
      </div>

      <button
        type="button"
        onClick={onSignOut}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-red-500 transition-colors hover:bg-red-50"
      >
        <LogOut size={16} /> Выйти
      </button>
    </div>
  )
}
