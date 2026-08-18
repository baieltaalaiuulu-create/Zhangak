import AdminMigrationNotice from '@/components/admin/AdminMigrationNotice'

export const dynamic = 'force-dynamic'

export default function AdminArchiveDetailPage() {
  return (
    <AdminMigrationNotice
      title="Архивная карточка"
      description="Детальная архивная карточка не открывается до переноса правил приватности и срока хранения в собственную систему."
      plannedCapabilities={[
        'Выдача только разрешённых полей архивной записи.',
        'Проверка роли перед каждым просмотром карточки.',
        'Отдельные правила восстановления и удаления.',
        'Полный журнал доступа к персональным данным.',
      ]}
    />
  )
}
