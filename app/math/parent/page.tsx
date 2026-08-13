'use client'

import RoleMigrationWorkspace from '@/components/workspaces/RoleMigrationWorkspace'

export const dynamic = 'force-dynamic'

export default function MathParentPage() {
  return <RoleMigrationWorkspace
    expectedRole="math_parent"
    surface="platform"
    title="Кабинет родителя"
    description="Связь с учеником и проверенный прогресс математической программы переносятся на собственную базу Zhangak."
    capabilities={['Связанные ученики', 'Прогресс и посещение', 'Результаты программы', 'Уведомления']}
  />
}
