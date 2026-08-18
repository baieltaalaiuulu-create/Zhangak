import {
  ArrowRight,
  Clock3,
  Copyright,
  ExternalLink,
  MapPin,
  MessageCircle,
  Phone,
  ShieldCheck,
} from 'lucide-react'

import { ADMIN_ORIGIN, OFFLINE_ORIGIN, PLATFORM_ORIGIN } from '@/lib/site-hosts'

const platformHref = process.env.NODE_ENV === 'production' ? `${PLATFORM_ORIGIN}/login` : '/login?surface=platform'
const offlineHref = process.env.NODE_ENV === 'production' ? `${OFFLINE_ORIGIN}/login` : '/login?surface=offline'
const adminHref = process.env.NODE_ENV === 'production' ? `${ADMIN_ORIGIN}/login` : '/login?surface=admin'

const navigation = [
  { href: '#courses', label: 'Программы подготовки' },
  { href: '#results', label: 'Результаты учеников' },
  { href: '#office', label: 'Наш офис' },
  { href: '#faq', label: 'Частые вопросы' },
]

export default function MarketingFooter() {
  return (
    <footer lang="ru" className="bg-[#07142E] text-white">
      <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-14 lg:px-10">
        <div className="grid gap-10 border-b border-white/10 pb-10 lg:grid-cols-[1.35fr_0.8fr_1fr] lg:gap-14">
          <div>
            <a href="#top" className="inline-flex items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-400/40">
              {/* eslint-disable-next-line @next/next/no-img-element -- local brand asset */}
              <img src="/images/logo.png" alt="Логотип Жангак" className="h-12 w-12 rounded-2xl object-cover ring-1 ring-white/15" />
              <span>
                <span className="block text-xl font-black tracking-wide">ZHANGAK</span>
                <span className="block text-[10px] font-semibold uppercase tracking-[0.22em] text-blue-200/70">ОРТ даярдыгы</span>
              </span>
            </a>
            <p className="mt-5 max-w-md text-sm font-medium leading-6 text-slate-300">
              Подготовка к ОРТ для старшеклассников Кыргызстана: занятия, практика, пробные тесты и понятный контроль прогресса.
            </p>
            <a
              href={platformHref}
              className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#1B3F92] px-5 text-sm font-extrabold text-white shadow-lg shadow-blue-950/30 transition-colors hover:bg-[#2860E3] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-400/40"
            >
              Открыть учебную платформу
              <ArrowRight size={17} aria-hidden="true" />
            </a>
            <a
              href={offlineHref}
              className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-bold text-blue-200 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-400/40"
            >
              Учитесь в очной группе? Открыть офлайн-кабинет
              <ArrowRight size={16} aria-hidden="true" />
            </a>
          </div>

          <nav aria-label="Навигация в подвале">
            <h2 className="text-xs font-extrabold uppercase tracking-[0.18em] text-slate-400">О Жангак</h2>
            <ul className="mt-5 space-y-3">
              {navigation.map(item => (
                <li key={item.href}>
                  <a href={item.href} className="inline-flex min-h-8 items-center text-sm font-semibold text-slate-200 transition-colors hover:text-blue-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400">
                    {item.label}
                  </a>
                </li>
              ))}
              <li>
                <a href="/privacy" className="inline-flex min-h-8 items-center text-sm font-semibold text-slate-200 transition-colors hover:text-blue-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400">
                  Политика конфиденциальности
                </a>
              </li>
            </ul>
          </nav>

          <div>
            <h2 className="text-xs font-extrabold uppercase tracking-[0.18em] text-slate-400">Контакты</h2>
            <div className="mt-5 space-y-4 text-sm font-semibold text-slate-200">
              <a href="tel:+996502245245" className="flex min-h-10 items-center gap-3 rounded-lg transition-colors hover:text-blue-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400">
                <Phone size={18} className="shrink-0 text-blue-300" aria-hidden="true" />
                +996 502 245 245
              </a>
              <div className="flex min-h-10 items-center gap-3">
                <MapPin size={18} className="shrink-0 text-blue-300" aria-hidden="true" />
                Адрес ближайшей группы — в WhatsApp
              </div>
              <div className="flex min-h-10 items-center gap-3">
                <Clock3 size={18} className="shrink-0 text-blue-300" aria-hidden="true" />
                Напишите нам в WhatsApp
              </div>
            </div>
            <a
              href="https://wa.me/996502245245"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] px-4 text-sm font-bold text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-400/40"
            >
              <MessageCircle size={17} aria-hidden="true" />
              Написать в WhatsApp
              <ExternalLink size={14} className="text-slate-400" aria-hidden="true" />
            </a>
          </div>
        </div>

        <div className="flex flex-col gap-4 pt-6 text-xs font-medium text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-1.5"><Copyright size={14} aria-hidden="true" /> 2026 Жангак. Все права защищены.</p>
          <a href={adminHref} className="inline-flex min-h-9 w-fit items-center gap-2 rounded-lg px-2 transition-colors hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400">
            <ShieldCheck size={15} aria-hidden="true" />
            Вход для команды
          </a>
        </div>
      </div>
    </footer>
  )
}
