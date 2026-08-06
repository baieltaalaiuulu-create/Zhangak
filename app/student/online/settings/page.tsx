'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import SettingsNotifications from '@/components/student/settings/SettingsNotifications'
import DangerZoneCard from '@/components/student/settings/DangerZoneCard'

export default function SettingsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, student_type')
        .eq('id', user.id)
        .single()

      if (!profile || profile.role !== 'student') { router.push('/login'); return }
      if (profile.student_type === 'offline') { router.push('/student'); return }

      setLoading(false)
    }
    checkAuth()
  }, [router])

  const handleDeleteAccount = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('Не авторизован')

    const res = await fetch('/api/delete-own-account', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    const data = await res.json()
    if (!res.ok || data.error) throw new Error(data.error ?? 'Failed to delete account')

    await supabase.auth.signOut()
    router.push('/')
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
        <DangerZoneCard onDeleteAccount={handleDeleteAccount} />
      </div>
    </div>
  )
}
