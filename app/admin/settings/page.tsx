'use client'

export const dynamic = 'force-dynamic'

import { ShieldCheck } from 'lucide-react'

import AdminTopbar from '@/components/admin/AdminTopbar'
import AccountLogoutCard from '@/components/auth/AccountLogoutCard'

export default function AdminSettingsPage() {
  return (
    <div className="min-h-screen bg-[#FAF8FF]">
      <AdminTopbar title="Настройки" />
      <main className="mx-auto max-w-2xl space-y-5 px-4 py-6 sm:px-6">
        <section className="rounded-2xl border border-blue-100 bg-white p-5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-[#1B3F92]"><ShieldCheck size={18} aria-hidden="true" /></span>
          <h2 className="mt-3 text-base font-extrabold text-[#0D1E4A]">Безопасность аккаунта</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">Пароли, роли и доступы сотрудников изменяются только через защищённые разделы панели. Здесь можно безопасно завершить текущий сеанс.</p>
        </section>
        <AccountLogoutCard description="Завершите текущий сеанс администратора на этом устройстве. Для повторного входа потребуется пароль." />
      </main>
    </div>
  )
}
