-- ============================================
-- MIGRATION: Student Dashboard
-- TASK-20240115-143022
-- ============================================

-- 1. Добавляем поля в таблицу lessons
ALTER TABLE lessons 
ADD COLUMN IF NOT EXISTS youtube_url TEXT,
ADD COLUMN IF NOT EXISTS youtube_video_id TEXT GENERATED ALWAYS AS (
  CASE 
    WHEN youtube_url LIKE '%youtu.be/%' 
      THEN split_part(split_part(youtube_url, 'youtu.be/', 2), '?', 1)
    WHEN youtube_url LIKE '%

=== AI CTO ===
# 🚀 ZHANGAK — Кабинет ученика: Полная реализация

## 1. Architecture Decision

**Подход:** Server Components по умолчанию, Client Components только для интерактивности (плеер, формы, анимации). Server Actions для мутаций. Streaming через Suspense для тяжёлых данных.

**Почему:** App Router даёт нам параллельную загрузку данных на сервере, RLS Supabase защищает данные на уровне БД, Server Actions убирают нужду в отдельных API routes для мутаций.

---

## 2. Affected Files
