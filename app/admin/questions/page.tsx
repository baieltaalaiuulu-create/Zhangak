import AdminMigrationNotice from '@/components/admin/AdminMigrationNotice'

export const dynamic = 'force-dynamic'

export default function AdminQuestionsPage() {
  return (
    <AdminMigrationNotice
      title="Вопросы"
      description="Общий редактор вопросов ждёт собственную модель заданий и серверную валидацию. Старые варианты и ответы намеренно не показываются."
      plannedCapabilities={[
        'Единый каталог вопросов с предметами, темами и уровнями.',
        'Проверка формулировок, вариантов и допустимых вложений.',
        'Версионирование заданий без изменения завершённых попыток.',
        'Доступ редактора только к разрешённым учебным материалам.',
      ]}
    />
  )
}
