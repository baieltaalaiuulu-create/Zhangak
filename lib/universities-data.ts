// Static catalog data — no DB table for this yet, so universities/specialties
// live here as plain data instead of being fetched. Only the student's own
// score (read from Supabase elsewhere) and their favorites (localStorage,
// same pattern as the AI Mentor's daily-plan cache) are dynamic.

export type UniversityType = 'state' | 'private'
export type City = 'Бишкек' | 'Ош' | 'Каракол'
export type Direction = 'it' | 'medicine' | 'economics' | 'law' | 'pedagogy'
export type StudyLanguage = 'ru' | 'kg' | 'tr' | 'en'

export const DIRECTION_LABELS: Record<Direction, string> = {
  it: 'IT и технологии',
  medicine: 'Медицина',
  economics: 'Экономика',
  law: 'Право',
  pedagogy: 'Педагогика',
}

export const LANGUAGE_LABELS: Record<StudyLanguage, string> = {
  ru: 'Русский',
  kg: 'Кыргызский',
  tr: 'Турецкий',
  en: 'Английский',
}

export interface Specialty {
  id: string
  name: string
  faculty: string
  minScore: number
  costPerYear: number | null // null = free
  languages: StudyLanguage[]
  form: 'Очная' | 'Заочная'
  type: 'Бюджет' | 'Контракт'
}

export interface Advantage {
  icon: string
  title: string
  description: string
}

export interface University {
  id: string
  name: string
  shortName: string
  emoji: string
  city: City
  type: UniversityType
  minScore: number
  costFrom: number | null // null = free
  specialtyCount: number
  rating: number
  description: string
  about: string[]
  advantages: Advantage[]
  hasDormitory: boolean
  budgetSeats: boolean
  directions: Direction[]
  languages: StudyLanguage[]
  website: string
  specialties: Specialty[]
  documents: string[]
  applicationDeadline: string
}

export const UNIVERSITIES: University[] = [
  {
    id: 'ktu-manas',
    name: 'Кыргызско-Турецкий университет «Манас»',
    shortName: 'КТУ «Манас»',
    emoji: '🇰🇬',
    city: 'Бишкек',
    type: 'state',
    minScore: 140,
    costFrom: null,
    specialtyCount: 24,
    rating: 4.6,
    description: 'Государственный университет с турецким участием, обучение бесплатное для прошедших по баллам ОРТ, сильные инженерные и гуманитарные программы.',
    about: [
      'КТУ «Манас» — совместный кыргызско-турецкий проект, основанный в 1997 году. Университет входит в число самых престижных государственных вузов страны и известен строгим конкурсным отбором.',
      'Обучение по большинству направлений бесплатное для студентов, прошедших по баллам ОРТ на бюджетные места — эта особенность делает университет одним из самых привлекательных для абитуриентов с высоким результатом.',
      'Кампус расположен в Бишкеке, включает современные лаборатории, спортивные объекты и общежития для иногородних студентов.',
    ],
    advantages: [
      { icon: '💰', title: 'Бесплатное обучение', description: 'Большинство мест — бюджетные, оплаченные за счёт межгосударственной программы' },
      { icon: '🌍', title: 'Международные программы', description: 'Обмен студентами с университетами Турции и Европы' },
      { icon: '🏠', title: 'Общежитие', description: 'Гарантировано для всех иногородних студентов на бюджете' },
    ],
    hasDormitory: true,
    budgetSeats: true,
    directions: ['it', 'economics', 'law', 'pedagogy'],
    languages: ['ru', 'kg', 'tr'],
    website: 'https://manas.edu.kg',
    specialties: [
      { id: 'ktu-cs', name: 'Компьютерные науки', faculty: 'Инженерный факультет', minScore: 165, costPerYear: null, languages: ['ru', 'tr'], form: 'Очная', type: 'Бюджет' },
      { id: 'ktu-econ', name: 'Экономика', faculty: 'Экономический факультет', minScore: 150, costPerYear: null, languages: ['ru', 'kg'], form: 'Очная', type: 'Бюджет' },
      { id: 'ktu-law', name: 'Юриспруденция', faculty: 'Юридический факультет', minScore: 155, costPerYear: null, languages: ['ru', 'kg'], form: 'Очная', type: 'Бюджет' },
      { id: 'ktu-ped', name: 'Дошкольное образование', faculty: 'Педагогический факультет', minScore: 140, costPerYear: null, languages: ['ru', 'kg'], form: 'Очная', type: 'Бюджет' },
      { id: 'ktu-journ', name: 'Журналистика', faculty: 'Факультет коммуникаций', minScore: 145, costPerYear: 60000, languages: ['ru', 'kg', 'tr'], form: 'Очная', type: 'Контракт' },
    ],
    documents: [
      'Аттестат о среднем образовании (оригинал)',
      'Сертификат ОРТ',
      'Копия паспорта / свидетельства о рождении',
      '6 фотографий 3×4',
      'Медицинская справка формы 086/у',
      'Заявление на имя ректора',
    ],
    applicationDeadline: 'Приём документов: 15 июня – 15 августа',
  },
  {
    id: 'krsu',
    name: 'Кыргызско-Российский Славянский университет им. Б. Ельцина',
    shortName: 'КРСУ им. Ельцина',
    emoji: '🇷🇺',
    city: 'Бишкек',
    type: 'state',
    minScore: 135,
    costFrom: 35000,
    specialtyCount: 42,
    rating: 4.4,
    description: 'Крупнейший государственный университет с российскими образовательными стандартами, дипломы государственного образца России и Кыргызстана.',
    about: [
      'КРСУ основан в 1993 году как совместный проект правительств России и Кыргызстана. Обучение ведётся по российским образовательным стандартам, выпускники получают два диплома.',
      'Университет предлагает один из самых широких выборов специальностей в стране — от медицины и IT до международных отношений и журналистики.',
      'Есть как бюджетные, так и контрактные места; стоимость контрактного обучения одна из самых доступных среди крупных вузов Бишкека.',
    ],
    advantages: [
      { icon: '🎓', title: 'Двойной диплом', description: 'Диплом государственного образца России и Кыргызстана' },
      { icon: '🏥', title: 'Медицинский факультет', description: 'Один из сильнейших в стране, собственная клиническая база' },
      { icon: '🏠', title: 'Общежитие', description: 'Несколько корпусов общежития рядом с кампусом' },
    ],
    hasDormitory: true,
    budgetSeats: true,
    directions: ['medicine', 'it', 'economics', 'law'],
    languages: ['ru'],
    website: 'https://krsu.edu.kg',
    specialties: [
      { id: 'krsu-med', name: 'Лечебное дело', faculty: 'Медицинский факультет', minScore: 180, costPerYear: 120000, languages: ['ru'], form: 'Очная', type: 'Контракт' },
      { id: 'krsu-cs', name: 'Программная инженерия', faculty: 'Физико-технический факультет', minScore: 150, costPerYear: 55000, languages: ['ru'], form: 'Очная', type: 'Контракт' },
      { id: 'krsu-econ', name: 'Экономика и управление', faculty: 'Экономический факультет', minScore: 135, costPerYear: 40000, languages: ['ru'], form: 'Очная', type: 'Контракт' },
      { id: 'krsu-law', name: 'Юриспруденция', faculty: 'Юридический факультет', minScore: 145, costPerYear: 45000, languages: ['ru'], form: 'Очная', type: 'Контракт' },
      { id: 'krsu-ir', name: 'Международные отношения', faculty: 'Факультет международных отношений', minScore: 155, costPerYear: 50000, languages: ['ru'], form: 'Очная', type: 'Контракт' },
    ],
    documents: [
      'Аттестат о среднем образовании (оригинал)',
      'Сертификат ОРТ',
      'Копия паспорта',
      '6 фотографий 3×4',
      'Медицинская справка формы 086/у',
      'Договор на обучение (для контрактных мест)',
    ],
    applicationDeadline: 'Приём документов: 20 июня – 25 августа',
  },
  {
    id: 'auca',
    name: 'Американский университет в Центральной Азии',
    shortName: 'АУЦА (AUCA)',
    emoji: '🇺🇸',
    city: 'Бишкек',
    type: 'private',
    minScore: 150,
    costFrom: 180000,
    specialtyCount: 15,
    rating: 4.8,
    description: 'Частный университет по американской модели либерального образования, обучение преимущественно на английском языке, высокий уровень трудоустройства выпускников.',
    about: [
      'АУЦА — один из самых престижных частных университетов Центральной Азии, работающий по модели liberal arts. Большинство курсов преподаётся на английском языке.',
      'Университет известен небольшими группами, сильным преподавательским составом с международным опытом и активной студенческой жизнью.',
      'Стоимость обучения выше средней по рынку, но университет предлагает систему грантов и стипендий для абитуриентов с высокими баллами.',
    ],
    advantages: [
      { icon: '🌎', title: 'Международные программы', description: 'Обмен со университетами США и Европы, двойные дипломы' },
      { icon: '🗣', title: 'Обучение на английском', description: 'Большинство программ преподаются полностью на английском языке' },
      { icon: '🏠', title: 'Общежитие', description: 'Кампусное общежитие с современной инфраструктурой' },
    ],
    hasDormitory: true,
    budgetSeats: false,
    directions: ['it', 'economics', 'law'],
    languages: ['en', 'ru'],
    website: 'https://auca.kg',
    specialties: [
      { id: 'auca-cs', name: 'Computer Science', faculty: 'Факультет естественных наук', minScore: 170, costPerYear: 190000, languages: ['en'], form: 'Очная', type: 'Контракт' },
      { id: 'auca-econ', name: 'Economics', faculty: 'Факультет бизнеса и экономики', minScore: 155, costPerYear: 180000, languages: ['en'], form: 'Очная', type: 'Контракт' },
      { id: 'auca-ba', name: 'Business Administration', faculty: 'Факультет бизнеса и экономики', minScore: 150, costPerYear: 180000, languages: ['en', 'ru'], form: 'Очная', type: 'Контракт' },
      { id: 'auca-ir', name: 'International and Comparative Politics', faculty: 'Социальные науки', minScore: 160, costPerYear: 185000, languages: ['en'], form: 'Очная', type: 'Контракт' },
      { id: 'auca-journ', name: 'Journalism and Mass Communication', faculty: 'Социальные науки', minScore: 150, costPerYear: 175000, languages: ['en', 'ru'], form: 'Очная', type: 'Контракт' },
    ],
    documents: [
      'Аттестат о среднем образовании (оригинал + перевод)',
      'Сертификат ОРТ',
      'Результаты собеседования / эссе на английском',
      'Копия паспорта',
      '4 фотографии 3×4',
      'Подтверждение оплаты вступительного взноса',
    ],
    applicationDeadline: 'Приём документов: 1 апреля – 30 июня (ранний), до 15 августа (общий)',
  },
  {
    id: 'knu-balasagyn',
    name: 'Кыргызский национальный университет им. Ж. Баласагына',
    shortName: 'КНУ им. Ж. Баласагына',
    emoji: '🏛',
    city: 'Бишкек',
    type: 'state',
    minScore: 110,
    costFrom: 25000,
    specialtyCount: 60,
    rating: 4.2,
    description: 'Старейший и крупнейший государственный университет страны, самый широкий выбор специальностей и самая доступная стоимость контрактного обучения.',
    about: [
      'КНУ основан в 1951 году и является старейшим университетом Кыргызстана. Сегодня это крупнейший многопрофильный вуз страны с более чем 60 специальностями.',
      'Университет отличается доступным порогом поступления и одной из самых низких стоимостей контрактного обучения среди государственных вузов.',
      'На базе КНУ работают множество факультетов — от гуманитарных до естественнонаучных и технических, что делает его удобным выбором для абитуриентов, ещё не определившихся с узкой специализацией.',
    ],
    advantages: [
      { icon: '📚', title: 'Широкий выбор специальностей', description: 'Более 60 направлений подготовки на 20+ факультетах' },
      { icon: '💵', title: 'Доступная стоимость', description: 'Одна из самых низких цен контрактного обучения в стране' },
      { icon: '🏠', title: 'Общежитие', description: 'Несколько общежитий, места распределяются по приоритету баллов' },
    ],
    hasDormitory: true,
    budgetSeats: true,
    directions: ['it', 'medicine', 'economics', 'law', 'pedagogy'],
    languages: ['ru', 'kg'],
    website: 'https://knu.kg',
    specialties: [
      { id: 'knu-cs', name: 'Информатика и вычислительная техника', faculty: 'Физико-математический факультет', minScore: 130, costPerYear: 30000, languages: ['ru', 'kg'], form: 'Очная', type: 'Контракт' },
      { id: 'knu-law', name: 'Юриспруденция', faculty: 'Юридический факультет', minScore: 140, costPerYear: 35000, languages: ['ru', 'kg'], form: 'Очная', type: 'Контракт' },
      { id: 'knu-econ', name: 'Экономика', faculty: 'Экономический факультет', minScore: 115, costPerYear: 28000, languages: ['ru', 'kg'], form: 'Очная', type: 'Контракт' },
      { id: 'knu-ped', name: 'Начальное образование', faculty: 'Педагогический факультет', minScore: 110, costPerYear: 25000, languages: ['ru', 'kg'], form: 'Очная', type: 'Бюджет' },
      { id: 'knu-phil', name: 'Кыргызская филология', faculty: 'Филологический факультет', minScore: 110, costPerYear: null, languages: ['kg'], form: 'Очная', type: 'Бюджет' },
    ],
    documents: [
      'Аттестат о среднем образовании (оригинал)',
      'Сертификат ОРТ',
      'Копия паспорта / свидетельства о рождении',
      '6 фотографий 3×4',
      'Медицинская справка формы 086/у',
      'Приписное свидетельство (для юношей)',
    ],
    applicationDeadline: 'Приём документов: 15 июня – 31 августа',
  },
]

// ── Catalog-level context stats (brochure copy, not derived from the array
// above — the seeded list only has the 4 flagship universities in full
// detail, while these describe the wider national catalog). ────────────────
export const CATALOG_STATS = {
  totalUniversities: 52,
  totalSpecialties: '340+',
  stateUniversities: 12,
  privateUniversities: 40,
  averagePassingScore: 150,
}

export function getUniversityById(id: string): University | null {
  return UNIVERSITIES.find(u => u.id === id) ?? null
}

// ── Admission probability ────────────────────────────────────────────────

export type ProbabilityLevel = 'high' | 'medium' | 'low'

export interface Probability {
  level: ProbabilityLevel
  label: string
  pointsNeeded: number
}

export function getProbability(studentScore: number, minScore: number): Probability {
  if (studentScore >= minScore + 20) return { level: 'high', label: 'Высокая вероятность', pointsNeeded: 0 }
  if (studentScore >= minScore) return { level: 'medium', label: 'Средняя вероятность', pointsNeeded: 0 }
  return { level: 'low', label: 'Низкая вероятность', pointsNeeded: minScore - studentScore }
}

// ── Favorites ("Мои университеты") — localStorage only, same pattern as
// the AI Mentor's daily-plan cache (lib/ai-mentor-data.ts) and dismissed
// announcement banners (lib/notifications-data.ts); no DB table for this. ──

const FAVORITES_KEY = 'zhangak_university_favorites'

export function getFavoriteIds(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = window.localStorage.getItem(FAVORITES_KEY)
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set()
  }
}

export function toggleFavorite(id: string): Set<string> {
  const favorites = getFavoriteIds()
  if (favorites.has(id)) favorites.delete(id); else favorites.add(id)
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(FAVORITES_KEY, JSON.stringify([...favorites]))
  }
  return favorites
}
