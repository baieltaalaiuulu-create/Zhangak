'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import AdminSidebar from './AdminSidebar'

interface Props {
  children: ReactNode
}

export default function AdminLayout({ children }: Props) {
  const router = useRouter()
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (!profile || (profile.role !== 'super_admin' && profile.role !== 'admin')) {
        router.push('/')
        return
      }
      setChecked(true)
    }
    checkAuth()
  }, [router])

  if (!checked) return (
    <div className="flex min-h-screen items-center justify-center bg-[#FAF8FF]">
      <div className="text-sm text-gray-400">Загрузка...</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#FAF8FF]">
      <AdminSidebar />
      <div className="lg:ml-64">{children}</div>
    </div>
  )
}
