'use client'

import RoleMigrationWorkspace from '@/components/workspaces/RoleMigrationWorkspace'

export const dynamic = 'force-dynamic'

export default function MathStudentPage() {
  return <RoleMigrationWorkspace
    expectedRole="math_student"
    surface="platform"
    title="Математическая программа"
    description="Уроки, задания и результаты математической программы переносятся на собственный учебный контур Zhangak."
    capabilities={['Программа уроков', 'Безопасные попытки тестов', 'Прогресс ученика', 'Материалы занятий']}
  />
}
