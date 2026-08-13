import AdminMigrationNotice from '@/components/admin/AdminMigrationNotice'

export const dynamic = 'force-dynamic'

export default function AdminPracticePage() {
  return (
    <AdminMigrationNotice
      title="Практика"
      description="Банк вопросов и тесты к урокам переносятся в собственный учебный контур. До завершения переноса этот раздел не читает и не меняет старые данные."
      plannedCapabilities={[
        'Банк вопросов с проверкой структуры и истории изменений.',
        'Тесты, связанные только с опубликованными уроками.',
        'Серверная проверка ответов без ключей в браузере.',
        'Права редактора и журнал действий администратора.',
      ]}
    />
  )
}
