export default function StreakCard({ streak }: { streak: number }) {
  const display = Math.min(streak, 14)
  const isRisk  = streak > 0 // show reminder

  return (
    <div
      className="rounded-2xl p-5 shadow-sm"
      style={{ background: 'linear-gradient(135deg, #111827 0%, #1f2937 100%)' }}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-2xl font-bold text-white">
            🔥 {streak} {streak === 1 ? 'день' : streak < 5 ? 'дня' : 'дней'}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">подряд</p>
        </div>
        {isRisk && (
          <span className="text-xs font-semibold text-orange-400 bg-orange-400/10 px-2 py-1 rounded-full">
            Не пропусти!
          </span>
        )}
      </div>

      {/* Dot visualization */}
      <div className="flex gap-1.5 flex-wrap">
        {Array.from({ length: 14 }).map((_, i) => (
          <div
            key={i}
            className={`w-4 h-4 rounded-full transition-all ${
              i < display ? 'bg-orange-400' : 'bg-white/10'
            }`}
          />
        ))}
      </div>

      {streak === 0 && (
        <p className="text-xs text-gray-500 mt-2">Начни заниматься сегодня!</p>
      )}
    </div>
  )
}
