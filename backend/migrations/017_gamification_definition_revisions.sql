-- Quest settings are versioned.  Editing a definition never changes an
-- already-open daily or weekly quest instance, and only takes effect from the
-- next Asia/Bishkek period boundary.

CREATE TABLE quest_definition_revisions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  quest_definition_id bigint NOT NULL REFERENCES quest_definitions(id) ON DELETE RESTRICT,
  effective_from date NOT NULL,
  target_count smallint NOT NULL,
  xp_reward integer NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  sort_order smallint NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT quest_definition_revisions_target_count CHECK (target_count BETWEEN 1 AND 1000),
  CONSTRAINT quest_definition_revisions_xp_reward CHECK (xp_reward BETWEEN 1 AND 10000),
  CONSTRAINT quest_definition_revisions_title_length CHECK (char_length(btrim(title)) BETWEEN 1 AND 160),
  CONSTRAINT quest_definition_revisions_description_length CHECK (char_length(btrim(description)) BETWEEN 1 AND 500),
  CONSTRAINT quest_definition_revisions_once UNIQUE (quest_definition_id, effective_from)
);

CREATE INDEX quest_definition_revisions_effective_lookup
  ON quest_definition_revisions (quest_definition_id, effective_from DESC);

INSERT INTO quest_definition_revisions (
  quest_definition_id, effective_from, target_count, xp_reward,
  title, description, sort_order, is_active
)
SELECT id, DATE '2000-01-01', target_count, xp_reward,
       title, description, sort_order, is_active
  FROM quest_definitions
ON CONFLICT (quest_definition_id, effective_from) DO NOTHING;
