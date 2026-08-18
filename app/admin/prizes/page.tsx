import AdminMigrationNotice from '@/components/admin/AdminMigrationNotice'

export const dynamic = 'force-dynamic'

export default function AdminPrizesPage() {
  return (
    <AdminMigrationNotice
      title="Рейтинг и призы"
      description="Рейтинг и выдача призов зависят от серверно проверенных попыток и правил приватности. Пока этих правил нет в новом контуре, старые места и призы не отображаются."
      plannedCapabilities={[
        'Рейтинг только по проверенным сервером результатам.',
        'Прозрачные правила периода и участия.',
        'Учёт призов с правами доступа и историей статусов.',
        'Безопасное хранение изображений и подтверждений выдачи.',
      ]}
    />
  )
}
