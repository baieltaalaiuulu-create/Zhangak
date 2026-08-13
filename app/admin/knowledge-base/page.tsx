import AdminMigrationNotice from '@/components/admin/AdminMigrationNotice'

export const dynamic = 'force-dynamic'

export default function AdminKnowledgeBasePage() {
  return (
    <AdminMigrationNotice
      title="База знаний AI"
      description="Материалы для AI-коуча будут включены только после переноса источников, прав доступа и журнала редакторских действий в собственную базу."
      plannedCapabilities={[
        'Проверенные источники с автором, статусом и версией.',
        'Разделение прав на просмотр, редактирование и публикацию.',
        'Контроль состава контекста перед использованием AI.',
        'История изменений и отзыв устаревшего материала.',
      ]}
    />
  )
}
