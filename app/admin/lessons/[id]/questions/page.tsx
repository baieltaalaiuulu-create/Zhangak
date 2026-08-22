'use client'

export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import AdminAssessmentWorkspace from '@/components/admin/AdminAssessmentWorkspace'

/**
 * Lesson-scoped question editor.
 *
 * This route used to render a "редактор переносится" notice, which was true
 * when question CRUD had no server-side validation or audit trail. It has
 * both now, so the lesson entry point opens the same workspace the `/admin/questions`
 * section uses, already scoped to this lesson. Keeping one editor means the
 * answer-key boundary, the archive guard and the audit trail cannot drift
 * between two implementations.
 */
export default function AdminLessonQuestionsPage() {
  const params = useParams<{ id: string }>()
  const lessonId = Number(params.id)
  if (!Number.isSafeInteger(lessonId) || lessonId < 1) {
    return (
      <div className="min-h-screen bg-[#FAF8FF] p-6">
        <p role="alert" className="text-sm font-semibold text-red-600">Некорректный идентификатор урока.</p>
        <Link href="/admin/lessons" className="mt-3 inline-flex min-h-11 items-center gap-1.5 text-sm font-bold text-[#1B3F92]">
          <ArrowLeft size={16} aria-hidden="true" /> Назад к урокам
        </Link>
      </div>
    )
  }
  return <AdminAssessmentWorkspace kind="questions" lessonId={lessonId} />
}
