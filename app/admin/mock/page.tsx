import AdminMigrationNotice from '@/components/admin/AdminMigrationNotice'

export const dynamic = 'force-dynamic'

export default function AdminMockPage() {
  return (
    <AdminMigrationNotice
      title="Пробный ОРТ"
      description="Сессии пробного ОРТ требуют отдельной модели расписаний, публикации и результатов. До её появления старые сессии отключены."
      plannedCapabilities={[
        'Создание сессии с датой, временем и правилами доступа.',
        'Публикация только проверенного набора заданий.',
        'Серверный подсчёт результатов и защищённые итоги.',
        'Журнал изменений расписания и состава теста.',
      ]}
    />
  )
}
