'use client'

import { PlayCircle, PencilLine, ClipboardCheck, CheckCircle2, Circle } from 'lucide-react'

export interface DailyTask {
  id: string
  label: string
  icon: 'play' | 'pencil' | 'clipboard'
  done: boolean
}

interface DailyPlanCardProps {
  tasks: DailyTask[]
}

const ICONS = { play: PlayCircle, pencil: PencilLine, clipboard: ClipboardCheck }

export default function DailyPlanCard({ tasks }: DailyPlanCardProps) {
  const total = tasks.length
  const done = tasks.filter(t => t.done).length
  const pct = total > 0 ? done / total : 0

  const size = 56
  const stroke = 6
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - pct)

  return (
    <div id="daily-plan" style={{
      background: '#fff',
      borderRadius: '16px',
      border: '1px solid #F1F3F7',
      boxShadow: '0 1px 3px rgba(13,30,74,0.04)',
      padding: '22px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: '15px', color: '#0D1E4A' }}>План на сегодня</div>
          <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '2px' }}>{done}/{total} задач выполнено</div>
        </div>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
          <circle cx={size / 2} cy={size / 2} r={radius} stroke="#EEF1F6" strokeWidth={stroke} fill="none" />
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            stroke="#1B4FD8" strokeWidth={stroke} fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.6s ease' }}
          />
        </svg>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {tasks.map(task => {
          const Icon = ICONS[task.icon]
          return (
            <div key={task.id} style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              padding: '11px 12px',
              borderRadius: '11px',
              background: task.done ? '#F0FDF4' : '#FAFBFC',
              border: `1px solid ${task.done ? '#D3F5DE' : '#F1F3F7'}`,
            }}>
              <Icon size={18} color={task.done ? '#10B981' : '#1B4FD8'} style={{ flexShrink: 0 }} />
              <span style={{
                flex: 1, minWidth: 0, fontSize: '13px', fontWeight: 600,
                color: task.done ? '#94A3B8' : '#0D1E4A',
                textDecoration: task.done ? 'line-through' : 'none',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {task.label}
              </span>
              {task.done ? <CheckCircle2 size={18} color="#10B981" style={{ flexShrink: 0 }} /> : <Circle size={18} color="#CBD5E1" style={{ flexShrink: 0 }} />}
            </div>
          )
        })}
        {total === 0 && (
          <div style={{ fontSize: '12px', color: '#94A3B8', textAlign: 'center', padding: '12px 0' }}>
            Задач на сегодня нет
          </div>
        )}
      </div>
    </div>
  )
}
