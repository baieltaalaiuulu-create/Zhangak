-- Time-bounded online access.  The course remains one unified ORT curriculum;
-- 1/3/12 months are commercial access terms on an enrollment, not duplicate
-- course rows.  Offline courses keep their existing group lifecycle.

ALTER TABLE course_enrollments
  ADD COLUMN access_plan text,
  ADD COLUMN access_started_at timestamptz,
  ADD COLUMN access_expires_at timestamptz,
  ADD COLUMN frozen_at timestamptz,
  ADD COLUMN frozen_seconds_remaining bigint,
  ADD COLUMN freeze_reason text;

ALTER TABLE course_enrollments
  ADD CONSTRAINT course_enrollments_access_plan CHECK (
    access_plan IS NULL OR access_plan IN ('one_month', 'three_months', 'one_year')
  ),
  ADD CONSTRAINT course_enrollments_access_dates CHECK (
    access_expires_at IS NULL OR (
      access_started_at IS NOT NULL AND access_expires_at > access_started_at
    )
  ),
  ADD CONSTRAINT course_enrollments_frozen_remaining CHECK (
    frozen_seconds_remaining IS NULL OR frozen_seconds_remaining >= 0
  ),
  ADD CONSTRAINT course_enrollments_freeze_shape CHECK (
    (frozen_at IS NULL AND frozen_seconds_remaining IS NULL AND freeze_reason IS NULL)
    OR
    (frozen_at IS NOT NULL AND frozen_seconds_remaining IS NOT NULL)
  ),
  ADD CONSTRAINT course_enrollments_freeze_reason_length CHECK (
    freeze_reason IS NULL OR char_length(btrim(freeze_reason)) BETWEEN 1 AND 500
  );

-- Preserve every existing online learner.  Legacy access starts a fresh
-- twelve-month preproduction term at migration time rather than unexpectedly
-- expiring accounts based on old prototype timestamps.
UPDATE course_enrollments e
   SET access_plan = 'one_year',
       access_started_at = now(),
       access_expires_at = now() + interval '12 months'
  FROM courses c
 WHERE c.id = e.course_id
   AND c.delivery_mode = 'online'
   AND e.status IN ('active', 'suspended');

-- A single view is the canonical runtime access boundary.  Student-facing
-- routes must read this view, while admin lifecycle routes continue to read
-- the underlying table so expired/frozen records remain manageable.
CREATE VIEW active_course_enrollments AS
SELECT e.*
  FROM course_enrollments e
  JOIN courses c ON c.id = e.course_id
 WHERE e.status = 'active'
   AND (
     c.delivery_mode = 'offline'
     OR (
       e.access_plan IS NOT NULL
       AND e.access_expires_at > now()
       AND e.frozen_at IS NULL
     )
   );

CREATE INDEX course_enrollments_online_access_expiry
  ON course_enrollments (access_expires_at, student_id)
  WHERE status = 'active' AND access_expires_at IS NOT NULL;

