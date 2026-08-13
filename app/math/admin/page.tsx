'use client'

import RoleMigrationWorkspace from '@/components/workspaces/RoleMigrationWorkspace'

export const dynamic = 'force-dynamic'

export default function MathAdminPage() {
  return <RoleMigrationWorkspace
    expectedRole="math_admin"
    surface="admin"
    title="Администрирование математики"
    description="Управление учениками, уроками и тестами математической программы переносится на собственный backend Zhangak."
    capabilities={['Ученики и родители', 'Уроки и тесты', 'Результаты обучения', 'Назначение доступа']}
  />
}
