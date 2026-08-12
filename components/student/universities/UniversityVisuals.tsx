import {
  BriefcaseBusiness,
  Building2,
  CircleAlert,
  CircleHelp,
  GraduationCap,
  Library,
  School,
  ShieldCheck,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react'
import type { Advantage, UniversityType } from '@/lib/universities-data'
import type { AdmissionProbability } from '@/lib/university-matching'

export function UniversityTypeIcon({ type, size = 22 }: { type: UniversityType; size?: number }) {
  const Icon = type === 'state' ? School : Building2
  return <Icon size={size} aria-hidden="true" />
}

const PROBABILITY_META: Record<AdmissionProbability['level'], { icon: LucideIcon; className: string }> = {
  high: { icon: ShieldCheck, className: 'bg-green-50 text-green-700' },
  medium: { icon: CircleAlert, className: 'bg-amber-50 text-amber-700' },
  low: { icon: TrendingUp, className: 'bg-red-50 text-red-700' },
  unknown: { icon: CircleHelp, className: 'bg-gray-100 text-gray-600' },
}

export function AdmissionProbabilityBadge({ probability }: { probability: AdmissionProbability }) {
  const meta = PROBABILITY_META[probability.level]
  const Icon = meta.icon
  const label = probability.level === 'low'
    ? `${probability.label}: нужно ещё ${probability.pointsNeeded}`
    : probability.label

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${meta.className}`}>
      <Icon size={14} aria-hidden="true" />
      {label}
    </span>
  )
}

const ADVANTAGE_ICON: Record<Advantage['iconKey'], LucideIcon> = {
  education: GraduationCap,
  international: Library,
  career: BriefcaseBusiness,
  campus: Building2,
}

export function UniversityAdvantageIcon({ iconKey }: { iconKey: Advantage['iconKey'] }) {
  const Icon = ADVANTAGE_ICON[iconKey]
  return (
    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-[#6C3DE0]">
      <Icon size={20} aria-hidden="true" />
    </span>
  )
}
