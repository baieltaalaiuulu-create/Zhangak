import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Жангак Math — математика для 6–8 классов',
  description: 'Курсы математики для учеников 6, 7 и 8 классов в Бишкеке и онлайн: практика, сильная база и подготовка к ОРТ.',
  alternates: { canonical: 'https://zhangak.com/math' },
}

export default function MathMarketingLayout({ children }: { children: React.ReactNode }) {
  return children
}
