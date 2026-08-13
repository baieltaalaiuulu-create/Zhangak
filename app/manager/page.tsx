'use client'

import RoleMigrationWorkspace from '@/components/workspaces/RoleMigrationWorkspace'

export const dynamic = 'force-dynamic'

export default function ManagerPage() {
  return <RoleMigrationWorkspace
    expectedRole="manager"
    surface="admin"
    title="Рабочее место менеджера"
    description="CRM и коммуникации с заявками переносятся на защищённые сервисы Zhangak."
    capabilities={['Заявки и статусы', 'Карточка обращения', 'История коммуникации', 'Проверенная аналитика']}
  />
}
