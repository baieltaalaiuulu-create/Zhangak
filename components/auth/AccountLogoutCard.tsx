'use client'

import { useState } from 'react'
import { LogOut } from 'lucide-react'
import { useRouter } from 'next/navigation'

import { logoutZhangak } from '@/lib/zhangak-auth-client'

interface Props {
  description?: string
}

export default function AccountLogoutCard({
  description = 'Завершите сессию на этом устройстве. Для следующего входа потребуется пароль.',
}: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)

  const signOut = async () => {
    if (busy) return
    setBusy(true)
    setError(false)
    try {
      await logoutZhangak()
      router.replace('/login')
    } catch {
      setError(true)
      setBusy(false)
    }
  }

  return (
    <section className="rounded-2xl border border-red-100 bg-white p-5" aria-labelledby="logout-title">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-red-50 text-red-600">
          <LogOut size={16} aria-hidden="true" />
        </span>
        <h2 id="logout-title" className="text-sm font-bold text-[#191B23]">Сеанс на устройстве</h2>
      </div>
      <p className="mt-2 text-xs leading-5 text-gray-500">{description}</p>
      {error && <p role="alert" className="mt-3 text-xs font-semibold text-red-600">Не удалось завершить сессию. Проверьте соединение и повторите.</p>}
      <button
        type="button"
        onClick={() => void signOut()}
        disabled={busy}
        className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-red-200 px-4 text-sm font-bold text-red-600 transition-colors hover:bg-red-50 disabled:cursor-wait disabled:opacity-60"
      >
        <LogOut size={16} aria-hidden="true" />
        {busy ? 'Выходим…' : 'Выйти из аккаунта'}
      </button>
    </section>
  )
}
