import AdminMigrationNotice from '@/components/admin/AdminMigrationNotice'

export const dynamic = 'force-dynamic'

export default function AdminDailyChallengePage() {
  return (
    <AdminMigrationNotice
      title="Задание дня"
      description="Расписание ежедневных заданий и их публикация будут включены после переноса на собственные таблицы и правила доступа. Сейчас старый контент отключён."
      plannedCapabilities={[
        'Планирование задания с датой и безопасным статусом публикации.',
        'Проверенные вопросы без выдачи правильных ответов в браузер.',
        'Ограничение одной попытки и серверный подсчёт результата.',
        'История публикаций и отмен для администратора.',
      ]}
    />
  )
}
