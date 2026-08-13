'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { AlertCircle, LoaderCircle, RefreshCw } from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'

import { getCurrentZhangakUser } from '@/lib/zhangak-auth-client'
import AdminSidebar from './AdminSidebar'

interface Props {
  children: ReactNode
}

const FULL_ADMIN_ROLES = new Set(['admin', 'super_admin'])

export default function AdminLayout({ children }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const [checked, setChecked] = useState(false)
  const [isJuniorAdmin, setIsJuniorAdmin] = useState(false)
  const [serviceError, setServiceError] = useState(false)
  const [attempt, setAttempt] = useState(0)

  const retry = useCallback(() => {
    setChecked(false)
    setServiceError(false)
    setAttempt(value => value + 1)
  }, [])

  useEffect(() => {
    let active = true

    const checkAuth = async () => {
      try {
        const user = await getCurrentZhangakUser()
        if (!active) return
        if (!user) { router.replace('/login'); return }

        if (user.role === 'admin_jr') {
          const isJuniorArea = pathname === '/admin/jr' || pathname.startsWith('/admin/jr/')
          if (!isJuniorArea) { router.replace('/admin/jr'); return }
          setIsJuniorAdmin(true)
          setChecked(true)
          return
        }

        if (user.role === 'student' || user.role === 'teacher' || user.role === 'math_student' || user.role === 'math_parent') {
          window.location.assign(process.env.NODE_ENV === 'production'
            ? 'https://platform.zhangak.com/login'
            : '/login?surface=platform')
          return
        }

        if (!FULL_ADMIN_ROLES.has(user.role)) {
          router.replace('/login')
          return
        }

        setIsJuniorAdmin(false)
        setChecked(true)
      } catch {
        if (active) setServiceError(true)
      }
    }

    void checkAuth()
    return () => { active = false }
  }, [attempt, pathname, router])

  if (serviceError) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-[#F4F6FA] px-5">
        <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 text-center shadow-sm">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600">
            <AlertCircle size={23} aria-hidden="true" />
          </span>
          <h1 className="mt-4 text-xl font-black text-[#0D1E4A]">Не удалось проверить доступ</h1>
          <p className="mt-2 text-sm font-medium leading-6 text-slate-500">Панель остаётся закрытой. Проверьте соединение и повторите попытку.</p>
          <button type="button" onClick={retry} className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#0D1E4A] px-4 text-sm font-extrabold text-white">
            <RefreshCw size={17} aria-hidden="true" />
            Повторить
          </button>
        </div>
      </main>
    )
  }

  if (!checked) return (
    <main className="flex min-h-dvh items-center justify-center bg-[#F4F6FA] px-5">
      <div role="status" className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-semibold text-slate-600 shadow-sm">
        <LoaderCircle size={19} className="animate-spin text-[#1B3F92]" aria-hidden="true" />
        Проверяем права доступа…
      </div>
    </main>
  )

  if (isJuniorAdmin) return <>{children}</>

  return (
    <div className="min-h-screen bg-[#F4F6FA]">
      <AdminSidebar />
      <div className="lg:ml-64 print:ml-0">{children}</div>
    </div>
  )
}
