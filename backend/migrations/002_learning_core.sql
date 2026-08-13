-- Core first-party learning domain.
--
-- Public API handlers must never project `correct_answer` from either
-- practice_questions or practice_attempt_items before an attempt is submitted.
-- The attempt tables are deliberately append-only from the client perspective:
-- routes create a snapshot at begin time, score it on the server, and then
-- transition the attempt once from `started` to a terminal state.

CREATE OR REPLACE FUNCTION learning_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE courses (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL,
  code text,
  level text,
  subject text,
  description text,
  cover_image_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT courses_name_length CHECK (char_length(btrim(name)) BETWEEN 1 AND 200),
  CONSTRAINT courses_code_normalized CHECK (
    code IS NULL OR (
      code = lower(btrim(code))
      AND char_length(code) BETWEEN 2 AND 64
      AND code ~ '^[a-z0-9][a-z0-9_-]*$'
    )
  ),
  CONSTRAINT courses_level_length CHECK (level IS NULL OR char_length(btrim(level)) BETWEEN 1 AND 80),
  CONSTRAINT courses_subject_length CHECK (subject IS NULL OR char_length(btrim(subject)) BETWEEN 1 AND 80),
  CONSTRAINT courses_description_length CHECK (description IS NULL OR char_length(description) <= 20_000),
  CONSTRAINT courses_cover_image_length CHECK (cover_image_url IS NULL OR char_length(cover_image_url) <= 2_048)
);

CREATE UNIQUE INDEX courses_code_unique ON courses (lower(code)) WHERE code IS NOT NULL;
CREATE INDEX courses_active_name ON courses (name) WHERE is_active;

CREATE TABLE groups (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  course_id bigint NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
  teacher_id uuid REFERENCES users(id) ON DELETE SET NULL,
  name text NOT NULL,
  delivery_mode text NOT NULL DEFAULT 'offline',
  capacity integer,
  starts_on date,
  ends_on date,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT groups_name_length CHECK (char_length(btrim(name)) BETWEEN 1 AND 160),
  CONSTRAINT groups_delivery_mode CHECK (delivery_mode IN ('online', 'offline', 'hybrid')),
  CONSTRAINT groups_capacity CHECK (capacity IS NULL OR capacity BETWEEN 1 AND 5_000),
  CONSTRAINT groups_dates CHECK (ends_on IS NULL OR starts_on IS NULL OR ends_on >= starts_on)
);

CREATE UNIQUE INDEX groups_active_course_name_unique
  ON groups (course_id, lower(btrim(name)))
  WHERE is_active;
CREATE INDEX groups_teacher_active ON groups (teacher_id, name) WHERE is_active;
CREATE INDEX groups_course_active ON groups (course_id, name) WHERE is_active;

-- A membership is retained after a student leaves so attendance and results
-- remain attributable to the group that issued them. Only one current
-- membership per student/group is possible.
CREATE TABLE group_students (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  group_id bigint NOT NULL REFERENCES groups(id) ON DELETE RESTRICT,
  student_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  joined_at timestamptz NOT NULL DEFAULT now(),
  left_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT group_students_dates CHECK (left_at IS NULL OR left_at >= joined_at)
);

CREATE UNIQUE INDEX group_students_current_unique
  ON group_students (group_id, student_id)
  WHERE left_at IS NULL;
CREATE INDEX group_students_student_current ON group_students (student_id, group_id) WHERE left_at IS NULL;

CREATE TABLE lessons (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  course_id bigint NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
  lesson_number integer NOT NULL,
  title text NOT NULL,
  description text,
  subject text,
  section text,
  topic text,
  lesson_date date,
  duration_minutes integer,
  content_url text,
  is_test boolean NOT NULL DEFAULT false,
  is_published boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lessons_number CHECK (lesson_number BETWEEN 1 AND 10_000),
  CONSTRAINT lessons_title_length CHECK (char_length(btrim(title)) BETWEEN 1 AND 300),
  CONSTRAINT lessons_description_length CHECK (description IS NULL OR char_length(description) <= 50_000),
  CONSTRAINT lessons_subject_length CHECK (subject IS NULL OR char_length(btrim(subject)) BETWEEN 1 AND 80),
  CONSTRAINT lessons_section_length CHECK (section IS NULL OR char_length(btrim(section)) BETWEEN 1 AND 64),
  CONSTRAINT lessons_topic_length CHECK (topic IS NULL OR char_length(btrim(topic)) BETWEEN 1 AND 200),
  CONSTRAINT lessons_duration CHECK (duration_minutes IS NULL OR duration_minutes BETWEEN 1 AND 600),
  CONSTRAINT lessons_content_url_length CHECK (content_url IS NULL OR char_length(content_url) <= 2_048),
  CONSTRAINT lessons_course_number_unique UNIQUE (course_id, lesson_number),
  -- This key makes the test -> lesson/course relationship enforceable below.
  CONSTRAINT lessons_id_course_unique UNIQUE (id, course_id)
);

CREATE INDEX lessons_course_published_order ON lessons (course_id, lesson_number) WHERE is_published;

CREATE TABLE lesson_progress (
  student_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  lesson_id bigint NOT NULL REFERENCES lessons(id) ON DELETE RESTRICT,
  completion_percent smallint NOT NULL DEFAULT 0,
  last_viewed_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (student_id, lesson_id),
  CONSTRAINT lesson_progress_percent CHECK (completion_percent BETWEEN 0 AND 100),
  CONSTRAINT lesson_progress_completed CHECK (completed_at IS NULL OR completion_percent = 100)
);

CREATE INDEX lesson_progress_lesson_completed ON lesson_progress (lesson_id, completed_at) WHERE completed_at IS NOT NULL;

CREATE TABLE practice_tests (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  course_id bigint REFERENCES courses(id) ON DELETE RESTRICT,
  lesson_id bigint,
  title text NOT NULL,
  subject text NOT NULL,
  test_type text NOT NULL DEFAULT 'practice',
  description text,
  time_limit_seconds integer,
  max_attempts integer,
  pass_score_ratio numeric(5,4) NOT NULL DEFAULT 0.7000,
  is_published boolean NOT NULL DEFAULT false,
  available_from timestamptz,
  available_until timestamptz,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT practice_tests_title_length CHECK (char_length(btrim(title)) BETWEEN 1 AND 500),
  CONSTRAINT practice_tests_subject_length CHECK (char_length(btrim(subject)) BETWEEN 1 AND 80),
  CONSTRAINT practice_tests_type CHECK (test_type IN ('practice', 'mock', 'bank', 'diagnostic')),
  CONSTRAINT practice_tests_description_length CHECK (description IS NULL OR char_length(description) <= 20_000),
  CONSTRAINT practice_tests_time_limit CHECK (time_limit_seconds IS NULL OR time_limit_seconds BETWEEN 1 AND 86_400),
  -- NULL means unlimited attempts; zero is never a valid maximum.
  CONSTRAINT practice_tests_max_attempts CHECK (max_attempts IS NULL OR max_attempts BETWEEN 1 AND 1_000),
  CONSTRAINT practice_tests_pass_ratio CHECK (pass_score_ratio BETWEEN 0 AND 1),
  CONSTRAINT practice_tests_availability CHECK (available_until IS NULL OR available_from IS NULL OR available_until > available_from),
  -- A lesson-bound test must belong to the same course as the lesson.
  CONSTRAINT practice_tests_lesson_requires_course CHECK (lesson_id IS NULL OR course_id IS NOT NULL),
  FOREIGN KEY (lesson_id, course_id) REFERENCES lessons(id, course_id) ON DELETE RESTRICT
);

CREATE INDEX practice_tests_course_published ON practice_tests (course_id, created_at DESC) WHERE is_published;
CREATE INDEX practice_tests_lesson_published ON practice_tests (lesson_id, created_at DESC) WHERE is_published;
CREATE INDEX practice_tests_subject_published ON practice_tests (subject, created_at DESC) WHERE is_published;

CREATE TABLE practice_questions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  practice_test_id bigint NOT NULL REFERENCES practice_tests(id) ON DELETE RESTRICT,
  question_text text NOT NULL,
  options jsonb NOT NULL,
  -- Server-only: no public/read-before-submit projection may select this field.
  correct_answer text NOT NULL,
  explanation text,
  section text NOT NULL DEFAULT 'general',
  topic text,
  difficulty text NOT NULL DEFAULT 'medium',
  image_url text,
  position integer NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT practice_questions_text_length CHECK (char_length(btrim(question_text)) BETWEEN 1 AND 10_000),
  CONSTRAINT practice_questions_options_shape CHECK (
    jsonb_typeof(options) = 'object'
    AND options ?& ARRAY['a', 'b', 'c', 'd']::text[]
    AND options - ARRAY['a', 'b', 'c', 'd']::text[] = '{}'::jsonb
    AND jsonb_typeof(options -> 'a') = 'string' AND char_length(btrim(options ->> 'a')) BETWEEN 1 AND 10_000
    AND jsonb_typeof(options -> 'b') = 'string' AND char_length(btrim(options ->> 'b')) BETWEEN 1 AND 10_000
    AND jsonb_typeof(options -> 'c') = 'string' AND char_length(btrim(options ->> 'c')) BETWEEN 1 AND 10_000
    AND jsonb_typeof(options -> 'd') = 'string' AND char_length(btrim(options ->> 'd')) BETWEEN 1 AND 10_000
  ),
  CONSTRAINT practice_questions_correct_answer CHECK (correct_answer IN ('a', 'b', 'c', 'd')),
  CONSTRAINT practice_questions_explanation_length CHECK (explanation IS NULL OR char_length(explanation) <= 20_000),
  CONSTRAINT practice_questions_section_format CHECK (section ~ '^[a-z][a-z0-9_-]{0,63}$'),
  CONSTRAINT practice_questions_topic_length CHECK (topic IS NULL OR char_length(btrim(topic)) BETWEEN 1 AND 200),
  CONSTRAINT practice_questions_difficulty CHECK (difficulty IN ('easy', 'medium', 'hard')),
  CONSTRAINT practice_questions_image_url_length CHECK (image_url IS NULL OR char_length(image_url) <= 2_048),
  CONSTRAINT practice_questions_position CHECK (position BETWEEN 1 AND 200),
  CONSTRAINT practice_questions_test_position_unique UNIQUE (practice_test_id, position)
);

CREATE INDEX practice_questions_active_test_position
  ON practice_questions (practice_test_id, position)
  WHERE is_active;

-- A practice_attempt is the authoritative result record. Its test settings
-- are copied at start, which prevents later content edits from altering a
-- completed result. The route must allocate attempt_number while locking the
-- student's test attempts, then insert the corresponding item snapshots.
CREATE TABLE practice_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  practice_test_id bigint NOT NULL REFERENCES practice_tests(id) ON DELETE RESTRICT,
  -- Course and lesson are copied from the test at begin time so future test
  -- edits cannot rewrite a historical result's curriculum context.
  course_id bigint REFERENCES courses(id) ON DELETE RESTRICT,
  lesson_id bigint,
  attempt_number integer NOT NULL,
  begin_idempotency_key uuid NOT NULL,
  submit_idempotency_key uuid,
  status text NOT NULL DEFAULT 'started',
  test_title text NOT NULL,
  test_type text NOT NULL,
  time_limit_seconds integer,
  pass_score_ratio numeric(5,4) NOT NULL,
  question_count integer NOT NULL,
  correct_count integer,
  score_percent numeric(5,2),
  passed boolean,
  elapsed_seconds integer,
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  submitted_at timestamptz,
  CONSTRAINT practice_attempts_number CHECK (attempt_number BETWEEN 1 AND 1_000),
  CONSTRAINT practice_attempts_status CHECK (status IN ('started', 'submitted', 'expired', 'abandoned')),
  CONSTRAINT practice_attempts_title_length CHECK (char_length(btrim(test_title)) BETWEEN 1 AND 500),
  CONSTRAINT practice_attempts_type CHECK (test_type IN ('practice', 'mock', 'bank', 'diagnostic')),
  CONSTRAINT practice_attempts_time_limit CHECK (time_limit_seconds IS NULL OR time_limit_seconds BETWEEN 1 AND 86_400),
  CONSTRAINT practice_attempts_pass_ratio CHECK (pass_score_ratio BETWEEN 0 AND 1),
  CONSTRAINT practice_attempts_question_count CHECK (question_count BETWEEN 1 AND 200),
  CONSTRAINT practice_attempts_lesson_requires_course CHECK (lesson_id IS NULL OR course_id IS NOT NULL),
  FOREIGN KEY (lesson_id, course_id) REFERENCES lessons(id, course_id) ON DELETE RESTRICT,
  CONSTRAINT practice_attempts_time_window CHECK (expires_at IS NULL OR expires_at >= started_at),
  CONSTRAINT practice_attempts_submission_time CHECK (submitted_at IS NULL OR submitted_at >= started_at),
  CONSTRAINT practice_attempts_elapsed_seconds CHECK (elapsed_seconds IS NULL OR elapsed_seconds BETWEEN 0 AND 86_400),
  CONSTRAINT practice_attempts_result_range CHECK (
    (correct_count IS NULL OR correct_count BETWEEN 0 AND question_count)
    AND (score_percent IS NULL OR score_percent BETWEEN 0 AND 100)
  ),
  CONSTRAINT practice_attempts_submission_state CHECK (
    (
      status = 'submitted'
      AND submit_idempotency_key IS NOT NULL
      AND submitted_at IS NOT NULL
      AND correct_count IS NOT NULL
      AND score_percent IS NOT NULL
      AND passed IS NOT NULL
      AND elapsed_seconds IS NOT NULL
    )
    OR (
      status <> 'submitted'
      AND submit_idempotency_key IS NULL
      AND submitted_at IS NULL
      AND correct_count IS NULL
      AND score_percent IS NULL
      AND passed IS NULL
      AND elapsed_seconds IS NULL
    )
  ),
  CONSTRAINT practice_attempts_pass_state CHECK (
    status <> 'submitted' OR passed = (score_percent >= pass_score_ratio * 100)
  ),
  CONSTRAINT practice_attempts_student_test_number_unique UNIQUE (student_id, practice_test_id, attempt_number),
  CONSTRAINT practice_attempts_begin_idempotency_unique UNIQUE (student_id, begin_idempotency_key),
  CONSTRAINT practice_attempts_submit_idempotency_unique UNIQUE (student_id, submit_idempotency_key)
);

-- A student has at most one not-yet-finalized attempt for a test. Expiring or
-- abandoning it is a deliberate server-side transition before a new attempt.
CREATE UNIQUE INDEX practice_attempts_one_open_attempt
  ON practice_attempts (student_id, practice_test_id)
  WHERE status = 'started';
CREATE INDEX practice_attempts_student_recent ON practice_attempts (student_id, started_at DESC);
CREATE INDEX practice_attempts_submitted_results
  ON practice_attempts (student_id, submitted_at DESC)
  WHERE status = 'submitted';
CREATE INDEX practice_attempts_course_submitted_results
  ON practice_attempts (course_id, submitted_at DESC)
  WHERE status = 'submitted';

-- Item rows are immutable copies of the test questions as they existed when
-- the attempt was opened. `selected_answer` and `is_correct` are written only
-- by the server during the final scoring transaction.
CREATE TABLE practice_attempt_items (
  attempt_id uuid NOT NULL REFERENCES practice_attempts(id) ON DELETE RESTRICT,
  practice_question_id bigint NOT NULL REFERENCES practice_questions(id) ON DELETE RESTRICT,
  position integer NOT NULL,
  question_text text NOT NULL,
  options jsonb NOT NULL,
  correct_answer text NOT NULL,
  explanation text,
  section text NOT NULL,
  topic text,
  difficulty text NOT NULL,
  image_url text,
  selected_answer text,
  is_correct boolean,
  PRIMARY KEY (attempt_id, practice_question_id),
  CONSTRAINT practice_attempt_items_position_unique UNIQUE (attempt_id, position),
  CONSTRAINT practice_attempt_items_position CHECK (position BETWEEN 1 AND 200),
  CONSTRAINT practice_attempt_items_text_length CHECK (char_length(btrim(question_text)) BETWEEN 1 AND 10_000),
  CONSTRAINT practice_attempt_items_options_shape CHECK (
    jsonb_typeof(options) = 'object'
    AND options ?& ARRAY['a', 'b', 'c', 'd']::text[]
    AND options - ARRAY['a', 'b', 'c', 'd']::text[] = '{}'::jsonb
    AND jsonb_typeof(options -> 'a') = 'string' AND char_length(btrim(options ->> 'a')) BETWEEN 1 AND 10_000
    AND jsonb_typeof(options -> 'b') = 'string' AND char_length(btrim(options ->> 'b')) BETWEEN 1 AND 10_000
    AND jsonb_typeof(options -> 'c') = 'string' AND char_length(btrim(options ->> 'c')) BETWEEN 1 AND 10_000
    AND jsonb_typeof(options -> 'd') = 'string' AND char_length(btrim(options ->> 'd')) BETWEEN 1 AND 10_000
  ),
  CONSTRAINT practice_attempt_items_correct_answer CHECK (correct_answer IN ('a', 'b', 'c', 'd')),
  CONSTRAINT practice_attempt_items_explanation_length CHECK (explanation IS NULL OR char_length(explanation) <= 20_000),
  CONSTRAINT practice_attempt_items_section_format CHECK (section ~ '^[a-z][a-z0-9_-]{0,63}$'),
  CONSTRAINT practice_attempt_items_topic_length CHECK (topic IS NULL OR char_length(btrim(topic)) BETWEEN 1 AND 200),
  CONSTRAINT practice_attempt_items_difficulty CHECK (difficulty IN ('easy', 'medium', 'hard')),
  CONSTRAINT practice_attempt_items_image_url_length CHECK (image_url IS NULL OR char_length(image_url) <= 2_048),
  CONSTRAINT practice_attempt_items_selected_answer CHECK (selected_answer IS NULL OR selected_answer IN ('a', 'b', 'c', 'd')),
  CONSTRAINT practice_attempt_items_score_consistency CHECK (
    is_correct IS NULL OR is_correct = COALESCE(selected_answer = correct_answer, false)
  )
);

CREATE INDEX practice_attempt_items_attempt_position ON practice_attempt_items (attempt_id, position);

-- The view is deliberately answer-key free and is safe as the base query for
-- a student's history/result-list endpoint. Detailed review remains a route
-- concern: it must be released only after `status = 'submitted'` and only to
-- the attempt owner (or a permitted teacher/admin).
CREATE VIEW practice_results AS
SELECT
  a.id,
  a.student_id,
  a.practice_test_id,
  a.course_id,
  a.lesson_id,
  a.attempt_number,
  a.test_title,
  a.test_type,
  a.question_count,
  a.correct_count,
  a.score_percent,
  a.passed,
  a.elapsed_seconds,
  a.started_at,
  a.submitted_at
FROM practice_attempts AS a
WHERE a.status = 'submitted';

CREATE OR REPLACE FUNCTION learning_validate_attempt_item()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  current_status text;
  expected_test_id bigint;
  expected_question_text text;
  expected_options jsonb;
  expected_correct_answer text;
  expected_explanation text;
  expected_section text;
  expected_topic text;
  expected_difficulty text;
  expected_image_url text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Practice attempt snapshots cannot be deleted';
  END IF;

  SELECT status, practice_test_id
    INTO current_status, expected_test_id
    FROM practice_attempts
   WHERE id = NEW.attempt_id
   FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Practice attempt does not exist';
  END IF;
  IF current_status <> 'started' THEN
    RAISE EXCEPTION 'Practice attempt items are locked after the attempt leaves started state';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.attempt_id IS DISTINCT FROM NEW.attempt_id
      OR OLD.practice_question_id IS DISTINCT FROM NEW.practice_question_id
      OR OLD.position IS DISTINCT FROM NEW.position
      OR OLD.question_text IS DISTINCT FROM NEW.question_text
      OR OLD.options IS DISTINCT FROM NEW.options
      OR OLD.correct_answer IS DISTINCT FROM NEW.correct_answer
      OR OLD.explanation IS DISTINCT FROM NEW.explanation
      OR OLD.section IS DISTINCT FROM NEW.section
      OR OLD.topic IS DISTINCT FROM NEW.topic
      OR OLD.difficulty IS DISTINCT FROM NEW.difficulty
      OR OLD.image_url IS DISTINCT FROM NEW.image_url THEN
      RAISE EXCEPTION 'Practice attempt snapshots are immutable';
    END IF;

    IF OLD.selected_answer IS NOT NULL AND OLD.selected_answer IS DISTINCT FROM NEW.selected_answer THEN
      RAISE EXCEPTION 'A submitted answer cannot be changed';
    END IF;
    IF OLD.is_correct IS NOT NULL AND OLD.is_correct IS DISTINCT FROM NEW.is_correct THEN
      RAISE EXCEPTION 'A scored answer cannot be changed';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.selected_answer IS NOT NULL OR NEW.is_correct IS NOT NULL THEN
    RAISE EXCEPTION 'Practice attempt items must start unanswered';
  END IF;

  SELECT
    q.question_text,
    q.options,
    q.correct_answer,
    q.explanation,
    q.section,
    q.topic,
    q.difficulty,
    q.image_url
    INTO
      expected_question_text,
      expected_options,
      expected_correct_answer,
      expected_explanation,
      expected_section,
      expected_topic,
      expected_difficulty,
      expected_image_url
    FROM practice_questions AS q
   WHERE q.id = NEW.practice_question_id
     AND q.practice_test_id = expected_test_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Question does not belong to the attempt test';
  END IF;

  IF NEW.question_text IS DISTINCT FROM expected_question_text
    OR NEW.options IS DISTINCT FROM expected_options
    OR NEW.correct_answer IS DISTINCT FROM expected_correct_answer
    OR NEW.explanation IS DISTINCT FROM expected_explanation
    OR NEW.section IS DISTINCT FROM expected_section
    OR NEW.topic IS DISTINCT FROM expected_topic
    OR NEW.difficulty IS DISTINCT FROM expected_difficulty
    OR NEW.image_url IS DISTINCT FROM expected_image_url THEN
    RAISE EXCEPTION 'Practice attempt item must match its question snapshot';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION learning_validate_attempt_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  item_count integer;
  computed_correct integer;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'started' THEN
      RAISE EXCEPTION 'Practice attempts must be created in started state';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.student_id IS DISTINCT FROM NEW.student_id
    OR OLD.practice_test_id IS DISTINCT FROM NEW.practice_test_id
    OR OLD.course_id IS DISTINCT FROM NEW.course_id
    OR OLD.lesson_id IS DISTINCT FROM NEW.lesson_id
    OR OLD.attempt_number IS DISTINCT FROM NEW.attempt_number
    OR OLD.begin_idempotency_key IS DISTINCT FROM NEW.begin_idempotency_key
    OR OLD.test_title IS DISTINCT FROM NEW.test_title
    OR OLD.test_type IS DISTINCT FROM NEW.test_type
    OR OLD.time_limit_seconds IS DISTINCT FROM NEW.time_limit_seconds
    OR OLD.pass_score_ratio IS DISTINCT FROM NEW.pass_score_ratio
    OR OLD.question_count IS DISTINCT FROM NEW.question_count
    OR OLD.started_at IS DISTINCT FROM NEW.started_at
    OR OLD.expires_at IS DISTINCT FROM NEW.expires_at THEN
    RAISE EXCEPTION 'Practice attempt identity and configuration are immutable';
  END IF;

  IF OLD.status <> 'started' THEN
    RAISE EXCEPTION 'Practice attempts cannot change after a terminal state';
  END IF;
  IF NEW.status NOT IN ('submitted', 'expired', 'abandoned') THEN
    RAISE EXCEPTION 'Practice attempt must move from started to a terminal state';
  END IF;

  IF NEW.status = 'submitted' THEN
    SELECT
      count(*)::integer,
      count(*) FILTER (WHERE is_correct)::integer
      INTO item_count, computed_correct
      FROM practice_attempt_items
     WHERE attempt_id = NEW.id;

    IF item_count <> NEW.question_count THEN
      RAISE EXCEPTION 'Attempt question count does not match its snapshot';
    END IF;
    IF EXISTS (
      SELECT 1
        FROM practice_attempt_items
       WHERE attempt_id = NEW.id
         AND is_correct IS NULL
    ) THEN
      RAISE EXCEPTION 'Every attempt item must be scored before submission';
    END IF;
    IF NEW.correct_count <> computed_correct THEN
      RAISE EXCEPTION 'Attempt correct count does not match item scores';
    END IF;
    IF NEW.score_percent <> round((computed_correct::numeric / NEW.question_count) * 100, 2) THEN
      RAISE EXCEPTION 'Attempt score percent does not match item scores';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER courses_touch_updated_at
BEFORE UPDATE ON courses
FOR EACH ROW EXECUTE FUNCTION learning_touch_updated_at();

CREATE TRIGGER groups_touch_updated_at
BEFORE UPDATE ON groups
FOR EACH ROW EXECUTE FUNCTION learning_touch_updated_at();

CREATE TRIGGER lessons_touch_updated_at
BEFORE UPDATE ON lessons
FOR EACH ROW EXECUTE FUNCTION learning_touch_updated_at();

CREATE TRIGGER lesson_progress_touch_updated_at
BEFORE UPDATE ON lesson_progress
FOR EACH ROW EXECUTE FUNCTION learning_touch_updated_at();

CREATE TRIGGER practice_tests_touch_updated_at
BEFORE UPDATE ON practice_tests
FOR EACH ROW EXECUTE FUNCTION learning_touch_updated_at();

CREATE TRIGGER practice_questions_touch_updated_at
BEFORE UPDATE ON practice_questions
FOR EACH ROW EXECUTE FUNCTION learning_touch_updated_at();

CREATE TRIGGER practice_attempt_items_validate
BEFORE INSERT OR UPDATE OR DELETE ON practice_attempt_items
FOR EACH ROW EXECUTE FUNCTION learning_validate_attempt_item();

CREATE TRIGGER practice_attempts_validate_transition
BEFORE INSERT OR UPDATE ON practice_attempts
FOR EACH ROW EXECUTE FUNCTION learning_validate_attempt_transition();
