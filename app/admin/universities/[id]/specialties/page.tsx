import AdminMigrationNotice from '@/components/admin/AdminMigrationNotice'

export const dynamic = 'force-dynamic'

export default function AdminUniversitySpecialtiesPage() {
  return (
    <AdminMigrationNotice
      title="Специальности университета"
      description="Специальности конкретного университета станут доступны после переноса проверяемого каталога. Старая карточка и её поля отключены."
      plannedCapabilities={[
        'Связь специальности только с существующим университетом.',
        'Проверка требований, описаний и внешних ссылок.',
        'Статусы черновика и публикации для редактора.',
        'История изменений и дата последней проверки данных.',
      ]}
    />
  )
}
