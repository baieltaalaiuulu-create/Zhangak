-- Public lead intake stays separate from an account and an enrolment.  A
-- visitor never receives course access merely by submitting their phone
-- number; an administrator creates the student account and confirms payment
-- before this application becomes an active course_enrollment.

CREATE TABLE public_applications (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  applicant_name text NOT NULL,
  phone text NOT NULL,
  city text NOT NULL,
  course_id bigint NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'new',
  assigned_to uuid REFERENCES users(id) ON DELETE SET NULL,
  enrollment_id bigint UNIQUE REFERENCES course_enrollments(id) ON DELETE SET NULL,
  payment_confirmed_at timestamptz,
  payment_confirmed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT public_applications_name_length CHECK (char_length(btrim(applicant_name)) BETWEEN 2 AND 200),
  CONSTRAINT public_applications_phone_length CHECK (phone ~ '^\\+[1-9][0-9]{7,18}$'),
  CONSTRAINT public_applications_city_length CHECK (char_length(btrim(city)) BETWEEN 2 AND 120),
  CONSTRAINT public_applications_status CHECK (status IN (
    'new', 'contacted', 'awaiting_payment', 'awaiting_confirmation',
    'enrolled', 'declined', 'cancelled'
  )),
  CONSTRAINT public_applications_payment_shape CHECK (
    (status = 'enrolled' AND enrollment_id IS NOT NULL AND payment_confirmed_at IS NOT NULL AND payment_confirmed_by IS NOT NULL)
    OR (status <> 'enrolled' AND enrollment_id IS NULL)
  )
);

CREATE INDEX public_applications_queue
  ON public_applications (status, updated_at DESC, id DESC);
CREATE INDEX public_applications_course_queue
  ON public_applications (course_id, status, updated_at DESC);

CREATE TRIGGER public_applications_touch_updated_at
BEFORE UPDATE ON public_applications
FOR EACH ROW EXECUTE FUNCTION learning_touch_updated_at();

CREATE TABLE public_application_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  application_id bigint NOT NULL REFERENCES public_applications(id) ON DELETE RESTRICT,
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  from_status text,
  to_status text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT public_application_events_type CHECK (event_type IN ('submitted', 'status_changed', 'note_added', 'payment_confirmed')),
  CONSTRAINT public_application_events_status CHECK (
    (event_type = 'status_changed' AND from_status IS NOT NULL AND to_status IS NOT NULL)
    OR (event_type <> 'status_changed' AND from_status IS NULL AND to_status IS NULL)
  ),
  CONSTRAINT public_application_events_note_length CHECK (note IS NULL OR char_length(btrim(note)) BETWEEN 1 AND 4_000)
);

CREATE INDEX public_application_events_timeline
  ON public_application_events (application_id, created_at DESC, id DESC);
