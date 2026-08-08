import type { ReactNode } from 'react'
import { getProbability, type University } from '@/lib/universities-data'

interface Props {
  universities: University[] // exactly the ones to compare, current first
  studentScore: number
}

function formatCost(cost: number | null): string {
  return cost == null ? 'Бесплатно' : `${cost.toLocaleString('ru')} сом`
}

const PROBABILITY_EMOJI: Record<'high' | 'medium' | 'low', string> = { high: '🟢', medium: '🟡', low: '🔴' }

export default function ComparisonTable({ universities, studentScore }: Props) {
  const rows: { label: string; render: (u: University) => ReactNode }[] = [
    { label: 'Проходной балл', render: u => u.minScore },
    { label: 'Стоимость', render: u => formatCost(u.costFrom) },
    { label: 'Общежитие', render: u => (u.hasDormitory ? 'Есть' : 'Нет') },
    { label: 'Язык', render: u => u.languages.map(l => l.toUpperCase()).join(', ') },
    { label: 'Специальностей', render: u => u.specialtyCount },
    {
      label: 'Твой шанс',
      render: u => {
        const p = getProbability(studentScore, u.minScore)
        return <span className="whitespace-nowrap">{PROBABILITY_EMOJI[p.level]} {p.label}</span>
      },
    },
  ]

  return (
    <div id="comparison" className="overflow-x-auto rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-bold text-gray-900">Сравнение университетов</h3>
      <table className="mt-4 w-full min-w-[480px] text-left text-sm">
        <thead>
          <tr className="border-b border-gray-100 text-xs font-semibold uppercase tracking-wide text-gray-400">
            <th className="px-3 py-2">Параметр</th>
            {universities.map(u => (
              <th key={u.id} className="px-3 py-2">{u.shortName}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {rows.map(row => (
            <tr key={row.label}>
              <td className="px-3 py-2.5 font-semibold text-gray-600">{row.label}</td>
              {universities.map(u => (
                <td key={u.id} className="px-3 py-2.5 text-gray-800">{row.render(u)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
