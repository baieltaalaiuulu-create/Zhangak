import { type Specialty } from '@/lib/universities-data'
import { getAdmissionProbability } from '@/lib/university-matching'
import { AdmissionProbabilityBadge } from './UniversityVisuals'

interface Props {
  specialties: Specialty[]
  studentScore: number | null
}

function formatCost(cost: number | null): string {
  if (cost == null) return 'Не указано'
  return cost === 0 ? 'Бесплатно' : `${cost.toLocaleString('ru')} сом`
}

export default function SpecialtiesTable({ specialties, studentScore }: Props) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead>
          <tr className="border-b border-gray-100 text-xs font-semibold uppercase tracking-wide text-gray-400">
            <th className="px-4 py-3">Название</th>
            <th className="px-4 py-3">Факультет</th>
            <th className="px-4 py-3">Мин. балл</th>
            <th className="px-4 py-3">Стоимость</th>
            <th className="px-4 py-3">Язык</th>
            <th className="px-4 py-3">Форма</th>
            <th className="px-4 py-3">Тип</th>
            <th className="px-4 py-3">Действие</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {specialties.map(s => {
            const p = getAdmissionProbability(studentScore, s.minScore)
            return (
              <tr key={s.id} className="hover:bg-gray-50/60">
                <td className="px-4 py-3 font-semibold text-gray-900">{s.name}</td>
                <td className="px-4 py-3 text-gray-500">{s.faculty}</td>
                <td className="px-4 py-3 font-bold text-gray-700">{s.minScore ?? '—'}</td>
                <td className="px-4 py-3 text-gray-500">{formatCost(s.costPerYear)}</td>
                <td className="px-4 py-3 text-gray-500">{s.language}</td>
                <td className="px-4 py-3 text-gray-500">{s.form}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${s.type === 'Бюджет' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                    {s.type}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <AdmissionProbabilityBadge probability={p} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
