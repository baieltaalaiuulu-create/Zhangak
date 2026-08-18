import AdminMigrationNotice from '@/components/admin/AdminMigrationNotice'

export const dynamic = 'force-dynamic'

export default function AdminAnalyticsPage() {
  return (
    <AdminMigrationNotice
      title="Аналитика"
      description="Агрегаты, экспорт и аналитические выводы будут возвращены после переноса исходных событий и правил доступа. Мы не показываем устаревшую статистику."
      plannedCapabilities={[
        'Агрегированные показатели из собственной базы данных.',
        'Разделение сводной аналитики и персональных данных.',
        'Экспорт с ограничением прав и журналом выгрузок.',
        'Проверяемые расчёты без подстановки исторических значений.',
      ]}
    />
  )
}
