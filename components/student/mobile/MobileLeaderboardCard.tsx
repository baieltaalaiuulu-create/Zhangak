'use client'

import Link from 'next/link'
import { Trophy } from 'lucide-react'

interface Props {
  rank: number
  inTopTen: boolean
  xpToNextRank: number | null
  href: string
}

export default function MobileLeaderboardCard({ rank, inTopTen, xpToNextRank, href }: Props) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <p className="flex items-center gap-2 text-sm font-bold text-[#191B23]"><Trophy size={18} className="text-amber-500" aria-hidden="true" /> Ты на #{rank} месте</p>
      <p className="mt-1 text-xs text-gray-500">
        {inTopTen
          ? 'Ты в ТОП-10!'
          : xpToNextRank != null
            ? `До ТОП-10: ${xpToNextRank} XP`
            : 'Зарабатывай XP, чтобы попасть в топ'}
      </p>
      <Link href={href} className="mt-2 inline-block text-xs font-semibold text-[#1B4FD8]">
        Смотреть рейтинг →
      </Link>
    </div>
  )
}
