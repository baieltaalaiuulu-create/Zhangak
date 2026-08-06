'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { TrendingUp, BarChart2 } from 'lucide-react'
import type { ScorePoint } from '@/lib/profile-data'
import type { WeakSection } from '@/lib/ai-coach-data'

interface Props {
  scoreHistory: ScorePoint[]
  sections: WeakSection[]
  targetScore: number
}

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })
}

export default function AIAnalytics({ scoreHistory, sections, targetScore }: Props) {
  const chartData = scoreHistory.map(p => ({ label: formatDay(p.completedAt), score: p.score }))
  const bySuccess = [...sections].sort((a, b) => {
    const ratioA = a.correctCount / (a.correctCount + a.wrongCount || 1)
    const ratioB = b.correctCount / (b.correctCount + b.wrongCount || 1)
    return ratioB - ratioA
  })

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        <div className="flex items-center gap-2 text-sm font-bold text-[#191B23]">
          <TrendingUp size={16} className="text-[#1B4FD8]" /> Динамика балла
        </div>
        <div className="mt-4 h-64">
          {chartData.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-gray-400">
              Пройди пробный ОРТ, чтобы увидеть динамику
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0F1F5" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 245]} tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} width={32} />
                <Tooltip
                  contentStyle={{ borderRadius: 10, border: '1px solid #E5E7EB', fontSize: 12 }}
                  labelStyle={{ fontWeight: 700, color: '#191B23' }}
                  formatter={value => [`${value}`, 'Балл']}
                />
                <ReferenceLine y={targetScore} stroke="#10B981" strokeDasharray="4 4" label={{ value: 'Цель', position: 'insideTopRight', fill: '#10B981', fontSize: 11, fontWeight: 700 }} />
                <Line type="monotone" dataKey="score" stroke="#1B4FD8" strokeWidth={2.5} dot={{ r: 4, fill: '#1B4FD8' }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        <div className="flex items-center gap-2 text-sm font-bold text-[#191B23]">
          <BarChart2 size={16} className="text-[#1B4FD8]" /> Прогресс по разделам
        </div>
        {bySuccess.length === 0 ? (
          <div className="mt-4 text-center text-sm text-gray-400">Пока нет данных по разделам</div>
        ) : (
          <div className="mt-4 space-y-4">
            {bySuccess.map(s => {
              const total = s.correctCount + s.wrongCount
              const pct = total > 0 ? Math.round((s.correctCount / total) * 100) : 0
              return (
                <div key={s.section}>
                  <div className="flex items-center justify-between text-xs font-semibold text-gray-500">
                    <span>{s.label}</span>
                    <span className="text-[#191B23]">{pct}% ({s.correctCount}/{total})</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-gray-100">
                    <div
                      className={`h-2 rounded-full ${pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-amber-500' : 'bg-red-500'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
