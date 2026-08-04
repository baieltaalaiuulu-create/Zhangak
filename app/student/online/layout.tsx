import type { ReactNode } from 'react'
import StudentLayout from '@/components/student/StudentLayout'

export const dynamic = 'force-dynamic'

export default function OnlineLayout({ children }: { children: ReactNode }) {
  return <StudentLayout>{children}</StudentLayout>
}
