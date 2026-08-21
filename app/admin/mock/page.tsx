import AdminAssessmentWorkspace from '@/components/admin/AdminAssessmentWorkspace'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default function AdminMockPage() {
  return <><div className="mx-auto max-w-7xl px-4 pt-4 sm:px-6"><Link href="/admin/mock/schedule" className="inline-flex min-h-11 items-center rounded-xl bg-[#1B3F92] px-4 text-sm font-bold text-white shadow-sm">Расписание очных пробных ОРТ</Link></div><AdminAssessmentWorkspace kind="mock" /></>
}
