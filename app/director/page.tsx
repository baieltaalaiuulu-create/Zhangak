'use client'

import RoleMigrationWorkspace from '@/components/workspaces/RoleMigrationWorkspace'

export const dynamic = 'force-dynamic'

export default function DirectorPage() {
  return <RoleMigrationWorkspace
    expectedRole="director"
    surface="admin"
    title="Кабинет руководителя"
    description="Операционные показатели и сводная аналитика переносятся на собственную базу Zhangak."
    capabilities={['Сводные показатели', 'Динамика наборов', 'Проверенная отчётность', 'Управление доступом']}
  />
}
