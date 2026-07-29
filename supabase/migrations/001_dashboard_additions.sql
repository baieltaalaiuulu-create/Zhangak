-- ============================================
-- ZHANGAK Dashboard Additions Migration
-- TASK-20241215-143022
-- ============================================

-- 1. Добавляем поля в таблицу lessons
ALTER TABLE lessons 
  ADD COLUMN IF NOT EXISTS youtube_url TEXT,
  ADD COLUMN IF NOT EXISTS review_video_url TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS duration_minutes INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_free BOOLEAN DEFAULT false;

-- 2. Добавляем поля в таблицу practice_sessions (ДЗ)
ALTER TABLE practice_sessions
  ADD COLUMN IF NOT EXISTS lesson_id UUID REFERENCES lessons(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS session_type TEXT DEFAULT 'homework' 
    CHECK (session_type IN ('homework', 'mock_test', 'practice')),
  ADD COLUMN IF NOT EXISTS failed_attempts INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_review_unlocked BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- 3. Таблица для слабых тем
CREATE TABLE IF NOT EXISTS weak_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
  topic_name TEXT NOT NULL,
  correct_count INTEGER DEFAULT 0,
  total_count INTEGER DEFAULT 0,
  accuracy_percent NUMERIC(5,2) GENERATED ALWAYS AS (
    CASE WHEN total_count > 0 
      THEN ROUND((correct_count::NUMERIC / total_count) * 100, 2)
      ELSE 0 
    END
  ) STORED,
  last_attempted_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Расширяем streaks
ALTER TABLE streaks
  ADD COLUMN IF NOT EXISTS student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS current_streak INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS longest_streak INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_activity_date DATE DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS total_days_active INTEGER DEFAULT 0;

-- 5. Расширяем subscriptions
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS plan_name TEXT DEFAULT 'free' 
    CHECK (plan_name IN ('free', 'basic', 'premium', 'ultimate')),
  ADD

=== AI CTO ===
# ZHANGAK — Кабинет Ученика: Полная Реализация

## 1. Architecture Decision

**Подход:** Server Components по умолчанию + Client Components только для интерактивности. Data fetching на уровне страниц через Supabase Server Client. Optimistic UI для streak и прогресса.

**Почему:** App Router позволяет стримить данные параллельно через `Promise.all`, избегая waterfall. RLS на Supabase гарантирует изоляцию данных без дополнительных проверок в коде.

---

## 2. Полный код файлов

[FILE: lib/types/dashboard.ts]