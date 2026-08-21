-- Scheduled in-person mock ORT events.  These events are global to the
-- online platform, rather than being coupled to a particular learning unit.
-- Publishing is an explicit admin action; students only ever see published
-- events that are still open for registration.

CREATE TABLE mock_exam_sessions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title text NOT NULL DEFAULT 'Пробный ОРТ',
  starts_at timestamptz NOT NULL,
  city text NOT NULL,
  venue text NOT NULL,
  capacity integer,
  registration_closes_at timestamptz,
  is_published boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mock_exam_sessions_title CHECK (char_length(btrim(title)) BETWEEN 1 AND 200),
  CONSTRAINT mock_exam_sessions_city CHECK (char_length(btrim(city)) BETWEEN 1 AND 120),
  CONSTRAINT mock_exam_sessions_venue CHECK (char_length(btrim(venue)) BETWEEN 1 AND 300),
  CONSTRAINT mock_exam_sessions_capacity CHECK (capacity IS NULL OR capacity BETWEEN 1 AND 10_000),
  CONSTRAINT mock_exam_sessions_registration_window CHECK (
    registration_closes_at IS NULL OR registration_closes_at <= starts_at
  )
);

CREATE INDEX mock_exam_sessions_student_feed
  ON mock_exam_sessions (starts_at)
  WHERE is_published;

CREATE TRIGGER mock_exam_sessions_touch_updated_at
BEFORE UPDATE ON mock_exam_sessions
FOR EACH ROW EXECUTE FUNCTION learning_touch_updated_at();

CREATE TABLE mock_exam_registrations (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  mock_exam_session_id bigint NOT NULL REFERENCES mock_exam_sessions(id) ON DELETE RESTRICT,
  student_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  registered_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mock_exam_registrations_unique_student UNIQUE (mock_exam_session_id, student_id)
);

CREATE INDEX mock_exam_registrations_student_recent
  ON mock_exam_registrations (student_id, registered_at DESC);
