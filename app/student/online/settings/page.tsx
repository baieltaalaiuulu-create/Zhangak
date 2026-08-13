'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import SettingsNotifications from '@/components/student/settings/SettingsNotifications'
import SettingsInstallCard from '@/components/student/settings/SettingsInstallCard'
import DangerZoneCard from '@/components/student/settings/DangerZoneCard'
import { useStudentSession } from '@/components/student/StudentSessionContext'

export default function SettingsPage() {
  useStudentSession()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(false)
  }, [])

  const handleDeleteAccount = async () => {
    // Deletion must remove every first-party learning record atomically. It
    // remains unavailable until the learning-data cutover is complete rather
    // than accidentally calling the retired Supabase endpoint.
    throw new Error('Удаление аккаунта станет доступно после переноса учебных данных. Пока обратитесь в поддержку.')
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FAF8FF', fontFamily: 'Inter, sans-serif' }}>
        <div style={{ color: '#9CA3AF', fontSize: 14 }}>Загрузка...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FAF8FF]">
      <div className="mx-auto max-w-2xl space-y-5 px-4 py-6 sm:px-6">
        <h1 className="text-xl font-bold text-[#191B23]">Настройки</h1>

        <SettingsNotifications />
        <SettingsInstallCard />
        <DangerZoneCard onDeleteAccount={handleDeleteAccount} />
      </div>
    </div>
  )
}
