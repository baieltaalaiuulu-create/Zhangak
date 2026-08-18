-- Offline classroom operations. These records are owned by the first-party
-- PostgreSQL database and are deliberately scoped to an offline group.
-- Teachers are authorized in API routes only for groups where g.teacher_id is
-- their own id; admins/super-admins are additionally allowed by those routes.

CREATE TABLE offline_class_sessions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  group_id bigint NOT NULL REFERENCES groups(id) ON DELETE RESTRICT,
  lesson_id bigint NOT NULL REFERENCES lessons(id) ON DELETE RESTRICT,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  room text,
  status text NOT NULL DEFAULT 'scheduled',
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT offline_class_sessions_duration CHECK (ends_at IS NULL OR ends_at > starts_at),
  CONSTRAINT offline_class_sessions_room_length CHECK (room IS NULL OR char_length(btrim(room)) BETWEEN 1 AND 160),
  CONSTRAINT offline_class_sessions_status CHECK (status IN ('scheduled', 'completed', 'cancelled')),
  CONSTRAINT offline_class_sessions_group_lesson_unique UNIQUE (group_id, lesson_id)
);

CREATE INDEX offline_class_sessions_group_starts_at
  ON offline_class_sessions (group_id, starts_at)
  WHERE status <> 'cancelled';

CREATE TRIGGER offline_class_sessions_touch_updated_at
BEFORE UPDATE ON offline_class_sessions
FOR EACH ROW EXECUTE FUNCTION learning_touch_updated_at();

CREATE TABLE offline_attendance_records (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  session_id bigint NOT NULL REFERENCES offline_class_sessions(id) ON DELETE RESTRICT,
  student_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  attendance_status text NOT NULL,
  note text,
  recorded_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT offline_attendance_status CHECK (attendance_status IN ('present', 'late', 'absent')),
  CONSTRAINT offline_attendance_note_length CHECK (note IS NULL OR char_length(note) <= 2_000),
  CONSTRAINT offline_attendance_one_per_student_session UNIQUE (session_id, student_id)
);

CREATE INDEX offline_attendance_student_recorded_at
  ON offline_attendance_records (student_id, recorded_at DESC);

CREATE TRIGGER offline_attendance_touch_updated_at
BEFORE UPDATE ON offline_attendance_records
FOR EACH ROW EXECUTE FUNCTION learning_touch_updated_at();

CREATE TABLE offline_homework (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  group_id bigint NOT NULL REFERENCES groups(id) ON DELETE RESTRICT,
  lesson_id bigint REFERENCES lessons(id) ON DELETE SET NULL,
  title text NOT NULL,
  body text,
  due_at timestamptz,
  is_published boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT offline_homework_title_length CHECK (char_length(btrim(title)) BETWEEN 1 AND 300),
  CONSTRAINT offline_homework_body_length CHECK (body IS NULL OR char_length(body) <= 50_000)
);

CREATE INDEX offline_homework_group_published_due
  ON offline_homework (group_id, due_at, id)
  WHERE is_published;

CREATE TRIGGER offline_homework_touch_updated_at
BEFORE UPDATE ON offline_homework
FOR EACH ROW EXECUTE FUNCTION learning_touch_updated_at();

CREATE TABLE offline_homework_submissions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  homework_id bigint NOT NULL REFERENCES offline_homework(id) ON DELETE RESTRICT,
  student_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  body text,
  status text NOT NULL DEFAULT 'draft',
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  student_feedback text,
  internal_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT offline_homework_submission_status CHECK (status IN ('draft', 'submitted', 'returned', 'accepted')),
  CONSTRAINT offline_homework_submission_body_length CHECK (body IS NULL OR char_length(body) <= 50_000),
  CONSTRAINT offline_homework_submission_feedback_length CHECK (student_feedback IS NULL OR char_length(student_feedback) <= 10_000),
  CONSTRAINT offline_homework_submission_internal_length CHECK (internal_note IS NULL OR char_length(internal_note) <= 10_000),
  CONSTRAINT offline_homework_submission_submitted_at CHECK (
    (status = 'draft' AND submitted_at IS NULL) OR (status <> 'draft' AND submitted_at IS NOT NULL)
  ),
  CONSTRAINT offline_homework_submission_unique UNIQUE (homework_id, student_id)
);

CREATE INDEX offline_homework_submissions_student_status
  ON offline_homework_submissions (student_id, status, updated_at DESC);

CREATE INDEX offline_homework_submissions_homework_status
  ON offline_homework_submissions (homework_id, status, updated_at DESC);

CREATE TRIGGER offline_homework_submissions_touch_updated_at
BEFORE UPDATE ON offline_homework_submissions
FOR EACH ROW EXECUTE FUNCTION learning_touch_updated_at();

CREATE TABLE offline_grades (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  group_id bigint NOT NULL REFERENCES groups(id) ON DELETE RESTRICT,
  student_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  class_session_id bigint REFERENCES offline_class_sessions(id) ON DELETE RESTRICT,
  homework_id bigint REFERENCES offline_homework(id) ON DELETE RESTRICT,
  grade_type text NOT NULL,
  title text NOT NULL,
  score smallint NOT NULL,
  is_published boolean NOT NULL DEFAULT false,
  recorded_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT offline_grades_type CHECK (grade_type IN ('lesson', 'homework', 'manual')),
  CONSTRAINT offline_grades_title_length CHECK (char_length(btrim(title)) BETWEEN 1 AND 300),
  CONSTRAINT offline_grades_score CHECK (score BETWEEN 0 AND 100),
  CONSTRAINT offline_grades_source_shape CHECK (
    (grade_type = 'lesson' AND class_session_id IS NOT NULL AND homework_id IS NULL)
    OR (grade_type = 'homework' AND class_session_id IS NULL AND homework_id IS NOT NULL)
    OR (grade_type = 'manual' AND class_session_id IS NULL AND homework_id IS NULL)
  )
);

CREATE UNIQUE INDEX offline_grades_student_session_unique
  ON offline_grades (student_id, class_session_id)
  WHERE class_session_id IS NOT NULL;
CREATE UNIQUE INDEX offline_grades_student_homework_unique
  ON offline_grades (student_id, homework_id)
  WHERE homework_id IS NOT NULL;
CREATE INDEX offline_grades_student_published
  ON offline_grades (student_id, created_at DESC)
  WHERE is_published;

CREATE TRIGGER offline_grades_touch_updated_at
BEFORE UPDATE ON offline_grades
FOR EACH ROW EXECUTE FUNCTION learning_touch_updated_at();

CREATE TABLE offline_comments (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  group_id bigint NOT NULL REFERENCES groups(id) ON DELETE RESTRICT,
  student_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  class_session_id bigint REFERENCES offline_class_sessions(id) ON DELETE SET NULL,
  homework_id bigint REFERENCES offline_homework(id) ON DELETE SET NULL,
  grade_id bigint REFERENCES offline_grades(id) ON DELETE SET NULL,
  visibility text NOT NULL DEFAULT 'student',
  body text NOT NULL,
  author_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT offline_comments_visibility CHECK (visibility IN ('student', 'internal')),
  CONSTRAINT offline_comments_body_length CHECK (char_length(btrim(body)) BETWEEN 1 AND 10_000)
);

CREATE INDEX offline_comments_student_visibility_time
  ON offline_comments (student_id, visibility, created_at DESC);
CREATE INDEX offline_comments_group_time
  ON offline_comments (group_id, created_at DESC);

CREATE TRIGGER offline_comments_touch_updated_at
BEFORE UPDATE ON offline_comments
FOR EACH ROW EXECUTE FUNCTION learning_touch_updated_at();

CREATE TABLE offline_announcements (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  group_id bigint NOT NULL REFERENCES groups(id) ON DELETE RESTRICT,
  title text NOT NULL,
  body text NOT NULL,
  is_published boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT offline_announcements_title_length CHECK (char_length(btrim(title)) BETWEEN 1 AND 300),
  CONSTRAINT offline_announcements_body_length CHECK (char_length(btrim(body)) BETWEEN 1 AND 20_000),
  CONSTRAINT offline_announcements_published_at CHECK (
    (is_published = false AND published_at IS NULL) OR (is_published = true AND published_at IS NOT NULL)
  )
);

CREATE INDEX offline_announcements_group_published_time
  ON offline_announcements (group_id, published_at DESC)
  WHERE is_published;

CREATE TRIGGER offline_announcements_touch_updated_at
BEFORE UPDATE ON offline_announcements
FOR EACH ROW EXECUTE FUNCTION learning_touch_updated_at();
