import AdminMigrationNotice from '@/components/admin/AdminMigrationNotice'

export const dynamic = 'force-dynamic'

export default function AdminUniversitiesPage() {
  return (
    <AdminMigrationNotice
      title="Университеты"
      description="Каталог университетов переносится на собственную проверяемую модель. До загрузки и проверки реальных данных старый каталог не показывается."
      plannedCapabilities={[
        'Карточки университетов с источником и датой проверки.',
        'Специальности, требования и статусы публикации.',
        'Проверка ссылок и ограничение прав редактора.',
        'История изменений для редакционных данных.',
      ]}
    />
  )
}
