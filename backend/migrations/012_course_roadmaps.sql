-- Roadmap is a first-party course structure.  Units are ordered inside a
-- course and own the position of their lessons.  The redundant course_id in
-- course_unit_lessons makes both relationships enforceable by composite FKs:
-- a lesson can never be placed into a unit from another course.

CREATE TABLE course_units (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  course_id bigint NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
  unit_number integer NOT NULL,
  title text NOT NULL,
  description text,
  accent_color text NOT NULL DEFAULT 'blue',
  is_published boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT course_units_number CHECK (unit_number BETWEEN 1 AND 10_000),
  CONSTRAINT course_units_title_length CHECK (char_length(btrim(title)) BETWEEN 1 AND 160),
  CONSTRAINT course_units_description_length CHECK (description IS NULL OR char_length(description) <= 1_000),
  -- Deliberately tokens, not arbitrary CSS. The public client maps these to
  -- approved brand-safe colours and an admin cannot inject style values.
  CONSTRAINT course_units_accent_color CHECK (accent_color IN ('green', 'blue', 'violet', 'red')),
  CONSTRAINT course_units_course_number_unique UNIQUE (course_id, unit_number),
  CONSTRAINT course_units_id_course_unique UNIQUE (id, course_id)
);

CREATE INDEX course_units_course_published_order
  ON course_units (course_id, unit_number)
  WHERE is_published;

CREATE TRIGGER course_units_touch_updated_at
BEFORE UPDATE ON course_units
FOR EACH ROW EXECUTE FUNCTION learning_touch_updated_at();

CREATE TABLE course_unit_lessons (
  unit_id bigint NOT NULL,
  course_id bigint NOT NULL,
  lesson_id bigint NOT NULL,
  position integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (unit_id, lesson_id),
  CONSTRAINT course_unit_lessons_position CHECK (position BETWEEN 1 AND 10_000),
  CONSTRAINT course_unit_lessons_unit_position_unique UNIQUE (unit_id, position),
  -- A lesson has one canonical place in the Roadmap. Its historic progress
  -- remains on lesson_progress when staff later reorganise a draft course.
  CONSTRAINT course_unit_lessons_course_lesson_unique UNIQUE (course_id, lesson_id),
  FOREIGN KEY (unit_id, course_id)
    REFERENCES course_units(id, course_id) ON DELETE RESTRICT,
  FOREIGN KEY (lesson_id, course_id)
    REFERENCES lessons(id, course_id) ON DELETE RESTRICT
);

CREATE INDEX course_unit_lessons_course_position
  ON course_unit_lessons (course_id, unit_id, position);
