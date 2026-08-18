'use client'

import RoleMigrationWorkspace from '@/components/workspaces/RoleMigrationWorkspace'

export const dynamic = 'force-dynamic'

export default function FinancePage() {
  return <RoleMigrationWorkspace
    expectedRole="finance"
    surface="admin"
    title="Финансовый кабинет"
    description="Платежи, расходы и финансовая отчётность появятся после отдельной защищённой миграции."
    capabilities={['Платежи учеников', 'Расходы и категории', 'Периодические отчёты', 'Аудит изменений']}
  />
}
