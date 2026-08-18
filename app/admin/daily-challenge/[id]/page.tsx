import AdminMigrationNotice from '@/components/admin/AdminMigrationNotice'

export const dynamic = 'force-dynamic'

export default function AdminDailyChallengeDetailPage() {
  return (
    <AdminMigrationNotice
      title="Настройка задания дня"
      description="Карточка ежедневного задания переносится вместе с календарём, вопросами и правилами публикации. Непроверенная старая карточка не открывается."
      plannedCapabilities={[
        'Редактирование черновика до публикации.',
        'Контроль вопросов и лимитов попыток на сервере.',
        'Безопасный предпросмотр для администратора.',
        'Аудит публикации, изменения и отмены задания.',
      ]}
    />
  )
}
