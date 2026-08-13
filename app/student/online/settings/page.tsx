'use client'
export const dynamic = 'force-dynamic'

import SettingsNotifications from '@/components/student/settings/SettingsNotifications'
import SettingsInstallCard from '@/components/student/settings/SettingsInstallCard'
import DangerZoneCard from '@/components/student/settings/DangerZoneCard'
import { useStudentSession } from '@/components/student/StudentSessionContext'

export default function SettingsPage() {
  // The parent StudentLayout has already verified this own first-party
  // session. Keep this read so the page cannot accidentally be mounted
  // outside that protected shell in the future.
  useStudentSession()

  return (
    <div className="min-h-screen bg-[#FAF8FF]">
      <div className="mx-auto max-w-2xl space-y-5 px-4 py-6 sm:px-6">
        <h1 className="text-xl font-bold text-[#191B23]">Настройки</h1>

        <SettingsNotifications />
        <SettingsInstallCard />
        <DangerZoneCard />
      </div>
    </div>
  )
}
