import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { StudentSidebar } from '@/components/student/StudentSidebar'
import { MobileNav } from '@/components/student/MobileNav'
import { NotificationBell } from '@/components/student/NotificationBell'

export const metadata = {
  title: 'Кабинет ученика — ZHANGAK',
  description: 'Личный кабинет ученика платформы ZHANGAK',
}

export default async function StudentDashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createServerClient()

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession()

  if (!session || sessionError) {
    redirect('/auth/login?reason=unauthenticated')
  }

  // Проверка роли — студент не должен попасть в admin
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, full_name, avatar_url')
    .eq('id', session.user.id)
    .single()

  if (profileError || !profile) {
    redirect('/auth/login?reason=profile_not_found')
  }

  if (profile.role !== 'student_online' && profile.role !== 'student_offline') {
    redirect('/unauthorized')
  }

  return (
    <div className="min-h-screen bg-[#F5F5F7]">
      {/* Desktop Sidebar */}
      <StudentSidebar profile={profile} />

      {/* Main Content */}
      <div className="lg:ml-64 min-h-screen">
        {/* Top Header — mobile */}
        <header className="lg:hidden sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-gray-200/60 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-[#0071E3]">ZHANGAK</span>
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell userId={session.user.id} />
            <MobileNav />
          </div>
        </header>

        {/* Page Content */}
        <main className="px-4 py-6 lg:px-8 lg:py-8 pb-24 lg:pb-8">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileNav variant="bottom" />
    </div>
  )
}