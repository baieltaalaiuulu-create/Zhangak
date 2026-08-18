import AdminMigrationNotice from '@/components/admin/AdminMigrationNotice'

export const dynamic = 'force-dynamic'

export default function AdminAnnouncementsPage() {
  return (
    <AdminMigrationNotice
      title="Объявления"
      description="Объявления и аудитория получателей переносятся на собственный backend вместе с правилами публикации и журналом доставки. Старые сообщения отключены."
      plannedCapabilities={[
        'Черновики, публикация и срок действия объявления.',
        'Проверка аудитории без раскрытия лишних данных.',
        'Права автора и согласование перед отправкой.',
        'Журнал доставки, отмены и изменения сообщения.',
      ]}
    />
  )
}
