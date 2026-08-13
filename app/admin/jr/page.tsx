'use client'

import RoleMigrationWorkspace from '@/components/workspaces/RoleMigrationWorkspace'

export const dynamic = 'force-dynamic'

export default function JuniorAdminPage() {
  return <RoleMigrationWorkspace
    expectedRole="admin_jr"
    surface="admin"
    title="Кабинет младшего администратора"
    description="Работа с учениками и учебным контентом переносится на собственный административный контур Zhangak."
    capabilities={['Назначенные ученики', 'Учебный контент', 'Проверенные результаты', 'История действий']}
  />
}
