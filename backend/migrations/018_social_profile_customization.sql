-- Social profile foundations.  These records intentionally contain only
-- curated presentation choices; contact information, real names and raw CSS
-- are never part of the public community projection.

ALTER TABLE profiles
  ADD COLUMN community_display_name text,
  ADD COLUMN community_profile_visibility text NOT NULL DEFAULT 'leaderboard',
  ADD COLUMN community_show_xp boolean NOT NULL DEFAULT true,
  ADD COLUMN community_show_achievements boolean NOT NULL DEFAULT true,
  ADD COLUMN community_show_streak boolean NOT NULL DEFAULT true,
  ADD COLUMN community_allow_friend_requests boolean NOT NULL DEFAULT true,
  ADD COLUMN community_discoverable boolean NOT NULL DEFAULT true,
  ADD COLUMN profile_frame_code text NOT NULL DEFAULT 'frame_classic',
  ADD COLUMN profile_background_code text NOT NULL DEFAULT 'background_clear',
  ADD COLUMN profile_title_code text NOT NULL DEFAULT 'title_student';

ALTER TABLE profiles
  ADD CONSTRAINT profiles_community_display_name_length
    CHECK (community_display_name IS NULL OR char_length(btrim(community_display_name)) BETWEEN 2 AND 24),
  ADD CONSTRAINT profiles_community_profile_visibility
    CHECK (community_profile_visibility IN ('private', 'community', 'leaderboard')),
  ADD CONSTRAINT profiles_profile_frame_code_format
    CHECK (profile_frame_code ~ '^[a-z][a-z0-9_]{2,63}$'),
  ADD CONSTRAINT profiles_profile_background_code_format
    CHECK (profile_background_code ~ '^[a-z][a-z0-9_]{2,63}$'),
  ADD CONSTRAINT profiles_profile_title_code_format
    CHECK (profile_title_code ~ '^[a-z][a-z0-9_]{2,63}$');

UPDATE profiles
   SET community_profile_visibility = CASE WHEN community_visibility THEN 'leaderboard' ELSE 'private' END;

CREATE TABLE profile_cosmetic_definitions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code text NOT NULL UNIQUE,
  category text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  rarity text NOT NULL DEFAULT 'base',
  sort_order smallint NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  CONSTRAINT profile_cosmetic_definitions_code_format CHECK (code ~ '^[a-z][a-z0-9_]{2,63}$'),
  CONSTRAINT profile_cosmetic_definitions_category CHECK (category IN ('frame', 'background', 'title')),
  CONSTRAINT profile_cosmetic_definitions_rarity CHECK (rarity IN ('base', 'earned', 'rare')),
  CONSTRAINT profile_cosmetic_definitions_title_length CHECK (char_length(btrim(title)) BETWEEN 1 AND 80),
  CONSTRAINT profile_cosmetic_definitions_description_length CHECK (char_length(btrim(description)) BETWEEN 1 AND 240)
);

CREATE TABLE student_profile_cosmetics (
  student_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cosmetic_id bigint NOT NULL REFERENCES profile_cosmetic_definitions(id) ON DELETE RESTRICT,
  source_type text NOT NULL DEFAULT 'base',
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (student_id, cosmetic_id),
  CONSTRAINT student_profile_cosmetics_source CHECK (source_type IN ('base', 'achievement', 'level', 'admin'))
);

CREATE INDEX student_profile_cosmetics_student ON student_profile_cosmetics (student_id, unlocked_at DESC);

CREATE TABLE student_featured_achievements (
  student_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_id bigint NOT NULL REFERENCES achievement_definitions(id) ON DELETE RESTRICT,
  slot smallint NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (student_id, achievement_id),
  CONSTRAINT student_featured_achievements_slot CHECK (slot BETWEEN 1 AND 3),
  CONSTRAINT student_featured_achievements_slot_unique UNIQUE (student_id, slot)
);

INSERT INTO profile_cosmetic_definitions (code, category, title, description, rarity, sort_order)
VALUES
  ('frame_classic', 'frame', 'Классическая рамка', 'Базовая аккуратная рамка профиля.', 'base', 10),
  ('frame_azure', 'frame', 'Лазурная рамка', 'Спокойный синий акцент.', 'base', 20),
  ('frame_emerald', 'frame', 'Изумрудная рамка', 'Зелёный акцент для учебного ритма.', 'base', 30),
  ('background_clear', 'background', 'Чистый фон', 'Нейтральный фон профиля.', 'base', 10),
  ('background_sky', 'background', 'Небо', 'Мягкий сине-фиолетовый фон.', 'base', 20),
  ('background_sunrise', 'background', 'Рассвет', 'Тёплый спокойный фон.', 'base', 30),
  ('title_student', 'title', 'Ученик Zhangak', 'Базовый титул сообщества.', 'base', 10),
  ('title_steady', 'title', 'В учебном ритме', 'Титул для спокойной ежедневной практики.', 'base', 20)
ON CONFLICT (code) DO NOTHING;

INSERT INTO student_profile_cosmetics (student_id, cosmetic_id, source_type)
SELECT p.user_id, d.id, 'base'
  FROM profiles p
  JOIN profile_cosmetic_definitions d ON d.rarity = 'base' AND d.is_active = true
 WHERE p.role IN ('student', 'math_student')
ON CONFLICT DO NOTHING;

CREATE INDEX profiles_community_discovery
  ON profiles (community_profile_visibility, community_discoverable, public_profile_id)
  WHERE community_profile_visibility <> 'private';
