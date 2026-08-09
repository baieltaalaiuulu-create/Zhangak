import { Share, SquarePlus, Check } from 'lucide-react'

const STEPS = [
  { icon: Share, text: 'Нажми кнопку Поделиться' },
  { icon: SquarePlus, text: 'Выбери «На экран Домой»' },
  { icon: Check, text: 'Нажми «Добавить»' },
]

interface Props {
  className?: string
}

// iOS never fires beforeinstallprompt — Safari (and any browser shell on
// iOS, which all run on WebKit) only supports installing via the manual
// Share-sheet flow, so this is shown instead of an "Установить" button.
export default function IOSInstallSteps({ className = '' }: Props) {
  return (
    <div className={`space-y-3 ${className}`}>
      <p className="text-sm font-semibold text-gray-600">Чтобы установить на iPhone:</p>
      {STEPS.map((step, i) => {
        const Icon = step.icon
        return (
          <div key={step.text} className="flex items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#EEF2FF] text-xs font-bold text-[#1B4FD8]">
              {i + 1}
            </span>
            <Icon size={18} className="shrink-0 text-[#1B4FD8]" />
            <span className="text-sm text-gray-700">{step.text}</span>
          </div>
        )
      })}
    </div>
  )
}
