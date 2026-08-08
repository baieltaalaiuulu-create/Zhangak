import type { Achievement } from '@/lib/dashboard-data'

interface Props {
  achievements: Achievement[]
}

export default function RecentAchievementsCard({ achievements }: Props) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-bold text-gray-900">Последние достижения</h3>

      {achievements.length === 0 ? (
        <p className="mt-4 text-center text-xs text-gray-400">Пройди первый урок или практику, чтобы получить достижение!</p>
      ) : (
        <div className="mt-4 space-y-3">
          {achievements.map((a, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-50 text-lg">
                {a.icon}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold text-gray-900">{a.title}</p>
                <p className="text-xs text-gray-400">{a.subtitle}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
