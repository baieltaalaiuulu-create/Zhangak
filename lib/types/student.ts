export type UserRole =
  | "student_online"
  | "student_offline"
  | "admin"
  | "admin_jr"
  | "finance"
  | "manager";

export interface Profile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  role: UserRole;
  phone: string | null;
  created_at: string;
}

export interface Subject {
  id: string;
  name: string;
  name_ru: string;
  icon: string

=== AI CTO ===
# 🚀 ZHANGAK — Кабинет Ученика: Полная Реализация

## 1. Architecture Decision

**Подход:** Server Components по умолчанию + Client Components только для интерактивности. Данные загружаются через Server Actions и Supabase Server Client. Логика "3 провала" вычисляется на сервере, результат кешируется через `unstable_cache`. YouTube embed через нативный `iframe` без сторонних библиотек.

**Почему:** Next.js 14 App Router даёт нам RSC для быстрой первой загрузки, RLS Supabase защищает данные на уровне БД, Server Actions убирают необходимость в отдельных API routes для мутаций.

---

## 2. Affected Files