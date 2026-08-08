'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, Cell } from 'recharts'
import type { Specialty } from '@/lib/universities-data'

interface Props {
  specialties: Specialty[]
  studentScore: number
}

export default function ScorePassingChart({ specialties, studentScore }: Props) {
  const data = specialties.map(s => ({ name: s.name, minScore: s.minScore, passes: studentScore >= s.minScore }))
  const chartHeight = Math.max(220, data.length * 56)

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-bold text-gray-900">Проходные баллы по специальностям</h3>
      <p className="mt-1 text-xs text-gray-400">Красная линия — твой текущий балл ({studentScore})</p>

      <div style={{ width: '100%', height: chartHeight }} className="mt-4">
        <ResponsiveContainer>
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 4 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F1F2F6" />
            <XAxis type="number" domain={[100, 245]} tick={{ fontSize: 11, fill: '#9CA3AF' }} />
            <YAxis type="category" dataKey="name" width={160} tick={{ fontSize: 11, fill: '#4B5563' }} />
            <Tooltip formatter={(value) => [`${value} баллов`, 'Мин. балл']} />
            <ReferenceLine x={studentScore} stroke="#EF4444" strokeWidth={2} strokeDasharray="4 4" label={{ value: 'Твой балл', position: 'top', fill: '#EF4444', fontSize: 11 }} />
            <Bar dataKey="minScore" radius={[0, 6, 6, 0]} barSize={22}>
              {data.map((d, i) => (
                <Cell key={i} fill={d.passes ? '#22C55E' : '#F5890A'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
