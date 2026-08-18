import AdminMigrationNotice from '@/components/admin/AdminMigrationNotice'

export const dynamic = 'force-dynamic'

export default function AdminMockQuestionsPage() {
  return (
    <AdminMigrationNotice
      title="Вопросы пробного ОРТ"
      description="Набор вопросов конкретной сессии станет доступен после переноса пробного ОРТ на собственную модель данных. Старая связка сессии и заданий отключена."
      plannedCapabilities={[
        'Привязка вопросов к проверенной сессии пробного ОРТ.',
        'Контроль количества, порядка и предметных блоков.',
        'Публикация неизменяемой версии перед началом теста.',
        'Проверка прав администратора на каждое изменение.',
      ]}
    />
  )
}
