-- Online gamification v2.  All rewards are server-authored, append-only and
-- idempotent; browser clients never send XP, counters or period boundaries.

ALTER TABLE student_xp_awards
  DROP CONSTRAINT student_xp_awards_source_type;

ALTER TABLE student_xp_awards
  ADD CONSTRAINT student_xp_awards_source_type
  CHECK (source_type IN ('lesson', 'daily', 'trainer_section', 'admin_adjustment', 'quest'));

ALTER TABLE profiles
  ADD COLUMN public_profile_id uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN community_visibility boolean NOT NULL DEFAULT true;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_public_profile_id_unique UNIQUE (public_profile_id);

CREATE TABLE student_xp_totals (
  student_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  xp_total integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT student_xp_totals_non_negative CHECK (xp_total >= 0)
);

INSERT INTO student_xp_totals (student_id, xp_total)
SELECT student_id, sum(xp_amount)::integer
  FROM student_xp_awards
 GROUP BY student_id
ON CONFLICT (student_id) DO UPDATE
  SET xp_total = EXCLUDED.xp_total,
      updated_at = now();

CREATE OR REPLACE FUNCTION gamification_sync_xp_total()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO student_xp_totals (student_id, xp_total, updated_at)
  VALUES (NEW.student_id, NEW.xp_amount, now())
  ON CONFLICT (student_id) DO UPDATE
    SET xp_total = student_xp_totals.xp_total + NEW.xp_amount,
        updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER student_xp_awards_sync_total
AFTER INSERT ON student_xp_awards
FOR EACH ROW EXECUTE FUNCTION gamification_sync_xp_total();

CREATE TABLE gamification_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  student_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  event_key text NOT NULL,
  event_type text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gamification_events_key_length CHECK (char_length(event_key) BETWEEN 3 AND 240),
  CONSTRAINT gamification_events_type CHECK (event_type IN (
    'platform_visit', 'lesson_completed', 'practice_submitted',
    'daily_challenge_completed', 'trainer_mastered', 'daily_quest_completed',
    'weekly_quest_completed'
  )),
  CONSTRAINT gamification_events_metadata_object CHECK (jsonb_typeof(metadata) = 'object'),
  CONSTRAINT gamification_events_once UNIQUE (student_id, event_key)
);

CREATE INDEX gamification_events_student_type_time
  ON gamification_events (student_id, event_type, created_at DESC);

CREATE TABLE quest_definitions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code text NOT NULL UNIQUE,
  period text NOT NULL,
  target_event_type text NOT NULL,
  target_count smallint NOT NULL,
  xp_reward integer NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  sort_order smallint NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT quest_definitions_code_format CHECK (code ~ '^[a-z][a-z0-9_]{2,63}$'),
  CONSTRAINT quest_definitions_period CHECK (period IN ('daily', 'weekly')),
  CONSTRAINT quest_definitions_target_event CHECK (target_event_type IN (
    'platform_visit', 'lesson_completed', 'practice_submitted',
    'daily_challenge_completed', 'trainer_mastered', 'daily_quest_completed',
    'weekly_quest_completed'
  )),
  CONSTRAINT quest_definitions_target_count CHECK (target_count BETWEEN 1 AND 1000),
  CONSTRAINT quest_definitions_xp_reward CHECK (xp_reward BETWEEN 1 AND 10000),
  CONSTRAINT quest_definitions_title_length CHECK (char_length(btrim(title)) BETWEEN 1 AND 160),
  CONSTRAINT quest_definitions_description_length CHECK (char_length(btrim(description)) BETWEEN 1 AND 500)
);

CREATE TABLE quest_instances (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  quest_definition_id bigint NOT NULL REFERENCES quest_definitions(id) ON DELETE RESTRICT,
  period_start date NOT NULL,
  period_end date NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  target_count smallint NOT NULL,
  xp_reward integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT quest_instances_period CHECK (period_end > period_start),
  CONSTRAINT quest_instances_target_count CHECK (target_count BETWEEN 1 AND 1000),
  CONSTRAINT quest_instances_xp_reward CHECK (xp_reward BETWEEN 1 AND 10000),
  CONSTRAINT quest_instances_once UNIQUE (quest_definition_id, period_start)
);

CREATE INDEX quest_instances_period_lookup ON quest_instances (period_start, period_end);

CREATE TABLE student_quest_progress (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  student_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  quest_instance_id bigint NOT NULL REFERENCES quest_instances(id) ON DELETE RESTRICT,
  current_count smallint NOT NULL DEFAULT 0,
  completed_at timestamptz,
  xp_award_id bigint REFERENCES student_xp_awards(id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT student_quest_progress_count CHECK (current_count BETWEEN 0 AND 1000),
  CONSTRAINT student_quest_progress_once UNIQUE (student_id, quest_instance_id),
  CONSTRAINT student_quest_progress_completion_state CHECK (
    (completed_at IS NULL AND xp_award_id IS NULL) OR (completed_at IS NOT NULL AND xp_award_id IS NOT NULL)
  )
);

CREATE INDEX student_quest_progress_student_updated
  ON student_quest_progress (student_id, updated_at DESC);

CREATE TABLE achievement_definitions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code text NOT NULL UNIQUE,
  title text NOT NULL,
  description text NOT NULL,
  icon_key text NOT NULL,
  sort_order smallint NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  CONSTRAINT achievement_definitions_code_format CHECK (code ~ '^[a-z][a-z0-9_]{2,63}$'),
  CONSTRAINT achievement_definitions_title_length CHECK (char_length(btrim(title)) BETWEEN 1 AND 160),
  CONSTRAINT achievement_definitions_description_length CHECK (char_length(btrim(description)) BETWEEN 1 AND 500),
  CONSTRAINT achievement_definitions_icon_key_format CHECK (icon_key ~ '^[a-z][a-z0-9_]{2,63}$')
);

CREATE TABLE student_achievements (
  student_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  achievement_id bigint NOT NULL REFERENCES achievement_definitions(id) ON DELETE RESTRICT,
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (student_id, achievement_id)
);

CREATE INDEX student_achievements_student_time
  ON student_achievements (student_id, unlocked_at DESC);

CREATE TRIGGER quest_definitions_touch_updated_at
BEFORE UPDATE ON quest_definitions
FOR EACH ROW EXECUTE FUNCTION learning_touch_updated_at();

INSERT INTO quest_definitions (code, period, target_event_type, target_count, xp_reward, title, description, sort_order)
VALUES
  ('daily_check_in', 'daily', 'platform_visit', 1, 5, 'На связи', 'Открой платформу сегодня.', 10),
  ('daily_trainer_warmup', 'daily', 'trainer_mastered', 3, 10, 'Разминка', 'Освой 3 новых вопроса в тренажёре.', 20),
  ('daily_learning_step', 'daily', 'lesson_completed', 1, 15, 'Шаг вперёд', 'Заверши один урок по roadmap.', 30),
  ('weekly_study_rhythm', 'weekly', 'platform_visit', 4, 30, 'Учебный ритм', 'Учись в 4 разные даты этой недели.', 10),
  ('weekly_trainer_master', 'weekly', 'trainer_mastered', 15, 40, 'Мастер вопросов', 'Освой 15 новых вопросов в тренажёре.', 20),
  ('weekly_daily_consistency', 'weekly', 'daily_quest_completed', 8, 50, 'Стабильность', 'Заверши 8 ежедневных квестов.', 30)
ON CONFLICT (code) DO NOTHING;

INSERT INTO achievement_definitions (code, title, description, icon_key, sort_order)
VALUES
  ('first_step', 'Первый шаг', 'Выполни первое учебное действие.', 'footprints', 10),
  ('roadmap_start', 'Начало пути', 'Заверши первый урок roadmap.', 'map', 20),
  ('roadmap_five', 'Покоритель roadmap', 'Заверши 5 уроков roadmap.', 'route', 30),
  ('trainer_ten', 'Разминка пройдена', 'Освой 10 новых вопросов.', 'dumbbell', 40),
  ('trainer_hundred', 'Мастер тренажёра', 'Освой 100 новых вопросов.', 'trophy', 50),
  ('perfect_day', 'Идеальный день', 'Получи 3 звезды в задании дня.', 'star', 60),
  ('rhythm_seven', 'Ритм 7', 'Учись 7 дней подряд.', 'flame', 70),
  ('weekly_hero', 'Герой недели', 'Заверши все квесты недели.', 'crown', 80)
ON CONFLICT (code) DO NOTHING;
