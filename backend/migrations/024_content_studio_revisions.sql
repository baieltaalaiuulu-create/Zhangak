-- Content Studio v2 keeps the stable lessons.id used by progress and historic
-- attempts, while making every editor change a separate revision. The legacy
-- lesson/material tables remain the student renderer's source until the
-- Composer cutover is explicitly published.

CREATE TABLE lesson_revisions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  lesson_id bigint NOT NULL REFERENCES lessons(id) ON DELETE RESTRICT,
  revision_number integer NOT NULL,
  state text NOT NULL DEFAULT 'draft',
  title text NOT NULL,
  description text,
  subject text,
  section text,
  topic text,
  lesson_date date,
  duration_minutes integer,
  content_locale text NOT NULL DEFAULT 'ru',
  change_summary text,
  base_revision_id bigint REFERENCES lesson_revisions(id) ON DELETE RESTRICT,
  row_version integer NOT NULL DEFAULT 1,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  published_by uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  published_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lesson_revisions_number CHECK (revision_number BETWEEN 1 AND 1000000),
  CONSTRAINT lesson_revisions_state CHECK (state IN ('draft', 'in_review', 'approved', 'published', 'archived')),
  CONSTRAINT lesson_revisions_title CHECK (char_length(btrim(title)) BETWEEN 1 AND 300),
  CONSTRAINT lesson_revisions_description CHECK (description IS NULL OR char_length(description) <= 50000),
  CONSTRAINT lesson_revisions_subject CHECK (subject IS NULL OR char_length(btrim(subject)) BETWEEN 1 AND 80),
  CONSTRAINT lesson_revisions_section CHECK (section IS NULL OR char_length(btrim(section)) BETWEEN 1 AND 64),
  CONSTRAINT lesson_revisions_topic CHECK (topic IS NULL OR char_length(btrim(topic)) BETWEEN 1 AND 200),
  CONSTRAINT lesson_revisions_duration CHECK (duration_minutes IS NULL OR duration_minutes BETWEEN 1 AND 600),
  CONSTRAINT lesson_revisions_locale CHECK (content_locale IN ('ru', 'ky')),
  CONSTRAINT lesson_revisions_summary CHECK (change_summary IS NULL OR char_length(change_summary) <= 1000),
  CONSTRAINT lesson_revisions_row_version CHECK (row_version >= 1),
  CONSTRAINT lesson_revisions_unique_number UNIQUE (lesson_id, revision_number)
);

CREATE UNIQUE INDEX lesson_revisions_one_published
  ON lesson_revisions (lesson_id) WHERE state = 'published';
CREATE INDEX lesson_revisions_lesson_state
  ON lesson_revisions (lesson_id, state, revision_number DESC);

CREATE TRIGGER lesson_revisions_touch_updated_at
BEFORE UPDATE ON lesson_revisions
FOR EACH ROW EXECUTE FUNCTION learning_touch_updated_at();

CREATE TABLE lesson_revision_blocks (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  revision_id bigint NOT NULL REFERENCES lesson_revisions(id) ON DELETE RESTRICT,
  stable_key uuid NOT NULL DEFAULT gen_random_uuid(),
  block_type text NOT NULL,
  position integer NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  material_id bigint REFERENCES lesson_materials(id) ON DELETE RESTRICT,
  practice_test_id bigint REFERENCES practice_tests(id) ON DELETE RESTRICT,
  schema_version smallint NOT NULL DEFAULT 1,
  is_visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lesson_revision_blocks_type CHECK (block_type IN ('heading', 'rich_text', 'formula', 'callout', 'image', 'document', 'video', 'divider', 'assessment', 'checklist')),
  CONSTRAINT lesson_revision_blocks_position CHECK (position BETWEEN 1 AND 10000),
  CONSTRAINT lesson_revision_blocks_payload CHECK (jsonb_typeof(payload) = 'object'),
  CONSTRAINT lesson_revision_blocks_schema_version CHECK (schema_version BETWEEN 1 AND 100),
  CONSTRAINT lesson_revision_blocks_unique_position UNIQUE (revision_id, position),
  CONSTRAINT lesson_revision_blocks_unique_key UNIQUE (revision_id, stable_key)
);

CREATE INDEX lesson_revision_blocks_revision_order
  ON lesson_revision_blocks (revision_id, position);
CREATE INDEX lesson_revision_blocks_material
  ON lesson_revision_blocks (material_id) WHERE material_id IS NOT NULL;
CREATE INDEX lesson_revision_blocks_practice_test
  ON lesson_revision_blocks (practice_test_id) WHERE practice_test_id IS NOT NULL;

CREATE TRIGGER lesson_revision_blocks_touch_updated_at
BEFORE UPDATE ON lesson_revision_blocks
FOR EACH ROW EXECUTE FUNCTION learning_touch_updated_at();

-- Backfill every existing lesson as revision 1. Nothing is published through
-- this table yet; the legacy renderer keeps its current behaviour until the
-- explicit v2 release workflow is enabled.
INSERT INTO lesson_revisions (
  lesson_id, revision_number, state, title, description, subject, section,
  topic, lesson_date, duration_minutes, created_by, created_at, updated_at,
  published_at, published_by
)
SELECT
  l.id, 1, CASE WHEN l.is_published THEN 'published' ELSE 'draft' END,
  l.title, l.description, l.subject, l.section, l.topic, l.lesson_date,
  l.duration_minutes, l.created_by, l.created_at, l.updated_at,
  CASE WHEN l.is_published THEN l.updated_at ELSE NULL END,
  CASE WHEN l.is_published THEN l.created_by ELSE NULL END
FROM lessons l;

INSERT INTO lesson_revision_blocks (
  revision_id, block_type, position, payload, material_id, is_visible, created_at, updated_at
)
SELECT
  r.id,
  CASE m.material_type
    WHEN 'rich_text' THEN 'rich_text'
    WHEN 'video' THEN 'video'
    WHEN 'document' THEN 'document'
    WHEN 'image' THEN 'image'
  END,
  m.position,
  jsonb_strip_nulls(jsonb_build_object(
    'title', m.title,
    'bodyMarkdown', m.body_markdown,
    'externalUrl', m.external_url
  )),
  m.id,
  m.is_published,
  m.created_at,
  m.created_at
FROM lesson_revisions r
JOIN lesson_materials m ON m.lesson_id = r.lesson_id
WHERE r.revision_number = 1;

ALTER TABLE lessons ADD COLUMN published_revision_id bigint;
ALTER TABLE lessons
  ADD CONSTRAINT lessons_published_revision_fk
  FOREIGN KEY (published_revision_id) REFERENCES lesson_revisions(id) ON DELETE RESTRICT;

UPDATE lessons l
   SET published_revision_id = r.id
  FROM lesson_revisions r
 WHERE r.lesson_id = l.id
   AND r.state = 'published';

CREATE INDEX lessons_published_revision ON lessons (published_revision_id)
  WHERE published_revision_id IS NOT NULL;
