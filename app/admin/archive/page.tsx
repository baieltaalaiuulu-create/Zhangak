import AdminMigrationNotice from '@/components/admin/AdminMigrationNotice'

export const dynamic = 'force-dynamic'

export default function AdminArchivePage() {
  return (
    <AdminMigrationNotice
      title="Архив"
      description="Архивные карточки учеников требуют правил хранения, срока доступа и регистрации просмотров. Пока они не перенесены, старый архив отключён."
      plannedCapabilities={[
        'Архив с правилами срока хранения и восстановления.',
        'Поиск только по разрешённым полям учётной записи.',
        'Контроль доступа к персональным данным.',
        'Журнал просмотра и изменения архивной записи.',
      ]}
    />
  )
}
