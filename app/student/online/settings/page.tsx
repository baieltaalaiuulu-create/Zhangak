'use client'
export const dynamic = 'force-dynamic'

import SettingsNotifications from '@/components/student/settings/SettingsNotifications'
import SettingsInstallCard from '@/components/student/settings/SettingsInstallCard'
import DangerZoneCard from '@/components/student/settings/DangerZoneCard'
import PersonalizationSettings from '@/components/student/settings/PersonalizationSettings'
import { useStudentSession } from '@/components/student/StudentSessionContext'
import AccountLogoutCard from '@/components/auth/AccountLogoutCard'

export default function SettingsPage() {
  // The parent StudentLayout has already verified this own first-party
  // session. Keep this read so the page cannot accidentally be mounted
  // outside that protected shell in the future.
  useStudentSession()

  return (
    <div className="min-h-screen bg-[var(--student-bg)] pb-24 md:pb-0">
      <div className="mx-auto max-w-2xl space-y-4 px-4 py-5 sm:px-6">
        <div><p className="text-[11px] font-extrabold uppercase tracking-[.12em] text-[var(--student-brand)]">Твой опыт</p><h1 className="mt-1 text-2xl font-black tracking-tight text-[var(--student-ink)]">Настройки</h1></div>

        <PersonalizationSettings />
        <SettingsNotifications />
        <SettingsInstallCard />
        <AccountLogoutCard />
        <DangerZoneCard />
      </div>
    </div>
  )
}
