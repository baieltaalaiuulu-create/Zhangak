import { DIRECTION_LABELS, LANGUAGE_LABELS, type City, type Direction, type StudyLanguage, type UniversityType } from '@/lib/universities-data'

export interface FilterState {
  city: City | 'all'
  direction: Direction | 'all'
  language: StudyLanguage | 'all'
  type: UniversityType | 'all'
  maxMinScore: number   // "show universities requiring at most this many points"
  maxCost: number        // "show universities costing at most this much per year"
  dormitoryOnly: boolean
  budgetOnly: boolean
}

export const SCORE_RANGE: [number, number] = [110, 245]
export const COST_RANGE: [number, number] = [25000, 180000]

export const DEFAULT_FILTERS: FilterState = {
  city: 'all',
  direction: 'all',
  language: 'all',
  type: 'all',
  maxMinScore: SCORE_RANGE[1],
  maxCost: COST_RANGE[1],
  dormitoryOnly: false,
  budgetOnly: false,
}

interface Props {
  filters: FilterState
  onChange: (next: FilterState) => void
}

const CITIES: (City | 'all')[] = ['all', 'Бишкек', 'Ош', 'Каракол']
const DIRECTIONS: (Direction | 'all')[] = ['all', 'it', 'medicine', 'economics', 'law', 'pedagogy']
const LANGUAGES: (StudyLanguage | 'all')[] = ['all', 'ru', 'kg', 'tr', 'en']

function SelectField({ label, value, options, labels, onChange }: {
  label: string
  value: string
  options: string[]
  labels: Record<string, string>
  onChange: (v: string) => void
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-gray-500">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-[#6C3DE0]/20"
      >
        {options.map(o => (
          <option key={o} value={o}>{labels[o]}</option>
        ))}
      </select>
    </div>
  )
}

export default function UniversitiesFilters({ filters, onChange }: Props) {
  const set = <K extends keyof FilterState>(key: K, value: FilterState[K]) => onChange({ ...filters, [key]: value })

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-900">Фильтры</h3>
        <button
          type="button"
          onClick={() => onChange(DEFAULT_FILTERS)}
          className="text-xs font-semibold text-gray-400 hover:text-[#6C3DE0]"
        >
          Сбросить фильтры
        </button>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SelectField
          label="Город"
          value={filters.city}
          options={CITIES}
          labels={{ all: 'Все города', 'Бишкек': 'Бишкек', 'Ош': 'Ош', 'Каракол': 'Каракол' }}
          onChange={v => set('city', v as FilterState['city'])}
        />
        <SelectField
          label="Направление"
          value={filters.direction}
          options={DIRECTIONS}
          labels={{ all: 'Все направления', ...DIRECTION_LABELS }}
          onChange={v => set('direction', v as FilterState['direction'])}
        />
        <SelectField
          label="Язык обучения"
          value={filters.language}
          options={LANGUAGES}
          labels={{ all: 'Любой язык', ...LANGUAGE_LABELS }}
          onChange={v => set('language', v as FilterState['language'])}
        />

        <div>
          <label className="mb-1 block text-xs font-semibold text-gray-500">Тип вуза</label>
          <div className="grid grid-cols-3 gap-1.5">
            {(['all', 'state', 'private'] as const).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => set('type', t)}
                className={`rounded-lg px-1 py-2 text-[11px] font-semibold transition-colors ${
                  filters.type === t ? 'bg-[#6C3DE0] text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                }`}
              >
                {t === 'all' ? 'Все' : t === 'state' ? 'Гос.' : 'Частн.'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 flex items-center justify-between text-xs font-semibold text-gray-500">
            <span>Проходной балл ОРТ</span>
            <span className="text-gray-700">до {filters.maxMinScore}</span>
          </label>
          <input
            type="range"
            min={SCORE_RANGE[0]}
            max={SCORE_RANGE[1]}
            value={filters.maxMinScore}
            onChange={e => set('maxMinScore', Number(e.target.value))}
            className="h-1.5 w-full accent-[#6C3DE0]"
          />
          <div className="flex justify-between text-[10px] text-gray-400">
            <span>{SCORE_RANGE[0]}</span>
            <span>{SCORE_RANGE[1]}</span>
          </div>
        </div>

        <div>
          <label className="mb-1 flex items-center justify-between text-xs font-semibold text-gray-500">
            <span>Стоимость обучения</span>
            <span className="text-gray-700">до {Math.round(filters.maxCost / 1000)}k сом</span>
          </label>
          <input
            type="range"
            min={COST_RANGE[0]}
            max={COST_RANGE[1]}
            step={5000}
            value={filters.maxCost}
            onChange={e => set('maxCost', Number(e.target.value))}
            className="h-1.5 w-full accent-[#6C3DE0]"
          />
          <div className="flex justify-between text-[10px] text-gray-400">
            <span>{Math.round(COST_RANGE[0] / 1000)}k</span>
            <span>{Math.round(COST_RANGE[1] / 1000)}k</span>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-sm font-medium text-gray-600">
          <input
            type="checkbox"
            checked={filters.dormitoryOnly}
            onChange={e => set('dormitoryOnly', e.target.checked)}
            className="h-4 w-4 rounded accent-[#6C3DE0]"
          />
          Общежитие
        </label>
        <label className="flex items-center gap-2 text-sm font-medium text-gray-600">
          <input
            type="checkbox"
            checked={filters.budgetOnly}
            onChange={e => set('budgetOnly', e.target.checked)}
            className="h-4 w-4 rounded accent-[#6C3DE0]"
          />
          Бюджетные места
        </label>
      </div>
    </div>
  )
}
