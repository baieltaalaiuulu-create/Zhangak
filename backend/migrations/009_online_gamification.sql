-- Trusted online gamification.  XP is append-only and every award has an
-- idempotent business key; resetting the trainer never changes historic XP.

CREATE TABLE student_xp_awards (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  student_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  course_id bigint REFERENCES courses(id) ON DELETE RESTRICT,
  award_key text NOT NULL,
  source_type text NOT NULL,
  source_id text NOT NULL,
  xp_amount integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT student_xp_awards_key_length CHECK (char_length(award_key) BETWEEN 3 AND 240),
  CONSTRAINT student_xp_awards_source_type CHECK (source_type IN ('lesson', 'daily', 'trainer_section', 'admin_adjustment')),
  CONSTRAINT student_xp_awards_source_id_length CHECK (char_length(source_id) BETWEEN 1 AND 240),
  CONSTRAINT student_xp_awards_amount CHECK (xp_amount BETWEEN 1 AND 10000),
  CONSTRAINT student_xp_awards_once UNIQUE (student_id, award_key)
);

CREATE INDEX student_xp_awards_rank ON student_xp_awards (student_id, created_at DESC);
CREATE INDEX student_xp_awards_course_rank ON student_xp_awards (course_id, student_id);

CREATE TABLE daily_challenges (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  course_id bigint NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
  challenge_date date NOT NULL,
  title text NOT NULL,
  subject text NOT NULL,
  xp_reward integer NOT NULL DEFAULT 30,
  is_published boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT daily_challenges_title_length CHECK (char_length(btrim(title)) BETWEEN 1 AND 300),
  CONSTRAINT daily_challenges_subject_length CHECK (char_length(btrim(subject)) BETWEEN 1 AND 80),
  CONSTRAINT daily_challenges_xp_reward CHECK (xp_reward BETWEEN 1 AND 10000),
  CONSTRAINT daily_challenges_course_day_unique UNIQUE (course_id, challenge_date)
);

CREATE INDEX daily_challenges_online_today ON daily_challenges (course_id, challenge_date)
  WHERE is_published;

CREATE TABLE daily_challenge_questions (
  daily_challenge_id bigint NOT NULL REFERENCES daily_challenges(id) ON DELETE RESTRICT,
  practice_question_id bigint NOT NULL REFERENCES practice_questions(id) ON DELETE RESTRICT,
  position smallint NOT NULL,
  question_text text NOT NULL,
  options jsonb NOT NULL,
  correct_answer text NOT NULL,
  explanation text,
  section text NOT NULL,
  topic text,
  difficulty text NOT NULL,
  image_url text,
  PRIMARY KEY (daily_challenge_id, practice_question_id),
  CONSTRAINT daily_challenge_questions_position_unique UNIQUE (daily_challenge_id, position),
  CONSTRAINT daily_challenge_questions_position CHECK (position BETWEEN 1 AND 15),
  CONSTRAINT daily_challenge_questions_correct_answer CHECK (correct_answer IN ('a', 'b', 'c', 'd')),
  CONSTRAINT daily_challenge_questions_count_shape CHECK (jsonb_typeof(options) = 'object' AND options ?& ARRAY['a', 'b', 'c', 'd']::text[])
);

CREATE TABLE daily_challenge_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_challenge_id bigint NOT NULL REFERENCES daily_challenges(id) ON DELETE RESTRICT,
  student_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  begin_idempotency_key uuid NOT NULL,
  submit_idempotency_key uuid,
  status text NOT NULL DEFAULT 'started',
  correct_count smallint,
  score_percent numeric(5,2),
  star_count smallint,
  xp_awarded integer,
  started_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  CONSTRAINT daily_challenge_attempts_status CHECK (status IN ('started', 'submitted')),
  CONSTRAINT daily_challenge_attempts_score CHECK ((correct_count IS NULL OR correct_count BETWEEN 0 AND 15) AND (score_percent IS NULL OR score_percent BETWEEN 0 AND 100)),
  CONSTRAINT daily_challenge_attempts_stars CHECK (star_count IS NULL OR star_count BETWEEN 0 AND 3),
  CONSTRAINT daily_challenge_attempts_xp CHECK (xp_awarded IS NULL OR xp_awarded BETWEEN 0 AND 10000),
  CONSTRAINT daily_challenge_attempts_state CHECK (
    (status = 'started' AND submit_idempotency_key IS NULL AND correct_count IS NULL AND score_percent IS NULL AND star_count IS NULL AND xp_awarded IS NULL AND submitted_at IS NULL)
    OR (status = 'submitted' AND submit_idempotency_key IS NOT NULL AND correct_count IS NOT NULL AND score_percent IS NOT NULL AND star_count IS NOT NULL AND xp_awarded IS NOT NULL AND submitted_at IS NOT NULL)
  ),
  CONSTRAINT daily_challenge_attempts_once UNIQUE (student_id, daily_challenge_id),
  CONSTRAINT daily_challenge_attempts_begin_key UNIQUE (student_id, begin_idempotency_key),
  CONSTRAINT daily_challenge_attempts_submit_key UNIQUE (student_id, submit_idempotency_key)
);

CREATE INDEX daily_challenge_attempts_student_recent ON daily_challenge_attempts (student_id, started_at DESC);

-- Persist every submitted choice, including skipped questions. This makes the
-- post-submission review and a student's history reproducible without ever
-- exposing a key before finalisation.
CREATE TABLE daily_challenge_attempt_answers (
  daily_challenge_attempt_id uuid NOT NULL REFERENCES daily_challenge_attempts(id) ON DELETE RESTRICT,
  practice_question_id bigint NOT NULL,
  selected_answer text,
  is_correct boolean NOT NULL,
  PRIMARY KEY (daily_challenge_attempt_id, practice_question_id),
  CONSTRAINT daily_challenge_attempt_answers_selected_answer CHECK (selected_answer IS NULL OR selected_answer IN ('a', 'b', 'c', 'd'))
);

CREATE INDEX daily_challenge_attempt_answers_review ON daily_challenge_attempt_answers (daily_challenge_attempt_id);

CREATE TABLE trainer_answers (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  student_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  practice_question_id bigint NOT NULL REFERENCES practice_questions(id) ON DELETE RESTRICT,
  question_text text NOT NULL,
  options jsonb NOT NULL,
  correct_answer text NOT NULL,
  explanation text,
  selected_answer text NOT NULL,
  is_correct boolean NOT NULL,
  idempotency_key uuid NOT NULL,
  answered_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trainer_answers_selected_answer CHECK (selected_answer IN ('a', 'b', 'c', 'd')),
  CONSTRAINT trainer_answers_correct_answer CHECK (correct_answer IN ('a', 'b', 'c', 'd')),
  CONSTRAINT trainer_answers_options_shape CHECK (jsonb_typeof(options) = 'object' AND options ?& ARRAY['a', 'b', 'c', 'd']::text[]),
  CONSTRAINT trainer_answers_idempotency UNIQUE (student_id, idempotency_key)
);

CREATE INDEX trainer_answers_history ON trainer_answers (student_id, answered_at DESC);

-- The browser may submit only a question that this server issued to the same
-- student. The ephemeral issue is consumed during the scoring transaction.
CREATE TABLE trainer_question_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  practice_question_id bigint NOT NULL REFERENCES practice_questions(id) ON DELETE RESTRICT,
  issued_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trainer_question_issues_once UNIQUE (student_id, practice_question_id)
);

CREATE INDEX trainer_question_issues_student ON trainer_question_issues (student_id, issued_at DESC);

-- A correct answer removes this question from the trainer only for this
-- student. Wrong answers deliberately do not create mastery and may repeat.
CREATE TABLE trainer_question_mastery (
  student_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  practice_question_id bigint NOT NULL REFERENCES practice_questions(id) ON DELETE RESTRICT,
  first_correct_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (student_id, practice_question_id)
);

CREATE INDEX trainer_question_mastery_student ON trainer_question_mastery (student_id, first_correct_at DESC);

CREATE TABLE trainer_progress_resets (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  student_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  requested_at timestamptz NOT NULL DEFAULT now(),
  removed_mastery_count integer NOT NULL DEFAULT 0,
  CONSTRAINT trainer_progress_resets_count CHECK (removed_mastery_count >= 0)
);

CREATE TRIGGER daily_challenges_touch_updated_at
BEFORE UPDATE ON daily_challenges
FOR EACH ROW EXECUTE FUNCTION learning_touch_updated_at();

CREATE OR REPLACE FUNCTION daily_challenge_publish_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.is_published AND (TG_OP = 'INSERT' OR NOT OLD.is_published) THEN
    IF (SELECT count(*) FROM daily_challenge_questions WHERE daily_challenge_id = NEW.id) <> 15 THEN
      RAISE EXCEPTION 'a published daily challenge must contain exactly 15 questions';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER daily_challenges_publish_guard
BEFORE INSERT OR UPDATE OF is_published ON daily_challenges
FOR EACH ROW EXECUTE FUNCTION daily_challenge_publish_guard();

CREATE OR REPLACE FUNCTION daily_challenge_questions_immutable_after_publish()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  challenge_id bigint := COALESCE(NEW.daily_challenge_id, OLD.daily_challenge_id);
BEGIN
  IF EXISTS (SELECT 1 FROM daily_challenges WHERE id = challenge_id AND is_published) THEN
    RAISE EXCEPTION 'published daily challenge questions are immutable';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER daily_challenge_questions_immutable
BEFORE INSERT OR UPDATE OR DELETE ON daily_challenge_questions
FOR EACH ROW EXECUTE FUNCTION daily_challenge_questions_immutable_after_publish();
