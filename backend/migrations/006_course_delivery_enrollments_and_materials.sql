-- Product model v1: each learner has one current course, either online or
-- offline.  Online courses are self-paced; offline courses use groups and a
-- teacher.  `hybrid` and `both` were prototype values and are deliberately
-- retired before real enrolments are created.

ALTER TABLE profiles DROP CONSTRAINT profiles_student_type;
ALTER TABLE profiles
  ADD CONSTRAINT profiles_student_type
  CHECK (student_type IS NULL OR student_type IN ('online', 'offline'));

ALTER TABLE groups DROP CONSTRAINT groups_delivery_mode;
ALTER TABLE groups
  ADD CONSTRAINT groups_delivery_mode CHECK (delivery_mode = 'offline');

ALTER TABLE courses
  ADD COLUMN delivery_mode text NOT NULL DEFAULT 'online',
  ADD CONSTRAINT courses_delivery_mode CHECK (delivery_mode IN ('online', 'offline'));

CREATE INDEX courses_delivery_active_name
  ON courses (delivery_mode, name)
  WHERE is_active;

-- An enrolment owns access and manual-payment state.  It is separate from an
-- offline group membership: staff can create the account and record payment
-- before assigning the learner to a class group.  At most one non-terminal
-- course can belong to a student at any time.
CREATE TABLE course_enrollments (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  student_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  course_id bigint NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'awaiting_payment',
  requested_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz,
  activated_at timestamptz,
  suspended_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT course_enrollments_status CHECK (status IN (
    'awaiting_payment', 'awaiting_confirmation', 'active',
    'suspended', 'completed', 'cancelled'
  )),
  CONSTRAINT course_enrollments_confirmation_time CHECK (
    confirmed_at IS NULL OR confirmed_at >= requested_at
  ),
  CONSTRAINT course_enrollments_activation_time CHECK (
    activated_at IS NULL OR activated_at >= requested_at
  ),
  CONSTRAINT course_enrollments_suspension_time CHECK (
    suspended_at IS NULL OR suspended_at >= requested_at
  ),
  CONSTRAINT course_enrollments_completion_time CHECK (
    completed_at IS NULL OR completed_at >= requested_at
  ),
  CONSTRAINT course_enrollments_cancellation_time CHECK (
    cancelled_at IS NULL OR cancelled_at >= requested_at
  )
);

CREATE UNIQUE INDEX course_enrollments_one_current_course
  ON course_enrollments (student_id)
  WHERE status IN ('awaiting_payment', 'awaiting_confirmation', 'active', 'suspended');
CREATE INDEX course_enrollments_student_status
  ON course_enrollments (student_id, status, updated_at DESC);
CREATE INDEX course_enrollments_course_status
  ON course_enrollments (course_id, status, updated_at DESC);

CREATE TRIGGER course_enrollments_touch_updated_at
BEFORE UPDATE ON course_enrollments
FOR EACH ROW EXECUTE FUNCTION learning_touch_updated_at();

-- Private files are referenced by an opaque object key only.  The object
-- storage adapter introduced later must generate short-lived viewer URLs;
-- no public storage URL is persisted in the curriculum.  Video is limited to
-- a YouTube URL for v1, and rich text is where LaTeX source is stored.
CREATE TABLE lesson_materials (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  lesson_id bigint NOT NULL REFERENCES lessons(id) ON DELETE RESTRICT,
  material_type text NOT NULL,
  title text NOT NULL,
  position integer NOT NULL,
  body_markdown text,
  external_url text,
  storage_key text,
  mime_type text,
  byte_size bigint,
  is_published boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lesson_materials_type CHECK (material_type IN ('rich_text', 'video', 'document', 'image')),
  CONSTRAINT lesson_materials_title_length CHECK (char_length(btrim(title)) BETWEEN 1 AND 300),
  CONSTRAINT lesson_materials_position CHECK (position BETWEEN 1 AND 10_000),
  CONSTRAINT lesson_materials_body_length CHECK (body_markdown IS NULL OR char_length(body_markdown) <= 500_000),
  CONSTRAINT lesson_materials_external_url_length CHECK (external_url IS NULL OR char_length(external_url) <= 2_048),
  CONSTRAINT lesson_materials_private_key CHECK (storage_key IS NULL OR storage_key ~ '^[a-z0-9][a-z0-9/_-]{0,511}$'),
  CONSTRAINT lesson_materials_mime_length CHECK (mime_type IS NULL OR char_length(mime_type) BETWEEN 3 AND 160),
  CONSTRAINT lesson_materials_byte_size CHECK (byte_size IS NULL OR byte_size BETWEEN 1 AND 209715200),
  CONSTRAINT lesson_materials_payload_shape CHECK (
    (material_type = 'rich_text' AND body_markdown IS NOT NULL AND external_url IS NULL AND storage_key IS NULL AND mime_type IS NULL AND byte_size IS NULL)
    OR (material_type = 'video' AND body_markdown IS NULL AND external_url ~ '^https://(www\\.)?(youtube\\.com|youtu\\.be)/' AND storage_key IS NULL AND mime_type IS NULL AND byte_size IS NULL)
    OR (material_type = 'document' AND body_markdown IS NULL AND external_url IS NULL AND storage_key IS NOT NULL AND mime_type = 'application/pdf' AND byte_size BETWEEN 1 AND 209715200)
    OR (material_type = 'image' AND body_markdown IS NULL AND external_url IS NULL AND storage_key IS NOT NULL AND mime_type ~ '^image/' AND byte_size BETWEEN 1 AND 31457280)
  ),
  CONSTRAINT lesson_materials_lesson_position_unique UNIQUE (lesson_id, position)
);

CREATE INDEX lesson_materials_lesson_published_position
  ON lesson_materials (lesson_id, position)
  WHERE is_published;

CREATE TRIGGER lesson_materials_touch_updated_at
BEFORE UPDATE ON lesson_materials
FOR EACH ROW EXECUTE FUNCTION learning_touch_updated_at();
