'use client'

import { useEffect, useState } from 'react'
import { Bell, BellOff, CheckCircle2, LoaderCircle, Send } from 'lucide-react'

import {
  decodeApplicationServerKey,
  loadPushConfig,
  removePushSubscription,
  savePushSubscription,
  sendTestPush,
  type PushConfig,
  type PushPreferences,
} from '@/lib/platform-push'

const TOGGLES: Array<{ key: keyof PushPreferences; label: string; sub: string }> = [
  { key: 'lessonReminders', label: 'Напоминания об уроках', sub: 'Ежедневно напоминаем вернуться к roadmap' },
  { key: 'resultNotifications', label: 'Результаты тестов', sub: 'Когда результат и звёзды готовы' },
  { key: 'announcementNotifications', label: 'Объявления', sub: 'Важные новости от школы' },
]

function supported(): boolean {
  return typeof window !== 'undefined'
    && window.isSecureContext
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window
}

async function browserSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.ready
  return registration.pushManager.getSubscription()
}

export default function SettingsNotifications() {
  const [config, setConfig] = useState<PushConfig | null>(null)
  const [subscription, setSubscription] = useState<PushSubscription | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const nextConfig = await loadPushConfig()
        const nextSubscription = supported() ? await browserSubscription() : null
        if (!active) return
        setConfig(nextConfig)
        setSubscription(nextSubscription)
      } catch {
        if (active) setError('Не удалось загрузить настройки уведомлений.')
      }
    }
    void load()
    return () => { active = false }
  }, [])

  const enable = async () => {
    if (!config?.enabled || !config.publicKey || !supported() || busy) return
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setError(permission === 'denied'
          ? 'Уведомления заблокированы в настройках браузера или телефона.'
          : 'Разрешение не выдано. Мы не будем спрашивать повторно автоматически.')
        return
      }
      const registration = await navigator.serviceWorker.ready
      const current = await registration.pushManager.getSubscription()
      const next = current ?? await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: decodeApplicationServerKey(config.publicKey),
      })
      await savePushSubscription(next, config.preferences)
      setSubscription(next)
      setConfig({ ...config, subscribed: true })
      setNotice('Push-уведомления включены на этом устройстве.')
    } catch {
      setError('Не удалось включить уведомления. Установите приложение или откройте сайт в Chrome/Safari.')
    } finally {
      setBusy(false)
    }
  }

  const disable = async () => {
    if (!subscription || busy) return
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      await removePushSubscription(subscription)
      await subscription.unsubscribe()
      setSubscription(null)
      if (config) setConfig({ ...config, subscribed: false })
      setNotice('Уведомления отключены на этом устройстве.')
    } catch {
      setError('Не удалось отключить уведомления. Повторите попытку.')
    } finally {
      setBusy(false)
    }
  }

  const changePreference = async (key: keyof PushPreferences) => {
    if (!config || !subscription || busy) return
    const preferences = { ...config.preferences, [key]: !config.preferences[key] }
    setBusy(true)
    setError(null)
    try {
      await savePushSubscription(subscription, preferences)
      setConfig({ ...config, preferences })
    } catch {
      setError('Не удалось сохранить настройку.')
    } finally {
      setBusy(false)
    }
  }

  const test = async () => {
    if (!subscription || busy) return
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      await sendTestPush()
      setNotice('Проверочное уведомление отправлено. Оно может появиться через несколько секунд.')
    } catch {
      setError('Не удалось отправить проверочное уведомление. Повторите через минуту.')
    } finally {
      setBusy(false)
    }
  }

  const available = supported()
  const enabled = Boolean(subscription && config?.subscribed)

  return (
    <section className="min-w-0 rounded-2xl border border-gray-200 bg-white p-5" aria-labelledby="push-settings-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Bell size={17} className="text-[#1B3F92]" aria-hidden="true" />
            <h2 id="push-settings-title" className="text-sm font-bold text-[#191B23]">Push-уведомления</h2>
          </div>
          <p className="mt-2 max-w-lg text-xs leading-5 text-gray-500">Разрешение запрашивается только после вашего нажатия. Подписка действует для этого браузера и текущего сеанса.</p>
        </div>
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold ${enabled ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
          {enabled ? <CheckCircle2 size={13} aria-hidden="true" /> : <BellOff size={13} aria-hidden="true" />}
          {enabled ? 'Включены' : 'Выключены'}
        </span>
      </div>

      {!config && !error && <div role="status" className="mt-4 flex items-center gap-2 text-xs font-semibold text-gray-500"><LoaderCircle size={15} className="animate-spin" />Загружаем настройки…</div>}
      {config && (!config.enabled || !available) && (
        <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2.5 text-xs font-semibold leading-5 text-amber-800">
          {!available ? 'Этот браузер не поддерживает Web Push. На iPhone сначала установите Жангак на экран «Домой».' : 'Система уведомлений ещё не настроена на сервере.'}
        </p>
      )}

      {config?.enabled && available && (
        <>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={() => void (enabled ? disable() : enable())} disabled={busy} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#1B3F92] px-4 text-xs font-bold text-white disabled:cursor-wait disabled:opacity-60 sm:flex-none">
              {busy ? <LoaderCircle size={15} className="animate-spin" /> : enabled ? <BellOff size={15} /> : <Bell size={15} />}
              {enabled ? 'Отключить' : 'Включить уведомления'}
            </button>
            {enabled && <button type="button" onClick={() => void test()} disabled={busy} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-[#1B3F92]/20 px-4 text-xs font-bold text-[#1B3F92] disabled:opacity-60 sm:flex-none"><Send size={15} />Проверить</button>}
          </div>

          <div className="mt-4 space-y-3 border-t border-gray-100 pt-4">
            {TOGGLES.map(item => (
              <div key={item.key} className="flex min-w-0 items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-[#191B23]">{item.label}</div>
                  <div className="text-xs leading-5 text-gray-400">{item.sub}</div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={config.preferences[item.key]}
                  aria-label={item.label}
                  disabled={!enabled || busy}
                  onClick={() => void changePreference(item.key)}
                  className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${config.preferences[item.key] ? 'bg-[#1B3F92]' : 'bg-gray-200'}`}
                >
                  <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${config.preferences[item.key] ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {notice && <p role="status" className="mt-3 text-xs font-semibold leading-5 text-green-700">{notice}</p>}
      {error && <p role="alert" className="mt-3 text-xs font-semibold leading-5 text-red-600">{error}</p>}
    </section>
  )
}
