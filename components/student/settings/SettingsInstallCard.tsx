'use client'

import { CheckCircle2, Smartphone } from 'lucide-react'
import { useInstallPrompt } from '@/components/PWAInstallProvider'
import IOSInstallSteps from '@/components/IOSInstallSteps'

export default function SettingsInstallCard() {
  const { canPrompt, isInstalled, isIOS, isUnsupported, promptInstall } = useInstallPrompt()

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <div className="flex items-center gap-2">
        <Smartphone size={16} className="text-[#1B3F92]" />
        <h2 className="text-sm font-bold text-[#191B23]">Приложение</h2>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-[#191B23]"><Smartphone size={15} aria-hidden="true" />Установить как приложение</div>
          <div className="text-xs text-gray-400">Работает без браузера, быстрее</div>
        </div>

        {isInstalled ? (
          <span className="shrink-0 whitespace-nowrap text-xs font-bold text-green-600">
            <CheckCircle2 size={15} className="mr-1 inline-block align-text-bottom" aria-hidden="true" />
            Приложение установлено
          </span>
        ) : isUnsupported ? (
          <span className="shrink-0 text-right text-xs font-semibold text-gray-400">Откройте в Chrome</span>
        ) : !isIOS ? (
          <button
            type="button"
            onClick={promptInstall}
            disabled={!canPrompt}
            className="min-h-11 shrink-0 rounded-xl bg-[#1B3F92] px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-blue-700 disabled:cursor-wait disabled:bg-slate-300"
          >
            {canPrompt ? 'Установить' : 'Подготовка…'}
          </button>
        ) : null}
      </div>

      {isIOS && !isInstalled && <IOSInstallSteps className="mt-4" />}
      {!isInstalled && !isIOS && !isUnsupported && !canPrompt && (
        <p className="mt-3 text-xs leading-5 text-gray-400">Если кнопка не активируется, откройте меню браузера и выберите «Установить приложение» или «Добавить на главный экран».</p>
      )}
    </div>
  )
}
