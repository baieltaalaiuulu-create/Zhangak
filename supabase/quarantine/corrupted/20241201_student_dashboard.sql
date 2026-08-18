-- ============================================================
-- ZHANGAK: Student Dashboard Migration
-- Phase 1: Database Layer
-- ============================================================

-- ── 1. РАСШИРЕНИЕ ТАБЛИЦЫ LESSONS ───────────────────────────
ALTER TABLE lessons
  ADD COLUMN IF NOT EXISTS youtube_url        TEXT,
  ADD COLUMN IF NOT EXISTS youtube_video_id   TEXT GENERATED ALWAYS AS (
    CASE
      WHEN youtube_url LIKE '%watch?v=%'
        THEN split_part(split_part(youtube_url, 'watch?v=', 2), '&', 1)
      WHEN youtube_url LIKE '%youtu.be/%'
        THEN split_part(split_part(youtube_url, 'youtu.be/', 2), '?', 1)
      WHEN youtube_url LIKE '%embed/%'
        THEN split_part(split_part(youtube_url, 'embed/', 2), '?', 1)
      ELSE NULL
    END
  ) STORED,
  ADD COLUMN IF NOT EXISTS duration_minutes   INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS order_index        INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_published       BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS breakdown_url      TEXT,
  ADD COLUMN IF NOT EXISTS breakdown_video_id TEXT GENERATED ALWAYS AS (
    CASE
      WHEN breakdown_url LIKE '%watch?v=%'
        THEN split_part(split_part(breakdown_url, 'watch?v=', 2), '&', 1)
      WHEN breakdown_url LIKE '%youtu.be/%'
        THEN split_part(split_part(breakdown_url, 'youtu.be/', 2), '?', 1)
      ELSE NULL
    END
  ) STORED;

-- ── 2. РАСШИРЕНИЕ ТАБЛИЦЫ PRACTICE_SESSIONS ─────────────────
ALTER TABLE practice_sessions
  ADD COLUMN IF NOT EXISTS lesson_id                UUID REFERENCES lessons(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS failed_attempts_count    INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS passed_attempts_count    INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS video_breakdown_unlocked BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_attempt_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS status                   TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'passed', 'failed'));

-- Индексы для practice_sessions
CREATE INDEX IF NOT EXISTS idx_practice_sessions_lesson_id
  ON practice_sessions(lesson_id);
CREATE INDEX IF NOT EXISTS idx_practice_sessions_user_status
  ON practice_sessions(user_id, status);

-- ── 3. РАСШИРЕНИЕ ТАБЛИЦЫ PRACTICE_RESULTS ──────────────────
ALTER TABLE practice_results
  ADD COLUMN IF NOT EXISTS passed       BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS score        NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_score    NUMERIC(5,2) DEFAULT 100,
  ADD COLUMN IF NOT EXISTS attempt_num  INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS time_spent   INTEGER DEFAULT 0, -- секунды
  ADD COLUMN IF NOT EXISTS weak_topics  JSONB DEFAULT '[]'::jsonb;

-- ── 4. ТАБЛИЦА STREAKS ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS streaks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  current_streak  INTEGER DEFAULT 0,
  longest_streak  INTEGER DEFAULT 0,
  last_activity   DATE,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_streaks_user_id ON streaks(user_id);

-- ── 5. ТАБЛИЦА LEADERBOARD_ENTRIES ──────────────────────────
CREATE TABLE IF NOT EXISTS leaderboard_entries (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score        INTEGER DEFAULT 0,
  rank         INTEGER,
  period       TEXT DEFAULT 'weekly' CHECK (period IN ('daily','weekly','monthly','all_time')),
  subject_id   UUID REFERENCES subjects(id) ON DELETE SET NULL,
  updated_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, period, subject_id)
);

CREATE INDEX IF NOT EXISTS idx_leaderboard_period_score
  ON leaderboard_entries(period, score DESC);

-- ── 6. ТАБЛИЦА SUBSCRIPTIONS ────────────────────────────────
CREATE TABLE IF NOT EXISTS subscriptions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan            TEXT DEFAULT 'free' CHECK (plan IN ('free','trial','basic','premium')),
  status          TEXT DEFAULT 'active' CHECK (status IN ('active','expired','cancelled','trial')),
  started_at      TIMESTAMPTZ DEFAULT now(),
  expires_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status  ON subscriptions(status);

-- ── 7. ТАБЛИЦА NOTIFICATIONS ────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type         TEXT DEFAULT 'info'
    CHECK (type IN ('info','success','warning','error','homework','streak','achievement')),
  title        TEXT NOT NULL,
  message      TEXT NOT NULL,
  is_read      BOOLEAN DEFAULT false,
  action_url   TEXT,
  metadata     JSONB DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications(user_id, is_read, created_at DESC);

-- ── 8. ТАБЛИЦА SUBJECT_PROGRESS ─────────────────────────────
CREATE TABLE IF NOT EXISTS subject_progress (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_id      UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  lessons_total   INTEGER DEFAULT 0,
  lessons_done    INTEGER DEFAULT 0,
  avg_score       NUMERIC(5,2) DEFAULT 0,
  weak_topics     JSONB DEFAULT '[]'::jsonb,
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, subject_id)
);

CREATE INDEX IF NOT EXISTS idx_subject_progress_user
  ON subject_progress(user_id);

-- ── 9. ТАБЛИЦА WEAK_TOPICS ──────────────────────────────────
CREATE TABLE IF NOT EXISTS weak_topics (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_id    UUID REFERENCES subjects(id) ON DELETE SET NULL,
  topic_name    TEXT NOT NULL,
  error_count   INTEGER DEFAULT 1,
  last_seen_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, topic_name)
);

-- ── 10. ФУНКЦИЯ: обновить

=== Frontend Developer ===
I'll build the complete student dashboard for ZHANGAK. Let me implement all files systematically.

[FILE: app/student/dashboard/layout.tsx]
