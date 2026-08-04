interface Props {
  firstName: string
  remaining: number
  streak: number
  ctaHref: string
}

function streakWord(n: number): string {
  return n === 1 ? 'день' : n < 5 ? 'дня' : 'дней'
}

function greetingForHour(hour: number): string {
  if (hour < 12) return 'Доброе утро'
  if (hour < 17) return 'Добрый день'
  return 'Добрый вечер'
}

export default function DashboardHero({ firstName, remaining, streak, ctaHref }: Props) {
  const greeting = greetingForHour(new Date().getHours())

  return (
    <div
      className="rounded-2xl border border-[#C3C6D7]/30 p-6 sm:p-8"
      style={{ background: 'linear-gradient(135deg, #EEF2FF 0%, #FFFFFF 100%)' }}
    >
      <div className="flex flex-wrap items-center justify-between gap-6">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-[#191B23]">{greeting}, {firstName} 👋</h1>
          <p className="mt-2 text-lg font-semibold text-gray-600">
            {remaining > 0 ? (
              <>До цели осталось <span className="text-[#1B4FD8]">{remaining} баллов</span></>
            ) : (
              <span className="text-[#1B4FD8]">Цель достигнута! 🎯</span>
            )}
          </p>
          {streak > 0 && (
            <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-orange-50 px-3 py-1.5 text-sm font-semibold text-orange-600">
              🔥 {streak} {streakWord(streak)} подряд
            </span>
          )}
        </div>
        <a
          href={ctaHref}
          className="whitespace-nowrap rounded-xl bg-[#1B4FD8] px-6 py-3 text-sm font-bold text-white shadow-md shadow-blue-200 transition-colors hover:bg-blue-700"
        >
          Продолжить обучение →
        </a>
      </div>
    </div>
  )
}
